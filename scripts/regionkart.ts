// Tegner regionkartet for Nord-Norge: de 80 kommunene som flater, fylkes- og
// kommunegrensene som linjer, og landet som maske.
//
//   npm run regionkart        (tsx scripts/regionkart.ts)
//
// Kildene:
//
// - Kommunegrensene er Kartverkets områdepolygon for hver kommune
//   (ws.geonorge.no/kommuneinfo/v1/kommuner/<nr>/omrade). Polygonet er
//   kommunens areal slik Kartverket fører det, med sjøarealet. Derfor ligger
//   Røst og Træna som flater i havet og ikke som prikker.
// - Landflaten er regnet fra de samme åpne høydedataene som kartbladene på
//   kommunesiden (Mapzen Terrain Tiles, AWS Open Data). Den brukes som maske:
//   kommuneflatene står fullt på land og svakt på sjø, så kysten kjennes igjen.
//
// Skriptet projiserer, forenkler og skriver ferdige SVG-stier til
// src/data/regionkart/. Siden tegner stiene på serveren og trenger ingen
// JavaScript for å vise kartet.
//
// Forenklingen går på felles grenser, ikke på hver kommune for seg. To
// nabokommuner deler én forenklet grenselinje, så det aldri blir glipper eller
// overlapp mellom flatene. Grensene deles ved knutepunktene der tre flater
// møtes, forenkles én gang hver og settes sammen igjen (samme idé som TopoJSON).
//
// Projeksjonen er Lamberts konforme kjegleprojeksjon med sentralmeridian 20° Ø
// og standardparallellene 66° og 70° N. Den holder formen over hele regionen,
// fra Bindal til Grense Jakobselv, og nord peker opp midt i kartet. UTM 33 ville
// vridd Finnmark 14° mot høyre.
//
// Utdata er deterministisk: samme mellomlager gir byte-like filer. Hentedatoen
// er datoen polygonene ble hentet, lagret ved siden av polygonet i
// mellomlageret, ikke datoen skriptet kjørte.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contours } from "d3-contour";
import { PNG } from "pngjs";

import type { Regionregister } from "../src/data/region/types";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UT = join(ROT, "src", "data", "regionkart");
const CACHE = join(ROT, "node_modules", ".cache", "maktkart-regionkart");
const REGISTER = join(ROT, "src", "data", "region", "nord-norge.json");

/** Bredden på regionens viewBox. Én enhet er rundt 460 m. Heltall holder. */
const BREDDE = 2000;
/** Margen rundt regionen i viewBox-enheter, så kysten ikke går i rammen. */
const MARG = 40;
/**
 * Toleranse for forenkling av grensene, i viewBox-enheter. Fylkessiden viser
 * et utsnitt i omtrent dobbel målestokk, så grensene må tåle det.
 */
const FORENKLING = 0.55;

/**
 * Landmasken finnes i to oppløsninger. Forsiden viser hele regionen og får en
 * grov maske. Fylkessiden viser ett fylke større og får en finere maske for
 * sitt utsnitt, i fylkesfila, så forsiden ikke bærer den.
 */
interface Landoppsett {
  /** Cellestørrelsen i gitteret, i viewBox-enheter. */
  celle: number;
  /** Zoomnivået for høydeflisene. 7 er rundt 450 m per piksel her nord, 8 rundt 230 m. */
  zoom: number;
  /** Toleranse for kystlinjen, i viewBox-enheter. */
  forenkling: number;
  /** Øyer mindre enn dette (viewBox-enheter i kvadrat) tas ikke med. */
  minOy: number;
}
const LAND_REGION: Landoppsett = { celle: 1.25, zoom: 7, forenkling: 1.1, minOy: 6 };
const LAND_FYLKE: Landoppsett = { celle: 0.55, zoom: 8, forenkling: 0.55, minOy: 1.5 };

const KARTVERKET_URL = "https://ws.geonorge.no/kommuneinfo/v1/kommuner";
export const ATTRIBUSJON =
  "Kommunegrenser: Kartverket. Landflate tegnet fra åpne høydedata: Mapzen Terrain Tiles på AWS Open Data.";

type Punkt = [number, number];

// ---------------------------------------------------------------------------
// Henting
// ---------------------------------------------------------------------------

