// Dataindeksen: hvilke datasett et svar trenger, og tallene som går på tvers
// av dem.
//
//   npm run data:indeks   ->  src/lib/data/indeks.json
//
// Med 80 kommuner kan ikke siden laste alle datasettene for å vise én kommune.
// Men samlingen er en union: rollene i Statsforvalteren kan stå i Balsfjords
// fil og vises på Tromsøs side, og en eierandel i et interkommunalt selskap står
// i eierkommunens fil. Indeksen sier derfor, for hver kommune, hvert organ og
// hvert fylke, hvilke filer som til sammen har hver rad svaret leser. Da gir
// `lagLokal` over de filene nøyaktig samme svar som over alle, uansett hvilken
// kommune som ble lastet først. `tests/lat.test.ts` sjekker det for hver
// kommune, hvert organ og hvert fylke.
//
// Indeksen regnes fra datasettene og regionregisteret, deterministisk: samme
// filer gir byte-lik indeks. `tests/lat.test.ts` krever at den innsjekkede er
// oppdatert, som seed-en. Er den likevel gammel når siden kjører (en ny fil,
// eller en fil med annet innhold), bygger `lat.ts` den på nytt fra alle
// filene og sier fra i loggen. Da er siden treg, ikke feil.
//
// Fila er ren: ingen filsystem og ingen Vite. Skriptet og testene gir den
// datasettene.

import type { Regionregister } from "../../data/region/types";
import type { Belegg, Kommunedatasett, Rolleinnehav, Segment } from "../../data/types";
import { SENSITIV_SYNLIGE_ROLLETYPER } from "./kontrakt";
import { lagLokal, type Aggregater } from "./lokal";
import { nokkel, samle, valider, type SamletHendelse, type Samling } from "./samle";

export interface IndeksDatasett {
  slug: string;
  /** Avtrykk av innholdet (se `avtrykk`). Skiller en endret fil fra indeksens. */
  avtrykk: string;
  meta: Kommunedatasett["meta"];
  /** `Organisasjon.key` for organene i datasettet, i filens rekkefølge. */
  organer: string[];
}

export interface Dataindeks {
  versjon: 1;
  /** Sortert på slug. */
  datasett: IndeksDatasett[];
  /** Alle segmentene i samlingen, sortert på kode. `kommune_oversikt` lister dem alle. */
  segmenter: Segment[];
  /**
   * Filene en kommuneside trenger, egen fil først. Bare kommuner som trenger
   * mer enn sin egen.
   */
  kommune: Record<string, string[]>;
  /**
   * Filene `organ_profil` trenger. Bare organer som trenger noe annet enn den
   * første fila (i slug-rekkefølge) organet står i.
   */
  organ: Record<string, string[]>;
  /** Filene `fylke_oversikt` trenger, per fylkesnummer. */
  fylke: Record<string, string[]>;
  /** Tallene per kommune og fylke, regnet over hele samlingen. */
  aggregater: Aggregater;
}

/**
 * Avtrykk av et datasett: to FNV-1a-summer over den kompakte JSON-en, som
 * hex. Ikke kryptografisk; det skal bare skille en endret fil fra indeksens,
 * og det skal kunne regnes likt i Node, i nettleseren og i en Worker.
 */
