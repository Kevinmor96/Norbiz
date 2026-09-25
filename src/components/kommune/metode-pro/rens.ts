// Fritekst fra grunnlaget gjort lesbar for leseren (DESIGN.md §3).

import { lesbar } from "@/lib/format";

/**
 * `lesbar` skriver om «[verifiser]», «[verifiser via …]» og «[verifiser i …]».
 * Grunnlaget har også former som «[verifiser navn]» og «[verifiser org.form]»,
 * og de skal heller ikke vises. Det som er igjen i hakeparentes, blir
 * «må verifiseres».
 */
export function rens(tekst: string): string {
  return lesbar(tekst).replace(/\[\s*verifiser[^\]]*\]/gi, "«må verifiseres»");
}
