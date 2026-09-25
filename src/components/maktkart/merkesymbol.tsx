// De tre formene til kildemerket (DESIGN.md §3). Gradene skiller seg i form,
// ikke bare i farge, så de kan leses i gråtoner og av fargeblinde:
//
//   verifisert       fylt sirkel                 vann
//   oppgitt          ring med senterpunkt        trykk   (som et fastmerke på kart)
//   maa_verifiseres  åpen trekant, 1,5 px strek  kote
//
// Fargen kommer fra `currentColor`, så den som tegner symbolet bestemmer den
// med en tekstfarge (text-vann, text-trykk, text-kote). Kontrasten mot
// flatene er minst 3:1 i begge temaer.

import type { Verifisering } from "@/lib/data";
import { cn } from "@/lib/utils";

export const GRADFARGE: Record<Verifisering, string> = {
  verifisert: "text-vann",
  oppgitt: "text-trykk",
  maa_verifiseres: "text-kote",
};

/** Tekstfargen for gradens navn. Kote er for lys til tekst, så «må verifiseres» bruker kote-tekst. */
export const GRADTEKST: Record<Verifisering, string> = {
  verifisert: "text-vann",
  oppgitt: "text-trykk",
  maa_verifiseres: "text-kote-tekst",
};

export function MerkeSymbol({
  grad,
  storrelse = 12,
  className,
}: {
  grad: Verifisering;
  /** Bredde og høyde i px. Streken skalerer med, og er 1,5 px ved 12 px. */
  storrelse?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={storrelse}
      height={storrelse}
      aria-hidden="true"
      focusable="false"
      className={cn("block shrink-0 overflow-visible", className)}
    >
      {grad === "verifisert" && <circle cx="6" cy="6" r="4.9" fill="currentColor" />}
      {grad === "oppgitt" && (
        <>
          <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="1.7" fill="currentColor" />
        </>
      )}
      {grad === "maa_verifiseres" && (
        <path
          d="M6 1.25 10.9 10.1H1.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
