// Hvilke koblinger grafen viser (DESIGN.md §5.5, og kravet om skala).
//
// Datasettet skal vokse til flere hundre organer og hundrevis av personer med
// minst to roller. En graf med alt blir et nøste ingen kan lese. Grafen viser
// derfor et avgrenset utvalg, og regelen for utvalget står under grafen:
//
//   1. Har nettverket høyst MAKS_KOBLINGER koblinger, vises alle.
//   2. Ellers vises koblingene som berører kommunens egne organer, så de som
//      berører selskapene kommunen eier direkte, så de den eier gjennom andre,
//      så langt det er plass. Utvalget går etter organ, aldri etter person:
//      Maktkart rangerer ikke mennesker (institusjon først).
//   3. Søk, nivå og bransje velger koblingene som berører organene eller
//      personene leseren ber om. Er det flere enn MAKS_KOBLINGER, vises de
//      første i fast rekkefølge, og siden sier hvor mange som ikke vises.
//
// Lista under grafen viser alle personene som passer, med søk og sider.

import type { Nettverk, Nivaa, Organkart, Eierskap, OrganRef } from "../data/kontrakt";
import type { Grafmodell, Personkant } from "./modell";

/** Flest koblinger grafen viser om gangen. Lista viser resten. */
export const MAKS_KOBLINGER = 40;

export interface Filter {
  sok: string;
  nivaa: Nivaa | null;
  segment: string | null;
}

export const TOMT_FILTER: Filter = { sok: "", nivaa: null, segment: null };

export const erTomt = (f: Filter) => f.sok.trim() === "" && f.nivaa === null && f.segment === null;

/**
 * For søk: små bokstaver og uten aksenter, så «Hermes» finner «HERMÈS»
 * (lærdom fra Bransjesjekk). Æ, ø og å er egne bokstaver og beholdes.
 */
export function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/å/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "å")
    .trim();
}

export type Kommunelag = 1 | 2 | 3;

/**
 * Hvor nær kommunen et organ står. 1: kommunen selv og organene under den
 * (kommunestyret, utvalgene, administrasjonen, foretakene). 2: selskaper
 * kommunen eier direkte. 3: selskaper den eier gjennom andre.
 */
export function kommunelag({
  organkart,
  eierskap,
  kommuneorgan,
}: {
  organkart: Organkart;
  eierskap: Eierskap;
  kommuneorgan: OrganRef | null;
}): Map<string, Kommunelag> {
  const lag = new Map<string, Kommunelag>();
  const rot = kommuneorgan?.key ?? eierskap.eier?.key ?? null;
  if (!rot) return lag;
  const over = new Map<string, string | null>();
  for (const g of organkart.grupper) for (const o of g.organer) over.set(o.key, o.overordnet);
  lag.set(rot, 1);
  for (const key of over.keys()) {
    // Følg overordnet oppover. Grensen på 20 ledd stopper en eventuell ring i data.
    let k: string | null | undefined = key;
    for (let i = 0; i < 20 && k; i++) {
      if (k === rot) {
        lag.set(key, 1);
        break;
      }
      k = over.get(k);
    }
  }
  for (const s of eierskap.selskaper) {
    if (lag.has(s.org.key)) continue;
    lag.set(s.org.key, s.ledd <= 1 ? 2 : 3);
  }
  return lag;
}

export interface Utvalg {
  /** Koblingene grafen viser. */
  kanter: Personkant[];
  /** Koblingene som passer, før grensen. */
  treff: number;
  /** Alle koblingene i nettverket. */
  totalt: number;
  regel: "alle" | "kommunen" | "filter";
  /** For regel «kommunen»: hvor langt ut fra kommunen utvalget gikk. */
  lag: Kommunelag | null;
  avkortet: boolean;
}

export interface Kontekst {
  lag: Map<string, Kommunelag>;
  /** Organene i hvert segment, fra `organer_for_segment`. */
  segmenter: Map<string, Set<string>>;
  organer: Map<string, OrganRef>;
}

/** Passer koblingen filteret? Et organ i en av endene eller personen selv. */
export function passer(k: Personkant, f: Filter, ktx: Kontekst): boolean {
  const ender = [k.fra, k.til];
  if (f.nivaa && !ender.some((e) => ktx.organer.get(e)?.nivaa === f.nivaa)) return false;
  if (f.segment) {
    const s = ktx.segmenter.get(f.segment);
    if (!s || !ender.some((e) => s.has(e))) return false;
  }
  const q = normaliser(f.sok);
  if (q) {
    const tekster = [
      k.person.navn,
      ...ender.flatMap((e) => {
        const o = ktx.organer.get(e);
        return o ? [o.navn, o.kortnavn ?? ""] : [];
      }),
    ];
    if (!tekster.some((t) => normaliser(t).includes(q))) return false;
  }
  return true;
}

/** Fast rekkefølge for avkorting: etter organ, så person. Aldri etter hvor mange koblinger en person har. */
const rekkefolge = (a: Personkant, b: Personkant) =>
  a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : a.til < b.til ? -1 : a.til > b.til ? 1 : a.person.key < b.person.key ? -1 : 1;

export function velgKoblinger(modell: Grafmodell, filter: Filter, ktx: Kontekst): Utvalg {
  const alle = [...modell.personkanter].sort(rekkefolge);
  const totalt = alle.length;

  if (!erTomt(filter)) {
    const treff = alle.filter((k) => passer(k, filter, ktx));
    return {
      kanter: treff.slice(0, MAKS_KOBLINGER),
      treff: treff.length,
      totalt,
      regel: "filter",
      lag: null,
      avkortet: treff.length > MAKS_KOBLINGER,
    };
  }
  if (totalt <= MAKS_KOBLINGER) {
    return { kanter: alle, treff: totalt, totalt, regel: "alle", lag: null, avkortet: false };
  }
  // Så langt ut fra kommunen som det er plass til.
  const naermest = (k: Personkant) =>
    Math.min(ktx.lag.get(k.fra) ?? 9, ktx.lag.get(k.til) ?? 9);
  let valgt: Personkant[] = [];
  let lag: Kommunelag = 1;
  for (const l of [1, 2, 3] as const) {
    const med = alle.filter((k) => naermest(k) <= l);
    if (l > 1 && med.length > MAKS_KOBLINGER) break;
    valgt = med;
    lag = l;
  }
  return {
    kanter: valgt.slice(0, MAKS_KOBLINGER),
    treff: valgt.length,
    totalt,
    regel: "kommunen",
    lag,
    avkortet: valgt.length > MAKS_KOBLINGER,
  };
}

/** Nettverket med bare de valgte koblingene. Grafen bygges av dette. */
export function delnettverk(nettverk: Nettverk, kanter: Personkant[]): Nettverk {
  const valgt = new Set(kanter.map((k) => k.id));
  const nk = nettverk.kanter.filter((k) => valgt.has(`${k.person.key}:${k.fra}:${k.til}`));
  const organer = new Set<string>();
  const perPerson = new Map<string, Set<string>>();
  for (const k of nk) {
    organer.add(k.fra);
    organer.add(k.til);
    const s = perPerson.get(k.person.key) ?? new Set<string>();
    s.add(k.fra);
    s.add(k.til);
    perPerson.set(k.person.key, s);
  }
  return {
    noder: nettverk.noder.filter((o) => organer.has(o.key)),
    kanter: nk,
    personer: nettverk.personer
      .filter((p) => perPerson.has(p.person.key))
      .map((p) => ({ ...p, roller: p.roller.filter((r) => perPerson.get(p.person.key)?.has(r.org.key)) })),
  };
}
