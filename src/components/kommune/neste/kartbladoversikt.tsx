// Kartbladoversikten (DESIGN.md §5.8): valgkretsen som et rutenett av kartblad,
// slik kartverk viser hvilke blad som finnes. Kommunene med datasett er fylte
// ruter og lenker til kommunesiden. De andre er åpne ruter med navn, og et
// trykk velger kommunen i stemmeskjemaet.
//
// Rutene står alfabetisk. Vi har ikke kommunegrensene, og et rutenett som lot
// som det var geografi, ville vært pynt som ser ut som data. Derfor står det
// under oversikten at plasseringen ikke betyr noe.

import { Kildemerke, MedMerke } from "@/components/maktkart/kildemerke";
import { antall, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { KjentKommune, Valgkrets } from "./valgkretser";

export interface Rute extends KjentKommune {
  /** Antall organer i datasettet, for kartlagte kommuner. */
  organer: number | null;
}

export function Kartbladoversikt({
  tittel,
  valgkrets,
  ruter,
  gjeldendeSlug,
  valgt,
  onVelg,
}: {
  tittel: string;
  valgkrets: Valgkrets | null;
  /** Sortert slik de skal stå. */
  ruter: Rute[];
  /** Kommunen siden handler om. Ruta dens peker hit. */
  gjeldendeSlug?: string | undefined;
  valgt: string | null;
  onVelg: (kommunenr: string) => void;
}) {
  const kartlagte = ruter.filter((r) => r.slug).length;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[1.0625rem] font-bold">{tittel}</h3>
      <ul
        aria-label={`${tittel}. ${antall(kartlagte, "kommune er kartlagt", "kommuner er kartlagt")}, ${antall(ruter.length - kartlagte, "er det ikke", "er det ikke")}.`}
        className={cn(
          "grid border-t border-l border-trykk",
          "grid-cols-3 min-[440px]:grid-cols-4 md:grid-cols-7",
        )}
      >
        {ruter.map((r) => (
          <li key={r.kommunenr} className="min-w-0 border-r border-b border-trykk">
            {r.slug ? (
              <a
                href={r.slug === gjeldendeSlug ? "#topp" : `/kommune/${r.slug}`}
                aria-current={r.slug === gjeldendeSlug ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-[76px] flex-col justify-between gap-2 bg-trykk p-2 text-paa-trykk no-underline",
                  "transition-opacity duration-150 hover:opacity-90",
                )}
              >
                <span className="flex items-start justify-between gap-1 text-[0.6875rem] leading-[1.2]">
                  <span className="tabular-nums opacity-80">{r.kommunenr}</span>
                  <span className="font-semibold">Kartlagt</span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <RuteNavn navn={r.navn} />
                  {r.organer !== null && (
                    <span className="text-[0.6875rem] leading-[1.2] opacity-80">
                      {antall(r.organer, "organ", "organer")}
                    </span>
                  )}
                </span>
              </a>
            ) : (
              <button
                type="button"
                aria-pressed={valgt === r.kommunenr}
                onClick={() => onVelg(r.kommunenr)}
                className={cn(
                  "flex h-full min-h-[76px] w-full cursor-pointer flex-col justify-between gap-2 bg-papir p-2 text-left",
                  "transition-[background-color,box-shadow] duration-150 ease-(--ease-ut) hover:bg-flate-2",
                  "aria-pressed:bg-flate aria-pressed:shadow-[inset_0_0_0_2px_var(--trykk)]",
                  "focus-visible:-outline-offset-4",
                )}
              >
                <span className="flex items-start justify-between gap-1 text-[0.6875rem] leading-[1.2] text-dempet">
                  <span className="tabular-nums">{r.kommunenr}</span>
                  {valgt === r.kommunenr && <span className="font-semibold text-trykk">Valgt</span>}
                </span>
                <span>
                  <RuteNavn navn={r.navn} />
                  <span className="sr-only">, ikke kartlagt</span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5 text-[0.8125rem] leading-[1.45] text-dempet">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 border border-trykk bg-trykk" aria-hidden="true" />
            Kartlagt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 border border-trykk bg-papir" aria-hidden="true" />
            Ikke kartlagt. Velg ruta for å stemme.
          </span>
        </p>
        {valgkrets ? (
          <p className="max-w-[62ch] text-pretty">
            <MedMerke
              belegg={valgkrets.belegg}
              pastand={`${valgkrets.navn} består av ${tall(valgkrets.kommuner.length)} kommuner.`}
            >
              {valgkrets.navn} har {tall(valgkrets.kommuner.length)} kommuner
            </MedMerke>
            . Rutene står alfabetisk, så plasseringen sier ingenting om hvor kommunen ligger. Tallet i ruta er{" "}
            <span className="whitespace-nowrap">
              kommunenummeret
              <Kildemerke
                belegg={valgkrets.nummerbelegg}
                pastand={`Kommunenumrene i ${valgkrets.navn}.`}
              />
            </span>
            .
          </p>
        ) : (
          <p className="max-w-[62ch] text-pretty">
            Grunnlaget lister ikke de andre kommunene i fylket ennå. Oversikten viser bare kommunene
            som er kartlagt.
          </p>
        )}
      </div>
    </div>
  );
}

/** Navnet i ruta. Lange navn brytes ved bindestreken, aldri midt i et ord. */
function RuteNavn({ navn }: { navn: string }) {
  return (
    <span className="etikett text-[0.8125rem] hyphens-manual">
      {navn.split("-").map((del, i, alle) => (
        <span key={i}>
          {del}
          {i < alle.length - 1 && (
            <>
              -<wbr />
            </>
          )}
        </span>
      ))}
    </span>
  );
}
