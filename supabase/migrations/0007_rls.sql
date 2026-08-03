-- Næringssidene er offentlige. Alt statistisk innhold leses av anon.
create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  industry_id uuid not null references industries (id) on delete cascade,
  region_id   uuid not null references regions (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, industry_id, region_id)
);

alter table favorites enable row level security;

create policy favorites_select_own on favorites
  for select using (auth.uid() = user_id);
create policy favorites_insert_own on favorites
  for insert with check (auth.uid() = user_id);
create policy favorites_delete_own on favorites
  for delete using (auth.uid() = user_id);

-- Offentlig lesetilgang på alt som ikke er brukerdata.
do $$
declare t text;
begin
  foreach t in array array[
    'industries','regions','region_population','industry_stats',
    'industry_demography','companies','industry_estimates','ai_insights',
    'ai_reports','industry_scores','score_weights','score_config'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)',
                   t || '_public_read', t);
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, delete on favorites to authenticated;
