// Kommunesidens oppsett fra 1 200 px: en klebrig marg til venstre med
// innholdslisten over tegnforklaringen, og seksjonene til høyre (DESIGN.md §6).
//
// Margen er høydebevisst. Alle ni seksjoner og aktiv markering skal synes ved
// 1 440 × 900, så ved lav skjerm (≤ 900 px) foldes tegnforklaringen til
// gradene og filteret. Linjene og løypa vises bare når hele forklaringen får
// plass uten at margen må rulles (fra 1 040 px høyde). Under 1 200 px finnes
// ikke margen: tegnforklaringen ligger i bunnlinjen (ForhandsversjonBunn).
//
// Aktiv seksjon følger rullingen, også tilbake til toppen: den aktive er den
// siste seksjonen som har passert en linje en tredjedel ned i vinduet.

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Symbolforklaring, Tegnforklaring } from "./tegnforklaring";

export interface MargSeksjon {
  id: string;
  navn: string;
}

function useAktivSeksjon(ider: string[]): string | undefined {
  const [aktiv, settAktiv] = useState<string | undefined>(ider[0]);
  const nokkel = ider.join(",");

  useEffect(() => {
    const liste = nokkel.split(",");
    let ramme = 0;
    const mal = () => {
      ramme = 0;
      const linje = window.innerHeight * 0.33;
      let valgt = liste[0];
      for (const id of liste) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= linje) valgt = id;
      }
      // Helt nederst kan den siste seksjonen være for kort til å nå linjen.
      const bunn = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (bunn) valgt = liste[liste.length - 1];
      settAktiv(valgt);
    };
    const paaRull = () => {
      if (!ramme) ramme = window.requestAnimationFrame(mal);
    };
    mal();
    window.addEventListener("scroll", paaRull, { passive: true });
    window.addEventListener("resize", paaRull);
    return () => {
      window.cancelAnimationFrame(ramme);
      window.removeEventListener("scroll", paaRull);
      window.removeEventListener("resize", paaRull);
    };
  }, [nokkel]);

  return aktiv;
}

export function MargIndeks({
  seksjoner,
  children,
  className,
}: {
  /** Alle seksjonene på siden, også de som står over margen (toppen). */
  seksjoner: readonly MargSeksjon[];
  children: ReactNode;
  className?: string;
}) {
  const aktiv = useAktivSeksjon(seksjoner.map((s) => s.id));

  return (
    <div
      className={cn(
        "ramme marg:grid marg:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)] marg:gap-12",
        className,
      )}
    >
      <aside
        aria-label="Innhold og tegnforklaring"
        className={cn(
          "hidden marg:flex",
          "sticky top-[calc(var(--topp)+20px)] mt-[clamp(56px,8vw,112px)] max-h-[calc(100dvh-var(--topp)-40px)] flex-col self-start",
          "overflow-y-auto border border-trykk bg-flate [scrollbar-width:thin]",
        )}
      >
        <nav
          aria-label="Innhold på siden"
          className="border-b border-linje px-4 pt-3.5 pb-3 lav:pt-3 lav:pb-2.5"
        >
          <h2 className="region mb-2 text-[0.6875rem] text-dempet">Innhold</h2>
          <ol className="flex flex-col text-[0.875rem]">
            {seksjoner.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={aktiv === s.id ? "location" : undefined}
                  className={cn(
                    "block border-l-2 py-[3px] pl-3 no-underline transition-colors duration-150 lav:py-[2px]",
                    aktiv === s.id
                      ? "border-signal font-semibold text-trykk"
                      : "border-transparent text-dempet hover:text-trykk",
                  )}
                >
                  {s.navn}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-col gap-4 px-4 pt-3.5 pb-4 lav:gap-3 lav:pt-3 lav:pb-3">
          <Tegnforklaring tittel="Tegnforklaring" />
          <Symbolforklaring tett className="hidden hoy:flex" />
        </div>
      </aside>
      <div id="innhold-seksjoner" className="min-w-0">
        {children}
      </div>
    </div>
  );
}
