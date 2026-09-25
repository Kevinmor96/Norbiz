// «Hull i datasettet (N)» (DESIGN.md §5.9). Et hull er noe grunnlaget nevner,
// men som ikke kan vises som fakta ennå: en leder uten navn, et tall uten år,
// kilder som er uenige. Lista er lukket som standard og kan foldes ut. Den er et
// <details>, så den virker uten JavaScript og med tastatur.
//
// Hullene grupperes på nivå og organ, så leseren ser hvor de ligger tettest.
// All tekst går gjennom `lesbar`: «[verifiser]» fra grunnlaget skal aldri nå
// leseren (DESIGN.md §3).

import { ChevronDown } from "lucide-react";

// Fra butikken, ikke skuffen: lista står også på /metode, der skuffen ikke finnes.
import { OrganLenke } from "@/components/organ/organ-lenke";
import type { HullPunkt, Nivaa, OrganRef } from "@/lib/data";
import { NIVAAER } from "@/lib/data/kontrakt";
import { antall, lesbar, tall } from "@/lib/format";
import { NIVAANAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";


const samlet = new Intl.Collator("nb");

interface Gruppe {
  nivaa: Nivaa;
  organer: { org: OrganRef; hull: HullPunkt[] }[];
  antall: number;
}

function grupper(hull: HullPunkt[]): Gruppe[] {
  const perNivaa = new Map<Nivaa, Map<string, { org: OrganRef; hull: HullPunkt[] }>>();
  for (const h of hull) {
    const nivaa = perNivaa.get(h.gjelder.nivaa) ?? new Map();
    const organ = nivaa.get(h.gjelder.key) ?? { org: h.gjelder, hull: [] };
    organ.hull.push(h);
    nivaa.set(h.gjelder.key, organ);
    perNivaa.set(h.gjelder.nivaa, nivaa);
  }
  // Kommunens egne hull først: det er dem leseren på en kommuneside leter etter.
  const rekkefolge: Nivaa[] = ["kommune", ...NIVAAER.filter((n) => n !== "kommune")];
  return rekkefolge
    .filter((n) => perNivaa.has(n))
    .map((n) => {
      const organer = [...(perNivaa.get(n)?.values() ?? [])].sort((a, b) =>
        samlet.compare(a.org.navn, b.org.navn),
      );
      return { nivaa: n, organer, antall: organer.reduce((s, o) => s + o.hull.length, 0) };
    });
}

export function HullListe({ hull, className }: { hull: HullPunkt[]; className?: string }) {
  if (hull.length === 0) {
    return (
      <p className={cn("border border-dashed border-kote px-4 py-3.5 text-[0.9375rem]", className)}>
        Datasettet har ingen registrerte hull. Det kan også bety at ingen er ført opp ennå.
      </p>
    );
  }
  const g = grupper(hull);
  return (
    <details className={cn("group border border-dashed border-kote", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden",
          "transition-colors duration-150 hover:bg-flate-2",
        )}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[1.0625rem] font-bold">
            Hull i datasettet ({tall(hull.length)})
          </span>
          <span className="text-[0.8125rem] text-dempet">
            Det grunnlaget nevner, men som ikke kan vises som fakta ennå.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[0.875rem] text-dempet">
          <span className="group-open:hidden">Vis</span>
          <span className="hidden group-open:inline">Skjul</span>
          <ChevronDown
            className="size-4 transition-transform duration-200 ease-(--ease-ut) group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-dashed border-kote px-4 pt-4 pb-5">
        {g.map((gruppe) => (
          <div key={gruppe.nivaa} className="flex flex-col gap-2">
            <p className="region text-[0.6875rem] text-dempet">
              {NIVAANAVN[gruppe.nivaa]} · {antall(gruppe.antall, "hull", "hull")}
            </p>
            <ul
              className="flex flex-col"
              aria-label={`Hull, ${NIVAANAVN[gruppe.nivaa].toLowerCase()}`}
            >
              {gruppe.organer.map(({ org, hull: liste }) => (
                <li key={org.key} className="border-t border-linje py-2.5">
                  <OrganLenke
                    org={org}
                    className="text-[0.9375rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                  />
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {liste.map((h) => (
                      <li
                        key={h.hva}
                        className="grid grid-cols-[12px_minmax(0,1fr)] gap-x-2.5 text-[0.875rem] leading-[1.45]"
                      >
                        {/* En tom rute: noe som mangler. Kildemerkets trekant betyr noe annet (uetterprøvd). */}
                        <span
                          className="mt-[6px] size-2.5 border border-dashed border-kote"
                          aria-hidden="true"
                        />
                        <span className="text-pretty">
                          {lesbar(h.hva)} <span className="text-dempet">{lesbar(h.hvorfor)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
