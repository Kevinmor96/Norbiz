// Regionregisteret: hvilke kommuner og fylker Maktkart dekker i en region.
//
// Registeret er ikke et kommunedatasett. Det sier hvilke kommuner som finnes,
// hva de heter og hvor de ligger, og ingenting om hvem som bestemmer der. Alt i
// det er hentet med skript fra registrene (SSB og Kartverket), og derfor
// `verifisert` med hentedato i `per`.
//
// Navneregelen: `navn_offisielt` er SSBs offisielle navn med alle språkformene,
// f.eks. «Guovdageaidnu - Kautokeino». `navn` er den norske delen, til visning
// der plassen er knapp. Den samiske og kvenske formen skal aldri falle bort der
// kommunen omtales formelt. Unntak: skriver Kartverket en språkform annerledes
// enn SSB, gjelder Kartverket, fordi Sentralt stedsnavnregister er det
// lovfestede registeret for stedsnavn. Belegget sier da hva SSB skriver
// (Porsanger: Kartverket «Porsáŋgu», SSB «Porsángu»).

import type { Belegg, Kilde } from "../types";

export interface Folketall {
  verdi: number;
  /** Året tallet gjelder, per 1. januar. */
  aar: number;
  belegg: Belegg;
}

export interface RegionFylke {
  /** To siffer, f.eks. «55». */
  nr: string;
  /** SSBs offisielle navn med alle språkformene: «Troms - Romsa - Tromssa». */
  navn_offisielt: string;
  /** Den norske delen: «Troms». */
  navn: string;
  folketall: Folketall;
  belegg: Belegg;
}

export interface RegionKommune {
  /** Fire siffer, f.eks. «5501». */
  nr: string;
  /** Offisielt navn med alle språkformene: «Gáivuotna - Kåfjord - Kaivuono». SSBs, se navneregelen over. */
  navn_offisielt: string;
  /** Den norske delen, fra Kartverket: «Kåfjord». */
  navn: string;
  /** ASCII-kebab av `navn` (æ→ae, ø→o, å→a). Unik i registeret. Brukes i URL-en. */
  slug: string;
  fylkesnr: string;
  folketall: Folketall;
  /** Avgrensningsboks [minLon, minLat, maxLon, maxLat], EPSG:4258. */
  bbox: [number, number, number, number];
  /** Kartverkets `punktIOmrade` [lon, lat]: et punkt som ligger inne i kommunen. Ikke sentrum. */
  punkt: [number, number];
  /** Kommunen er i forvaltningsområdet for samisk språk, ifølge Kartverket. */
  samisk_forvaltningsomrade: boolean;
  /** Belegg for `navn`, `bbox`, `punkt` og `samisk_forvaltningsomrade`. */
  geografi_belegg: Belegg;
  /** Belegg for `nr` og `navn_offisielt`. */
  belegg: Belegg;
}

export interface Regionregister {
  meta: {
    region: string;
    /** Datoen registeret ble hentet. */
    sammenstilt: string;
    merknad: string;
    kilder: Kilde[];
  };
  /** Sortert på `nr`. */
  fylker: RegionFylke[];
  /** Sortert på `nr`. */
  kommuner: RegionKommune[];
}

/**
 * Et regionalt organ og kommunene det har myndighet over. Belegget gjelder
 * dekningen, ikke organet: politidistriktets egen side, domstolens rettskrets,
 * fylkesnummeret i SSB Klass 131.
 */
export interface Dekning {
  /** `Organisasjon.key` */
  org: string;
  /** Kommunenumre, sortert. */
  kommuner: string[];
  merknad?: string;
  belegg: Belegg;
}

/**
 * Dekningsregisteret (`src/data/region/dekning.json`). Brreg-importøren
 * kopierer organets kanoniske rad inn i hver kommune på lista; rollene står
 * bare hos eieren. Et organ uten dokumentert dekning står ikke her.
 */
export interface Dekningsregister {
  meta: {
    region: string;
    sammenstilt: string;
    merknad: string;
    kilder: Kilde[];
  };
  /** Sortert på `org`. */
  dekning: Dekning[];
}
