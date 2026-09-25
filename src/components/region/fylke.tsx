// Seksjonene på fylkessiden: fylkeskommunens politiske og administrative topp,
// staten i fylket (Statsforvalteren og stortingsbenken), kommunene som en
// kartbladoversikt og de største virksomhetene.
//
// Institusjon først: en person står bare under organet og rollen sin, med
// kildemerke. Et organ uten navngitt leder vises som «Leder ikke kartlagt»,
// ikke som tomrom.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import type { FylkeOrgan, FylkeOversikt, Rolle } from "@/lib/data";
import { antall, kroner, tall } from "@/lib/format";
import { ORGANTYPENAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import { flerspraklig, offisielt } from "./navn";
import { fyllFor, kommuneHref, Skravur } from "./regionkart";
import { DEKNING, type FylkeIRegion, type KommuneIRegion } from "./typer";

function IkkeKartlagt({ children }: { children: string }) {
  return (
    <p className="self-start border border-dashed border-linje-sterk px-2 py-1 text-[0.8125rem] text-dempet">
      {children}
    </p>
  );
}

function Lederlinje({ rolle, organ }: { rolle: Rolle; organ: string }) {
  const parti = rolle.parti ? ` (${rolle.parti})` : "";
  const status = rolle.status === "fast" ? "" : `, ${rolle.status}`;
  return (
    <li className="flex flex-col gap-0.5 border-t border-linje py-2 first:border-t-0 first:pt-0">
      <span className="text-[0.8125rem] text-dempet">
        {rolle.tittel}
        {status}
      </span>
      <span className="font-semibold">
        <Pastand
          tekst={`${rolle.person.navn}${parti}`}
          belegg={rolle.belegg}
          pastand={`${rolle.person.navn} er ${rolle.tittel.toLowerCase()} i ${organ}`}
        />
      </span>
    </li>
  );
}

/** Et organ med navn, type og lederne. Navnet lenker til organsiden. */
export function Organblokk({
  organ,
  ledere = organ.ledere,
  tom = "Leder ikke kartlagt",
  className,
}: {
  organ: FylkeOrgan;
  ledere?: Rolle[];
  tom?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 border border-trykk bg-flate p-4 sm:p-5",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <p className="region text-[0.6875rem] text-dempet">{ORGANTYPENAVN[organ.organtype]}</p>
        <h3 className="text-[1.125rem] leading-[1.2] font-bold tracking-[-0.01em] [font-stretch:105%]">
          <Link
            to="/organ/$key"
            params={{ key: organ.key }}
            className="no-underline hover:underline hover:decoration-signal"
          >
            {organ.navn}
          </Link>
        </h3>
        {organ.beskrivelse && (
          <p className="text-[0.875rem] leading-[1.45] text-dempet text-pretty">
            {organ.beskrivelse}
          </p>
        )}
        {organ.antall_medlemmer !== null && (
          <p className="text-[0.8125rem] text-dempet">
            <MedMerke
              belegg={organ.belegg}
              pastand={`${organ.navn} har ${organ.antall_medlemmer} medlemmer`}
            >
              {antall(organ.antall_medlemmer, "medlem", "medlemmer")}
            </MedMerke>
          </p>
        )}
      </header>
      {ledere.length ? (
        <ul className="flex flex-col">
          {ledere.map((r) => (
            <Lederlinje
              key={`${r.person.key}:${r.rolletype}:${r.fra ?? ""}`}
              rolle={r}
              organ={organ.navn}
            />
          ))}
        </ul>
      ) : (
        <IkkeKartlagt>{tom}</IkkeKartlagt>
      )}
    </article>
  );
}

/** Stortingsbenken: representantene fra valgkretsen, gruppert på parti. */
export function Stortingsbenk({ organ }: { organ: FylkeOrgan }) {
  const reps = organ.representanter.filter((r) => r.rolletype !== "varamedlem");
  return (
    <article className="flex min-w-0 flex-col gap-3 border border-trykk bg-flate p-4 sm:p-5">
      <header className="flex flex-col gap-1">
        <p className="region text-[0.6875rem] text-dempet">{ORGANTYPENAVN[organ.organtype]}</p>
        <h3 className="text-[1.125rem] leading-[1.2] font-bold tracking-[-0.01em] [font-stretch:105%]">
          <Link
            to="/organ/$key"
            params={{ key: organ.key }}
            className="no-underline hover:underline hover:decoration-signal"
          >
            {organ.navn}
          </Link>
        </h3>
        <p className="text-[0.8125rem] text-dempet">
          {antall(reps.length, "representant", "representanter")} i datasettet
        </p>
      </header>
      {reps.length ? (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {reps.map((r) => (
            <Lederlinje key={`${r.person.key}:${r.rolletype}`} rolle={r} organ={organ.navn} />
          ))}
        </ul>
      ) : (
        <IkkeKartlagt>Representantene er ikke kartlagt</IkkeKartlagt>
      )}
    </article>
  );
}

/**
 * Kommunene i fylket som en kartbladoversikt: hvert blad har nummer, offisielt
 * navn, folketall og dekning. Bladet har id `k-<kommunenr>`, så kartet og søket
 * kan lenke hit for en kommune uten datasett.
 */
export function Kommuneindeks({
  kommuner,
  fylke,
}: {
  kommuner: KommuneIRegion[];
  fylke: FylkeIRegion;
}) {
  const id = `ki${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <ol className="grid grid-cols-1 border-t border-l border-trykk sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kommuner.map((k) => {
        const lenke = kommuneHref(k, fylke.slug);
        return (
          <li
            key={k.kommunenr}
            id={`k-${k.kommunenr}`}
            className="flex min-w-0 scroll-mt-[calc(var(--topp)+16px)] flex-col gap-2 border-r border-b border-trykk p-4 target:bg-flate-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.75rem] text-dempet tabular-nums">
                Kartblad {k.kommunenr}
              </span>
              <svg viewBox="0 0 22 14" width="22" height="14" aria-hidden="true">
                <defs>
                  <Skravur id={`${id}-${k.kommunenr}`} tetthet={0.7} />
                </defs>
                <rect
                  x="0.5"
                  y="0.5"
                  width="21"
                  height="13"
                  {...fyllFor(k.klasse, `${id}-${k.kommunenr}`)}
                  className={cn(fyllFor(k.klasse, "").className, "stroke-trykk")}
                />
              </svg>
            </div>
            <h3 className="text-[1.0625rem] leading-[1.2] font-bold text-pretty [font-stretch:105%]">
              {k.datasett ? (
                <Link {...lenke} className="no-underline hover:underline hover:decoration-signal">
                  {offisielt(k.navn_offisielt)}
                </Link>
              ) : (
                offisielt(k.navn_offisielt)
              )}
            </h3>
            {k.samisk_forvaltningsomrade && (
              <p className="text-[0.75rem] text-dempet">Forvaltningsområdet for samisk språk</p>
            )}
            <p className="text-[0.875rem]">
              <MedMerke
                belegg={k.folketall.belegg}
                pastand={`${flerspraklig(k.navn_offisielt, k.navn) ? offisielt(k.navn_offisielt) : k.navn} hadde ${tall(k.folketall.verdi)} innbyggere 1. januar ${k.folketall.aar}`}
              >
                {tall(k.folketall.verdi)} innbyggere
              </MedMerke>
            </p>
            <p className="mt-auto text-[0.8125rem] leading-[1.4] text-dempet">
              <b className="font-semibold text-trykk">{DEKNING[k.klasse].navn}.</b>{" "}
              {k.datasett
                ? `${antall(k.datasett.organer, "organ", "organer")} og ${antall(k.datasett.roller, "rolle", "roller")}.`
                : "Ingen datasett ennå."}
            </p>
            {k.datasett && (
              <Link
                {...lenke}
                className="inline-flex items-center gap-1 self-start text-[0.875rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                aria-label={`Åpne kartbladet for ${k.navn}`}
              >
                Åpne kartbladet
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** De største virksomhetene etter omsetning, med år og morselskap eller konsern. */
export function Storste({
  storste,
  kommuner,
}: {
  storste: FylkeOversikt["storste"];
  kommuner: KommuneIRegion[];
}) {
  if (!storste.length) {
    return <IkkeKartlagt>Ingen virksomheter med omsetningstall i datasettene ennå</IkkeKartlagt>;
  }
  const kommuneAv = new Map(kommuner.map((k) => [k.kommunenr, k]));
  const storst = storste[0]!.omsetning.verdi;
  return (
    <ol className="flex flex-col border-t border-trykk">
      {storste.map((x, i) => {
        const k = kommuneAv.get(x.kommunenr);
        const n = x.omsetning;
        const hva = n.konsern === true ? "konsern" : n.konsern === false ? "morselskap" : null;
        return (
          <li
            key={x.org.key}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-linje py-3 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,16rem)]"
          >
            <span className="text-[0.875rem] text-dempet tabular-nums">{i + 1}.</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link
                to="/organ/$key"
                params={{ key: x.org.key }}
                className="font-semibold text-pretty no-underline hover:underline hover:decoration-signal"
              >
                {x.org.navn}
              </Link>
              <span className="text-[0.8125rem] text-dempet">
                {ORGANTYPENAVN[x.org.organtype]}
                {k ? `, ${k.navn}` : ""}
              </span>
            </div>
            <div className="col-start-2 flex min-w-0 flex-col gap-1 md:col-start-3">
              <span className="text-[0.9375rem] font-semibold">
                <MedMerke
                  belegg={n.belegg}
                  pastand={`${x.org.navn} hadde ${kroner(n.verdi)} i omsetning i ${n.aar}${hva ? ` (${hva})` : ""}`}
                >
                  {kroner(n.verdi)}
                </MedMerke>{" "}
                <span className="text-[0.8125rem] font-normal text-dempet">
                  omsetning {n.aar}
                  {hva ? `, ${hva}` : ""}
                </span>
              </span>
              <span className="block h-1.5 bg-vann-lys" aria-hidden="true">
                <span
                  className="block h-full bg-vann"
                  style={{ width: `${Math.max(1, (100 * n.verdi) / storst)}%` }}
                />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
