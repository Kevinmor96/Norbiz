-- En kategorisum over flere NACE-koder er bare sammenlignbar over år hvis
-- ALLE medlemskodene har tallet i alle årene. Uten den regelen leser en
-- manglende celle som et fall.
--
-- Det traff Regnskap & revisjon: 69.201 mangler omsetning for 2024 (SSB har
-- foretakstallet, ikke omsetningen), så kategorisummen gikk fra 42,1 mrd i
-- 2023 til 23,1 mrd i 2024 — bare revisjon — og forsiden ville meldt
-- «-6 % årlig vekst» om en næring som faktisk vokser. Samme mekanisme som
-- undertrykte celler: et hull som ser ut som et tall.
--
-- Denne migrasjonen erstatter kategori_oversikt() med en versjon som regner
-- ut hvor mange medlemskoder kategorien har rader for, og bare bruker år der
-- alle kodene har både rad og omsetning. Serien til sparklinen filtreres
-- likt, ellers ville grafen vist fallet selv om nøkkeltallet ikke gjorde det.
drop function kategori_oversikt();

create function kategori_oversikt()
returns table (
  slug text, navn text, verden text, beskrivelse text, farge text,
  ikon text, sortering int,
  ar int, n_bedrifter bigint, omsetning_total bigint, omsetning_per_bedrift bigint,
  driftsmargin_pct numeric, sysselsatte bigint, ansatte_per_bedrift numeric,
  vekst_cagr_pct numeric, vekst_1ar_pct numeric, serie jsonb
)
language sql stable as $$
  with raa as (
    select c.id cid, s.year,
      count(*) koder_med_rad,
      count(s.omsetning_total) koder_med_oms,
      sum(s.n_enheter)::bigint n,
      sum(s.omsetning_total)::bigint oms,
      sum(s.driftsresultat_total)::bigint dr,
      sum(s.sysselsatte_total)::bigint sys
    from categories c
    join category_members m on m.category_id = c.id and m.kilde = 'ssb'
    join industries i on i.nace_code = m.nace_code
    join industry_stats s on s.industry_id = i.id
      and s.region_level = 'land' and s.unit_type = 'foretak'
    group by c.id, s.year
  ),
  -- Antall koder kategorien skal ha: det høyeste antallet rader noe år har.
  -- En kode som mangler året helt gir lavere koder_med_rad, og året faller ut.
  forventet as (
    select cid, max(koder_med_rad) koder from raa group by cid
  ),
  tall as (
    select r.* from raa r join forventet f on f.cid = r.cid
    where r.koder_med_rad = f.koder and r.koder_med_oms = f.koder
  ),
  siste as (
    select distinct on (cid) cid, year, n, oms, dr, sys
    from tall order by cid, year desc
  ),
  basis as (
    select distinct on (t.cid) t.cid, t.year, t.oms
    from tall t join siste si on si.cid = t.cid
    where t.year >= si.year - 5 and t.year < si.year
    order by t.cid, t.year asc
  ),
  serie as (
    select cid, jsonb_agg(jsonb_build_object(
      'ar', year, 'omsetning', oms, 'bedrifter', n) order by year) j
    from tall group by cid
  )
  select c.slug, c.navn, c.verden, c.beskrivelse, c.farge, c.ikon, c.sortering,
    si.year, si.n, si.oms,
    case when si.n > 0 then si.oms / si.n end,
    case when si.oms > 0 and si.dr is not null
      then round(100.0 * si.dr / si.oms, 2) end,
    si.sys,
    case when si.n > 0 and si.sys is not null
      then round(si.sys::numeric / si.n, 1) end,
    case when b.oms > 0 and si.year > b.year
      then round((power(si.oms::numeric / b.oms, 1.0 / (si.year - b.year)) - 1) * 100, 1) end,
    aar1.vekst,
    se.j
  from categories c
  left join siste si on si.cid = c.id
  left join basis b on b.cid = c.id
  left join serie se on se.cid = c.id
  left join lateral (
    select case when f.oms > 0 then round(100.0 * (si.oms - f.oms) / f.oms, 1) end vekst
    from tall f where f.cid = c.id and f.year = si.year - 1
  ) aar1 on true
  order by c.sortering, c.slug
$$;
