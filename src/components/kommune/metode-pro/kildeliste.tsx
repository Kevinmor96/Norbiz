// Kildelisten (DESIGN.md §5.9): hver kilde datasettet bygger på, med type,
// lenke og hvor mange påstander som står på den. Sortert slik datalaget gir
// den, flest påstander først, så leseren ser hva kartet hviler mest på.
//
// En kilde uten adresse i grunnlaget står uten lenke. Vi finner ikke opp en.

import { ArrowUpRight, ChevronDown } from "lucide-react";

import { KILDETYPER } from "@/lib/belegg";
import type { KildeUt } from "@/lib/data";
import { splittSisteOrd, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

function Kildenavn({ kilde }: { kilde: KildeUt }) {
  if (!kilde.url) return <span className="font-semibold">{kilde.navn}</span>;
  // Pilen bindes til siste ord, så den aldri står alene på en linje.
  const [foran, siste] = splittSisteOrd(kilde.navn);
  return (
    <a
      href={kilde.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
    >
      {foran}
      <span className="whitespace-nowrap">
        {siste}
        <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-0.15em]" aria-hidden="true" />
      </span>
      <span className="sr-only"> (åpnes i ny fane)</span>
    </a>
  );
}

/** Så mange kilder står åpent. Resten ligger bak «Vis alle», så lista ikke tar hele siden. */
const APNE = 10;

function Tabell({
  kilder,
  medHode,
}: {
  kilder: { kilde: KildeUt; antall: number }[];
  medHode: boolean;
}) {
  return (
    <table className="w-full border-collapse text-left text-[0.9375rem]">
      <thead className={cn(!medHode && "sr-only")}>
        <tr className="text-[0.8125rem] text-dempet">
          <th scope="col" className="pb-2 font-semibold">
            Kilde og type
          </th>
          <th scope="col" className="pb-2 text-right font-semibold">
            Påstander
          </th>
        </tr>
      </thead>
      <tbody>
        {kilder.map(({ kilde, antall }) => (
          <tr key={kilde.key} className="border-t border-linje align-baseline">
            <th scope="row" className="py-2 pr-4 font-normal">
              <Kildenavn kilde={kilde} />
              <span className="block text-[0.8125rem] leading-[1.4] text-dempet">
                {KILDETYPER[kilde.type]}
                {!kilde.url && ". Ingen adresse i grunnlaget"}
                {kilde.lisens && `. Lisens: ${kilde.lisens}`}
              </span>
            </th>
            <td className="py-2 text-right tabular-nums">{tall(antall)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Kildeliste({
  kilder,
  className,
}: {
  kilder: { kilde: KildeUt; antall: number }[];
  className?: string;
}) {
  if (kilder.length === 0) {
    return (
      <p className={cn("border border-dashed border-kote px-4 py-3.5 text-[0.9375rem]", className)}>
        Datasettet har ingen kilder ennå.
      </p>
    );
  }
  const forst = kilder.slice(0, APNE);
  const resten = kilder.slice(APNE);
  return (
    <div className={cn("flex flex-col", className)}>
      <Tabell kilder={forst} medHode />
      {resten.length > 0 && (
        <details className="group border-t border-linje">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-1.5 py-3 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden",
              "underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal",
            )}
          >
            <span className="group-open:hidden">Vis de {tall(resten.length)} andre kildene</span>
            <span className="hidden group-open:inline">
              Skjul de {tall(resten.length)} andre kildene
            </span>
            <ChevronDown
              className="size-4 transition-transform duration-200 ease-(--ease-ut) group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <Tabell kilder={resten} medHode={false} />
        </details>
      )}
    </div>
  );
}
