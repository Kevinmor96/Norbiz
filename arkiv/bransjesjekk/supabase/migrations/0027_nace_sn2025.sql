-- SN2025-kodeverket, næringsstandarden Brreg bruker.
--
-- Tabellen finnes fordi feilen som utløste den ikke var å bruke feil kode, men å
-- ikke kunne SE at koden var feil. Sportsbutikk fikk brreg-prefiks 47.64 fordi
-- 47.641 er sportsutstyr i SN2007. I SN2025 er 47.64 «Detaljhandel med spill og
-- leker», og topplisten fyltes med Lekekassen, Sprell og Extra Leker. Prefikset
-- ga 820 treff, så ingenting varslet — verifiseringen hadde tellet treff uten å
-- lese hva koden HETER.
--
-- Fire flere kategorier hadde samme feil, funnet først da titlene lå i basen:
--   optiker         47.78 «Annen detaljhandel med andre nye varer» (samlekode)
--   maler-overflate 43.3  «Ferdiggjøring av bygninger» — 8 av 15 var snekkere
--   blomster-hage   47.76 dro inn kjæledyrbutikker
--   opplevelser     49.32 bussturtransport dominerte lista
--
-- Med kodeverket i basen kan hver kategoris prefiks slås opp mot sin offisielle
-- tittel, og `tests/categories.test.ts` holder de to sammen. Å telle treff er
-- ikke nok.
--
-- Kilde: SSB klassifikasjon 6, versjon 3218 (Næringsgruppering SN 2025).
-- Livebasen har alle 1 785 kodene, hentet fra Klass-API-et. `kategorier.sql`
-- legger inn de radene testene trenger, slik at sjekken virker uten nett.
create table nace_sn2025 (
  code   text primary key,
  navn   text not null,
  nivaa  int  not null,
  source text not null default 'ssb:klass6-v3218'
);

create index nace_sn2025_nivaa_idx on nace_sn2025 (nivaa);

alter table nace_sn2025 enable row level security;
create policy nace_sn2025_read on nace_sn2025 for select using (true);
grant select on nace_sn2025 to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on nace_sn2025 from anon, authenticated;

comment on table nace_sn2025 is
  'SN2025-kodeverket slik Brreg bruker det. Brukes til å verifisere at et brreg-prefiks i category_members faktisk betyr den bransjen kategorien påstår.';
