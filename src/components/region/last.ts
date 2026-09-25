// Det regionsidene trenger, regnet ferdig på serveren: forsiden (hele
// Nord-Norge), fylkessidene og søket.
//
// Alt tallarbeid skjer i datalaget (`region_oversikt`, `fylke_oversikt`,
// `sok`). Denne fila setter bare sammen: dekningsklassen
// per kommune og fylkets organer sortert etter hva de er. Til slutt går svaret
// gjennom `tilSiden`, så «[verifiser]» ikke står i HTML-en og like objekter
// står der én gang.
//
// Fila kjøres bare på serveren: rutene kaller den gjennom serverfunksjonene i
// hent.ts. Datalaget lastes likevel med dynamisk import, som i kommuneside.ts,
// så det aldri havner i en bunt nettleseren kan laste.

import type { Datalag, FylkeOrgan, RegionKommune, RegionOversikt, Sokeresultat } from "@/lib/data";
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
  const kommuner: KommuneIRegion[] = o.kommuner.map((k) => ({
    kommunenr: k.kommunenr,
    navn: k.navn,
    navn_offisielt: k.navn_offisielt,
    slug: k.slug,
    fylkesnr: k.fylkesnr,
    folketall: k.folketall,
    samisk_forvaltningsomrade: k.samisk_forvaltningsomrade,
    datasett: k.datasett ? { organer: k.datasett.organer, roller: k.datasett.roller } : null,
    klasse: klasseFor(k),
  }));
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
    region: { ...o.region, klasser },
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

  // Fylkets egne organer. Kommunens organer (nivå kommune) står på kommunesiden,
  // selv om de også har fylkesnummeret (Tromsø kommunestyre har begge). Et organ
  // på fylkesnivå beholdes selv om registeret har gitt det kommunenummeret til
  // adressen sin (fylkeskommunen har forretningsadresse i en kommune). Andre
  // organer med kommunenummer, som et Nav-kontor, hører til kommunen.
  const egne = fo.organer.filter(
    (x) => x.nivaa !== "kommune" && (x.kommunenr === null || x.nivaa === "fylke"),
  );
  const av = (...typer: string[]) => egne.filter((x) => typer.includes(x.organtype));
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
    statsforvalter: merk(
      statsforvaltere.filter((x) => !(x.overordnet && nokler.has(x.overordnet))),
    ),
    storting: merk(av("lovgivende")),
    andre: [],
    utenfor: [],
    storste: fo.storste,
  };
  merk(statsforvaltere);
  const rest = egne.filter((x) => !plassert.has(x.key));
  side.andre = rest.filter((x) => x.nivaa === "fylke");
  side.utenfor = rest.filter((x) => x.nivaa !== "fylke");
  return tilSiden(side);
}

/** Søket i regionen: kommuner, organer og personer i roller. */
export async function sokIRegion(sporring: string, limit: number): Promise<Sokeresultat> {
  return tilSiden(await (await regionfunksjoner()).sok(sporring, limit));
}
