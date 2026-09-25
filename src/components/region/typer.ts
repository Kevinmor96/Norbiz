// Formene regionsidene (forsiden og /fylke/$slug) leser. Svarene fra
// datalaget (`region_oversikt`, `fylke_oversikt`) står urørt inni; loaderen i
// region/last.ts legger bare på det sidene trenger for å tegne: dekningsklassen
// per kommune og fylkets organer sortert etter hva de er.
//
// Dekningsklassen sier hvor mye av svaret på «hvem bestemmer her?» datasettet
// har for kommunen. Den er ikke et mål på makt, og kartet farges bare etter den.

import type {
  FylkeOrgan,
  FylkeOversikt,
  Gradtelling,
  KildeUt,
  RegionFylke,
  RegionKommune,
  RegionOversikt,
} from "@/lib/data";

export type Dekningsklasse = "kjeder" | "folkevalgte" | "register" | "ingen";

/** Rekkefølgen i tegnforklaringen: mest kartlagt først. */
export const DEKNINGSKLASSER: readonly Dekningsklasse[] = [
  "kjeder",
  "folkevalgte",
  "register",
  "ingen",
];

export const DEKNING: Record<Dekningsklasse, { navn: string; forklaring: string }> = {
  kjeder: {
    navn: "Beslutningskjeder med kilde",
    forklaring:
      "Hvem som forbereder og hvem som vedtar, steg for steg, med kilde på stegene. I tillegg ordføreren, kommunestyret og roller fra registrene.",
  },
  folkevalgte: {
    navn: "Folkevalgte og registre",
    forklaring:
      "Ordføreren, kommunestyret og kommuneledelsen, og roller i kommunen, selskapene og styrene fra registrene. Beslutningskjedene følger vanlig saksgang og er ikke etterprøvd.",
  },
  register: {
    navn: "Bare registre",
    forklaring:
      "Roller i kommunen, selskapene og styrene fra Brønnøysundregistrene. Ordføreren er ikke hentet ennå.",
  },
  ingen: {
    navn: "Ikke kartlagt",
    forklaring: "Bare navn, nummer og folketall fra SSB og Kartverket.",
  },
};

export type Klassetelling = Record<Dekningsklasse, number>;

/**
 * En kommune slik regionsidene bruker den: det kartet, søket og indeksen
 * viser, og ikke mer. Hele `RegionKommune` har gradtellinger i sju kategorier
 * per kommune, og 80 av dem ville vært en tredjedel av tilstanden i HTML-en.
 */
export interface KommuneIRegion extends Pick<
  RegionKommune,
  | "kommunenr"
  | "navn"
  | "navn_offisielt"
  | "slug"
  | "fylkesnr"
  | "folketall"
  | "samisk_forvaltningsomrade"
> {
  /** `null` når kommunen ikke har datasett. Tallene er de kommunesiden viser. */
  datasett: { organer: number; roller: number } | null;
  klasse: Dekningsklasse;
}

export interface FylkeIRegion extends RegionFylke {
  klasser: Klassetelling;
}

export interface Regionside {
  region: RegionOversikt["region"] & { klasser: Klassetelling };
  /** Sortert på fylkesnr. */
  fylker: FylkeIRegion[];
  /** Sortert på kommunenr. */
  kommuner: KommuneIRegion[];
  kilder: KildeUt[];
}

export interface Fylkeside {
  fylke: FylkeIRegion;
  /** Sortert på kommunenr. */
  kommuner: KommuneIRegion[];
  /** Fylkeskommunen selv, med toppledere registeret fører. */
  fylkeskommune: FylkeOrgan | null;
  /** Fylkestinget, fylkesutvalget og fylkesrådet: den politiske toppen. */
  politisk: FylkeOrgan[];
  /** Administrasjonen i fylkeskommunen: den administrative toppen. */
  administrativ: FylkeOrgan[];
  /** Statsforvalterembetet (kontorene under er ikke med). */
  statsforvalter: FylkeOrgan[];
  /** Stortingsbenken: valgkretsen med representantene. */
  storting: FylkeOrgan[];
  /** Fylkeskommunens øvrige organer: utvalg, råd og etater. */
  andre: FylkeOrgan[];
  /**
   * Organer ført på fylket som ikke er fylkeskommunen eller staten, som KS og
   * LO i fylket. De står for seg, så de ikke leses som en del av fylkeskommunen.
   */
  utenfor: FylkeOrgan[];
  storste: FylkeOversikt["storste"];
}

/**
 * Andelen av et omfang som er hentet rett fra registrene, i hele prosent,
 * rundet ned. 99,6 % blir 99 %: siden skal aldri si mer enn datasettet gjør.
 */
export function andelVerifisert(t: Gradtelling): number {
  return t.totalt ? Math.floor((100 * t.verifisert) / t.totalt) : 0;
}
