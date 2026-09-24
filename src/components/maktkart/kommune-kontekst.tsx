// Kommunen siden handler om, delt med alt under. Tegnforklaringen henter
// tellingene herfra, metodelenkene vet om de peker til en seksjon på samme
// side, og kildelappen vet hvilken kommune den står i.
//
// Malen vet ikke at den handler om Tromsø: alt som står her, kommer fra
// datasettet gjennom `kommune_oversikt`.

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { KommuneOversikt, Verifiseringstelling } from "@/lib/data";

export interface KommuneKontekstVerdi {
  /** Navn, kommunenr., fylke, slug og `sammenstilt` (YYYY-MM-DD). */
  kommune: KommuneOversikt["kommune"];
  kommuneorgan: KommuneOversikt["kommuneorgan"];
  /** Påstander per grad i kommunens datasett. Tegnforklaringen teller herfra, aldri fra siden. */
  telling: Verifiseringstelling;
  /** Kildene påstandene bygger på, med antall. Sortert på antall synkende. */
  kilder: KommuneOversikt["kilder"];
  dekning: KommuneOversikt["dekning"];
  /** Lenken til metoden. På kommunesiden er det seksjonen `#metode`. */
  metodeHref: string;
  /** Lenken til Pro-ventelisten. På kommunesiden er det `#pro` i metodeseksjonen. */
  proHref: string;
}

const Kontekst = createContext<KommuneKontekstVerdi | null>(null);

export function KommuneKontekst({
  oversikt,
  metodeHref = "/metode",
  proHref = "/pro",
  children,
}: {
  oversikt: KommuneOversikt;
  metodeHref?: string;
  proHref?: string;
  children: ReactNode;
}) {
  const verdi = useMemo<KommuneKontekstVerdi>(
    () => ({
      kommune: oversikt.kommune,
      kommuneorgan: oversikt.kommuneorgan,
      telling: oversikt.verifisering,
      kilder: oversikt.kilder,
      dekning: oversikt.dekning,
      metodeHref,
      proHref,
    }),
    [oversikt, metodeHref, proHref],
  );
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>;
}

/** Kommunen siden står i, eller `null` utenfor en kommuneside (forsiden, metodesiden). */
export function useKommune(): KommuneKontekstVerdi | null {
  return useContext(Kontekst);
}

/** Som `useKommune`, men kaster utenfor en kommuneside. For komponenter som bare gir mening der. */
export function useKommuneKrevd(): KommuneKontekstVerdi {
  const k = useContext(Kontekst);
  if (!k) throw new Error("Komponenten må stå innenfor <KommuneKontekst>");
  return k;
}
