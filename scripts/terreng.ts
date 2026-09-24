// Tegner kartbladet for hver kommune i src/data/terreng/utsnitt.json.
//
//   npm run terreng            alle kommunene i utsnitt.json
//   npm run terreng -- 5501    bare Tromsø
//
// Skriptet henter åpne høydedata (Mapzen Terrain Tiles i terrarium-format, AWS
// Open Data) med curl, bygger et glattet høydegitter, regner kystlinje og koter
// med d3-contour og skriver ferdige SVG-stier til src/data/terreng/<kommunenr>.json.
// Siden tegner stiene på serveren og trenger ingen JavaScript for å vise kartet.
//
// Terrenget er et byggesteg og ikke noe siden regner selv, av tre grunner:
// fliser fra en tredjepart skal ikke hentes av leseren (personvern), gitteret er
// for stort til å sendes, og marching squares i nettleseren kostet
// prototypen synlig tid ved første maling.
//
// Utdata er deterministisk: samme fliser gir byte-lik fil. Ingen tidsstempel,
// fast avrunding, fast rekkefølge. Flisene mellomlagres i
// node_modules/.cache/maktkart-terreng, så en ny kjøring ikke henter på nytt.
//
// Høydetall vises aldri. Kotene er bakgrunn, og DESIGN.md sier at terreng under
// data leses som data. Derfor står bare ekvidistansen i fila, ikke høydene i
// klartekst på kartet.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contours } from "d3-contour";
import { PNG } from "pngjs";

import type { Linjesett, Terreng } from "../src/lib/terreng";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAPPE = join(ROT, "src", "data", "terreng");
const CACHE = join(ROT, "node_modules", ".cache", "maktkart-terreng");

/** Bredden på viewBox. Heltall i denne skalaen gir under én skjermpiksel feil. */
const BREDDE = 1000;
/** Celler i gitteret, i bredden. Rundt 90 m per celle for Tromsø. */
const CELLER = 400;
/** Avstand mellom kotene i meter. */
const EKVIDISTANSE = 100;
/** Hver femte kote er tellekurve og tegnes tykkere, som på topografiske kart. */
const TELLEKURVE = 500;
/** Havet er alt under denne høyden. Terrarium har dybdedata, så sjøen er negativ. */
const KYST = 0.5;
/** Toleranse for forenkling, i gitterceller. */
const FORENKLING = 0.3;
/** Kortere linjer enn dette (i celler) er støy og tas ikke med. */
const MIN_LINJE = 4;

export const KILDE = "Mapzen Terrain Tiles (AWS Open Data)";
export const ATTRIBUSJON =
  "Terreng tegnet fra åpne høydedata: Mapzen Terrain Tiles på AWS Open Data. Ingen høydetall vises.";

interface Utsnitt {
  navn: string;
  /** [vest, sør, øst, nord] i grader. */
  bbox: [number, number, number, number];
  zoom: number;
  merknad?: string;
}

type Punkt = [number, number];

// ---------------------------------------------------------------------------
// Fliser
// ---------------------------------------------------------------------------

const lonTilX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * 256;
const latTilY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * 256;
};

function hentFlis(z: number, x: number, y: number): PNG {
  const fil = join(CACHE, String(z), String(x), `${y}.png`);
  if (!existsSync(fil)) {
    mkdirSync(dirname(fil), { recursive: true });
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    // curl, ikke fetch: curl stoler på proxyens CA i utviklingsmiljøet.
    execFileSync("curl", ["-sS", "-f", "-m", "60", "-o", fil, url]);
  }
  return PNG.sync.read(readFileSync(fil));
}

/** Høydegitteret for utsnittet, i meter, med snitt over kildepikslene i hver celle. */
function hoydegitter(u: Utsnitt) {
  const [vest, sor, ost, nord] = u.bbox;
  const z = u.zoom;
  const px0 = lonTilX(vest, z);
  const px1 = lonTilX(ost, z);
  const py0 = latTilY(nord, z);
  const py1 = latTilY(sor, z);
  const bredde = CELLER;
  const hoyde = Math.round((bredde * (py1 - py0)) / (px1 - px0));

  const fliser = new Map<string, PNG>();
  for (let tx = Math.floor(px0 / 256); tx <= Math.floor(px1 / 256); tx++) {
    for (let ty = Math.floor(py0 / 256); ty <= Math.floor(py1 / 256); ty++) {
      fliser.set(`${tx}/${ty}`, hentFlis(z, tx, ty));
    }
  }
  const hoydeI = (gx: number, gy: number) => {
    const tx = Math.floor(gx / 256);
    const ty = Math.floor(gy / 256);
    const flis = fliser.get(`${tx}/${ty}`);
    if (!flis) throw new Error(`Mangler flis ${tx}/${ty}`);
    const x = Math.min(255, Math.max(0, Math.floor(gx - tx * 256)));
    const y = Math.min(255, Math.max(0, Math.floor(gy - ty * 256)));
    const i = (y * 256 + x) * 4;
    const d = flis.data;
    return (d[i] ?? 0) * 256 + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) / 256 - 32768;
  };

  const sx = (px1 - px0) / bredde;
  const sy = (py1 - py0) / hoyde;
  const gitter = new Float64Array(bredde * hoyde);
  for (let j = 0; j < hoyde; j++) {
    for (let i = 0; i < bredde; i++) {
      let sum = 0;
      let n = 0;
      for (let a = 0; a < sy; a += 0.5) {
        for (let b = 0; b < sx; b += 0.5) {
          sum += hoydeI(px0 + i * sx + b, py0 + j * sy + a);
          n++;
        }
      }
      gitter[j * bredde + i] = sum / n;
    }
  }
  return { bredde, hoyde, gitter: glatt(glatt(gitter, bredde, hoyde), bredde, hoyde) };
}

