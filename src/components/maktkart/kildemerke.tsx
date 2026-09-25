// Kildemerket: produktets signatur (DESIGN.md §3). Hver påstand har et merke,
// og et trykk eller hover viser kildelappen.
//
// Bruk:
//
//   // Et merke etter en påstand. Merket bindes til siste ord, så det aldri
//   // står alene på en ny linje.
//   <Pastand tekst="Åslaug Haga valgt til styreleder i Troms Kraft" belegg={h.belegg} />
//
//   // Et merke etter et tall eller annen JSX. Innholdet og merket brytes ikke.
//   <MedMerke belegg={r.belegg} pastand="Tromsø kommune eier 40 % av Troms Kraft AS">
//     {prosent(40)}
//   </MedMerke>
//
//   // Bare merket, når du binder det selv.
//   <Kildemerke belegg={b} pastand="43 medlemmer i kommunestyret" />
//
// `pastand` er setningen leseren ser øverst i lappen. Skriv den som en hel
// påstand, med organets navn, så lappen gir mening alene.
//
// Belegget kan være et `BeleggUt` fra datalaget eller et avledet belegg for
// et tall siden teller opp selv (se `avledBelegg` i src/lib/belegg.ts).

import type { ReactNode } from "react";

import { erAvledet, GRADER, type Belegg } from "@/lib/belegg";
import { antall, dato, splittSisteOrd } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useKildelapp } from "./kildelapp";
import { MerkeSymbol } from "./merkesymbol";

export interface KildemerkeProps {
  belegg: Belegg;
  /** Påstanden merket står for, som en hel setning. Vises øverst i kildelappen. */
  pastand: string;
  /** Symbolets størrelse i px. 12 er standard i tekst. */
  storrelse?: number | undefined;
  className?: string | undefined;
}

/** Det skjermlesere hører: graden og kilden, uten å åpne lappen. */
function merkelapp(belegg: Belegg): string {
  const grad = GRADER[belegg.verifisering].navn;
  const per = belegg.per ? `, per ${dato(belegg.per)}` : "";
  if (erAvledet(belegg)) {
    return `${grad}. Telt fra ${antall(belegg.antall, "påstand", "påstander")}${per}. Vis kilder`;
  }
  return `${grad}. Kilde: ${belegg.kilde.navn}${per}. Vis kilde`;
}

export function Kildemerke({ belegg, pastand, storrelse = 12, className }: KildemerkeProps) {
  const lapp = useKildelapp();
  const innhold = { belegg, pastand };
  return (
    <button
      type="button"
      className={cn("kildemerke", className)}
      data-grad={belegg.verifisering}
      aria-label={merkelapp(belegg)}
      aria-haspopup="dialog"
      aria-expanded="false"
      onClick={(e) => lapp?.trykk(innhold, e.currentTarget)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") lapp?.hoverInn(innhold, e.currentTarget);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") lapp?.hoverUt();
      }}
    >
      <MerkeSymbol grad={belegg.verifisering} storrelse={storrelse} />
    </button>
  );
}

/**
 * En påstand i tekst med kildemerket bundet til siste ord. `pastand` er
 * teksten i lappen, og er lik `tekst` når den ikke er satt.
 */
export function Pastand({
  tekst,
  belegg,
  pastand,
  storrelse,
  className,
}: {
  tekst: string;
  belegg: Belegg;
  pastand?: string;
  storrelse?: number | undefined;
  className?: string | undefined;
}) {
  const [foran, siste] = splittSisteOrd(tekst);
  return (
    <span className={className}>
      {foran}
      <span className="whitespace-nowrap">
        {siste}
        <Kildemerke belegg={belegg} pastand={pastand ?? tekst} storrelse={storrelse} />
      </span>
    </span>
  );
}

/** Innhold og merke som ikke brytes fra hverandre. For tall, beløp og korte navn. */
export function MedMerke({
  children,
  belegg,
  pastand,
  storrelse,
  className,
}: {
  children: ReactNode;
  belegg: Belegg;
  pastand: string;
  storrelse?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {children}
      <Kildemerke belegg={belegg} pastand={pastand} storrelse={storrelse} />
    </span>
  );
}
