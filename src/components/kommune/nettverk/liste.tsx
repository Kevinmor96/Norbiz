// Lista er grafen som tekst (DESIGN.md §5.5), og den er med på alle
// skjermbredder. Personene står alfabetisk. Rekkefølgen er ingen rangering,
// og lista viser ingen tellinger per person.
//
// Lista tar alle personene som passer søket, også de grafen ikke har plass
// til. Den vises side for side, så en kommune med hundrevis av personer ikke
// gir en endeløs side.

import { useState } from "react";

import { Pastand } from "@/components/maktkart/kildemerke";
import type { RolleIOrgan, Rollestatus } from "@/lib/data";
import { antall } from "@/lib/format";
import type { Grafmodell } from "@/lib/graf/modell";
import { cn } from "@/lib/utils";

const STATUS: Record<Rollestatus, string | null> = {
  fast: null,
  fungerende: "fungerende",
  konstituert: "konstituert",
  permisjon: "i permisjon",
  vara: "vara",
};

/** Hvor mange personer lista viser om gangen. */
const SIDE = 24;

/** «Styreleder i Grøtsund Industripark AS», «Fylkesordfører i Fylkestinget, Ap, i permisjon». */
function rolletekst(r: RolleIOrgan): string {
  const tillegg = [r.parti, STATUS[r.status]].filter(Boolean).join(", ");
  return `${r.tittel} i ${r.org.navn}${tillegg ? `, ${tillegg}` : ""}`;
}

export function Personliste({
  personer,
  aktiv,
  settAktiv,
  className,
}: {
  personer: Grafmodell["personer"];
  aktiv: string | null;
  settAktiv: (person: string | null) => void;
  className?: string;
}) {
  const [vist, settVist] = useState(SIDE);
  // Et nytt søk begynner på første side. Nøkkelen er lista selv.
  const nokkel = personer.map((p) => p.person.key).join(",");
  const [forrige, settForrige] = useState(nokkel);
  if (forrige !== nokkel) {
    settForrige(nokkel);
    settVist(SIDE);
  }
  const synlige = personer.slice(0, vist);
  const igjen = personer.length - synlige.length;

  if (personer.length === 0) {
    return (
      <p className="border-t border-linje py-4 text-[0.9375rem] text-dempet">
        Ingen personer passer søket.
      </p>
    );
  }
  return (
    <div className={className}>
      <ul className="grid gap-x-8 border-b border-linje sm:grid-cols-2 xl:grid-cols-3">
        {synlige.map((p) => (
          <li
            key={p.person.key}
            className={cn(
              "-mx-2.5 flex flex-col gap-1.5 border-t border-linje px-2.5 py-3 transition-colors duration-150",
              aktiv === p.person.key && "bg-flate-2",
            )}
            onPointerEnter={(e) => e.pointerType === "mouse" && settAktiv(p.person.key)}
            onPointerLeave={(e) => e.pointerType === "mouse" && settAktiv(null)}
            onFocus={() => settAktiv(p.person.key)}
            onBlur={() => settAktiv(null)}
          >
            <p className="font-bold [font-stretch:104%]">{p.person.navn}</p>
            <ul className="flex flex-col gap-1 text-[0.875rem] leading-[1.45]">
              {p.roller.map((r) => (
                <li key={`${r.org.key}-${r.rolletype}-${r.tittel}`} className="text-pretty">
                  <Pastand
                    tekst={rolletekst(r)}
                    belegg={r.belegg}
                    pastand={`${p.person.navn}: ${rolletekst(r)}`}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {personer.length > SIDE && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="text-[0.875rem] text-dempet" aria-live="polite">
            Viser {synlige.length} av {antall(personer.length, "person", "personer")}.
          </p>
          {igjen > 0 && (
            <button
              type="button"
              onClick={() => settVist((v) => v + SIDE)}
              className="h-11 border border-trykk px-4 text-[0.875rem] font-semibold transition-transform duration-150 ease-(--ease-ut) hover:bg-flate-2 active:scale-[0.97]"
            >
              Vis {Math.min(SIDE, igjen)} til
            </button>
          )}
        </div>
      )}
    </div>
  );
}
