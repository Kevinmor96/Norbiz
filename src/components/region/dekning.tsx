// Tegnforklaringen til regionkartet: hva fargene betyr, og hvor mange kommuner
// som har hver klasse. Den sier rett ut at fargen er dekning og ikke makt.
//
// Tellingene kommer fra loaderen (klassene er regnet der), aldri fra hvor
// mange flater som står på kartet.

import { useId } from "react";

import { antall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { fyllFor, Skravur } from "./regionkart";
import { DEKNING, DEKNINGSKLASSER, type Klassetelling } from "./typer";

export function Dekningsforklaring({
  klasser,
  className,
}: {
  klasser: Klassetelling;
  className?: string;
}) {
  const id = `df${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <p className="text-[0.9375rem] font-bold">Fargen er dekning, ikke makt</p>
      <p className="text-[0.8125rem] leading-[1.45] text-dempet text-pretty">
        Mer blekk betyr at vi har mer av svaret på «hvem bestemmer her?» for kommunen. Fargen sier
        ingenting om hvor mye makt det er der.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-x-6">
        {DEKNINGSKLASSER.map((k) => (
          <li key={k} className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5">
            <svg viewBox="0 0 22 16" width="22" height="16" aria-hidden="true" className="mt-0.5">
              <defs>
                <Skravur id={`${id}-${k}`} tetthet={0.7} />
              </defs>
              <rect
                x="0.5"
                y="0.5"
                width="21"
                height="15"
                {...fyllFor(k, `${id}-${k}`)}
                className={cn(fyllFor(k, "").className, "stroke-trykk")}
                strokeWidth="1"
              />
            </svg>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-[0.8125rem] font-semibold sm:text-[0.875rem]">
                {DEKNING[k].navn}
                <span className="text-[0.8125rem] font-normal text-dempet tabular-nums">
                  {antall(klasser[k], "kommune", "kommuner")}
                </span>
              </span>
              <span className="text-[0.75rem] leading-[1.4] text-dempet text-pretty max-sm:hidden">
                {DEKNING[k].forklaring}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* På mobil står forklaringene sammenfoldet, så søket kommer høyere opp. */}
      <details className="text-[0.8125rem] sm:hidden">
        <summary className="cursor-pointer font-semibold underline decoration-linje-sterk underline-offset-[0.2em]">
          Hva klassene betyr
        </summary>
        <dl className="mt-2 flex flex-col gap-1.5 text-[0.75rem] leading-[1.4] text-dempet">
          {DEKNINGSKLASSER.map((k) => (
            <div key={k}>
              <dt className="inline font-semibold text-trykk">{DEKNING[k].navn}. </dt>
              <dd className="inline">{DEKNING[k].forklaring}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
