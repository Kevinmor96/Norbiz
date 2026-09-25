// Datasettene på disk, lastet latt: én fil per kommune, bare når et svar
// trenger den.
//
// `import.meta.glob` uten `eager` gir én bit per kommunefil i serverbygget.
// Ingen fil lastes før et svar trenger den, og en fil som er lastet, huskes så
// lenge prosessen lever. Hvilke filer et svar trenger, står i indeksen
// (indeks.ts, `npm run data:indeks`). En ny kommune er en ny fil og en ny
// indeks, ingen kodeendring.
//
// Denne modulen skal bare importeres på serveren. Nettleseren får det en
// loader returnerer, og organskuffen og søket henter JSON fra /data/... (se
// src/lib/data/hent.ts). Slik havner ingen datasett i klientbunten.

import registerJson from "../../data/region/nord-norge.json";
import type { Regionregister } from "../../data/region/types";
import type { Kommunedatasett } from "../../data/types";
import type { Dataindeks } from "./indeks";
import indeksJson from "./indeks.json";
import { lagLatLokal } from "./lat";

const filer = import.meta.glob<Kommunedatasett>("../../data/*.json", { import: "default" });

/** Slug (filnavnet uten .json) → laster. */
export const datafiler: Record<string, () => Promise<Kommunedatasett>> = Object.fromEntries(
  Object.entries(filer).map(([sti, last]) => [
    sti.replace(/^.*\//, "").replace(/\.json$/, ""),
    last,
  ]),
);

export const region = registerJson as unknown as Regionregister;

export const lokal = lagLatLokal({
  filer: datafiler,
  indeks: indeksJson as unknown as Dataindeks,
  region,
  // I utvikling endres datasettene mens serveren går. Da sjekkes alle filene
  // mot indeksen første gang, og indeksen bygges på nytt når de ikke stemmer.
  kontroll: import.meta.env.DEV ? "alle" : "lastede",
});
