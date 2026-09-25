// En seksjon på kommunesiden. Hver seksjon er et selvstendig svar som kan
// lenkes til med #anker og deles alene (spec §3), så hodet har en knapp som
// kopierer lenken.
//
//   <Seksjon id="pengene" region="Pengene" tittel="Hva eier kommunen?" ingress="…">
//     …
//   </Seksjon>
//
// `region` er seksjonens navn i innholdslisten, satt som regionnavn på et kart
// (versal, sperret). Tittelen er spørsmålet leseren stiller.

import { Link2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SeksjonRammeProps {
  /** Ankeret. Må være likt `id` i SEKSJONER (src/components/kommune/seksjoner.ts). */
  id: string;
  region: string;
  tittel: ReactNode;
  ingress?: ReactNode;
  /** Kontroller under ingressen, f.eks. prosessvelgeren i kjeden. */
  verktoy?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Seksjon({
  id,
  region,
  tittel,
  ingress,
  verktoy,
  children,
  className,
}: SeksjonRammeProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-tittel`}
      className={cn(
        "scroll-mt-[calc(var(--topp)+16px)] border-t border-linje py-[clamp(56px,8vw,112px)]",
        className,
      )}
    >
      <header className="mb-[clamp(28px,4vw,44px)] flex max-w-[62ch] flex-col gap-3">
        <p className="region text-[0.75rem] text-dempet">{region}</p>
        <div className="flex items-start gap-2">
          <h2
            id={`${id}-tittel`}
            className="seksjon min-w-0 text-[clamp(1.75rem,1.2rem+2vw,2.8rem)]"
          >
            {tittel}
          </h2>
          <LenkeKnapp id={id} />
        </div>
        {ingress && (
          <p className="ingress text-[clamp(1rem,0.95rem+0.25vw,1.125rem)] text-dempet">
            {ingress}
          </p>
        )}
        {verktoy && <div className="mt-2">{verktoy}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * Knappen som kopierer lenken til seksjonen. Den negative bunnmargen gjør at
 * knappen aldri er høyere enn én tittellinje, så avstanden fra tittel til
 * ingress er lik i alle seksjoner, også når tittelen får plass på én linje.
 */
function LenkeKnapp({ id }: { id: string }) {
  const [kopiert, settKopiert] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <a
      href={`#${id}`}
      aria-label="Kopier lenke til seksjonen"
      onClick={async (e) => {
        e.preventDefault();
        const url = `${window.location.href.split("#")[0]}#${id}`;
        history.replaceState(null, "", `#${id}`);
        try {
          await navigator.clipboard.writeText(url);
          settKopiert(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => settKopiert(false), 1600);
        } catch {
          // Utklippstavlen kan være blokkert. Adressen i feltet er da lenken.
        }
      }}
      className="relative mt-[0.35em] -mb-[0.35em] inline-grid size-7 shrink-0 place-items-center border border-transparent text-dempet transition-colors duration-150 hover:border-linje-sterk hover:text-trykk"
    >
      <Link2 className="size-4" aria-hidden="true" />
      <span
        role="status"
        className={cn(
          "pointer-events-none absolute top-full right-0 mt-1 bg-trykk px-2 py-0.5 text-[0.75rem] font-medium tracking-normal whitespace-nowrap text-paa-trykk [font-stretch:100%]",
          kopiert ? "opacity-100" : "opacity-0",
          "transition-opacity duration-150",
        )}
      >
        {kopiert ? "Lenke kopiert" : ""}
      </span>
    </a>
  );
}
