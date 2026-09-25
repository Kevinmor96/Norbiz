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
  etikett: { boks: Boks; side: Side };
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
  /** Senter og boks for skiltet, eller `null` når kanten ikke har skilt. */
  skilt: { x: number; y: number; boks: Boks } | null;
  /** Satt for eikene i en knute: knutens id. Eiken går fra skiltet til organet `til`. */
  knute?: string;
}

export interface KnuteUt {
  id: string;
  x: number;
  y: number;
  boks: Boks;
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
  /** Tom når oppsettet er rent. Siden bruker oppsettet uansett. */
  kollisjoner: Kollisjon[];
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

const PROVER = 24;

function kurve(
  a: { key: string; x: number; y: number },
  b: { key: string; x: number; y: number },
  bue: number,
) {
  const k = kontroll(a, b, bue);
  const punkter: [number, number][] = [];
  for (let i = 0; i <= PROVER; i++) punkter.push(bezier([a.x, a.y], k, [b.x, b.y], i / PROVER));
  const sti =
    bue === 0
      ? `M${rund(a.x)} ${rund(a.y)}L${rund(b.x)} ${rund(b.y)}`
      : `M${rund(a.x)} ${rund(a.y)}Q${rund(k[0])} ${rund(k[1])} ${rund(b.x)} ${rund(b.y)}`;
  return { k, punkter, sti };
}

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

/** Skilt langs kanten: midt på først, så gradvis mot endene. */
const SKILT_T = [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8];

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
}

/** Variantene som prøves i rekkefølge. Den første uten kollisjoner vinner. */
const VARIANTER: Variant[] = [
  { avstand: 150, frastoting: -900 },
  { avstand: 175, frastoting: -1100 },
  { avstand: 135, frastoting: -800 },
  { avstand: 200, frastoting: -1300 },
  { avstand: 165, frastoting: -1500 },
  { avstand: 220, frastoting: -1700 },
];

