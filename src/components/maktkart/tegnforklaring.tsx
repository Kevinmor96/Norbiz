// Tegnforklaringen (DESIGN.md §3, §5.9). Den forklarer merkene og er samtidig
// filteret: et trykk på en grad demper alle andre merker på siden og viser
// «Viser må verifiseres: 143 merker. Vis alle».
//
// Tellingene kommer fra datasettet gjennom KommuneKontekst (eller `telling`),
// aldri fra hvor mange merker som tilfeldigvis står på siden.
//
//   <Tegnforklaring />                     kompakt: «Slik leser du merkene», i toppen og i margen
//   <Tegnforklaring form="full" />         full: grader, kildetyper, linjer og løype, i metoden
//   <Symbolforklaring />                   linjer og løype alene, i margen når skjermen er høy nok

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";

import { GRADER, GRADREKKEFOLGE, KILDETYPER } from "@/lib/belegg";
import type { Kildetype, Verifisering, Verifiseringstelling } from "@/lib/data";
import { KILDETYPER as KILDETYPEREKKEFOLGE } from "@/lib/data/kontrakt";
import { antall, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useKildefilter } from "./kildefilter";
import { useKommune } from "./kommune-kontekst";
import { GRADFARGE, MerkeSymbol } from "./merkesymbol";

const TOM: Verifiseringstelling = { verifisert: 0, oppgitt: 0, maa_verifiseres: 0 };

/** Hvilke kilder hver type dekker. Rekkefølgen er tillit, høyest først. */
const KILDETYPE_FORKLARING: Record<Kildetype, string> = {
  register: "Brønnøysundregistrene, Aksjonærregisteret, Stortingets data, SSB og Lovdata.",
  offisiell: "Organets egen side: kommunen, fylket, regjeringen, etatene og selskapene selv.",
  media: "Redaksjonelle kilder.",
  sekundaer:
    "Videreformidlere av registerdata, som Proff og Purehelp, og researchgrunnlaget der det ikke navngir en kilde. Skal erstattes av registeret.",
  oppslagsverk: "Leksikon og oppslagsverk. Bare berikelse.",
};

