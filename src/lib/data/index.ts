// Datalaget siden bruker. Importer herfra, ikke fra lokal.ts eller supabase.ts.
//
//   import { data } from '@/lib/data';
//   const oversikt = await data.kommune_oversikt('5501');
//
// Nå leser `data` kommunedatasettene i `src/data/` direkte, latt: bare filene
// et svar trenger (datasett.ts, lat.ts og indeksen i indeks.ts). Modulen er for
// serveren. Komponenter i nettleseren henter gjennom src/lib/data/hent.ts.
//
// Slik bytter vi til Supabase når prosjektet finnes og seed-en er lastet:
//
//   import { createClient } from '@supabase/supabase-js';
//   import { lagSupabaseDatalag } from './supabase';
//
//   const klient = createClient(
//     import.meta.env.VITE_SUPABASE_URL,
//     import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
//   );
//   export const data: Datalag = lagSupabaseDatalag(klient);
//
// Ingenting annet i siden skal endres. Formene er de samme, og
// `tests/kontrakt.test.ts` holder dem like. Bruk den offentlige nøkkelen
// (anon/publishable). Personvernet ligger i basens RLS og
// kolonnerettigheter, og de gjelder bare når siden ikke bruker service-nøkkelen.

import { lokal } from "./datasett";
import type { Datalag } from "./kontrakt";

export const data: Datalag = lokal;

export * from "./kontrakt";
export { lagSupabaseDatalag, type RpcKlient } from "./supabase";
