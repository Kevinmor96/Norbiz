// Seksjon 2: Beslutningskjeden, orienteringsløypa (DESIGN.md §5.2).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./kjede/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.kjeder              Beslutningskjede[], én per prosess, i samme rekkefølge som
//                            side.oversikt.prosesser. Hvert steg har org, myndighet, hva,
//                            belegg og ledere (Rolle[] med belegg).
//   side.oversikt.prosesser  { key, tittel, sporsmal, antall_steg }[] til prosessvelgeren
//                            (ToggleGroup). `sporsmal` er tittelen på seksjonen.
//   side.hull                hull per organ, til «Leder ikke kartlagt. Hentes fra …».
//
// Anker: #kjeden. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function KjedeSeksjon({ side }: SeksjonProps) {
  const forste = side.kjeder[0];
  return (
    <Seksjon
      id="kjeden"
      region={seksjonsnavn("kjeden")}
      tittel={forste?.prosess.sporsmal ?? "Hvem bestemmer en sak?"}
      ingress="Vedtaket fattes av de folkevalgte, men saken formes før den kommer dit. Følg den fra den skrives til den kan påklages."
    >
      <Plassholder seksjon="Beslutningskjeden">
        {side.kjeder.map((k) => `${k.prosess.tittel}: ${k.steg.length} steg`).join(" · ")}
      </Plassholder>
    </Seksjon>
  );
}
