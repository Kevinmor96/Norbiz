-- Simulerer den delen av Supabase-miljøet migrasjonene lener seg på.
-- Kjøres kun i tester. På ekte Supabase finnes alt dette fra før.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;

-- Ekte Supabase gir disse rollene tilgang til auth-schemaet. Uten dem virker
-- RLS-policyene likevel — policy-uttrykk evalueres med tabelleierens
-- rettigheter — men et direkte kall på auth.uid() fra en test som har byttet
-- rolle feiler med "permission denied for schema auth". Verifisert i PGlite.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
