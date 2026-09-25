// Bransjematrisen (DESIGN.md §5.7): radene er organer, kolonnene er
// myndighet. Bare koblingene i `org_segment` vises, gruppert på styrke:
// primær, sekundær og indirekte, med strektykkelsen fra tegnforklaringen.
//
// Matrisen er en ekte tabell, så den er også tabellvisningen for skjermlesere.
// Når seksjonen er smal (mobil, og nettbrett uten plass til kolonnene), blir
// den en liste med myndigheten som etiketter. Bredden måles på seksjonen selv
// (container query), fordi innholdsspalten er smalere når sidemargen er der.
//
// Hver rad åpner organskuffen.

import type { MouseEvent } from "react";

import { Pastand } from "@/components/maktkart/kildemerke";
import { IkkeKartlagt, MyndighetListe, STYRKE, Styrkestrek } from "@/components/organ/merker";
import { OrganLenke } from "@/components/organ/organ-skuff";
import { nivaalinje } from "@/components/organ/organ-profil";
import { MYNDIGHETSLAG } from "@/components/organ/tekst";
import type { Myndighet, OrganKort, SegmentOrganer } from "@/lib/data";
import { antall } from "@/lib/format";
import { MYNDIGHETNAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

type Rad = SegmentOrganer["organer"][number];

/** Kolonneoverskrifter med myk bindestrek, så kolonnene kan være smale. */
const KORT: Partial<Record<Myndighet, string>> = {
  planmyndighet: "Plan­myndighet",
  innstilling: "Innstil­ling",
  finansiering: "Finan­siering",
  konsesjon: "Konse­sjon",
  raadgivning: "Råd­givning",
  regelverk: "Regel­verk",
};

const STYRKER = [3, 2, 1] as const;

/** Myndighetene som finnes blant organene, i lagene fra MYNDIGHETSLAG. Tomme lag utelates. */
function kolonner(rader: readonly Rad[]) {
  const finnes = new Set(rader.flatMap((r) => r.myndighet));
  return MYNDIGHETSLAG.map((l) => ({
    navn: l.navn,
    myndigheter: l.myndigheter.filter((m) => finnes.has(m)),
  })).filter((l) => l.myndigheter.length > 0);
}

const meta = (r: Rad) => nivaalinje(r.org);

/** Organnavnet med organets eget kildemerke. Myndigheten er en del av organets post. */
function Organnavn({
  rad,
  kort,
  strekk,
}: {
  rad: Rad;
  kort: OrganKort | undefined;
  /** Lenken dekker hele raden. */
  strekk?: boolean;
}) {
  return (
    <>
      <OrganLenke
        org={rad.org.key}
        navn={rad.org.navn}
        className={cn(
          "font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal",
          strekk && "after:absolute after:inset-0 after:content-['']",
        )}
      >
        {rad.org.navn}
      </OrganLenke>
      <span className="mt-0.5 block text-[0.8125rem] font-normal text-dempet">
        {kort ? (
          <Pastand
            tekst={meta(rad)}
            belegg={kort.belegg}
            pastand={`${rad.org.navn}: ${rad.myndighet.length ? `myndighet til ${rad.myndighet.map((m) => MYNDIGHETNAVN[m].toLowerCase()).join(", ")}` : "myndigheten er ikke kartlagt"}.`}
          />
        ) : (
          meta(rad)
        )}
      </span>
    </>
  );
}

/** Et trykk hvor som helst på raden åpner organet, som et trykk på navnet. */
function trykkRad(e: MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest("a, button")) return;
  e.currentTarget.querySelector<HTMLAnchorElement>("a[href]")?.click();
}

