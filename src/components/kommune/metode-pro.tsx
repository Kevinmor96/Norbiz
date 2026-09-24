// Seksjon 9: Metode og Pro (DESIGN.md §5.9).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./metode-pro/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   <Tegnforklaring form="full" />  tegnforklaringen i full form (tellinger fra KommuneKontekst).
//   side.oversikt.kilder            kildelisten med antall påstander per kilde.
//   side.hull                       «Hull i datasettet (N)», kan foldes ut. Kjør fritekst
//                                   gjennom lesbar() fra @/lib/format: «[verifiser]» skal
//                                   aldri nå leseren.
//   side.kommune                    sammenstilt-dato og grunnlag.
//
// Ankere som MÅ finnes i denne seksjonen, fordi topplinjen, bunnlinjen og
// bunnteksten lenker til dem:
//   #metode  (seksjonen selv)
//   #kilder  kildelisten
//   #pro     Pro-ventelisten («Venteliste for Pro»)
//
// Anker: #metode. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function MetodeProSeksjon({ side }: SeksjonProps) {
  return (
    <Seksjon
      id="metode"
      region={seksjonsnavn("metode")}
      tittel="Hvordan vet vi dette?"
      ingress="Hver påstand har et kildemerke. Trykk på merket for å se kilden, datoen og hvor langt påstanden er etterprøvd."
    >
      <Plassholder seksjon="Metode og Pro">
        <span id="kilder" className="block scroll-mt-24">
          {tall(side.oversikt.kilder.length)} kilder, {tall(side.hull.length)} hull i datasettet.
        </span>
        <span id="pro" className="block scroll-mt-24">
          Pro vises som venteliste med prishypoteser.
        </span>
      </Plassholder>
    </Seksjon>
  );
}