const STEG = 320;
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
): { pos: Map<string, { x: number; y: number }>; hoyde: number } {
  const bredde = lerret.bredde;
  const midtY = bredde * 0.3;
  const knuter = [...(inn.knuter ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));

  // Nodens plassbehov: organnavnet og det bredeste skiltet på kantene dens.
  const bredesteSkilt = new Map<string, number>();
  for (const k of inn.kanter) {
    const b = k.skilt?.bredde ?? 0;
    bredesteSkilt.set(k.fra, Math.max(bredesteSkilt.get(k.fra) ?? 0, b));
    bredesteSkilt.set(k.til, Math.max(bredesteSkilt.get(k.til) ?? 0, b));
  }
  const start = (key: string) => ({
    // Startposisjonen er en funksjon av nøkkelen alene.
    x: bredde * (0.15 + 0.7 * enhet(`${key}:x`)),
    y: midtY * 2 * (0.15 + 0.7 * enhet(`${key}:y`)),
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
    .alphaDecay(0.0205)
    .velocityDecay(0.42)
    .force(
      "lenke",
      forceLink<SimNode, Lenke>(lenker)
        .id((d) => d.key)
        .distance((l) => l.lengde)
        .strength((l) => l.styrke),
    )
    .force("frastoting", forceManyBody<SimNode>().strength(v.frastoting).distanceMax(700))
    .force("x", forceX<SimNode>(bredde / 2).strength(0.04))
    .force("y", forceY<SimNode>(midtY).strength(0.085))
    .force("kollisjon", forceCollide<SimNode>((d) => d.r).strength(0.9))
    .stop();
  for (let i = 0; i < STEG; i++) sim.tick();

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

function sett(inn: GrafInn, lerret: Lerret, pos: Map<string, { x: number; y: number }>): GrafUt {
  const noder = [...inn.noder].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const punkt = (key: string) => ({ key, ...(pos.get(key) ?? { x: 0, y: 0 }) });
  const skiltFor = new Map(inn.kanter.map((k) => [k.id, k.skilt]));

  // 1. Kantene. Parallelle kanter legges så langt fra hverandre at naboens
  //    skilt ikke krysses. En enkel kant bøyes bare når den ellers går
  //    gjennom en node den ikke hører til.
  const grupper = new Map<string, KantInn[]>();
  for (const k of inn.kanter) {
    if (!pos.has(k.fra) || !pos.has(k.til)) continue;
    const n = k.fra < k.til ? `${k.fra}|${k.til}` : `${k.til}|${k.fra}`;
    grupper.set(n, [...(grupper.get(n) ?? []), k]);
  }
  const kanter: KantUt[] = [];
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
      if (ordnet.length === 1) {
        const treff = (v: number) => {
          const { punkter } = kurve(a, b, v);
          let n = 0;
          for (const node of noder) {
            if (node.key === k.fra || node.key === k.til) continue;
            const r = punkt(node.key);
            if (avstandTilLinje(r.x, r.y, punkter) < NODE_RADIUS + 10) n += 1;
          }
          return n;
        };
        let best = treff(0);
        for (const v of [28, -28, 56, -56]) {
          if (best === 0) break;
          const t = treff(v);
          if (t < best) {
            best = t;
            bue = v;
          }
        }
      }
      const { punkter, sti } = kurve(a, b, bue);
      kanter.push({ id: k.id, fra: k.fra, til: k.til, lag: k.lag, bue, sti, punkter, skilt: null });
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
    });
    for (const o of [...k.organer].sort()) {
      if (!pos.has(o)) continue;
      const m = punkt(o);
      const punkter: [number, number][] = [
        [c.x, c.y],
        [m.x, m.y],
      ];
      kanter.push({
        id: `${k.id}>${o}`,
        fra: knuteNokkel(k.id),
        til: o,
        lag: "person",
        bue: 0,
        sti: `M${rund(c.x)} ${rund(c.y)}L${rund(m.x)} ${rund(m.y)}`,
        punkter,
        skilt: null,
        knute: k.id,
      });
    }
  }
  const knuteBokser = knuter.map((k) => ({ id: k.id, boks: k.boks }));

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
  const plassert = new Map<string, { boks: Boks; side: Side }>();
  // Først tett inntil noden på alle sider, så litt lenger ut. En etikett som
  // står et stykke fra noden, er bedre enn en som krysses av en kant.
  const kandidater = [
    ...SIDER.map((side) => ({ side, ekstra: 0 })),
    ...SIDER.map((side) => ({ side, ekstra: 14 })),
    ...SIDER.map((side) => ({ side, ekstra: 30 })),
  ];
  for (const n of rekkefolge) {
    const p = punkt(n.key);
    let best: { boks: Boks; side: Side; poeng: number } | null = null;
    for (const [i, { side, ekstra }] of kandidater.entries()) {
      const boks = etikettBoks(p.x, p.y, n.etikett, side, ekstra);
      let poeng = i * 0.1;
      if (utenfor(boks, lerret)) poeng += 100;
      for (const k of kanter) if (linjeIBoks(k.punkter, boks)) poeng += 100;
      for (const [, e] of plassert) if (overlapp(boks, e.boks)) poeng += 100;
      for (const e of knuteBokser) if (overlapp(boks, e.boks)) poeng += 100;
      for (const m of noder) {
        if (m.key === n.key) continue;
        const q = punkt(m.key);
        if (sirkelIBoks(q.x, q.y, NODE_RADIUS + KLARING, boks)) poeng += 100;
      }
      if (!best || poeng < best.poeng) best = { boks, side, poeng };
    }
    if (best) plassert.set(n.key, { boks: best.boks, side: best.side });
  }

  // 3. Skiltene langs kantene. Korte kanter velger først, de har minst å gå på.
  const lengde = (k: KantUt) => {
    const a = punkt(k.fra);
    const b = punkt(k.til);
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const skiltRekke = kanter
    .filter((k) => skiltFor.get(k.id))
    .sort((a, b) => lengde(a) - lengde(b) || (a.id < b.id ? -1 : 1));
  const skiltBokser: { id: string; boks: Boks }[] = [...knuteBokser];
  for (const k of skiltRekke) {
    const s = skiltFor.get(k.id);
    if (!s) continue;
    const a = punkt(k.fra);
    const b = punkt(k.til);
    const kp = kontroll(a, b, k.bue);
    let best: { x: number; y: number; boks: Boks; poeng: number } | null = null;
    for (const [i, t] of SKILT_T.entries()) {
      const [x, y] =
        k.bue === 0 ? [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t] : bezier([a.x, a.y], kp, [b.x, b.y], t);
      const boks = { x: x - s.bredde / 2, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde };
      let poeng = i * 0.1;
      if (utenfor(boks, lerret)) poeng += 100;
      for (const [, e] of plassert) if (overlapp(boks, e.boks)) poeng += 100;
      for (const e of skiltBokser) if (overlapp(boks, e.boks)) poeng += 100;
      for (const n of noder) {
        const q = punkt(n.key);
        if (sirkelIBoks(q.x, q.y, NODE_RADIUS + KLARING, boks)) poeng += 100;
      }
      for (const m of kanter) if (m.id !== k.id && linjeIBoks(m.punkter, boks)) poeng += 10;
      if (!best || poeng < best.poeng) best = { x, y, boks, poeng };
    }
    if (best) {
      k.skilt = { x: rund(best.x), y: rund(best.y), boks: best.boks };
      skiltBokser.push({ id: k.id, boks: best.boks });
    }
  }

  // 4. Reparasjon: en enkel kant som krysser en etikett eller et skilt, bøyes
  //    unna, og skiltet dens flyttes med. Etikettene står fast.
  const faste = () => [
    ...[...plassert.values()].map((e) => e.boks),
    ...knuteBokser.map((e) => e.boks),
  ];
  const parStorrelse = new Map<string, number>();
  for (const k of kanter) {
    if (k.knute) continue;
    const n = k.fra < k.til ? `${k.fra}|${k.til}` : `${k.til}|${k.fra}`;
    parStorrelse.set(n, (parStorrelse.get(n) ?? 0) + 1);
  }
  for (let runde = 0; runde < 2; runde++) {
    for (const k of kanter) {
      if (k.knute) continue;
      const n = k.fra < k.til ? `${k.fra}|${k.til}` : `${k.til}|${k.fra}`;
      if ((parStorrelse.get(n) ?? 0) > 1) continue;
      const andreSkilt = () => kanter.filter((m) => m.id !== k.id && m.skilt).map((m) => (m.skilt as { boks: Boks }).boks);
      const kost = (punkter: [number, number][], skilt: Boks | null) => {
        let c = 0;
        for (const b of [...faste(), ...andreSkilt()]) if (linjeIBoks(punkter, b)) c += 1;
        for (const node of noder) {
          if (node.key === k.fra || node.key === k.til) continue;
          const r = punkt(node.key);
          if (avstandTilLinje(r.x, r.y, punkter) < NODE_RADIUS + 6) c += 1;
          if (skilt && sirkelIBoks(r.x, r.y, NODE_RADIUS + KLARING, skilt)) c += 1;
        }
        if (skilt) {
          if (utenfor(skilt, lerret)) c += 1;
          for (const b of [...faste(), ...andreSkilt()]) if (overlapp(skilt, b)) c += 1;
          for (const m of kanter) if (m.id !== k.id && linjeIBoks(m.punkter, skilt)) c += 1;
        }
        return c;
      };
      const naa = kost(k.punkter, k.skilt?.boks ?? null);
      if (naa === 0) continue;
      const s = skiltFor.get(k.id) ?? null;
      const a = punkt(k.fra);
      const b = punkt(k.til);
      let best: { bue: number; c: number; skilt: KantUt["skilt"]; punkter: [number, number][]; sti: string } | null = null;
      for (const bue of [k.bue + 28, k.bue - 28, k.bue + 56, k.bue - 56, k.bue + 84, k.bue - 84]) {
        const kv = kurve(a, b, bue);
        let skilt: KantUt["skilt"] = null;
        let c = Infinity;
        if (s) {
          for (const t of SKILT_T) {
            const [x, y] = bezier([a.x, a.y], kv.k, [b.x, b.y], t);
            const boks = { x: x - s.bredde / 2, y: y - s.hoyde / 2, b: s.bredde, h: s.hoyde };
            const ct = kost(kv.punkter, boks);
            if (ct < c) {
              c = ct;
              skilt = { x: rund(x), y: rund(y), boks };
            }
          }
        } else {
          c = kost(kv.punkter, null);
        }
        if (!best || c < best.c) best = { bue, c, skilt, punkter: kv.punkter, sti: kv.sti };
      }
      if (best && best.c < naa) {
        k.bue = best.bue;
        k.punkter = best.punkter;
        k.sti = best.sti;
        k.skilt = best.skilt;
      }
    }
  }

  const ut: GrafUt = {
    bredde: lerret.bredde,
    hoyde: lerret.hoyde,
    noder: noder.map((n) => {
      const p = punkt(n.key);
      const e = plassert.get(n.key) ?? { boks: etikettBoks(p.x, p.y, n.etikett, "h"), side: "h" as Side };
      return { key: n.key, x: p.x, y: p.y, etikett: e };
    }),
    kanter,
    knuter,
    kollisjoner: [],
  };
  ut.kollisjoner = finnKollisjoner(ut);
  return ut;
}

/**
 * Alt som ikke skal røre hverandre, og som gjør det. Tom liste betyr at
 * ingen kant krysser et organnavn eller et annet skilt, at ingen etiketter
 * overlapper, at ingen kant går gjennom en node den ikke hører til, og at
 * alt står innenfor lerretet.
 */
export function finnKollisjoner(g: GrafUt): Kollisjon[] {
  const ut: Kollisjon[] = [];
  const lerret = { bredde: g.bredde, hoyde: g.hoyde };
  type Etikett = { id: string; node: string; kant: string; knute: string; boks: Boks };
  const alle: Etikett[] = [
    ...g.noder.map((n) => ({ id: `organ:${n.key}`, node: n.key, kant: "", knute: "", boks: n.etikett.boks })),
    ...g.kanter
      .filter((k) => k.skilt)
      .map((k) => ({ id: `skilt:${k.id}`, node: "", kant: k.id, knute: "", boks: (k.skilt as { boks: Boks }).boks })),
    ...g.knuter.map((k) => ({ id: `knute:${k.id}`, node: "", kant: "", knute: k.id, boks: k.boks })),
  ];

  for (const e of alle) if (utenfor(e.boks, lerret)) ut.push({ hva: "utenfor lerretet", a: e.id, b: "" });
  for (let i = 0; i < alle.length; i++) {
    for (let j = i + 1; j < alle.length; j++) {
      const a = alle[i];
      const b = alle[j];
      if (a && b && overlapp(a.boks, b.boks, 0)) ut.push({ hva: "etiketter overlapper", a: a.id, b: b.id });
    }
  }
  for (const e of alle) {
    for (const k of g.kanter) {
      // Skiltet står på sin egen kant, og knuteskiltet der eikene møtes, med vilje.
      if (e.kant === k.id || (e.knute && e.knute === k.knute)) continue;
      if (linjeIBoks(k.punkter, e.boks)) ut.push({ hva: "kant krysser etikett", a: e.id, b: `kant:${k.id}` });
    }
    for (const n of g.noder) {
      if (e.node === n.key) continue;
      if (sirkelIBoks(n.x, n.y, NODE_RADIUS, e.boks)) ut.push({ hva: "etikett dekker node", a: e.id, b: `node:${n.key}` });
    }
  }
  for (const k of g.kanter) {
    for (const n of g.noder) {
      if (n.key === k.fra || n.key === k.til) continue;
      if (avstandTilLinje(n.x, n.y, k.punkter) < NODE_RADIUS) {
        ut.push({ hva: "kant går gjennom node", a: `kant:${k.id}`, b: `node:${n.key}` });
      }
    }
  }
  return ut;
}

/**
 * Regner oppsettet. Prøver variantene i fast rekkefølge og tar den første
 * uten kollisjoner, ellers den med færrest.
 */
export function regnOppsett(inn: GrafInn, lerret: Lerret): GrafUt {
  let best: GrafUt | null = null;
  for (const v of VARIANTER) {
    const { pos, hoyde } = simuler(inn, lerret, v);
    const g = sett(inn, { bredde: lerret.bredde, hoyde }, pos);
    if (g.kollisjoner.length === 0) return g;
    if (!best || g.kollisjoner.length < best.kollisjoner.length) best = g;
  }
  return best ?? { bredde: lerret.bredde, hoyde: lerret.hoyde, noder: [], kanter: [], knuter: [], kollisjoner: [] };
}

/**
 * Lerretet: fast bredde og en minstehøyde. Høyden vokser med grafen. Bredden
 * er den minste bredden grafen vises i på skrivebord (innholdskolonnen ved
 * 1 200 px), så grafen bare skaleres opp.
 */
export function lerretFor(antallNoder: number): Lerret {
  return { bredde: 820, hoyde: Math.round(Math.max(320, 120 + antallNoder * 20)) };
}
