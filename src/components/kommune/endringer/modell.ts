// Tidslinjen gruppert slik leseren skal lese den: det som ikke har skjedd
// øverst, så nå-linjen, så det som har skjedd, nyeste først. Endringer
// grunnlaget nevner uten dato, står for seg.
//
// «Ikke skjedd» er typen (planlagt, foreslått) eller en dato etter at
// datasettet ble sammenstilt. Ingen funksjon her leser klokka: nå-linjen er
// sammenstillingsdatoen, så siden sier det samme i dag og om et år.

import type { Endring, Endringer, HullPunkt } from "@/lib/data";

import { erDatohull, hullhint, type Hullhint } from "../kjede/hull";

export interface Aargruppe {
  aar: string;
  /** Står over nå-linjen: har ikke skjedd. */
  framtid: boolean;
  hendelser: Endring[];
}

export interface Udatert extends Hullhint {
  org: HullPunkt["gjelder"];
}

export interface Tidslinje {
  framtid: Aargruppe[];
  fortid: Aargruppe[];
  udaterte: Udatert[];
}

/**
 * Datoen ligger etter sammenstillingen, målt med den presisjonen datoen har.
 * «2026-10» er etter 24.09.2026. «2026» er det ikke: vi vet ikke når i året.
 */
export function etterSammenstilt(iso: string, sammenstilt: string): boolean {
  return iso > sammenstilt.slice(0, iso.length);
}

function perAar(liste: Endring[], framtid: boolean): Aargruppe[] {
  const grupper: Aargruppe[] = [];
  for (const e of liste) {
    const aar = e.dato.slice(0, 4);
    const siste = grupper[grupper.length - 1];
    if (siste && siste.aar === aar) siste.hendelser.push(e);
    else grupper.push({ aar, framtid, hendelser: [e] });
  }
  return grupper;
}

export function byggTidslinje(
  endringer: Endringer,
  hull: HullPunkt[],
  sammenstilt: string,
): Tidslinje {
  const etter = (e: Endring) => etterSammenstilt(e.dato, sammenstilt);
  // Datalaget gir «ikke skjedd» eldste først. Over nå-linjen leses tiden
  // nedover mot linjen, så lengst fram står øverst.
  const kommende = [...endringer.ikke_skjedd, ...endringer.skjedd.filter(etter)].sort((a, b) =>
    a.dato === b.dato ? 0 : a.dato < b.dato ? -1 : 1,
  );
  kommende.reverse();
  return {
    framtid: perAar(kommende, true),
    fortid: perAar(
      endringer.skjedd.filter((e) => !etter(e)),
      false,
    ),
    udaterte: hull.filter(erDatohull).map((h) => ({ org: h.gjelder, ...hullhint(h) })),
  };
}
