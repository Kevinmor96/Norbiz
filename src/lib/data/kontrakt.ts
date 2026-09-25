// Lesekontrakten mellom siden og datalaget.
//
// Hver funksjon i `Datalag` har en SQL-funksjon (RPC) med samme navn i
// `supabase/migrations/`, og en TypeScript-versjon i `lokal.ts` som leser
// kommunedatasettene i `src/data/`. Begge returnerer nøyaktig formene under.
// `tests/kontrakt.test.ts` laster seed-en i PGlite, kaller hver RPC som `anon`
// og sammenligner med `lokal.ts`. Bytter vi fra lokal til Supabase, bytter vi
// implementasjon, ikke form.
//
// Regler for formene:
//
// - Manglende verdier er `null`, aldri `undefined` og aldri utelatt. Det er det
//   PostgREST leverer, og det gjør sammenligningen eksakt.
// - Lister er alltid lister, også tomme.
// - Datoer er ISO-strenger slik kilden oppga dem: `YYYY`, `YYYY-MM` eller
//   `YYYY-MM-DD`. Presisjonen ligger i strengen.
// - Ingen funksjon leser klokka. «Aktiv» betyr at `til` ikke er satt, og
//   «skjedd» avgjøres av hendelsestypen. Svaret er derfor det samme i dag og
//   i morgen, og i basen og lokalt.
// - Rekkefølgen er bestemt og står ved hver type. Tekst sorteres på kodepunkt
//   (`collate "C"` i basen). Nøkler er ASCII, så det er entydig. Navn med
//   æ, ø og å sorterer UI-et selv med `Intl.Collator('nb')` der det trengs.
// - Personer finnes bare gjennom en rolle eller en hendelse. Det finnes ingen
//   personprofil, og ingen funksjon tar en person som inngang.

import type {
  Hendelsestype,
  Kildetype,
  Myndighet,
  Nivaa,
  Nokkeltalltype,
  Organtype,
  Rekkevidde,
  Relasjonstype,
  Rollestatus,
  Rolletype,
  Verifisering,
} from "../../data/types";

// Verditypene fra datakontrakten, så siden kan hente alle typene den trenger
// fra `@/lib/data` og aldri må importere datasettets typer direkte.
export type {
  Hendelsestype,
  Kildetype,
  Myndighet,
  Nivaa,
  Nokkeltalltype,
  Organtype,
  Rekkevidde,
  Relasjonstype,
  Rollestatus,
  Rolletype,
  Verifisering,
};

// ---------------------------------------------------------------------------
// Verdilister. Rekkefølgen er den samme som i enumene i basen, og det er den
// sorteringen bruker. `tests/schema.test.ts` sjekker at de er like.
// ---------------------------------------------------------------------------

/** Typesjekk: lista må inneholde alle verdiene i unionen, og bare dem. */
const alle =
  <T extends string>() =>
  <const A extends readonly T[]>(a: A & ([T] extends [A[number]] ? unknown : "mangler verdi")) =>
    a;

