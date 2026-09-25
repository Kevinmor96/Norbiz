// Kildelappen: det kildemerket åpner. Påstanden, graden med forklaring, kilden
// med type og lenke, per-dato og merknad (DESIGN.md §3).
//
// Siden har hundrevis av kildemerker. Hvert av dem er bare en knapp, og det
// finnes én kildelapp for hele siden, forankret til merket som ble trykket på.
// Da koster et merke nesten ingenting å tegne og hydrere, og to lapper kan
// aldri stå åpne samtidig.
//
// Med mus eller styreplate er lappen en Popover som åpnes ved hover (etter en
// kort pause) eller trykk. Med berøring er den en Drawer nedenfra. En lapp åpnet
// med trykk blir stående til den lukkes. Tastaturet åpner med Enter eller
// mellomrom, og Escape lukker og gir fokus tilbake til merket.

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowUpRight } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { FIN_PEKER, useMediaQuery } from "@/hooks/use-media-query";
import { erAvledet, GRADER, KILDETYPER, type Belegg } from "@/lib/belegg";
import type { KildeUt } from "@/lib/data";
import { antall, dato, lesbar, splittSisteOrd } from "@/lib/format";
import { cn } from "@/lib/utils";

import { GRADFARGE, GRADTEKST, MerkeSymbol } from "./merkesymbol";

export interface Lappinnhold {
  belegg: Belegg;
  /** Påstanden merket står for, slik leseren skal se den i lappen. */
  pastand: string;
}

interface Aapen extends Lappinnhold {
  anker: HTMLElement;
  via: "hover" | "trykk";
  metodeHref: string;
}

interface LappApi {
  trykk(innhold: Lappinnhold, anker: HTMLElement): void;
  hoverInn(innhold: Lappinnhold, anker: HTMLElement): void;
  hoverUt(): void;
}

const LappKontekst = createContext<LappApi | null>(null);

/** For Kildemerke. `null` utenfor KildefilterProvider: da er merket bare et symbol. */
export function useKildelapp(): LappApi | null {
  return useContext(LappKontekst);
}

const LAPP_ID = "kildelapp";

/**
 * «Om kildemerkene» peker dit merkene forklares: seksjonen #metode på
 * kommunesiden, delen #merkene på metodesiden, og /metode#merkene ellers.
 * Ankeret er `MERKENE_ANKER`, og metodesiden bruker samme konstant som id.
 */
export const MERKENE_ANKER = "merkene";

function metodeLenke(): string {
  if (typeof document === "undefined") return `/metode#${MERKENE_ANKER}`;
  if (document.getElementById("metode")) return "#metode";
  // Stien og ikke id-en avgjør: forsiden har også en del som heter #merkene.
  if (window.location.pathname.replace(/\/+$/, "") === "/metode") return `#${MERKENE_ANKER}`;
  return `/metode#${MERKENE_ANKER}`;
}

export function KildelappVert({ children }: { children: ReactNode }) {
  const [aapen, settAapenState] = useState<Aapen | null>(null);
  // Hendelsene leser tilstanden synkront. En ref holder den oppdatert uten å
  // lage nye funksjoner, så merkene aldri tegnes på nytt når lappen åpnes.
  const naa = useRef<Aapen | null>(null);
  const sist = useRef<Aapen | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ankerRef = useRef<HTMLElement | null>(null);
  const innholdRef = useRef<HTMLDivElement | null>(null);
  const finPeker = useMediaQuery(FIN_PEKER, true);

  const api = useMemo<LappApi>(() => {
    const sett = (neste: Aapen | null) => {
      naa.current = neste;
      if (neste) {
        sist.current = neste;
        ankerRef.current = neste.anker;
      }
      settAapenState(neste);
    };
    const stopp = () => window.clearTimeout(timer.current);
    return {
      trykk(innhold, anker) {
        stopp();
        const n = naa.current;
        if (n && n.anker === anker && n.via === "trykk") return sett(null);
        sett({ ...innhold, anker, via: "trykk", metodeHref: metodeLenke() });
      },
      hoverInn(innhold, anker) {
        stopp();
        const n = naa.current;
        // En lapp åpnet med trykk er festet og flyttes ikke av musa.
        if (n?.via === "trykk" || n?.anker === anker) return;
        const vis = () => sett({ ...innhold, anker, via: "hover", metodeHref: metodeLenke() });
        // Første lapp venter litt, så en mus som bare passerer ikke åpner noe.
        // Er en lapp alt åpen, flytter den seg straks.
        if (n) vis();
        else timer.current = window.setTimeout(vis, 160);
      },
      hoverUt() {
        stopp();
        if (naa.current?.via === "trykk") return;
        timer.current = window.setTimeout(() => {
          if (naa.current?.via === "hover") sett(null);
        }, 180);
      },
    };
  }, []);

  // aria-expanded og aria-controls settes rett på merket som eier lappen, så
  // ingen andre merker tegnes på nytt.
  useEffect(() => {
    const el = aapen?.anker;
    if (!el) return;
    el.setAttribute("aria-expanded", "true");
    el.setAttribute("aria-controls", LAPP_ID);
    return () => {
      el.setAttribute("aria-expanded", "false");
      el.removeAttribute("aria-controls");
    };
  }, [aapen?.anker]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lukk = () => {
    window.clearTimeout(timer.current);
    naa.current = null;
    settAapenState(null);
  };
  const vist = aapen ?? sist.current;

  return (
    <LappKontekst.Provider value={api}>
      {children}
      {finPeker ? (
        <PopoverPrimitive.Root open={aapen !== null} onOpenChange={(o) => !o && lukk()}>
          <PopoverPrimitive.Anchor virtualRef={ankerRef as RefObject<HTMLElement>} />
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              id={LAPP_ID}
              ref={innholdRef}
              tabIndex={-1}
              aria-label={vist ? `Kilde: ${vist.pastand}` : "Kilde"}
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={12}
              className={cn(
                "z-50 w-[min(340px,calc(100vw-32px))] border border-trykk bg-flate px-4 py-3.5 text-trykk outline-none",
                "origin-(--radix-popover-content-transform-origin) duration-150 ease-(--ease-ut)",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              )}
              onOpenAutoFocus={(e) => {
                // Hover skal ikke stjele fokus. Trykk flytter fokus til lappen,
                // så en skjermleser leser den.
                e.preventDefault();
                if (naa.current?.via === "trykk")
                  innholdRef.current?.focus({ preventScroll: true });
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                if (sist.current?.via === "trykk")
                  sist.current.anker.focus({ preventScroll: true });
              }}
              onInteractOutside={(e) => {
                // Et trykk på merket som eier lappen, håndteres av merket selv (veksle).
                if (naa.current?.anker.contains(e.target as Node)) e.preventDefault();
              }}
              onPointerEnter={() => window.clearTimeout(timer.current)}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") api.hoverUt();
              }}
            >
              {vist && <KildelappInnhold {...vist} />}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      ) : (
        <DrawerPrimitive.Root
          open={aapen !== null}
          onOpenChange={(o) => !o && lukk()}
          shouldScaleBackground={false}
        >
          <DrawerPrimitive.Portal>
            <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-slor" />
            <DrawerPrimitive.Content
              id={LAPP_ID}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col border-t border-trykk bg-flate text-trykk outline-none"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 bg-linje-sterk" aria-hidden="true" />
              <DrawerPrimitive.Title className="sr-only">
                {vist ? `Kilde: ${vist.pastand}` : "Kilde"}
              </DrawerPrimitive.Title>
              <DrawerPrimitive.Description className="sr-only">
                Kilden, datoen og hvor langt påstanden er etterprøvd.
              </DrawerPrimitive.Description>
              <div className="overflow-y-auto px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
                {vist && <KildelappInnhold {...vist} />}
                <DrawerPrimitive.Close className="mt-4 h-11 w-full border border-trykk text-[0.9375rem] font-semibold transition-transform duration-150 ease-(--ease-ut) active:scale-[0.98]">
                  Lukk
                </DrawerPrimitive.Close>
              </div>
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Portal>
        </DrawerPrimitive.Root>
      )}
    </LappKontekst.Provider>
  );
}

