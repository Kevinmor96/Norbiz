// Importøren: utvider et kommunedatasett med det som ble hentet fra Brreg.
//
// Modulen er ren. Samme datasett og samme øyeblikksbilde gir samme resultat,
// og resultatet kjørt en gang til på det samme bildet gir det samme igjen
// (idempotent). Ingen klokke, ingen tilfeldighet, ingen filsystem.
//
// EIERSKAP TIL RADENE. En rad er importørens når belegget er `verifisert` fra
// en av Brreg-kildene og merknaden ikke begynner med «Bekrefter grunnlaget».
// Slike rader bygges på nytt ved hver kjøring. Alt annet er grunnlaget
// (håndsammenstilt fra researchgrunnlaget), og det endres bare på én måte:
// når registeret bekrefter en påstand, oppgraderes belegget til `verifisert`
// med hentedatoen, og merknaden begynner med «Bekrefter grunnlaget». Sier
// registeret noe annet, står grunnlagets påstand urørt, registerets påstand
// legges til ved siden av, og begge går til avviksrapporten.
//
// PERSONER. Bare `key` og `navn`. To registerpersoner er samme person når
// navn og fødselsdato gir samme hash (`pid`). En registerperson er samme som
// en person i grunnlaget bare når de deler organ og navn. Navnet alene er
// aldri nok. Hashsuffikset i nøkkelen brukes bare når to personer ellers ville
// fått samme nøkkel.

import type {
  Belegg,
  Hull,
  Kilde,
  Kommunedatasett,
  Nokkeltall,
  Nokkeltalltype,
  Organisasjon,
  OrgSegment,
  Organtype,
  Person,
  Relasjon,
  Rolleinnehav,
  Rolletype,
} from "../../src/data/types";
import { nokkel } from "../../src/lib/data/samle";
import type { Enhet, Naering, Oyeblikksbilde, Rolle, Rollekode, Underenhet } from "./hent";
import {
  segmentFor,
  type Felleskonfig,
  type Kommunekonfig,
  type OrgformRegel,
  type Tabeller,
} from "./konfig";
import { fold, navnKanVaereSamme, orgNavnNokkel, pentOrgNavn, sammeNavn, slug } from "./tekst";

// ---------------------------------------------------------------------------
// Kilder og faste tekster
// ---------------------------------------------------------------------------

/**
 * Kildene importøren skriver. `enhetsregisteret` og `regnskapsregisteret`
 * sto allerede i Tromsø-datasettet, klare for pipelinen, og gjenbrukes: en
 * kilde er registeret, ikke hvem som hentet fra det. Hvem som hentet, står i
 * `verifisering`.
 */
export const KILDER = {
  enhet: {
    key: "enhetsregisteret",
    navn: "Enhetsregisteret (Brønnøysundregistrene)",
    url: "https://data.brreg.no/enhetsregisteret/api",
    type: "register",
    lisens: "NLOD",
  },
  roller: {
    key: "brreg-roller",
    navn: "Roller i Enhetsregisteret (Brønnøysundregistrene)",
    url: "https://data.brreg.no/enhetsregisteret/api/roller/rolletyper",
    type: "register",
    lisens: "NLOD",
  },
  regnskap: {
    key: "regnskapsregisteret",
    navn: "Regnskapsregisteret (Brønnøysundregistrene)",
    url: "https://data.brreg.no/regnskapsregisteret/regnskap",
    type: "register",
    lisens: "NLOD",
  },
} as const satisfies Record<string, Kilde>;

const BRREG_KILDER = new Set<string>(Object.values(KILDER).map((k) => k.key));

/** Merknaden på en grunnlagsrad registeret har bekreftet, begynner alltid slik. */
export const BEKREFTER = "Bekrefter grunnlaget";

/** `hvorfor` på hullene importøren eier. */
export const VALUTA_HVORFOR =
  "Regnskapsregisteret fører dette regnskapet i en annen valuta enn kroner. Maktkart viser bare kronebeløp, blander aldri valutaer og regner ikke om uten en merket kurs.";

const TITTEL: Record<Rollekode, string> = {
  DAGL: "Daglig leder",
  LEDE: "Styreleder",
  NEST: "Nestleder",
  MEDL: "Styremedlem",
  VARA: "Varamedlem",
};

/** Rolletypene i grunnlaget en Brreg-rolle kan bekrefte. */
const TYPER_FOR_KODE: Record<Rollekode, Rolletype[]> = {
  DAGL: ["daglig_leder", "toppleder", "dommer_leder", "paatale_leder"],
  LEDE: ["styreleder"],
  NEST: ["nestleder"],
  MEDL: ["styremedlem"],
  VARA: ["varamedlem"],
};
/** Rolletypene Brreg selv fører. Mangler de i registeret, er det et avvik. */
const REGISTERTYPER = new Set<Rolletype>([
  "daglig_leder",
  "styreleder",
  "nestleder",
  "styremedlem",
  "varamedlem",
]);

const kodeFor = (t: Rolletype): Rollekode | null => {
  for (const [kode, typer] of Object.entries(TYPER_FOR_KODE))
    if (typer.includes(t)) return kode as Rollekode;
  return null;
};

const TALLTYPER = ["omsetning", "driftsresultat", "aarsresultat", "egenkapital"] as const;

// ---------------------------------------------------------------------------
// Inn og ut
// ---------------------------------------------------------------------------

export interface ImportInn {
  datasett: Kommunedatasett;
  /** Filnavnet uten .json. */
  slug: string;
  bilde: Oyeblikksbilde;
  konfig: Kommunekonfig;
  felles: Felleskonfig;
  tabeller: Tabeller;
  /** De andre kommunedatasettene, med slug. Felles organer må være like i alle. */
  andre: { slug: string; data: Kommunedatasett }[];
  /** Slugene til kommunene i denne kjøringen. Deres importerte personer regnes ut på nytt. */
  kjoringen?: Set<string>;
  /**
   * Personnøkler per pid fra kommunene som allerede er importert i denne
   * kjøringen, og grunnlagskoblingene fra alle. Samme person får samme nøkkel
   * i hver kommune.
   */
  personregister?: Map<string, Person>;
}

export type Avvikskategori =
  | "roller"
  | "nokkeltall"
  | "organer"
  | "personer"
  | "koblinger"
  | "naeringskoder"
  | "ikke_tatt_inn";

export interface Avvik {
  kategori: Avvikskategori;
  /** Organet eller personen avviket gjelder, som tekst med nøkkel. */
  gjelder: string;
  grunnlaget: string;
  registeret: string;
  tiltak: string;
}

export interface Oppsummering {
  kommunenr: string;
  kommune: string;
  hentet: string;
  hentetFra: {
    enheterIKommunen: number;
    underenheterMedForelderUtenfor: number;
    alltidMed: number;
    iUtvalget: number;
    rollelister: number;
    regnskap: number;
    ikkeFunnet: number;
  };
  lagtTil: {
    organer: number;
    personer: number;
    roller: number;
    relasjoner: number;
    nokkeltall: number;
    hull: number;
  };
  bekreftet: { roller: number; nokkeltall: number };
  motsagt: { roller: number; nokkeltall: number; organer: number };
  hoppetOver: {
    fratradt: number;
    doed: number;
    /** Revisor, regnskapsfører, kontaktperson og andre rolletyper Maktkart ikke bruker. */
    andreRoller: number;
    enhetsroller: number;
    sensitive: number;
    orgform: number;
    /** Registerpersoner med samme navn som en person i grunnlaget, uten felles organ. */
    navnebror: number;
    navnITekst: number;
  };
  avvik: number;
}

export interface ImportUt {
  datasett: Kommunedatasett;
  avvik: Avvik[];
  oppsummering: Oppsummering;
  /** Andre kommunedatasett som måtte endres: felles organer fikk den kanoniske raden. */
  andreOppdatert: Map<string, Kommunedatasett>;
  /** pid → grunnlagets person, for pidene som ble koblet til grunnlaget her. */
  personlenker: Map<string, Person>;
  /** pid → person for hver registerperson datasettet viser til. */
  personnokler: Map<string, Person>;
}

// ---------------------------------------------------------------------------
// Hjelpere
// ---------------------------------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortert = <T>(xs: T[], f: (x: T) => string) => [...xs].sort((a, b) => cmp(f(a), f(b)));

/** Følsomt organ (politi, påtale, domstol, Forsvaret, barnevern)? Gir organtypen, eller null. */
export function sensitivType(navn: string, naering: Naering[], f: Felleskonfig): Organtype | null {
  const n = navn.toLocaleLowerCase("nb");
  for (const r of f.sensitiv_navn) if (new RegExp(r.monster).test(n)) return r.organtype;
  for (const r of f.sensitiv_naering) {
    for (const k of naering) {
      if (
        k.kode.startsWith(r.prefiks) &&
        new RegExp(r.krav, "i").test(k.tittel.toLocaleLowerCase("nb"))
      )
        return r.organtype;
    }
  }
  return null;
}

/** Antall nuller til slutt i et heltall. 2 426 000 000 har seks. */
function nuller(v: number): number {
  let n = Math.abs(Math.round(v));
  if (n === 0) return 0;
  let z = 0;
  while (n % 10 === 0 && z < 12) {
    n /= 10;
    z++;
  }
  return z;
}

/**
 * Om grunnlagets tall er registertallet, avrundet. Grunnlaget skriver
 * «2 426 mill.», registeret 2 426 136 000. Toleransen er en halv enhet i
 * grunnlagets siste siffer, men aldri mer enn en halv prosent, og fortegnet
 * må være likt.
 */
export function sammeTall(grunnlag: number, register: number): boolean {
  if (grunnlag === register) return true;
  if (Math.sign(grunnlag) !== Math.sign(register)) return false;
  const toleranse = Math.max(
    0.5,
    Math.min(0.5 * 10 ** nuller(grunnlag), 0.005 * Math.abs(grunnlag)),
  );
  return Math.abs(grunnlag - register) <= toleranse;
}

const kr = (v: number) => `${new Intl.NumberFormat("nb-NO").format(v).replace(/ /g, " ")} kr`;

