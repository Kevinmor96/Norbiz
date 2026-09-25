// Lista er grafen som tekst (DESIGN.md §5.5), og den er med på alle
// skjermbredder. Personene står alfabetisk. Rekkefølgen er ingen rangering,
// og lista viser ingen tellinger per person.

import { Pastand } from "@/components/maktkart/kildemerke";
import type { RolleIOrgan, Rollestatus } from "@/lib/data";
import type { Grafmodell } from "@/lib/graf/modell";
import { cn } from "@/lib/utils";

const STATUS: Record<Rollestatus, string | null> = {
  fast: null,
  fungerende: "fungerende",
  konstituert: "konstituert",
  permisjon: "i permisjon",
  vara: "vara",
};

/** «Styreleder i Grøtsund Industripark AS», «Fylkesordfører i Fylkestinget, Ap, i permisjon». */
export function rolletekst(r: RolleIOrgan): string {
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
  return (
    <ul
      className={cn(
        "grid gap-x-8 border-b border-linje sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {personer.map((p) => (
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
  );
}
