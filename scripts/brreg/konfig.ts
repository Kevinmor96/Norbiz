// Konfigurasjonen og tabellene Brreg-importen styres av.
//
//   scripts/brreg.config.json         terskler, alltid-med-lister, koblinger
//   src/data/brreg/nace-segment.json  SN2025-kode → Maktkart-segment
//   src/data/brreg/orgform.json       organisasjonsform → nivå og organtype
//
// Tabellene ligger i en undermappe av src/data og ikke i src/data selv: alle
// src/data/*.json leses som kommunedatasett av lokal.ts og seed-byggeren.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Nivaa, Organtype, Segment } from "../../src/data/types";
import { NIVAAER, ORGANTYPER } from "../../src/lib/data/kontrakt";

export const ROT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const KONFIGFIL = join(ROT, "scripts", "brreg.config.json");
export const NACEFIL = join(ROT, "src", "data", "brreg", "nace-segment.json");
export const ORGFORMFIL = join(ROT, "src", "data", "brreg", "orgform.json");

/** Brreg svarer HTTP 400 under dette, og feilen kommer som en tom liste. */
export const MIN_TERSKEL = 5;

export interface Felleskonfig {
  sidestorrelse: number;
  /** Minste tid mellom to kall mot Brreg. 220 ms gir under fem kall i sekundet. */
  min_intervall_ms: number;
  /** Organisasjonsformene det spørres etter årsregnskap for. */
  regnskap_orgformer: string[];
  sensitiv_navn: { monster: string; organtype: Organtype }[];
  sensitiv_naering: { prefiks: string; krav: string; organtype: Organtype }[];
  /** Ord i organnavn som skal skrives slik, ikke med stor forbokstav. */
  navneformer: Record<string, string>;
}

export interface Kommunekonfig {
  kommunenr: string;
  /** `fraAntallAnsatte` for enheter. Minst 5, se MIN_TERSKEL. */
  terskel_ansatte: number;
  terskel_underenheter: number;
  /** Hent roller også for overordnede enheter utenfor kommunen (nasjonale styrer). */
  roller_for_overordnede: boolean;
  /** Slå opp grunnlagets organer uten orgnr på navn, og koble ved eksakt treff. */
  navnesok_for_grunnlaget: boolean;
  alltid: {
    /** Ta med hvert orgnr som allerede står i kommunens datasett. */
    fra_datasett: boolean;
    orgnr: string[];
    navn: { navn: string; organisasjonsform?: string }[];
  };
  /** `Organisasjon.key` i grunnlaget → orgnr, når navnet ikke er nok. */
  koblinger: Record<string, string>;
  /** Importert personnøkkel → personnøkkel i grunnlaget, etter menneskelig vurdering. */
  samme_person: Record<string, string>;
}

export interface Konfig {
  felles: Felleskonfig;
  kommuner: Record<string, Kommunekonfig>;
}

export interface OrgformRegel {
  nivaa: Nivaa;
  organtype: Organtype;
  nivaa_fra_sektor?: Record<string, Nivaa>;
  organtype_fra_navn?: { suffiks: string; organtype: Organtype }[];
}

export interface OrgformTabell {
  former: Record<string, OrgformRegel>;
  hoppes_over: Record<string, string>;
}

export interface NaeringRegel {
  prefiks: string;
  tittel: string;
  kontrollert: boolean;
  krav: string;
  segment: string;
}

export interface NaeringTabell {
  standard: string;
  segmenter: Segment[];
  koder: NaeringRegel[];
}

export interface Tabeller {
  naering: NaeringTabell;
  orgform: OrgformTabell;
}

const feil = (hvor: string, hva: string): never => {
  throw new Error(`${hvor}: ${hva}`);
};

function kommune(nr: string, k: Partial<Kommunekonfig>): Kommunekonfig {
  const hvor = `brreg.config.json kommuner.${nr}`;
  if (!/^\d{4}$/.test(nr)) feil(hvor, "kommunenummeret må ha fire siffer");
  const terskel = k.terskel_ansatte ?? 20;
  const terskelU = k.terskel_underenheter ?? terskel;
  for (const [navn, t] of [
    ["terskel_ansatte", terskel],
    ["terskel_underenheter", terskelU],
  ] as const) {
    if (!Number.isInteger(t) || t < MIN_TERSKEL) {
      feil(
        hvor,
        `${navn} må være et heltall på minst ${MIN_TERSKEL}. Brreg svarer HTTP 400 under det, og feilen kommer som en tom liste.`,
      );
    }
  }
  const alltid = k.alltid ?? { fra_datasett: true, orgnr: [], navn: [] };
  for (const o of alltid.orgnr) if (!/^\d{9}$/.test(o)) feil(hvor, `ugyldig orgnr «${o}»`);
  for (const o of Object.values(k.koblinger ?? {}))
    if (!/^\d{9}$/.test(o)) feil(hvor, `ugyldig orgnr «${o}» i koblinger`);
  return {
    kommunenr: nr,
    terskel_ansatte: terskel,
    terskel_underenheter: terskelU,
    roller_for_overordnede: k.roller_for_overordnede ?? false,
    navnesok_for_grunnlaget: k.navnesok_for_grunnlaget ?? true,
    alltid: {
      fra_datasett: alltid.fra_datasett ?? true,
      orgnr: [...(alltid.orgnr ?? [])],
      navn: [...(alltid.navn ?? [])],
    },
    koblinger: { ...(k.koblinger ?? {}) },
    samme_person: { ...(k.samme_person ?? {}) },
  };
}

