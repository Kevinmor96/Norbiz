// Oppsettet for nettverksgrafen (DESIGN.md §5.5): regnet, ikke plassert for hånd.
//
// Samme data gir alltid samme koordinater. Det er et krav av tre grunner:
// serveren og nettleseren må tegne likt (ellers feiler hydreringen), et delt
// skjermbilde må kunne gjenskapes, og en ny kommune skal få et ryddig kart uten
// at noen flytter noder. Derfor:
//
// - Startposisjonen til hver node kommer fra en hash av nøkkelen, ikke fra
//   rekkefølgen i lista og ikke fra Math.random.
// - d3-force kjører et fast antall steg med en seedet slumpkilde og fast
//   avkjøling. Avkjølingen settes som et tall, fordi d3 ellers regner den med
//   Math.pow, som ikke er likt rundet i alle JavaScript-motorer.
// - Koordinatene rundes til en tidel før de brukes.
//
// Etter simuleringen plasseres etikettene: først organnavnene rundt nodene,
// så navneskiltene langs kantene. Skiltene skyves langs sin egen kant til de
// ikke dekker et organnavn, en node, et annet skilt eller en annen kant.
// `finnKollisjoner` sjekker resultatet, og oppsettet prøver noen få faste
// varianter av avstandene til det finner et uten kollisjoner.
//
// Grafen må tåle mange hundre organer. Oppslagene går derfor gjennom et
// rutenett, så en etikett bare prøves mot det som står i nærheten, og store
// grafer prøver færre varianter. Finnes det ingen plass til et skilt, skjules
// det i stedet for å legges oppå noe. Siden viser et skjult skilt når leseren
// peker på personen eller flytter fokus dit, og lista har alt.
//
// Alle mål er i piksler på et lerret med fast størrelse. Siden viser lerretet
// minst så bredt, og skalerer bare opp. Etikettene har fast pikselstørrelse og
// står fast i forhold til noden sin, så en etikett som ikke kolliderer på
// lerretet, kolliderer heller ikke når grafen blir større.

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

// ---------------------------------------------------------------------------
// Tekstbredde uten DOM
// ---------------------------------------------------------------------------

/**
 * Bredden på tegnene i Archivo, vekt 600 og bredde 87 %, i em. Målt i
 * nettleseren med den selvhostede fonten. Serveren har ingen DOM å måle i,
 * og oppsettet må bli likt på serveren og i nettleseren.
 */
const TEGNBREDDER: [number, string][] = [
  [0.17, " "],
  [0.22, "'"],
  [0.23, "ijl"],
  [0.26, "I"],
  [0.27, "f.,"],
  [0.29, "t/"],
  [0.3, "-:"],
  [0.32, "r"],
  [0.35, "()"],
  [0.44, "–"],
  [0.46, "yz"],
  [0.47, "v"],
  [0.48, "s"],
  [0.49, "ckx"],
  [0.5, "aåä"],
  [0.51, "eLéè"],
  [0.52, "0123456789ghnuJ«»ü"],
  [0.53, "bdopqøFö"],
  [0.56, "T"],
  [0.57, "Z"],
  [0.59, "ES"],
  [0.6, "PV"],
  [0.61, "XY"],
  [0.62, "B"],
  [0.63, "AKÅ"],
  [0.64, "CRU"],
  [0.65, "DHN&"],
  [0.68, "w"],
  [0.7, "GOQØ"],
  [0.77, "m"],
  [0.78, "M"],
  [0.8, "æ"],
  [0.86, "W%"],
  [0.89, "Æ"],
];
const BREDDE = new Map<string, number>();
for (const [b, tegn] of TEGNBREDDER) for (const t of tegn) BREDDE.set(t, b);

/**
 * Anslått bredde i piksler for en etikett i grafens skrift (Archivo 87 %,
 * vekt 560–620). Anslaget legger på 4 %, så det heller bommer på den trygge
 * siden.
 */
export function tekstbredde(tekst: string, px: number): number {
  let em = 0;
  for (const t of tekst) em += BREDDE.get(t) ?? 0.56;
  return Math.ceil(em * px * 1.04);
}

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

export interface Storrelse {
  bredde: number;
  hoyde: number;
}

/** Et rektangel: øvre venstre hjørne og størrelse. */
export interface Boks {
  x: number;
  y: number;
  b: number;
  h: number;
}

export interface NodeInn {
  key: string;
  /** Organnavnet ved noden. */
  etikett: Storrelse;
}

export interface KantInn {
  id: string;
  fra: string;
  til: string;
  /** `person`: en person med rolle i begge organer. `eier`: en eierandel. */
  lag: "person" | "eier";
  /** Skiltet langs kanten (personnavn eller eierandel), eller `null`. */
  skilt: Storrelse | null;
}

/**
 * En person med roller i tre eller flere organer, tegnet som én kant med
 * flere ender: navneskiltet i midten og en eike til hvert organ. Tre like
 * skilt i en trekant sier det samme tre ganger og skjuler resten.
 */
export interface KnuteInn {
  id: string;
  organer: string[];
  skilt: Storrelse;
}

export interface GrafInn {
  noder: NodeInn[];
  kanter: KantInn[];
  knuter?: KnuteInn[];
}

/** Hvor etiketten står i forhold til noden. */
export type Side = "h" | "v" | "u" | "o" | "ho" | "vo" | "hu" | "vu";

export interface NodeUt {
  key: string;
  x: number;
  y: number;
  /** `skjult`: fant ingen ledig plass. Vises bare ved pek og fokus. */
  etikett: { boks: Boks; side: Side; skjult: boolean };
}

export interface Skilt {
  x: number;
  y: number;
  boks: Boks;
  /** Fant ingen ledig plass. Vises bare ved pek og fokus. */
  skjult: boolean;
}

export interface KantUt {
  id: string;
  fra: string;
  til: string;
  lag: "person" | "eier";
  /** Hvor langt kanten bøyes ut fra den rette linja, i piksler. 0 er rett. */
  bue: number;
  /** SVG-sti fra senter til senter. */
  sti: string;
  /** Kanten som brutt linje, til kollisjonssjekken. */
  punkter: [number, number][];
  /** Skiltet, eller `null` når kanten ikke har skilt. */
  skilt: Skilt | null;
  /** Satt for eikene i en knute: knutens id. Eiken går fra skiltet til organet `til`. */
  knute?: string;
}