/** Samme sjekk som «lenker hver tekst som nevner en person ved navn» i datasett-testen. */
export function navneBrudd(d: Kommunedatasett): {
  eier: "organisasjon" | "rolle" | "relasjon" | "nokkeltall" | "hendelse" | "prosess" | "hull";
  nokkel: string;
  person: string;
}[] {
  const personer = d.personer.map((p) => ({ key: p.key, navn: fold(p.navn) }));
  const ut: ReturnType<typeof navneBrudd> = [];
  const sjekk = (
    eier: ReturnType<typeof navneBrudd>[number]["eier"],
    nok: string,
    tekster: (string | undefined)[],
    lenket: string[],
  ) => {
    const t = fold(tekster.filter(Boolean).join(" "));
    for (const p of personer)
      if (t.includes(p.navn) && !lenket.includes(p.key))
        ut.push({ eier, nokkel: nok, person: p.key });
  };
  for (const o of d.organisasjoner)
    sjekk("organisasjon", o.key, [o.navn, o.beskrivelse, o.belegg.merknad], []);
  for (const r of d.roller)
    sjekk("rolle", nokkel.rolle(r), [r.tittel, r.belegg.merknad], [r.person]);
  for (const r of d.relasjoner) sjekk("relasjon", nokkel.relasjon(r), [r.belegg.merknad], []);
  for (const n of d.nokkeltall) sjekk("nokkeltall", nokkel.nokkeltall(n), [n.belegg.merknad], []);
  for (const h of d.hendelser)
    sjekk("hendelse", nokkel.hendelse(h), [h.tittel, h.tekst, h.belegg.merknad], h.personer ?? []);
  for (const p of d.prosesser) {
    sjekk("prosess", p.key, [p.tittel, p.sporsmal], []);
    for (const s of p.steg) sjekk("prosess", p.key, [s.hva, s.belegg.merknad], []);
  }
  for (const h of d.hull) sjekk("hull", nokkel.hull(h), [h.hva, h.hvorfor], h.personer ?? []);
  return ut;
}

// ---------------------------------------------------------------------------
// Importen
// ---------------------------------------------------------------------------

interface Ledd {
  orgnr: string;
  navn: string;
  type: "enhet" | "underenhet";
}

interface Figur {
  org: string;
  aar: number;
  type: Nokkeltalltype;
  konsern: boolean;
  verdi: number;
  merknad: string;
  matchet: boolean;
}

interface Rolleorgan {
  key: string;
  enhet: Enhet;
  sensitiv: boolean;
  organtype: Organtype;
  /** Datasettet eier organet: bare da lages roller, regnskap og styreplasser. */
  eier: boolean;
  personroller: Rolle[];
  styreplasser: Rolle[];
}

const json = (x: unknown) => JSON.stringify(x);

/**
 * Organnøklene et datasett viser til fra andre rader enn organraden,
 * segmentene og overordnet-relasjonene. Med `bareGrunnlag` telles bare
 * grunnlagets rader, ikke importørens.
 */
function henvisninger(d: Kommunedatasett, bareGrunnlag = false): Set<string> {
  const ok = (b: Belegg) =>
    !bareGrunnlag ||
    !(
      b.verifisering === "verifisert" &&
      BRREG_KILDER.has(b.kilde) &&
      !(b.merknad ?? "").startsWith(BEKREFTER)
    );
  return new Set([
    ...d.roller.filter((r) => ok(r.belegg)).map((r) => r.org),
    ...d.relasjoner
      .filter((r) => r.type !== "overordnet" && ok(r.belegg))
      .flatMap((r) => [r.fra, r.til]),
    ...d.nokkeltall.filter((n) => ok(n.belegg)).map((n) => n.org),
    ...d.hendelser.flatMap((h) => (h.org ? [h.org] : [])),
    ...d.prosesser.flatMap((p) => p.steg.map((s) => s.org)),
    ...d.hull.filter((h) => !bareGrunnlag || h.hvorfor !== VALUTA_HVORFOR).map((h) => h.gjelder),
  ]);
}

