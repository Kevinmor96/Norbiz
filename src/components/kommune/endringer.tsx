// Seksjon 6: Endringene, tidslinje med nå-linje (DESIGN.md §5.6).
//
// Rollebytter og strukturendringer med dato. Nå-linjen er datoen datasettet
// ble sammenstilt, aldri «i dag»: siden sier ikke noe om hva som har skjedd
// etter det. Det som er planlagt eller bare foreslått, står over linjen med
// åpen strek og merket «Har ikke skjedd». Endringer grunnlaget nevner uten
// dato, står i egen gruppe under tidslinjen.
//
// Props: `side` (hele kommunesiden fra loaderen). Seksjonen bruker
//   side.endringer.skjedd       Endring[], nyeste først.
//   side.endringer.ikke_skjedd  Endring[] (planlagt, foreslått), eldste først.
//   side.kommune.sammenstilt    nå-linjen: «Sammenstilt 24.09.2026».
//   side.hull                   hull om datoer som mangler, til gruppen «Uten dato».
//
// Anker: #endringer. «Hele tidslinjen» i stripen under kartbladet peker hit.
// Regionnavn og anker står i ./seksjoner.ts.

import { useMemo } from "react";

import { Seksjon } from "@/components/maktkart/seksjon";

import { byggTidslinje } from "./endringer/modell";
import { TidslinjeVisning } from "./endringer/tidslinje";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function EndringerSeksjon({ side }: SeksjonProps) {
  const { sammenstilt, navn } = side.kommune;
  const tidslinje = useMemo(
    () => byggTidslinje(side.endringer, side.hull, sammenstilt),
    [side.endringer, side.hull, sammenstilt],
  );
  const ingress = tidslinje.framtid.length
    ? "Rollebytter og strukturendringer, med dato. Det som er planlagt eller bare foreslått, har ikke skjedd og står over nå-linjen med åpen strek."
    : "Rollebytter og strukturendringer, med dato.";

  return (
    <Seksjon
      id="endringer"
      region={seksjonsnavn("endringer")}
      tittel="Hva har endret seg?"
      ingress={ingress}
    >
      <TidslinjeVisning tidslinje={tidslinje} sammenstilt={sammenstilt} kommunenavn={navn} />
    </Seksjon>
  );
}
