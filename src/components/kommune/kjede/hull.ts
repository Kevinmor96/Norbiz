// Hull i datasettet, gjort om til tekst leseren kan bruke.
//
// Et hull (`HullPunkt`) er noe grunnlaget nevner, men som ikke kan vises som
// fakta. Teksten kommer fra researchgrunnlaget og kan bære merket
// «[verifiser via X]». Det merket skal aldri nå leseren (DESIGN.md §3).
// `lesbar` skriver det om til «Hentes fra X.», og `hentesFra` leser X ut, så
// leseren får adressen som egen opplysning. Begge står i src/lib/format.ts og
// virker på både råtekst og tekst som alt er skrevet om.
//
// Brukes av beslutningskjeden («Leder ikke kartlagt. Hentes fra …») og av
// tidslinjen (gruppen «Uten dato»).

import type { HullPunkt } from "@/lib/data";
import { hentesFra as hentested, lesbar } from "@/lib/format";

export interface Hullhint {
  /** Hva som mangler, lesbart: «Leder og medlemmer er ikke navngitt.» */
  hva: string;
  /** Resten av forklaringen, uten setningen som bare sier at noe er merket i grunnlaget. */
  forklaring: string | null;
  /** Stedet grunnlaget sier opplysningen skal hentes fra, eller `null`. */
  hentesFra: string | null;
}

/**
 * Setninger som bare gjentar at noe mangler i grunnlaget. De sier ingenting
 * leseren ikke allerede ser av merket, så de utelates.
 */
const TOMGANG =
  /^(merket\b[^.]*\bi grunnlaget\.?|ikke oppgitt i grunnlaget\.?|grunnlaget merker opplysningen som usikker\.?)$/i;

function setninger(tekst: string): string[] {
  // Del etter punktum fulgt av mellomrom. «innsyn.tromso.kommune.no» og
  // «adm. dir.» inne i en setning har ikke stor bokstav etter seg, så de
  // deles ikke.
  return tekst
    .split(/(?<=\.)\s+(?=[A-ZÆØÅ«])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hullhint(h: HullPunkt): Hullhint {
  const hentesFra = hentested(h.hvorfor) ?? hentested(h.hva);
  // Når adressen er lest ut, er setningen den stod i overflødig.
  const rest = setninger(lesbar(h.hvorfor)).filter(
    (s) => !TOMGANG.test(s) && !(hentesFra && hentested(s)),
  );
  return {
    hva: lesbar(h.hva),
    forklaring: rest.length ? rest.join(" ") : null,
    hentesFra: hentesFra?.replace(/\.$/, "") ?? null,
  };
}

/** Hull som sier at et navn mangler: en leder, et lag under lederen, medlemmene. */
export function erNavnehull(h: HullPunkt): boolean {
  return /ikke navngitt/i.test(h.hva);
}

/** Hull som sier at en dato mangler: en endring som har skjedd, men ikke kan plasseres i tid. */
export function erDatohull(h: HullPunkt): boolean {
  return /dato/i.test(h.hva) || /dato|plasseres i tid/i.test(h.hvorfor);
}