export function Tegnforklaring({
  form = "kompakt",
  tittel,
  overskrift: Overskrift = "h2",
  telling,
  className,
}: {
  form?: "kompakt" | "full";
  /** Overskriften. Kompakt: «Slik leser du merkene». Full: «Kildemerkene». */
  tittel?: string | undefined;
  overskrift?: "h2" | "h3" | undefined;
  /** Overstyrer tellingene fra KommuneKontekst. */
  telling?: Verifiseringstelling | undefined;
  className?: string | undefined;
}) {
  const kommune = useKommune();
  const t = telling ?? kommune?.telling ?? TOM;
  const { filter, settFilter } = useKildefilter();
  const full = form === "full";

  const grader = (
    <ToggleGroupPrimitive.Root
      type="single"
      value={filter ?? ""}
      onValueChange={(v) => settFilter((v || null) as Verifisering | null)}
      aria-label="Vis bare merker med én grad"
      className={cn(
        full ? "grid border border-trykk md:grid-cols-3" : "-mx-2 flex flex-col gap-0.5",
      )}
    >
      {GRADREKKEFOLGE.map((g) => (
        <ToggleGroupPrimitive.Item
          key={g}
          value={g}
          className={cn(
            "cursor-pointer border border-transparent text-left transition-[background-color,border-color,transform] duration-150 ease-(--ease-ut) active:scale-[0.985]",
            "hover:bg-flate-2 data-[state=on]:border-trykk data-[state=on]:bg-papir",
            full
              ? "flex flex-col gap-2 p-4 max-md:[&+&]:border-t-trykk md:[&+&]:border-l-trykk"
              : "grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 px-2 py-1.5",
          )}
        >
          {full ? (
            <>
              <MerkeSymbol grad={g} storrelse={24} className={GRADFARGE[g]} />
              <span className="text-[1.0625rem] font-bold">{GRADER[g].navn}</span>
              <span className="text-[0.875rem] leading-[1.45] text-dempet text-pretty">
                {GRADER[g].lang}
              </span>
              <span className="mt-auto pt-1 text-[0.8125rem] font-semibold tabular-nums">
                {antall(t[g], "påstand", "påstander")}
              </span>
            </>
          ) : (
            <>
              <MerkeSymbol grad={g} storrelse={14} className={GRADFARGE[g]} />
              <span className="text-[0.9375rem] font-semibold">{GRADER[g].navn}</span>
              <span className="text-[0.8125rem] text-dempet tabular-nums">{tall(t[g])}</span>
              <span className="col-span-2 col-start-2 text-[0.75rem] leading-[1.35] text-dempet">
                {GRADER[g].kort}
              </span>
            </>
          )}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );

  return (
    <div className={cn("flex flex-col", full ? "gap-8" : "gap-2.5", className)}>
      <div className="flex flex-col gap-2.5">
        <Overskrift
          className={cn(full ? "text-[1.25rem] font-bold seksjon" : "text-[0.9375rem] font-bold")}
        >
          {tittel ?? (full ? "Kildemerkene" : "Slik leser du merkene")}
        </Overskrift>
        {full && (
          <p className="brodtekst text-dempet">
            Hver påstand har et merke. Formen viser hvor langt påstanden er etterprøvd. Trykk på en
            grad for å vise bare merkene med den graden.
          </p>
        )}
        {grader}
        <Filtermelding telling={t} />
      </div>
      {full && <Kildetyper />}
      {full && <Symbolforklaring full />}
    </div>
  );
}

/** «Viser må verifiseres: 143 merker. Vis alle». Står alltid i DOM-en, så skjermlesere hører endringen. */
function Filtermelding({ telling }: { telling: Verifiseringstelling }) {
  const { filter, settFilter } = useKildefilter();
  return (
    <p aria-live="polite" className="text-[0.8125rem] leading-[1.4]">
      {filter ? (
        <span className="block border border-dashed border-kote bg-papir px-2.5 py-2">
          Viser {GRADER[filter].navn.toLowerCase()}:{" "}
          <b className="font-semibold">{antall(telling[filter], "merke", "merker")}</b>.{" "}
          {telling[filter] === 0 && "Ingen påstand har denne graden ennå. "}
          <button
            type="button"
            onClick={() => settFilter(null)}
            className="cursor-pointer font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
          >
            Vis alle
          </button>
        </span>
      ) : (
        <span className="text-dempet">Trykk på en grad for å vise bare den.</span>
      )}
    </p>
  );
}

function Kildetyper() {
  const kommune = useKommune();
  const perType = new Map<Kildetype, number>();
  for (const k of kommune?.kilder ?? []) {
    perType.set(k.kilde.type, (perType.get(k.kilde.type) ?? 0) + k.antall);
  }
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[1.0625rem] font-bold">Kildetypene</h3>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Rekkefølgen er tillit, høyest først. Tallet er hvor mange påstander som bygger på typen.
      </p>
      <ol className="flex flex-col">
        {KILDETYPEREKKEFOLGE.map((type) => (
          <li
            key={type}
            className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-linje py-2.5 text-[0.9375rem] max-sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span className="font-semibold">{KILDETYPER[type]}</span>
            <span className="text-[0.875rem] text-dempet max-sm:order-3 max-sm:col-span-2">
              {KILDETYPE_FORKLARING[type]}
            </span>
            <span className="text-[0.875rem] tabular-nums">{tall(perType.get(type) ?? 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Rad({ symbol, children }: { symbol: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex w-7 shrink-0 justify-center" aria-hidden="true">
        {symbol}
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Linjene, løypa og de manglende tilstandene. Løypas starttrekant og
 * kildemerkets trekant står side om side, så ingen forveksler dem
 * (DESIGN.md §5.2).
 */
export function Symbolforklaring({
  full = false,
  tett = false,
  className,
}: {
  full?: boolean;
  /** Uten setningen om de to trekantene. For margen, der høyden er knapp. */
  tett?: boolean;
  className?: string | undefined;
}) {
  const liste = cn(
    "grid gap-x-4 gap-y-1.5 text-[0.8125rem] leading-[1.35]",
    full && "sm:grid-cols-2",
  );
  const gruppe = full ? "text-[1.0625rem] font-bold" : "text-[0.75rem] font-semibold text-dempet";
  return (
    <div className={cn("flex flex-col", full ? "gap-6" : "gap-4", className)}>
      <div className="flex flex-col gap-2">
        <h3 className={gruppe}>Linjer</h3>
        <ul className={liste}>
          <Rad
            symbol={
              <svg width="28" height="8" className="stroke-trykk">
                <line x1="0" y1="4" x2="28" y2="4" strokeWidth="2" />
              </svg>
            }
          >
            Person med rolle i begge organer
          </Rad>
          <Rad
            symbol={
              <svg width="28" height="8" className="stroke-trykk">
                <line x1="0" y1="4" x2="28" y2="4" strokeWidth="2" strokeDasharray="6 4" />
              </svg>
            }
          >
            Stiplet: bygger på noe som må verifiseres
          </Rad>
          <Rad
            symbol={
              <svg width="28" height="8">
                <line x1="0" y1="4" x2="22" y2="4" strokeWidth="1.5" className="stroke-vann" />
                <path d="M21 1l6 3-6 3z" className="fill-vann" />
              </svg>
            }
          >
            Eierskap
          </Rad>
          <Rad
            symbol={
              <svg width="28" height="10">
                <rect
                  x="1"
                  y="1"
                  width="26"
                  height="8"
                  fill="none"
                  strokeDasharray="3 2"
                  className="stroke-kote"
                />
              </svg>
            }
          >
            Planlagt eller foreslått. Har ikke skjedd.
          </Rad>
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={gruppe}>Beslutningsløypa</h3>
        <ul className={liste}>
          <Rad
            symbol={
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M9 2 16 15H2Z" fill="none" strokeWidth="1.8" className="stroke-signal" />
              </svg>
            }
          >
            Saken starter
          </Rad>
          <Rad
            symbol={
              <svg width="18" height="18" viewBox="0 0 18 18">
                <circle
                  cx="9"
                  cy="9"
                  r="7"
                  fill="none"
                  strokeWidth="1.8"
                  className="stroke-signal"
                />
              </svg>
            }
          >
            Post i saken
          </Rad>
          <Rad
            symbol={
              <svg width="18" height="18" viewBox="0 0 18 18">
                <circle
                  cx="9"
                  cy="9"
                  r="7.5"
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-signal"
                />
                <circle
                  cx="9"
                  cy="9"
                  r="4.2"
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-signal"
                />
              </svg>
            }
          >
            Vedtaket
          </Rad>
          <Rad
            symbol={
              <svg width="18" height="18" viewBox="0 0 18 18">
                <circle
                  cx="9"
                  cy="9"
                  r="7"
                  fill="none"
                  strokeWidth="1.6"
                  strokeDasharray="3 2.4"
                  className="stroke-kote"
                />
              </svg>
            }
          >
            Steget er ikke kartlagt
          </Rad>
        </ul>
        <p className={cn("text-[0.75rem] leading-[1.4] text-dempet", tett && "hidden")}>
          Løypas trekant er stor og rød og finnes bare på løypa. Kildemerkets trekant{" "}
          <MerkeSymbol grad="maa_verifiseres" storrelse={11} className="inline text-kote" /> er
          liten og står etter en påstand.
        </p>
      </div>
      {full && (
        <div className="flex flex-col gap-2">
          <h3 className={gruppe}>Det som mangler</h3>
          <ul className="flex flex-col gap-2.5 text-[0.875rem] leading-[1.45]">
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="border border-dashed border-kote px-2 py-0.5 text-[0.8125rem] text-kote-tekst">
                Leder ikke kartlagt
              </span>
              <span className="text-dempet">
                Datasettet navngir ingen. Det er et hull, ikke en feil.
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <MerkeSymbol grad="maa_verifiseres" storrelse={14} className="text-kote" />
              <span className="text-dempet">
                Et navn eller tall finnes, men er ikke etterprøvd mot kilden.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