/** Venter uten å gå ut av den synkrone flyten. Høflig mot kildene: ≤ 3 kall i sekundet. */
function vent(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

interface Omrade {
  kommunenummer: string;
  kommunenavn: string;
  omrade: { type: "MultiPolygon" | "Polygon"; coordinates: number[][][][] | number[][][] };
}

/** Polygonet og datoen det ble hentet. Hentes bare når det ikke ligger i mellomlageret. */
function hentOmrade(nr: string): { omrade: Omrade; hentet: string } {
  const fil = join(CACHE, "omrade", `${nr}.json`);
  const datofil = join(CACHE, "omrade", `${nr}.hentet`);
  if (!existsSync(fil) || !existsSync(datofil)) {
    mkdirSync(dirname(fil), { recursive: true });
    // curl, ikke fetch: curl stoler på proxyens CA i utviklingsmiljøet.
    execFileSync("curl", ["-sS", "-f", "-m", "60", "-o", fil, `${KARTVERKET_URL}/${nr}/omrade`]);
    writeFileSync(datofil, new Date().toISOString().slice(0, 10));
    vent(350);
  }
  return {
    omrade: JSON.parse(readFileSync(fil, "utf8")) as Omrade,
    hentet: readFileSync(datofil, "utf8").trim(),
  };
}

function hentFlis(z: number, x: number, y: number): PNG {
  const fil = join(ROT, "node_modules", ".cache", "maktkart-terreng", String(z), String(x), `${y}.png`);
  if (!existsSync(fil)) {
    mkdirSync(dirname(fil), { recursive: true });
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    execFileSync("curl", ["-sS", "-f", "-m", "60", "-o", fil, url]);
    vent(350);
  }
  return PNG.sync.read(readFileSync(fil));
}

// ---------------------------------------------------------------------------
// Projeksjon: Lambert konform kjegle, kule
// ---------------------------------------------------------------------------

const R = 6371000;
const rad = (g: number) => (g * Math.PI) / 180;
const LAT1 = rad(66);
const LAT2 = rad(70);
const LAT0 = rad(68);
const LON0 = rad(20);
const N =
  Math.log(Math.cos(LAT1) / Math.cos(LAT2)) /
  Math.log(Math.tan(Math.PI / 4 + LAT2 / 2) / Math.tan(Math.PI / 4 + LAT1 / 2));
const F = (Math.cos(LAT1) * Math.tan(Math.PI / 4 + LAT1 / 2) ** N) / N;
const RHO0 = (R * F) / Math.tan(Math.PI / 4 + LAT0 / 2) ** N;

/** [lon, lat] i grader → [x, y] i meter, y mot nord. */
function projiser([lon, lat]: Punkt): Punkt {
  const rho = (R * F) / Math.tan(Math.PI / 4 + rad(lat) / 2) ** N;
  const t = N * (rad(lon) - LON0);
  return [rho * Math.sin(t), RHO0 - rho * Math.cos(t)];
}

/** [x, y] i meter → [lon, lat] i grader. */
function tilbake([x, y]: Punkt): Punkt {
  const rho = Math.sign(N) * Math.hypot(x, RHO0 - y);
  const t = Math.atan2(x, RHO0 - y);
  const lat = 2 * Math.atan(((R * F) / rho) ** (1 / N)) - Math.PI / 2;
  return [((LON0 + t / N) * 180) / Math.PI, (lat * 180) / Math.PI];
}

// ---------------------------------------------------------------------------
// Forenkling
// ---------------------------------------------------------------------------

function avstand(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker. Endepunktene beholdes alltid. Iterativ, så lange grenser ikke sprenger stakken. */
function forenkle(p: Punkt[], eps: number): Punkt[] {
  if (p.length <= 2) return p.slice();
  const behold = new Uint8Array(p.length);
  behold[0] = 1;
  behold[p.length - 1] = 1;
  const stakk: [number, number][] = [[0, p.length - 1]];
  while (stakk.length) {
    const [a, b] = stakk.pop()!;
    let maks = 0;
    let i = -1;
    for (let k = a + 1; k < b; k++) {
      const d = avstand(p[k]!, p[a]!, p[b]!);
      if (d > maks) {
        maks = d;
        i = k;
      }
    }
    if (i >= 0 && maks > eps) {
      behold[i] = 1;
      stakk.push([a, i], [i, b]);
    }
  }
  return p.filter((_, k) => behold[k]);
}

/** En lukket ring (første punkt = siste) deles i punktet lengst fra start og forenkles i to. */
function forenkleRing(p: Punkt[], eps: number): Punkt[] {
  let m = 0;
  let maks = -1;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.hypot(p[i]![0] - p[0]![0], p[i]![1] - p[0]![1]);
    if (d > maks) {
      maks = d;
      m = i;
    }
  }
  if (m === 0) return p.slice();
  return [...forenkle(p.slice(0, m + 1), eps).slice(0, -1), ...forenkle(p.slice(m), eps)];
}

function areal(ring: Punkt[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return a / 2;
}

// ---------------------------------------------------------------------------
// Felles grenser: ringene deles i buer ved knutepunktene
// ---------------------------------------------------------------------------

interface Ring {
  kommune: string;
  /** Punktnøklene, uten gjentatt sluttpunkt. */
  nokler: string[];
}

interface Bue {
  punkter: Punkt[];
  /** Kommunene som bruker buen. To for en indre grense, én for yttergrensen. */
  brukere: Set<string>;
  lukket: boolean;
}

/**
 * Deler alle ringene i buer. Et knutepunkt er et punkt der naboene ikke er de
 * samme i alle ringene punktet står i: der tre flater møtes, eller der en
 * felles grense slutter og yttergrensen tar over.
 */
function lagBuer(ringer: Ring[], xy: Map<string, Punkt>) {
  const naboer = new Map<string, [string, string]>();
  const knute = new Set<string>();
  for (const r of ringer) {
    const n = r.nokler.length;
    for (let i = 0; i < n; i++) {
      const p = r.nokler[i]!;
      const a = r.nokler[(i - 1 + n) % n]!;
      const b = r.nokler[(i + 1) % n]!;
      const kjent = naboer.get(p);
      if (!kjent) naboer.set(p, [a, b]);
      else if (!((kjent[0] === a && kjent[1] === b) || (kjent[0] === b && kjent[1] === a))) {
        knute.add(p);
      }
    }
  }

  const buer: Bue[] = [];
  const buerAv = new Map<string, number>();
  /** Ringens buer: indeks og om buen er snudd. */
  const ringbuer: { kommune: string; deler: { bue: number; snudd: boolean }[] }[] = [];

  const registrer = (nokler: string[], lukket: boolean, kommune: string) => {
    // Samme bue kan komme i begge retninger. Nøkkelen er den minste av de to.
    const fram = nokler.join(";");
    const bak = [...nokler].reverse().join(";");
    const nokkel = fram < bak ? fram : bak;
    let i = buerAv.get(nokkel);
    if (i === undefined) {
      i = buer.length;
      buerAv.set(nokkel, i);
      const ordnet = fram < bak ? nokler : [...nokler].reverse();
      buer.push({ punkter: ordnet.map((k) => xy.get(k)!), brukere: new Set(), lukket });
    }
    buer[i]!.brukere.add(kommune);
    return { bue: i, snudd: !(fram < bak) };
  };

  for (const r of ringer) {
    const n = r.nokler.length;
    const start = r.nokler.findIndex((k) => knute.has(k));
    if (start < 0) {
      // Ingen knutepunkt: hele ringen er én lukket bue. Den roteres til det
      // minste punktet, så en enklave og hullet den står i blir samme bue.
      let m = 0;
      for (let i = 1; i < n; i++) if (r.nokler[i]! < r.nokler[m]!) m = i;
      const rotert = [...r.nokler.slice(m), ...r.nokler.slice(0, m), r.nokler[m]!];
      ringbuer.push({ kommune: r.kommune, deler: [registrer(rotert, true, r.kommune)] });
      continue;
    }
    const deler: { bue: number; snudd: boolean }[] = [];
    let bit = [r.nokler[start]!];
    for (let s = 1; s <= n; s++) {
      const k = r.nokler[(start + s) % n]!;
      bit.push(k);
      if (knute.has(k)) {
        deler.push(registrer(bit, false, r.kommune));
        bit = [k];
      }
    }
    ringbuer.push({ kommune: r.kommune, deler });
  }
  return { buer, ringbuer };
}

// ---------------------------------------------------------------------------
// SVG-stier
// ---------------------------------------------------------------------------

const rund = (p: Punkt): Punkt => [Math.round(p[0]), Math.round(p[1])];

/** Rundede punkter uten like naboer. */
function rene(p: Punkt[]): Punkt[] {
  const ut: Punkt[] = [];
  for (const q of p.map(rund)) {
    const s = ut[ut.length - 1];
    if (!s || s[0] !== q[0] || s[1] !== q[1]) ut.push(q);
  }
  return ut;
}

/** Første punkt absolutt, resten relativt. Heltall, så ingen avrundingsfeil hoper seg opp. */
function linje(p: Punkt[], lukket: boolean): string {
  let d = `M${p[0]![0]} ${p[0]![1]}`;
  let rel = "";
  for (let i = 1; i < p.length; i++) {
    const dx = p[i]![0] - p[i - 1]![0];
    const dy = p[i]![1] - p[i - 1]![1];
    // Negative tall trenger ikke skilletegn foran seg.
    rel += `${rel && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`;
  }
  if (rel) d += `l${rel}`;
  return lukket ? `${d}z` : d;
}

// ---------------------------------------------------------------------------
// Landmasken
// ---------------------------------------------------------------------------

const lonTilX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * 256;
const latTilY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * 256;
};

/**
 * Land som polygoner i viewBox-enheter. Gitteret legges i kartets egen
 * projeksjon, og hver celle slår opp høyden der den ligger, så konturene
 * trenger ingen ny projisering.
 */
function landmaske(
  [x0, y0, bredde, hoyde]: [number, number, number, number],
  { celle, zoom, forenkling, minOy }: Landoppsett,
  tilMeter: (p: Punkt) => Punkt,
): Punkt[][] {
  const gb = Math.ceil(bredde / celle);
  const gh = Math.ceil(hoyde / celle);
  const fliser = new Map<string, PNG>();
  const hoydeI = (lon: number, lat: number) => {
    const px = lonTilX(lon, zoom);
    const py = latTilY(lat, zoom);
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    const nokkel = `${tx}/${ty}`;
    let flis = fliser.get(nokkel);
    if (!flis) {
      flis = hentFlis(zoom, tx, ty);
      fliser.set(nokkel, flis);
    }
    const x = Math.min(255, Math.max(0, Math.floor(px - tx * 256)));
    const y = Math.min(255, Math.max(0, Math.floor(py - ty * 256)));
    const i = (y * 256 + x) * 4;
    const d = flis.data;
    return (d[i] ?? 0) * 256 + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) / 256 - 32768;
  };
  const g = new Float64Array(gb * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gb; i++) {
      const [lon, lat] = tilbake(tilMeter([x0 + (i + 0.5) * celle, y0 + (j + 0.5) * celle]));
      g[j * gb + i] = hoydeI(lon, lat) > 0.5 ? 1 : 0;
    }
  }
  // Gitteret er 0/1. En lett utjevning gir konturene rette kanter i stedet for trapper.
  const glatt = new Float64Array(g.length);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gb; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= gb || jj >= gh) continue;
          const w = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1;
          s += g[jj * gb + ii]! * w;
          n += w;
        }
      }
      glatt[j * gb + i] = s / n;
    }
  }
  const [flate] = contours().size([gb, gh]).thresholds([0.5])(Array.from(glatt));
  const ringer: Punkt[][] = [];
  for (const polygon of flate!.coordinates) {
    for (const ring of polygon) {
      const p = ring.map(([x, y]) => [x0 + x! * celle, y0 + y! * celle] as Punkt);
      if (Math.abs(areal(p)) < minOy) continue;
      const f = rene(forenkleRing(p, forenkling));
      if (f.length >= 4) ringer.push(f);
    }
  }
  return ringer;
}

