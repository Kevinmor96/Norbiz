-- Lønn er både en kostnadsdriver for eieren og en forventning for den ansatte.
-- Den mates også inn i lonnsandel_pct, som vi allerede har.
--
-- KILDEVALG. SSB publiserer lønn både per yrke (STYRK-08, tabell 11418) og per
-- næring. Vi henter primært per NÆRING, fordi det ikke krever noen kobling vi
-- må finne opp selv. SSB gir ingen kartlegging fra NACE til yrke.
--
-- Yrkesradene finnes likevel, med yrke_kode satt, for de næringene der ett eller
-- to yrker dominerer og tallet blir mer opplysende enn næringssnittet. Den
-- koblingen er vår vurdering, ikke SSBs, og skal merkes som beregnet.
--
-- SPENNET ER EKTE. statistikkmål-dimensjonen i SSBs lønnstabeller inneholder
-- gjennomsnitt, median og desiler. Fra-til oppgis derfor som 1. og 9. desil —
-- målte tall, ikke anslag. Det er hele poenget: der vi kan gi et spenn fra
-- statistikken, skal vi ikke gjette.
create table industry_wages (
  id                      uuid primary key default gen_random_uuid(),
  industry_id             uuid not null references industries (id) on delete cascade,
  region_id               uuid references regions (id) on delete cascade,
  year                    int  not null,
  nace_level              int  not null check (nace_level between 1 and 5),
  region_level            region_level,

  -- NULL = hele næringen. Satt = ett yrke innenfor næringen.
  yrke_kode               text,
  yrke_navn               text,

  manedslonn_gjennomsnitt int,
  manedslonn_median       int,
  -- Det ærlige fra-til. Begge fra SSBs desiler, ikke beregnet av oss.
  manedslonn_desil1       int,
  manedslonn_desil9       int,
  antall_ansatte          int,

  merknader               jsonb not null default '{}'::jsonb,
  source                  text not null,
  data_quality            data_quality not null,
  coverage                coverage not null,

  -- nulls not distinct: uten det ville Postgres tillatt flere rader med samme
  -- næring og år så lenge region_id eller yrke_kode er NULL, og det er nettopp
  -- nasjonalt-og-hele-næringen-raden vi trenger å holde unik.
  constraint industry_wages_natural_key
    unique nulls not distinct (industry_id, region_id, year, yrke_kode),

  -- Desilene må ligge i riktig rekkefølge, ellers er spennet meningsløst.
  constraint industry_wages_desil_order
    check (manedslonn_desil1 is null or manedslonn_desil9 is null
           or manedslonn_desil9 >= manedslonn_desil1),

  -- Medianen skal ligge innenfor spennet når begge finnes.
  constraint industry_wages_median_within
    check (manedslonn_median is null
           or (manedslonn_desil1 is null or manedslonn_median >= manedslonn_desil1)
           and (manedslonn_desil9 is null or manedslonn_median <= manedslonn_desil9)),

  -- Regionale lønnstall følger samme granularitetsregel som resten.
  constraint industry_wages_regional_grain
    check (region_level is null or region_level = 'land' or nace_level <= 3)
);

create index industry_wages_lookup_idx on industry_wages (industry_id, region_id, year);
create index industry_wages_yrke_idx on industry_wages (yrke_kode) where yrke_kode is not null;

-- RLS må settes av migrasjonen som lager tabellen. 0007 kan ikke kjenne tabeller
-- som kommer senere, og en hardkodet liste der ville stille etterlatt nye
-- tabeller uten policy.
alter table industry_wages enable row level security;
create policy industry_wages_public_read on industry_wages for select to anon, authenticated using (true);
grant select on industry_wages to anon, authenticated;
