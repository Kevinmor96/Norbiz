// Smakebiten på forsiden: kartbladet til en kartlagt kommune, med tre tall i
// randen slik kommunesiden har dem. Kartbladet er den samme komponenten som
// på kommunesiden (Kartblad), med det ekte terrenget.
//
// Tallene har hver sin farge etter jobben: kommunestyret i trykk (et organ),
// utbyttet i vann (penger) og kjeden i signal (beslutningskjeden).

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Kartblad } from "@/components/maktkart/kartblad";
import { MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import { millioner, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Forsidedata } from "./last";

type Utvalgt = NonNullable<Forsidedata["utvalgt"]>;

function Modul({ tall: verdi, etikett, className }: { tall: ReactNode; etikett: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 border-t border-trykk pt-3", className)}>
      <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">{verdi}</p>
      <p className="etikett text-[0.875rem] text-pretty">{etikett}</p>
    </div>
  );
}

const Stort = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "text-[clamp(2rem,1.6rem+1.2vw,2.5rem)] font-[760] tracking-[-0.02em] [font-stretch:108%]",
      className,
    )}
  >
    {children}
  </span>
);

function Hull({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-trykk pt-3">
      <p className="self-start border border-dashed border-kote px-2 py-1 text-[0.8125rem] text-kote-tekst">
        {children}
      </p>
    </div>
  );
}

function Rand({ u }: { u: Utvalgt }) {
  const { seter, utbytte, kjede } = u;
  return (
    <div className="grid grid-cols-2 content-start gap-x-5 gap-y-6 md:grid-cols-1 md:gap-y-5 lg:grid-cols-2 xl:grid-cols-1">
      {seter ? (
        <Modul
          tall={
            <MedMerke belegg={seter.belegg} pastand={`${seter.organ} har ${seter.antall} medlemmer`}>
              <Stort>{tall(seter.antall)}</Stort>
            </MedMerke>
          }
          etikett={`medlemmer i ${(seter.kortnavn ?? seter.organ).toLowerCase()}`}
        />
      ) : (
        <Hull>Kommunestyret er ikke kartlagt</Hull>
      )}
      {utbytte ? (
        <Modul
          tall={
            <>
              <Stort className="text-vann">{millioner(utbytte.belop)}</Stort>
              <span className="text-[0.9375rem] font-semibold">
                <Pastand
                  tekst={`av ${millioner(utbytte.total)} mill. kr${utbytte.forslag ? ", foreslått" : ""}`}
                  belegg={utbytte.belegg}
                  pastand={`${utbytte.forslag ? "Foreslått utbytte" : "Utbytte"} fra ${utbytte.selskap} til kommunen: ${millioner(utbytte.belop)} av ${millioner(utbytte.total)} mill. kr`}
                />
              </span>
            </>
          }
          etikett={`utbytte fra ${utbytte.kortnavn ?? utbytte.selskap} til kommunen${utbytte.aar ? ` for ${utbytte.aar}` : ""}`}
        />
      ) : (
        <Hull>Ingen utbytte i datasettet</Hull>
      )}
      {kjede && (
        <Modul
          className="col-span-2 md:col-span-1 lg:col-span-2 xl:col-span-1"
          tall={
            <MedMerke
              belegg={kjede.belegg}
              pastand={`${kjede.utenLeder} av ${kjede.steg} steg i kjeden «${kjede.tittel}» har ingen navngitt leder i datasettet`}
            >
              <Stort className="text-signal-tekst">
                {tall(kjede.utenLeder)} av {tall(kjede.steg)}
              </Stort>
            </MedMerke>
          }
          etikett={`steg i kjeden «${kjede.tittel.toLowerCase()}» har ingen navngitt leder i datasettet`}
        />
      )}
    </div>
  );
}

export function Smakebit({ utvalgt }: { utvalgt: Utvalgt }) {
  const { kommune } = utvalgt;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Kartblad
        kommune={{ navn: kommune.navn, kommunenr: kommune.kommunenr, fylke: kommune.fylke }}
        orgnr={utvalgt.orgnr}
        terreng={utvalgt.terreng}
        rand={<Rand u={utvalgt} />}
      />
      <Link
        to="/kommune/$slug"
        params={{ slug: kommune.slug }}
        className={cn(
          "inline-flex h-12 items-center gap-2.5 self-start border border-trykk bg-trykk px-5 text-[0.9375rem] font-semibold text-paa-trykk no-underline",
          "transition-[transform,background-color] duration-150 ease-(--ease-ut) hover:bg-dempet active:scale-[0.97]",
        )}
      >
        Se hvem som bestemmer i {kommune.navn}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