export const KILDETYPER = alle<Kildetype>()([
  "register",
  "offisiell",
  "media",
  "sekundaer",
  "oppslagsverk",
]);
export const VERIFISERINGER = alle<Verifisering>()(["verifisert", "oppgitt", "maa_verifiseres"]);
export const NIVAAER = alle<Nivaa>()([
  "stat",
  "fylke",
  "kommune",
  "interkommunal",
  "samisk",
  "privat",
  "interesse",
  "mellomstatlig",
]);
export const ORGANTYPER = alle<Organtype>()([
  "kommune",
  "fylkeskommune",
  "folkevalgt_organ",
  "utvalg",
  "raad",
  "administrasjon",
  "departement",
  "direktorat",
  "etat",
  "statsforvalter",
  "domstol",
  "paatale",
  "politi",
  "tilsyn",
  "nemnd",
  "lovgivende",
  "KF",
  "FKF",
  "AS",
  "ASA",
  "IKS",
  "SA",
  "sparebank",
  "stiftelse",
  "HF",
  "RHF",
  "universitet",
  "forskning",
  "forening",
  "samarbeid",
  "saerlovselskap",
]);
export const MYNDIGHETER = alle<Myndighet>()([
  "vedtak",
  "regelverk",
  "tilsyn",
  "konsesjon",
  "klage",
  "finansiering",
  "innkjop",
  "eierskap",
  "planmyndighet",
  "innstilling",
  "raadgivning",
  "lobby",
]);
export const REKKEVIDDER = alle<Rekkevidde>()([
  "kommune",
  "region",
  "fylke",
  "nasjonal",
  "internasjonal",
]);
export type Orgstatus = "aktiv" | "nedlagt";
export const ORGSTATUSER = alle<Orgstatus>()(["aktiv", "nedlagt"]);
export const ROLLETYPER = alle<Rolletype>()([
  "politisk_leder",
  "folkevalgt",
  "utvalgsleder",
  "utvalgsmedlem",
  "toppleder",
  "nestleder_adm",
  "seksjonsleder",
  "styreleder",
  "nestleder",
  "styremedlem",
  "varamedlem",
  "daglig_leder",
  "dommer_leder",
  "paatale_leder",
  "tillitsvalgt",
]);
export const ROLLESTATUSER = alle<Rollestatus>()([
  "fast",
  "fungerende",
  "konstituert",
  "permisjon",
  "vara",
]);
export const RELASJONSTYPER = alle<Relasjonstype>()([
  "eier",
  "overordnet",
  "medlem_av",
  "sammenslatt_til",
  "splittet_fra",
  "erstattet_av",
  "samarbeid",
  "finansierer",
  "klageinstans_for",
  "tilsyn_med",
  "leverandor_til",
]);
export const NOKKELTALLTYPER = alle<Nokkeltalltype>()([
  "omsetning",
  "driftsresultat",
  "aarsresultat",
  "resultat_for_skatt",
  "egenkapital",
  "utbytte",
  "omsatt_verdi",
  "merforbruk",
  "underskudd",
  "aarsverk",
]);
export type Enhet = "NOK" | "aarsverk";
export const ENHETER = alle<Enhet>()(["NOK", "aarsverk"]);
export const HENDELSESTYPER = alle<Hendelsestype>()([
  "rollebytte",
  "opprettet",
  "nedlagt",
  "splittet",
  "sammenslatt",
  "vedtak",
  "valg",
  "utbytte",
  "regnskap",
  "strukturdebatt",
  "planlagt",
]);
export type Presisjon = "dag" | "maaned" | "aar";
export const PRESISJONER = alle<Presisjon>()(["dag", "maaned", "aar"]);

// ---------------------------------------------------------------------------
// Regler som begge implementasjonene bruker. Endres de, må SQL-en endres
// likt. Kontrakttesten fanger det hvis bare den ene endres.
// ---------------------------------------------------------------------------

/** Rolletypene som svarer på «hvem leder organet?». */
export const LEDERTYPER = [
  "politisk_leder",
  "utvalgsleder",
  "toppleder",
  "styreleder",
  "daglig_leder",
  "dommer_leder",
  "paatale_leder",
] as const satisfies readonly Rolletype[];

/**
 * I sensitive organer (domstol, politi, påtale, Forsvaret) er bare disse
 * rolletypene synlige. Regelen håndheves med RLS i basen.
 */
export const SENSITIV_SYNLIGE_ROLLETYPER = [
  "toppleder",
  "dommer_leder",
  "paatale_leder",
] as const satisfies readonly Rolletype[];

/**
 * Hendelser av disse typene har ikke skjedd. Valget i 2027 er planlagt, og en
 * strukturdebatt er et forslag, ikke en endring.
 */
export const IKKE_SKJEDD_TYPER = [
  "planlagt",
  "strukturdebatt",
] as const satisfies readonly Hendelsestype[];

/**
 * Parti føres bare for roller i disse organtypene. Partitilhørighet er en
 * særlig kategori (GDPR art. 9) og er bare åpenbart offentliggjort for
 * folkevalgte. Basen avviser parti på andre roller.
 */