function KildeNavn({ kilde }: { kilde: KildeUt }) {
  if (!kilde.url) return <>{kilde.navn}</>;
  // Pilen bindes til siste ord, så den aldri står alene på en linje.
  const [foran, siste] = splittSisteOrd(kilde.navn);
  return (
    <a
      href={kilde.url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-linje-sterk hover:decoration-signal"
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

/** Innholdet i lappen. Eksportert for tegnforklaringen i full form og for tester. */
export function KildelappInnhold({
  belegg,
  pastand,
  metodeHref = `/metode#${MERKENE_ANKER}`,
}: Lappinnhold & { metodeHref?: string }) {
  const g = belegg.verifisering;
  const merknad = belegg.merknad ? lesbar(belegg.merknad) : null;
  return (
    <div className="flex flex-col gap-2.5 text-[0.875rem] leading-[1.45]">
      <p className={cn("flex items-center gap-2 font-bold", GRADTEKST[g])}>
        <MerkeSymbol grad={g} storrelse={14} className={GRADFARGE[g]} />
        {GRADER[g].navn}
      </p>
      <p className="font-semibold text-pretty">{pastand}</p>
      <dl className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        {erAvledet(belegg) ? (
          <>
            <dt className="text-dempet">Bygger på</dt>
            <dd>{antall(belegg.antall, "påstand", "påstander")} i datasettet</dd>
            <dt className="text-dempet">{belegg.kilder.length === 1 ? "Kilde" : "Kilder"}</dt>
            <dd>
              <ul className="flex flex-col gap-0.5">
                {belegg.kilder.map((k) => (
                  <li key={k.key}>
                    <KildeNavn kilde={k} />
                  </li>
                ))}
              </ul>
            </dd>
          </>
        ) : (
          <>
            <dt className="text-dempet">Kilde</dt>
            <dd>
              <KildeNavn kilde={belegg.kilde} />
              <span className="block text-[0.8125rem] text-dempet">
                {KILDETYPER[belegg.kilde.type]}
              </span>
            </dd>
          </>
        )}
        <dt className="text-dempet">Per</dt>
        <dd>{belegg.per ? dato(belegg.per) : "Ikke oppgitt"}</dd>
        {!erAvledet(belegg) && belegg.hentet && (
          <>
            <dt className="text-dempet">Hentet</dt>
            <dd>{dato(belegg.hentet.slice(0, 10))}</dd>
          </>
        )}
        {merknad && (
          <>
            <dt className="text-dempet">Merknad</dt>
            <dd className="text-pretty">{merknad}</dd>
          </>
        )}
      </dl>
      <p className="border-t border-linje pt-2.5 text-[0.8125rem] text-dempet text-pretty">
        {GRADER[g].lang}{" "}
        <a
          href={metodeHref}
          className="text-trykk underline decoration-linje-sterk hover:decoration-signal"
        >
          Om kildemerkene
        </a>
      </p>
    </div>
  );
}
