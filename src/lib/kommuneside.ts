// Alt kommunesiden trenger, lastet i ett. Ruten /kommune/$slug kaller
// `lastKommuneside` i loaderen sin, og hver seksjon får hele svaret som
// `side`. Da er ruten ferdig: en seksjon som trenger mer, leser et felt til,
// uten at ruten endres.
//
// Alt hentes gjennom lese-API-et i src/lib/data (samme former som
// Supabase-RPC-ene). Denne fila regner ingenting selv utover å finne kommunen
// fra sluggen og å sette sammen svarene.

import { data } from "@/lib/data";
import type {
  Beslutningskjede,
  Eierskap,
  Endringer,
  Hulliste,
  Kommuneliste,
  KommuneOversikt,
  Nettverk,
  Organkart,
  OrganProfil,
  SegmentOrganer,
} from "@/lib/data";
import { hentTerreng, type Terreng } from "@/lib/terreng";

export interface Kommuneside {
  /** Kommunen: navn, nummer, fylke, slug og datoen datasettet ble sammenstilt. */
  kommune: KommuneOversikt["kommune"];
  oversikt: KommuneOversikt;
  /**
   * Profilen til kommuneorganet (Tromsø kommune som juridisk enhet): org.nr.,
   * kommunens egne nøkkeltall (merforbruk, underskudd) og relasjonene.
   * `null` når datasettet ikke har et kommuneorgan.
   */
  kommuneprofil: OrganProfil | null;
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
  /** Kartbladets terreng, eller `null` når kommunen ikke har terrengfil (reservevarianten). */
  terreng: Terreng | null;
}

/** Kommunen med denne sluggen, eller `null`. Sluggen er filnavnet til datasettet. */
export async function finnKommune(slug: string) {
  const liste = await data.kommuner();
  return liste.find((k) => k.slug === slug) ?? null;
}

/** Hele kommunesiden, eller `null` når sluggen ikke er en kommune med datasett. */
export async function lastKommuneside(slug: string): Promise<Kommuneside | null> {
  const kommuner = await data.kommuner();
  const kommune = kommuner.find((k) => k.slug === slug);
  if (!kommune) return null;
  const nr = kommune.kommunenr;

  const oversikt = await data.kommune_oversikt(nr);
  if (!oversikt) return null;

  const [kommuneprofil, kjeder, organkart, eierskap, nettverk, endringer, segmenter, hull, terreng] =
    await Promise.all([
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

  return {
    kommune: oversikt.kommune,
    oversikt,
    kommuneprofil,
    kjeder: kjeder.filter((k): k is Beslutningskjede => k !== null),
    organkart: organkart ?? { grupper: [] },
    eierskap: eierskap ?? { eier: null, selskaper: [], utbytte: [] },
    nettverk: nettverk ?? { noder: [], kanter: [], personer: [] },
    endringer: endringer ?? { skjedd: [], ikke_skjedd: [] },
    segmenter: segmenter.filter((s): s is SegmentOrganer => s !== null),
    hull: hull ?? [],
    kommuner,
    terreng,
  };
}
