// Lesekontrakten implementert i TypeScript over kommunedatasettene.
//
// Dette er datalaget siden bruker nå. Supabase-RPC-ene i
// `supabase/migrations/` gjør det samme i SQL, og `tests/kontrakt.test.ts`
// krever at svarene er like, felt for felt. Endres en regel her, må den
// endres likt i SQL-en.
//
// Ingen React, ingen klokke, ingen tilfeldighet. Alle lister har fast
// rekkefølge (se `kontrakt.ts`).
//
// Fila regner bare. Hvilke datasett som lastes, og når, bestemmer
// `datasett.ts` (latt, per kommune) med `lat.ts` og indeksen i `indeks.ts`.
// `lagLokal` gir samme svar over en del av samlingen som over hele, så lenge
// delen har det svaret trenger. Indeksen sier hva det er, og
// `tests/lat.test.ts` sjekker det for hver kommune, hvert organ og hvert fylke.

import type { Regionregister } from "../../data/region/types";
import type {
  Belegg,
  Hull,
  Nokkeltall,
  Organisasjon,
  Relasjon,
  Rolleinnehav,
} from "../../data/types";
import {
  HENDELSESTYPER,
  IKKE_SKJEDD_TYPER,
  LEDERTYPER,
  MAKS_EIERLEDD,
  NIVAAER,
  NOKKELTALLTYPER,
  ORGANTYPER,
  RELASJONSTYPER,
  ROLLESTATUSER,
  ROLLETYPER,
  SENSITIV_SYNLIGE_ROLLETYPER,
  SISTE_ENDRINGER,
  STORSTE_VIRKSOMHETER,
  type BeleggUt,
  type Beslutningskjede,
  type Datalag,
  type Eierandel,
  type Datasettdekning,
  type Eierskap,
  type Endring,
  type Endringer,
  type FylkeOrgan,
  type FylkeOversikt,
  type Grader,
  type Gradtelling,
  type HullPunkt,
  type KildeUt,
  type Kommune,
  type KommuneOversikt,
  type Nettverk,
  type NokkeltallUt,
  type Organ,
  type OrganKort,
  type Organkart,
  type OrganProfil,
  type OrganRef,
  type PersonRef,
  type RegionFylke,
  type RegionKommune,
  type RegionOversikt,
  type RelasjonUt,
  type Rolle,
  type RolleIOrgan,
  type SegmentOrganer,
} from "./kontrakt";
import { nokkel, type KommuneIDatasett, type SamletHendelse, type Samling } from "./samle";
import { sokI, type Sokegrunnlag } from "./sok";

// ---------------------------------------------------------------------------
// Sortering. Tekst sammenlignes på kodeenhet, som tilsvarer `collate "C"`.
// ---------------------------------------------------------------------------

type Cmp<T> = (a: T, b: T) => number;

const tekst: Cmp<string> = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const tall: Cmp<number> = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const synkende =
  <T>(c: Cmp<T>): Cmp<T> =>
  (a, b) =>
    c(b, a);
/** `null` først, som `nulls first` i Postgres. */
const nullForst =
  <T>(c: Cmp<T>): Cmp<T | null | undefined> =>
  (a, b) =>
    a == null ? (b == null ? 0 : -1) : b == null ? 1 : c(a, b);
/** `null` sist, som `nulls last` i Postgres. */
const nullSist =
  <T>(c: Cmp<T>): Cmp<T | null | undefined> =>
  (a, b) =>
    a == null ? (b == null ? 0 : 1) : b == null ? -1 : c(a, b);
