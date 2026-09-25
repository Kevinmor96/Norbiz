// «Slik ser en tom kommune ut» (DESIGN.md §5.8). Neste kommune har færre data
// enn den første, og malen skal si det i stedet for å se ødelagt ut. Denne
// forhåndsvisningen viser det i det små: kartbladet i reservevarianten
// (ramme og rutenett, ikke noe falskt terreng) og grunnlagets struktur for en
// kommune, der hver del står som «ikke kartlagt».
//
// Velges en kommune i oversikten, tar forhåndsvisningen navnet og nummeret
// dens. Det er den samme malen, bare uten data.

import { Kildemerke } from "@/components/maktkart/kildemerke";
import { antall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { KOMMUNEMAL, KOMMUNEMAL_BELEGG } from "./valgkretser";

/** Kartbladet i miniatyr, slik reservevarianten tegnes når terrengfila mangler. */
function MiniKartblad({ navn, kommunenr }: { navn: string | null; kommunenr: string | null }) {
  const linjer = [1, 2, 3, 4, 5];
  return (
    <div className="relative aspect-[16/7] overflow-hidden border border-trykk bg-papir">
      <svg
        viewBox="0 0 600 262"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-[5px] block h-[calc(100%-10px)] w-[calc(100%-10px)] stroke-linje"
      >
        {linjer.map((i) => (
          <line
            key={`v${i}`}
            x1={i * 100}
            y1="0"
            x2={i * 100}
            y2="262"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[1, 2].map((i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 87}
            x2="600"
            y2={i * 87}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* Kortere streker i den graderte kanten: rammen er liten, og 28 px leses som klosser her. */}
      {(["t", "b", "v", "h"] as const).map((k) => (
        <i
          key={k}
          className={`gradert gradert-${k}`}
          style={{ "--strek": "12px" } as React.CSSProperties}
          aria-hidden="true"
        />
      ))}
      <span
        className="pointer-events-none absolute inset-[5px] border border-trykk"
        aria-hidden="true"
      />
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <span className="flex flex-col items-center gap-1">
          <span className="region text-[clamp(0.9375rem,0.85rem+0.5vw,1.25rem)] tracking-[0.28em] text-dempet [font-stretch:118%]">
            {navn ?? "Kommunenavn"}
          </span>
          <span className="text-[0.75rem] text-dempet">
            {kommunenr ? `Kartblad ${kommunenr}` : "Ingen terrengfil ennå"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function TomKommune({
  valgt,
  sammenligning,
}: {
  /** Kommunen som er valgt i oversikten, eller `null` for den generelle forhåndsvisningen. */
  valgt: { navn: string; kommunenr: string } | null;
  /**
   * En kartlagt kommune å sammenligne med: hva datasettet der har. Utelates
   * når ingen kommune er kartlagt ennå.
   */
  sammenligning?: {
    navn: string;
    organer: number;
    roller: number;
    hull: number;
  } | null;
}) {
  return (
    <div className="flex flex-col gap-4 border border-dashed border-kote bg-papir p-4 sm:p-5">
      <div className="flex flex-col gap-1.5">
        <h3 aria-live="polite" className="text-[1.0625rem] leading-[1.25] font-bold text-balance">
          {valgt ? `Slik ser ${valgt.navn} ut før den er kartlagt` : "Slik ser en tom kommune ut"}
        </h3>
        <p className="text-[0.875rem] leading-[1.45] text-dempet text-pretty">
          Hver kommune får den samme siden. Det som ikke er kartlagt, står som en tom rute med
          beskjed om hva som mangler.
        </p>
      </div>

      <MiniKartblad navn={valgt?.navn ?? null} kommunenr={valgt?.kommunenr ?? null} />

      <div className="flex flex-col gap-2">
        <p className="text-[0.8125rem] font-semibold">
          <span className="whitespace-nowrap">
            Grunnlagets mal for en kommune
            <Kildemerke
              belegg={KOMMUNEMAL_BELEGG}
              pastand="Den generiske strukturen i en norsk kommune, slik researchgrunnlaget beskriver den."
            />
          </span>
        </p>
        <ul className="flex flex-col">
          {KOMMUNEMAL.map((del) => (
            <li
              key={del.navn}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-linje py-1.5 text-[0.875rem]"
            >
              <span>{del.navn}</span>
              <span
                className={cn(
                  "border border-dashed border-kote px-1.5 py-px text-[0.75rem] whitespace-nowrap text-kote-tekst",
                )}
              >
                {del.hva === "leder" ? "Leder ikke kartlagt" : "Ikke kartlagt"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {sammenligning && (
        <p className="border-t border-linje pt-3 text-[0.8125rem] leading-[1.45] text-dempet text-pretty">
          Til sammenligning har datasettet for {sammenligning.navn}{" "}
          {antall(sammenligning.organer, "organ", "organer")},{" "}
          {antall(sammenligning.roller, "rolle", "roller")} og{" "}
          {antall(sammenligning.hull, "kjent hull", "kjente hull")}. Hullene står også på siden.
        </p>
      )}
    </div>
  );
}
