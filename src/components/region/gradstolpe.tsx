// Gradstolpen: hvor mye av et omfang som er hentet rett fra registrene, som
// en delstolpe i kildemerkets tre farger, med merkets form i forklaringen. Den
// er beviset for tallet den står ved: «5 678 roller», og hvor langt hver av dem
// er etterprøvd.
//
// Tellingen kommer ferdig fra datalaget (`Gradtelling`). Stolpen regner bare
// bredder.

import { MerkeSymbol, GRADFARGE } from "@/components/maktkart/merkesymbol";
import { GRADER, GRADREKKEFOLGE } from "@/lib/belegg";
import type { Gradtelling } from "@/lib/data";
import { tall } from "@/lib/format";
import { cn } from "@/lib/utils";

const FYLL = {
  verifisert: "bg-vann",
  oppgitt: "bg-trykk",
  maa_verifiseres: "bg-kote",
} as const;

export function Gradstolpe({
  telling,
  hva,
  className,
  kompakt = false,
}: {
  telling: Gradtelling;
  /** Hva som telles, i flertall: «roller». */
  hva: string;
  className?: string;
  /** Bare stolpen og én linje, til trange flater. */
  kompakt?: boolean;
}) {
  const { totalt } = telling;
  if (totalt === 0) {
    return (
      <p className={cn("self-start border border-dashed border-kote px-2 py-1 text-[0.8125rem] text-kote-tekst", className)}>
        Ingen {hva} i datasettet ennå
      </p>
    );
  }
  const andel = Math.floor((100 * telling.verifisert) / totalt);
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-[0.875rem] leading-[1.35]">
        <b className="font-semibold">
          {tall(telling.verifisert)} av {tall(totalt)} {hva}
        </b>{" "}
        <span className="text-dempet">
          er hentet rett fra registrene{andel > 0 && andel < 100 ? ` (${andel} %)` : ""}.
        </span>
      </p>
      <div
        className="flex h-2.5 w-full overflow-hidden border border-trykk bg-papir"
        role="img"
        aria-label={GRADREKKEFOLGE.map((g) => `${GRADER[g].navn}: ${tall(telling[g])}`).join(", ")}
      >
        {GRADREKKEFOLGE.map((g) =>
          telling[g] > 0 ? (
            <span
              key={g}
              className={cn("h-full", FYLL[g], g !== "verifisert" && "border-l border-papir")}
              style={{ width: `${(100 * telling[g]) / totalt}%` }}
            />
          ) : null,
        )}
      </div>
      {!kompakt && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-dempet">
          {GRADREKKEFOLGE.map((g) => (
            <li key={g} className="flex items-center gap-1.5 tabular-nums">
              <MerkeSymbol grad={g} storrelse={11} className={GRADFARGE[g]} />
              {GRADER[g].navn} {tall(telling[g])}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
