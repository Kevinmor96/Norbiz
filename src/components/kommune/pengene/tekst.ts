// Tall som tekst, delt av radene i Pengene: verdien og året med omfang.

import type { NokkeltallUt } from "@/lib/data";
import { kroner, tall } from "@/lib/format";

/** «2025, konsern», «2024», «2025 H1, morselskap». Morselskap og konsern bare der kilden skiller dem. */
export function aarOgOmfang(t: NokkeltallUt): string {
  const aar = t.periode ? `${t.aar} ${t.periode}` : String(t.aar);
  if (t.konsern === true) return `${aar}, konsern`;
  if (t.konsern === false) return `${aar}, morselskap`;
  return aar;
}

export function verdiTekst(t: NokkeltallUt): string {
  return t.enhet === "aarsverk" ? `${tall(t.verdi)}\u00a0årsverk` : kroner(t.verdi);
}
