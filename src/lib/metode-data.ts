// Det /metode viser fra datasettene, regnet på serveren.
//
// Siden viser en tabell over datasettene, kildene og hullene per kommune, og
// organene i innsigelsesskjemaet. Bare det tas med: ikke hele oversikten og
// ikke hele organkartet, så HTML-en ikke bærer 80 kommunesider.

import type { HullPunkt, KommuneOversikt, Nivaa } from "@/lib/data";

export interface MetodeDatasett {
  oversikt: Pick<
    KommuneOversikt,
    "kommune" | "kommuneorgan" | "dekning" | "verifisering" | "kilder"
  >;
  hull: HullPunkt[];
  organer: { key: string; navn: string; nivaa: Nivaa }[];
}

export async function lastMetode(): Promise<{ datasett: MetodeDatasett[] }> {
  const [{ data }, { tilSiden }] = await Promise.all([
    import("@/lib/data"),
    import("@/lib/nyttelast"),
  ]);
  const kommuner = await data.kommuner();
  const datasett = (
    await Promise.all(
      kommuner.map(async (k) => {
        const [oversikt, organkart, hull] = await Promise.all([
          data.kommune_oversikt(k.kommunenr),
          data.organkart(k.kommunenr),
          data.hull(k.kommunenr),
        ]);
        if (!oversikt) return null;
        return {
          oversikt: {
            kommune: oversikt.kommune,
            kommuneorgan: oversikt.kommuneorgan,
            dekning: oversikt.dekning,
            verifisering: oversikt.verifisering,
            kilder: oversikt.kilder,
          },
          hull: hull ?? [],
          // Bare det skjemaet trenger, så siden ikke bærer hele organkartet.
          organer: (organkart?.grupper ?? []).flatMap((g) =>
            g.organer.map((o) => ({ key: o.key, navn: o.navn, nivaa: o.nivaa })),
          ),
        };
      }),
    )
  )
    .filter((d): d is MetodeDatasett => d !== null)
    .sort((a, b) => b.oversikt.dekning.organer - a.oversikt.dekning.organer);
  // Svaret serialiseres inn i HTML-en. Se src/lib/nyttelast.ts.
  return tilSiden({ datasett });
}