export const POLITISKE_ORGANTYPER = [
  "folkevalgt_organ",
  "utvalg",
  "lovgivende",
] as const satisfies readonly Organtype[];

/** Hvor mange eierledd eierskapsspørringen følger fra kommunen. */
export const MAKS_EIERLEDD = 10;

/** Hvor mange hendelser `kommune_oversikt` tar med i endringsstripa. */
export const SISTE_ENDRINGER = 5;

// ---------------------------------------------------------------------------
// Byggesteiner
// ---------------------------------------------------------------------------

export interface KildeUt {
  key: string;
  navn: string;
  url: string | null;
  type: Kildetype;
  lisens: string | null;
}

/**
 * Kildemerket. Hver påstand bærer sitt eget, med hele kilden inni, slik at
 * merket kan tegnes uten flere oppslag.
 */
export interface BeleggUt {
  kilde: KildeUt;
  verifisering: Verifisering;
  per: string | null;
  merknad: string | null;
  /** Når pipelinen hentet påstanden fra kilden. Alltid satt for `verifisert`, ellers `null`. */
  hentet: string | null;
}

export interface OrganRef {
  key: string;
  navn: string;
  kortnavn: string | null;
  nivaa: Nivaa;
  organtype: Organtype;
  status: Orgstatus;
  sensitiv: boolean;
}

export interface PersonRef {
  key: string;
  navn: string;
}

/**
 * En rolle sett fra organet. Sortering der ikke annet står: rolletype (i
 * `ROLLETYPER`-rekkefølge), status (i `ROLLESTATUSER`-rekkefølge), person.key.
 */
export interface Rolle {
  person: PersonRef;
  tittel: string;
  rolletype: Rolletype;
  status: Rollestatus;
  /** Bare for roller i folkevalgte organer. */
  parti: string | null;
  fra: string | null;
  til: string | null;
  til_forventet: string | null;
  /** Motsagt av registeret: ikke aktiv, bare i historikken (se `Rolleinnehav.motsagt`). */
  motsagt: boolean;
  belegg: BeleggUt;
}

export interface RolleIOrgan extends Rolle {
  org: OrganRef;
}

export interface Organ extends OrganRef {
  orgnr: string | null;
  /** `key` til organet dette sorterer under. */
  overordnet: string | null;
  kommunenr: string | null;
  fylkesnr: string | null;
  rekkevidde: Rekkevidde | null;
  /** I kildens rekkefølge. */
  myndighet: Myndighet[];
  antall_medlemmer: number | null;
  gyldig_fra: string | null;
  gyldig_til: string | null;
  beskrivelse: string;
  belegg: BeleggUt;
}

/** Organet med aktive roller av `LEDERTYPER`. */
export interface OrganKort extends Organ {
  ledere: Rolle[];
}

/**
 * Sortering: aar synkende, type (i `NOKKELTALLTYPER`-rekkefølge), periode
 * (`null` først), konsern (`null`, så `false`, så `true`).
 */
export interface NokkeltallUt {
  aar: number;
  periode: string | null;
  type: Nokkeltalltype;
  verdi: number;
  enhet: Enhet;
  konsern: boolean | null;
  belegg: BeleggUt;
}

/** En eierrelasjon sett fra den andre enden: `org` er eieren eller selskapet. */
export interface Eierandel {
  org: OrganRef;
  andel: number | null;
  belop_nok: number | null;
  fra_dato: string | null;
  til_dato: string | null;
  belegg: BeleggUt;
}

export interface RelasjonUt extends Eierandel {
  /** `ut`: organet er `fra` i relasjonen. `inn`: organet er `til`. */
  retning: "ut" | "inn";
  type: Relasjonstype;
}

/**
 * Sortering i lister over hendelser som har skjedd: dato synkende, type (i
 * `HENDELSESTYPER`-rekkefølge), tittel. For hendelser som ikke har skjedd:
 * dato stigende, så det samme.
 */
