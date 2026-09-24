-- Den delen av Supabase-miljøet migrasjonene lener seg på. Kjøres bare i
-- tester. På ekte Supabase finnes alt dette fra før.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Supabase legger utvidelser her.
create schema if not exists extensions;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase gir anon og authenticated alle rettigheter på nye tabeller,
-- sekvenser og funksjoner i public (default privileges). Stubben gjør det
-- samme, så testene beviser at migrasjonene faktisk tar rettighetene tilbake,
-- og ikke bare at PGlite var strengere enn Supabase i utgangspunktet.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