export function importer(inn: ImportInn): ImportUt {
  const { bilde: S, konfig: K, felles: F, tabeller: T } = inn;
  const D: Kommunedatasett = structuredClone(inn.datasett);
  const andre = [...inn.andre].sort((a, b) => cmp(a.slug, b.slug));
  const kjoringen = inn.kjoringen ?? new Set<string>();
  const register = inn.personregister ?? new Map<string, Person>();
  const dato = S.hentet;
  const sammenstiltAar = Number(D.meta.sammenstilt.slice(0, 4));
  const avvik: Avvik[] = [];
  const nyttAvvik = (a: Avvik) => avvik.push(a);
  const alleKilder = new Map<string, Kilde>();
  for (const a of andre)
    for (const k of a.data.kilder) if (!alleKilder.has(k.key)) alleKilder.set(k.key, k);
  for (const k of D.kilder) alleKilder.set(k.key, k);
  const kildenavn = (key: string) => alleKilder.get(key)?.navn ?? key;
  const hopp = {
    fratradt: 0,
    doed: 0,
    andreRoller: S.forkastet.andreRoller,
    enhetsroller: 0,
    sensitive: 0,
    orgform: 0,
    navnebror: 0,
    navnITekst: 0,
  };
  const blokkert = new Set<string>();

  // --- 1. Del datasettet i grunnlag, importørens rader og kopier ----------

  const erEid = (b: Belegg) => b.verifisering === "verifisert" && BRREG_KILDER.has(b.kilde);
  const erOppgradert = (b: Belegg) => erEid(b) && (b.merknad ?? "").startsWith(BEKREFTER);
  const erGenerert = (b: Belegg) => erEid(b) && !erOppgradert(b);
  const erGenerertHull = (h: Hull) => h.hvorfor === VALUTA_HVORFOR;

  // Grunnlagsrader fra et annet datasett, kopiert hit fordi et organ her viser
  // til dem (en underenhet her med forelder i grunnlaget der). En kopi er lik
  // raden i originalen, og datasettet her har ingen egne rader om den. Kopier
  // hentes på nytt fra originalen ved hver kjøring.
  const originaler = new Map<string, { slug: string; org: Organisasjon }>(); // key → original
  for (const a of andre) {
    const ref = henvisninger(a.data);
    for (const o of a.data.organisasjoner) {
      if (erGenerert(o.belegg) || originaler.has(o.key)) continue;
      if (ref.has(o.key) || (o.kommunenr !== undefined && o.kommunenr === a.data.meta.kommunenr))
        originaler.set(o.key, { slug: a.slug, org: o });
    }
  }
  const egneRef = henvisninger(D, true);
  const kopier = new Set(
    D.organisasjoner
      .filter((o) => !erGenerert(o.belegg) && !egneRef.has(o.key))
      .filter((o) => {
        const orig = originaler.get(o.key);
        return orig !== undefined && json(orig.org) === json(o);
      })
      .map((o) => o.key),
  );
  // En kopi som et eget organ viser til som overordnet, er ikke en kopi.
  for (let endret = true; endret;) {
    endret = false;
    for (const o of D.organisasjoner) {
      if (o.overordnet && kopier.has(o.overordnet) && !kopier.has(o.key) && !erGenerert(o.belegg)) {
        kopier.delete(o.overordnet);
        endret = true;
      }
    }
  }

  const gamleOrg = D.organisasjoner.filter((o) => erGenerert(o.belegg));
  const gamleOrgKeys = new Set(gamleOrg.map((o) => o.key));
  const tidligereKey = new Map(
    gamleOrg.flatMap((o) => (o.orgnr ? [[o.orgnr, o.key] as const] : [])),
  );
  const utenfor = (key: string) => gamleOrgKeys.has(key) || kopier.has(key);

  const gOrg = D.organisasjoner.filter((o) => !utenfor(o.key));
  const gOrgKeys = new Set(gOrg.map((o) => o.key));
  let gRoller = D.roller.filter((r) => !erGenerert(r.belegg));
  const gRel = D.relasjoner.filter(
    (r) => !erGenerert(r.belegg) && !(r.type === "overordnet" && kopier.has(r.fra)),
  );
  let gTall = D.nokkeltall.filter((n) => !erGenerert(n.belegg));
  const gSeg = D.org_segment.filter((s) => !utenfor(s.org));
  const gHull = D.hull.filter((h) => !erGenerertHull(h));
  const gamleTall = D.nokkeltall.filter((n) => erGenerert(n.belegg));
  const gamleHull = D.hull.filter(erGenerertHull);

  const gPersonKeys = new Set([
    ...gRoller.map((r) => r.person),
    ...D.hendelser.flatMap((h) => h.personer ?? []),
    ...gHull.flatMap((h) => h.personer ?? []),
  ]);
  const gPersoner = D.personer.filter((p) => gPersonKeys.has(p.key));
  const personnavn = new Map(gPersoner.map((p) => [p.key, p.navn]));

  // De andre datasettene: organer per orgnr, og personnøkler som er tatt.
  const andreOrgKeys = new Set<string>();
  const andreGrunn = new Map<string, { slug: string; org: Organisasjon }>(); // orgnr → grunnlagsrad
  const andreGenerert = new Map<string, { slug: string; org: Organisasjon; seg: OrgSegment[] }>();
  const tattePersoner = new Set<string>();
  for (const a of andre) {
    for (const o of a.data.organisasjoner) {
      andreOrgKeys.add(o.key);
      if (!o.orgnr) continue;
      if (erGenerert(o.belegg)) {
        if (!andreGenerert.has(o.orgnr))
          andreGenerert.set(o.orgnr, {
            slug: a.slug,
            org: o,
            seg: a.data.org_segment.filter((s) => s.org === o.key),
          });
      } else {
        const orig = originaler.get(o.key);
        if (!andreGrunn.has(o.orgnr) || orig?.slug === a.slug)
          andreGrunn.set(o.orgnr, { slug: a.slug, org: o });
      }
    }
    // Personer i en kommune i samme kjøring regnes ut på nytt, bortsett fra grunnlagets.
    const grunnPers = new Set([
      ...a.data.roller.filter((r) => !erGenerert(r.belegg)).map((r) => r.person),
      ...a.data.hendelser.flatMap((h) => h.personer ?? []),
      ...a.data.hull.flatMap((h) => h.personer ?? []),
    ]);
    for (const p of a.data.personer)
      if (!kjoringen.has(a.slug) || grunnPers.has(p.key)) tattePersoner.add(p.key);
  }
  const slugForKommune = new Map<string, string>([
    ...andre.map((a) => [a.data.meta.kommunenr, a.slug] as const),
    [K.kommunenr, inn.slug],
  ]);

  // --- 2. Utvalget -----------------------------------------------------------

  const enhet = (orgnr: string | null | undefined): Enhet | undefined =>
    orgnr ? S.enheter[orgnr] : undefined;
  const grunner = (orgnr: string) => S.utvalg[orgnr] ?? [];
  const e1 = [...new Set([...S.iKommunen, ...S.alltid])]
    .filter((o) => S.utvalg[o] !== undefined)
    .sort()
    .flatMap((o) => (enhet(o) ? [enhet(o)!] : []));
  const e1Orgnr = new Set(e1.map((e) => e.orgnr));

  const ue: { u: Underenhet; forelder: Enhet }[] = [];
  for (const u of sortert(S.underenheter, (x) => x.orgnr)) {
    if (u.nedlagt || S.utvalg[u.orgnr] === undefined) continue;
    const f = enhet(u.overordnet);
    if (!f) {
      nyttAvvik({
        kategori: "ikke_tatt_inn",
        gjelder: `${pentOrgNavn(u.navn, F.navneformer)} (${u.orgnr})`,
        grunnlaget: "–",
        registeret: `Underenhet uten kjent overordnet enhet (${u.overordnet ?? "mangler"}).`,
        tiltak: "Ikke tatt inn. Sjekk den overordnede enheten i Enhetsregisteret.",
      });
      continue;
    }
    if (f.kommunenr === K.kommunenr || f.slettet) continue;
    ue.push({ u, forelder: f });
  }
  const ueOrgnr = new Set(ue.map((x) => x.u.orgnr));

  // --- 3. Kobling til grunnlagets organer ----------------------------------

  const grunnPaaOrgnr = new Map(gOrg.flatMap((o) => (o.orgnr ? [[o.orgnr, o.key] as const] : [])));
  const orgnrForGrunn = new Map<string, string>(); // key → orgnr for alle koblede
  for (const [orgnr, key] of grunnPaaOrgnr) orgnrForGrunn.set(key, orgnr);
  for (const [key, orgnr] of Object.entries(K.koblinger)) {
    const o = gOrg.find((x) => x.key === key);
    if (!o) throw new Error(`koblinger: «${key}» finnes ikke i grunnlaget.`);
    if (o.orgnr && o.orgnr !== orgnr)
      throw new Error(`koblinger: «${key}» har orgnr ${o.orgnr} i grunnlaget, ikke ${orgnr}.`);
    grunnPaaOrgnr.set(orgnr, key);
    orgnrForGrunn.set(key, orgnr);
  }

  // Styreplasser eid av enheter, fra rollene til organene i utvalget.
  const styreeiere = new Set<string>();
  for (const e of e1) {
    for (const r of S.roller[e.orgnr] ?? []) {
      if (
        r.enhet &&
        !r.enhet.slettet &&
        (r.kode === "LEDE" || r.kode === "NEST" || r.kode === "MEDL")
      )
        styreeiere.add(r.enhet.orgnr);
    }
  }

  const ledd = new Map<string, Ledd>();
  for (const e of e1) ledd.set(e.orgnr, { orgnr: e.orgnr, navn: e.navn, type: "enhet" });
  for (const { u, forelder } of ue) {
    ledd.set(u.orgnr, { orgnr: u.orgnr, navn: u.navn, type: "underenhet" });
    if (!ledd.has(forelder.orgnr))
      ledd.set(forelder.orgnr, { orgnr: forelder.orgnr, navn: forelder.navn, type: "enhet" });
  }
  for (const orgnr of styreeiere) {
    const e = enhet(orgnr);
    if (e && !ledd.has(orgnr)) ledd.set(orgnr, { orgnr, navn: e.navn, type: "enhet" });
  }

  // Navnekobling: grunnlagets organer uten orgnr, eksakt likt navn, ett treff.
  const navnIndeks = new Map<string, string[]>();
  for (const o of gOrg) {
    if (o.orgnr || orgnrForGrunn.has(o.key)) continue;
    const n = orgNavnNokkel(o.navn);
    navnIndeks.set(n, [...(navnIndeks.get(n) ?? []), o.key]);
  }
  const koblingsgrupper = new Map<string, Ledd[]>();
  for (const l of [...ledd.values()].sort((a, b) => cmp(a.orgnr, b.orgnr))) {
    if (grunnPaaOrgnr.has(l.orgnr)) continue;
    const n = orgNavnNokkel(l.navn);
    if (!navnIndeks.has(n)) continue;
    koblingsgrupper.set(n, [...(koblingsgrupper.get(n) ?? []), l]);
  }
  const kobletPaaNavn = new Set<string>();
  const heltNavn = (t: string) =>
    fold(t)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  for (const [n, gruppe] of sortert([...koblingsgrupper], ([n]) => n)) {
    let kandidater = navnIndeks.get(n) ?? [];
    const enh = gruppe.filter((l) => l.type === "enhet");
    const valgt =
      enh.length === 1 ? enh[0] : enh.length === 0 && gruppe.length === 1 ? gruppe[0] : undefined;
    // «Tromsøbadet AS» og «Tromsøbadet KF» har samme stamme; da avgjør selskapsformen.
    if (kandidater.length > 1 && valgt) {
      const presis = kandidater.filter(
        (k) => heltNavn(gOrg.find((o) => o.key === k)?.navn ?? "") === heltNavn(valgt.navn),
      );
      if (presis.length === 1) kandidater = presis;
    }
    const [grunnKey] = kandidater;
    if (kandidater.length !== 1 || !valgt || !grunnKey) {
      nyttAvvik({
        kategori: "koblinger",
        gjelder: kandidater.join(", "),
        grunnlaget: "Organ uten orgnr",
        registeret: `Flere mulige treff: ${gruppe.map((l) => `${l.navn} (${l.orgnr})`).join(", ")}`,
        tiltak: "Ikke koblet. Legg riktig orgnr i koblinger i scripts/brreg.config.json.",
      });
      continue;
    }
    grunnPaaOrgnr.set(valgt.orgnr, grunnKey);
    orgnrForGrunn.set(grunnKey, valgt.orgnr);
    kobletPaaNavn.add(valgt.orgnr);
    nyttAvvik({
      kategori: "koblinger",
      gjelder: grunnKey,
      grunnlaget: gOrg.find((o) => o.key === grunnKey)?.navn ?? grunnKey,
      registeret: `${valgt.navn} (${valgt.orgnr}${valgt.type === "underenhet" ? ", underenhet" : ""})`,
      tiltak: "Koblet på eksakt navn. Bekreft og legg orgnr inn i grunnlaget.",
    });
  }

  // --- 4. Hvilke enheter tas med, med hvilken nøkkel, og hvem eier dem ------

  const formRegel = (e: Enhet): OrgformRegel | "hopp" | null =>
    T.orgform.hoppes_over[e.orgform] !== undefined ? "hopp" : (T.orgform.former[e.orgform] ?? null);
  const umappet = new Map<string, Set<string>>();
  const hoppetForm = new Set<string>();
  const kanLages = (e: Enhet): boolean => {
    const r = formRegel(e);
    if (r === "hopp") {
      hoppetForm.add(e.orgnr);
      return false;
    }
    if (r === null) {
      umappet.set(
        e.orgform,
        (umappet.get(e.orgform) ?? new Set()).add(
          `${pentOrgNavn(e.navn, F.navneformer)} (${e.orgnr})`,
        ),
      );
      return false;
    }
    return true;
  };

  const grunnOrg = (key: string) => gOrg.find((o) => o.key === key);
  const nokkelFor = new Map<string, string>(); // orgnr → key, for alt som er med
  /** Grunnlagsrader fra et annet datasett som kopieres hit. orgnr → original. */
  const kopiPaaOrgnr = new Map<string, { slug: string; org: Organisasjon }>();
  const nyeEnheter: Enhet[] = [];
  const nyeUnderenheter: { u: Underenhet; forelder: Enhet }[] = [];
  const kontekst = new Map<string, Set<string>>(); // orgnr → «overordnet», «styreplass»

  /** Et organ som ikke er grunnlagets her: grunnlagsrad i et annet datasett, eller ny. */
  const taMed = (e: Enhet, hvorfor?: string): boolean => {
    if (hvorfor) kontekst.set(e.orgnr, (kontekst.get(e.orgnr) ?? new Set()).add(hvorfor));
    const g = grunnPaaOrgnr.get(e.orgnr);
    if (g) {
      nokkelFor.set(e.orgnr, g);
      return true;
    }
    const annet = andreGrunn.get(e.orgnr);
    if (annet) {
      nokkelFor.set(e.orgnr, annet.org.key);
      kopiPaaOrgnr.set(e.orgnr, annet);
      return true;
    }
    if (nyeEnheter.some((x) => x.orgnr === e.orgnr)) return true;
    if (e.slettet || !kanLages(e)) return false;
    nyeEnheter.push(e);
    return true;
  };

  for (const e of e1) taMed(e);
  for (const x of ue) {
    if (grunnPaaOrgnr.has(x.u.orgnr)) {
      nokkelFor.set(x.u.orgnr, grunnPaaOrgnr.get(x.u.orgnr)!);
      continue;
    }
    const f = x.forelder;
    const forelderMed = e1Orgnr.has(f.orgnr)
      ? nokkelFor.has(f.orgnr) || nyeEnheter.includes(f)
      : taMed(f, "overordnet");
    if (forelderMed) nyeUnderenheter.push(x);
  }

  const erSensitiv = (orgnr: string, e: Enhet): boolean => {
    const g = grunnPaaOrgnr.get(orgnr);
    const k = kopiPaaOrgnr.get(orgnr);
    return (
      (g !== undefined && grunnOrg(g)?.sensitiv === true) ||
      k?.org.sensitiv === true ||
      sensitivType(e.navn, e.naering, F) !== null
    );
  };
  const lokasjon = (orgnr: string): string | null =>
    ueOrgnr.has(orgnr) ? K.kommunenr : (enhet(orgnr)?.kommunenr ?? null);
  /**
   * Datasettet som eier organet, og som alene fører rollene, regnskapet og
   * styreplassene: kommunen organet ligger i, når den har et datasett. Ellers
   * datasettet der organet er grunnlag. Ellers ingen.
   */
  const eier = (orgnr: string): string | null => {
    const lok = lokasjon(orgnr);
    const hjem = lok ? slugForKommune.get(lok) : undefined;
    if (hjem) return hjem;
    if (grunnPaaOrgnr.has(orgnr)) return inn.slug;
    const k = kopiPaaOrgnr.get(orgnr) ?? andreGrunn.get(orgnr);
    if (k) return k.slug;
    if (K.roller_for_overordnede && kontekst.get(orgnr)?.has("overordnet")) return inn.slug;
    return null;
  };
  const eierHer = (orgnr: string) => eier(orgnr) === inn.slug;

  const medRoller = e1.filter((e) => nokkelFor.has(e.orgnr) || nyeEnheter.includes(e));
  for (const e of medRoller) {
    if (erSensitiv(e.orgnr, e) || !eierHer(e.orgnr)) continue;
    for (const r of S.roller[e.orgnr] ?? []) {
      if (!r.enhet || r.enhet.slettet || r.fratradt || r.avregistrert) continue;
      if (r.kode !== "LEDE" && r.kode !== "NEST" && r.kode !== "MEDL") continue;
      const h = enhet(r.enhet.orgnr);
      if (h && !h.slettet) taMed(h, "styreplass");
    }
  }

  // Nøkler. Først de som er kjent fra før (forrige kjøring, et annet
  // kommunedatasett), så nye i orgnr-rekkefølge.
  const brukteOrgKeys = new Set([...gOrgKeys, ...andreOrgKeys]);
  const nye: { orgnr: string; navn: string }[] = [
    ...nyeEnheter.map((e) => ({ orgnr: e.orgnr, navn: e.navn })),
    ...nyeUnderenheter.map((x) => ({ orgnr: x.u.orgnr, navn: x.u.navn })),
  ].sort((a, b) => cmp(a.orgnr, b.orgnr));
  const tildelt = new Set<string>();
  for (const n of nye) {
    const k = andreGenerert.get(n.orgnr)?.org.key ?? tidligereKey.get(n.orgnr);
    if (k && !gOrgKeys.has(k) && !tildelt.has(k)) {
      nokkelFor.set(n.orgnr, k);
      tildelt.add(k);
      brukteOrgKeys.add(k);
    }
  }
  for (const n of nye) {
    if (nokkelFor.has(n.orgnr)) continue;
    const base = slug(orgNavnNokkel(pentOrgNavn(n.navn))) || `org-${n.orgnr}`;
    let k = base;
    if (brukteOrgKeys.has(k)) k = `${base}-${n.orgnr}`;
    if (brukteOrgKeys.has(k)) throw new Error(`Fant ingen ledig nøkkel for ${n.orgnr}.`);
    nokkelFor.set(n.orgnr, k);
    brukteOrgKeys.add(k);
  }

  // --- 5. Organradene -----------------------------------------------------

  const beleggEnhet = (merknad?: string): Belegg => ({
    kilde: KILDER.enhet.key,
    verifisering: "verifisert",
    per: dato,
    ...(merknad ? { merknad } : {}),
  });

  const segmentAvvik = new Set<string>();
  const segmenterFor = (naering: Naering[], navn: string, orgnr: string) => {
    const ut = new Map<string, 2 | 3>();
    naering.forEach((n, i) => {
      const { segment, avvik: a } = segmentFor(n.kode, n.tittel, T.naering);
      if (a && !segmentAvvik.has(`${n.kode}|${n.tittel}`)) {
        segmentAvvik.add(`${n.kode}|${n.tittel}`);
        nyttAvvik({
          kategori: "naeringskoder",
          gjelder: `${n.kode} (${pentOrgNavn(navn, F.navneformer)}, ${orgnr})`,
          grunnlaget: `Tabellen venter «${a.tittel}» for ${a.prefiks} → ${a.segment}`,
          registeret: `«${n.tittel}»`,
          tiltak:
            "Ikke gitt segment. Les hva koden heter i SN2025 og rett src/data/brreg/nace-segment.json.",
        });
      }
      if (segment) {
        const styrke = i === 0 ? 3 : 2;
        if ((ut.get(segment) ?? 0) < styrke) ut.set(segment, styrke);
      }
    });
    return [...ut].map(([segment, styrke]) => ({ segment, styrke }));
  };

  /**
   * Hvorfor organet er med, maskinlesbart først i merknaden: «Utvalg:
   * ansatte>=50, omsetning>=100000000:2025.» For et organ i kommunen er det
   * utvalgsregelen; for et organ utenfor er det sammenhengen (overordnet til en
   * underenhet her, styreplass i et organ her, alltid med).
   */
  const utvalgsmerknad = (orgnr: string, status: string[]): string =>
    [
      `Utvalg: ${[...new Set([...grunner(orgnr), ...(kontekst.get(orgnr) ?? [])])].join(", ") || "–"}.`,
      ...status,
    ].join(" ");

  const nyeOrg: Organisasjon[] = [];
  const nyeSeg: OrgSegment[] = [];
  const nyeRel: Relasjon[] = [];
  const kopiOrg: Organisasjon[] = [];
  const kopiSeg: OrgSegment[] = [];
  const kopiRel: Relasjon[] = [];
  const kopiKilder = new Set<string>();
  const typeFor = new Map<string, Organtype>();
  const kanoniske = new Map<string, { org: Organisasjon; seg: OrgSegment[] }>(); // key → rad dette datasettet eier

  const nivaaOgType = (e: Enhet) => {
    const r = formRegel(e) as OrgformRegel;
    const nivaa = (e.sektor && r.nivaa_fra_sektor?.[e.sektor]) || r.nivaa;
    let organtype = r.organtype;
    const stort = e.navn.toUpperCase().trim();
    for (const s of r.organtype_fra_navn ?? []) {
      if (stort.endsWith(` ${s.suffiks}`)) {
        organtype = s.organtype;
        break;
      }
    }
    return { nivaa, organtype };
  };

  // Grunnlagsrader fra andre datasett: raden, segmentene, kjeden av
  // overordnede med relasjonene, og kildene, nøyaktig som i originalen.
  const kopier_ = (slugA: string, org: Organisasjon) => {
    const a = andre.find((x) => x.slug === slugA)!.data;
    let o: Organisasjon | undefined = org;
    while (o && !kopiOrg.some((x) => x.key === o!.key) && !gOrgKeys.has(o.key)) {
      kopiOrg.push(o);
      kopiKilder.add(o.belegg.kilde);
      kopiSeg.push(...a.org_segment.filter((s) => s.org === o!.key));
      if (!o.overordnet) break;
      const rel = a.relasjoner.find(
        (r) => r.type === "overordnet" && r.fra === o!.key && r.til === o!.overordnet,
      );
      if (rel) {
        kopiRel.push(rel);
        kopiKilder.add(rel.belegg.kilde);
      }
      o = a.organisasjoner.find((x) => x.key === o!.overordnet);
    }
  };
  for (const [, k] of sortert([...kopiPaaOrgnr], ([o]) => o)) kopier_(k.slug, k.org);

  for (const e of sortert(nyeEnheter, (x) => x.orgnr)) {
    const key = nokkelFor.get(e.orgnr)!;
    const hjemme = lokasjon(e.orgnr) === K.kommunenr;
    const kjent = andreGenerert.get(e.orgnr);
    // Et organ i en annen kommune tas med som den kanoniske raden derfra når den finnes.
    if (!hjemme && kjent && kjent.org.key === key) {
      nyeOrg.push(kjent.org);
      nyeSeg.push(...kjent.seg);
      typeFor.set(key, kjent.org.organtype);
      continue;
    }
    const { nivaa, organtype: grunntype } = nivaaOgType(e);
    const sens = sensitivType(e.navn, e.naering, F);
    const organtype = sens ?? grunntype;
    typeFor.set(key, organtype);
    const segmenter = sens ? [] : segmenterFor(e.naering, e.navn, e.orgnr);
    const nk = e.naering[0];
    const status = [
      e.slettet ? `Slettet i Enhetsregisteret ${e.slettet}.` : "",
      e.konkurs ? "Konkurs er registrert i Enhetsregisteret." : "",
      e.underAvvikling ? "Under avvikling ifølge Enhetsregisteret." : "",
    ].filter(Boolean);
    const o: Organisasjon = {
      key,
      orgnr: e.orgnr,
      navn: pentOrgNavn(e.navn, F.navneformer),
      nivaa,
      organtype,
      ...(e.kommunenr ? { kommunenr: e.kommunenr } : {}),
      myndighet: [],
      segmenter: segmenter.map((s) => s.segment),
      ...(e.stiftet && ISO.test(e.stiftet) ? { gyldig_fra: e.stiftet } : {}),
      ...(e.slettet && ISO.test(e.slettet) ? { gyldig_til: e.slettet } : {}),
      status: e.slettet ? "nedlagt" : "aktiv",
      sensitiv: sens !== null,
      beskrivelse:
        `${e.orgformNavn ?? e.orgform} registrert i Enhetsregisteret` +
        (nk ? ` med næringskode ${nk.kode} «${nk.tittel}».` : "."),
      belegg: beleggEnhet(utvalgsmerknad(e.orgnr, status)),
    };
    const seg = segmenter.map((s): OrgSegment => ({
      org: key,
      segment: s.segment,
      styrke: s.styrke,
    }));
    nyeOrg.push(o);
    nyeSeg.push(...seg);
    if (hjemme) kanoniske.set(key, { org: o, seg });
  }

  for (const { u, forelder } of sortert(nyeUnderenheter, (x) => x.u.orgnr)) {
    const key = nokkelFor.get(u.orgnr)!;
    const fKey = nokkelFor.get(forelder.orgnr)!;
    const fGrunn = grunnOrg(fKey) ?? kopiOrg.find((o) => o.key === fKey);
    const fNy = nyeOrg.find((o) => o.key === fKey);
    const nivaa = fGrunn?.nivaa ?? fNy?.nivaa ?? "privat";
    const sens =
      sensitivType(u.navn, u.naering, F) ??
      (fGrunn?.sensitiv || fNy?.sensitiv ? (fGrunn?.organtype ?? fNy?.organtype ?? null) : null);
    const organtype = sens ?? fGrunn?.organtype ?? fNy?.organtype ?? "AS";
    const segmenter = sens ? [] : segmenterFor(u.naering, u.navn, u.orgnr);
    const nk = u.naering[0];
    const o: Organisasjon = {
      key,
      orgnr: u.orgnr,
      navn: pentOrgNavn(u.navn, F.navneformer),
      nivaa,
      organtype,
      overordnet: fKey,
      ...(u.kommunenr ? { kommunenr: u.kommunenr } : {}),
      myndighet: [],
      segmenter: segmenter.map((s) => s.segment),
      ...(u.oppstart && ISO.test(u.oppstart) ? { gyldig_fra: u.oppstart } : {}),
      status: "aktiv",
      sensitiv: sens !== null,
      beskrivelse:
        `Arbeidssted i ${D.meta.kommune} for ${fGrunn?.navn ?? fNy?.navn ?? pentOrgNavn(forelder.navn, F.navneformer)}` +
        (nk ? `, med næringskode ${nk.kode} «${nk.tittel}».` : "."),
      belegg: beleggEnhet(utvalgsmerknad(u.orgnr, [])),
    };
    const seg = segmenter.map((s): OrgSegment => ({
      org: key,
      segment: s.segment,
      styrke: s.styrke,
    }));
    nyeOrg.push(o);
    nyeSeg.push(...seg);
    kanoniske.set(key, { org: o, seg });
    nyeRel.push({ fra: key, til: fKey, type: "overordnet", belegg: beleggEnhet() });
  }

  hopp.orgform = hoppetForm.size;
  for (const [form, navnSett] of sortert([...umappet], ([f]) => f)) {
    const navn = [...navnSett].sort();
    nyttAvvik({
      kategori: "ikke_tatt_inn",
      gjelder: `Organisasjonsform ${form}`,
      grunnlaget: "–",
      registeret: `${navn.length} enheter: ${navn.slice(0, 8).join(", ")}${navn.length > 8 ? ` og ${navn.length - 8} til` : ""}`,
      tiltak: "Ikke tatt inn. Legg formen i src/data/brreg/orgform.json hvis den skal med.",
    });
  }

  // Grunnlagets organer mot registeret: finnes, status og navn.
  for (const [orgnr, key] of sortert([...grunnPaaOrgnr], ([o]) => o)) {
    const o = grunnOrg(key);
    const e = enhet(orgnr);
    if (!o) continue;
    const borte = S.ikkeFunnet.find((x) => x.orgnr === orgnr);
    if (borte) {
      nyttAvvik({
        kategori: "organer",
        gjelder: key,
        grunnlaget: `${o.navn}, orgnr ${orgnr}`,
        registeret: borte.status === 410 ? "Slettet (410)" : "Finnes ikke (404)",
        tiltak: "Sjekk orgnr i grunnlaget.",
      });
      continue;
    }
    if (!e) continue;
    const status = e.slettet
      ? `slettet ${e.slettet}`
      : e.konkurs
        ? "konkurs"
        : e.underAvvikling
          ? "under avvikling"
          : null;
    if (status && o.status === "aktiv") {
      nyttAvvik({
        kategori: "organer",
        gjelder: key,
        grunnlaget: `${o.navn} er aktiv`,
        registeret: `${e.navn} (${orgnr}) er ${status}`,
        tiltak: "Grunnlaget står. Vurder status og gyldig_til.",
      });
    }
    if (!kobletPaaNavn.has(orgnr) && orgNavnNokkel(o.navn) !== orgNavnNokkel(e.navn)) {
      nyttAvvik({
        kategori: "organer",
        gjelder: key,
        grunnlaget: o.navn,
        registeret: `${e.navn} (${orgnr})`,
        tiltak: "Ulikt navn på samme orgnr. Sjekk at orgnr er riktig.",
      });
    }
  }

  // Mulige dubletter: nye organer som ligner grunnlagets organer uten orgnr.
  for (const o of sortert(nyeOrg, (x) => x.key)) {
    const ny = orgNavnNokkel(o.navn).split(" ");
    for (const g of gOrg) {
      if (g.orgnr || orgnrForGrunn.has(g.key)) continue;
      const gamle = orgNavnNokkel(g.navn).split(" ");
      const [kort, lang] = gamle.length <= ny.length ? [gamle, ny] : [ny, gamle];
      if (kort.some((w) => w.length >= 4) && kort.every((w) => lang.includes(w))) {
        nyttAvvik({
          kategori: "organer",
          gjelder: g.key,
          grunnlaget: g.navn,
          registeret: `${o.navn} (${o.orgnr}) er lagt til som ${o.key}`,
          tiltak: "Mulig samme organ. Er det det, legg orgnr i grunnlaget eller i koblinger.",
        });
      }
    }
  }

  // --- 6. Roller ------------------------------------------------------------

  const rolleorganer: Rolleorgan[] = [];
  for (const e of e1) {
    const key = nokkelFor.get(e.orgnr);
    const roller = S.roller[e.orgnr];
    if (!key || !roller) continue;
    const g = grunnOrg(key);
    const sensitiv = erSensitiv(e.orgnr, e);
    const organtype =
      g?.organtype ?? kopiPaaOrgnr.get(e.orgnr)?.org.organtype ?? typeFor.get(key) ?? "AS";
    const personroller: Rolle[] = [];
    const styreplasser: Rolle[] = [];
    for (const r of roller) {
      if (r.fratradt || r.avregistrert) {
        hopp.fratradt++;
        continue;
      }
      if (r.person?.doed) {
        hopp.doed++;
        continue;
      }
      if (r.enhet) {
        if (!sensitiv && (r.kode === "LEDE" || r.kode === "NEST" || r.kode === "MEDL"))
          styreplasser.push(r);
        else hopp.enhetsroller++;
        continue;
      }
      if (sensitiv && r.kode !== "DAGL") {
        hopp.sensitive++;
        continue;
      }
      personroller.push(r);
    }
    rolleorganer.push({
      key,
      enhet: e,
      sensitiv,
      organtype,
      eier: eierHer(e.orgnr),
      personroller,
      styreplasser,
    });
  }
  const rolleorganPaaKey = new Map(rolleorganer.map((r) => [r.key, r]));

  // Administrasjonen under et rolleorgan: kommunedirektøren står i grunnlaget
  // som toppleder i «Administrasjonen i Tromsø kommune», og i registeret som
  // daglig leder i TROMSØ KOMMUNE. Bare administrasjonsorganer uten eget
  // orgnr, og bare toppleder: et KF eller AS under kommunen har egen daglig leder.
  const viaForelder = new Map<string, Rolleorgan>();
  for (const o of gOrg) {
    const ro = o.overordnet ? rolleorganPaaKey.get(o.overordnet) : undefined;
    if (ro && o.organtype === "administrasjon" && !o.orgnr && !orgnrForGrunn.has(o.key))
      viaForelder.set(o.key, ro);
  }
  const organFor = (r: Rolleinnehav, kode: Rollekode): Rolleorgan | undefined =>
    rolleorganPaaKey.get(r.org) ??
    (kode === "DAGL" && r.rolletype === "toppleder" ? viaForelder.get(r.org) : undefined);

  interface Kandidat {
    i: number;
    pid: string;
    b: Rolle | null; // null = bare identitet (annen rolle i samme organ)
  }
  const kandidater: Kandidat[] = [];
  const ubekreftet: { i: number; ro: Rolleorgan; kode: Rollekode }[] = [];
  const tvetydigeRader = new Set<number>();

  gRoller.forEach((r, i) => {
    const kode = kodeFor(r.rolletype);
    if (!kode) {
      // En rolle Brreg ikke fører (administrasjonsdirektør, prorektor): ikke noe å
      // bekrefte, men samme navn i samme organ er samme person.
      const ro = r.til === undefined ? rolleorganPaaKey.get(r.org) : undefined;
      const navn = personnavn.get(r.person) ?? r.person;
      const pids = [
        ...new Set(
          (ro?.personroller ?? [])
            .filter((b) => navnKanVaereSamme(navn, b.person!.navn))
            .map((b) => b.person!.pid),
        ),
      ];
      if (pids.length === 1 && pids[0]) kandidater.push({ i, pid: pids[0], b: null });
      return;
    }
    const ro = organFor(r, kode);
    if (!ro) return;
    const navn = personnavn.get(r.person) ?? r.person;
    const kompatible = ro.personroller.filter((b) => b.kode === kode);
    if (r.til !== undefined) {
      const fortsatt = kompatible.filter((b) => navnKanVaereSamme(navn, b.person!.navn));
      if (fortsatt.length > 0) {
        nyttAvvik({
          kategori: "roller",
          gjelder: `${ro.key}: ${TITTEL[kode].toLowerCase()}`,
          grunnlaget: `${navn} (${r.person}) sluttet ${r.til} (${kildenavn(r.belegg.kilde)})`,
          registeret: `${fortsatt.map((b) => b.person!.navn).join(", ")} står fortsatt som ${TITTEL[kode].toLowerCase()} per ${dato}`,
          tiltak: "Grunnlaget står. Registeret kan henge etter; sjekk.",
        });
      }
      return;
    }
    let treff = kompatible.filter((b) => navnKanVaereSamme(navn, b.person!.navn));
    const eksakt = treff.filter((b) => sammeNavn(navn, b.person!.navn));
    if (eksakt.length > 0) treff = eksakt;
    const pids = [...new Set(treff.map((b) => b.person!.pid))];
    const [pid] = pids;
    if (pids.length === 1 && pid) {
      kandidater.push({ i, pid, b: treff.find((b) => b.person!.pid === pid)! });
      return;
    }
    if (pids.length > 1) {
      tvetydigeRader.add(i);
      nyttAvvik({
        kategori: "personer",
        gjelder: `${r.person} (${ro.key})`,
        grunnlaget: `${navn}, ${r.tittel}`,
        registeret: `Flere personer med passende navn: ${treff.map((b) => b.person!.navn).join(", ")}`,
        tiltak: "Ikke bekreftet. Avgjør hvem grunnlaget mener.",
      });
      return;
    }
    // Samme navn i en annen rolle i samme organ: samme person, annen rolle.
    const annen = ro.personroller.filter(
      (b) => b.kode !== kode && navnKanVaereSamme(navn, b.person!.navn),
    );
    const annenPids = [...new Set(annen.map((b) => b.person!.pid))];
    const [annenPid] = annenPids;
    if (annenPids.length === 1 && annenPid) kandidater.push({ i, pid: annenPid, b: null });
    ubekreftet.push({ i, ro, kode });
  });

  // 1:1 mellom pid og person i grunnlaget, ellers ingen kobling.
  const pidTilKeys = new Map<string, Set<string>>();
  const keyTilPids = new Map<string, Set<string>>();
  for (const k of kandidater) {
    const key = gRoller[k.i]!.person;
    pidTilKeys.set(k.pid, (pidTilKeys.get(k.pid) ?? new Set()).add(key));
    keyTilPids.set(key, (keyTilPids.get(key) ?? new Set()).add(k.pid));
  }
  const pidLenke = new Map<string, string>();
  const bekreftetRad = new Map<number, Rolle>();
  const brukteRoller = new Set<Rolle>();
  const meldtTvetydig = new Set<string>();
  for (const k of kandidater) {
    const key = gRoller[k.i]!.person;
    if (pidTilKeys.get(k.pid)!.size === 1 && keyTilPids.get(key)!.size === 1) {
      pidLenke.set(k.pid, key);
      if (k.b) {
        bekreftetRad.set(k.i, k.b);
        brukteRoller.add(k.b);
      }
    } else if (!meldtTvetydig.has(key)) {
      meldtTvetydig.add(key);
      nyttAvvik({
        kategori: "personer",
        gjelder: key,
        grunnlaget: personnavn.get(key) ?? key,
        registeret:
          "Navnet passer på flere personer i registeret, eller flere personer i grunnlaget passer på én i registeret",
        tiltak: "Ikke koblet. Avgjør hvem som er hvem.",
      });
    }
  }

  const oppgrader = (b: Belegg, kilde: string, ekstra = ""): Belegg => {
    if (erOppgradert(b)) return { ...b, kilde, per: dato };
    const opphav = `${BEKREFTER} (${kildenavn(b.kilde)}${b.per ? `, per ${b.per}` : ""}).`;
    return {
      kilde,
      verifisering: "verifisert",
      per: dato,
      merknad: [opphav, ekstra, b.merknad ? `Grunnlagets merknad: ${b.merknad}` : ""]
        .filter(Boolean)
        .join(" "),
    };
  };
  const nedgrader = (b: Belegg): Belegg => ({
    kilde: b.kilde,
    verifisering: "maa_verifiseres",
    ...(b.per ? { per: b.per } : {}),
    merknad:
      `Registeret bekreftet dette per ${b.per ?? "?"}, men viser det ikke per ${dato}. ${b.merknad ?? ""}`.trim(),
  });

  let bekreftedeRoller = 0;
  let motsagteRoller = 0;
  gRoller = gRoller.map((r, i) => {
    if (bekreftetRad.has(i)) {
      bekreftedeRoller++;
      return { ...r, belegg: oppgrader(r.belegg, KILDER.roller.key) };
    }
    return r;
  });
  for (const { i, ro, kode } of ubekreftet) {
    if (tvetydigeRader.has(i)) continue;
    const r = gRoller[i]!;
    const navn = personnavn.get(r.person) ?? r.person;
    const kompatible = ro.personroller.filter((b) => b.kode === kode);
    const annen = ro.personroller.filter(
      (b) => b.kode !== kode && navnKanVaereSamme(navn, b.person!.navn),
    );
    const somAnnen = annen.length
      ? ` ${navn} står som ${[...new Set(annen.map((b) => TITTEL[b.kode].toLowerCase()))].join(" og ")}.`
      : "";
    if (erOppgradert(r.belegg)) {
      gRoller[i] = { ...r, belegg: nedgrader(r.belegg) };
    }
    if (kompatible.length === 0 && !REGISTERTYPER.has(r.rolletype) && !somAnnen) continue;
    motsagteRoller++;
    nyttAvvik({
      kategori: "roller",
      gjelder: `${ro.key}: ${TITTEL[kode].toLowerCase()}`,
      grunnlaget: `${navn} (${r.person}), «${r.tittel}» (${kildenavn(r.belegg.kilde)}${r.belegg.per ? `, per ${r.belegg.per}` : ""})`,
      registeret:
        (kompatible.length > 0
          ? `${TITTEL[kode]}: ${kompatible.map((b) => b.person!.navn).join(", ")}.`
          : `Ingen ${TITTEL[kode].toLowerCase()} registrert.`) + somAnnen,
      tiltak:
        kompatible.length > 0 && ro.eier
          ? "Grunnlagets påstand står. Registerets er lagt til ved siden av, merket verifisert."
          : "Grunnlagets påstand står.",
    });
  }

  // Personnøkler for registerpersonene i organene datasettet eier.
  const pidNavn = new Map<string, string>();
  for (const ro of rolleorganer) {
    if (!ro.eier) continue;
    for (const b of ro.personroller)
      if (!pidNavn.has(b.person!.pid)) pidNavn.set(b.person!.pid, b.person!.navn);
  }
  const personlenker = new Map<string, Person>();
  for (const [pid, key] of pidLenke)
    personlenker.set(pid, { key, navn: personnavn.get(key) ?? key });
  const pidKey = new Map<string, string>();
  const personrader = new Map<string, Person>(); // key → rad for personer som ikke er grunnlagets her
  for (const [pid, key] of pidLenke) pidKey.set(pid, key);
  for (const [pid] of pidNavn) {
    if (pidKey.has(pid)) continue;
    const kjent = register.get(pid);
    if (kjent) {
      pidKey.set(pid, kjent.key);
      if (!gPersonKeys.has(kjent.key)) personrader.set(kjent.key, kjent);
    }
  }
  const grunnSlugs = new Map<string, string>();
  for (const p of gPersoner) {
    grunnSlugs.set(slug(p.navn), p.key);
    grunnSlugs.set(p.key, p.key);
  }
  const brukte = new Set([
    ...gPersonKeys,
    ...tattePersoner,
    ...[...register.values()].map((p) => p.key),
  ]);
  const grupper = new Map<string, string[]>();
  for (const [pid, navn] of sortert([...pidNavn], ([p]) => p)) {
    if (pidKey.has(pid)) continue;
    const base = slug(navn) || "person";
    grupper.set(base, [...(grupper.get(base) ?? []), pid]);
  }
  const nyePersoner: Person[] = [];
  const holdtTilbake = new Set<string>();
  for (const [base, pids] of sortert([...grupper], ([b]) => b)) {
    const kollisjon = pids.length > 1 || brukte.has(base) || grunnSlugs.has(base);
    let lengde = 6;
    while (new Set(pids.map((p) => p.slice(0, lengde))).size < pids.length) lengde += 2;
    for (const pid of pids) {
      const key = kollisjon ? `${base}-${pid.slice(0, lengde)}` : base;
      const maal = K.samme_person[key];
      if (maal !== undefined) {
        if (!gPersonKeys.has(maal))
          throw new Error(`samme_person: «${maal}» finnes ikke blant grunnlagets personer.`);
        pidKey.set(pid, maal);
        continue;
      }
      if (gPersonKeys.has(key))
        throw new Error(`Personnøkkelen ${key} er allerede i bruk i grunnlaget.`);
      // En navnebror av en person i grunnlaget holdes tilbake til et menneske
      // har avgjort det. To poster med samme navn ville gjort en innsigelse
      // halv: sperres den ene, står navnet fortsatt i den andre.
      const lik = grunnSlugs.get(base);
      if (lik && !K.ulik_person.includes(key)) {
        holdtTilbake.add(pid);
        hopp.navnebror++;
        nyttAvvik({
          kategori: "personer",
          gjelder: key,
          grunnlaget: `${personnavn.get(lik) ?? lik} (${lik})`,
          registeret: `${pidNavn.get(pid)} har roller i registeret, men deler ikke organ med personen i grunnlaget`,
          tiltak:
            `Ikke tatt inn. Er det samme person, legg "${key}": "${lik}" i samme_person; ` +
            `er det en annen, legg "${key}" i ulik_person.`,
        });
        continue;
      }
      pidKey.set(pid, key);
      nyePersoner.push({ key, navn: pidNavn.get(pid)! });
    }
  }
  for (const p of personrader.values()) nyePersoner.push(p);

  // Rolleradene fra registeret, bare for organer datasettet eier.
  const rolletypeFor = (kode: Rollekode, ro: Rolleorgan): Rolletype => {
    if (kode === "DAGL") {
      if (!ro.sensitiv) return "daglig_leder";
      return ro.organtype === "domstol"
        ? "dommer_leder"
        : ro.organtype === "paatale"
          ? "paatale_leder"
          : "toppleder";
    }
    return (
      { LEDE: "styreleder", NEST: "nestleder", MEDL: "styremedlem", VARA: "varamedlem" } as const
    )[kode];
  };
  const grunnRolleNokler = new Set(gRoller.map(nokkel.rolle));
  const nyeRoller = new Map<string, Rolleinnehav>();
  for (const ro of sortert(rolleorganer, (x) => x.key)) {
    if (!ro.eier) continue;
    for (const b of ro.personroller) {
      if (brukteRoller.has(b) || holdtTilbake.has(b.person!.pid)) continue;
      const person = pidKey.get(b.person!.pid)!;
      const rad: Rolleinnehav = {
        org: ro.key,
        person,
        tittel: TITTEL[b.kode] + (b.valgtAv === "AREP" ? " (valgt av de ansatte)" : ""),
        rolletype: rolletypeFor(b.kode, ro),
        status: b.kode === "VARA" ? "vara" : "fast",
        belegg: { kilde: KILDER.roller.key, verifisering: "verifisert", per: dato },
      };
      const n = nokkel.rolle(rad);
      if (grunnRolleNokler.has(n)) {
        nyttAvvik({
          kategori: "ikke_tatt_inn",
          gjelder: `${ro.key}: ${rad.tittel.toLowerCase()}`,
          grunnlaget: "Grunnlaget har en rolle med samme nøkkel (organ, person, rolletype, fra)",
          registeret: `${b.person!.navn}, ${rad.tittel.toLowerCase()} per ${dato}`,
          tiltak: "Ikke lagt til. Se avviket over for samme rolle.",
        });
        continue;
      }
      if (!nyeRoller.has(n)) nyeRoller.set(n, rad);
    }
    for (const r of ro.styreplasser) {
      const fra = nokkelFor.get(r.enhet!.orgnr);
      if (!fra || fra === ro.key) continue;
      const rel: Relasjon = {
        fra,
        til: ro.key,
        type: "medlem_av",
        belegg: {
          kilde: KILDER.roller.key,
          verifisering: "verifisert",
          per: dato,
          merknad: `Styreplass i Enhetsregisteret: ${TITTEL[r.kode].toLowerCase()}.`,
        },
      };
      const n = nokkel.relasjon(rel);
      if (
        !gRel.some((x) => nokkel.relasjon(x) === n) &&
        !nyeRel.some((x) => nokkel.relasjon(x) === n)
      )
        nyeRel.push(rel);
    }
  }

  // --- 7. Regnskap ----------------------------------------------------------

  const figurer: Figur[] = [];
  const nyeHull: Hull[] = [];
  const regnskapsaar = new Map<string, Set<number>>();
  const eide = new Set(rolleorganer.filter((r) => r.eier).map((r) => r.key));
  for (const e of e1) {
    const key = nokkelFor.get(e.orgnr);
    if (key && eierHer(e.orgnr)) eide.add(key);
  }
  for (const e of e1) {
    const key = nokkelFor.get(e.orgnr);
    const liste = S.regnskap[e.orgnr];
    if (!key || !liste) continue;
    const eierDette = eierHer(e.orgnr);
    const siste = new Map<string, (typeof liste)[number]>();
    for (const r of liste) {
      const k = `${r.til.slice(0, 4)}|${r.type}`;
      const f = siste.get(k);
      if (!f || f.til < r.til) siste.set(k, r);
    }
    for (const r of sortert([...siste.values()], (x) => `${x.til}|${x.type}`)) {
      const aar = Number(r.til.slice(0, 4));
      const konsern = r.type === "KONSERN";
      regnskapsaar.set(key, (regnskapsaar.get(key) ?? new Set()).add(aar));
      if (r.valuta !== "NOK") {
        if (eierDette)
          nyeHull.push({
            gjelder: key,
            hva: `Regnskapstallene for ${aar}${konsern ? " (konsern)" : ""} er ført i ${r.valuta}.`,
            hvorfor: VALUTA_HVORFOR,
          });
        continue;
      }
      if (aar > sammenstiltAar) {
        nyttAvvik({
          kategori: "ikke_tatt_inn",
          gjelder: key,
          grunnlaget: `Datasettet er sammenstilt ${D.meta.sammenstilt}`,
          registeret: `Regnskap for ${aar}`,
          tiltak: "Ikke tatt inn: regnskapsåret er etter sammenstillingen.",
        });
        continue;
      }
      const kalenderaar = r.fra === `${aar}-01-01` && r.til === `${aar}-12-31`;
      const merknad = [
        konsern
          ? "Konsernregnskap."
          : r.morselskap
            ? "Morselskapets eget regnskap, ikke konsern."
            : "Selskapsregnskap.",
        kalenderaar ? "" : `Regnskapsperioden er ${r.fra ?? "?"}–${r.til}.`,
      ]
        .filter(Boolean)
        .join(" ");
      for (const type of TALLTYPER) {
        const verdi = r[type];
        if (verdi === null) continue;
        figurer.push({ org: key, aar, type, konsern, verdi, merknad, matchet: false });
      }
    }
  }
  figurer.sort((a, b) =>
    cmp(
      `${a.org}|${a.aar}|${a.type}|${Number(a.konsern)}`,
      `${b.org}|${b.aar}|${b.type}|${Number(b.konsern)}`,
    ),
  );

  const likt = (n: Nokkeltall, f: Figur) =>
    n.org === f.org && n.aar === f.aar && n.type === f.type && n.periode === undefined;
  const brukteTall = new Set<number>();
  const bekreftetTall = new Map<number, Figur>();
  let motsagteTall = 0;
  const konsernTekst = (k: boolean | undefined) =>
    k === undefined ? "" : k ? " (konsern)" : " (selskap)";
  for (const f of figurer) {
    const i = gTall.findIndex(
      (n, j) => !brukteTall.has(j) && likt(n, f) && n.konsern === f.konsern,
    );
    if (i < 0) continue;
    brukteTall.add(i);
    f.matchet = true;
    const n = gTall[i]!;
    if (sammeTall(n.verdi, f.verdi)) bekreftetTall.set(i, f);
    else {
      motsagteTall++;
      nyttAvvik({
        kategori: "nokkeltall",
        gjelder: `${f.org}: ${f.type} ${f.aar}${konsernTekst(f.konsern)}`,
        grunnlaget: `${kr(n.verdi)} (${kildenavn(n.belegg.kilde)})`,
        registeret: `${kr(f.verdi)} per ${dato}`,
        tiltak:
          "Grunnlagets tall står. Registertallet er ikke lagt til fordi det ville fått samme nøkkel; rett grunnlaget.",
      });
      if (erOppgradert(n.belegg)) gTall[i] = { ...n, belegg: nedgrader(n.belegg) };
    }
  }
  for (const f of figurer) {
    if (f.matchet) continue;
    const i = gTall.findIndex(
      (n, j) =>
        !brukteTall.has(j) && likt(n, f) && n.konsern === undefined && sammeTall(n.verdi, f.verdi),
    );
    if (i < 0) continue;
    brukteTall.add(i);
    f.matchet = true;
    bekreftetTall.set(i, f);
  }
  gTall.forEach((n, i) => {
    if (brukteTall.has(i) || n.periode !== undefined) return;
    if (!regnskapsaar.get(n.org)?.has(n.aar)) return;
    if (!(TALLTYPER as readonly string[]).includes(n.type)) return;
    const fra = figurer.filter(
      (f) =>
        f.org === n.org &&
        f.aar === n.aar &&
        f.type === n.type &&
        (n.konsern === undefined || f.konsern === n.konsern),
    );
    if (erOppgradert(n.belegg)) gTall[i] = { ...n, belegg: nedgrader(n.belegg) };
    if (fra.length === 0) return;
    motsagteTall++;
    nyttAvvik({
      kategori: "nokkeltall",
      gjelder: `${n.org}: ${n.type} ${n.aar}${konsernTekst(n.konsern)}`,
      grunnlaget: `${kr(n.verdi)} (${kildenavn(n.belegg.kilde)})`,
      registeret:
        fra.map((f) => `${kr(f.verdi)}${konsernTekst(f.konsern)}`).join(", ") + ` per ${dato}`,
      tiltak: eide.has(n.org)
        ? "Grunnlagets tall står. Registertallet er lagt til ved siden av, merket verifisert."
        : "Grunnlagets tall står.",
    });
  });
  let bekreftedeTall = 0;
  gTall = gTall.map((n, i) => {
    const f = bekreftetTall.get(i);
    if (!f) return n;
    bekreftedeTall++;
    const ekstra = [
      n.verdi !== f.verdi ? `Grunnlaget oppga ${kr(n.verdi)}, avrundet.` : "",
      n.konsern === undefined ? `Registeret: ${f.merknad.toLowerCase().replace(/\.$/, "")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      ...n,
      verdi: erOppgradert(n.belegg) ? n.verdi : f.verdi,
      belegg: oppgrader(n.belegg, KILDER.regnskap.key, ekstra),
    };
  });

  const grunnTallNokler = new Set(gTall.map(nokkel.nokkeltall));
  const nyeTall = new Map<string, Nokkeltall>();
  for (const f of figurer) {
    if (f.matchet || !eide.has(f.org)) continue;
    const rad: Nokkeltall = {
      org: f.org,
      aar: f.aar,
      type: f.type,
      verdi: f.verdi,
      enhet: "NOK",
      konsern: f.konsern,
      belegg: {
        kilde: KILDER.regnskap.key,
        verifisering: "verifisert",
        per: dato,
        merknad: f.merknad,
      },
    };
    const n = nokkel.nokkeltall(rad);
    if (!grunnTallNokler.has(n)) nyeTall.set(n, rad);
  }
  // Historikk: Regnskapsregisteret gir bare siste år. Tall fra år registeret
  // ikke lenger viser, blir stående så lenge datasettet eier organet.
  for (const n of gamleTall) {
    if (!eide.has(n.org) || regnskapsaar.get(n.org)?.has(n.aar)) continue;
    const k = nokkel.nokkeltall(n);
    if (!nyeTall.has(k) && !grunnTallNokler.has(k)) nyeTall.set(k, n);
  }
  for (const h of gamleHull) {
    const aar = Number(/(\d{4})/.exec(h.hva)?.[1] ?? 0);
    if (!eide.has(h.gjelder) || regnskapsaar.get(h.gjelder)?.has(aar)) continue;
    if (!nyeHull.some((x) => nokkel.hull(x) === nokkel.hull(h))) nyeHull.push(h);
  }

  for (const orgnr of S.regnskapUtilgjengelig) {
    const key = nokkelFor.get(orgnr);
    if (!key) continue;
    nyttAvvik({
      kategori: "ikke_tatt_inn",
      gjelder: key,
      grunnlaget: "–",
      registeret: `Regnskapsregisteret svarte med feil for ${orgnr}`,
      tiltak: "Ingen regnskapstall denne gangen. Kjør på nytt senere.",
    });
  }
  const kobledeNavn = new Set(
    [...orgnrForGrunn.keys()].map((k) => orgNavnNokkel(grunnOrg(k)?.navn ?? "")),
  );
  for (const n of S.navneoppslag) {
    if (n.grunnlag && kobledeNavn.has(orgNavnNokkel(n.navn))) continue;
    nyttAvvik({
      kategori: "koblinger",
      gjelder: n.navn,
      grunnlaget: n.grunnlag ? "Organ i grunnlaget" : "Navn i scripts/brreg.config.json",
      registeret:
        n.treff === 0
          ? "Ingen enhet med eksakt dette navnet"
          : `${n.treff} enheter med eksakt dette navnet`,
      tiltak: "Ikke tatt med. Oppgi orgnr i konfigurasjonen i stedet.",
    });
  }

  // --- 8. Sett sammen, og hold navneregelen ---------------------------------

  let orgUt = sortert(nyeOrg, (o) => o.key);
  let rollerUt = sortert([...nyeRoller.values()], nokkel.rolle);
  let relUt = sortert(nyeRel, nokkel.relasjon);
  let tallUt = sortert([...nyeTall.values()], nokkel.nokkeltall);
  let segUt = sortert(nyeSeg, nokkel.orgSegment);
  let hullUt = sortert(nyeHull, nokkel.hull);
  let personerUt = sortert(nyePersoner, (p) => p.key);
  const kopiUt = sortert(kopiOrg, (o) => o.key);
  const kopiSegUt = sortert(kopiSeg, nokkel.orgSegment);
  const kopiRelUt = sortert(kopiRel, nokkel.relasjon);

  const bygg = (): Kommunedatasett => {
    const brukteSeg = new Set([...segUt, ...kopiSegUt].map((s) => s.segment));
    const segmenter = [
      ...D.segmenter,
      ...sortert(
        [
          ...T.naering.segmenter,
          ...andre
            .flatMap((a) => a.data.segmenter)
            .filter((s) => !T.naering.segmenter.some((x) => x.kode === s.kode)),
        ].filter(
          (s, i, xs) =>
            brukteSeg.has(s.kode) &&
            !D.segmenter.some((x) => x.kode === s.kode) &&
            xs.findIndex((y) => y.kode === s.kode) === i,
        ),
        (s) => s.kode,
      ),
    ];
    const kanon: Kilde[] = Object.values(KILDER).map((k) => ({ ...k }));
    const kilder = [
      ...D.kilder.map((k) => kanon.find((x) => x.key === k.key) ?? k),
      ...kanon.filter((k) => !D.kilder.some((x) => x.key === k.key)),
      ...sortert(
        [...kopiKilder]
          .filter((k) => !D.kilder.some((x) => x.key === k) && !kanon.some((x) => x.key === k))
          .flatMap((k) => (alleKilder.has(k) ? [alleKilder.get(k)!] : [])),
        (k) => k.key,
      ),
    ];
    const refererte = new Set(rollerUt.map((r) => r.person));
    return {
      meta: D.meta,
      kilder,
      organisasjoner: [...gOrg, ...kopiUt, ...orgUt],
      personer: [...gPersoner, ...personerUt.filter((p) => refererte.has(p.key))],
      roller: [...gRoller, ...rollerUt],
      relasjoner: [...gRel, ...kopiRelUt, ...relUt],
      nokkeltall: [...gTall, ...tallUt],
      hendelser: D.hendelser,
      prosesser: D.prosesser,
      segmenter,
      org_segment: [...gSeg, ...kopiSegUt, ...segUt],
      hull: [...gHull, ...hullUt],
    };
  };

  const nyePersonKeys = new Set(nyePersoner.map((p) => p.key));
  const fjernOrg = (key: string) => {
    const borte = new Set([key]);
    let endret = true;
    while (endret) {
      endret = false;
      for (const o of orgUt)
        if (o.overordnet && borte.has(o.overordnet) && !borte.has(o.key)) {
          borte.add(o.key);
          endret = true;
        }
    }
    orgUt = orgUt.filter((o) => !borte.has(o.key));
    rollerUt = rollerUt.filter((r) => !borte.has(r.org));
    relUt = relUt.filter((r) => !borte.has(r.fra) && !borte.has(r.til));
    tallUt = tallUt.filter((n) => !borte.has(n.org));
    segUt = segUt.filter((s) => !borte.has(s.org));
    hullUt = hullUt.filter((h) => !borte.has(h.gjelder));
    for (const k of borte) kanoniske.delete(k);
    return borte;
  };

  let ut = bygg();
  for (let runde = 0; runde < 20; runde++) {
    const brudd = navneBrudd(ut);
    if (brudd.length === 0) break;
    for (const b of brudd) {
      if (nyePersonKeys.has(b.person)) {
        if (!rollerUt.some((r) => r.person === b.person)) continue;
        const navn = nyePersoner.find((p) => p.key === b.person)?.navn ?? b.person;
        rollerUt = rollerUt.filter((r) => r.person !== b.person);
        personerUt = personerUt.filter((p) => p.key !== b.person);
        blokkert.add(b.person);
        hopp.navnITekst++;
        nyttAvvik({
          kategori: "ikke_tatt_inn",
          gjelder: b.person,
          grunnlaget: `Teksten i ${b.eier} ${b.nokkel} nevner ${navn} uten å lenke til denne personen`,
          registeret: `${navn} har roller i registeret`,
          tiltak:
            "Rollene er ikke tatt inn. Lenk teksten til riktig person, eller bruk samme_person.",
        });
      } else if (b.eier === "organisasjon" && nyeOrg.some((o) => o.key === b.nokkel)) {
        const o = orgUt.find((x) => x.key === b.nokkel);
        if (!o) continue;
        const borte = fjernOrg(b.nokkel);
        hopp.navnITekst++;
        nyttAvvik({
          kategori: "ikke_tatt_inn",
          gjelder: `${o.navn} (${o.orgnr ?? "–"})`,
          grunnlaget: `Navnet eller beskrivelsen inneholder navnet til ${b.person}`,
          registeret: `Organet${borte.size > 1 ? ` og ${borte.size - 1} underordnede` : ""} er ikke tatt inn`,
          tiltak:
            "Et organ som bærer et personnavn, kan ikke lenkes til personen. Vurder for hånd.",
        });
      } else {
        throw new Error(
          `Navneregelen er brutt: ${b.eier} ${b.nokkel} nevner ${b.person} uten lenke. Rett datasettet.`,
        );
      }
    }
    ut = bygg();
  }

  // --- 9. Felles organer i de andre datasettene ------------------------------
  //
  // Et organ som står i flere kommuner, må stå likt i alle, ellers stopper
  // samle.ts. Datasettet som eier organet, skriver den kanoniske raden inn i
  // de andre, og tar bort importerte roller, regnskap og styreplasser for
  // organet der: de føres bare hos eieren.
  const andreOppdatert = new Map<string, Kommunedatasett>();
  const eideNokler = new Set([...eide].filter((k) => ut.organisasjoner.some((o) => o.key === k)));
  for (const a of andre) {
    const d = a.data;
    let endret = false;
    const gen = new Set(d.organisasjoner.filter((o) => erGenerert(o.belegg)).map((o) => o.key));
    const organisasjoner = d.organisasjoner.map((o) => {
      const k = gen.has(o.key) ? kanoniske.get(o.key) : undefined;
      if (k && json(k.org) !== json(o)) {
        endret = true;
        return k.org;
      }
      return o;
    });
    let org_segment = d.org_segment;
    const berorte = [...kanoniske.keys()].filter((k) => gen.has(k));
    if (berorte.length > 0) {
      const foran = d.org_segment.filter((s) => !gen.has(s.org));
      const bak = [
        ...d.org_segment.filter((s) => gen.has(s.org) && !kanoniske.has(s.org)),
        ...berorte.flatMap((k) => kanoniske.get(k)!.seg),
      ];
      const ny = [...foran, ...sortert(bak, nokkel.orgSegment)];
      if (json(ny) !== json(d.org_segment)) {
        org_segment = ny;
        endret = true;
      }
    }
    const fjern = <X>(xs: X[], treff: (x: X) => boolean) => {
      const ut = xs.filter((x) => !treff(x));
      if (ut.length !== xs.length) endret = true;
      return ut;
    };
    const roller = fjern(d.roller, (r) => erGenerert(r.belegg) && eideNokler.has(r.org));
    const nokkeltall = fjern(d.nokkeltall, (n) => erGenerert(n.belegg) && eideNokler.has(n.org));
    const hull = fjern(d.hull, (h) => erGenerertHull(h) && eideNokler.has(h.gjelder));
    const relasjoner = fjern(
      d.relasjoner,
      (r) => erGenerert(r.belegg) && r.type === "medlem_av" && eideNokler.has(r.til),
    );
    if (!endret) continue;
    const brukt = new Set([
      ...roller.map((r) => r.person),
      ...d.hendelser.flatMap((h) => h.personer ?? []),
      ...hull.flatMap((h) => h.personer ?? []),
    ]);
    andreOppdatert.set(a.slug, {
      ...d,
      organisasjoner,
      org_segment,
      roller,
      nokkeltall,
      hull,
      relasjoner,
      personer: d.personer.filter((p) => brukt.has(p.key)),
    });
  }

  // Tellinger.
  const antallGenerert = <X>(xs: X[], belegg: (x: X) => Belegg) =>
    xs.filter((x) => erGenerert(belegg(x))).length;
  const personnokler = new Map<string, Person>();
  const iUt = new Map(ut.personer.map((p) => [p.key, p]));
  for (const [pid, key] of pidKey) {
    const p = iUt.get(key);
    if (p) personnokler.set(pid, p);
  }
  const oppsummering: Oppsummering = {
    kommunenr: D.meta.kommunenr,
    kommune: D.meta.kommune,
    hentet: dato,
    hentetFra: {
      enheterIKommunen: S.iKommunen.length,
      underenheterMedForelderUtenfor: S.underenheter.filter((u) => {
        const f = enhet(u.overordnet);
        return f !== undefined && f.kommunenr !== K.kommunenr;
      }).length,
      alltidMed: S.alltid.length,
      iUtvalget: Object.keys(S.utvalg).length,
      rollelister: Object.keys(S.roller).length,
      regnskap: Object.keys(S.regnskap).length,
      ikkeFunnet: S.ikkeFunnet.length,
    },
    lagtTil: {
      organer: antallGenerert(ut.organisasjoner, (o) => o.belegg),
      personer: ut.personer.length - gPersoner.length,
      roller: antallGenerert(ut.roller, (r) => r.belegg),
      relasjoner: antallGenerert(ut.relasjoner, (r) => r.belegg),
      nokkeltall: antallGenerert(ut.nokkeltall, (n) => n.belegg),
      hull: ut.hull.filter(erGenerertHull).length,
    },
    bekreftet: { roller: bekreftedeRoller, nokkeltall: bekreftedeTall },
    motsagt: {
      roller: motsagteRoller,
      nokkeltall: motsagteTall,
      organer: avvik.filter((a) => a.kategori === "organer").length,
    },
    hoppetOver: hopp,
    avvik: 0,
  };

  const rekkefolge: Avvikskategori[] = [
    "roller",
    "nokkeltall",
    "organer",
    "personer",
    "koblinger",
    "naeringskoder",
    "ikke_tatt_inn",
  ];
  const avvikSortert = avvik
    .filter((a) => !(a.kategori === "personer" && blokkert.has(a.gjelder)))
    .sort(
      (a, b) =>
        rekkefolge.indexOf(a.kategori) - rekkefolge.indexOf(b.kategori) ||
        cmp(a.gjelder, b.gjelder) ||
        cmp(a.grunnlaget, b.grunnlaget) ||
        cmp(a.registeret, b.registeret),
    );
  oppsummering.avvik = avvikSortert.length;

  return {
    datasett: ut,
    avvik: avvikSortert,
    oppsummering,
    andreOppdatert,
    personlenker,
    personnokler,
  };
}
