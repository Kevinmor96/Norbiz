// Søket: bretting, rangering og sortering, i én ren funksjon.
//
// Tre steder søker med de samme reglene:
//
// - `lokal.ts` (`sok()` i datalaget), over hele samlingen på serveren.
// - Den statiske eksporten, i nettleseren, over /data/sokeindeks.json. Der
//   finnes ingen server, så indeksen er ferdig regnet ved bygging og søkes her.
// - `public.sok` i basen (supabase/migrations/0018_rpc_region.sql), med
//   `intern.fold` og `intern.normaliser`. `tests/sok.test.ts` krever at basen og
//   denne fila bretter likt, og kontrakttesten at svarene er like.
//
// Fila er ren (ingen Node, ingen Vite, ingen datasett), så den kan gå i
// nettleserbunten uten å dra datalaget med seg.

import {
  BRETTING,
  ROLLETYPER,
  SOK_MAKS,
  SOK_MIN_TEGN,
  type RolleIOrgan,
  type SokKommune,
  type SokOrgan,
  type Sokeresultat,
} from "./kontrakt";

const tegnkart = new Map<string, string>();
{
  const fra = [...BRETTING.fra];
  const til = [...BRETTING.til];
  fra.forEach((c, i) => tegnkart.set(c, til[i]!));
}

/**
 * Bretter bort aksenter og store bokstaver etter `BRETTING`. Tegn som ikke står
 * i lista, står urørt, akkurat som `translate` i basen lar dem stå.
 */
export function brett(tekst: string): string {
  let ut = "";
  for (const c of tekst) ut += tegnkart.get(c) ?? c;
  for (const [a, b] of BRETTING.flertegn) ut = ut.replaceAll(a, b);
  return ut;
}

/** Brettet, med alt som ikke er a–z eller 0–9 gjort om til ett mellomrom. */
export function normaliser(tekst: string): string {
  return brett(tekst)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^ | $/g, "");
}

/** `limit` slik begge implementasjonene tolker den. */
export const sokLimit = (limit: number) =>
  Math.max(1, Math.min(SOK_MAKS, Number.isFinite(limit) ? Math.trunc(limit) : 1));

/**
 * Rangen til et treff, eller `null` når ett av ordene mangler i teksten.
 * `navn` og `tekst` er normalisert.
 */
function rang(navn: string[], tekst: string, q: string, ord: string[]): number | null {
  if (!ord.every((o) => tekst.includes(o))) return null;
  if (navn.some((n) => n === q)) return 0;
  if (navn.some((n) => n.startsWith(q))) return 1;
  const t = ` ${tekst}`;
  if (ord.every((o) => t.includes(` ${o}`))) return 2;
  return 3;
}

/** Det søket leter i. Rollene er alt filtrert: aktive, synlige og ikke utelatt. */
export interface Sokegrunnlag {
  kommuner: SokKommune[];
  organer: SokOrgan[];
  roller: RolleIOrgan[];
}

interface Forberedt<T> {
  x: T;
  navn: string[];
  tekst: string;
}

const forberedt = new WeakMap<
  Sokegrunnlag,
  { k: Forberedt<SokKommune>[]; o: Forberedt<SokOrgan>[]; r: Forberedt<RolleIOrgan>[] }
>();

function forbered(g: Sokegrunnlag) {
  let f = forberedt.get(g);
  if (!f) {
    f = {
      k: g.kommuner.map((x) => ({
        x,
        navn: [normaliser(x.navn_offisielt), normaliser(x.navn)],
        tekst: normaliser(`${x.navn_offisielt} ${x.navn}`),
      })),
      o: g.organer.map((x) => ({
        x,
        navn: [normaliser(x.navn), ...(x.kortnavn === null ? [] : [normaliser(x.kortnavn)])],
        tekst: normaliser(`${x.navn} ${x.kortnavn ?? ""} ${x.orgnr ?? ""}`),
      })),
      r: g.roller.map((x) => ({
        x,
        navn: [normaliser(x.person.navn)],
        tekst: normaliser(`${x.person.navn} ${x.tittel} ${x.org.navn} ${x.org.kortnavn ?? ""}`),
      })),
    };
    forberedt.set(g, f);
  }
  return f;
}

const tekstCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const rolletypeRang = new Map(ROLLETYPER.map((t, i) => [t, i] as const));

function treff<T>(
  liste: Forberedt<T>[],
  q: string,
  ord: string[],
  cmp: (a: T, b: T) => number,
  limit: number,
) {
  const funnet: { x: T; r: number }[] = [];
  for (const f of liste) {
    const r = rang(f.navn, f.tekst, q, ord);
    if (r !== null) funnet.push({ x: f.x, r });
  }
  funnet.sort((a, b) => a.r - b.r || cmp(a.x, b.x));
  return { antall: funnet.length, treff: funnet.slice(0, limit).map((f) => f.x) };
}

/** Søket. Samme regler og samme sortering som `public.sok` i basen. */
export function sokI(g: Sokegrunnlag, sporring: string, limit: number): Sokeresultat {
  const q = normaliser(sporring.normalize("NFC"));
  if (q.length < SOK_MIN_TEGN) {
    return {
      sporring: q,
      kommuner: { antall: 0, treff: [] },
      organer: { antall: 0, treff: [] },
      roller: { antall: 0, treff: [] },
    };
  }
  const ord = q.split(" ");
  const n = sokLimit(limit);
  const f = forbered(g);
  return {
    sporring: q,
    kommuner: treff(f.k, q, ord, (a, b) => tekstCmp(a.kommunenr, b.kommunenr), n),
    organer: treff(
      f.o,
      q,
      ord,
      (a, b) =>
        Number(a.status !== "aktiv") - Number(b.status !== "aktiv") || tekstCmp(a.key, b.key),
      n,
    ),
    roller: treff(
      f.r,
      q,
      ord,
      (a, b) =>
        tekstCmp(a.person.key, b.person.key) ||
        tekstCmp(a.org.key, b.org.key) ||
        (rolletypeRang.get(a.rolletype) ?? 0) - (rolletypeRang.get(b.rolletype) ?? 0) ||
        (a.fra === null ? (b.fra === null ? 0 : -1) : b.fra === null ? 1 : tekstCmp(a.fra, b.fra)),
      n,
    ),
  };
}
