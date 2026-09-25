// Ett nivåbånd i organkartet (DESIGN.md §5.3): regionnavnet i sperret
// versal, paraplyen (kommunen eller fylkeskommunen selv) og organene, i
// kolonner og grupper.
//
// Båndet kan foldes. Sammenfoldet viser det antallet og de viktigste
// organene: tre på mobil (DESIGN.md), åtte på skrivebord. Regelen for
// «viktigst» står i baand.ts.
//
// Når båndet er bredt nok, står regionnavnet i en egen marg til venstre, som
// randopplysningene på et kartblad, og organene får resten av bredden.
// Bredden måles på båndet selv (container query), fordi innholdsspalten er
// smalere når sidemargen med innholdslisten er der.
//
// Alle organene står i HTML-en fra serveren. Et sammenfoldet bånd skjuler
// resten med CSS, så søkemotorer og leserens søk i siden finner alle, og
// siden ser lik ut før og etter hydrering. Derfor en egen knapp med
// aria-expanded, og ikke Radix Collapsible, som tar innholdet ut av DOM-en
// når det er lukket.

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Pastand } from "@/components/maktkart/kildemerke";
import { useOrganSkuff } from "@/components/organ/organ-skuff";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { antall, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  FORHAND_MOBIL,
  FORHAND_SKRIVEBORD,
  minsteRang,
  type Baand,
  type Gruppe,
} from "./baand";
import { Organkort } from "./organkort";

/**
 * Klassene som skjuler et organ (eller en overskrift over organer) i et
 * sammenfoldet bånd. `rang` er plassen i viktighetsrekkefølgen.
 */
function synlighet(rang: number, aapen: boolean, skrivebord: number): string {
  if (aapen || rang < FORHAND_MOBIL) return "";
  return rang < skrivebord ? "max-md:hidden" : "hidden";
}

/** Kort som kommer til syne når båndet åpnes, tones inn. Bare de som faktisk var skjult. */
function inntoning(rang: number, aapnet: boolean, skrivebord: number): string {
  if (!aapnet || rang < FORHAND_MOBIL) return "";
  return rang < skrivebord
    ? "max-md:animate-in max-md:fade-in-0 max-md:duration-200"
    : "animate-in fade-in-0 duration-200";
}

const RUTENETT = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] gap-2";

function Gruppefelt({
  gruppe,
  overskrift: H,
  aapen,
  aapnet,
  skrivebord,
}: {
  gruppe: Gruppe;
  overskrift: "h4" | "h5";
  aapen: boolean;
  aapnet: boolean;
  skrivebord: number;
}) {
  const min = minsteRang(gruppe.organer);
  return (
    <div className={cn("flex flex-col gap-2.5", synlighet(min, aapen, skrivebord))}>
      {gruppe.tittel && (
        <H className="flex items-center gap-3 text-[0.8125rem] font-semibold text-dempet">
          <span className="min-w-0">
            {gruppe.belegg ? (
              <Pastand
                tekst={gruppe.tittel}
                belegg={gruppe.belegg}
                pastand={`${gruppe.tittel}: ${antall(gruppe.organer.length, "selskap", "selskaper")}`}
              />
            ) : (
              gruppe.tittel
            )}{" "}
            <span className="ml-1 text-[0.75rem] font-normal tabular-nums">
              {tall(gruppe.organer.length)}
            </span>
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-linje" />
        </H>
      )}
      <ul className={RUTENETT}>
        {gruppe.organer.map((p) => (
          <Organkort
            key={p.kort.key}
            plassert={p}
            synlighet={cn(synlighet(p.rang, aapen, skrivebord), inntoning(p.rang, aapnet, skrivebord))}
          />
        ))}
      </ul>
    </div>
  );
}

