// Små byggeklosser Pengene og Nettverket deler: stilen på organnavnene, et
// nøkkeltall med år og eget kildemerke, og brikken for det som ikke er kartlagt.

import type { ReactNode } from "react";

import { MedMerke } from "@/components/maktkart/kildemerke";
import type { NokkeltallUt, OrganRef } from "@/lib/data";
import { NOKKELTALLNAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import { aarOgOmfang, verdiTekst } from "./tekst";

/**
 * Utseendet til et organnavn i Pengene og Nettverket. Selve lenken er den
 * felles `OrganLenke` fra organskuffen, så navnet åpner skuffen på
 * kommunesiden og organsiden ellers.
 */
export const LENKESTIL =
  "underline decoration-linje-sterk decoration-1 underline-offset-[0.2em] transition-colors duration-150 hover:decoration-signal";

/**
 * Et nøkkeltall: navn, verdi med eget kildemerke, og år med morselskap eller
 * konsern. Et tall uten år finnes ikke i datakontrakten, så året er alltid med.
 */
export function Nokkeltall({ t, organ }: { t: NokkeltallUt; organ: OrganRef }) {
  const navn = NOKKELTALLNAVN[t.type];
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <dt className="text-dempet">{navn}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-1.5">
        <MedMerke
          belegg={t.belegg}
          pastand={`${navn} i ${organ.navn}: ${verdiTekst(t)} (${aarOgOmfang(t)})`}
          className="font-semibold text-trykk"
        >
          {verdiTekst(t)}
        </MedMerke>
        <span className="text-dempet">{aarOgOmfang(t)}</span>
      </dd>
    </div>
  );
}

/** Det som ikke er kartlagt: en stiplet brikke i kote (DESIGN.md §3). */
export function IkkeKartlagt({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-dashed border-kote px-1.5 py-0.5 text-[0.8125rem] leading-tight text-kote-tekst",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Overskriften for en blokk inne i en seksjon. */
export function Blokktittel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="seksjon text-[1.25rem] leading-[1.15]">
      {children}
    </h3>
  );
}