export interface Endring {
  dato: string;
  presisjon: Presisjon;
  type: Hendelsestype;
  /** `false` for typene i `IKKE_SKJEDD_TYPER`. */
  skjedd: boolean;
  tittel: string;
  tekst: string | null;
  org: OrganRef | null;
  /** I kildens rekkefølge. */
  personer: PersonRef[];
  belegg: BeleggUt;
}

export interface HullPunkt {
  gjelder: OrganRef;
  hva: string;
  hvorfor: string;
}

export interface Kommune {
  kommunenr: string;
  navn: string;
  /** Brukes i URL-en: `/kommune/$slug`. */
  slug: string;
  fylkesnr: string;
  fylke: string;
  /** Datoen datasettet ble sammenstilt, `YYYY-MM-DD`. */
  sammenstilt: string;
}

export interface KommuneMeta extends Kommune {
  grunnlag: string;
  merknad: string;
}

export interface Verifiseringstelling {
  verifisert: number;
  oppgitt: number;
  maa_verifiseres: number;
}

// ---------------------------------------------------------------------------
// Svarene
// ---------------------------------------------------------------------------

/** `kommuner()`. Sortert på slug. */
export type Kommuneliste = (Kommune & { antall_organer: number })[];

/**
 * `kommune_oversikt(p_kommunenr)`. Toppen av kommunesiden og det siden trenger
 * for å velge prosess og segment.
 *
 * Omfanget til en kommune er organene i kommunens datasett. Roller, nøkkeltall
 * og hull følger organet. En relasjon er med når begge ender er med. En
 * hendelse er med når organet er med.
 */
export interface KommuneOversikt {
  kommune: KommuneMeta;
  /** Organet med organtype `kommune` og kommunens kommunenummer. */
  kommuneorgan: OrganRef | null;
  /** Aktivt folkevalgt organ rett under kommuneorganet. Alle kommuner har ett. */
  kommunestyre: { org: OrganRef; antall_medlemmer: number | null; belegg: BeleggUt } | null;
  /**
   * Aktive roller av typen `politisk_leder` og `toppleder` i organer med
   * kommunens kommunenummer: ordfører og kommunedirektør. Sortert på rolletype,
   * org.key, status, person.key.
   */
  ledere: RolleIOrgan[];
  /** Aktive eierrelasjoner fra kommuneorganet. `heleide` har andel 100. */
  eierskap: { direkte: number; heleide: number };
  /** Eierrelasjoner fra kommuneorganet med beløp. Sortert på beløp synkende, selskap.key. */
  utbytte: { selskap: OrganRef; belop_nok: number; belegg: BeleggUt }[];
  /** De `SISTE_ENDRINGER` nyeste som har skjedd. */
  siste_endringer: Endring[];
  /** Sortert på key. */
  prosesser: { key: string; tittel: string; sporsmal: string; antall_steg: number }[];
  /** Alle segmenter, med antall aktive organer i kommunen. Sortert på kode. */
  segmenter: { kode: string; navn: string; antall_organer: number }[];
  /** Hvor mye datasettet dekker. `personer` teller personer med minst én rolle. */
  dekning: {
    organer: number;
    roller: number;
    personer: number;
    relasjoner: number;
    nokkeltall: number;
    hendelser: number;
    prosesser: number;
    hull: number;
    kilder: number;
  };
  /** Påstander i kommunens omfang etter verifiseringsgrad. */
  verifisering: Verifiseringstelling;
  /** Kildene påstandene bygger på. Sortert på antall synkende, key. */
  kilder: { kilde: KildeUt; antall: number }[];
}

/** `beslutningskjede(p_kommunenr, p_prosess_key)`. */
export interface Beslutningskjede {
  prosess: { key: string; tittel: string; sporsmal: string };
  /** I kjedens rekkefølge. `nr` begynner på 1. */
  steg: {
    nr: number;
    org: OrganRef;
    myndighet: Myndighet;
    hva: string;
    belegg: BeleggUt;
    /** Hvem som leder organet nå. */
    ledere: Rolle[];
  }[];
}

/**
 * `organkart(p_kommunenr)`. Aktive organer gruppert på nivå, i
 * `NIVAAER`-rekkefølge. Tomme nivåer er utelatt. Innenfor et nivå: organtype
 * (i `ORGANTYPER`-rekkefølge), så key.
 */