export interface KnuteUt {
  id: string;
  x: number;
  y: number;
  boks: Boks;
  skjult: boolean;
}

export interface Kollisjon {
  hva: string;
  a: string;
  b: string;
}

export interface GrafUt {
  bredde: number;
  hoyde: number;
  noder: NodeUt[];
  kanter: KantUt[];
  knuter: KnuteUt[];
  /** Kollisjoner mellom det som vises. Tom når oppsettet er rent. */
  kollisjoner: Kollisjon[];
  /** Etiketter og skilt som ble skjult fordi de ikke fikk plass. */
  skjulte: number;
}

export interface Lerret {
  bredde: number;
  /** Minstehøyden. Oppsettet gjør lerretet høyere når grafen trenger det. */
  hoyde: number;
}

/** Nodens radius i piksler, og luften mellom node og etikett. */
export const NODE_RADIUS = 6;
const LUFT = 6;
/** Minste avstand mellom to ting som ikke skal røre hverandre. */
const KLARING = 3;

// ---------------------------------------------------------------------------
// Deterministisk slump
// ---------------------------------------------------------------------------

/** FNV-1a, 32 bit. Samme streng gir samme tall i alle motorer. */
function hash(tekst: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Et tall i [0, 1) fra en streng. */
const enhet = (tekst: string) => hash(tekst) / 4294967296;

/** Seedet LCG til d3-force (brukes bare når to noder står i samme punkt). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rund = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Geometri
// ---------------------------------------------------------------------------

function overlapp(a: Boks, b: Boks, luft = KLARING): boolean {
  return (
    a.x < b.x + b.b + luft && b.x < a.x + a.b + luft && a.y < b.y + b.h + luft && b.y < a.y + a.h + luft
  );
}

function sirkelIBoks(cx: number, cy: number, r: number, b: Boks): boolean {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.b));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/** Krysser linjestykket boksen? Liang–Barsky. */
function stykkeIBoks(x1: number, y1: number, x2: number, y2: number, b: Boks): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - b.x, b.x + b.b - x1, y1 - b.y, b.y + b.h - y1];
  for (let i = 0; i < 4; i++) {
    const pi = p[i] ?? 0;
    const qi = q[i] ?? 0;
    if (pi === 0) {
      if (qi < 0) return false;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

function linjeIBoks(punkter: [number, number][], b: Boks): boolean {
  for (let i = 1; i < punkter.length; i++) {
    const [x1, y1] = punkter[i - 1] ?? [0, 0];
    const [x2, y2] = punkter[i] ?? [0, 0];
    if (stykkeIBoks(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

function avstandTilLinje(px: number, py: number, punkter: [number, number][]): number {
  let min = Infinity;
  for (let i = 1; i < punkter.length; i++) {
    const [x1, y1] = punkter[i - 1] ?? [0, 0];
    const [x2, y2] = punkter[i] ?? [0, 0];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = dx * dx + dy * dy;
    const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
    const ex = x1 + t * dx - px;
    const ey = y1 + t * dy - py;
    min = Math.min(min, Math.sqrt(ex * ex + ey * ey));
  }
  return min;
}

function utenfor(b: Boks, l: Lerret): boolean {
  return b.x < 0 || b.y < 0 || b.x + b.b > l.bredde || b.y + b.h > l.hoyde;
}

/** Punkt på en kvadratisk bézier. */
function bezier(
  p0: [number, number],
  k: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * k[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * k[1] + t * t * p2[1],
  ];
}

/**
 * Kontrollpunktet for en kant med gitt bue. Normalen regnes fra den noden
 * som har lavest nøkkel, så to parallelle kanter med motsatt fortegn alltid
 * bøyes til hver sin side, uansett hvilken vei kanten er lagret.
 */
function kontroll(
  a: { key: string; x: number; y: number },
  b: { key: string; x: number; y: number },
  bue: number,
): [number, number] {
  const [p, q] = a.key < b.key ? [a, b] : [b, a];
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  // Kurvens midtpunkt ligger halvveis mellom linja og kontrollpunktet.
  return [(p.x + q.x) / 2 + nx * bue * 2, (p.y + q.y) / 2 + ny * bue * 2];
}

const PROVER = 16;

function kurve(
  a: { key: string; x: number; y: number },
  b: { key: string; x: number; y: number },
  bue: number,
) {
  const k = kontroll(a, b, bue);
  // En rett kant er ett linjestykke. En bue prøves i 16 punkter.
  const punkter: [number, number][] = [];
  if (bue === 0) {
    punkter.push([a.x, a.y], [b.x, b.y]);
  } else {
    for (let i = 0; i <= PROVER; i++) punkter.push(bezier([a.x, a.y], k, [b.x, b.y], i / PROVER));
  }
  const sti =
    bue === 0
      ? `M${rund(a.x)} ${rund(a.y)}L${rund(b.x)} ${rund(b.y)}`
      : `M${rund(a.x)} ${rund(a.y)}Q${rund(k[0])} ${rund(k[1])} ${rund(b.x)} ${rund(b.y)}`;
  return { k, punkter, sti };
}

// ---------------------------------------------------------------------------
// Rutenett: oppslag i nærheten, så store grafer holder seg raske
// ---------------------------------------------------------------------------

const CELLE = 64;

/** Et enkelt romlig indeks: hver id legges i cellene boksen dens dekker. */
class Rutenett {
  private celler = new Map<number, Set<string>>();
  private plass = new Map<string, number[]>();

  private nokler(b: Boks): number[] {
    const x0 = Math.floor(b.x / CELLE);
    const x1 = Math.floor((b.x + b.b) / CELLE);
    const y0 = Math.floor(b.y / CELLE);
    const y1 = Math.floor((b.y + b.h) / CELLE);
    const ut: number[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ut.push((x + 2048) * 8192 + (y + 2048));
    return ut;
  }

  legg(id: string, b: Boks): void {
    const ns = this.nokler(b);
    const har = this.plass.get(id);
    if (har) har.push(...ns);
    else this.plass.set(id, ns);
    for (const n of ns) {
      let c = this.celler.get(n);
      if (!c) this.celler.set(n, (c = new Set()));
      c.add(id);
    }
  }

  fjern(id: string): void {
    for (const n of this.plass.get(id) ?? []) this.celler.get(n)?.delete(id);
    this.plass.delete(id);
  }

  private stempel = new Map<string, number>();
  private runde = 0;

  /** Idene i cellene boksen dekker, hver én gang. */
  finn(b: Boks): string[] {
    this.runde += 1;
    const ut: string[] = [];
    const x0 = Math.floor(b.x / CELLE);
    const x1 = Math.floor((b.x + b.b) / CELLE);
    const y0 = Math.floor(b.y / CELLE);
    const y1 = Math.floor((b.y + b.h) / CELLE);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const c = this.celler.get((x + 2048) * 8192 + (y + 2048));
        if (!c) continue;
        for (const id of c) {
          if (this.stempel.get(id) === this.runde) continue;
          this.stempel.set(id, this.runde);
          ut.push(id);
        }
      }
    }
    return ut;
  }
}

/**
 * Legger en kant i rutenettet. Lange linjestykker deles i biter på én celle,
 * så en lang skrå kant ikke fyller alle cellene i sitt eget rektangel.
 */
function leggKant(g: Rutenett, id: string, punkter: [number, number][]): void {
  for (let i = 1; i < punkter.length; i++) {
    const [x1, y1] = punkter[i - 1] ?? [0, 0];
    const [x2, y2] = punkter[i] ?? [0, 0];
    const biter = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / CELLE));
    for (let j = 0; j < biter; j++) {
      const ax = x1 + ((x2 - x1) * j) / biter;
      const ay = y1 + ((y2 - y1) * j) / biter;
      const bx = x1 + ((x2 - x1) * (j + 1)) / biter;
      const by = y1 + ((y2 - y1) * (j + 1)) / biter;
      g.legg(id, { x: Math.min(ax, bx) - 1, y: Math.min(ay, by) - 1, b: Math.abs(bx - ax) + 2, h: Math.abs(by - ay) + 2 });
    }
  }
}

const utvid = (b: Boks, d: number): Boks => ({ x: b.x - d, y: b.y - d, b: b.b + 2 * d, h: b.h + 2 * d });

// ---------------------------------------------------------------------------
// Etikettplassering
// ---------------------------------------------------------------------------

/** Kandidatene rundt en node, i foretrukket rekkefølge: til høyre først, som på kart. */
const SIDER: Side[] = ["h", "v", "u", "o", "ho", "vo", "hu", "vu"];

function etikettBoks(x: number, y: number, s: Storrelse, side: Side, ekstra = 0): Boks {
  const d = NODE_RADIUS + LUFT + ekstra;
  const skraa = NODE_RADIUS + 2 + ekstra * 0.7;
  switch (side) {
    case "h":
      return { x: x + d, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde };
    case "v":
      return { x: x - d - s.bredde, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde };
    case "u":
      return { x: x - s.bredde / 2, y: y + d, b: s.bredde, h: s.hoyde };
    case "o":
      return { x: x - s.bredde / 2, y: y - d - s.hoyde, b: s.bredde, h: s.hoyde };
    case "ho":
      return { x: x + skraa, y: y - skraa - s.hoyde, b: s.bredde, h: s.hoyde };
    case "vo":
      return { x: x - skraa - s.bredde, y: y - skraa - s.hoyde, b: s.bredde, h: s.hoyde };
    case "hu":
      return { x: x + skraa, y: y + skraa, b: s.bredde, h: s.hoyde };
    case "vu":
      return { x: x - skraa - s.bredde, y: y + skraa, b: s.bredde, h: s.hoyde };
  }
}

/** Først tett inntil noden på alle sider, så litt lenger ut. */
const KANDIDATER = [0, 14, 30].flatMap((ekstra) => SIDER.map((side) => ({ side, ekstra })));

/**
 * Kandidatene for skiltet langs en kant, fra midten og utover. Ved en node med
 * mange kanter møtes kantene, så skiltet foretrekker den andre enden.
 */
function skiltT(gradFra: number, gradTil: number): number[] {
  const ut = [0.5];
  const steg = [0.06, 0.12, 0.18, 0.24, 0.3, 0.36];
  if (gradFra === gradTil) {
    for (const d of steg) ut.push(0.5 - d, 0.5 + d);
    return ut.map((t) => Math.round(t * 100) / 100);
  }
  const motTil = gradFra > gradTil;
  for (const d of steg) ut.push(motTil ? 0.5 + d : 0.5 - d);
  for (const d of steg) ut.push(motTil ? 0.5 - d : 0.5 + d);
  return ut.map((t) => Math.round(t * 100) / 100);
}

// ---------------------------------------------------------------------------
// Simuleringen
// ---------------------------------------------------------------------------

interface SimNode extends SimulationNodeDatum {
  key: string;
  r: number;
}

interface Variant {
  avstand: number;
  frastoting: number;
  /** Salt i hashen for startposisjonene. Samme salt gir samme start. */
  salt: string;
}

const PARAMETRE = [
  { avstand: 150, frastoting: -900 },
  { avstand: 175, frastoting: -1100 },
  { avstand: 135, frastoting: -800 },
  { avstand: 200, frastoting: -1300 },
  { avstand: 165, frastoting: -1500 },
  { avstand: 220, frastoting: -1700 },
];

/**
 * Variantene som prøves i rekkefølge. Den første uten kollisjoner vinner.
 * Først avstandene med startposisjonene fra nøkkelen alene, så de samme
 * avstandene fra to andre, like faste startoppsett.
 */
const VARIANTER: Variant[] = ["", "b", "c"].flatMap((salt) => PARAMETRE.map((p) => ({ ...p, salt })));

/** Store grafer prøver færre varianter og færre steg, så de holder seg under 200 ms. */
function budsjett(antall: number): { varianter: number; steg: number } {
  if (antall <= 60) return { varianter: VARIANTER.length, steg: 320 };
  if (antall <= 150) return { varianter: 4, steg: 220 };
  return { varianter: 1, steg: 50 };
}

const knuteNokkel = (id: string) => `knute:${id}`;

/**
 * Kjører simuleringen i naturlig størrelse: avstandene er piksler, så et skilt
 * på 150 px får en kant som er lang nok. Høyden på lerretet følger av
 * resultatet. Bredden er fast, og grafen krympes bare hvis den ikke får plass.
 */
function simuler(
  inn: GrafInn,
  lerret: Lerret,
  v: Variant,
  steg: number,
): { pos: Map<string, { x: number; y: number }>; hoyde: number } {
  const bredde = lerret.bredde;
  const knuter = [...(inn.knuter ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
  // Mange noder får et høyere lerret å starte på, så de ikke presses flatt.
  const antall = inn.noder.length + knuter.length;
  const midtY = bredde * 0.3 * Math.max(1, Math.sqrt(antall / 24));

  // Nodens plassbehov: organnavnet og det bredeste skiltet på kantene dens.
  const bredesteSkilt = new Map<string, number>();
  for (const k of inn.kanter) {
    const b = k.skilt?.bredde ?? 0;
    bredesteSkilt.set(k.fra, Math.max(bredesteSkilt.get(k.fra) ?? 0, b));
    bredesteSkilt.set(k.til, Math.max(bredesteSkilt.get(k.til) ?? 0, b));
  }
  const start = (key: string) => ({
    // Startposisjonen er en funksjon av nøkkelen alene.
    x: bredde * (0.15 + 0.7 * enhet(`${key}:x${v.salt}`)),
    y: midtY * 2 * (0.15 + 0.7 * enhet(`${key}:y${v.salt}`)),
  });
  const noder: SimNode[] = [
    ...[...inn.noder]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((n) => ({
        key: n.key,
        ...start(n.key),
        r: Math.max(16 + n.etikett.bredde * 0.32, (bredesteSkilt.get(n.key) ?? 0) * 0.45),
      })),
    ...knuter.map((k) => ({
      key: knuteNokkel(k.id),
      ...start(knuteNokkel(k.id)),
      r: k.skilt.bredde * 0.5 + 10,
    })),
  ];
  const finnes = new Set(noder.map((n) => n.key));

  // Én fjær per organpar. Flere personer mellom samme par trekker hardere.
  // Fjæra er minst så lang som det bredeste skiltet på kanten, så navnet får
  // plass mellom organene.
  type Lenke = SimulationLinkDatum<SimNode> & { lengde: number; styrke: number };
  const par = new Map<string, { source: string; target: string; person: number; eier: number; skilt: number }>();
  for (const k of [...inn.kanter].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!finnes.has(k.fra) || !finnes.has(k.til) || k.fra === k.til) continue;
    const [s, t] = k.fra < k.til ? [k.fra, k.til] : [k.til, k.fra];
    const n = `${s}|${t}`;
    const p = par.get(n) ?? { source: s, target: t, person: 0, eier: 0, skilt: 0 };
    if (k.lag === "person") p.person += 1;
    else p.eier += 1;
    p.skilt = Math.max(p.skilt, k.skilt?.bredde ?? 0);
    par.set(n, p);
  }
  const lenker: Lenke[] = [...par.values()].map((p) => ({
    source: p.source,
    target: p.target,
    lengde: Math.max(p.person > 0 ? v.avstand : v.avstand * 1.15, p.skilt + 2 * NODE_RADIUS + 48),
    styrke: p.person > 0 ? Math.min(1, 0.55 + 0.15 * p.person) : 0.22,
  }));
  // Knutens eiker: skiltet i midten, organene rundt.
  for (const k of knuter) {
    for (const o of [...k.organer].sort()) {
      if (!finnes.has(o)) continue;
      lenker.push({
        source: knuteNokkel(k.id),
        target: o,
        lengde: Math.max(v.avstand * 0.62, k.skilt.bredde / 2 + NODE_RADIUS + 44),
        styrke: 0.8,
      });
    }
  }

  const sim = forceSimulation<SimNode>(noder)
    .randomSource(lcg(hash(noder.map((n) => n.key).join(","))))
    // Avkjølingen er tilpasset antall steg, så simuleringen alltid når ro.
    .alphaDecay(steg >= 300 ? 0.0205 : steg >= 200 ? 0.03 : 0.11)
    .velocityDecay(0.42)
    .force(
      "lenke",
      forceLink<SimNode, Lenke>(lenker)
        .id((d) => d.key)
        .distance((l) => l.lengde)
        .strength((l) => l.styrke),
    )
    .force("frastoting", forceManyBody<SimNode>().strength(v.frastoting).distanceMax(700).theta(0.9))
    .force("x", forceX<SimNode>(bredde / 2).strength(0.04))
    .force("y", forceY<SimNode>(midtY).strength(0.085))
    // Kollisjonskraften er den dyreste. Store grafer klarer seg med frastøtingen.
    .force("kollisjon", steg >= 200 ? forceCollide<SimNode>((d) => d.r).strength(0.9) : null)
    .stop();
  for (let i = 0; i < steg; i++) sim.tick();

  // Sentrer, med luft til etikettene langs kanten av lerretet. Grafen krympes
  // bare når den er bredere enn lerretet, og blåses aldri opp.
  const lx = 104;
  const ly = 52;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of noder) {
    minX = Math.min(minX, n.x ?? 0);
    maxX = Math.max(maxX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
    maxY = Math.max(maxY, n.y ?? 0);
  }
  const s = Math.min(1, (bredde - 2 * lx) / Math.max(1, maxX - minX));
  const hoyde = Math.round(Math.max(lerret.hoyde, (maxY - minY) * s + 2 * ly));
  const ox = (bredde - (maxX - minX) * s) / 2;
  const oy = (hoyde - (maxY - minY) * s) / 2;
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of noder) {
    pos.set(n.key, { x: rund(ox + ((n.x ?? 0) - minX) * s), y: rund(oy + ((n.y ?? 0) - minY) * s) });
  }
  return { pos, hoyde };
}

// ---------------------------------------------------------------------------
// Kanter, etiketter og skilt
// ---------------------------------------------------------------------------

const parNokkel = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function sett(inn: GrafInn, lerret: Lerret, pos: Map<string, { x: number; y: number }>): GrafUt {
  const noder = [...inn.noder].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const punkter0 = new Map<string, { key: string; x: number; y: number }>();
  const punkt = (key: string) => {
    let p = punkter0.get(key);
    if (!p) punkter0.set(key, (p = { key, ...(pos.get(key) ?? { x: 0, y: 0 }) }));
    return p;
  };
  const skiltFor = new Map(inn.kanter.map((k) => [k.id, k.skilt]));
  const stor = noder.length > 150;

  // Nodene i rutenettet, som små bokser.
  const nodeNett = new Rutenett();
  for (const n of noder) {
    const p = punkt(n.key);
    nodeNett.legg(n.key, { x: p.x - NODE_RADIUS, y: p.y - NODE_RADIUS, b: 2 * NODE_RADIUS, h: 2 * NODE_RADIUS });
  }
  const noderNaer = (b: Boks, r: number) => nodeNett.finn(utvid(b, r));

  // 1. Kantene. Parallelle kanter legges så langt fra hverandre at naboens
  //    skilt ikke krysses. En enkel kant bøyes bare når den ellers går
  //    gjennom en node den ikke hører til.
  const grupper = new Map<string, KantInn[]>();
  for (const k of inn.kanter) {
    if (!pos.has(k.fra) || !pos.has(k.til)) continue;
    const n = parNokkel(k.fra, k.til);
    const g = grupper.get(n);
    if (g) g.push(k);
    else grupper.set(n, [k]);
  }
  const kanter: KantUt[] = [];
  const gjennomNode = (k: { fra: string; til: string }, punkter: [number, number][]) => {
    let n = 0;
    for (let i = 1; i < punkter.length; i++) {
      const [x1, y1] = punkter[i - 1] ?? [0, 0];
      const [x2, y2] = punkter[i] ?? [0, 0];
      const b = { x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      for (const key of noderNaer(b, NODE_RADIUS + 10)) {
        if (key === k.fra || key === k.til) continue;
        const r = punkt(key);
        if (avstandTilLinje(r.x, r.y, [[x1, y1], [x2, y2]]) < NODE_RADIUS + 10) n += 1;
      }
    }
    return n;
  };
  for (const [, gruppe] of [...grupper.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const forste = gruppe[0];
    if (!forste) continue;
    const [pk, qk] = forste.fra < forste.til ? [forste.fra, forste.til] : [forste.til, forste.fra];
    const p = punkt(pk);
    const q = punkt(qk);
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const nx = -(q.y - p.y) / l;
    const ny = (q.x - p.x) / l;
    // Hvor langt skiltet stikker ut på tvers av kanten.
    const tvers = (k: KantInn) => {
      const s = skiltFor.get(k.id);
      return s ? (Math.abs(nx) * s.bredde) / 2 + (Math.abs(ny) * s.hoyde) / 2 : 2;
    };
    // Eierkanten i midten, personkantene fordelt på begge sider.
    const personer = gruppe.filter((k) => k.lag === "person").sort((a, b) => (a.id < b.id ? -1 : 1));
    const eiere = gruppe.filter((k) => k.lag === "eier").sort((a, b) => (a.id < b.id ? -1 : 1));
    const halv = Math.ceil(personer.length / 2);
    const ordnet = [...personer.slice(0, halv), ...eiere, ...personer.slice(halv)];
    const buer: number[] = [0];
    for (let i = 1; i < ordnet.length; i++) {
      const a = ordnet[i - 1];
      const b = ordnet[i];
      buer.push((buer[i - 1] ?? 0) + (a && b ? Math.max(tvers(a), tvers(b)) + 12 : 30));
    }
    const midt = ((buer[0] ?? 0) + (buer[buer.length - 1] ?? 0)) / 2;
    ordnet.forEach((k, i) => {
      const a = punkt(k.fra);
      const b = punkt(k.til);
      let bue = rund((buer[i] ?? 0) - midt);
      let kv = kurve(a, b, bue);
      // Store grafer bøyer ikke kanter rundt noder. Tidsbudsjettet går til etikettene.
      if (ordnet.length === 1 && stor === false) {
        let best = gjennomNode(k, kv.punkter);
        for (const v of [28, -28, 56, -56]) {
          if (best === 0) break;
          const prove = kurve(a, b, v);
          const t = gjennomNode(k, prove.punkter);
          if (t < best) {
            best = t;
            bue = v;
            kv = prove;
          }
        }
      }
      kanter.push({ id: k.id, fra: k.fra, til: k.til, lag: k.lag, bue, sti: kv.sti, punkter: kv.punkter, skilt: null });
    });
  }

  // Knutene: skiltet står der simuleringen la knuten, og eikene går rett ut.
  const knuter: KnuteUt[] = [];
  for (const k of [...(inn.knuter ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const c = pos.get(knuteNokkel(k.id));
    if (!c) continue;
    knuter.push({
      id: k.id,
      x: c.x,
      y: c.y,
      boks: { x: c.x - k.skilt.bredde / 2, y: c.y - k.skilt.hoyde / 2, b: k.skilt.bredde, h: k.skilt.hoyde },
      skjult: false,
    });
    for (const o of [...k.organer].sort()) {
      if (!pos.has(o)) continue;
      const m = punkt(o);
      kanter.push({
        id: `${k.id}>${o}`,
        fra: knuteNokkel(k.id),
        til: o,
        lag: "person",
        bue: 0,
        sti: `M${rund(c.x)} ${rund(c.y)}L${rund(m.x)} ${rund(m.y)}`,
        punkter: [
          [c.x, c.y],
          [m.x, m.y],
        ],
        skilt: null,
        knute: k.id,
      });
    }
  }
  const kantEtterId = new Map(kanter.map((k) => [k.id, k]));

  // Kantene i rutenettet, så en etikett bare prøves mot kantene i nærheten.
  const kantNett = new Rutenett();
  for (const k of kanter) leggKant(kantNett, k.id, k.punkter);
  const kanterIBoks = (b: Boks, unntatt?: (k: KantUt) => boolean) => {
    let n = 0;
    for (const id of kantNett.finn(b)) {
      const k = kantEtterId.get(id);
      if (!k || unntatt?.(k)) continue;
      if (linjeIBoks(k.punkter, b)) n += 1;
    }
    return n;
  };

  // Alt som er plassert: organnavn, skilt og knuteskilt.
  const etikettNett = new Rutenett();
  const bokser = new Map<string, Boks>();
  const leggEtikett = (id: string, b: Boks) => {
    etikettNett.legg(id, b);
    bokser.set(id, b);
  };
  const fjernEtikett = (id: string) => {
    etikettNett.fjern(id);
    bokser.delete(id);
  };
  const etiketterOver = (b: Boks, unntatt: string) => {
    let n = 0;
    for (const id of etikettNett.finn(utvid(b, KLARING))) {
      if (id === unntatt) continue;
      const e = bokser.get(id);
      if (e && overlapp(b, e)) n += 1;
    }
    return n;
  };
  const noderUnder = (b: Boks, unntatt: string) => {
    let n = 0;
    for (const key of noderNaer(b, NODE_RADIUS + KLARING)) {
      if (key === unntatt) continue;
      const q = punkt(key);
      if (sirkelIBoks(q.x, q.y, NODE_RADIUS + KLARING, b)) n += 1;
    }
    return n;
  };
  for (const k of knuter) {
    // I en stor graf får et knuteskilt bare plass når det ikke dekker et annet.
    if (stor && (etiketterOver(k.boks, "") > 0 || noderUnder(k.boks, "") > 0)) k.skjult = true;
    else leggEtikett(`knute:${k.id}`, k.boks);
  }

  // 2. Organnavnene. Noder med flest kanter velger først, fordi de har færrest
  //    ledige sider.
  const grad = new Map<string, number>();
  for (const k of kanter) {
    grad.set(k.fra, (grad.get(k.fra) ?? 0) + 1);
    grad.set(k.til, (grad.get(k.til) ?? 0) + 1);
  }
  const rekkefolge = [...noder].sort(
    (a, b) => (grad.get(b.key) ?? 0) - (grad.get(a.key) ?? 0) || (a.key < b.key ? -1 : 1),
  );
  const plassert = new Map<string, { boks: Boks; side: Side; skjult: boolean }>();
  // En stor graf prøver bare sidene tett inntil noden og ser bort fra kantene:
  // i et tett nett krysser en kant nesten alltid, og navnet står på papir
  // over streken. Et navn som ville dekket et annet, skjules.
  const kandidater = stor ? KANDIDATER.slice(0, 4) : KANDIDATER;
  for (const n of rekkefolge) {
    const p = punkt(n.key);
    let best: { boks: Boks; side: Side; poeng: number } | null = null;
    for (const [i, { side, ekstra }] of kandidater.entries()) {
      const boks = etikettBoks(p.x, p.y, n.etikett, side, ekstra);
      let poeng = i * 0.1;
      if (utenfor(boks, lerret)) poeng += 100;
      if (!stor) poeng += 100 * kanterIBoks(boks);
      poeng += 100 * etiketterOver(boks, "");
      poeng += 100 * noderUnder(boks, n.key);
      if (!best || poeng < best.poeng) best = { boks, side, poeng };
      if (poeng < 1) break;
    }
    if (best) {
      const skjult = stor && best.poeng >= 100;
      plassert.set(n.key, { boks: best.boks, side: best.side, skjult });
      if (!skjult) leggEtikett(`organ:${n.key}`, best.boks);
    }
  }

  // 3. Skiltene langs kantene. Korte kanter velger først, de har minst å gå på.
  const lengde = (k: KantUt) => {
    const a = punkt(k.fra);
    const b = punkt(k.til);
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const plasserSkilt = (k: KantUt, punkter: [number, number][], bue: number) => {
    const s = skiltFor.get(k.id);
    if (!s) return null;
    const a = punkt(k.fra);
    const b = punkt(k.til);
    const kp = kontroll(a, b, bue);
    let best: { skilt: Skilt; poeng: number } | null = null;
    const ts = skiltT(grad.get(k.fra) ?? 0, grad.get(k.til) ?? 0);
    for (const [i, t] of (stor ? ts.slice(0, 3) : ts).entries()) {
      const [x, y] =
        bue === 0 ? [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t] : bezier([a.x, a.y], kp, [b.x, b.y], t);
      const boks = { x: x - s.bredde / 2, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde };
      let poeng = i * 0.1;
      if (utenfor(boks, lerret)) poeng += 100;
      poeng += 100 * etiketterOver(boks, `skilt:${k.id}`);
      poeng += 100 * noderUnder(boks, "");
      poeng += 10 * kanterIBoks(boks, (m) => m.id === k.id);
      if (!best || poeng < best.poeng) best = { skilt: { x: rund(x), y: rund(y), boks, skjult: false }, poeng };
      if (poeng < 1) break;
    }
    void punkter;
    return best;
  };
  const skiltRekke = kanter
    .filter((k) => skiltFor.get(k.id))
    .sort((a, b) => lengde(a) - lengde(b) || (a.id < b.id ? -1 : 1));
  for (const k of skiltRekke) {
    if (stor) {
      // En stor graf viser ikke navneskiltene før leseren peker på en person.
      const s = skiltFor.get(k.id);
      const a = punkt(k.fra);
      const b = punkt(k.til);
      const [x, y] = k.bue === 0 ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : bezier([a.x, a.y], kontroll(a, b, k.bue), [b.x, b.y], 0.5);
      if (s) k.skilt = { x: rund(x), y: rund(y), boks: { x: x - s.bredde / 2, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde }, skjult: true };
      continue;
    }
    const best = plasserSkilt(k, k.punkter, k.bue);
    if (best) {
      k.skilt = best.skilt;
      leggEtikett(`skilt:${k.id}`, best.skilt.boks);
    }
  }

  // 4. Reparasjon: en enkel kant som krysser en etikett eller et skilt, bøyes
  //    unna, og skiltet dens flyttes med. Etikettene står fast.
  const parStorrelse = new Map<string, number>();
  for (const k of kanter) {
    if (k.knute) continue;
    const n = parNokkel(k.fra, k.til);
    parStorrelse.set(n, (parStorrelse.get(n) ?? 0) + 1);
  }
  const kantKost = (k: KantUt, punkter: [number, number][], skilt: Skilt | null) => {
    let c = 0;
    for (let i = 1; i < punkter.length; i++) {
      const [x1, y1] = punkter[i - 1] ?? [0, 0];
      const [x2, y2] = punkter[i] ?? [0, 0];
      const b = { x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      for (const id of etikettNett.finn(b)) {
        if (id === `skilt:${k.id}`) continue;
        const e = bokser.get(id);
        if (e && stykkeIBoks(x1, y1, x2, y2, e)) c += 1;
      }
    }
    c += gjennomNode(k, punkter);
    if (skilt) {
      if (utenfor(skilt.boks, lerret)) c += 1;
      c += etiketterOver(skilt.boks, `skilt:${k.id}`);
      c += noderUnder(skilt.boks, "");
      c += kanterIBoks(skilt.boks, (m) => m.id === k.id);
    }
    return c;
  };
  // Store grafer repareres mindre, så tidsbudsjettet holder.
  const runder = noder.length <= 60 ? 2 : noder.length <= 150 ? 1 : 0;
  for (let runde = 0; runde < runder; runde++) {
    for (const k of kanter) {
      if (k.knute) continue;
      if ((parStorrelse.get(parNokkel(k.fra, k.til)) ?? 0) > 1) continue;
      const naa = kantKost(k, k.punkter, k.skilt);
      if (naa === 0) continue;
      const a = punkt(k.fra);
      const b = punkt(k.til);
      // Skiltet tas ut mens nye plasser prøves, så det ikke kolliderer med seg selv.
      if (k.skilt) fjernEtikett(`skilt:${k.id}`);
      kantNett.fjern(k.id);
      let best: { bue: number; c: number; skilt: Skilt | null; punkter: [number, number][]; sti: string } | null =
        null;
      for (const bue of [k.bue + 20, k.bue - 20, k.bue + 40, k.bue - 40, k.bue + 64, k.bue - 64]) {
        const kv = kurve(a, b, bue);
        const s = skiltFor.get(k.id) ? plasserSkilt(k, kv.punkter, bue) : null;
        const c = kantKost(k, kv.punkter, s?.skilt ?? null);
        if (!best || c < best.c) best = { bue, c, skilt: s?.skilt ?? null, punkter: kv.punkter, sti: kv.sti };
      }
      if (best && best.c < naa) {
        k.bue = best.bue;
        k.punkter = best.punkter;
        k.sti = best.sti;
        k.skilt = best.skilt;
      }
      leggKant(kantNett, k.id, k.punkter);
      if (k.skilt) leggEtikett(`skilt:${k.id}`, k.skilt.boks);
    }
  }

  const ut: GrafUt = {
    bredde: lerret.bredde,
    hoyde: lerret.hoyde,
    noder: noder.map((n) => {
      const p = punkt(n.key);
      const e = plassert.get(n.key) ?? { boks: etikettBoks(p.x, p.y, n.etikett, "h"), side: "h" as Side, skjult: false };
      return { key: n.key, x: p.x, y: p.y, etikett: e };
    }),
    kanter,
    knuter,
    kollisjoner: [],
    skjulte: 0,
  };
  // Store grafer sjekkes først når det som ikke får plass, er skjult.
  ut.kollisjoner = stor ? [] : finnKollisjoner(ut);
  return ut;
}

/**
 * Når det ikke finnes plass til alt: skjul det som kolliderer, skilt før
 * organnavn, til det som vises står rent. Et skjult skilt vises når leseren
 * peker på personen eller flytter fokus dit.
 */
function skjulKollisjoner(g: GrafUt): GrafUt {
  const grad = new Map<string, number>();
  for (const k of g.kanter) {
    grad.set(k.fra, (grad.get(k.fra) ?? 0) + 1);
    grad.set(k.til, (grad.get(k.til) ?? 0) + 1);
  }
  const skilt = new Map(g.kanter.filter((k) => k.skilt).map((k) => [`skilt:${k.id}`, k]));
  const knuter = new Map(g.knuter.map((k) => [`knute:${k.id}`, k]));
  const organer = new Map(g.noder.map((n) => [`organ:${n.key}`, n]));
  const skjul = (id: string): boolean => {
    const s = skilt.get(id);
    if (s?.skilt && !s.skilt.skjult) return (s.skilt.skjult = true);
    const k = knuter.get(id);
    if (k && !k.skjult) return (k.skjult = true);
    return false;
  };
  for (let runde = 0; runde < 4; runde++) {
    // En kant gjennom en node rettes ikke ved å skjule en etikett.
    const k = finnKollisjoner(g).filter((c) => c.hva !== "kant går gjennom node");
    if (k.length === 0) break;
    let endret = false;
    for (const c of k) {
      // Skilt og knuteskilt skjules først. Et organnavn skjules bare når
      // kollisjonen ikke har noe skilt å ta av, og da navnet med færrest kanter.
      if (skjul(c.a) || skjul(c.b)) {
        endret = true;
        continue;
      }
      const kandidater = [c.a, c.b]
        .map((id) => organer.get(id))
        .filter((n): n is NodeUt => Boolean(n && !n.etikett.skjult))
        .sort((x, y) => (grad.get(x.key) ?? 0) - (grad.get(y.key) ?? 0) || (x.key < y.key ? -1 : 1));
      const n = kandidater[0];
      if (n) {
        n.etikett.skjult = true;
        endret = true;
      }
    }
    if (!endret) break;
  }
  g.kollisjoner = finnKollisjoner(g);
  g.skjulte =
    g.noder.filter((n) => n.etikett.skjult).length +
    g.kanter.filter((k) => k.skilt?.skjult).length +
    g.knuter.filter((k) => k.skjult).length;
  return g;
}

/**
 * Alt som ikke skal røre hverandre, og som gjør det, blant det som vises. Tom
 * liste betyr at ingen kant krysser et organnavn eller et annet skilt, at ingen
 * etiketter overlapper, at ingen kant går gjennom en node den ikke hører til,
 * og at alt står innenfor lerretet.
 */
export function finnKollisjoner(g: GrafUt, { kanter = true }: { kanter?: boolean } = {}): Kollisjon[] {
  const medKanter = kanter;
  const ut: Kollisjon[] = [];
  const lerret = { bredde: g.bredde, hoyde: g.hoyde };
  type Etikett = { id: string; node: string; kant: string; knute: string; boks: Boks };
  const alle: Etikett[] = [
    ...g.noder
      .filter((n) => !n.etikett.skjult)
      .map((n) => ({ id: `organ:${n.key}`, node: n.key, kant: "", knute: "", boks: n.etikett.boks })),
    ...g.kanter
      .filter((k) => k.skilt && !k.skilt.skjult)
      .map((k) => ({ id: `skilt:${k.id}`, node: "", kant: k.id, knute: "", boks: (k.skilt as Skilt).boks })),
    ...g.knuter
      .filter((k) => !k.skjult)
      .map((k) => ({ id: `knute:${k.id}`, node: "", kant: "", knute: k.id, boks: k.boks })),
  ];
  const etikettNett = new Rutenett();
  const etterId = new Map(alle.map((e) => [e.id, e]));
  for (const e of alle) etikettNett.legg(e.id, e.boks);
  const kantNett = new Rutenett();
  const kantEtterId = new Map(g.kanter.map((k) => [k.id, k]));
  for (const k of g.kanter) leggKant(kantNett, k.id, k.punkter);
  const nodeNett = new Rutenett();
  const nodeEtterKey = new Map(g.noder.map((n) => [n.key, n]));
  for (const n of g.noder) nodeNett.legg(n.key, { x: n.x - NODE_RADIUS, y: n.y - NODE_RADIUS, b: 2 * NODE_RADIUS, h: 2 * NODE_RADIUS });

  for (const e of alle) {
    if (utenfor(e.boks, lerret)) ut.push({ hva: "utenfor lerretet", a: e.id, b: "" });
    for (const id of etikettNett.finn(e.boks)) {
      if (id <= e.id) continue;
      const f = etterId.get(id);
      if (f && overlapp(e.boks, f.boks, 0)) ut.push({ hva: "etiketter overlapper", a: e.id, b: f.id });
    }
    for (const id of medKanter ? kantNett.finn(e.boks) : []) {
      const k = kantEtterId.get(id);
      // Skiltet står på sin egen kant, og knuteskiltet der eikene møtes, med vilje.
      if (!k || e.kant === k.id || (e.knute && e.knute === k.knute)) continue;
      if (linjeIBoks(k.punkter, e.boks)) ut.push({ hva: "kant krysser etikett", a: e.id, b: `kant:${k.id}` });
    }
    for (const key of nodeNett.finn(e.boks)) {
      const n = nodeEtterKey.get(key);
      if (!n || e.node === n.key) continue;
      if (sirkelIBoks(n.x, n.y, NODE_RADIUS, e.boks)) ut.push({ hva: "etikett dekker node", a: e.id, b: `node:${n.key}` });
    }
  }
  for (const k of medKanter ? g.kanter : []) {
    for (let i = 1; i < k.punkter.length; i++) {
      const [x1, y1] = k.punkter[i - 1] ?? [0, 0];
      const [x2, y2] = k.punkter[i] ?? [0, 0];
      const b = { x: Math.min(x1, x2) - NODE_RADIUS, y: Math.min(y1, y2) - NODE_RADIUS, b: Math.abs(x2 - x1) + 2 * NODE_RADIUS, h: Math.abs(y2 - y1) + 2 * NODE_RADIUS };
      for (const key of nodeNett.finn(b)) {
        const n = nodeEtterKey.get(key);
        if (!n || n.key === k.fra || n.key === k.til) continue;
        if (avstandTilLinje(n.x, n.y, [[x1, y1], [x2, y2]]) < NODE_RADIUS) {
          ut.push({ hva: "kant går gjennom node", a: `kant:${k.id}`, b: `node:${n.key}` });
        }
      }
    }
  }
  // Samme kollisjon kan bli funnet fra flere linjestykker.
  const sett = new Set<string>();
  return ut.filter((c) => {
    const n = `${c.hva}|${c.a}|${c.b}`;
    if (sett.has(n)) return false;
    sett.add(n);
    return true;
  });
}

/** Oppsettet med og uten eierskapslaget. Nodene står på samme sted i begge. */
export interface Oppsett {
  /** Bare personkantene. Det leseren ser først. */
  personer: GrafUt;
  /** Med eierkantene og nodene som bare er med i eierskapslaget. */
  medEierskap: GrafUt;
}

/** Inndataene uten eierskapslaget: bare personkanter, knuter og organene de berører. */
function utenEierskap(inn: GrafInn): GrafInn {
  const kanter = inn.kanter.filter((k) => k.lag === "person");
  const brukt = new Set<string>();
  for (const k of kanter) {
    brukt.add(k.fra);
    brukt.add(k.til);
  }
  for (const k of inn.knuter ?? []) for (const o of k.organer) brukt.add(o);
  return { noder: inn.noder.filter((n) => brukt.has(n.key)), kanter, knuter: inn.knuter ?? [] };
}

/**
 * Regner oppsettet. Nodene plasseres én gang, med alle kantene, så de står
 * stille når leseren slår eierskapslaget av og på. Kantene, etikettene og
 * skiltene settes for hvert lag, så en eierkant som er skjult, ikke bøyer en
 * personkant. Variantene prøves i fast rekkefølge. Den første der begge
 * lagene er uten kollisjoner, vinner. Finnes ingen, brukes den med færrest,
 * og det som fortsatt kolliderer, skjules.
 */
export function regnOppsett(inn: GrafInn, lerret: Lerret): Oppsett {
  const tom: GrafUt = {
    bredde: lerret.bredde,
    hoyde: lerret.hoyde,
    noder: [],
    kanter: [],
    knuter: [],
    kollisjoner: [],
    skjulte: 0,
  };
  if (inn.noder.length === 0) return { personer: tom, medEierskap: tom };
  const { varianter, steg } = budsjett(inn.noder.length + (inn.knuter?.length ?? 0));
  let best: { o: Oppsett; n: number } | null = null;
  for (const v of VARIANTER.slice(0, varianter)) {
    const { pos, hoyde } = simuler(inn, lerret, v, steg);
    const l = { bredde: lerret.bredde, hoyde };
    const uten = utenEierskap(inn);
    const personer = sett(uten, l, pos);
    // Uten eierkanter er lagene like, og oppsettet regnes én gang.
    const likeLag = uten.kanter.length === inn.kanter.length && uten.noder.length === inn.noder.length;
    const o = { personer, medEierskap: likeLag ? personer : sett(inn, l, pos) };
    const n = o.personer.kollisjoner.length + o.medEierskap.kollisjoner.length;
    if (n === 0 && inn.noder.length <= 150) return o;
    if (!best || n < best.n) best = { o, n };
  }
  if (!best) return { personer: tom, medEierskap: tom };
  if (inn.noder.length > 150) {
    // En stor graf er alt plassert uten overlapp: det som ikke fikk plass, er skjult.
    for (const g of new Set([best.o.personer, best.o.medEierskap])) {
      g.kollisjoner = finnKollisjoner(g, { kanter: false });
      g.skjulte =
        g.noder.filter((n) => n.etikett.skjult).length +
        g.kanter.filter((k) => k.skilt?.skjult).length +
        g.knuter.filter((k) => k.skjult).length;
    }
    return best.o;
  }
  const personer = skjulKollisjoner(best.o.personer);
  return {
    personer,
    medEierskap: best.o.medEierskap === best.o.personer ? personer : skjulKollisjoner(best.o.medEierskap),
  };
}

/**
 * Lerretet: fast bredde og en minstehøyde. Høyden vokser med grafen. Bredden
 * er den minste bredden grafen vises i på skrivebord (innholdskolonnen ved
 * 1 200 px), så grafen bare skaleres opp.
 */
export function lerretFor(antallNoder: number): Lerret {
  return { bredde: 820, hoyde: Math.round(Math.max(320, 120 + antallNoder * 20)) };
}
