// Seksjon 7: Din bransje, myndighetsmatrise (DESIGN.md §5.7).
//
// Leseren velger bransje (ToggleGroup) og ser hvilke organer som påvirker
// den, og med hvilken myndighet. Bare koblingene i `org_segment` vises, med
// styrken fra datasettet: primær, sekundær og indirekte. Designerens egne
// koblinger fra prototypen er borte.
//
// Bransjen som vises først, er den med flest organer i kommunen. Da viser
// seksjonen mest mulig før leseren har valgt, og valget er regnet fra data.
// Innenfor hver styrke vises de ti første etter regelen i bransje/matrise.tsx.
//
// Anker: #bransje.

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { useMemo, useState } from "react";

import { Seksjon } from "@/components/maktkart/seksjon";
import type { KommuneOversikt } from "@/lib/data";
import { antall, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Bransjeforklaring, Bransjematrise } from "./bransje/matrise";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

/** Bransjen med flest organer. Likt antall: den første i datalagets rekkefølge. */
function standardSegment(valg: KommuneOversikt["segmenter"]): string | null {
  let best: KommuneOversikt["segmenter"][number] | null = null;
  for (const s of valg) if (!best || s.antall_organer > best.antall_organer) best = s;
  return best?.kode ?? null;
}

function Segmentvelger({
  valg,
  verdi,
  settVerdi,
}: {
  valg: KommuneOversikt["segmenter"];
  verdi: string;
  settVerdi: (kode: string) => void;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={verdi}
      // Ett segment er alltid valgt. Et trykk på det valgte fjerner det ikke.
      onValueChange={(v) => v && settVerdi(v)}
      aria-label="Velg bransje"
      className="flex flex-wrap gap-1.5"
    >
      {valg.map((s) => (
        <ToggleGroupPrimitive.Item
          key={s.kode}
          value={s.kode}
          className={cn(
            "inline-flex h-10 cursor-pointer items-center gap-2 border border-trykk bg-papir px-3 text-[0.875rem] font-semibold",
            "transition-[background-color,color,transform] duration-150 ease-(--ease-ut) hover:bg-flate-2 active:scale-[0.97]",
            "data-[state=on]:bg-trykk data-[state=on]:text-paa-trykk",
          )}
        >
          {s.navn}
          <span className="text-[0.8125rem] font-normal tabular-nums opacity-75">
            {tall(s.antall_organer)}
          </span>
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export function BransjeSeksjon({ side }: SeksjonProps) {
  const valg = side.oversikt.segmenter;
  const [kode, settKode] = useState(() => standardSegment(valg));
  // Radene tones inn når leseren bytter bransje, ikke ved første maling.
  const [byttet, settByttet] = useState(false);
  const segment = side.segmenter.find((s) => s.segment.kode === kode) ?? null;
  const organkort = useMemo(
    () => new Map(side.organkart.grupper.flatMap((g) => g.organer).map((o) => [o.key, o])),
    [side.organkart],
  );

  const rader = segment?.organer ?? [];
  const primaer = rader.filter((r) => r.styrke === 3).length;
  const innstilling = rader.filter((r) => r.myndighet.includes("innstilling")).length;
  const utenMyndighet = rader.filter((r) => r.myndighet.length === 0).length;

  return (
    <Seksjon
      id="bransje"
      region={seksjonsnavn("bransje")}
      tittel="Hvem påvirker din bransje?"
      ingress="Velg bransje og se hvilke organer som har myndighet over den, og hva slags myndighet det er."
      verktoy={
        valg.length > 0 && kode ? (
          <Segmentvelger
            valg={valg}
            verdi={kode}
            settVerdi={(k) => {
              settKode(k);
              settByttet(true);
            }}
          />
        ) : undefined
      }
    >
      {!segment ? (
        <div className="border border-dashed border-kote bg-flate px-5 py-6">
          <p className="font-semibold">Bransjene er ikke kartlagt.</p>
          <p className="mt-1 text-[0.9375rem] text-dempet">
            Datasettet for {side.kommune.navn} kobler ingen organer til bransjer ennå.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p aria-live="polite" className="maal text-[1.0625rem] leading-[1.5]">
            {rader.length === 0 ? (
              <>
                Ingen organer i datasettet er koblet til {segment.segment.navn.toLowerCase()} i{" "}
                {side.kommune.navn}.
              </>
            ) : (
              <>
                <b className="font-semibold">
                  {antall(rader.length, "organ", "organer")} påvirker{" "}
                  {segment.segment.navn.toLowerCase()} i {side.kommune.navn}.
                </b>{" "}
                {primaer > 0
                  ? `${tall(primaer)} av dem har bransjen som hovedområde.`
                  : "Ingen av dem har bransjen som hovedområde."}
                {innstilling > 0 &&
                  ` ${tall(innstilling)} forbereder sakene med innstilling, før de vedtas.`}
                {utenMyndighet > 0 && ` For ${tall(utenMyndighet)} er myndigheten ikke kartlagt.`}
              </>
            )}
          </p>
          {rader.length > 0 && (
            <>
              <Bransjeforklaring harInnstilling={innstilling > 0} />
              <Bransjematrise
                key={segment.segment.kode}
                segment={segment}
                organkort={organkort}
                nokkel={segment.segment.kode}
                animer={byttet}
              />
            </>
          )}
          <p className="maal text-[0.8125rem] leading-[1.5] text-dempet">
            Koblingen mellom organ og bransje er fra researchgrunnlagets oversikt over
            næringssegmenter. Koblingene har ikke eget kildemerke ennå. Myndigheten er organets egen
            og har merket ved organet. Trykk på et organ for roller, eierskap og kilder.
          </p>
        </div>
      )}
    </Seksjon>
  );
}