export interface Organkart {
  grupper: { nivaa: Nivaa; organer: OrganKort[] }[];
}

/** `organ_profil(p_org_key)`. Gjelder organet uansett kommune. */
export interface OrganProfil {
  organ: Organ & {
    /** Sortert på styrke synkende, kode. */
    segmenter: { kode: string; navn: string; styrke: 1 | 2 | 3 }[];
  };
  overordnet: OrganRef | null;
  /** Organer med dette som overordnet. Sortert på key. */
  underordnede: OrganRef[];
  roller: {
    /** Uten `til`. */
    naa: Rolle[];
    /** Med `til`. Sortert på til synkende, rolletype, person.key. */
    tidligere: Rolle[];
  };
  /** Eierrelasjoner inn. Sortert på andel synkende (ukjent sist), org.key. */
  eiere: Eierandel[];
  /** Eierrelasjoner ut. Samme sortering. */
  eierandeler: Eierandel[];
  /** Alle andre relasjoner. Sortert på type, retning (`ut` først), org.key. */
  relasjoner: RelasjonUt[];
  nokkeltall: NokkeltallUt[];
  /** Alle hendelser for organet, sortert som «skjedd». */
  hendelser: Endring[];
  /** Sortert på hva. */
  hull: HullPunkt[];
  /** Kildene bak påstandene på profilen. Sortert på key. */
  kilder: KildeUt[];
  /** Kommunene som har organet i datasettet sitt. Sortert på slug. */
  kommuner: Kommune[];
}

/**
 * `eierskap(p_kommunenr)`. Det kommunen eier, direkte og gjennom selskapene
 * sine, fulgt i inntil `MAKS_EIERLEDD` ledd. Bare aktive eierrelasjoner der
 * begge ender er i kommunens omfang.
 */
export interface Eierskap {
  eier: OrganRef | null;
  /** Sortert på ledd, så org.key. */
  selskaper: {
    org: OrganRef;
    /** 1 = kommunen eier direkte. 2 = gjennom ett selskap. Korteste vei. */
    ledd: number;
    /**
     * Alle aktive eierrelasjoner inn i selskapet der eieren også er i
     * kommunens omfang, ikke bare kommunens egen. Sortert som `eiere` i
     * `OrganProfil`.
     */
    eiere: Eierandel[];
    nokkeltall: NokkeltallUt[];
  }[];
  /**
   * Utbytte som flyt, for selskaper i `selskaper` med et utbyttetall eller
   * eiere med beløp. `total` er det nyeste utbyttetallet (første i
   * nøkkeltallsorteringen). `mottakere` er eierrelasjonene med beløp, sortert
   * på beløp synkende, org.key. `sum_mottakere` er summen av beløpene, regnet
   * i basen. Sortert på selskap.key.
   */
  utbytte: {
    selskap: OrganRef;
    total: NokkeltallUt | null;
    mottakere: Eierandel[];
    sum_mottakere: number;
  }[];
}

/**
 * `nettverk(p_kommunenr)`. Personer med aktive roller i minst to ulike organer.
 * Institusjonsgraf: noden er organet, og personen er kanten. Sensitive organer
 * er aldri med, og det er heller ikke personer med en synlig rolle i et
 * sensitivt organ.
 */
export interface Nettverk {
  /** Sortert på key. */
  noder: OrganRef[];
  /** Ett par per person og organpar, `fra` < `til`. Sortert på fra, til, person.key. */
  kanter: { fra: string; til: string; person: PersonRef }[];
  /** Lista som alternativ til grafen. Sortert på person.key, rollene på org.key, rolletype. */
  personer: { person: PersonRef; roller: RolleIOrgan[] }[];
}

/** `endringer(p_kommunenr)`. */
export interface Endringer {
  skjedd: Endring[];
  ikke_skjedd: Endring[];
}

/**
 * `organer_for_segment(p_segment_kode, p_kommunenr)`. Aktive organer i kommunen
 * som påvirker segmentet. Sortert på styrke synkende, nivå, key.
 */
