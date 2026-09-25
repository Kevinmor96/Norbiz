// Eierstolpene (DESIGN.md §5.4): én rad per selskap kommunen eier direkte.
// Stolpen er hele selskapet, og den fylte delen er kommunens andel. Andelen og
// hvert nøkkeltall har sitt eget kildemerke, fordi de kommer fra ulike kilder
// og kan ha ulik grad.
//
// Kommunale foretak står ikke her. De er en del av kommunen (egen gruppe).
// Et selskap uten oppgitt andel får en tom stolpe og brikken «Andel ikke
// oppgitt». Stolpen gjetter aldri.

import { Kildemerke, MedMerke } from "@/components/maktkart/kildemerke";
import type { Eierandel, OrganRef } from "@/lib/data";
import { prosent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Blokktittel, IkkeKartlagt, Nokkeltall, OrganLenke } from "./felles";
import type { Eierrad } from "./utregning";

function Stolpe({ andel }: { andel: number | null }) {
  return (
    <div aria-hidden="true" className="relative col-span-2 h-2.5 w-full bg-vann-lys">
      {andel !== null && andel > 0 && (
        <div
          className="absolute inset-y-0 left-0 bg-vann"
          // 2 px papir mellom kommunens del og resten, så grensen leses uten strek.
          style={{
            width: `${Math.min(100, andel)}%`,
            boxShadow: andel < 100 ? "2px 0 0 var(--papir)" : undefined,
          }}
        />
      )}
    </div>
  );
}

/** De andre eierne: med andel først, så de uten oppgitt andel samlet. */
function AndreEiere({ andre, selskap }: { andre: Eierandel[]; selskap: OrganRef }) {
  if (andre.length === 0) return null;
  const med = andre.filter((a) => a.andel !== null);
  const uten = andre.filter((a) => a.andel === null);
  return (
    <p className="col-span-2 text-[0.8125rem] leading-[1.5] text-dempet">
      <span>{med.length > 0 ? "Andre eiere: " : "Andre eiere uten oppgitt andel: "}</span>
      {med.map((a, i) => (
        <span key={a.org.key}>
          {i > 0 && ", "}
          <span className="text-trykk">{a.org.navn}</span>{" "}
          <MedMerke
            belegg={a.belegg}
            pastand={`${a.org.navn} eier ${prosent(a.andel ?? 0)} av ${selskap.navn}`}
            className="font-semibold text-trykk"
          >
            {prosent(a.andel ?? 0)}
          </MedMerke>
        </span>
      ))}
      {uten.length > 0 && (
        <>
          {med.length > 0 && ". Uten oppgitt andel: "}
          {uten.map((a, i) => (
            <span key={a.org.key}>
              {i > 0 && (i === uten.length - 1 ? " og " : ", ")}
              <span className="whitespace-nowrap text-trykk">
                {a.org.navn}
                <Kildemerke
                  belegg={a.belegg}
                  pastand={`${a.org.navn} er eier i ${selskap.navn}. Andelen er ikke oppgitt`}
                />
              </span>
            </span>
          ))}
        </>
      )}
    </p>
  );
}

export function Eierstolper({
  rader,
  eier,
  tittelId,
}: {
  rader: Eierrad[];
  eier: OrganRef;
  tittelId: string;
}) {
  const utenAndel = rader.filter((r) => r.andel === null).length;
  return (
    <div className="flex flex-col gap-3">
      <Blokktittel id={tittelId}>Eierandeler</Blokktittel>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        {rader.length} selskaper {eier.navn} eier direkte, størst andel først
        {utenAndel > 0 ? `. ${utenAndel} av dem uten oppgitt andel står sist` : ""}. Stolpen er
        hele selskapet, og den fylte delen er kommunens andel.
      </p>
      <ul aria-labelledby={tittelId} className="mt-2 border-b border-linje">
        {rader.map((r) => (
          <li
            key={r.org.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 border-t border-linje py-3.5"
          >
            <p className="min-w-0 font-semibold text-pretty">
              <OrganLenke org={r.org} />
            </p>
            <p className="justify-self-end text-right">
              {r.andel !== null ? (
                <MedMerke
                  belegg={r.belegg}
                  pastand={`${eier.navn} eier ${prosent(r.andel)} av ${r.org.navn}`}
                  className="text-[1.0625rem] font-bold [font-stretch:104%]"
                >
                  {prosent(r.andel)}
                </MedMerke>
              ) : (
                <span className="inline-flex items-center whitespace-nowrap">
                  <IkkeKartlagt>Andel ikke oppgitt</IkkeKartlagt>
                  <Kildemerke
                    belegg={r.belegg}
                    pastand={`${eier.navn} er eier i ${r.org.navn}. Andelen er ikke oppgitt`}
                  />
                </span>
              )}
            </p>
            <Stolpe andel={r.andel} />
            <AndreEiere andre={r.andre} selskap={r.org} />
            {r.tall.length > 0 ? (
              <dl className="col-span-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] leading-[1.45]">
                {r.tall.map((t) => (
                  <Nokkeltall key={`${t.aar}-${t.type}-${String(t.konsern)}`} t={t} organ={r.org} />
                ))}
              </dl>
            ) : (
              <p className={cn("col-span-2 text-[0.8125rem] text-dempet")}>
                Ingen regnskapstall med år i datasettet.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
