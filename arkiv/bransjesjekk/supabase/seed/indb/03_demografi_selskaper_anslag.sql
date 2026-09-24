-- Demografi: nyetableringer, nedleggelser, konkurser, overlevelse.
insert into industry_demography
  (industry_id, region_id, year, nace_level, region_level, nyetableringer,
   nedleggelser, konkurser, overlevelse_1ar_pct, overlevelse_3ar_pct,
   overlevelse_5ar_pct, merknader, source, data_quality, coverage)
-- Støyen må såes på NATURLIGE nøkler, ikke på st.id. id er en gen_random_uuid,
-- så en nøkkel bygget av den gir nye tall hver kjøring — og demografien mates
-- inn i risikodelscoren, så hele scoretabellen ville flyttet seg mellom kjøringer.
select
  st.industry_id, st.region_id, st.year, st.nace_level, st.region_level,
  round(st.n_enheter * (0.06 + _noise('ny' || k.nk) * 0.10))::int,
  round(st.n_enheter * (0.04 + _noise('ned' || k.nk) * 0.08))::int,
  round(st.n_enheter * (b.k_lo + (b.k_hi - b.k_lo) * _noise('konk' || k.nk)))::int,
  round(least(100, b.o_lo + (b.o_hi - b.o_lo) * _noise('o1' || k.nk) + 32), 2),
  round(least(100, b.o_lo + (b.o_hi - b.o_lo) * _noise('o3' || k.nk) + 14), 2),
  round(b.o_lo + (b.o_hi - b.o_lo) * _noise('o5' || k.nk), 2),
  '{}'::jsonb, 'seed:foretaksdemografi', 'mock', 'alle'
from industry_stats st
join industries i on i.id = st.industry_id
join regions r on r.id = st.region_id
join _src src on src.code = i.nace_code
join _band b on b.profile = src.profile
cross join lateral (
  select i.nace_code || '|' || r.code || '|' || r.valid_from_year || '|' || st.year as nk
) k
-- Én demografirad per (næring, region, år): velg foretak-raden nasjonalt.
where st.unit_type = (case when st.region_level = 'land' then 'foretak' else 'virksomhet' end)::unit_type;

-- Selskaper: kun siste regnskapsår, og ENK uten regnskapstall.
insert into companies
  (org_nr, navn, nace_code, kommune_code, organisasjonsform, ansatte,
   omsetning, driftsresultat, egenkapital, regnskapsar, source, data_quality)
select
  (800000000 + n * 641 + (abs(hashtext('org' || n)) % 600))::text,
  initcap(split_part(k.navn, ' ', 1)) || ' ' || lower(i.common_name) || ' ' || f.suffix || ' ' || f.form,
  i.nace_code, k.kode, f.form,
  round(power(_noise('ans' || n), 0.8) * 45)::int,
  case when f.files then round(4e5 + _noise('oms' || n) * 8.96e7) end,
  case when f.files then round((4e5 + _noise('oms' || n) * 8.96e7) * (-0.08 + _noise('dr' || n) * 0.30)) end,
  case when f.files then round((4e5 + _noise('oms' || n) * 8.96e7) * (0.05 + _noise('ek' || n) * 0.40)) end,
  case when f.files then 2023 end,
  'seed:brreg', 'mock'
from generate_series(1, 300) n
cross join lateral (
  select nace_code, common_name from industries
  where nace_level = 5 order by _noise('pick' || n || nace_code) limit 1
) i
cross join lateral (
  select * from (values
    ('0301','Oslo'),('1103','Stavanger'),('4601','Bergen'),('5001','Trondheim'),
    ('3201','Bærum'),('1806','Narvik'),('1108','Sandnes'),('3801','Horten'),
    ('4204','Kristiansand'),('1507','Ålesund')
  ) as t(kode, navn) order by _noise('kom' || n) limit 1
) k
cross join lateral (
  select form, suffix, form in ('AS','ASA','NUF','SA') as files from (values
    ('AS','gruppen'),('AS','partner'),('AS','service'),('AS','senter'),('AS','huset'),
    ('ENK','verksted'),('ENK','byrået'),('ENK','kompaniet'),
    ('NUF','service'),('SA','laget')
  ) as t(form, suffix) order by _noise('form' || n) limit 1
) f;

-- Anslag: spenn med konfidens, aldri ett presist tall. Se spec 2.18.
insert into industry_estimates
  (industry_id, metrikk, intervall_lav, intervall_hoy, enhet, konfidens,
   begrunnelse, basert_pa, model, prompt_version, source, data_quality)
select i.id, m.metrikk,
  round(m.lo * (0.85 + _noise('el' || i.nace_code || m.metrikk) * 0.3)),
  round(m.hi * (0.85 + _noise('eh' || i.nace_code || m.metrikk) * 0.3)),
  m.enhet,
  (array['lav','middels','middels','hoy'])[1 + (abs(hashtext('kf' || i.nace_code || m.metrikk)) % 4)]::konfidens,
  m.hvorfor,
  jsonb_build_array(jsonb_build_object('table','industry_stats','nace_code',i.nace_code,'year',2023)),
  'seed', 'v0', 'seed:ai', 'ai_anslag'
from industries i
join _src src on src.code = i.nace_code
cross join lateral (
  select * from (values
    ('etableringskapital', 'NOK',
      case src.profile when 'servering' then 400000 when 'varehandel' then 350000
        when 'bygg' then 250000 when 'tjenesteyting' then 150000
        when 'radgivning' then 50000 else 300000 end,
      case src.profile when 'servering' then 1400000 when 'varehandel' then 1200000
        when 'bygg' then 900000 when 'tjenesteyting' then 600000
        when 'radgivning' then 250000 else 1500000 end,
      'Utstyr, lokaler og drift fram til positiv kontantstrøm.'),
    ('tid_til_lonnsomhet', 'mnd',
      case src.profile when 'servering' then 12 when 'radgivning' then 3 else 6 end,
      case src.profile when 'servering' then 30 when 'radgivning' then 10 else 20 end,
      'Typisk tid før driften bærer seg, gitt marginbåndet i næringen.'),
    ('sesongvariasjon', 'pct',
      case src.profile when 'servering' then 25 when 'radgivning' then 5 else 8 end,
      case src.profile when 'servering' then 55 when 'radgivning' then 15 else 40 end,
      'Spredning mellom sterkeste og svakeste kvartal.')
  ) as t(metrikk, enhet, lo, hi, hvorfor)
) m
where i.nace_level = 5;