/** Binomisk 3×3-glatting. To runder gir rolige koter uten å viske ut fjordene. */
function glatt(g: Float64Array, b: number, h: number): Float64Array {
  const ut = new Float64Array(g.length);
  const vekt = [1, 2, 1];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < b; i++) {
      let sum = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= b || jj >= h) continue;
          const w = (vekt[di + 1] ?? 0) * (vekt[dj + 1] ?? 0);
          sum += (g[jj * b + ii] ?? 0) * w;
          n += w;
        }
      }
      ut[j * b + i] = sum / n;
    }
  }
  return ut;
}

// ---------------------------------------------------------------------------
// Geometri
// ---------------------------------------------------------------------------

/** Ramer–Douglas–Peucker. Endepunktene beholdes alltid. */
function forenkle(p: Punkt[], eps: number): Punkt[] {
  if (p.length < 3) return p;
  const behold = new Uint8Array(p.length);
  behold[0] = 1;
  behold[p.length - 1] = 1;
  const stabel: [number, number][] = [[0, p.length - 1]];
  while (stabel.length) {
    const [a, b] = stabel.pop() as [number, number];
    const [ax, ay] = p[a] as Punkt;
    const [bx, by] = p[b] as Punkt;
    const dx = bx - ax;
    const dy = by - ay;
    const lengde = Math.hypot(dx, dy) || 1e-9;
    let maks = -1;
    let idx = -1;
    for (let k = a + 1; k < b; k++) {
      const [x, y] = p[k] as Punkt;
      const d = Math.abs(dy * x - dx * y + bx * ay - by * ax) / lengde;
      if (d > maks) {
        maks = d;
        idx = k;
      }
    }
    if (maks > eps && idx > 0) {
      behold[idx] = 1;
      stabel.push([a, idx], [idx, b]);
    }
  }
  return p.filter((_, k) => behold[k]);
}

/**
 * En lukket ring har samme start og slutt, og da har Douglas–Peucker ingen
 * linje å måle mot. Ringen deles i punktet lengst fra start og forenkles i to
 * halvdeler.
 */
function forenkleRing(p: Punkt[], eps: number): Punkt[] {
  if (p.length < 4) return p;
  const [x0, y0] = p[0] as Punkt;
  let lengst = 0;
  let m = 0;
  p.forEach(([x, y], k) => {
    const d = Math.hypot(x - x0, y - y0);
    if (d > lengst) {
      lengst = d;
      m = k;
    }
  });
  if (m === 0) return p;
  return [...forenkle(p.slice(0, m + 1), eps).slice(0, -1), ...forenkle(p.slice(m), eps)];
}

const lengde = (p: Punkt[]) =>
  p.reduce((sum, q, k) => (k ? sum + Math.hypot(q[0] - p[k - 1]![0], q[1] - p[k - 1]![1]) : 0), 0);

/**
 * Deler en lukket ring i åpne linjer uten stykkene som går langs kanten av
 * gitteret. d3-contour lukker polygonene langs kanten, og en kote som følger
 * kartrammen er ikke en kote.
 */
function utenKant(ring: Punkt[], b: number, h: number): { linje: Punkt[]; lukket: boolean }[] {
  const paaKant = ([x, y]: Punkt) => x <= 0 || y <= 0 || x >= b || y >= h;
  const n = ring.length - 1; // siste punkt er lik det første
  const kantstykke = (k: number) =>
    paaKant(ring[k] as Punkt) && paaKant(ring[(k + 1) % n] as Punkt);
  let start = -1;
  for (let k = 0; k < n; k++) {
    if (kantstykke(k)) {
      start = k;
      break;
    }
  }
  if (start < 0) return [{ linje: ring, lukket: true }];

  const ut: { linje: Punkt[]; lukket: boolean }[] = [];
  let naa: Punkt[] = [];
  for (let s = 1; s <= n; s++) {
    const k = (start + s) % n;
    if (kantstykke(k)) {
      if (naa.length) {
        naa.push(ring[k] as Punkt);
        ut.push({ linje: naa, lukket: false });
        naa = [];
      }
    } else {
      if (!naa.length) naa.push(ring[k] as Punkt);
      naa.push(ring[(k + 1) % n] as Punkt);
    }
  }
  if (naa.length) ut.push({ linje: naa, lukket: false });
  return ut;
}