export function Bransjematrise({
  segment,
  organkort,
  nokkel,
  animer,
}: {
  segment: SegmentOrganer;
  /** Organkortene fra organkartet, til organets kildemerke. */
  organkort: ReadonlyMap<string, OrganKort>;
  /** Endres når segmentet byttes, så radene tones inn på nytt. */
  nokkel: string;
  animer: boolean;
}) {
  const rader = segment.organer;
  const lag = kolonner(rader);
  const myndigheter = lag.flatMap((l) => l.myndigheter);
  const forste = new Set(lag.map((l) => l.myndigheter[0]));
  const grupper = STYRKER.map((s) => ({ styrke: s, rader: rader.filter((r) => r.styrke === s) })).filter(
    (g) => g.rader.length > 0,
  );
  const inn = animer ? "animate-in fade-in-0 duration-200" : "";

  return (
    <div className="@container">
      {/* Tabellen, når det er plass til kolonnene. */}
      <div className="hidden @min-[46rem]:block">
        <table key={nokkel} className={cn("w-full border-collapse text-left", inn)}>
          <caption className="sr-only">
            Organer som påvirker {segment.segment.navn.toLowerCase()}, etter styrke og myndighet
          </caption>
          <thead>
            <tr className="border-b border-linje">
              <th
                scope="col"
                rowSpan={2}
                className="w-[40%] pr-4 pb-2 align-bottom text-[0.8125rem] font-semibold text-dempet"
              >
                Organ
              </th>
              {lag.map((l) => (
                <th
                  key={l.navn}
                  scope="colgroup"
                  colSpan={l.myndigheter.length}
                  className="border-l border-linje px-2 pt-1 pb-1.5 text-left align-bottom text-[0.6875rem] font-semibold tracking-[0.12em] text-dempet uppercase"
                >
                  {l.navn}
                </th>
              ))}
            </tr>
            <tr className="border-b border-trykk">
              {myndigheter.map((m) => (
                <th
                  key={m}
                  scope="col"
                  lang="nb"
                  className={cn(
                    "etikett min-w-[3.75rem] px-1.5 pt-1 pb-2 text-center align-bottom text-[0.75rem] leading-[1.2] [hyphens:manual]",
                    forste.has(m) && "border-l border-linje",
                    m === "innstilling" ? "text-signal-tekst" : "text-trykk",
                  )}
                >
                  {KORT[m] ?? MYNDIGHETNAVN[m]}
                </th>
              ))}
            </tr>
          </thead>
          {grupper.map((g) => (
            <tbody key={g.styrke}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={1 + myndigheter.length}
                  className="pt-5 pb-2 text-left font-normal"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <Styrkestrek styrke={g.styrke} />
                    <span className="text-[0.9375rem] font-bold">{STYRKE[g.styrke].navn}</span>
                    <span className="text-[0.8125rem] text-dempet">
                      {antall(g.rader.length, "organ", "organer")}. {STYRKE[g.styrke].forklaring}
                    </span>
                  </span>
                </th>
              </tr>
              {g.rader.map((r) => (
                <tr
                  key={r.org.key}
                  onClick={trykkRad}
                  className="group/rad cursor-pointer border-t border-linje transition-colors duration-150 hover:bg-flate"
                >
                  <th scope="row" className="py-2 pr-4 text-left align-top text-[0.9375rem] leading-[1.3] font-normal">
                    <Organnavn rad={r} kort={organkort.get(r.org.key)} />
                  </th>
                  {r.myndighet.length === 0 ? (
                    <td colSpan={myndigheter.length} className="border-l border-linje px-2 py-2 align-middle">
                      <IkkeKartlagt>Myndighet ikke kartlagt</IkkeKartlagt>
                    </td>
                  ) : (
                    myndigheter.map((m) => {
                      const har = r.myndighet.includes(m);
                      return (
                        <td
                          key={m}
                          className={cn(
                            "px-1.5 py-2 text-center align-middle",
                            forste.has(m) && "border-l border-linje",
                          )}
                        >
                          {har ? (
                            <>
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "inline-block size-2.5 align-middle",
                                  m === "innstilling" ? "bg-signal" : "bg-trykk",
                                )}
                              />
                              <span className="sr-only">{MYNDIGHETNAVN[m]}</span>
                            </>
                          ) : (
                            <span className="sr-only">Nei</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Listen, når seksjonen er smal. */}
      <div key={nokkel} className={cn("flex flex-col gap-6 @min-[46rem]:hidden", inn)}>
        {grupper.map((g) => (
          <section key={g.styrke} aria-labelledby={`bransje-${nokkel}-${g.styrke}`}>
            <h3
              id={`bransje-${nokkel}-${g.styrke}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-trykk pb-2"
            >
              <Styrkestrek styrke={g.styrke} />
              <span className="text-[0.9375rem] font-bold">{STYRKE[g.styrke].navn}</span>
              <span className="text-[0.8125rem] font-normal text-dempet">
                {antall(g.rader.length, "organ", "organer")}
              </span>
            </h3>
            <ul>
              {g.rader.map((r) => (
                <li
                  key={r.org.key}
                  className="relative flex flex-col gap-2 border-b border-linje py-3 [&_.kildemerke]:z-[1]"
                >
                  <p className="text-[0.9375rem] leading-[1.3]">
                    <Organnavn rad={r} kort={organkort.get(r.org.key)} strekk />
                  </p>
                  <MyndighetListe myndighet={r.myndighet} organnavn={r.org.navn} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Tegnforklaringen til matrisen: strektykkelsen og merkene i cellene. */
export function Bransjeforklaring({ harInnstilling }: { harInnstilling: boolean }) {
  return (
    <ul
      aria-label="Slik leser du matrisen"
      className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] leading-[1.3] text-dempet"
    >
      {STYRKER.map((s) => (
        <li key={s} className="flex items-center gap-2">
          <Styrkestrek styrke={s} />
          <span>
            <b className="font-semibold text-trykk">{STYRKE[s].navn}</b>
          </span>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-block size-2.5 bg-trykk" />
        har myndigheten
      </li>
      {harInnstilling && (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-2.5 bg-signal" />
          innstilling, forberedende makt
        </li>
      )}
    </ul>
  );
}
