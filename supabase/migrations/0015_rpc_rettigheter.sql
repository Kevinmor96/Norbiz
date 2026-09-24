-- Hvem kan kalle hva.
--
-- Postgres gir EXECUTE til PUBLIC på nye funksjoner, og Supabase gir det i
-- tillegg til anon og authenticated. Vi tar det tilbake og gir eksplisitt:
--
--   public.*   RPC-ene. anon og authenticated kan kalle dem.
--   intern.*   Byggesteinene. RPC-ene er security invoker og kaller dem med
--              kallerens rettigheter, så anon må ha EXECUTE og USAGE på
--              schemaet. PostgREST eksponerer ikke `intern`, så de er ikke
--              en del av API-et. service_role trenger dem også: check-
--              constraints og genererte kolonner kaller dem når pipelinen
--              skriver, og Postgres sjekker EXECUTE for den som skriver.
--
-- Ingen funksjon er security definer. Å kunne kalle en funksjon gir derfor
-- ingen tilgang utover det tabellrettighetene og RLS allerede gir.

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema intern from public, anon, authenticated;

grant usage on schema intern to anon, authenticated, service_role;
grant execute on all functions in schema intern to anon, authenticated, service_role;

grant execute on function
  public.kommuner(),
  public.kommune_oversikt(text),
  public.beslutningskjede(text, text),
  public.organkart(text),
  public.organ_profil(text),
  public.eierskap(text),
  public.nettverk(text),
  public.endringer(text),
  public.organer_for_segment(text, text),
  public.hull(text)
to anon, authenticated, service_role;
