// Hull i datasettet, gjort om til tekst leseren kan bruke.
//
// Et hull (`HullPunkt`) er noe grunnlaget nevner, men som ikke kan vises som
// fakta. Teksten kommer rett fra researchgrunnlaget og bærer merket
// «[verifiser via X]». Det merket skal aldri nå leseren (DESIGN.md §3). Vi
// leser det i stedet som en adresse: X er stedet navnet skal hentes fra, og
// leseren får «Hentes fra X.».
//
// Brukes av beslutningskjeden («Leder ikke kartlagt. Hentes fra …») og av
// tidslinjen (gruppen «Uten dato»).

import type { HullPunkt } from "@/lib/data";
import { lesbar } from "@/lib/format";

export interface Hullhint {
  /** Hva som mangler, lesbart: «Leder og medlemmer er ikke navngitt.» */
  hva: string;
  /** Resten av forklaringen, uten setningen som bare sier at noe er merket i grunnlaget. */
  forklaring: string | null;
  /** Stedet grunnlaget sier opplysningen skal hentes fra, eller `null`. */
  hentesFra: string | null;
}

/** «[verifiser via innsyn.tromso.kommune.no]» og «[verifiser i Brreg]». */
const ADRESSE = /\[verifiser\s+(?:via|i)\s+([^\]]+)\]/i;

/**
 * Setninger som bare gjentar at noe mangler i grunnlaget. De sier ingenting
 * leseren ikke allerede ser av merket, så de utelates.
 */
const TOMGANG = /^(merket\b[^.]*\bi grunnlaget\.?|ikke oppgitt i grunnlaget\.?)$/i;

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
  const treff = ADRESSE.exec(h.hvorfor) ?? ADRESSE.exec(h.hva);
  const hentesFra = treff?.[1]?.trim().replace(/\.$/, "") ?? null;
  // Når adressen er lest ut, er setningen den stod i overflødig.
  const rest = setninger(h.hvorfor).filter(
    (s) => !TOMGANG.test(s) && !(hentesFra && ADRESSE.test(s)),
  );
  return {
    hva: lesbar(h.hva),
    forklaring: rest.length ? lesbar(rest.join(" ")) : null,
    hentesFra,
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
