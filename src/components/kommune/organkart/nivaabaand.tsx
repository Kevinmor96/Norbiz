// Ett nivåbånd i organkartet (DESIGN.md §5.3): regionnavnet i sperret
// versal, paraplyen (kommunen eller fylkeskommunen selv) og organene, i
// kolonner og grupper.
//
// Båndet må tåle hundrevis av organer (alle selskaper med minst 20 ansatte,
// styrene deres og statsetatene). Derfor:
//
// - Sammenfoldet viser det de viktigste organene: tre på mobil (DESIGN.md),
//   åtte på skrivebord. Regelen for «viktigst» står i baand.ts.
// - «Vis flere» legger til 24 om gangen, så et bånd med 300 organer aldri
//   tegner alle på én gang. Organer utenfor det som vises, står ikke i DOM-en.
// - Store bånd har et eget søk i organene: navn, type, myndighet og lederne.
//
// Tre-på-mobil og åtte-på-skrivebord er samme HTML fra serveren: kort 4 til 8
// skjules med CSS under 768 px. Da ser siden lik ut før og etter hydrering.
// Knappen er en egen knapp med aria-expanded, ikke Radix Collapsible, fordi
// de viktigste organene skal stå synlige også når båndet er sammenfoldet.
//
// Når båndet er bredt nok, står regionnavnet i en egen marg til venstre, som
// randopplysningene på et kartblad. Bredden måles på båndet selv (container
// query), fordi innholdsspalten er smalere når sidemargen er der.

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Pastand } from "@/components/maktkart/kildemerke";
import { useOrganSkuff } from "@/components/organ/organ-skuff";
import { normaliser } from "@/components/organ/tekst";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { antall, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  FORHAND_MOBIL,
  FORHAND_SKRIVEBORD,
  SOK_FRA,
  STEG,
  sokestreng,
  type Baand,
  type Gruppe,
  type Plassert,
} from "./baand";
import { Organkort } from "./organkort";

const RUTENETT = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] gap-2";

/** Hva som tegnes: nøkkel → klassene kortet får. Kort som ikke er her, står ikke i DOM-en. */
type Vises = Map<string, string>;

/** Overskriften skjules på mobil når alle kortene under den er skjult der. */
function overskriftKlasse(organer: readonly Plassert[], vises: Vises): string {
  const klasser = organer.filter((o) => vises.has(o.kort.key)).map((o) => vises.get(o.kort.key));
  return klasser.length > 0 && klasser.every((k) => k?.includes("max-md:hidden"))
    ? "max-md:hidden"
    : "";
}

function Gruppefelt({
  gruppe,
  overskrift: H,
  vises,
}: {
  gruppe: Gruppe;
  overskrift: "h4" | "h5";
  vises: Vises;
}) {
  const organer = gruppe.organer.filter((o) => vises.has(o.kort.key));
  if (!organer.length) return null;
  return (
    <div className={cn("flex flex-col gap-2.5", overskriftKlasse(organer, vises))}>
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
        {organer.map((p) => (
          <Organkort key={p.kort.key} plassert={p} synlighet={vises.get(p.kort.key)} />
        ))}
      </ul>
    </div>
  );
}

