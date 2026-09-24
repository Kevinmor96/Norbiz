// Datakontrakten for Maktkart.
//
// Ett kommunedatasett (f.eks. `tromso.json`) er ÉN kilde: UI-et leser det via
// `src/lib/data/`, og seed-SQL-en til Supabase genereres fra det samme
// datasettet. To kilder betyr at siden og basen kan si ulike ting uten at noen
// merker det.
//
// Tre regler bærer hele modellen og står her fordi de ikke er åpenbare fra
// typene alene:
//
// 1. Institusjon først. En person finnes bare gjennom en rolle i en
//    organisasjon. `Person` er derfor bevisst tynn: ingen fødselsdato, ingen
//    adresse, ingen bilde. Det som ikke finnes i datasettet, kan ikke lekke.
// 2. Hver påstand har belegg: en kilde og en verifiseringsstatus. Et tall uten
//    kilde er ikke et tall vi kan vise.
// 3. Tid er en dimensjon, ikke et tillegg. Roller og relasjoner har fra/til,
//    og hendelser har dato med presisjon. Maktkartet endrer seg raskere enn
//    registrene publiserer.

/** Hvilken sort kilde påstanden bygger på. Rekkefølgen er tillit, høyest først. */
export type Kildetype =
  | 'register' // Brreg, Regnskapsregisteret, Aksjonærregisteret, data.stortinget.no, SSB, Lovdata
  | 'offisiell' // organets egen side: tromso.kommune.no, regjeringen.no, statsforvalteren.no, selskapets side
  | 'media' // redaksjonelle kilder: NRK, Nordlys, Godt Drikke
  | 'sekundaer' // videreformidlere av registerdata: Proff, Purehelp. Skal erstattes av registeret.
  | 'oppslagsverk'; // SNL, Wikipedia, Wikidata. Bare berikelse.

/**
 * Hvor langt påstanden er etterprøvd.
 *
 * `verifisert` betyr hentet av vår egen pipeline fra kilden, med tidsstempel.
 * Ingenting i MVP-datasettet er det: utviklingsmiljøet har ingen rute til
 * data.brreg.no, så alt er hentet fra researchgrunnlaget. UI-et skal si det.
 */
export type Verifisering =
  | 'verifisert'
  | 'oppgitt' // står i researchgrunnlaget med kilde, ikke etterprøvd av oss
  | 'maa_verifiseres'; // merket [verifiser], «uverifisert», «trolig» eller «antakelse» i grunnlaget

export interface Kilde {
  key: string;
  navn: string;
  url?: string;
  type: Kildetype;
  lisens?: string;
}

export interface Belegg {
  /** `Kilde.key` */
  kilde: string;
  verifisering: Verifisering;
  /** ISO-dato (YYYY, YYYY-MM eller YYYY-MM-DD) for når påstanden gjaldt eller ble sjekket. */
  per?: string;
  /** Kort merknad, f.eks. «tall uten år i grunnlaget» eller «morselskap, ikke konsern». */
  merknad?: string;
}

export type Nivaa =
  | 'stat'
  | 'fylke'
  | 'kommune'
  | 'interkommunal'
  | 'samisk'
  | 'privat'
  | 'interesse'
  | 'mellomstatlig';

export type Organtype =
  | 'kommune'
  | 'fylkeskommune'
  | 'folkevalgt_organ'
  | 'utvalg'
  | 'raad'
  | 'administrasjon'
  | 'departement'
  | 'direktorat'
  | 'etat'
  | 'statsforvalter'
  | 'domstol'
  | 'paatale'
  | 'politi'
  | 'tilsyn'
  | 'nemnd'
  | 'lovgivende'
  | 'KF'
  | 'FKF'
  | 'AS'
  | 'ASA'
  | 'IKS'
  | 'SA'
  | 'sparebank'
  | 'stiftelse'
  | 'HF'
  | 'RHF'
  | 'universitet'
  | 'forskning'
  | 'forening'
  | 'samarbeid'
  | 'saerlovselskap';

/** Myndighetstyper. En organisasjon kan ha flere. */
export type Myndighet =
  | 'vedtak'
  | 'regelverk'
  | 'tilsyn'
  | 'konsesjon'
  | 'klage'
  | 'finansiering'
  | 'innkjop'
  | 'eierskap'
  | 'planmyndighet'
  | 'innstilling' // forberedende makt: den som skriver saken, former vedtaket
  | 'raadgivning'
  | 'lobby';

export type Rekkevidde = 'kommune' | 'region' | 'fylke' | 'nasjonal' | 'internasjonal';

export interface Organisasjon {
  /** Stabil slug, brukes som nøkkel i relasjoner og i URL-er. */
  key: string;
  /** Ni siffer uten mellomrom. Utelates for utvalg og råd uten eget orgnr. */
  orgnr?: string;
  navn: string;
  kortnavn?: string;
  nivaa: Nivaa;
  organtype: Organtype;
  /** `Organisasjon.key` for organet dette sorterer under (utvalg → kommunestyre). */
  overordnet?: string;
  kommunenr?: string;
  fylkesnr?: string;
  rekkevidde?: Rekkevidde;
  myndighet: Myndighet[];
  /** `Segment.kode` */
  segmenter: string[];
  antall_medlemmer?: number;
  gyldig_fra?: string;
  gyldig_til?: string;
  status: 'aktiv' | 'nedlagt';
  /**
   * Domstol, politi, påtale og Forsvaret. Bare toppleder vises, og organet
   * inngår aldri i nettverksgrafen.
   */
  sensitiv: boolean;
  /** Én setning om hva organet bestemmer over, på vanlig norsk. */
  beskrivelse: string;
  belegg: Belegg;
}

