// Seksjon 7: Din bransje, myndighetsmatrise (DESIGN.md §5.7).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./bransje/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.oversikt.segmenter  { kode, navn, antall_organer }[] til segmentvelgeren (ToggleGroup).
//   side.segmenter           SegmentOrganer[] i samme rekkefølge: organene per segment med
//                            styrke og myndighet. Bare koblinger fra org_segment vises.
//
// Anker: #bransje. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function BransjeSeksjon({ side }: SeksjonProps) {
  return (
    <Seksjon
      id="bransje"
      region={seksjonsnavn("bransje")}
      tittel="Hvem påvirker din bransje?"
      ingress="Velg bransje og se hvilke organer som har myndighet over den, og hva slags myndighet det er."
    >
      <Plassholder seksjon="Din bransje">
        {tall(side.segmenter.length)} bransjer:{" "}
        {side.oversikt.segmenter.map((s) => s.navn).join(", ")}.
      </Plassholder>
    </Seksjon>
  );
}
