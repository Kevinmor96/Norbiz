// Seksjon 8: Neste kommune, kartbladoversikt og stemme (DESIGN.md §5.8).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./neste/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.kommuner          kommunene som har datasett (fylte ruter i oversikten).
//   side.kommune           fylket (valgkretsen) og kommunen selv.
//   side.oversikt.dekning  til «Slik ser en tom kommune ut»: hva malen viser når data mangler.
//   Kvitteringen er ærlig: uten Supabase-klient «Forhåndsversjonen lagrer ikke stemmen ennå».
//
// Anker: #neste. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function NesteSeksjon({ side }: SeksjonProps) {
  return (
    <Seksjon
      id="neste"
      region={seksjonsnavn("neste")}
      tittel="Hvilken kommune skal kartlegges nå?"
      ingress={`${side.kommune.navn} er først. Stem fram den neste. Stemmene viser oss hvor behovet er størst.`}
    >
      <Plassholder seksjon="Neste kommune">
        Kartlagt nå: {side.kommuner.map((k) => k.navn).join(", ")}.
      </Plassholder>
    </Seksjon>
  );
}