export interface SegmentOrganer {
  segment: { kode: string; navn: string };
  organer: {
    org: OrganRef;
    /** 3 = primær, 2 = sekundær, 1 = indirekte. */
    styrke: 1 | 2 | 3;
    myndighet: Myndighet[];
    beskrivelse: string;
  }[];
}

/** `hull(p_kommunenr)`. Sortert på gjelder.key, hva. */
export type Hulliste = HullPunkt[];

// ---------------------------------------------------------------------------
// Gradene: hvor mye av det siden viser, som er etterprøvd
// ---------------------------------------------------------------------------

/**
 * Påstandene i et omfang etter verifiseringsgrad. `fra_register` teller
 * påstander der kilden er et register (Brreg, SSB, Kartverket, Stortinget),
 * uansett grad: en påstand grunnlaget har fra Brreg, men som pipelinen ikke har
 * hentet, er `oppgitt` og likevel fra et register.
 */
export interface Gradtelling {
  totalt: number;
  verifisert: number;
  oppgitt: number;
  maa_verifiseres: number;
  fra_register: number;
}

/**
 * `kommune_grader(p_kommunenr)`. Samme omfang og samme påstander som
 * `KommuneOversikt.verifisering`, delt på hva påstanden gjelder. Forhåndsvarselet
 * regner herfra og aldri fra hvor mange merker som står på siden.
 */
export interface Grader {
  alle: Gradtelling;
  organer: Gradtelling;
  roller: Gradtelling;
  relasjoner: Gradtelling;
  nokkeltall: Gradtelling;
  hendelser: Gradtelling;
  prosess_steg: Gradtelling;
  /**
   * Første og siste `per` blant de verifiserte påstandene: datoene pipelinen
   * hentet dem fra registeret. `null` når ingenting er verifisert. En dato,
   * ikke en ferskhetspåstand.
   */
  forst_hentet: string | null;
  sist_hentet: string | null;
}

// ---------------------------------------------------------------------------
// Regionen: alle kommunene og fylkene, også de uten datasett
// ---------------------------------------------------------------------------

/** Hvor mange virksomheter `fylke_oversikt` rangerer. */
export const STORSTE_VIRKSOMHETER = 10;
/** Søket svarer bare når spørringen har minst så mange tegn etter normalisering. */
export const SOK_MIN_TEGN = 2;
/** Største `limit` søket godtar, per gruppe. */
export const SOK_MAKS = 50;

/**
 * Tegnene søket bretter bort. `fra[i]` blir `til[i]`, og etterpå blir «æ» til
 * «ae» og «ß» til «ss». Store ASCII-bokstaver står i lista, så brettingen er
 * den samme i alle lokaler: basen bruker `translate`, ikke `lower`, fordi
 * `lower` på æ, ø og å avhenger av databasens lokale. Alt som ikke er a–z eller
 * 0–9 etter brettingen, blir mellomrom. `tests/sok.test.ts` krever at lista
 * dekker hver bokstav i navnene i datasettene og regionregisteret, og at
 * `intern.fold` i basen gir det samme som `brett` i src/lib/data/sok.ts.
 */
export const BRETTING = {
  fra:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "ÀÁÂÃÄÅĀĂĄàáâãäåāăą" +
    "ÇĆČçćč" +
    "ĐÐđð" +
    "ÈÉÊËĒĖĘĚèéêëēėęě" +
    "ǦǤǧǥ" +
    "ÌÍÎÏĪìíîïī" +
    "Ǩǩ" +
    "ŁłĽľ" +
    "ÑŃŇŊñńňŋ" +
    "ÒÓÔÕÖØŌòóôõöøō" +
    "ŔŘŕř" +
    "ŚŠŞśšş" +
    "ŦŢŤŧţť" +
    "ÙÚÛÜŪŮùúûüūů" +
    "ÝŸýÿ" +
    "ŹŻŽƷǮźżžʒǯ" +
    "Æ",
  til:
    "abcdefghijklmnopqrstuvwxyz" +
    "aaaaaaaaaaaaaaaaaa" +
    "cccccc" +
    "dddd" +
    "eeeeeeeeeeeeeeee" +
    "gggg" +
    "iiiiiiiiii" +
    "kk" +
    "llll" +
    "nnnnnnnn" +
    "oooooooooooooo" +
    "rrrr" +
    "ssssss" +
    "tttttt" +
    "uuuuuuuuuuuu" +
    "yyyy" +
    "zzzzzzzzzz" +
    "æ",
  flertegn: [
    ["æ", "ae"],
    ["ß", "ss"],
  ],
} as const;