export function Nivaabaand({ baand }: { baand: Baand }) {
  const [aapen, settAapen] = useState(false);
  // Inntoningen gjelder bare når leseren åpner, ikke ved første maling.
  const [aapnet, settAapnet] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  const redusert = useReducedMotion();
  const { aapen: aapentOrgan } = useOrganSkuff();

  const skrivebord = FORHAND_SKRIVEBORD;
  const alle = useMemo(
    () => [...baand.kolonner.flatMap((k) => k.grupper), ...baand.grupper].flatMap((g) => g.organer),
    [baand],
  );

  // Åpnes et organ i skuffen (fra en lenke eller adressen) som er skjult her,
  // foldes båndet ut, så kortet står bak skuffen når den lukkes.
  useEffect(() => {
    if (!aapentOrgan || aapen) return;
    const p = alle.find((o) => o.kort.key === aapentOrgan);
    if (p && p.rang >= FORHAND_MOBIL) settAapen(true);
  }, [aapentOrgan, aapen, alle]);

  const knappSynlig =
    baand.antall <= FORHAND_MOBIL ? "hidden" : baand.antall <= skrivebord ? "md:hidden" : "";

  const veksle = () => {
    const neste = !aapen;
    settAapen(neste);
    settAapnet(neste);
    // Når et langt bånd foldes sammen, flyttes knappen langt opp. Leseren
    // skal ikke miste plassen sin, så båndets topp rulles inn om den er borte.
    if (!neste && ref.current && ref.current.getBoundingClientRect().top < 0) {
      ref.current.scrollIntoView({ block: "start", behavior: redusert ? "auto" : "smooth" });
    }
  };

  return (
    <section
      ref={ref}
      aria-labelledby={`${id}-tittel`}
      className="@container scroll-mt-[calc(var(--topp)+16px)] px-4 pt-5 pb-6 md:px-6 md:pt-6 md:pb-7"
    >
      <div className="grid gap-x-8 gap-y-4 @min-[50rem]:grid-cols-[11.5rem_minmax(0,1fr)]">
        <header className="flex flex-col gap-1.5 @min-[50rem]:gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 @min-[50rem]:flex-col">
            <h3 id={`${id}-tittel`} className="region text-[0.875rem] tracking-[0.22em]">
              {baand.region}
            </h3>
            <p className="text-[0.8125rem] leading-[1.35] text-dempet tabular-nums">
              {antall(baand.antall + (baand.paraply ? 1 : 0), "organ", "organer")}
              {baand.antall > 0 && (
                <>
                  {" · "}
                  <span className="whitespace-nowrap">
                    {tall(baand.medLeder)} av {tall(baand.antall)} med navngitt leder
                  </span>
                </>
              )}
            </p>
          </div>
          <p className="maal text-[0.875rem] leading-[1.45] text-dempet">{baand.forklaring}</p>
        </header>

        <div className="@container min-w-0">
          {baand.paraply && <Organkort plassert={baand.paraply} stor className="mb-5" />}

          <div id={`${id}-organer`} className="flex flex-col gap-6">
            {baand.kolonner.length > 0 && (
              <div className="grid gap-x-5 gap-y-6 @min-[38rem]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {baand.kolonner.map((k) => {
                  const min = minsteRang(k.grupper.flatMap((g) => g.organer));
                  return (
                    <div
                      key={k.id}
                      className={cn("flex min-w-0 flex-col gap-3", synlighet(min, aapen, skrivebord))}
                    >
                      <h4 className="border-b border-trykk pb-1.5 text-[0.9375rem] font-bold">
                        {k.tittel}
                      </h4>
                      {k.grupper.map((g) => (
                        <Gruppefelt
                          key={g.id}
                          gruppe={g}
                          overskrift="h5"
                          aapen={aapen}
                          aapnet={aapnet}
                          skrivebord={skrivebord}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {baand.grupper.map((g) => (
              <Gruppefelt
                key={g.id}
                gruppe={g}
                overskrift="h4"
                aapen={aapen}
                aapnet={aapnet}
                skrivebord={skrivebord}
              />
            ))}
          </div>

          <button
            type="button"
            aria-expanded={aapen}
            aria-controls={`${id}-organer`}
            onClick={veksle}
            className={cn(
              "mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 border border-trykk bg-papir px-4 text-[0.875rem] font-semibold md:w-auto",
              "transition-[background-color,transform] duration-150 ease-(--ease-ut) hover:bg-flate active:scale-[0.98]",
              knappSynlig,
            )}
          >
            {aapen ? "Vis færre" : `Vis alle ${antall(baand.antall, "organ", "organer")}`}
            <span className="sr-only"> i {baand.region.toLowerCase()}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-200 ease-(--ease-ut)",
                aapen && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
