-- nace_level og region_level er bevisst denormalisert fra industries/regions.
-- Uten dem kan ikke granularitetsregelen uttrykkes deklarativt, og
-- scoring-viewet må joine for å finne peer-gruppen.
create table industry_stats (
  id                          uuid primary key default gen_random_uuid(),
  industry_id                 uuid not null references industries (id) on delete cascade,
  region_id                   uuid not null references regions (id) on delete cascade,
  year                        int  not null,
  unit_type                   unit_type not null,
  nace_level                  int  not null check (nace_level between 1 and 5),
  region_level                region_level not null,

  n_enheter                   int,
  omsetning_total             bigint,
  omsetning_per_enhet         bigint,
  driftsresultat_total        bigint,
  driftsmargin_pct            numeric(6, 2),
  lonnskostnad_total          bigint,
  lonnsandel_pct              numeric(6, 2),
  sysselsatte_total           int,
  sysselsatte_per_enhet       numeric(10, 2),
  arsverk_per_enhet           numeric(10, 2),
  bearbeidingsverdi_total     bigint,
  verdiskaping_per_sysselsatt bigint,
  bruttoinvestering_total     bigint,

  -- Felt -> mangel_arsak, f.eks. {"driftsmargin_pct": "konfidensielt"}.
  merknader                   jsonb not null default '{}'::jsonb,

  source                      text not null,
  data_quality                data_quality not null,
  coverage                    coverage not null,

  constraint industry_stats_natural_key unique (industry_id, region_id, year, unit_type),

  -- Spec 2.1: SSB gir regionale næringstall kun på 2- og 3-siffer.
  constraint industry_stats_regional_grain
    check (region_level = 'land' or nace_level <= 3)
);

create index industry_stats_lookup_idx
  on industry_stats (industry_id, region_id, year);
create index industry_stats_peer_idx
  on industry_stats (region_id, year, nace_level, unit_type);

-- Overlevelsestall fra foretaksdemografi, konkurser fra egen SSB-statistikk.
-- To kilder inn i én tabell, skilt på source.
create table industry_demography (
  id                    uuid primary key default gen_random_uuid(),
  industry_id           uuid not null references industries (id) on delete cascade,
  region_id             uuid not null references regions (id) on delete cascade,
  year                  int  not null,
  nace_level            int  not null check (nace_level between 1 and 5),
  region_level          region_level not null,

  nyetableringer        int,
  nedleggelser          int,
  konkurser             int,
  overlevelse_1ar_pct   numeric(5, 2),
  overlevelse_3ar_pct   numeric(5, 2),
  overlevelse_5ar_pct   numeric(5, 2),

  merknader             jsonb not null default '{}'::jsonb,

  source                text not null,
  data_quality          data_quality not null,
  coverage              coverage not null,

  constraint industry_demography_natural_key unique (industry_id, region_id, year),
  constraint industry_demography_regional_grain
    check (region_level = 'land' or nace_level <= 3)
);

create index industry_demography_lookup_idx
  on industry_demography (industry_id, region_id, year);