export interface FolketallUt {
  verdi: number;
  /** Året tallet gjelder, per 1. januar. */
  aar: number;
  belegg: BeleggUt;
}

/** Det datasettet sier om kommunen. Samme tall som kommunesiden viser. */
export interface Datasettdekning {
  sammenstilt: string;
  /** `KommuneOversikt.dekning.organer`, `.roller` og `.personer`. */
  organer: number;
  roller: number;
  personer: number;
  /**
   * Hvor mange av `KommuneOversikt.ledere` som er ordfører (`politisk_leder`)
   * og kommunedirektør (`toppleder`). Lar forsiden klassifisere dekningen uten
   * å laste kommunens datasett.
   */
  ledere: { politisk_leder: number; toppleder: number };
  grader: Grader;
}

/** En kommune i regionregisteret, med datasettet når det finnes. */
export interface RegionKommune {
  kommunenr: string;
  /** Den norske delen av navnet, til trange flater: «Kautokeino». */
  navn: string;
  /** SSBs offisielle navn med alle språkformene: «Guovdageaidnu - Kautokeino». */
  navn_offisielt: string;
  slug: string;
  fylkesnr: string;
  folketall: FolketallUt;
  samisk_forvaltningsomrade: boolean;
  /** Belegg for nummer og offisielt navn. */
  belegg: BeleggUt;
  /** Belegg for det korte navnet og samisk forvaltningsområde (Kartverket). */
  geografi_belegg: BeleggUt;
  /** `null` når kommunen ikke har datasett ennå. */
  datasett: Datasettdekning | null;
}

export interface RegionFylke {
  fylkesnr: string;
  navn: string;
  /** «Troms - Romsa - Tromssa». */
  navn_offisielt: string;
  /** Brukes i URL-en: `/fylke/$slug`. */
  slug: string;
  folketall: FolketallUt;
  belegg: BeleggUt;
  antall_kommuner: number;
  /** Kommuner i fylket med datasett. */
  kartlagt: number;
  /**
   * Over kommunene i fylket, distinkt: Statsforvalteren står i mange
   * kommunedatasett og telles én gang. Summen av kommunenes tall er derfor
   * større enn fylkets.
   */
  dekning: { organer: number; roller: number; personer: number };
  /** Distinkte påstander i omfanget til minst én kommune i fylket. */
  grader: Grader;
}

/**
 * `region_oversikt()`. Hele regionen fra regionregisteret, med det
 * datasettene dekker. Kommuner uten datasett er med, med `datasett: null`.
 */
export interface RegionOversikt {
  region: { navn: string; sammenstilt: string; merknad: string };
  /** Sortert på fylkesnr. */
  fylker: RegionFylke[];
  /** Sortert på kommunenr. */
  kommuner: RegionKommune[];
  /** Kildene bak registeropplysningene. Sortert på key. */
  kilder: KildeUt[];
}

/** Et av fylkets egne organer, med hvem som leder det. */
export interface FylkeOrgan extends Organ {
  ledere: Rolle[];
  /** Aktive roller i lovgivende organer: stortingsrepresentantene. Ellers tom. */
  representanter: Rolle[];
}

