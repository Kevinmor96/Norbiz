// Kartbladets terreng: ferdige SVG-stier per kommune, laget av
// `npm run terreng` (scripts/terreng.ts) og lagret i src/data/terreng/<kommunenr>.json.
//
// Stiene står ikke i siden. De serveres som én SVG-fil per kommune,
// /kart/terreng/<kommunenr>.svg (src/routes/kart.terreng.$fil.ts, og en fil i
// den statiske eksporten), med én <path id> per kote, for havet og for
// kystlinjen. Kartbladet og løypekartet tegner dem med <use href>. Da:
//
// - står stiene én gang, i en fil nettleseren husker, og ikke i HTML-en og i
//   den serialiserte tilstanden i tillegg (det var 35 kB tilstand og det
//   dobbelte i markup for Tromsø),
// - tegnes kartet fortsatt på serveren og uten JavaScript,
// - styres farge og strek av klassene på <use>, fordi stiene i fila ikke har
//   egne farger: fill, stroke og strekmønsteret arves inn, så temaet og
//   trykkeanimasjonen virker som før.
//
// Siden får bare `Terreng`: målene, kotene uten stier og adressen til fila.
// Mangler fila, tegner Kartblad reservevarianten: ramme, rutenett og
// kommunenavn, uten falskt terreng.
//
// Denne fila har bare typene og er trygg i nettleseren. Å lese terrengfilene
// gjør src/lib/terreng-fil.ts, på serveren.

export interface Linjesett {
  /** SVG-sti. Første punkt absolutt, resten relativt, heltall i viewBox-enheter. */
  d: string;
  /** Lengden på den lengste delstien, i viewBox-enheter. Styrer trykkeanimasjonen. */
  lengde: number;
}

/** Terrengfila slik `npm run terreng` skriver den. Bare på serveren. */
export interface Terrengfil {
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

/** Det siden får: alt unntatt stiene, og adressen til fila med dem. */
export interface Terreng {
  kommunenr: string;
  navn: string;
  bbox: [number, number, number, number];
  bredde: number;
  hoyde: number;
  kyst: { lengde: number };
  ekvidistanse: number;
  koter: { hoyde: number; tellekurve: boolean; lengde: number }[];
  kilde: string;
  attribusjon: string;
  /**
   * Adressen til SVG-fila med stiene, med et avtrykk av innholdet i
   * spørrestrengen, så en ny terrengfil ikke leses fra nettleserens hurtiglager.
   * Stiene heter `#hav`, `#kyst` og `#kote-<høyde>`.
   */
  fil: string;
}

/** Id-en til koten i SVG-fila. */
export const koteId = (hoyde: number) => `kote-${hoyde}`;