export function Nivaabaand({ baand }: { baand: Baand }) {
  // Hvor mange organer som tegnes, i viktighetsrekkefølgen.
  const [vist, settVist] = useState(FORHAND_SKRIVEBORD);
  const [sok, settSok] = useState("");
  // Nye kort tones inn når leseren ber om flere, ikke ved første maling.
  const [vokst, settVokst] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  const redusert = useReducedMotion();
  const { aapen: aapentOrgan } = useOrganSkuff();

  const alle = useMemo(
    () =>
      [...baand.kolonner.flatMap((k) => k.grupper), ...baand.grupper]
        .flatMap((g) => g.organer)
        .sort((a, b) => a.rang - b.rang),
    [baand],
  );
  const indeks = useMemo(() => new Map(alle.map((p) => [p.kort.key, sokestreng(p)])), [alle]);

  const q = normaliser(sok.trim());
  const sokAktiv = q.length > 0;
  const rekke = sokAktiv ? alle.filter((p) => indeks.get(p.kort.key)?.includes(q)) : alle;
  const utvidet = sokAktiv || vist > FORHAND_SKRIVEBORD;
  const vises: Vises = new Map(
    rekke.slice(0, vist).map((p, i) => [
      p.kort.key,
      cn(
        !utvidet && i >= FORHAND_MOBIL && "max-md:hidden",
        vokst && i >= FORHAND_SKRIVEBORD && "animate-in fade-in-0 duration-200",
      ),
    ]),
  );

  // Åpnes et organ i skuffen (fra en lenke eller adressen) som ikke vises her,
  // tegnes båndet så langt at kortet står bak skuffen når den lukkes.
  useEffect(() => {
    if (!aapentOrgan || sokAktiv) return;
    const p = alle.find((o) => o.kort.key === aapentOrgan);
    if (!p || p.rang < FORHAND_MOBIL || (utvidet && p.rang < vist)) return;
    const trinn = Math.max(1, Math.ceil((p.rang + 1 - FORHAND_SKRIVEBORD) / STEG));
    settVist((v) => Math.max(v, FORHAND_SKRIVEBORD + trinn * STEG));
  }, [aapentOrgan, alle, sokAktiv, utvidet, vist]);

  const totalt = rekke.length;
  const nesteVist = (utvidet ? vist : FORHAND_SKRIVEBORD) + STEG;
  const restSkrivebord = Math.max(0, totalt - vist);
  const restMobil = utvidet ? restSkrivebord : Math.max(0, totalt - FORHAND_MOBIL);
  const flereSynlig = cn(restMobil === 0 && "max-md:hidden", restSkrivebord === 0 && "md:hidden");
  const faerreSynlig = utvidet && !sokAktiv && vist >= totalt;

  const flere = () => {
    settVist(nesteVist);
    settVokst(true);
  };
  const faerre = () => {
    settVist(FORHAND_SKRIVEBORD);
    settVokst(false);
    // Når et langt bånd foldes sammen, flyttes knappen langt opp. Leseren
    // skal ikke miste plassen sin, så båndets topp rulles inn om den er borte.
    if (ref.current && ref.current.getBoundingClientRect().top < 0) {
      ref.current.scrollIntoView({ block: "start", behavior: redusert ? "auto" : "smooth" });
    }
  };

  const regionLiten = baand.region.toLowerCase();

  return (
    <section
      ref={ref}
      aria-labelledby={`${id}-tittel`}
      className="@container scroll-mt-[calc(var(--topp)+16px)] px-4 pt-5 pb-6 md:px-6 md:pt-6 md:pb-7"
    >
      <div className="grid gap-x-8 gap-y-4 @min-[50rem]:grid-cols-[11.5rem_minmax(0,1fr)]">
        <header className="flex min-w-0 flex-col gap-1.5 @min-[50rem]:gap-2.5">
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
          {baand.antall >= SOK_FRA && (
            <div className="mt-1 flex flex-col gap-1">
              <label htmlFor={`${id}-sok`} className="text-[0.8125rem] font-semibold">
                Søk i {regionLiten}
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-dempet"
                />
                <input
                  id={`${id}-sok`}
                  type="search"
                  value={sok}
                  onChange={(e) => {
                    settSok(e.target.value);
                    settVist(STEG);
                    settVokst(false);
                  }}
                  placeholder="Organ, leder eller myndighet"
                  autoComplete="off"
                  aria-controls={`${id}-organer`}
                  className="h-10 w-full min-w-0 border border-trykk bg-papir pr-9 pl-8 text-[0.875rem] placeholder:text-dempet [&::-webkit-search-cancel-button]:hidden"
                />
                {sok && (
                  <button
                    type="button"
                    onClick={() => {
                      settSok("");
                      settVist(FORHAND_SKRIVEBORD);
                    }}
                    aria-label={`Tøm søket i ${regionLiten}`}
                    className="absolute top-1/2 right-1 inline-grid size-8 -translate-y-1/2 cursor-pointer place-items-center text-dempet hover:text-trykk"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            </div>
          )}
          <p aria-live="polite" className="text-[0.8125rem] text-dempet empty:hidden">
            {sokAktiv
              ? `${antall(totalt, "treff", "treff")} for «${sok.trim()}»`
              : utvidet
                ? `Viser ${tall(Math.min(vist, totalt))} av ${tall(totalt)}`
                : ""}
          </p>
        </header>

        <div className="@container min-w-0">
          {baand.paraply && <Organkort plassert={baand.paraply} stor className="mb-5" />}

          <div id={`${id}-organer`} className="flex flex-col gap-6">
            {sokAktiv && totalt === 0 && (
              <p className="border border-dashed border-linje-sterk bg-flate px-4 py-3 text-[0.9375rem]">
                Ingen organer i {regionLiten} passer til «{sok.trim()}».
              </p>
            )}
            {baand.kolonner.some((k) => k.grupper.some((g) => g.organer.some((o) => vises.has(o.kort.key)))) && (
              <div className="grid gap-x-5 gap-y-6 @min-[38rem]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {baand.kolonner.map((k) => {
                  const organer = k.grupper.flatMap((g) => g.organer);
                  if (!organer.some((o) => vises.has(o.kort.key))) return null;
                  return (
                    <div
                      key={k.id}
                      className={cn("flex min-w-0 flex-col gap-3", overskriftKlasse(organer, vises))}
                    >
                      <h4 className="border-b border-trykk pb-1.5 text-[0.9375rem] font-bold">
                        {k.tittel}
                      </h4>
                      {k.grupper.map((g) => (
                        <Gruppefelt key={g.id} gruppe={g} overskrift="h5" vises={vises} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {baand.grupper.map((g) => (
              <Gruppefelt key={g.id} gruppe={g} overskrift="h4" vises={vises} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
            {(restMobil > 0 || restSkrivebord > 0) && (
              <button
                type="button"
                aria-expanded={utvidet}
                aria-controls={`${id}-organer`}
                onClick={flere}
                className={cn(KNAPP, "border-trykk", flereSynlig)}
              >
                {nesteVist >= totalt
                  ? `Vis alle ${antall(totalt, "organ", "organer")}`
                  : utvidet
                    ? `Vis ${tall(STEG)} til`
                    : "Vis flere"}
                <span className="sr-only"> i {regionLiten}</span>
                {nesteVist < totalt && (
                  <span className="font-normal text-dempet tabular-nums">
                    {utvidet ? (
                      `${tall(restSkrivebord)} igjen`
                    ) : (
                      <>
                        <span className="md:hidden">{tall(restMobil)} til</span>
                        <span className="max-md:hidden">{tall(restSkrivebord)} til</span>
                      </>
                    )}
                  </span>
                )}
                <ChevronDown aria-hidden="true" className="size-4" />
              </button>
            )}
            {faerreSynlig && (
              <button type="button" onClick={faerre} className={cn(KNAPP, "border-linje-sterk")}>
                Vis færre
                <span className="sr-only"> i {regionLiten}</span>
                <ChevronDown aria-hidden="true" className="size-4 rotate-180" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const KNAPP = cn(
  "inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 border bg-papir px-4 text-[0.875rem] font-semibold md:flex-none",
  "transition-[background-color,transform] duration-150 ease-(--ease-ut) hover:bg-flate active:scale-[0.98]",
);