/** Leser og sjekker konfigurasjonen. Kaster med en forklaring ved feil. */
export function tolkKonfig(json: unknown): Konfig {
  const o = json as { felles?: Partial<Felleskonfig>; kommuner?: Record<string, unknown> };
  const f = o.felles ?? {};
  const felles: Felleskonfig = {
    sidestorrelse: f.sidestorrelse ?? 200,
    min_intervall_ms: f.min_intervall_ms ?? 220,
    regnskap_orgformer: f.regnskap_orgformer ?? [],
    sensitiv_navn: f.sensitiv_navn ?? [],
    sensitiv_naering: f.sensitiv_naering ?? [],
    navneformer: f.navneformer ?? {},
  };
  if (felles.sidestorrelse < 1 || felles.sidestorrelse > 10_000)
    feil("brreg.config.json felles", "sidestorrelse må være 1–10 000");
  for (const r of [...felles.sensitiv_navn, ...felles.sensitiv_naering]) {
    if (!(ORGANTYPER as readonly string[]).includes(r.organtype))
      feil("brreg.config.json felles", `ukjent organtype «${r.organtype}»`);
  }
  const kommuner: Record<string, Kommunekonfig> = {};
  for (const [nr, k] of Object.entries(o.kommuner ?? {}))
    kommuner[nr] = kommune(nr, k as Partial<Kommunekonfig>);
  return { felles, kommuner };
}

export function tolkTabeller(naering: unknown, orgform: unknown): Tabeller {
  const n = naering as NaeringTabell;
  const f = orgform as OrgformTabell;
  const segmenter = new Set(n.segmenter.map((s) => s.kode));
  for (const r of n.koder) {
    if (!segmenter.has(r.segment)) feil("nace-segment.json", `ukjent segment «${r.segment}»`);
    if (!/^\d{2}(\.\d{1,3})?$/.test(r.prefiks))
      feil("nace-segment.json", `ugyldig prefiks «${r.prefiks}»`);
  }
  for (const [kode, r] of Object.entries(f.former)) {
    if (!(NIVAAER as readonly string[]).includes(r.nivaa))
      feil("orgform.json", `${kode}: ukjent nivå «${r.nivaa}»`);
    if (!(ORGANTYPER as readonly string[]).includes(r.organtype))
      feil("orgform.json", `${kode}: ukjent organtype «${r.organtype}»`);
  }
  return { naering: n, orgform: f };
}

const lesJson = (fil: string): unknown => JSON.parse(readFileSync(fil, "utf8"));

export const lesKonfig = (fil = KONFIGFIL): Konfig => tolkKonfig(lesJson(fil));
export const lesTabeller = (): Tabeller => tolkTabeller(lesJson(NACEFIL), lesJson(ORGFORMFIL));

/**
 * Segmentet en næringskode gir, eller `null`. Lengste prefiks vinner, og
 * Brregs tittel på koden må matche `krav`. `avvik` er satt når prefikset
 * traff, men tittelen ikke gjorde det: da har koden trolig skiftet betydning.
 */
export function segmentFor(
  kode: string,
  tittel: string,
  tabell: NaeringTabell,
): { segment: string | null; avvik: NaeringRegel | null } {
  const treff = tabell.koder
    .filter((r) => kode === r.prefiks || kode.startsWith(`${r.prefiks}`))
    .filter((r) => {
      // «35.1» skal treffe 35.150, ikke 35.2xx; «03» skal ikke treffe 30.1.
      const rest = kode.slice(r.prefiks.length);
      return rest === "" || /^[.\d]/.test(rest);
    })
    .sort((a, b) => b.prefiks.length - a.prefiks.length);
  const regel = treff[0];
  if (!regel) return { segment: null, avvik: null };
  if (new RegExp(regel.krav, "i").test(tittel.toLocaleLowerCase("nb"))) {
    return { segment: regel.segment, avvik: null };
  }
  return { segment: null, avvik: regel };
}