/** Rekkefølgen i en verdiliste, som `order by <enum>` i Postgres. */
function rang<T>(liste: readonly T[]): Cmp<T> {
  const plass = new Map(liste.map((v, i) => [v, i] as const));
  return (a, b) => (plass.get(a) ?? -1) - (plass.get(b) ?? -1);
}
function etter<T>(...ledd: Cmp<T>[]): Cmp<T> {
  return (a, b) => {
    for (const c of ledd) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}
const på =
  <T, V>(f: (x: T) => V, c: Cmp<V>): Cmp<T> =>
  (a, b) =>
    c(f(a), f(b));
const sortert = <T>(xs: Iterable<T>, c: Cmp<T>): T[] => [...xs].sort(c);

const rolletype = rang(ROLLETYPER);
const rollestatus = rang(ROLLESTATUSER);
const nokkeltalltype = rang(NOKKELTALLTYPER);
const hendelsestype = rang(HENDELSESTYPER);
const relasjonstype = rang(RELASJONSTYPER);
const nivaa = rang(NIVAAER);
const organtype = rang(ORGANTYPER);
const konsern = nullForst<boolean>((a, b) => Number(a) - Number(b));

const rolleSortering: Cmp<Rolleinnehav> = etter(
  på((r) => r.rolletype, rolletype),
  på((r) => r.status, rollestatus),
  på((r) => r.person, tekst),
  på((r) => r.fra, nullForst(tekst)),
);
const tidligereRolleSortering: Cmp<Rolleinnehav> = etter(
  på((r) => r.til, nullForst(synkende(tekst))),
  på((r) => r.rolletype, rolletype),
  på((r) => r.person, tekst),
  på((r) => r.fra, nullForst(tekst)),
);
const nokkeltallSortering: Cmp<Nokkeltall> = etter(
  på((n) => n.aar, synkende(tall)),
  på((n) => n.type, nokkeltalltype),
  på((n) => n.periode, nullForst(tekst)),
  på((n) => n.konsern, konsern),
);
const skjeddSortering: Cmp<SamletHendelse> = etter(
  på((h) => h.dato, synkende(tekst)),
  på((h) => h.type, hendelsestype),
  på((h) => h.tittel, tekst),
);
const ikkeSkjeddSortering: Cmp<SamletHendelse> = etter(
  på((h) => h.dato, tekst),
  på((h) => h.type, hendelsestype),
  på((h) => h.tittel, tekst),
);

// ---------------------------------------------------------------------------
// Implementasjonen
// ---------------------------------------------------------------------------

const erLeder = (t: string) => (LEDERTYPER as readonly string[]).includes(t);
/**
 * En rolle er aktiv når den ikke er avsluttet og registeret ikke har motsagt
 * den. En motsagt rolle står i historikken, uten `til`: vi vet ikke når den
 * eventuelt sluttet. Samme regel som `intern.er_aktiv` i basen.
 */
const erAktiv = (r: Rolleinnehav) => r.til === undefined && r.motsagt !== true;
const erSkjedd = (t: string) => !(IKKE_SKJEDD_TYPER as readonly string[]).includes(t);

/** Det kommunesiden og fylkessidene teller, per kommune og per fylke. */
export interface Fylkeaggregat {
  kartlagt: number;
  dekning: RegionFylke["dekning"];
  grader: Grader;
}
export interface Aggregater {
  /** Nøkkel: kommunenummer. Én per datasett. */
  kommuner: Record<string, Datasettdekning>;
  /** Nøkkel: fylkesnummer. Ett per fylke i regionregisteret. */
  fylker: Record<string, Fylkeaggregat>;
}

export interface LokalValg {
  /** Regionregisteret (src/data/region/nord-norge.json). Uten det er regionen tom. */
  region?: Regionregister | null;
  /**
   * Tallene per kommune og fylke, ferdig regnet over hele samlingen. Den late
   * implementasjonen gir dem fra indeksen, fordi en del av samlingen ikke kan
   * regne dem. Utelatt: regnet her, over `s`.
   */
  aggregater?: Aggregater;
}

export interface LokalDatalag extends Datalag {
  /** Tallene `region_oversikt` og `fylke_oversikt` bygger på, regnet over `s`. */
  beregnAggregater(): Aggregater;
  /**
   * Det søket leter i. Den statiske eksporten skriver det til
   * /data/sokeindeks.json, og nettleseren søker i det med `sokI` (sok.ts).
   */
  sokegrunnlag(): Sokegrunnlag;
}

/** ASCII-kebab, samme regel som sluggene i regionregisteret: æ→ae, ø→o, å→a. */
export function lagSlug(navn: string): string {
  return navn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Grupperer en liste på en nøkkel. Rekkefølgen i hver gruppe er listens. */
function grupper<T>(xs: Iterable<T>, nokkelFor: (x: T) => string | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = nokkelFor(x);
    if (k === undefined) continue;
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/** Lager datalaget over en samling. Eksportert for tester. */
export function lagLokal(s: Samling, valg: LokalValg = {}): LokalDatalag {
  const org = (key: string): Organisasjon => {
    const o = s.organisasjoner.get(key);
    if (!o) throw new Error(`Ukjent organisasjon «${key}»`);
    return o;
  };

  // Samme regel som RLS-policyen på rolleinnehav: i sensitive organer er bare
  // toppledere synlige.
  const synligeRoller = [...s.roller.values()].filter(
    (r) =>
      !org(r.org).sensitiv ||
      (SENSITIV_SYNLIGE_ROLLETYPER as readonly string[]).includes(r.rolletype),
  );
  const relasjoner = [...s.relasjoner.values()];
  const nokkeltall = [...s.nokkeltall.values()];
  const hendelser = [...s.hendelser.values()];
  const hull = [...s.hull.values()];
  const orgSegment = [...s.org_segment.values()];

  const kommuneAvNr = new Map(s.kommuner.map((k) => [k.meta.kommunenr, k]));
  const omfang = new Map(s.kommuner.map((k) => [k.meta.kommunenr, new Set(k.organer)]));

  // Oppslag per organ. Med hele regionen i én samling er det tusenvis av
  // organer, og et filter over alle rollene per organ ble for tregt.
  const rollerPerOrg = grupper(synligeRoller, (r) => r.org);
  const relasjonerFra = grupper(relasjoner, (r) => r.fra);
  const relasjonerTil = grupper(relasjoner, (r) => r.til);
  const nokkeltallPerOrg = grupper(nokkeltall, (n) => n.org);
  const hendelserPerOrg = grupper(hendelser, (h) => h.org);
  const hullPerOrg = grupper(hull, (h) => h.gjelder);
  const segmenterPerOrg = grupper(orgSegment, (x) => x.org);
  const underordnede = grupper(s.organisasjoner.values(), (o) => o.overordnet);

  // --- byggesteiner --------------------------------------------------------

  const kildeUt = (key: string): KildeUt => {
    const k = s.kilder.get(key);
    if (!k) throw new Error(`Ukjent kilde «${key}»`);
    return { key: k.key, navn: k.navn, url: k.url ?? null, type: k.type, lisens: k.lisens ?? null };
  };
  const beleggUt = (b: Belegg): BeleggUt => ({
    kilde: kildeUt(b.kilde),
    verifisering: b.verifisering,
    per: b.per ?? null,
    merknad: b.merknad ?? null,
    // Datasettet har ingen egen kolonne for når påstanden ble hentet. Bare
    // pipelinen (scripts/brreg.ts) setter `verifisert`, og da med hentedatoen i
    // `per`. Seed-en skriver den som `hentet` kl. 00:00 UTC, og dette er formen
    // Postgres gir en timestamptz i jsonb når tidssonen er UTC (Supabase, PGlite).
    hentet: b.verifisering === "verifisert" && b.per ? `${b.per}T00:00:00+00:00` : null,
  });
  const organRef = (key: string): OrganRef => {
    const o = org(key);
    return {
      key: o.key,
      navn: o.navn,
      kortnavn: o.kortnavn ?? null,
      nivaa: o.nivaa,
      organtype: o.organtype,
      status: o.status,
      sensitiv: o.sensitiv,
    };
  };
  const organ = (key: string): Organ => {
    const o = org(key);
    return {
      ...organRef(key),
      orgnr: o.orgnr ?? null,
      overordnet: o.overordnet ?? null,
      kommunenr: o.kommunenr ?? null,
      fylkesnr: o.fylkesnr ?? null,
      rekkevidde: o.rekkevidde ?? null,
      myndighet: [...o.myndighet],
      antall_medlemmer: o.antall_medlemmer ?? null,
      gyldig_fra: o.gyldig_fra ?? null,
      gyldig_til: o.gyldig_til ?? null,
      beskrivelse: o.beskrivelse,
      belegg: beleggUt(o.belegg),
    };
  };
  const personRef = (key: string): PersonRef => {
    const p = s.personer.get(key);
    if (!p) throw new Error(`Ukjent person «${key}»`);
    return { key: p.key, navn: p.navn };
  };
  const rolle = (r: Rolleinnehav): Rolle => ({
    person: personRef(r.person),
    tittel: r.tittel,
    rolletype: r.rolletype,
    status: r.status,
    parti: r.parti ?? null,
    fra: r.fra ?? null,
    til: r.til ?? null,
    til_forventet: r.til_forventet ?? null,
    motsagt: r.motsagt === true,
    belegg: beleggUt(r.belegg),
  });
  const rolleIOrgan = (r: Rolleinnehav): RolleIOrgan => ({ ...rolle(r), org: organRef(r.org) });
  const nokkeltallUt = (n: Nokkeltall): NokkeltallUt => ({
    aar: n.aar,
    periode: n.periode ?? null,
    type: n.type,
    verdi: n.verdi,
    enhet: n.enhet,
    konsern: n.konsern ?? null,
    belegg: beleggUt(n.belegg),
  });
  const endring = (h: SamletHendelse): Endring => ({
    dato: h.dato,
    presisjon: h.presisjon,
    type: h.type,
    skjedd: erSkjedd(h.type),
    tittel: h.tittel,
    tekst: h.tekst ?? null,
    org: h.org === undefined ? null : organRef(h.org),
    personer: (h.personer ?? []).map(personRef),
    belegg: beleggUt(h.belegg),
  });
  const hullPunkt = (h: Hull): HullPunkt => ({
    gjelder: organRef(h.gjelder),
    hva: h.hva,
    hvorfor: h.hvorfor,
  });
  /** `annen` er enden av relasjonen som ikke er organet vi ser fra. */
  const eierandel = (r: Relasjon, annen: string): Eierandel => ({
    org: organRef(annen),
    andel: r.andel ?? null,
    belop_nok: r.belop_nok ?? null,
    fra_dato: r.fra_dato ?? null,
    til_dato: r.til_dato ?? null,
    belegg: beleggUt(r.belegg),
  });
  const eierandelSortering: Cmp<Eierandel> = etter(
    på((e) => e.andel, nullSist(synkende(tall))),
    på((e) => e.org.key, tekst),
    på((e) => e.fra_dato, nullForst(tekst)),
  );
  const kommune = (k: KommuneIDatasett): Kommune => ({
    kommunenr: k.meta.kommunenr,
    navn: k.meta.kommune,
    slug: k.slug,
    fylkesnr: k.meta.fylkesnr,
    fylke: k.meta.fylke,
    sammenstilt: k.meta.sammenstilt,
  });
  const ledere = (orgKey: string): Rolle[] =>
    sortert(
      (rollerPerOrg.get(orgKey) ?? []).filter((r) => erAktiv(r) && erLeder(r.rolletype)),
      rolleSortering,
    ).map(rolle);

  // --- kommunens omfang ----------------------------------------------------

  function iKommune(kommunenr: string) {
    const k = kommuneAvNr.get(kommunenr);
    const o = omfang.get(kommunenr);
    if (!k || !o) return null;
    const roller = synligeRoller.filter((r) => o.has(r.org));
    const rel = relasjoner.filter((r) => o.has(r.fra) && o.has(r.til));
    const nt = nokkeltall.filter((n) => o.has(n.org));
    const hend = hendelser.filter((h) =>
      h.org === undefined ? h.kommunenr === kommunenr : o.has(h.org),
    );
    const hul = hull.filter((h) => o.has(h.gjelder));
    const belegg: Belegg[] = [
      ...k.organer.map((key) => org(key).belegg),
      ...roller.map((r) => r.belegg),
      ...rel.map((r) => r.belegg),
      ...nt.map((n) => n.belegg),
      ...hend.map((h) => h.belegg),
      ...k.prosesser.flatMap((p) => p.steg.map((st) => st.belegg)),
    ];
    const kommuneorgan =
      sortert(
        k.organer.filter(
          (key) => org(key).organtype === "kommune" && org(key).kommunenr === kommunenr,
        ),
        tekst,
      )[0] ?? null;
    return { k, o, roller, rel, nt, hend, hul, belegg, kommuneorgan };
  }

  /** Ordfører og kommunedirektør: aktive toppverv i organer med kommunens nummer. */
  const kommunensLedere = (km: NonNullable<ReturnType<typeof iKommune>>, kommunenr: string) =>
    km.roller.filter(
      (r) =>
        erAktiv(r) &&
        (r.rolletype === "politisk_leder" || r.rolletype === "toppleder") &&
        org(r.org).kommunenr === kommunenr,
    );

  function endringer(kommunenr: string): Endringer | null {
    const km = iKommune(kommunenr);
    if (!km) return null;
    return {
      skjedd: sortert(
        km.hend.filter((h) => erSkjedd(h.type)),
        skjeddSortering,
      ).map(endring),
      ikke_skjedd: sortert(
        km.hend.filter((h) => !erSkjedd(h.type)),
        ikkeSkjeddSortering,
      ).map(endring),
    };
  }

  // --- RPC-ene -------------------------------------------------------------

  function kommune_oversikt(kommunenr: string): KommuneOversikt | null {
    const km = iKommune(kommunenr);
    if (!km) return null;
    const { k, o, kommuneorgan } = km;

    const styret = kommuneorgan
      ? (sortert(
          k.organer.filter((key) => {
            const x = org(key);
            return (
              x.organtype === "folkevalgt_organ" &&
              x.overordnet === kommuneorgan &&
              x.status === "aktiv"
            );
          }),
          tekst,
        )[0] ?? null)
      : null;

    const eierrel = km.rel.filter(
      (r) => r.type === "eier" && r.fra === kommuneorgan && r.til_dato === undefined,
    );

    const perKilde = new Map<string, number>();
    const perGrad = { verifisert: 0, oppgitt: 0, maa_verifiseres: 0 };
    for (const b of km.belegg) {
      perKilde.set(b.kilde, (perKilde.get(b.kilde) ?? 0) + 1);
      perGrad[b.verifisering] += 1;
    }

    return {
      kommune: { ...kommune(k), grunnlag: k.meta.grunnlag, merknad: k.meta.merknad },
      kommuneorgan: kommuneorgan ? organRef(kommuneorgan) : null,
      kommunestyre: styret
        ? {
            org: organRef(styret),
            antall_medlemmer: org(styret).antall_medlemmer ?? null,
            belegg: beleggUt(org(styret).belegg),
          }
        : null,
      ledere: sortert(
        kommunensLedere(km, kommunenr),
        etter(
          på((r) => r.rolletype, rolletype),
          på((r) => r.org, tekst),
          på((r) => r.status, rollestatus),
          på((r) => r.person, tekst),
        ),
      ).map(rolleIOrgan),
      eierskap: {
        direkte: new Set(eierrel.map((r) => r.til)).size,
        heleide: new Set(eierrel.filter((r) => r.andel === 100).map((r) => r.til)).size,
      },
      utbytte: sortert(
        eierrel.filter((r) => r.belop_nok !== undefined),
        etter(
          på((r) => r.belop_nok ?? 0, synkende(tall)),
          på((r) => r.til, tekst),
        ),
      ).map((r) => ({
        selskap: organRef(r.til),
        belop_nok: r.belop_nok ?? 0,
        belegg: beleggUt(r.belegg),
      })),
      siste_endringer: (endringer(kommunenr)?.skjedd ?? []).slice(0, SISTE_ENDRINGER),
      prosesser: sortert(
        k.prosesser,
        på((p) => p.key, tekst),
      ).map((p) => ({
        key: p.key,
        tittel: p.tittel,
        sporsmal: p.sporsmal,
        antall_steg: p.steg.length,
      })),
      segmenter: sortert(
        s.segmenter.values(),
        på((x) => x.kode, tekst),
      ).map((seg) => ({
        kode: seg.kode,
        navn: seg.navn,
        antall_organer: new Set(
          orgSegment
            .filter((x) => x.segment === seg.kode && o.has(x.org) && org(x.org).status === "aktiv")
            .map((x) => x.org),
        ).size,
      })),
      dekning: {
        organer: o.size,
        roller: km.roller.length,
        personer: new Set(km.roller.map((r) => r.person)).size,
        relasjoner: km.rel.length,
        nokkeltall: km.nt.length,
        hendelser: km.hend.length,
        prosesser: k.prosesser.length,
        hull: km.hul.length,
        kilder: perKilde.size,
      },
      verifisering: perGrad,
      kilder: sortert(
        perKilde,
        etter(
          på(([, n]) => n, synkende(tall)),
          på(([key]) => key, tekst),
        ),
      ).map(([key, antall]) => ({ kilde: kildeUt(key), antall })),
    };
  }

  function beslutningskjede(kommunenr: string, prosessKey: string): Beslutningskjede | null {
    const k = kommuneAvNr.get(kommunenr);
    const p = k?.prosesser.find((x) => x.key === prosessKey);
    if (!p) return null;
    return {
      prosess: { key: p.key, tittel: p.tittel, sporsmal: p.sporsmal },
      steg: p.steg.map((st, i) => ({
        nr: i + 1,
        org: organRef(st.org),
        myndighet: st.myndighet,
        hva: st.hva,
        belegg: beleggUt(st.belegg),
        ledere: ledere(st.org),
      })),
    };
  }

  function organkart(kommunenr: string): Organkart | null {
    const k = kommuneAvNr.get(kommunenr);
    if (!k) return null;
    const aktive = sortert(
      k.organer.filter((key) => org(key).status === "aktiv"),
      etter(
        på((key) => org(key).nivaa, nivaa),
        på((key) => org(key).organtype, organtype),
        på((key) => key, tekst),
      ),
    );
    const grupper: Organkart["grupper"] = [];
    for (const key of aktive) {
      const kort: OrganKort = { ...organ(key), ledere: ledere(key) };
      const siste = grupper[grupper.length - 1];
      if (siste && siste.nivaa === kort.nivaa) siste.organer.push(kort);
      else grupper.push({ nivaa: kort.nivaa, organer: [kort] });
    }
    return { grupper };
  }

  function organ_profil(orgKey: string): OrganProfil | null {
    const o = s.organisasjoner.get(orgKey);
    if (!o) return null;

    const roller = rollerPerOrg.get(orgKey) ?? [];
    const inn = relasjonerTil.get(orgKey) ?? [];
    const ut = relasjonerFra.get(orgKey) ?? [];
    const nt = nokkeltallPerOrg.get(orgKey) ?? [];
    const hend = hendelserPerOrg.get(orgKey) ?? [];

    const relasjonUt = (r: Relasjon, retning: "ut" | "inn"): RelasjonUt => ({
      ...eierandel(r, retning === "ut" ? r.til : r.fra),
      retning,
      type: r.type,
    });

    const kilder = new Set<string>([
      o.belegg.kilde,
      ...roller.map((r) => r.belegg.kilde),
      ...inn.map((r) => r.belegg.kilde),
      ...ut.map((r) => r.belegg.kilde),
      ...nt.map((n) => n.belegg.kilde),
      ...hend.map((h) => h.belegg.kilde),
    ]);

    return {
      organ: {
        ...organ(orgKey),
        segmenter: sortert(
          segmenterPerOrg.get(orgKey) ?? [],
          etter(
            på((x) => x.styrke, synkende(tall)),
            på((x) => x.segment, tekst),
          ),
        ).map((x) => {
          const seg = s.segmenter.get(x.segment);
          if (!seg) throw new Error(`Ukjent segment «${x.segment}»`);
          return { kode: seg.kode, navn: seg.navn, styrke: x.styrke };
        }),
      },
      overordnet: o.overordnet === undefined ? null : organRef(o.overordnet),
      underordnede: sortert(
        (underordnede.get(orgKey) ?? []).map((x) => x.key),
        tekst,
      ).map(organRef),
      roller: {
        naa: sortert(roller.filter(erAktiv), rolleSortering).map(rolle),
        tidligere: sortert(
          roller.filter((r) => !erAktiv(r)),
          tidligereRolleSortering,
        ).map(rolle),
      },
      eiere: sortert(
        inn.filter((r) => r.type === "eier").map((r) => eierandel(r, r.fra)),
        eierandelSortering,
      ),
      eierandeler: sortert(
        ut.filter((r) => r.type === "eier").map((r) => eierandel(r, r.til)),
        eierandelSortering,
      ),
      relasjoner: sortert(
        [
          ...ut.filter((r) => r.type !== "eier").map((r) => relasjonUt(r, "ut")),
          ...inn.filter((r) => r.type !== "eier").map((r) => relasjonUt(r, "inn")),
        ],
        etter(
          på((r) => r.type, relasjonstype),
          på((r) => r.retning, rang(["ut", "inn"] as const)),
          på((r) => r.org.key, tekst),
          på((r) => r.fra_dato, nullForst(tekst)),
        ),
      ),
      nokkeltall: sortert(nt, nokkeltallSortering).map(nokkeltallUt),
      hendelser: sortert(hend, skjeddSortering).map(endring),
      hull: sortert(
        hullPerOrg.get(orgKey) ?? [],
        på((h) => h.hva, tekst),
      ).map(hullPunkt),
      kilder: sortert(kilder, tekst).map(kildeUt),
      kommuner: s.kommuner.filter((k) => k.organer.includes(orgKey)).map(kommune),
    };
  }

  function eierskap(kommunenr: string): Eierskap | null {
    const km = iKommune(kommunenr);
    if (!km) return null;
    const { kommuneorgan } = km;
    if (!kommuneorgan) return { eier: null, selskaper: [], utbytte: [] };

    const eierrel = km.rel.filter((r) => r.type === "eier" && r.til_dato === undefined);

    // Bredde først gir korteste vei. Samme grense som den rekursive CTE-en.
    const ledd = new Map<string, number>([[kommuneorgan, 0]]);
    let front = [kommuneorgan];
    for (let d = 1; d <= MAKS_EIERLEDD && front.length > 0; d++) {
      const neste: string[] = [];
      for (const r of eierrel) {
        if (front.includes(r.fra) && !ledd.has(r.til)) {
          ledd.set(r.til, d);
          neste.push(r.til);
        }
      }
      front = neste;
    }
    ledd.delete(kommuneorgan);

    const eiereAv = (key: string) =>
      sortert(
        eierrel.filter((r) => r.til === key).map((r) => eierandel(r, r.fra)),
        eierandelSortering,
      );
    const tallFor = (key: string) =>
      sortert(
        km.nt.filter((n) => n.org === key),
        nokkeltallSortering,
      );

    const selskaper = sortert(
      ledd,
      etter(
        på(([, d]) => d, tall),
        på(([key]) => key, tekst),
      ),
    ).map(([key, d]) => ({
      org: organRef(key),
      ledd: d,
      eiere: eiereAv(key),
      nokkeltall: tallFor(key).map(nokkeltallUt),
    }));

    const utbytte = sortert(ledd.keys(), tekst)
      .map((key) => {
        const total = tallFor(key).find((n) => n.type === "utbytte");
        const mottakere = sortert(
          eierrel.filter((r) => r.til === key && r.belop_nok !== undefined),
          etter(
            på((r) => r.belop_nok ?? 0, synkende(tall)),
            på((r) => r.fra, tekst),
            på((r) => r.fra_dato, nullForst(tekst)),
          ),
        );
        return { key, total, mottakere };
      })
      .filter((x) => x.total !== undefined || x.mottakere.length > 0)
      .map((x) => ({
        selskap: organRef(x.key),
        total: x.total ? nokkeltallUt(x.total) : null,
        mottakere: x.mottakere.map((r) => eierandel(r, r.fra)),
        sum_mottakere: x.mottakere.reduce((sum, r) => sum + (r.belop_nok ?? 0), 0),
      }));

    return { eier: organRef(kommuneorgan), selskaper, utbytte };
  }

  function nettverk(kommunenr: string): Nettverk | null {
    const km = iKommune(kommunenr);
    if (!km) return null;

    // Ingen nettverksgraf for dommere, politi, påtale og Forsvaret: en person
    // med en synlig rolle i et sensitivt organ er ikke med i det hele tatt.
    const utelatt = new Set(synligeRoller.filter((r) => org(r.org).sensitiv).map((r) => r.person));
    const aktuelle = km.roller.filter(
      (r) => erAktiv(r) && !org(r.org).sensitiv && !utelatt.has(r.person),
    );
    const perPerson = new Map<string, Rolleinnehav[]>();
    for (const r of aktuelle) perPerson.set(r.person, [...(perPerson.get(r.person) ?? []), r]);

    const med = sortert(
      [...perPerson].filter(([, rs]) => new Set(rs.map((r) => r.org)).size >= 2),
      på(([p]) => p, tekst),
    );

    const noder = new Set<string>();
    const kanter: Nettverk["kanter"] = [];
    for (const [p, rs] of med) {
      const organer = sortert(new Set(rs.map((r) => r.org)), tekst);
      organer.forEach((a, i) => {
        noder.add(a);
        for (const b of organer.slice(i + 1)) kanter.push({ fra: a, til: b, person: personRef(p) });
      });
    }

    return {
      noder: sortert(noder, tekst).map(organRef),
      kanter: sortert(
        kanter,
        etter(
          på((x) => x.fra, tekst),
          på((x) => x.til, tekst),
          på((x) => x.person.key, tekst),
        ),
      ),
      personer: med.map(([p, rs]) => ({
        person: personRef(p),
        roller: sortert(
          rs,
          etter(
            på((r) => r.org, tekst),
            på((r) => r.rolletype, rolletype),
          ),
        ).map(rolleIOrgan),
      })),
    };
  }

  function organer_for_segment(segmentKode: string, kommunenr: string): SegmentOrganer | null {
    const seg = s.segmenter.get(segmentKode);
    const o = omfang.get(kommunenr);
    if (!seg || !o) return null;
    return {
      segment: { kode: seg.kode, navn: seg.navn },
      organer: sortert(
        orgSegment.filter(
          (x) => x.segment === segmentKode && o.has(x.org) && org(x.org).status === "aktiv",
        ),
        etter(
          på((x) => x.styrke, synkende(tall)),
          på((x) => org(x.org).nivaa, nivaa),
          på((x) => x.org, tekst),
        ),
      ).map((x) => ({
        org: organRef(x.org),
        styrke: x.styrke,
        myndighet: [...org(x.org).myndighet],
        beskrivelse: org(x.org).beskrivelse,
      })),
    };
  }

  function hullFor(kommunenr: string): HullPunkt[] | null {
    const km = iKommune(kommunenr);
    if (!km) return null;
    return sortert(
      km.hul,
      etter(
        på((h) => h.gjelder, tekst),
        på((h) => h.hva, tekst),
      ),
    ).map(hullPunkt);
  }

  // --- gradene -------------------------------------------------------------

  const kildetype = (key: string) => s.kilder.get(key)?.type ?? regionKilder.get(key)?.type;

  function telling(belegg: Belegg[]): Gradtelling {
    const t: Gradtelling = {
      totalt: 0,
      verifisert: 0,
      oppgitt: 0,
      maa_verifiseres: 0,
      fra_register: 0,
    };
    for (const b of belegg) {
      t.totalt += 1;
      t[b.verifisering] += 1;
      if (kildetype(b.kilde) === "register") t.fra_register += 1;
    }
    return t;
  }

  type Deler = Record<Exclude<keyof Grader, "alle" | "forst_hentet" | "sist_hentet">, Belegg[]>;

  function grader(d: Deler): Grader {
    const alle = [
      ...d.organer,
      ...d.roller,
      ...d.relasjoner,
      ...d.nokkeltall,
      ...d.hendelser,
      ...d.prosess_steg,
    ];
    // `per` på en verifisert påstand er datoen pipelinen hentet den.
    const hentet = sortert(
      alle.flatMap((b) => (b.verifisering === "verifisert" && b.per ? [b.per] : [])),
      tekst,
    );
    return {
      alle: telling(alle),
      organer: telling(d.organer),
      roller: telling(d.roller),
      relasjoner: telling(d.relasjoner),
      nokkeltall: telling(d.nokkeltall),
      hendelser: telling(d.hendelser),
      prosess_steg: telling(d.prosess_steg),
      forst_hentet: hentet[0] ?? null,
      sist_hentet: hentet[hentet.length - 1] ?? null,
    };
  }

  /** Påstandene i kommunens omfang, de samme som `kommune_oversikt.verifisering` teller. */
  function kommuneDeler(km: NonNullable<ReturnType<typeof iKommune>>): Deler {
    return {
      organer: km.k.organer.map((key) => org(key).belegg),
      roller: km.roller.map((r) => r.belegg),
      relasjoner: km.rel.map((r) => r.belegg),
      nokkeltall: km.nt.map((n) => n.belegg),
      hendelser: km.hend.map((h) => h.belegg),
      prosess_steg: km.k.prosesser.flatMap((p) => p.steg.map((st) => st.belegg)),
    };
  }

  function kommune_grader(kommunenr: string): Grader | null {
    const km = iKommune(kommunenr);
    return km ? grader(kommuneDeler(km)) : null;
  }

  // --- regionen ------------------------------------------------------------

  const register = valg.region ?? null;
  const regionKilder = new Map((register?.meta.kilder ?? []).map((k) => [k.key, k]));
  const regionKildeUt = (key: string): KildeUt => {
    const k = regionKilder.get(key) ?? s.kilder.get(key);
    if (!k) throw new Error(`Ukjent kilde «${key}» i regionregisteret`);
    return { key: k.key, navn: k.navn, url: k.url ?? null, type: k.type, lisens: k.lisens ?? null };
  };
  const regionBelegg = (b: Belegg): BeleggUt => ({
    kilde: regionKildeUt(b.kilde),
    verifisering: b.verifisering,
    per: b.per ?? null,
    merknad: b.merknad ?? null,
    hentet: b.verifisering === "verifisert" && b.per ? `${b.per}T00:00:00+00:00` : null,
  });

  /** Kommunenumrene i fylket, fra registeret. */
  const kommunerIFylke = (fylkesnr: string) =>
    (register?.kommuner ?? []).filter((k) => k.fylkesnr === fylkesnr);

  function beregnAggregater(): Aggregater {
    const kommuner: Aggregater["kommuner"] = {};
    for (const k of s.kommuner) {
      const nr = k.meta.kommunenr;
      const km = iKommune(nr)!;
      kommuner[nr] = {
        sammenstilt: k.meta.sammenstilt,
        organer: km.o.size,
        roller: km.roller.length,
        personer: new Set(km.roller.map((r) => r.person)).size,
        ledere: {
          politisk_leder: kommunensLedere(km, nr).filter((r) => r.rolletype === "politisk_leder")
            .length,
          toppleder: kommunensLedere(km, nr).filter((r) => r.rolletype === "toppleder").length,
        },
        grader: grader(kommuneDeler(km)),
      };
    }

    // Over fylket er hver påstand med én gang, selv når den står i omfanget til
    // flere kommuner. Nøklene er de samme som seed-en avleder id-ene av.
    const fylker: Aggregater["fylker"] = {};
    for (const f of register?.fylker ?? []) {
      const organer = new Map<string, Belegg>();
      const roller = new Map<string, Rolleinnehav>();
      const rel = new Map<string, Belegg>();
      const nt = new Map<string, Belegg>();
      const hend = new Map<string, Belegg>();
      const steg: Belegg[] = [];
      let kartlagt = 0;
      for (const rk of kommunerIFylke(f.nr)) {
        const km = iKommune(rk.nr);
        if (!km) continue;
        kartlagt += 1;
        for (const key of km.k.organer) organer.set(key, org(key).belegg);
        for (const r of km.roller) roller.set(nokkel.rolle(r), r);
        for (const r of km.rel) rel.set(nokkel.relasjon(r), r.belegg);
        for (const n of km.nt) nt.set(nokkel.nokkeltall(n), n.belegg);
        for (const h of km.hend) hend.set(nokkel.hendelse(h), h.belegg);
        for (const p of km.k.prosesser) for (const st of p.steg) steg.push(st.belegg);
      }
      fylker[f.nr] = {
        kartlagt,
        dekning: {
          organer: organer.size,
          roller: roller.size,
          personer: new Set([...roller.values()].map((r) => r.person)).size,
        },
        grader: grader({
          organer: [...organer.values()],
          roller: [...roller.values()].map((r) => r.belegg),
          relasjoner: [...rel.values()],
          nokkeltall: [...nt.values()],
          hendelser: [...hend.values()],
          prosess_steg: steg,
        }),
      };
    }
    return { kommuner, fylker };
  }

  let aggregatMinne: Aggregater | undefined = valg.aggregater;
  const aggregater = () => (aggregatMinne ??= beregnAggregater());

  const regionKommune = (k: Regionregister["kommuner"][number]): RegionKommune => ({
    kommunenr: k.nr,
    navn: k.navn,
    navn_offisielt: k.navn_offisielt,
    slug: k.slug,
    fylkesnr: k.fylkesnr,
    folketall: {
      verdi: k.folketall.verdi,
      aar: k.folketall.aar,
      belegg: regionBelegg(k.folketall.belegg),
    },
    samisk_forvaltningsomrade: k.samisk_forvaltningsomrade,
    belegg: regionBelegg(k.belegg),
    geografi_belegg: regionBelegg(k.geografi_belegg),
    datasett: aggregater().kommuner[k.nr] ?? null,
  });

  const tomGrad = (): Gradtelling => ({
    totalt: 0,
    verifisert: 0,
    oppgitt: 0,
    maa_verifiseres: 0,
    fra_register: 0,
  });
  const tommeGrader = (): Grader => ({
    alle: tomGrad(),
    organer: tomGrad(),
    roller: tomGrad(),
    relasjoner: tomGrad(),
    nokkeltall: tomGrad(),
    hendelser: tomGrad(),
    prosess_steg: tomGrad(),
    forst_hentet: null,
    sist_hentet: null,
  });

  const regionFylke = (f: Regionregister["fylker"][number]): RegionFylke => {
    const a = aggregater().fylker[f.nr];
    return {
      fylkesnr: f.nr,
      navn: f.navn,
      navn_offisielt: f.navn_offisielt,
      slug: lagSlug(f.navn),
      folketall: {
        verdi: f.folketall.verdi,
        aar: f.folketall.aar,
        belegg: regionBelegg(f.folketall.belegg),
      },
      belegg: regionBelegg(f.belegg),
      antall_kommuner: kommunerIFylke(f.nr).length,
      kartlagt: a?.kartlagt ?? 0,
      dekning: a?.dekning ?? { organer: 0, roller: 0, personer: 0 },
      grader: a?.grader ?? tommeGrader(),
    };
  };

  function region_oversikt(): RegionOversikt {
    if (!register) {
      return {
        region: { navn: "", sammenstilt: "", merknad: "" },
        fylker: [],
        kommuner: [],
        kilder: [],
      };
    }
    const fylker = sortert(
      register.fylker,
      på((f) => f.nr, tekst),
    ).map(regionFylke);
    const kommuner = sortert(
      register.kommuner,
      på((k) => k.nr, tekst),
    ).map(regionKommune);
    const kilder = new Set([
      ...register.fylker.flatMap((f) => [f.belegg.kilde, f.folketall.belegg.kilde]),
      ...register.kommuner.flatMap((k) => [
        k.belegg.kilde,
        k.folketall.belegg.kilde,
        k.geografi_belegg.kilde,
      ]),
    ]);
    return {
      region: {
        navn: register.meta.region,
        sammenstilt: register.meta.sammenstilt,
        merknad: register.meta.merknad,
      },
      fylker,
      kommuner,
      kilder: sortert(kilder, tekst).map(regionKildeUt),
    };
  }

  function fylke_oversikt(fylkesnr: string): FylkeOversikt | null {
    const f = register?.fylker.find((x) => x.nr === fylkesnr);
    if (!f) return null;
    const iFylke = sortert(
      kommunerIFylke(fylkesnr),
      på((k) => k.nr, tekst),
    );
    const nr = new Set(iFylke.map((k) => k.nr));
    const omfangF = new Set(
      s.kommuner.filter((k) => nr.has(k.meta.kommunenr)).flatMap((k) => k.organer),
    );

    const egne = sortert(
      [...s.organisasjoner.values()]
        .filter(
          (o) =>
            o.status === "aktiv" &&
            (o.fylkesnr === fylkesnr ||
              (o.organtype === "statsforvalter" &&
                o.kommunenr === undefined &&
                omfangF.has(o.key))),
        )
        .map((o) => o.key),
      etter(
        på((key) => org(key).nivaa, nivaa),
        på((key) => org(key).organtype, organtype),
        på((key) => key, tekst),
      ),
    );
    const organer: FylkeOrgan[] = egne.map((key) => ({
      ...organ(key),
      ledere: ledere(key),
      representanter:
        org(key).organtype === "lovgivende"
          ? sortert((rollerPerOrg.get(key) ?? []).filter(erAktiv), rolleSortering).map(rolle)
          : [],
    }));

    // Omsetning er det eneste størrelsesmålet med år i datasettene.
    const storste = sortert(
      [...s.organisasjoner.values()].flatMap((o) => {
        if (o.status !== "aktiv" || o.kommunenr === undefined || !nr.has(o.kommunenr)) return [];
        const forste = sortert(
          (nokkeltallPerOrg.get(o.key) ?? []).filter(
            (n) => n.type === "omsetning" && n.periode === undefined,
          ),
          nokkeltallSortering,
        )[0];
        return forste ? [{ o, n: forste }] : [];
      }),
      etter(
        på((x) => x.n.verdi, synkende(tall)),
        på((x) => x.o.key, tekst),
      ),
    )
      .slice(0, STORSTE_VIRKSOMHETER)
      .map((x) => ({
        org: organRef(x.o.key),
        kommunenr: x.o.kommunenr!,
        omsetning: nokkeltallUt(x.n),
      }));

    return {
      fylke: regionFylke(f),
      kommuner: iFylke.map(regionKommune),
      organer,
      storste,
    };
  }

  // --- søket ---------------------------------------------------------------

  let grunnlag: Sokegrunnlag | undefined;
  function sokegrunnlag(): Sokegrunnlag {
    if (grunnlag) return grunnlag;
    // Samme regel som nettverket: en person med en synlig rolle i et sensitivt
    // organ er ikke med, og ingen roller i sensitive organer er med.
    const utelatt = new Set(synligeRoller.filter((r) => org(r.org).sensitiv).map((r) => r.person));
    grunnlag = {
      kommuner: sortert(
        register?.kommuner ?? [],
        på((k) => k.nr, tekst),
      ).map((k) => ({
        kommunenr: k.nr,
        navn: k.navn,
        navn_offisielt: k.navn_offisielt,
        slug: k.slug,
        fylkesnr: k.fylkesnr,
        har_datasett: kommuneAvNr.has(k.nr),
      })),
      organer: [...s.organisasjoner.values()].map((o) => ({
        ...organRef(o.key),
        orgnr: o.orgnr ?? null,
        kommunenr: o.kommunenr ?? null,
      })),
      roller: synligeRoller
        .filter((r) => erAktiv(r) && !org(r.org).sensitiv && !utelatt.has(r.person))
        .map(rolleIOrgan),
    };
    return grunnlag;
  }

  const kommunerListe = () =>
    s.kommuner.map((k) => ({ ...kommune(k), antall_organer: k.organer.length }));

  return {
    kommuner: async () => kommunerListe(),
    kommune_oversikt: async (kommunenr) => kommune_oversikt(kommunenr),
    beslutningskjede: async (kommunenr, prosessKey) => beslutningskjede(kommunenr, prosessKey),
    organkart: async (kommunenr) => organkart(kommunenr),
    organ_profil: async (orgKey) => organ_profil(orgKey),
    eierskap: async (kommunenr) => eierskap(kommunenr),
    nettverk: async (kommunenr) => nettverk(kommunenr),
    endringer: async (kommunenr) => endringer(kommunenr),
    organer_for_segment: async (segmentKode, kommunenr) =>
      organer_for_segment(segmentKode, kommunenr),
    hull: async (kommunenr) => hullFor(kommunenr),
    kommune_grader: async (kommunenr) => kommune_grader(kommunenr),
    region_oversikt: async () => region_oversikt(),
    fylke_oversikt: async (fylkesnr) => fylke_oversikt(fylkesnr),
    sok: async (sporring, limit) => sokI(sokegrunnlag(), sporring, limit),
    beregnAggregater,
    sokegrunnlag,
  };
}
