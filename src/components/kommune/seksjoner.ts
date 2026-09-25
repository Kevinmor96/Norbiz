// De ni seksjonene på kommunesiden, i rekkefølgen fra spec §3. Ankeret (`id`)
// og navnet i innholdslisten står her, ett sted, så margen, lenkene og
// seksjonene selv ikke kan komme i utakt.
//
// Endres et anker, brytes delte lenker. Ikke endre dem uten grunn.

import type { Kommuneside } from "@/lib/kommuneside";

export const SEKSJONER = [
  { id: "topp", navn: "Kartbladet" },
  { id: "kjeden", navn: "Beslutningskjeden" },
  { id: "organer", navn: "Organkartet" },
  { id: "pengene", navn: "Pengene" },
  { id: "nettverket", navn: "Nettverket" },
  { id: "endringer", navn: "Endringene" },
  { id: "bransje", navn: "Din bransje" },
  { id: "neste", navn: "Neste kommune" },
  { id: "metode", navn: "Metode og Pro" },
] as const;

export type SeksjonId = (typeof SEKSJONER)[number]["id"];

/** Navnet i innholdslisten, brukt som regionnavn over seksjonens tittel. */
export function seksjonsnavn(id: SeksjonId): string {
  return SEKSJONER.find((s) => s.id === id)?.navn ?? id;
}

/**
 * Det hver seksjon får fra ruten: hele kommunesiden fra loaderen. En seksjon
 * leser feltene den trenger og ignorerer resten, så ruten ikke må endres når
 * en seksjon trenger noe mer. Se `Kommuneside` i src/lib/kommuneside.ts.
 */
export interface SeksjonProps {
  side: Kommuneside;
}
