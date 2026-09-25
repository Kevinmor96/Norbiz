// Kartbladet: kommunen som et topografisk kart (DESIGN.md §5.1).
//
// Terrenget er et byggesteg (`npm run terreng`). Stiene står i en egen
// SVG-fil per kommune og tegnes her med <use href> (src/lib/terreng.ts), så de
// ikke står i HTML-en og i sidens tilstand. Kartet tegnes likevel på serveren og
// trenger ingen JavaScript for å vises. Farge og strek settes av klassene på
// <use> og arves inn i stiene. Kotene trykkes ved
// lasting med en ren CSS-animasjon: kystlinjen først, så nivå for nivå oppover,
// ferdig på 1,1 s. Med redusert bevegelse står kartet ferdig fra start.
//
// Mangler terrengfil, tegnes reservevarianten: kartramme, rutenett og
// kommunenavn. Ikke noe falskt terreng.
//
// Tallene står ikke på terrenget. De står i randen langs kartet (`rand`), som
// randopplysningene på et kartblad. Terreng under data leses som data.

import type { CSSProperties, ReactNode } from "react";

import { orgnr as formaterOrgnr } from "@/lib/format";
import { koteId, type Terreng } from "@/lib/terreng";
import { cn } from "@/lib/utils";

/** Hele trykket skal være ferdig innen denne tiden (DESIGN.md §7). */
const TRYKK_MS = 1100;
const KYST_MS = 480;
const KOTE_MS = 380;
const KOTE_START_MS = 220;

type Strekstil = CSSProperties & Record<`--${string}`, string | number>;

function Terrengflate({ terreng }: { terreng: Terreng }) {
  const n = terreng.koter.length;
  const steg = n > 1 ? Math.floor((TRYKK_MS - KOTE_MS - KOTE_START_MS) / (n - 1)) : 0;
  return (
    <svg
      viewBox={`0 0 ${terreng.bredde} ${terreng.hoyde}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className="kartblad-terreng absolute inset-[5px] block h-[calc(100%-10px)] w-[calc(100%-10px)]"
    >
      <use href={`${terreng.fil}#hav`} className="fill-vann-lys" />
      {terreng.koter.map((k, i) => (
        <use
          key={k.hoyde}
          href={`${terreng.fil}#${koteId(k.hoyde)}`}
          className="kartblad-kote kartblad-strek"
          data-tellekurve={k.tellekurve ? "" : undefined}
          style={
            {
              "--lengde": k.lengde,
              "--forsinkelse": `${KOTE_START_MS + i * steg}ms`,
              "--varighet": `${KOTE_MS}ms`,
            } as Strekstil
          }
        />
      ))}
      <use
        href={`${terreng.fil}#kyst`}
        className="kartblad-kyst kartblad-strek"
        style={{ "--lengde": terreng.kyst.lengde, "--varighet": `${KYST_MS}ms` } as Strekstil}
      />
    </svg>
  );
}

/** Uten terreng: rutenett i rammen og kommunenavnet satt som på et kartblad. */
function Reserveflate({ navn }: { navn: string }) {
  const linjer = [1, 2, 3, 4, 5, 6, 7];
  return (
    <>
      <svg
        viewBox="0 0 800 800"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-[5px] block h-[calc(100%-10px)] w-[calc(100%-10px)] stroke-linje"
      >
        {linjer.map((i) => (
          <g key={i}>
            <line x1={i * 100} y1="0" x2={i * 100} y2="800" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1={i * 100} x2="800" y2={i * 100} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center p-10">
        <span className="region text-center text-[clamp(1.25rem,1rem+1.6vw,2.25rem)] tracking-[0.3em] break-words text-dempet [font-stretch:118%]">
          {navn}
        </span>
      </div>
    </>
  );
}

function Nordpil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 40" width="22" height="34" aria-hidden="true" className={className}>
      <path d="M13 2 20 24 13 19 6 24Z" className="fill-trykk" />
      <path d="M13 2v17l-7 5Z" className="fill-papir stroke-trykk" strokeWidth="1" />
      <text
        x="13"
        y="37.5"
        textAnchor="middle"
        className="fill-trykk utsparing-svg"
        style={{ font: "700 11px var(--font-archivo)" }}
      >
        N
      </text>
    </svg>
  );
}

export interface KartbladProps {
  kommune: { navn: string; kommunenr: string; fylke: string };
  /** Kommunens organisasjonsnummer, eller `null` når det ikke er kjent. */
  orgnr: string | null;
  /** Fra `hentTerreng` (src/lib/terreng.ts), eller `null` for reservevarianten. */
  terreng: Terreng | null;
  /** Randopplysningene: nøkkeltallene i en kolonne langs kartet. */
  rand?: ReactNode;
  className?: string;
}

export function Kartblad({ kommune, orgnr, terreng, rand, className }: KartbladProps) {
  return (
    <figure className={cn("m-0 flex min-w-0 flex-col gap-3", className)}>
      <div
        className={cn(
          "grid gap-x-6 gap-y-6",
          // Randen står ved siden av kartet når det er plass, og under når kartbladet
          // deler bredden med teksten (1 024–1 279 px) eller skjermen er smal.
          rand &&
            "md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]",
        )}
      >
        <div
          className={cn(
            "relative min-h-[260px] overflow-hidden border border-trykk bg-papir",
            "aspect-[5/4] md:aspect-auto md:min-h-[440px] lg:aspect-[5/4] lg:min-h-0 xl:aspect-auto xl:min-h-[440px]",
          )}
        >
          {terreng ? <Terrengflate terreng={terreng} /> : <Reserveflate navn={kommune.navn} />}
          <i className="gradert gradert-t" aria-hidden="true" />
          <i className="gradert gradert-b" aria-hidden="true" />
          <i className="gradert gradert-v" aria-hidden="true" />
          <i className="gradert gradert-h" aria-hidden="true" />
          <span
            className="pointer-events-none absolute inset-[5px] border border-trykk"
            aria-hidden="true"
          />
          {terreng && (
            <p className="utsparing absolute top-4 left-5 flex max-w-[60%] flex-col gap-0.5 md:top-5 md:left-6">
              <b className="region text-[0.8125rem] tracking-[0.3em] [font-stretch:125%]">
                {kommune.navn}
              </b>
              <span className="text-[0.75rem] text-dempet">Kartblad {kommune.kommunenr}</span>
            </p>
          )}
          <Nordpil className="absolute top-4 right-5 md:top-5 md:right-6" />
        </div>
        {rand}
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-dempet">
          <b className="font-semibold text-trykk">Kommunenr. {kommune.kommunenr}</b>
          {orgnr && <span>Org.nr. {formaterOrgnr(orgnr)}</span>}
          <span>{kommune.fylke} fylke</span>
        </span>
        <span className="text-[0.75rem] leading-[1.4] text-dempet">
          {terreng
            ? terreng.attribusjon
            : "Kartbladet har ikke terreng ennå. Rammen og rutenettet står der kotene skal stå."}
        </span>
      </figcaption>
    </figure>
  );
}
