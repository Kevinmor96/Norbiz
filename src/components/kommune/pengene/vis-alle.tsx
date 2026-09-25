// De første radene i en lang liste, og resten bak «Vis alle». Innholdet står i
// HTML-en fra serveren, så alt kan søkes opp og leses uten JavaScript:
// <details> åpner seg selv.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function VisAlle({
  forste,
  resten,
  antall,
  hva,
  className,
}: {
  forste: ReactNode;
  resten: ReactNode;
  /** Hvor mange rader det er til sammen. */
  antall: number;
  /** «eierandeler», «foretak». */
  hva: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {forste}
      {resten && (
        <details className="group">
          <summary
            className={cn(
              "mt-3 inline-flex h-11 cursor-pointer list-none items-center gap-2 border border-trykk px-4 text-[0.875rem] font-semibold",
              "transition-transform duration-150 ease-(--ease-ut) select-none hover:bg-flate-2 active:scale-[0.97] [&::-webkit-details-marker]:hidden",
            )}
          >
            <span className="group-open:hidden">
              Vis alle {antall} {hva}
            </span>
            <span className="hidden group-open:inline">Vis færre</span>
          </summary>
          {resten}
        </details>
      )}
    </div>
  );
}