/**
 * Bevisst tynn. Ingen fødselsdato, adresse eller bilde — dataminimering er
 * enklest når feltet ikke finnes.
 */
export interface Person {
  key: string;
  navn: string;
}

export type Rolletype =
  | 'politisk_leder'
  | 'folkevalgt'
  | 'utvalgsleder'
  | 'utvalgsmedlem'
  | 'toppleder'
  | 'nestleder_adm'
  | 'seksjonsleder'
  | 'styreleder'
  | 'nestleder'
  | 'styremedlem'
  | 'varamedlem'
  | 'daglig_leder'
  | 'dommer_leder'
  | 'paatale_leder'
  | 'tillitsvalgt';

export type Rollestatus = 'fast' | 'fungerende' | 'konstituert' | 'permisjon' | 'vara';

export interface Rolleinnehav {
  /** `Organisasjon.key` */
  org: string;
  /** `Person.key` */
  person: string;
  /** Tittelen slik organet selv bruker den: «Ordfører», «Konsernsjef». */
  tittel: string;
  rolletype: Rolletype;
  status: Rollestatus;
  /** Bare for folkevalgte. Partitilhørighet er aldri utledet for andre. */
  parti?: string;
  fra?: string;
  /** Satt når rollen er avsluttet. */
  til?: string;
  /** Satt når slutten er kjent, men ikke inntruffet (fungerende til …). */
  til_forventet?: string;
  belegg: Belegg;
}

export type Relasjonstype =
  | 'eier'
  | 'overordnet'
  | 'medlem_av'
  | 'sammenslatt_til'
  | 'splittet_fra'
  | 'erstattet_av'
  | 'samarbeid'
  | 'finansierer'
  | 'klageinstans_for'
  | 'tilsyn_med'
  | 'leverandor_til';

export interface Relasjon {
  fra: string;
  til: string;
  type: Relasjonstype;
  /** Eierandel i prosent, 0–100. Utelates når andelen ikke er kjent. */
  andel?: number;
  belop_nok?: number;
  fra_dato?: string;
  til_dato?: string;
  belegg: Belegg;
}

export type Nokkeltalltype =
  | 'omsetning'
  | 'driftsresultat'
  | 'aarsresultat'
  | 'resultat_for_skatt'
  | 'egenkapital'
  | 'utbytte'
  | 'omsatt_verdi'
  | 'merforbruk'
  | 'underskudd'
  | 'aarsverk';

export interface Nokkeltall {
  org: string;
  /** Regnskapsår. Et tall uten år tas ikke inn — det føres i `hull` i stedet. */
  aar: number;
  /** For delårstall, f.eks. «H1» eller «Q2». */
  periode?: string;
  type: Nokkeltalltype;
  verdi: number;
  enhet: 'NOK' | 'aarsverk';
  /** true = konserntall, false = morselskap/selskap. Utelates når grunnlaget ikke sier det. */
  konsern?: boolean;
  belegg: Belegg;
}

export type Hendelsestype =
  | 'rollebytte'
  | 'opprettet'
  | 'nedlagt'
  | 'splittet'
  | 'sammenslatt'
  | 'vedtak'
  | 'valg'
  | 'utbytte'
  | 'regnskap'
  | 'strukturdebatt'
  | 'planlagt';

export interface Hendelse {
  /** YYYY, YYYY-MM eller YYYY-MM-DD, med presisjon i eget felt. */
  dato: string;
  presisjon: 'dag' | 'maaned' | 'aar';
  type: Hendelsestype;
  /** Kort, konkret, uten verdiladning: «Ny styreleder i Troms Kraft». */
  tittel: string;
  tekst?: string;
  org?: string;
  personer?: string[];
  belegg: Belegg;
}

/** «Hvem bestemmer X?» som en ordnet kjede av organer. */
export interface Prosess {
  key: string;
  tittel: string;
  /** Spørsmålet slik en leser stiller det: «Hvem bestemmer en reguleringsplan i Tromsø?» */
  sporsmal: string;
  steg: ProsessSteg[];
}

export interface ProsessSteg {
  org: string;
  myndighet: Myndighet;
  /** Hva dette organet gjør i akkurat denne saken. */
  hva: string;
  belegg: Belegg;
}

export interface Segment {
  kode: string;
  navn: string;
}

export interface OrgSegment {
  org: string;
  segment: string;
  /** 3 = primær, 2 = sekundær, 1 = indirekte (f.eks. finansiering av «alle»). */
  styrke: 1 | 2 | 3;
}

/** Noe grunnlaget nevner, men som ikke kan vises som fakta ennå. */
export interface Hull {
  gjelder: string;
  hva: string;
  hvorfor: string;
}

export interface Kommunedatasett {
  meta: {
    kommunenr: string;
    kommune: string;
    fylkesnr: string;
    fylke: string;
    /** Datoen datasettet ble sammenstilt. */
    sammenstilt: string;
    /** Sti til grunnlaget i repoet. */
    grunnlag: string;
    merknad: string;
  };
  kilder: Kilde[];
  organisasjoner: Organisasjon[];
  personer: Person[];
  roller: Rolleinnehav[];
  relasjoner: Relasjon[];
  nokkeltall: Nokkeltall[];
  hendelser: Hendelse[];
  prosesser: Prosess[];
  segmenter: Segment[];
  org_segment: OrgSegment[];
  hull: Hull[];
}
