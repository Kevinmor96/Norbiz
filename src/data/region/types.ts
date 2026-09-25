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
// kommunen omtales formelt.

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
  /** SSBs offisielle navn med alle språkformene: «Gáivuotna - Kåfjord - Kaivuono». */
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