/** Kompakt SVG-sti: første punkt absolutt, resten relativt, heltall. */
function sti(linjer: { linje: Punkt[]; lukket: boolean }[], skala: number): string {
  const tall = (v: number) => String(v);
  let d = "";
  for (const { linje, lukket } of linjer) {
    const q = linje.map(([x, y]) => [Math.round(x * skala), Math.round(y * skala)] as Punkt);
    const [x0, y0] = q[0] as Punkt;
    let del = `M${x0} ${y0}`;
    let [px, py] = [x0, y0];
    let forrige = "";
    for (const [x, y] of q.slice(1)) {
      const dx = x - px;
      const dy = y - py;
      if (dx === 0 && dy === 0) continue;
      // Minustegnet skiller tallene selv. Mellomrom trengs bare foran et positivt tall.
      const par = `${tall(dx)}${dy < 0 ? "" : " "}${tall(dy)}`;
      del += forrige === "" ? `l${par}` : `${dx < 0 ? "" : " "}${par}`;
      forrige = par;
      px = x;
      py = y;
    }
    if (lukket) del += "z";
    d += del;
  }
  return d;
}

function linjesett(ringer: Punkt[][], b: number, h: number, skala: number): Linjesett | null {
  const linjer = ringer
    .flatMap((r) => utenKant(r, b, h))
    .map(({ linje, lukket }) => ({
      linje: lukket ? forenkleRing(linje, FORENKLING) : forenkle(linje, FORENKLING),
      lukket,
    }))
    .filter(({ linje }) => linje.length >= 2 && lengde(linje) >= MIN_LINJE);
  if (!linjer.length) return null;
  const lengst = Math.max(...linjer.map(({ linje }) => lengde(linje) * skala));
  return { d: sti(linjer, skala), lengde: Math.ceil(lengst) };
}

// ---------------------------------------------------------------------------
// Kartbladet
// ---------------------------------------------------------------------------

function tegn(kommunenr: string, u: Utsnitt): Terreng {
  const { bredde: b, hoyde: h, gitter } = hoydegitter(u);
  const skala = BREDDE / b;
  const maks = gitter.reduce((m, v) => Math.max(m, v), -Infinity);

  // Havet: regn kotene på den negerte høyden, så polygonene blir sjøen selv og
  // lukkes langs kartrammen.
  const negert = Array.from(gitter, (v) => -v);
  const hav = contours().size([b, h]).thresholds([-KYST])(negert)[0];
  const havringer = (hav?.coordinates ?? []).flatMap((poly) => poly) as Punkt[][];
  const havsti = sti(
    havringer
      .map((r) => forenkleRing(r, FORENKLING))
      .filter((r) => r.length >= 4 && lengde(r) >= MIN_LINJE)
      .map((linje) => ({ linje, lukket: true })),
    skala,
  );
  const kyst = linjesett(havringer, b, h, skala);
  if (!kyst) throw new Error(`${u.navn}: fant ingen kystlinje i utsnittet`);

  const nivaaer: number[] = [];
  for (let n = EKVIDISTANSE; n < maks; n += EKVIDISTANSE) nivaaer.push(n);
  const verdier = Array.from(gitter);
  const koter = contours()
    .size([b, h])
    .thresholds(nivaaer)(verdier)
    .map((mp) => {
      const ringer = mp.coordinates.flatMap((poly) => poly) as Punkt[][];
      const sett = linjesett(ringer, b, h, skala);
      return sett ? { hoyde: mp.value, tellekurve: mp.value % TELLEKURVE === 0, ...sett } : null;
    })
    .filter((k): k is NonNullable<typeof k> => k !== null);

  return {
    kommunenr,
    navn: u.navn,
    bbox: u.bbox,
    zoom: u.zoom,
    bredde: BREDDE,
    hoyde: Math.round(h * skala),
    hav: havsti,
    kyst,
    ekvidistanse: EKVIDISTANSE,
    koter,
    kilde: KILDE,
    attribusjon: ATTRIBUSJON,
  };
}

function main() {
  const utsnitt = JSON.parse(readFileSync(join(MAPPE, "utsnitt.json"), "utf8")) as Record<
    string,
    Utsnitt
  >;
  const valgt = process.argv.slice(2);
  const nr = valgt.length ? valgt : Object.keys(utsnitt).sort();
  for (const kommunenr of nr) {
    const u = utsnitt[kommunenr];
    if (!u) throw new Error(`Kommunenr. ${kommunenr} står ikke i utsnitt.json`);
    const fil = tegn(kommunenr, u);
    const tekst = `${JSON.stringify(fil)}\n`;
    writeFileSync(join(MAPPE, `${kommunenr}.json`), tekst);
    console.log(
      `${kommunenr} ${u.navn}: ${fil.bredde}×${fil.hoyde}, ${fil.koter.length} koter, ` +
        `${(Buffer.byteLength(tekst) / 1024).toFixed(1)} kB`,
    );
  }
}

main();
