// Lesekontrakten over Supabase-RPC-ene.
//
// Hver metode er ett kall på en SQL-funksjon med samme navn. Funksjonene
// kjører med kallerens rettigheter (security invoker), så `anon` ser bare det
// RLS og kolonnerettighetene slipper gjennom. Parameterne heter `p_...` i SQL
// for å ikke kollidere med kolonnenavn.
//
// `tests/kontrakt.test.ts` kjører denne mot PGlite med en liten klient som
// oversetter `rpc(...)` til `select funksjon(...)`, og krever samme svar som
// `lokal.ts`.

import type { Datalag } from "./kontrakt";

/**
 * Det vi bruker av supabase-js. Holdt smalt, så en testklient kan oppfylle
 * det, og så vi slipper å generere databasetyper for ti funksjoner.
 */
export interface RpcKlient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export function lagSupabaseDatalag(klient: RpcKlient): Datalag {
  async function kall<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await klient.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
  return {
    kommuner: () => kall("kommuner"),
    kommune_oversikt: (kommunenr) => kall("kommune_oversikt", { p_kommunenr: kommunenr }),
    beslutningskjede: (kommunenr, prosess_key) =>
      kall("beslutningskjede", { p_kommunenr: kommunenr, p_prosess_key: prosess_key }),
    organkart: (kommunenr) => kall("organkart", { p_kommunenr: kommunenr }),
    organ_profil: (org_key) => kall("organ_profil", { p_org_key: org_key }),
    eierskap: (kommunenr) => kall("eierskap", { p_kommunenr: kommunenr }),
    nettverk: (kommunenr) => kall("nettverk", { p_kommunenr: kommunenr }),
    endringer: (kommunenr) => kall("endringer", { p_kommunenr: kommunenr }),
    organer_for_segment: (segment_kode, kommunenr) =>
      kall("organer_for_segment", { p_segment_kode: segment_kode, p_kommunenr: kommunenr }),
    hull: (kommunenr) => kall("hull", { p_kommunenr: kommunenr }),
    kommune_grader: (kommunenr) => kall("kommune_grader", { p_kommunenr: kommunenr }),
    region_oversikt: () => kall("region_oversikt"),
    fylke_oversikt: (fylkesnr) => kall("fylke_oversikt", { p_fylkesnr: fylkesnr }),
    // NFC her, fordi basen ikke normaliserer: «á» som a + aksent ville ellers
    // brettes til «a » i basen og til «a» lokalt.
    sok: (sporring, limit) =>
      kall("sok", { p_sporring: sporring.normalize("NFC"), p_limit: Math.trunc(limit) }),
  };
}
