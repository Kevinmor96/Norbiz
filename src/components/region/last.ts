// Det regionsidene trenger, regnet ferdig på serveren: forsiden (hele
// Nord-Norge), fylkessidene og søket.
//
// Alt tallarbeid skjer i datalaget (`region_oversikt`, `fylke_oversikt`,
// `sok`). Denne fila setter bare sammen: dekningsklassen
// per kommune og fylkets organer sortert etter hva de er. Til slutt går svaret
// gjennom `tilSiden`, så «[verifiser]» ikke står i HTML-en og like objekter
// står der én gang.
//
// Datalaget lastes med dynamisk import, som i kommuneside.ts: loadere deles
// ikke opp, og en vanlig import ville lagt datalaget i hovedbunten.

import type {
  Datalag,
  FylkeOrgan,
  RegionKommune,
  RegionOversikt,
  Sokeresultat,
} from "@/lib/data";
import { tilSiden } from "@/lib/nyttelast";

import {
  DEKNINGSKLASSER,
  type Dekningsklasse,
  type FylkeIRegion,
  type Fylkeside,
  type KommuneIRegion,
  type Klassetelling,
  type Regionside,
} from "./typer";

async function regionfunksjoner(): Promise<Datalag> {
  return (await import("@/lib/data")).data;
}

const tomKlasser = (): Klassetelling =>
  Object.fromEntries(DEKNINGSKLASSER.map((k) => [k, 0])) as Klassetelling;

/**
 * Dekningsklassen: hvor mye av svaret datasettet har. Beslutningskjeder når
 * datasettet har prosessteg, ordfører når kommunen har en aktiv politisk leder
 * (`datasett.ledere.politisk_leder`, samme telling som `kommune_oversikt.ledere`),
 * ellers bare registre. Uten datasett: ikke kartlagt.
 */
function klasseFor(k: RegionKommune): Dekningsklasse {
  if (!k.datasett) return "ingen";
  if (k.datasett.grader.prosess_steg.totalt > 0) return "kjeder";
  if (k.datasett.ledere.politisk_leder > 0) return "folkevalgte";
  return "register";
}

function medKlasser(o: RegionOversikt) {
  const kommuner: KommuneIRegion[] = o.kommuner.map((k) => ({ ...k, klasse: klasseFor(k) }));
  const fylker: FylkeIRegion[] = o.fylker.map((f) => {
    const klasser = tomKlasser();
    for (const k of kommuner) if (k.fylkesnr === f.fylkesnr) klasser[k.klasse] += 1;
    return { ...f, klasser };
  });
  return { kommuner, fylker };
}

/** Forsiden: hele regionen. */
export async function lastRegionside(): Promise<Regionside> {
  const o = await (await regionfunksjoner()).region_oversikt();
  const { kommuner, fylker } = medKlasser(o);
  const klasser = tomKlasser();
  for (const k of kommuner) klasser[k.klasse] += 1;
  return tilSiden({
    region: {
      ...o.region,
      folketall: {
        verdi: fylker.reduce((sum, f) => sum + f.folketall.verdi, 0),
        aar: fylker[0]?.folketall.aar ?? 0,
      },
      klasser,
    },
    fylker,
    kommuner,
    kilder: o.kilder,
  });
}

/** Fylkessiden, eller `null` når sluggen ikke er et fylke i regionen. */
export async function lastFylkeside(slug: string): Promise<Fylkeside | null> {
  const f = await regionfunksjoner();
  const o = await f.region_oversikt();
  const nr = o.fylker.find((x) => x.slug === slug)?.fylkesnr;
  if (!nr) return null;
  const fo = await f.fylke_oversikt(nr);
  if (!fo) return null;
  const { kommuner, fylker } = medKlasser(o);

  const av = (...typer: string[]) => fo.organer.filter((x) => typer.includes(x.organtype));
  const statsforvaltere = av("statsforvalter");
  const nokler = new Set(statsforvaltere.map((x) => x.key));
  const plassert = new Set<string>();
  const merk = (xs: FylkeOrgan[]) => {
    for (const x of xs) plassert.add(x.key);
    return xs;
  };

  const side: Fylkeside = {
    fylke: fylker.find((x) => x.fylkesnr === nr)!,
    kommuner: kommuner.filter((k) => k.fylkesnr === nr),
    fylkeskommune: merk(av("fylkeskommune"))[0] ?? null,
    politisk: merk(av("folkevalgt_organ")),
    administrativ: merk(av("administrasjon")),
    // Embetet, ikke kontorene under det: et kontor har embetet som overordnet.
    statsforvalter: merk(statsforvaltere.filter((x) => !(x.overordnet && nokler.has(x.overordnet)))),
    storting: merk(av("lovgivende")),
    andre: [],
    storste: fo.storste,
  };
  merk(statsforvaltere);
  side.andre = fo.organer.filter((x) => !plassert.has(x.key));
  return tilSiden(side);
}

/** Søket i regionen: kommuner, organer og personer i roller. */
export async function sokIRegion(sporring: string, limit: number): Promise<Sokeresultat> {
  return tilSiden(await (await regionfunksjoner()).sok(sporring, limit));
}
