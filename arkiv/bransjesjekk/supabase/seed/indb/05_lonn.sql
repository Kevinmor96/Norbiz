-- Lønn. Tabellen fikk skjema i migrasjon 0009, men ingen seed — verken her
-- eller i den kanoniske generatoren. Uten rader ville lønnsseksjonen i frontend
-- stått tom, og regelen om at spennet er MÅLT og ikke anslått ville aldri blitt
-- prøvd i praksis.
--
-- To ting skal denne seed-en tvinge frontend til å håndtere:
--
--   1. Lønnsserien er lengre og ferskere enn strukturstatistikken: 2015-2025 mot
--      2017-2023. De to seriene skal ikke se ut som samme periode, så her finnes
--      det lønnstall for år uten noe annet tall i basen.
--   2. Fordi serien går til 2025, er den også den eneste som treffer
--      fylkesårgangen fra 2024. Kartet må da laste 15 fylker, ikke 11.

-- Nasjonalt, hele næringen: én rad per næring og år, alle NACE-nivåer.
insert into industry_wages
  (industry_id, region_id, year, nace_level, region_level, yrke_kode, yrke_navn,
   manedslonn_gjennomsnitt, manedslonn_median, manedslonn_kvartil_nedre, manedslonn_kvartil_ovre,
   antall_ansatte, merknader, source, data_quality, coverage)
select
  i.id, r.id, y, i.nace_level, 'land', null, null,
  w.snitt, w.median, w.d1, w.d9, w.ansatte,
  '{}'::jsonb, 'seed:11418', 'mock', 'alle'
from industries i
join _src src on src.code = i.nace_code
join regions r on r.level = 'land'
cross join generate_series(2015, 2025) y
cross join lateral (
  select
    -- Lønnsnivået følger næringsprofilen: rådgivning og helse over servering.
    round(base * 1.06)::int as snitt,
    base::int                as median,
    round(base * (0.63 + _noise('wd1' || i.nace_code) * 0.09))::int as d1,
    round(base * (1.48 + _noise('wd9' || i.nace_code) * 0.34))::int as d9,
    round((case i.nace_level when 2 then 42000 when 3 then 11000 else 2600 end)
          * (0.4 + _noise('wa' || i.nace_code)))::int as ansatte
  from (select
    (case src.profile
       when 'servering'     then 33000 when 'varehandel' then 39000
       when 'bygg'          then 45000 when 'tjenesteyting' then 48000
       when 'radgivning'    then 62000 else 51000 end
     * (0.94 + _noise('wb' || i.nace_code) * 0.14)
     -- Lønnsvekst, litt over prisvekst gjennom perioden.
     * power(1.038, y - 2015)) as base
  ) b
) w;

-- Regionalt: kun NACE 2-3, samme granularitetsregel som resten. Oslo og
-- Rogaland over snittet, distriktsfylkene under — ikke tilfeldig støy.
insert into industry_wages
  (industry_id, region_id, year, nace_level, region_level, yrke_kode, yrke_navn,
   manedslonn_gjennomsnitt, manedslonn_median, manedslonn_kvartil_nedre, manedslonn_kvartil_ovre,
   antall_ansatte, merknader, source, data_quality, coverage)
select
  i.id, r.id, y, i.nace_level, 'fylke', null, null,
  w.snitt, w.median, w.d1, w.d9, w.ansatte,
  '{}'::jsonb, 'seed:11418', 'mock', 'alle'
from industries i
join _src src on src.code = i.nace_code
cross join generate_series(2017, 2025) y
join regions r on r.level = 'fylke'
  and r.valid_from_year <= y and coalesce(r.valid_to_year, 9999) >= y
join _reg g on g.code = r.code and g.vfrom = r.valid_from_year
cross join lateral (
  select
    round(base * 1.06)::int as snitt,
    base::int                as median,
    round(base * (0.63 + _noise('wd1' || i.nace_code) * 0.09))::int as d1,
    round(base * (1.48 + _noise('wd9' || i.nace_code) * 0.34))::int as d9,
    round((case i.nace_level when 2 then 42000 else 11000 end)
          * (0.4 + _noise('wa' || i.nace_code)) * (g.pop::numeric / 5300000))::int as ansatte
  from (select
    (case src.profile
       when 'servering'     then 33000 when 'varehandel' then 39000
       when 'bygg'          then 45000 when 'tjenesteyting' then 48000
       when 'radgivning'    then 62000 else 51000 end
     * (0.94 + _noise('wb' || i.nace_code) * 0.14)
     * power(1.038, y - 2015)
     -- Fylkespåslag: sentrale fylker høyere. Ikke støy, en systematisk skjevhet.
     * (case r.code when '03' then 1.11 when '30' then 1.05 when '32' then 1.05
                    when '11' then 1.06 when '02' then 1.06 when '46' then 1.01
                    when '12' then 1.01 when '50' then 0.99
                    else 0.93 + _noise('wr' || r.code) * 0.05 end)) as base
  ) b
) w
where i.nace_level <= 3;

-- Yrkesrader for de næringene der ett yrke dominerer. Koblingen fra NACE til
-- STYRK-08 er VÅR vurdering — SSB publiserer ingen slik kartlegging — så disse
-- radene er merket 'beregnet', ikke som målt statistikk.
insert into industry_wages
  (industry_id, region_id, year, nace_level, region_level, yrke_kode, yrke_navn,
   manedslonn_gjennomsnitt, manedslonn_median, manedslonn_kvartil_nedre, manedslonn_kvartil_ovre,
   antall_ansatte, merknader, source, data_quality, coverage)
select
  i.id, r.id, w.year, i.nace_level, 'land', k.yrke, k.navn,
  round(w.manedslonn_median * 1.05)::int, w.manedslonn_median,
  round(w.manedslonn_median * 0.72)::int, round(w.manedslonn_median * 1.42)::int,
  round(w.antall_ansatte * 0.62)::int,
  '{}'::jsonb, 'seed:11418+egen kobling', 'beregnet', 'alle'
from industry_wages w
join industries i on i.id = w.industry_id
join regions r on r.id = w.region_id
join (values
  ('56.101','5120','Kokk'),
  ('69.201','2411','Regnskapsfører'),
  ('69.100','2611','Advokat'),
  ('96.021','5141','Frisør'),
  ('86.230','2261','Tannlege'),
  ('43.210','7411','Elektriker'),
  ('62.010','2512','Programvareutvikler'),
  ('88.911','2342','Barnehagelærer')
) as k(code, yrke, navn) on k.code = i.nace_code
where w.region_level = 'land' and w.yrke_kode is null and w.year >= 2020;

-- Byggeverktøyene skal ikke ligge igjen i basen.
drop table _src, _reg, _band;
drop function _noise(text);
