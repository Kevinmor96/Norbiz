// Regionkartets geometri: ferdige SVG-stier fra byggesteget `npm run
// regionkart` (scripts/regionkart.ts), i src/data/regionkart/.
//
// Stiene importeres i modulen og ikke gjennom loaderen. Loaderdata
// serialiseres inn i HTML-en ved siden av det tegnede kartet, så kartet ville
// stått der to ganger. Som modul står det i én JavaScript-fil som nettleseren
// mellomlagrer, og forsiden og fylkessidene deler den.
//
// Fylkesfilene leses med glob, så en ny region eller et nytt fylke er nye filer
// fra byggesteget, ingen kodeendring her.

import grenserJson from "../../data/regionkart/grenser.json";
import landJson from "../../data/regionkart/land.json";

export type Utsnitt = [number, number, number, number];

export interface Grenser {
  meta: {
    kilde: string;
    url: string;
    /** Datoen kommunepolygonene ble hentet fra Kartverket. */
    hentet: string;
    landflate: string;
    attribusjon: string;
    projeksjon: string;
    merknad: string;
  };
  bredde: number;
  hoyde: number;
  /** Yttergrensen: mot havet, mot Sverige, Finland og Russland, og mot Trøndelag. */
  ytre: string;
  fylkesgrenser: string;
  kommunegrenser: string;
  fylker: { nr: string; utsnitt: Utsnitt; etikett: [number, number] }[];
}

export interface Fylkeskart {
  fylkesnr: string;
  utsnitt: Utsnitt;
  /** Landmasken for utsnittet, i finere oppløsning enn regionens. */
  land: string;
  kommuner: {
    nr: string;
    d: string;
    /** Punktet på land som ligger lengst inne i kommunen. */
    etikett: [number, number];
    /** Flaten med sjøarealet, i kvadrat-enheter. */
    flate: number;
  }[];
}

const filer = import.meta.glob<Fylkeskart>("../../data/regionkart/[0-9]*.json", {
  eager: true,
  import: "default",
});

export const GRENSER = grenserJson as Grenser;
export const REGIONLAND = (landJson as { land: string }).land;

/** Fylkeskartene, sortert på fylkesnummer. */
export const FYLKESKART: Fylkeskart[] = Object.values(filer).sort((a, b) =>
  a.fylkesnr < b.fylkesnr ? -1 : 1,
);
