-- Ytelsesfunn fra Supabase-advisoren etter at ekte data kom inn.
--
-- 1) Fremmednøkler uten dekkende indeks. region_id-koblingene brukes av
--    aggregatfunksjonene og av kaskadene ved re-seed; uten indeks blir hver
--    delete på regions en sekvensiell skanning av barnetabellene.
create index if not exists ai_insights_region_id_idx on ai_insights (region_id);
create index if not exists ai_reports_region_id_idx on ai_reports (region_id);
create index if not exists favorites_industry_id_idx on favorites (industry_id);
create index if not exists favorites_region_id_idx on favorites (region_id);
create index if not exists industry_demography_region_id_idx on industry_demography (region_id);
create index if not exists industry_estimates_region_id_idx on industry_estimates (region_id);
create index if not exists industry_wages_region_id_idx on industry_wages (region_id);

-- 2) auth.uid() i RLS-policyer evalueres per rad. Pakket i (select ...) blir
--    den en init-plan som kjøres én gang per spørring. Samme semantikk.
drop policy favorites_select_own on favorites;
drop policy favorites_insert_own on favorites;
drop policy favorites_delete_own on favorites;

create policy favorites_select_own on favorites
  for select using ((select auth.uid()) = user_id);
create policy favorites_insert_own on favorites
  for insert with check ((select auth.uid()) = user_id);
create policy favorites_delete_own on favorites
  for delete using ((select auth.uid()) = user_id);
