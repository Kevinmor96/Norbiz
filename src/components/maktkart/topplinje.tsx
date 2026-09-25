// Topplinjen: merket, kommunen siden handler om, forhåndsversjonen, metode,
// Pro-ventelisten og kartvelgeren. Klebrig under den sikre sonen øverst på
// mobil (notch), så den aldri havner under statuslinjen.

import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

import { ForhandsversjonTopp, type Forhandsvarsel } from "./forhandsversjon";

/** Ordmerket: en kartramme med kystlinje og kote. Ingen signalfarge, den er for kjeden. */
export function Kartmerke({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M1.8 16.5c3-.6 4.4-3.8 7.8-3.8 3.6 0 4.6 3 8 2.6 1.9-.2 3-1 4.6-1.9"
        fill="none"
        strokeWidth="1.5"
        className="stroke-vann"
      />
      <path
        d="M4.5 10.8c2.4-.8 3.6-4.2 6.8-4.2 2.7 0 4.2 2.2 7.7 1.4"
        fill="none"
        strokeWidth="1.2"
        className="stroke-kote"
      />
    </svg>
  );
}

export function Topplinje({
  kommune,
  sammenstilt,
  varsel,
  metodeHref = "/metode",
  proHref = "/pro",
}: {
  /** Kommunen eller fylket siden handler om. Utelates på sider som ikke gjelder ett sted. */
  kommune?: { navn: string; kommunenr: string; nummertekst?: string } | null;
  /**
   * `YYYY-MM-DD`. Uten dato og uten `varsel` vises ikke forhåndsversjonen i
   * topplinjen. Setningen regnes fra gradene (se forhandsversjon.tsx).
   */
  sammenstilt?: string | null;
  /** Forhåndsvarselet siden har regnet fra gradene. */
  varsel?: Forhandsvarsel | null;
  metodeHref?: string;
  proHref?: string;
}) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-linje bg-papir">
      <a
        href="#innhold"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-flate focus:px-3 focus:py-2"
      >
        Gå til innholdet
      </a>
      <div className="ramme flex h-(--topp) items-center gap-4 marg:gap-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[1.125rem] font-extrabold tracking-[-0.01em] whitespace-nowrap no-underline [font-stretch:118%]"
          aria-label="Maktkart, til forsiden"
        >
          <Kartmerke />
          Maktkart
        </Link>
        {kommune && (
          <p className="flex min-w-0 items-baseline gap-2 border-l border-linje pl-4 whitespace-nowrap">
            <b className="truncate font-semibold">{kommune.navn}</b>
            <span className="text-[0.875rem] text-dempet max-sm:hidden">
              {kommune.nummertekst ?? `kommunenr. ${kommune.kommunenr}`}
            </span>
          </p>
        )}
        {(sammenstilt || varsel) && (
          <ForhandsversjonTopp varsel={varsel} className="ml-auto max-w-[27rem] max-marg:hidden" />
        )}
        <nav
          aria-label="Hovedmeny"
          className={cn(
            "flex gap-5 text-[0.9375rem] max-md:hidden",
            sammenstilt || varsel ? "max-marg:ml-auto" : "ml-auto",
          )}
        >
          <a href={metodeHref} className="no-underline hover:underline hover:decoration-signal">
            Metode
          </a>
          <a
            href={proHref}
            className="whitespace-nowrap no-underline hover:underline hover:decoration-signal"
          >
            Venteliste for Pro
          </a>
        </nav>
        <ThemeToggle className="max-md:ml-auto" />
      </div>
    </header>
  );
}
