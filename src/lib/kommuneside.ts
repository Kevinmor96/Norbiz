// Alt kommunesiden trenger, lastet i ett. Hver seksjon får hele svaret som
// `side`, og en seksjon som trenger mer, leser et felt til uten at ruten endres.
//
// Alt hentes gjennom lese-API-et i src/lib/data (samme former som
// Supabase-RPC-ene). Denne fila regner ingenting selv utover å finne kommunen
// fra sluggen og å sette sammen svarene. Til slutt går svaret gjennom
// `tilSiden` (src/lib/nyttelast.ts): «[verifiser]» skal ikke stå i det siden
// viser, og like objekter skal stå der én gang.
//
// Siden kommer til nettleseren i to deler (src/routes/kommune.$slug.tsx):
//
// - `Lettside`: det som må være levende med én gang (topplinjen,
//   tegnforklaringen, forhåndsvarselet, sidefoten). Den serialiseres inn i
//   HTML-en og er noen få kilobyte.
// - Hele `Kommuneside`: seksjonene rendres fra den på serveren, men den står
//   ikke i HTML-en. Nettleseren henter den som JSON etter at siden er vist
//   (src/lib/data/hent.ts), og hydrerer seksjonene da. Til det skjer, står
//   serverens HTML urørt. For Tromsø er det forskjellen på omtrent 440 kB og
//   20 kB serialisert tilstand.
//
// Modulen er for serveren: den laster datalaget.

import type {
  Beslutningskjede,
  Eierskap,
  Endringer,
  Grader,
  Hulliste,
  Kommuneliste,
  KommuneOversikt,
  Nettverk,
  Organkart,
  OrganProfil,
  SegmentOrganer,
} from "@/lib/data";
import { tilSiden } from "@/lib/nyttelast";
import type { Terreng } from "@/lib/terreng";
import { hentTerreng } from "@/lib/terreng-fil";

/** Det siden bruker av profilen til kommuneorganet: organet og kommunens egne nøkkeltall. */
export type Kommuneprofil = Pick<OrganProfil, "organ" | "nokkeltall">;

export interface Kommuneside {
  /** Kommunen: navn, nummer, fylke, slug og datoen datasettet ble sammenstilt. */
  kommune: KommuneOversikt["kommune"];
  oversikt: KommuneOversikt;
  /** Påstandene i kommunens omfang etter grad og type. Til forhåndsvarselet. */
  grader: Grader;
  /**
   * Kommuneorganet (Tromsø kommune som juridisk enhet): org.nr. og kommunens
   * egne nøkkeltall (merforbruk, underskudd). `null` når datasettet ikke har et
   * kommuneorgan. Resten av profilen henter organskuffen selv.
   */
  kommuneprofil: Kommuneprofil | null;
  /** Én kjede per prosess, i samme rekkefølge som `oversikt.prosesser`. */
  kjeder: Beslutningskjede[];
  organkart: Organkart;
  eierskap: Eierskap;
  nettverk: Nettverk;
  endringer: Endringer;
  /** Organene per segment, i samme rekkefølge som `oversikt.segmenter`. */
  segmenter: SegmentOrganer[];
  hull: Hulliste;
  /** Alle kommuner med datasett. Til kartbladoversikten i «Neste kommune». */
  kommuner: Kommuneliste;
  /** Kartbladets terreng uten stiene, eller `null` når kommunen ikke har terrengfil. */
  terreng: Terreng | null;
}

/** Det av kommunesiden som serialiseres inn i HTML-en. Se øverst i fila. */
export interface Lettside {
  kommune: Kommuneside["kommune"];
  oversikt: KommuneOversikt;
  grader: Grader;
  /** Kredittlinjen for terrenget, til sidefoten. */
  terrengKreditt: string | null;
}

// `lettside(side)` står i src/lib/lettside.ts, fordi nettleseren trenger den.

const datalag = async () => (await import("@/lib/data")).data;

/** Kommunen med denne sluggen, eller `null`. Sluggen er filnavnet til datasettet. */
export async function finnKommune(slug: string) {
  const data = await datalag();
  const liste = await data.kommuner();
  return liste.find((k) => k.slug === slug) ?? null;
}

/** Hele kommunesiden, eller `null` når sluggen ikke er en kommune med datasett. */
export async function lastKommuneside(slug: string): Promise<Kommuneside | null> {
  const data = await datalag();
  const kommuner = await data.kommuner();
  const kommune = kommuner.find((k) => k.slug === slug);
  if (!kommune) return null;
  const nr = kommune.kommunenr;

  const oversikt = await data.kommune_oversikt(nr);
  if (!oversikt) return null;

  const [
    grader,
    kommuneprofil,
    kjeder,
    organkart,
    eierskap,
    nettverk,
    endringer,
    segmenter,
    hull,
    terreng,
  ] = await Promise.all([
    data.kommune_grader(nr),
    oversikt.kommuneorgan ? data.organ_profil(oversikt.kommuneorgan.key) : null,
    Promise.all(oversikt.prosesser.map((p) => data.beslutningskjede(nr, p.key))),
    data.organkart(nr),
    data.eierskap(nr),
    data.nettverk(nr),
    data.endringer(nr),
    Promise.all(oversikt.segmenter.map((s) => data.organer_for_segment(s.kode, nr))),
    data.hull(nr),
    hentTerreng(nr),
  ]);

  return tilSiden({
    kommune: oversikt.kommune,
    oversikt,
    grader: grader!,
    kommuneprofil: kommuneprofil
      ? { organ: kommuneprofil.organ, nokkeltall: kommuneprofil.nokkeltall }
      : null,
    kjeder: kjeder.filter((k): k is Beslutningskjede => k !== null),
    organkart: organkart ?? { grupper: [] },
    eierskap: eierskap ?? { eier: null, selskaper: [], utbytte: [] },
    nettverk: nettverk ?? { noder: [], kanter: [], personer: [] },
    endringer: endringer ?? { skjedd: [], ikke_skjedd: [] },
    segmenter: segmenter.filter((s): s is SegmentOrganer => s !== null),
    hull: hull ?? [],
    kommuner,
    terreng,
  });
}
