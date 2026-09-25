// Seksjon 8: Neste kommune, kartbladoversikt og stemme (DESIGN.md §5.8).
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.kommuner          kommunene som har datasett (fylte ruter i oversikten).
//   side.kommune           fylket (valgkretsen) og kommunen selv.
//   side.oversikt.dekning  til «Slik ser en tom kommune ut»: hva malen viser når data mangler.
//
// Hvilke kommuner valgkretsen har, står i ./neste/valgkretser.ts med belegg,
// ikke her. Kvitteringen er ærlig: uten Supabase-klient sier den
// «Forhåndsversjonen lagrer ikke stemmen ennå» (src/lib/venteliste.ts).
//
// Anker: #neste. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { NesteKommune } from "./neste/neste-kommune";
import { valgkretsFor } from "./neste/valgkretser";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function NesteSeksjon({ side }: SeksjonProps) {
  const { kommune } = side;
  const valgkrets = valgkretsFor(kommune.fylkesnr);
  return (
    <Seksjon
      id="neste"
      region={seksjonsnavn("neste")}
      tittel="Hvilken kommune skal kartlegges nå?"
      ingress={`${
        side.kommuner.length === 1
          ? `${kommune.navn} er den første kommunen i kartet.`
          : `${tall(side.kommuner.length)} kommuner er kartlagt.`
      } Stem fram den neste${valgkrets ? ` i ${valgkrets.navn}` : ""}. Stemmene viser oss hvor behovet er størst.`}
    >
      <NesteKommune
        fylkesnr={kommune.fylkesnr}
        fylke={kommune.fylke}
        kartlagte={side.kommuner}
        gjeldendeSlug={kommune.slug}
        sammenligning={{
          navn: kommune.navn,
          organer: side.oversikt.dekning.organer,
          roller: side.oversikt.dekning.roller,
          hull: side.oversikt.dekning.hull,
        }}
      />
    </Seksjon>
  );
}
