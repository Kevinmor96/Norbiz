// Skriver dataindeksen src/lib/data/indeks.json fra src/data/*.json og
// regionregisteret.
//
//   npm run data:indeks            skriv indeksen
//   npm run data:indeks -- --sjekk  stopp med feil hvis den innsjekkede er gammel
//
// Hva indeksen er og hvorfor, står i src/lib/data/indeks.ts. Kjør skriptet
// etter hver endring i et datasett, som `npm run seed:build`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Regionregister } from "../src/data/region/types";
import { byggIndeks, skrivIndeks } from "../src/lib/data/indeks";
import { DATAMAPPE, lesDatasett } from "./seed-build";

export const REGIONFIL = join(DATAMAPPE, "region", "nord-norge.json");
export const INDEKSFIL = join(DATAMAPPE, "..", "lib", "data", "indeks.json");

export function lesRegion(fil = REGIONFIL): Regionregister | null {
  return existsSync(fil) ? (JSON.parse(readFileSync(fil, "utf8")) as Regionregister) : null;
}

/** Indeksen slik den skal stå i INDEKSFIL. */
export function lagIndekstekst(): string {
  return skrivIndeks(byggIndeks(lesDatasett(), lesRegion()));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = performance.now();
  const tekst = lagIndekstekst();
  const ms = Math.round(performance.now() - t0);
  if (process.argv.includes("--sjekk")) {
    const lagret = existsSync(INDEKSFIL) ? readFileSync(INDEKSFIL, "utf8") : "";
    if (lagret !== tekst) {
      console.error("src/lib/data/indeks.json er utdatert. Kjør `npm run data:indeks`.");
      process.exit(1);
    }
    console.log(`Dataindeksen er oppdatert (${ms} ms).`);
  } else {
    writeFileSync(INDEKSFIL, tekst);
    console.log(
      `Skrev src/lib/data/indeks.json: ${(tekst.length / 1024).toFixed(0)} KB på ${ms} ms.`,
    );
  }
}
