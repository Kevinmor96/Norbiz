-- Nasjonale statistikkrader: NACE 2-5, begge enhetstyper.
--
-- Størrelsesfaktoren sf er skjev med vilje. Uten den er alle næringer på samme
-- nivå like store, og da finnes det ingen små celler noe sted — heller ikke
-- regionalt, der de skal oppstå. Virkeligheten har noen få store næringer og
-- mange små, og det er kombinasjonen liten næring x lite fylke som gjør at SSB
-- undertrykker en celle.
insert into industry_stats
  (industry_id, region_id, year, unit_type, nace_level, region_level, n_enheter,
   omsetning_total, omsetning_per_enhet, driftsresultat_total, driftsmargin_pct,
   lonnskostnad_total, lonnsandel_pct, sysselsatte_total, sysselsatte_per_enhet,
   arsverk_per_enhet, bearbeidingsverdi_total, verdiskaping_per_sysselsatt,
   bruttoinvestering_total, merknader, source, data_quality, coverage)
select
  i.id, r.id, y, u.t, i.nace_level, 'land', s.n,
  s.oms, round(s.oms / s.n), round(s.oms * s.margin / 100), round(s.margin, 2),
  round(s.oms * s.lonn / 100), round(s.lonn, 2), s.syss, round(s.syss::numeric / s.n, 2),
  round(s.syss::numeric / s.n * 0.86, 2),
  case when s.supp then null else round(s.oms * 0.4) end,
  case when s.supp then null else round(s.oms * 0.4 / s.syss) end,
  round(s.syss * s.inv),
  case when s.supp then '{"bearbeidingsverdi_total":"konfidensielt"}'::jsonb else '{}'::jsonb end,
  'seed:12910', 'mock', 'alle'
from industries i
join _src src on src.code = i.nace_code
join _band b on b.profile = src.profile
join regions r on r.level = 'land'
cross join generate_series(2017, 2023) y
cross join (values ('foretak'::unit_type), ('virksomhet'::unit_type)) u(t)
cross join lateral (
  select
    greatest(12, round(
      (case i.nace_level when 2 then 9000 when 3 then 2400 else 620 end)
      * (0.18 + power(_noise('sz' || i.nace_code), 1.8) * 1.9)
      * power(1 + (-0.01 + _noise('d' || i.nace_code) * 0.065), y - 2017)
      * (0.965 + _noise('j' || i.nace_code || y) * 0.07)
      * case when u.t = 'virksomhet' then 1.18 else 1.0 end
    ))::int as n,
    b.m_lo + (b.m_hi - b.m_lo) * _noise('m' || i.nace_code) as margin,
    b.l_lo + (b.l_hi - b.l_lo) * _noise('l' || i.nace_code) as lonn,
    b.i_lo + (b.i_hi - b.i_lo) * _noise('i' || i.nace_code) as inv
) base
cross join lateral (
  select base.n, base.margin, base.lonn, base.inv,
    round(base.n * (1.4e6 + _noise('o' || i.nace_code) * 7.6e6)
          * (0.95 + _noise('oj' || i.nace_code || y) * 0.1)) as oms,
    round(base.n * (1.8 + _noise('s' || i.nace_code) * 5.7))::int as syss,
    base.n < 40 and _noise('sup' || i.nace_code || y || u.t) < 0.45 as supp
) s;

-- Regionale rader: kun NACE 2-3, kun virksomhet, og INGEN driftsmargin.
-- Fylkesandelen er folketallsandelen, så cellene blir små der fylket er lite.
-- Andelene summerer omtrent til 1, slik at regionalt totalt ligger nær
-- nasjonalt for virksomhet.
insert into industry_stats
  (industry_id, region_id, year, unit_type, nace_level, region_level, n_enheter,
   omsetning_total, omsetning_per_enhet, driftsresultat_total, driftsmargin_pct,
   lonnskostnad_total, lonnsandel_pct, sysselsatte_total, sysselsatte_per_enhet,
   arsverk_per_enhet, bearbeidingsverdi_total, verdiskaping_per_sysselsatt,
   bruttoinvestering_total, merknader, source, data_quality, coverage)
select
  i.id, r.id, y, 'virksomhet', i.nace_level, 'fylke', s.n,
  s.oms, round(s.oms / s.n),
  null, null,
  round(s.oms * s.lonn / 100), round(s.lonn, 2), s.syss, round(s.syss::numeric / s.n, 2),
  round(s.syss::numeric / s.n * 0.86, 2),
  case when s.supp then null else round(s.oms * 0.4) end,
  case when s.supp then null else round(s.oms * 0.4 / s.syss) end,
  round(s.syss * s.inv),
  case when s.supp then '{"bearbeidingsverdi_total":"konfidensielt"}'::jsonb else '{}'::jsonb end,
  'seed:12936', 'mock', 'alle'
from industries i
join _src src on src.code = i.nace_code
join _band b on b.profile = src.profile
cross join generate_series(2017, 2023) y
join regions r on r.level = 'fylke'
  and r.valid_from_year <= y and coalesce(r.valid_to_year, 9999) >= y
join _reg g on g.code = r.code and g.vfrom = r.valid_from_year
cross join lateral (
  select
    round(
      (case i.nace_level when 2 then 9000 else 2400 end) * 1.18
      * (0.18 + power(_noise('sz' || i.nace_code), 1.8) * 1.9)
      * power(1 + (-0.01 + _noise('d' || i.nace_code) * 0.065), y - 2017)
      * (g.pop::numeric / 5300000)
      * (0.9 + _noise('wj' || r.code || y) * 0.2)
    )::int as n,
    b.l_lo + (b.l_hi - b.l_lo) * _noise('l' || i.nace_code) as lonn,
    b.i_lo + (b.i_hi - b.i_lo) * _noise('i' || i.nace_code) as inv
) base
cross join lateral (
  select base.n, base.lonn, base.inv,
    round(base.n * (1.4e6 + _noise('o' || i.nace_code) * 7.6e6)) as oms,
    greatest(1, round(base.n * (1.8 + _noise('s' || i.nace_code) * 5.7))::int) as syss,
    base.n < 40 and _noise('sup' || i.nace_code || y || r.code) < 0.45 as supp
) s
where i.nace_level <= 3 and s.n >= 5;