export function avtrykk(data: unknown): string {
  const tekst = JSON.stringify(data);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ tekst.length;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const synlig = (s: Samling, r: Rolleinnehav) =>
  !s.organisasjoner.get(r.org)?.sensitiv ||
  (SENSITIV_SYNLIGE_ROLLETYPER as readonly string[]).includes(r.rolletype);
const erAktiv = (r: Rolleinnehav) => r.til === undefined && r.motsagt !== true;
const tekst = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Regner indeksen. `datasett` er alle kommunedatasettene med slug, `region`
 * regionregisteret (eller `null`, som i testene med fiktive kommuner).
 */
export function byggIndeks(
  datasett: { slug: string; data: Kommunedatasett }[],
  region: Regionregister | null,
): Dataindeks {
  const filer = [...datasett].sort((a, b) => tekst(a.slug, b.slug));
  const s = samle(filer);
  const feil = valider(s);
  if (feil.length) {
    throw new Error(`Datasettene har referansefeil, indeksen lages ikke:\n${feil.join("\n")}`);
  }

  // --- hvor hver rad står ----------------------------------------------------

  const hvor = new Map<string, string[]>();
  const merk = (rad: string, slug: string) => {
    const l = hvor.get(rad);
    if (!l) hvor.set(rad, [slug]);
    else if (l[l.length - 1] !== slug) l.push(slug);
  };
  for (const { slug, data } of filer) {
    for (const x of data.kilder) merk(`kilde:${x.key}`, slug);
    for (const x of data.organisasjoner) merk(`org:${x.key}`, slug);
    for (const x of data.personer) merk(`person:${x.key}`, slug);
    for (const x of data.roller) merk(`rolle:${nokkel.rolle(x)}`, slug);
    for (const x of data.relasjoner) merk(`relasjon:${nokkel.relasjon(x)}`, slug);
    for (const x of data.nokkeltall) merk(`nokkeltall:${nokkel.nokkeltall(x)}`, slug);
    for (const x of data.hendelser) {
      const h: SamletHendelse = x.org === undefined ? { ...x, kommunenr: data.meta.kommunenr } : x;
      merk(`hendelse:${nokkel.hendelse(h)}`, slug);
    }
    for (const x of data.org_segment) merk(`org_segment:${nokkel.orgSegment(x)}`, slug);
    for (const x of data.hull) merk(`hull:${nokkel.hull(x)}`, slug);
  }

  /**
   * Filene som til sammen har hver rad i `krav`, `egen` først. Grådig: fila
   * som dekker flest gjenstående rader, så den første i slug-rekkefølge.
   */
  function dekk(egen: string | null, krav: Set<string>): string[] {
    const valgt = egen ? [egen] : [];
    let igjen = [...krav].filter((rad) => !(egen && hvor.get(rad)?.includes(egen)));
    while (igjen.length) {
      const teller = new Map<string, number>();
      for (const rad of igjen) {
        const steder = hvor.get(rad);
        if (!steder) throw new Error(`Raden «${rad}» står ikke i noe datasett.`);
        for (const slug of steder) teller.set(slug, (teller.get(slug) ?? 0) + 1);
      }
      const [best] = [...teller].sort(([a, x], [b, y]) => y - x || tekst(a, b))[0]!;
      valgt.push(best);
      igjen = igjen.filter((rad) => !hvor.get(rad)!.includes(best));
    }
    return valgt;
  }

  // --- oppslag i samlingen -----------------------------------------------------

  const grupper = <T>(xs: Iterable<T>, k: (x: T) => string | undefined) => {
    const m = new Map<string, T[]>();
    for (const x of xs) {
      const n = k(x);
      if (n === undefined) continue;
      const l = m.get(n);
      if (l) l.push(x);
      else m.set(n, [x]);
    }
    return m;
  };
  const synlige = [...s.roller.values()].filter((r) => synlig(s, r));
  const rollerPerOrg = grupper(synlige, (r) => r.org);
  const rollerPerPerson = grupper(synlige, (r) => r.person);
  const relasjoner = [...s.relasjoner.values()];
  const relFra = grupper(relasjoner, (r) => r.fra);
  const relTil = grupper(relasjoner, (r) => r.til);
  const ntPerOrg = grupper(s.nokkeltall.values(), (n) => n.org);
  const hendPerOrg = grupper(s.hendelser.values(), (h) => h.org);
  const hullPerOrg = grupper(s.hull.values(), (h) => h.gjelder);
  const segPerOrg = grupper(s.org_segment.values(), (x) => x.org);
  const barn = grupper(s.organisasjoner.values(), (o) => o.overordnet);

  /** Kravene som følger av en rad: kilden bak belegget og personene den nevner. */
  const kilde = (krav: Set<string>, b: Belegg) => krav.add(`kilde:${b.kilde}`);
  const org = (krav: Set<string>, key: string) => {
    krav.add(`org:${key}`);
    kilde(krav, s.organisasjoner.get(key)!.belegg);
  };
  const rolle = (krav: Set<string>, r: Rolleinnehav) => {
    krav.add(`rolle:${nokkel.rolle(r)}`);
    krav.add(`person:${r.person}`);
    kilde(krav, r.belegg);
  };
  const hendelse = (krav: Set<string>, h: SamletHendelse) => {
    krav.add(`hendelse:${nokkel.hendelse(h)}`);
    for (const p of h.personer ?? []) krav.add(`person:${p}`);
    kilde(krav, h.belegg);
  };

  /**
   * Nettverket holder ute en person med en synlig rolle i et sensitivt organ,
   * uansett hvor rollen står. For hver person som kan bli med, tas én slik
   * rolle med (den første), så delsamlingen vet det også.
   */
  const sensitivVitne = new Map<string, Rolleinnehav>();
  for (const [person, rs] of rollerPerPerson) {
    const vitne = rs
      .filter((r) => s.organisasjoner.get(r.org)!.sensitiv)
      .sort((a, b) => tekst(nokkel.rolle(a), nokkel.rolle(b)))[0];
    if (vitne) sensitivVitne.set(person, vitne);
  }

  // --- kommunene -----------------------------------------------------------------

  const kommune: Dataindeks["kommune"] = {};
  for (const k of s.kommuner) {
    const krav = new Set<string>();
    const o = new Set(k.organer);
    for (const key of k.organer) {
      org(krav, key);
      for (const r of rollerPerOrg.get(key) ?? []) {
        rolle(krav, r);
        const vitne = sensitivVitne.get(r.person);
        if (vitne && erAktiv(r) && !s.organisasjoner.get(r.org)!.sensitiv) {
          rolle(krav, vitne);
          org(krav, vitne.org);
        }
      }
      for (const r of relFra.get(key) ?? []) {
        if (!o.has(r.til)) continue;
        krav.add(`relasjon:${nokkel.relasjon(r)}`);
        kilde(krav, r.belegg);
      }
      for (const n of ntPerOrg.get(key) ?? []) {
        krav.add(`nokkeltall:${nokkel.nokkeltall(n)}`);
        kilde(krav, n.belegg);
      }
      for (const h of hendPerOrg.get(key) ?? []) hendelse(krav, h);
      for (const h of hullPerOrg.get(key) ?? []) krav.add(`hull:${nokkel.hull(h)}`);
      for (const x of segPerOrg.get(key) ?? []) krav.add(`org_segment:${nokkel.orgSegment(x)}`);
    }
    for (const h of s.hendelser.values()) {
      if (h.org === undefined && h.kommunenr === k.meta.kommunenr) hendelse(krav, h);
    }
    for (const p of k.prosesser) for (const st of p.steg) kilde(krav, st.belegg);
    const trenger = dekk(k.slug, krav);
    if (trenger.length > 1) kommune[k.slug] = trenger;
  }

  // --- organene ------------------------------------------------------------------

  const forsteFil = new Map<string, string>();
  for (const { slug, data } of filer) {
    for (const o of data.organisasjoner) if (!forsteFil.has(o.key)) forsteFil.set(o.key, slug);
  }
  const organ: Dataindeks["organ"] = {};
  for (const key of [...s.organisasjoner.keys()].sort(tekst)) {
    const o = s.organisasjoner.get(key)!;
    const krav = new Set<string>();
    org(krav, key);
    if (o.overordnet !== undefined) org(krav, o.overordnet);
    for (const c of barn.get(key) ?? []) org(krav, c.key);
    for (const r of rollerPerOrg.get(key) ?? []) rolle(krav, r);
    for (const r of [...(relFra.get(key) ?? []), ...(relTil.get(key) ?? [])]) {
      krav.add(`relasjon:${nokkel.relasjon(r)}`);
      kilde(krav, r.belegg);
      org(krav, r.fra === key ? r.til : r.fra);
    }
    for (const n of ntPerOrg.get(key) ?? []) {
      krav.add(`nokkeltall:${nokkel.nokkeltall(n)}`);
      kilde(krav, n.belegg);
    }
    for (const h of hendPerOrg.get(key) ?? []) hendelse(krav, h);
    for (const h of hullPerOrg.get(key) ?? []) krav.add(`hull:${nokkel.hull(h)}`);
    for (const x of segPerOrg.get(key) ?? []) krav.add(`org_segment:${nokkel.orgSegment(x)}`);
    const egen = forsteFil.get(key)!;
    const trenger = dekk(egen, krav);
    if (trenger.length > 1) organ[key] = trenger;
  }

  // --- fylkene -------------------------------------------------------------------

  const fylke: Dataindeks["fylke"] = {};
  for (const f of region?.fylker ?? []) {
    const nr = new Set(
      (region?.kommuner ?? []).filter((k) => k.fylkesnr === f.nr).map((k) => k.nr),
    );
    const omfang = new Set(
      s.kommuner.filter((k) => nr.has(k.meta.kommunenr)).flatMap((k) => k.organer),
    );
    const krav = new Set<string>();
    for (const o of s.organisasjoner.values()) {
      if (o.status !== "aktiv") continue;
      const egen =
        o.fylkesnr === f.nr ||
        (o.organtype === "statsforvalter" && o.kommunenr === undefined && omfang.has(o.key));
      if (egen) {
        org(krav, o.key);
        for (const r of rollerPerOrg.get(o.key) ?? []) if (erAktiv(r)) rolle(krav, r);
      }
      if (o.kommunenr !== undefined && nr.has(o.kommunenr)) {
        const omsetning = (ntPerOrg.get(o.key) ?? []).filter(
          (n) => n.type === "omsetning" && n.periode === undefined,
        );
        if (omsetning.length) {
          org(krav, o.key);
          for (const n of omsetning) {
            krav.add(`nokkeltall:${nokkel.nokkeltall(n)}`);
            kilde(krav, n.belegg);
          }
        }
      }
    }
    fylke[f.nr] = dekk(null, krav).sort(tekst);
  }

  return {
    versjon: 1,
    datasett: filer.map(({ slug, data }) => ({
      slug,
      avtrykk: avtrykk(data),
      meta: data.meta,
      organer: data.organisasjoner.map((o) => o.key),
    })),
    segmenter: [...s.segmenter.values()].sort((a, b) => tekst(a.kode, b.kode)),
    kommune,
    organ,
    fylke,
    aggregater: lagLokal(s, { region }).beregnAggregater(),
  };
}

/**
 * Indeksen som tekst: én linje per oppføring, så en endring i ett datasett gir
 * en diff på de linjene det gjelder, og ikke en ny fil.
 */
export function skrivIndeks(ix: Dataindeks): string {
  const inn = (n: number) => " ".repeat(n);
  const blokk = (o: Record<string, unknown>, n: number) => {
    const k = Object.keys(o).sort(tekst);
    if (!k.length) return "{}";
    const linjer = k.map((x) => `${inn(n + 2)}${JSON.stringify(x)}: ${JSON.stringify(o[x])}`);
    return `{\n${linjer.join(",\n")}\n${inn(n)}}`;
  };
  const liste = (xs: unknown[], n: number) =>
    xs.length
      ? `[\n${xs.map((x) => `${inn(n + 2)}${JSON.stringify(x)}`).join(",\n")}\n${inn(n)}]`
      : "[]";
  return [
    "{",
    `  "versjon": ${ix.versjon},`,
    `  "datasett": ${liste(ix.datasett, 2)},`,
    `  "segmenter": ${liste(ix.segmenter, 2)},`,
    `  "kommune": ${blokk(ix.kommune, 2)},`,
    `  "organ": ${blokk(ix.organ, 2)},`,
    `  "fylke": ${blokk(ix.fylke, 2)},`,
    `  "aggregater": {`,
    `    "kommuner": ${blokk(ix.aggregater.kommuner, 4)},`,
    `    "fylker": ${blokk(ix.aggregater.fylker, 4)}`,
    "  }",
    "}",
    "",
  ].join("\n");
}