/**
 * `fylke_oversikt(p_fylkesnr)`.
 *
 * `organer` er fylkets egne: aktive organer med fylkets fylkesnummer (fylkes-
 * kommunen, fylkestinget, stortingsbenken), og aktive statsforvaltere uten
 * kommunenummer som står i datasettet til en kommune i fylket. Sortert som
 * organkartet: nivå, organtype, key.
 *
 * `storste` er de største virksomhetene med kommunenummer i fylket, målt i
 * omsetning. Datasettene har ikke antall ansatte med år, og et tall uten år tas
 * ikke inn, så rangeringen er etter omsetning, og året står ved tallet. For
 * hvert organ brukes det første omsetningstallet uten periode i
 * nøkkeltallsorteringen (nyeste år, selskapets eget før konsernet). Sortert på
 * beløp synkende, key. Høyst `STORSTE_VIRKSOMHETER`.
 */
export interface FylkeOversikt {
  fylke: RegionFylke;
  /** Sortert på kommunenr. */
  kommuner: RegionKommune[];
  organer: FylkeOrgan[];
  storste: { org: OrganRef; kommunenr: string; omsetning: NokkeltallUt }[];
}

/** En kommune i søket. */
export interface SokKommune {
  kommunenr: string;
  navn: string;
  navn_offisielt: string;
  slug: string;
  fylkesnr: string;
  har_datasett: boolean;
}

export interface SokOrgan extends OrganRef {
  orgnr: string | null;
  kommunenr: string | null;
}

/**
 * `sok(p_sporring, p_limit)`. Tre grupper, institusjon først: kommuner, organer
 * og roller. En person finnes bare som en rolle i et organ, aldri alene.
 *
 * Spørringen brettes (`BRETTING`) og deles i ord. Et treff har hvert ord et sted
 * i teksten. Rangen er 0 når navnet er lik spørringen, 1 når navnet begynner
 * med den, 2 når hvert ord begynner et ord i teksten, og 3 ellers. Teksten er:
 *
 * - kommune: offisielt navn og kort navn. Navnene er begge.
 * - organ: navn, kortnavn og org.nr. Navnene er navn og kortnavn.
 * - rolle: personens navn, tittelen og organets navn og kortnavn. Navnet er
 *   personens. Bare aktive roller som er synlige, og ingen roller for personer
 *   med en synlig rolle i et sensitivt organ (samme regel som nettverket).
 *
 * Sortering: kommuner på rang, kommunenr; organer på rang, status (aktiv
 * først), key; roller på rang, person.key, org.key, rolletype, fra. `antall`
 * er alle treff i gruppen, `treff` de første `limit` (1–`SOK_MAKS`). Kortere
 * spørring enn `SOK_MIN_TEGN` gir tomme grupper.
 */
export interface Sokeresultat {
  /** Spørringen etter bretting: små bokstaver, uten aksenter, ord skilt med mellomrom. */
  sporring: string;
  kommuner: { antall: number; treff: SokKommune[] };
  organer: { antall: number; treff: SokOrgan[] };
  roller: { antall: number; treff: RolleIOrgan[] };
}

/**
 * Datalaget siden koder mot. Metodene heter som RPC-ene. Alle returnerer
 * `null` når kommunen, prosessen, organet eller segmentet ikke finnes.
 */
export interface Datalag {
  kommuner(): Promise<Kommuneliste>;
  kommune_oversikt(kommunenr: string): Promise<KommuneOversikt | null>;
  beslutningskjede(kommunenr: string, prosess_key: string): Promise<Beslutningskjede | null>;
  organkart(kommunenr: string): Promise<Organkart | null>;
  organ_profil(org_key: string): Promise<OrganProfil | null>;
  eierskap(kommunenr: string): Promise<Eierskap | null>;
  nettverk(kommunenr: string): Promise<Nettverk | null>;
  endringer(kommunenr: string): Promise<Endringer | null>;
  organer_for_segment(segment_kode: string, kommunenr: string): Promise<SegmentOrganer | null>;
  hull(kommunenr: string): Promise<Hulliste | null>;
  kommune_grader(kommunenr: string): Promise<Grader | null>;
  region_oversikt(): Promise<RegionOversikt>;
  /** `null` når fylket ikke er i regionregisteret. */
  fylke_oversikt(fylkesnr: string): Promise<FylkeOversikt | null>;
  sok(sporring: string, limit: number): Promise<Sokeresultat>;
}
