create table score_weights (
  delscore text primary key,
  vekt     numeric not null check (vekt > 0)
);

insert into score_weights (delscore, vekt) values
  ('lonnsomhet', 1.0), ('vekst', 1.0), ('risiko', 1.0),
  ('konkurranse', 0.8), ('kapitalbehov', 0.6), ('ettersporsel', 1.0);

create table score_config (
  id          boolean primary key default true check (id),
  min_enheter int not null default 20
);
insert into score_config (id, min_enheter) values (true, 20);

create view score_raw as
select
  s.industry_id, s.region_id, s.year, s.nace_level, s.region_level, s.unit_type,
  s.n_enheter,
  s.driftsmargin_pct as lonnsomhet_raw,
  case when prev.omsetning_total > 0
       then (s.omsetning_total - prev.omsetning_total)::numeric / prev.omsetning_total
  end as vekst_raw,
  case when d.overlevelse_5ar_pct is not null or d.konkurser is not null
       then coalesce(d.overlevelse_5ar_pct, 0)
          - coalesce(d.konkurser::numeric / nullif(s.n_enheter, 0) * 100, 0)
  end as risiko_raw,
  case when pop.innbyggere > 0
       then -(s.n_enheter * 10000.0 / pop.innbyggere)
  end as konkurranse_raw,
  case when s.sysselsatte_total > 0
       then -(s.bruttoinvestering_total::numeric / s.sysselsatte_total)
  end as kapitalbehov_raw,
  (
    select avg(x) from (values
      (case when prev.n_enheter > 0
            then (s.n_enheter - prev.n_enheter)::numeric / prev.n_enheter end),
      (case when prev.sysselsatte_total > 0
            then (s.sysselsatte_total - prev.sysselsatte_total)::numeric / prev.sysselsatte_total end)
    ) as t(x)
  ) as ettersporsel_raw
from industry_stats s
left join industry_stats prev
  on prev.industry_id = s.industry_id and prev.region_id = s.region_id
 and prev.unit_type = s.unit_type and prev.year = s.year - 3
left join industry_demography d
  on d.industry_id = s.industry_id and d.region_id = s.region_id and d.year = s.year
left join region_population pop
  on pop.region_id = s.region_id and pop.year = s.year
cross join score_config cfg
where s.n_enheter >= cfg.min_enheter;

-- Langt format: én rad per delscore. Persentilberegningen skrives da én gang
-- i stedet for seks ganger.
create view score_long as
select
  r.industry_id, r.region_id, r.year, r.nace_level, r.region_level, r.unit_type,
  v.delscore, v.raw
from score_raw r
cross join lateral (values
  ('lonnsomhet',   r.lonnsomhet_raw),
  ('vekst',        r.vekst_raw),
  ('risiko',       r.risiko_raw),
  ('konkurranse',  r.konkurranse_raw),
  ('kapitalbehov', r.kapitalbehov_raw),
  ('ettersporsel', r.ettersporsel_raw)
) as v(delscore, raw);

-- Persentilrangering innenfor peer-gruppen. count(raw) teller kun ikke-NULL,
-- så rader uten datagrunnlag blåser ikke opp nevneren.
create view score_long_pct as
select
  industry_id, region_id, year, nace_level, region_level, unit_type,
  delscore, raw,
  -- Midtrangert persentil: andelen under, pluss halve andelen som ligger likt.
  -- Ren rank() ville gitt alle uavgjorte bunnplassen i stedet for midten.
  case when raw is null then null
       else round(100.0 * ((rank() over wo - 1) + 0.5 * count(raw) over weq)
                  / nullif(count(raw) over wp, 0))::int
  end as pct
from score_long
window
  wo  as (partition by region_id, year, nace_level, unit_type, delscore order by raw),
  wp  as (partition by region_id, year, nace_level, unit_type, delscore),
  weq as (partition by region_id, year, nace_level, unit_type, delscore, raw);

create view industry_scores_computed as
select
  p.industry_id, p.region_id, p.year, p.nace_level, p.region_level, p.unit_type,
  max(p.pct) filter (where p.delscore = 'lonnsomhet')   as score_lonnsomhet,
  max(p.pct) filter (where p.delscore = 'vekst')        as score_vekst,
  max(p.pct) filter (where p.delscore = 'risiko')       as score_risiko,
  max(p.pct) filter (where p.delscore = 'konkurranse')  as score_konkurranse,
  max(p.pct) filter (where p.delscore = 'kapitalbehov') as score_kapitalbehov,
  max(p.pct) filter (where p.delscore = 'ettersporsel') as score_ettersporsel,
  -- Vektet snitt over de delscorene som finnes, med vektene renormalisert.
  round(sum(p.pct * w.vekt) / nullif(sum(w.vekt) filter (where p.pct is not null), 0))::int
    as score_total,
  jsonb_object_agg(
    p.delscore,
    jsonb_build_object('raw', p.raw, 'pct', p.pct, 'vekt', w.vekt)
  ) as forklaring
from score_long_pct p
join score_weights w on w.delscore = p.delscore
group by 1, 2, 3, 4, 5, 6;

-- Materialisert kopi, fylt av compute-scores. Frontend leser denne, ikke viewet.
create table industry_scores (
  industry_id        uuid not null references industries (id) on delete cascade,
  region_id          uuid not null references regions (id) on delete cascade,
  year               int  not null,
  nace_level         int  not null,
  region_level       region_level not null,
  unit_type          unit_type not null,
  score_lonnsomhet   int check (score_lonnsomhet between 0 and 100),
  score_vekst        int check (score_vekst between 0 and 100),
  score_risiko       int check (score_risiko between 0 and 100),
  score_konkurranse  int check (score_konkurranse between 0 and 100),
  score_kapitalbehov int check (score_kapitalbehov between 0 and 100),
  score_ettersporsel int check (score_ettersporsel between 0 and 100),
  score_total        int check (score_total between 0 and 100),
  forklaring         jsonb not null,
  computed_at        timestamptz not null default now(),
  primary key (industry_id, region_id, year, unit_type)
);

create index industry_scores_rank_idx
  on industry_scores (region_id, year, score_total desc);
