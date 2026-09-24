// Seksjon 4: Pengene, eierstolper og utbytteelv (DESIGN.md §5.4).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./pengene/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.eierskap.selskaper    { org, ledd, eiere, nokkeltall }[]. KF-er er ikke eierandeler:
//                              de står i egen gruppe («Kommunale foretak, del av kommunen»).
//   side.eierskap.utbytte      { selskap, total, mottakere, sum_mottakere }[] til elva.
//   side.kommuneprofil         kommunens egne nøkkeltall (merforbruk, underskudd) i
//                              kommuneprofil.nokkeltall. To ulike mål, sammenlignes ikke.
//   Hvert tall har eget kildemerke, år og morselskap/konsern (NokkeltallUt.konsern).
//
// Anker: #pengene. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function PengeneSeksjon({ side }: SeksjonProps) {
  return (
    <Seksjon
      id="pengene"
      region={seksjonsnavn("pengene")}
      tittel="Hva eier kommunen?"
      ingress="Eierandeler i selskaper, med tall fra siste oppgitte regnskapsår, og hvor utbyttet går videre."
    >
      <Plassholder seksjon="Pengene">
        {tall(side.eierskap.selskaper.length)} selskaper og foretak i eierkjeden,{" "}
        {tall(side.eierskap.utbytte.length)} med utbytte.
      </Plassholder>
    </Seksjon>
  );
}
