// Små tegn organkortet, skuffen, organsiden og bransjematrisen deler. Tre av
// dem handler om det vi ikke vet, og de skiller seg i form (DESIGN.md §3):
//
//   Ikke kartlagt      stiplet brikke          datasettet navngir ingen
//   Må verifiseres     trekantmerket           finnes, men er ikke etterprøvd (Kildemerke)
//   Kildene er uenige  skravert felt           to kilder sier forskjellige ting
//
// Skraveringen er kartets tegn for omstridt område. Alle tre står i kotefarge,
// fordi kote betyr uetterprøvd.

import type { ReactNode } from "react";

import type { Myndighet, Rollestatus } from "@/lib/data";
import { MYNDIGHETNAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import { STATUSNAVN } from "./tekst";

const BRIKKE =
  "inline-flex items-center gap-1.5 px-[7px] py-[4px] text-[0.75rem] leading-[1.15] whitespace-nowrap [font-stretch:92%]";

/**
 * Myndigheten som små etiketter. Innstilling er forberedende makt og står i
 * signalfarge, som i beslutningskjeden. Uten myndighet står en stiplet brikke.
 */
export function MyndighetListe({
  myndighet,
  className,
  organnavn,
}: {
  myndighet: readonly Myndighet[];
  className?: string;
  /** Til skjermlesere: «Myndigheten til Kommunestyret». */
  organnavn?: string;
}) {
  if (!myndighet.length) {
    return (
      <p className={cn("flex", className)}>
        <IkkeKartlagt>Myndighet ikke kartlagt</IkkeKartlagt>
      </p>
    );
  }
  return (
    <ul
      aria-label={organnavn ? `Myndigheten til ${organnavn}` : "Myndighet"}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {myndighet.map((m) => (
        <li
          key={m}
          className={cn(
            BRIKKE,
            "border",
            m === "innstilling"
              ? "border-signal font-semibold text-signal-tekst"
              : "border-linje-sterk text-trykk",
          )}
        >
          {MYNDIGHETNAVN[m]}
        </li>
      ))}
    </ul>
  );
}

/** Stiplet brikke: datasettet navngir ingen. «Leder ikke kartlagt». */
export function IkkeKartlagt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        BRIKKE,
        "border border-dashed border-kote font-medium text-kote-tekst",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Skravert felt, kartets tegn for omstridt område. */
export function Skravur({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3 shrink-0 border border-kote",
        "bg-[repeating-linear-gradient(135deg,var(--kote)_0_1.25px,transparent_1.25px_3.5px)]",
        className,
      )}
    />
  );
}

/** «Kildene er uenige», eget merke fra retning A. */
export function KildeneUenige({ className }: { className?: string }) {
  return (
    <span className={cn(BRIKKE, "border border-kote font-semibold text-kote-tekst", className)}>
      <Skravur />
      Kildene er uenige
    </span>
  );
}

/** Fungerende, konstituert, i permisjon eller vara. Fast vises ikke. */
export function Statusmerke({ status, className }: { status: Rollestatus; className?: string }) {
  const navn = STATUSNAVN[status];
  if (!navn) return null;
  return (
    <span
      className={cn(
        "inline-block border border-dashed border-trykk px-[5px] py-px align-[0.08em] text-[0.6875rem] leading-[1.25] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
        className,
      )}
    >
      {navn}
    </span>
  );
}

/**
 * En slutt som er kjent, men ikke har skjedd: «fungerende til januar 2027».
 * Åpen strek i kotefarge, som «Planlagt eller foreslått» i tegnforklaringen.
 */
export function Planlagt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span>{children}</span>
      <span className="border border-dashed border-kote px-[5px] py-px text-[0.6875rem] leading-[1.25] font-medium whitespace-nowrap text-kote-tekst">
        planlagt
      </span>
    </span>
  );
}

/** Åpen strek i kotefarge, som «Planlagt eller foreslått» i tegnforklaringen. */
export function HarIkkeSkjedd({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border border-dashed border-kote px-[5px] py-px text-[0.6875rem] leading-[1.25] font-medium whitespace-nowrap text-kote-tekst",
        className,
      )}
    >
      har ikke skjedd
    </span>
  );
}

/** Domstol, politi, påtale og Forsvaret: bare toppleder vises. */
export function Sensitivmerke({ className }: { className?: string }) {
  return (
    <span className={cn(BRIKKE, "border border-linje-sterk bg-flate-2 text-dempet", className)}>
      Bare toppleder vises
    </span>
  );
}

/** Styrken i en bransjekobling som strektykkelse: primær, sekundær, indirekte. */
export const STYRKE: Record<1 | 2 | 3, { navn: string; strek: number; forklaring: string }> = {
  3: { navn: "Primær", strek: 6, forklaring: "Bransjen er et hovedområde for organet." },
  2: {
    navn: "Sekundær",
    strek: 3,
    forklaring: "Organet påvirker bransjen, men den er ikke hovedområdet.",
  },
  1: {
    navn: "Indirekte",
    strek: 1.25,
    forklaring: "Organet påvirker bransjen gjennom noe det gjør for alle, som finansiering.",
  },
};

export function Styrkestrek({ styrke, className }: { styrke: 1 | 2 | 3; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 8"
      width="32"
      height="8"
      aria-hidden="true"
      className={cn("shrink-0 text-trykk", className)}
    >
      <line x1="0" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth={STYRKE[styrke].strek} />
    </svg>
  );
}
