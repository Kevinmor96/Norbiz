// Kartbladets terreng: ferdige SVG-stier per kommune, laget av
// `npm run terreng` (scripts/terreng.ts) og lagret i src/data/terreng/<kommunenr>.json.
//
// Filene lastes latt, én per kommune, så en side bare får sitt eget kartblad.
// Mangler fila, tegner Kartblad reservevarianten: ramme, rutenett og
// kommunenavn, uten falskt terreng.

export interface Linjesett {
  /** SVG-sti. Første punkt absolutt, resten relativt, heltall i viewBox-enheter. */
  d: string;
  /** Lengden på den lengste delstien, i viewBox-enheter. Styrer trykkeanimasjonen. */
  lengde: number;
}

export interface Terreng {
  kommunenr: string;
  navn: string;
  /** [vest, sør, øst, nord] i grader. */
  bbox: [number, number, number, number];
  zoom: number;
  /** viewBox-bredde og -høyde. */
  bredde: number;
  hoyde: number;
  /** Havflaten som lukkede polygoner. */
  hav: string;
  /** Kystlinjen, uten stykkene som går langs kartrammen. */
  kyst: Linjesett;
  /** Meter mellom kotene. */
  ekvidistanse: number;
  /** Kotene nedenfra og opp. Tellekurvene tegnes tykkere. */
  koter: (Linjesett & { hoyde: number; tellekurve: boolean })[];
  /** Kortnavn på datakilden, til kredittlinjen. */
  kilde: string;
  /** Hele kredittlinjen under kartet. */
  attribusjon: string;
}

const filer = import.meta.glob<Terreng>(["../data/terreng/*.json", "!**/utsnitt.json"], {
  import: "default",
});

/** Terrenget for kommunen, eller `null` når kommunen ikke har kartblad ennå. */
export async function hentTerreng(kommunenr: string): Promise<Terreng | null> {
  const last = filer[`../data/terreng/${kommunenr}.json`];
  return last ? await last() : null;
}
