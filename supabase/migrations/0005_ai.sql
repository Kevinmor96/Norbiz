-- Egen tabell, ikke kolonner i industry_stats: den må kunne reimporteres fra
-- SSB idempotent uten at importen stryker anslagene.
create table industry_estimates (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid references regions (id) on delete cascade,
  metrikk        text not null,

  verdi_num      numeric,
  verdi_tekst    text,
  enhet          text,
  intervall_lav  numeric,
  intervall_hoy  numeric,

  konfidens      konfidens not null,
  begrunnelse    text not null,

  -- Det som skiller et anslag fra en gjetning: hvilke faktiske rader det hviler på.
  basert_pa      jsonb not null,

  model          text not null,
  prompt_version text not null,
  generated_at   timestamptz not null default now(),
  source         text not null,
  data_quality   data_quality not null,

  constraint industry_estimates_natural_key unique (industry_id, region_id, metrikk),
  constraint industry_estimates_must_be_estimate check (data_quality = 'ai_anslag'),
  constraint industry_estimates_basert_pa_nonempty check (jsonb_array_length(basert_pa) > 0),
  constraint industry_estimates_has_value
    check (verdi_num is not null or verdi_tekst is not null or intervall_lav is not null),
  constraint industry_estimates_interval_order
    check (intervall_lav is null or intervall_hoy is null or intervall_hoy >= intervall_lav)
);

create index industry_estimates_lookup_idx on industry_estimates (industry_id, metrikk);

-- Kort, forankret innsikt som vises ved siden av KPI-en den handler om.
create table ai_insights (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid not null references regions (id) on delete cascade,
  year           int,
  type           text not null
    check (type in ('risiko', 'mulighet', 'avvik', 'sammenligning', 'kontekst')),
  tittel         text not null,
  body           text not null,
  alvorlighet    int not null,
  referanser     jsonb not null,
  knyttet_til    text,

  model          text not null,
  prompt_version text not null,
  generated_at   timestamptz not null default now(),
  data_quality   data_quality not null,

  constraint ai_insights_alvorlighet_check check (alvorlighet between 1 and 5),
  constraint ai_insights_referanser_nonempty check (jsonb_array_length(referanser) > 0)
);

create index ai_insights_lookup_idx
  on ai_insights (industry_id, region_id, alvorlighet desc);

-- Den lange, sammenhengende rapporten. ai_insights er det korte laget.
create table ai_reports (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid not null references regions (id) on delete cascade,
  body           text not null,
  generated_at   timestamptz not null default now(),
  model          text not null,
  prompt_version text not null,
  unique (industry_id, region_id, prompt_version)
);