// ---------------------------------------------------------------------------
// Etikettpunkt: det punktet på land som ligger lengst inne i kommunen
// ---------------------------------------------------------------------------

function inni(p: Punkt, ring: Punkt[]): boolean {
  let ja = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      ja = !ja;
    }
  }
  return ja;
}

function tilKant(p: Punkt, ringer: Punkt[][]): number {
  let min = Infinity;
  for (const r of ringer) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) min = Math.min(min, avstand(p, r[j]!, r[i]!));
  }
  return min;
}

function etikettpunkt(ringer: Punkt[][], erLand: (p: Punkt) => boolean): Punkt {
  const alle = ringer.flat();
  const xs = alle.map((p) => p[0]);
  const ys = alle.map((p) => p[1]);
  let [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  let best: { p: Punkt; d: number } | null = null;
  // Grovt rutenett, så to finere runder rundt det beste punktet. Punkter på land
  // går foran punkter på sjø, så navnet ikke havner i fjorden.
  for (let runde = 0; runde < 3; runde++) {
    const steg = Math.max((x1 - x0) / 28, (y1 - y0) / 28, 0.25);
    for (let x = x0; x <= x1; x += steg) {
      for (let y = y0; y <= y1; y += steg) {
        const p: Punkt = [x, y];
        const i = ringer.filter((r) => inni(p, r)).length % 2 === 1;
        if (!i) continue;
        const d = tilKant(p, ringer) + (erLand(p) ? 1000 : 0);
        if (!best || d > best.d) best = { p, d };
      }
    }
    if (!best) break;
    const r = steg * 2;
    [x0, y0, x1, y1] = [best.p[0] - r, best.p[1] - r, best.p[0] + r, best.p[1] + r];
  }
  const p = best?.p ?? [(x0 + x1) / 2, (y0 + y1) / 2];
  return [Math.round(p[0]), Math.round(p[1])];
}

// ---------------------------------------------------------------------------
// Hovedløpet
// ---------------------------------------------------------------------------

function main() {
  const register = JSON.parse(readFileSync(REGISTER, "utf8")) as Regionregister;
  const kommuner = [...register.kommuner].sort((a, b) => (a.nr < b.nr ? -1 : 1));
  const fylkeAv = new Map(kommuner.map((k) => [k.nr, k.fylkesnr]));

  // 1. Hent og projiser. Punktnøkkelen er kildens egne koordinater, så to
  //    kommuner som deler et hjørne, deler nøkkelen.
  const meter = new Map<string, Punkt>();
  const ringer: Ring[] = [];
  const datoer: string[] = [];
  for (const k of kommuner) {
    const { omrade, hentet } = hentOmrade(k.nr);
    if (omrade.kommunenummer !== k.nr) {
      throw new Error(`Kartverket svarte med ${omrade.kommunenummer} for ${k.nr}`);
    }
    datoer.push(hentet);
    const polygoner = (
      omrade.omrade.type === "Polygon" ? [omrade.omrade.coordinates] : omrade.omrade.coordinates
    ) as number[][][][];
    for (const polygon of polygoner) {
      for (const ring of polygon) {
        const nokler: string[] = [];
        for (const [lon, lat] of ring) {
          const n = `${lon},${lat}`;
          if (!meter.has(n)) meter.set(n, projiser([lon!, lat!]));
          if (nokler[nokler.length - 1] !== n) nokler.push(n);
        }
        if (nokler.length > 1 && nokler[0] === nokler[nokler.length - 1]) nokler.pop();
        if (nokler.length >= 3) ringer.push({ kommune: k.nr, nokler });
      }
    }
    console.log(`  ${k.nr} ${k.navn}: ${polygoner.length} flate(r)`);
  }

  // 2. Skaler til viewBox. y peker ned i SVG.
  const alle = [...meter.values()];
  const minX = Math.min(...alle.map((p) => p[0]));
  const maxX = Math.max(...alle.map((p) => p[0]));
  const minY = Math.min(...alle.map((p) => p[1]));
  const maxY = Math.max(...alle.map((p) => p[1]));
  const skala = (BREDDE - 2 * MARG) / (maxX - minX);
  const hoyde = Math.round((maxY - minY) * skala + 2 * MARG);
  const tilVb = (p: Punkt): Punkt => [(p[0] - minX) * skala + MARG, (maxY - p[1]) * skala + MARG];
  const tilMeter = (p: Punkt): Punkt => [(p[0] - MARG) / skala + minX, maxY - (p[1] - MARG) / skala];
  const xy = new Map([...meter.entries()].map(([k, p]) => [k, tilVb(p)] as const));

  // 3. Buer, forenklet én gang hver.
  const { buer, ringbuer } = lagBuer(ringer, xy);
  const forenklet = buer.map((b) =>
    b.lukket ? forenkleRing(b.punkter, FORENKLING) : forenkle(b.punkter, FORENKLING),
  );
  const delte = buer.filter((b) => b.brukere.size === 2).length;
  console.log(`  ${buer.length} grenselinjer, ${delte} av dem delt mellom to kommuner`);

  // 4. Kommuneflatene, satt sammen av de forenklede buene.
  const flater = new Map<string, Punkt[][]>();
  for (const r of ringbuer) {
    const ring: Punkt[] = [];
    for (const { bue, snudd } of r.deler) {
      const p = snudd ? [...forenklet[bue]!].reverse() : forenklet[bue]!;
      ring.push(...(ring.length ? p.slice(1) : p));
    }
    const ren = rene(ring);
    if (ren.length > 1) {
      const a = ren[0]!;
      const b = ren[ren.length - 1]!;
      if (a[0] === b[0] && a[1] === b[1]) ren.pop();
    }
    if (ren.length < 3) continue;
    const liste = flater.get(r.kommune) ?? [];
    liste.push(ren);
    flater.set(r.kommune, liste);
  }

  // 5. Linjene: grenser mellom kommuner i samme fylke, fylkesgrenser og yttergrensen.
  const kommunegrenser: string[] = [];
  const fylkesgrenser: string[] = [];
  const ytre: string[] = [];
  buer.forEach((b, i) => {
    const d = linje(rene(forenklet[i]!), b.lukket);
    const brukere = [...b.brukere];
    if (brukere.length === 1) ytre.push(d);
    else if (fylkeAv.get(brukere[0]!) !== fylkeAv.get(brukere[1]!)) fylkesgrenser.push(d);
    else kommunegrenser.push(d);
  });

  // 6. Landmaskene og etikettpunktene. Etikettene legges på land når kommunen
  //    har land, så navnet ikke havner i fjorden.
  console.log("  landmaske for regionen …");
  const land = landmaske([0, 0, BREDDE, hoyde], LAND_REGION, tilMeter);
  const paaLand = (ringer: Punkt[][]) => (p: Punkt) =>
    ringer.filter((r) => inni(p, r)).length % 2 === 1;

  mkdirSync(UT, { recursive: true });
  const hentet = [...datoer].sort().at(-1)!;
  const filer: string[] = [];
  const skriv = (navn: string, innhold: unknown) => {
    writeFileSync(join(UT, navn), `${JSON.stringify(innhold)}\n`);
    filer.push(navn);
  };

  const fylker = register.fylker.map((f) => {
    const egne = kommuner.filter((k) => k.fylkesnr === f.nr);
    const punkter = egne.flatMap((k) => (flater.get(k.nr) ?? []).flat());
    const x0 = Math.round(Math.min(...punkter.map((p) => p[0])) - MARG / 2);
    const y0 = Math.round(Math.min(...punkter.map((p) => p[1])) - MARG / 2);
    const x1 = Math.round(Math.max(...punkter.map((p) => p[0])) + MARG / 2);
    const y1 = Math.round(Math.max(...punkter.map((p) => p[1])) + MARG / 2);
    const utsnitt: [number, number, number, number] = [x0, y0, x1 - x0, y1 - y0];
    console.log(`  landmaske for fylke ${f.nr} …`);
    const fin = landmaske(utsnitt, LAND_FYLKE, tilMeter);
    skriv(`${f.nr}.json`, {
      fylkesnr: f.nr,
      utsnitt,
      land: fin.map((r) => linje(r, true)).join(""),
      kommuner: egne.map((k) => {
        const ringerK = flater.get(k.nr);
        if (!ringerK?.length) throw new Error(`Kommunen ${k.nr} fikk ingen flate`);
        return {
          nr: k.nr,
          d: ringerK.map((r) => linje(r, true)).join(""),
          etikett: etikettpunkt(ringerK, paaLand(fin)),
          // Flaten i kvadrat-enheter, med sjøarealet. Siden velger etter den
          // hvilke navn som får plass på kartet.
          flate: Math.round(ringerK.reduce((s, r) => s - areal(r), 0)),
        };
      }),
    });
    return {
      nr: f.nr,
      utsnitt,
      etikett: etikettpunkt(
        egne.flatMap((k) => flater.get(k.nr) ?? []),
        paaLand(land),
      ),
    };
  });

  skriv("grenser.json", {
    meta: {
      kilde: "Kartverket kommuneinfo (API), områdepolygon per kommune",
      url: KARTVERKET_URL,
      hentet,
      landflate: "Mapzen Terrain Tiles (AWS Open Data), zoom 7 for regionen og 8 for fylkene",
      attribusjon: ATTRIBUSJON,
      projeksjon:
        "Lambert konform kjegle, sentralmeridian 20° Ø, standardparalleller 66° og 70° N (kule)",
      merknad:
        "Kommuneflatene er kommunenes areal med sjøarealet, slik Kartverket fører dem. Felles grenser er forenklet én gang, så nabokommuner deler grenselinje.",
    },
    bredde: BREDDE,
    hoyde,
    ytre: ytre.join(""),
    fylkesgrenser: fylkesgrenser.join(""),
    kommunegrenser: kommunegrenser.join(""),
    fylker,
  });
  skriv("land.json", { land: land.map((r) => linje(r, true)).join("") });

  let sum = 0;
  for (const navn of filer) {
    const b = readFileSync(join(UT, navn)).length;
    sum += b;
    console.log(`  ${navn}: ${(b / 1024).toFixed(1)} KB`);
  }
  console.log(`  totalt ${(sum / 1024).toFixed(1)} KB, hentet ${hentet}`);
}

main();
