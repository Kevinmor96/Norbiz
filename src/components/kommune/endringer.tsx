// Seksjon 6: Endringene, tidslinje med nå-linje (DESIGN.md §5.6).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./endringer/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.endringer.skjedd       Endring[], nyeste først.
//   side.endringer.ikke_skjedd  Endring[] (planlagt, foreslått), eldste først. Står over
//                               nå-linjen med åpen strek og merket «Har ikke skjedd».
//   side.kommune.sammenstilt    nå-linjen: «Sammenstilt 24.09.2026» (datoKort), aldri «i dag».
//   side.hull                   hendelser uten dato hører til gruppen «Uten dato».
//
// Anker: #endringer. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function EndringerSeksjon({ side }: SeksjonProps) {
  return (
    <Seksjon
      id="endringer"
      region={seksjonsnavn("endringer")}
      tittel="Hva har endret seg?"
      ingress="Rollebytter og strukturendringer, med dato. Det som er planlagt eller bare foreslått, har ikke skjedd og er tegnet åpent."
    >
      <Plassholder seksjon="Endringene">
        {tall(side.endringer.skjedd.length)} hendelser som har skjedd,{" "}
        {tall(side.endringer.ikke_skjedd.length)} som ikke har skjedd.
      </Plassholder>
    </Seksjon>
  );
}
