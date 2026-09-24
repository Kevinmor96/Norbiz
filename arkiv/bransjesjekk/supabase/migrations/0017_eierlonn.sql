-- Driftsmargin er ikke sammenlignbar mellom eierdrevne og lønnsdrevne
-- næringer, og forskjellen er stor nok til å snu en toppliste på hodet.
--
-- Målt i basen 2024: fysioterapi har 56,2 % driftsmargin og 148 000 kr
-- lønnskostnad per sysselsatt. Regnskap og revisjon har 14,1 % margin og
-- 820 000 kr. Forskjellen er ikke lønnsomhet — det er at en fysioterapeut med
-- eget foretak ikke fører sin egen arbeidsinnsats som lønnskostnad. Vederlaget
-- ligger i driftsresultatet, og marginen måler da noe annet enn hos en
-- virksomhet der alt arbeid er lønnet.
--
-- «Høyest margin i Norge» ville derfor rangert eierdrift øverst av en teknisk
-- grunn, og det er villedende for den som vurderer å starte: han ser 56 % og
-- tror det er overskudd etter at han selv har fått lønn.
--
-- Vi skjuler ikke tallet — vi merker det. kategori_oversikt og
-- kategori_rangering får lonn_per_sysselsatt og flagget eierlonn_i_resultat,
-- så UI-et kan si det rett ut i stedet for å late som tallene er like.
--
-- Terskelen er 450 000 kr lønnskostnad per sysselsatt. Gjennomsnittlig
-- årslønn i Norge var rundt 670 000 i 2024, og lønnskostnad inkludert
-- arbeidsgiveravgift og pensjon ligger nær 800 000 — som regnskapsbransjens
-- 820 000 bekrefter. Under 450 000 er en stor del av de sysselsatte altså
-- ikke lønnet i det hele tatt.
drop function kategori_rangering(text, text, int);
drop function kategori_oversikt();

create function kategori_oversikt()
returns table (
  slug text, navn text, verden text, beskrivelse text, farge text,
  ikon text, sortering int,
  ar int, n_bedrifter bigint, omsetning_total bigint, omsetning_per_bedrift bigint,
  driftsmargin_pct numeric, sysselsatte bigint, ansatte_per_bedrift numeric,
  lonnsandel_pct numeric, lonn_per_sysselsatt bigint, eierlonn_i_resultat boolean,
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
      sum(s.lonnskostnad_total)::bigint lo,
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
  -- Uten dette leses en manglende celle som et fall: 69.201 mangler omsetning
  -- for 2024, og Regnskap & revisjon gikk fra 42,1 til 23,1 mrd.
  forventet as (
    select cid, max(koder_med_rad) koder from raa group by cid
  ),
  tall as (
    select r.* from raa r join forventet f on f.cid = r.cid
    where r.koder_med_rad = f.koder and r.koder_med_oms = f.koder
  ),
  siste as (
    select distinct on (cid) cid, year, n, oms, dr, lo, sys
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
    case when si.oms > 0 and si.lo is not null
      then round(100.0 * si.lo / si.oms, 1) end,
    case when si.sys > 0 and si.lo is not null then si.lo / si.sys end,
    case when si.sys > 0 and si.lo is not null then si.lo / si.sys < 450000 end,
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

-- Rangeringen bærer flagget videre, så en marginliste kan merke radene der
-- eierens eget arbeid ligger i driftsresultatet.
create function kategori_rangering(
  metrikk text default 'driftsmargin',
  retning text default 'desc',
  antall int default 10
)
returns table (rang bigint, slug text, navn text, verden text, farge text,
  verdi numeric, ar int, eierlonn_i_resultat boolean)
language sql stable as $$
  with v as (
    select o.slug, o.navn, o.verden, o.farge, o.ar, o.eierlonn_i_resultat,
      case metrikk
        when 'driftsmargin' then o.driftsmargin_pct
        when 'omsetning' then o.omsetning_total::numeric
        when 'vekst' then o.vekst_cagr_pct
        when 'bedrifter' then o.n_bedrifter::numeric
        when 'ansatte_per_bedrift' then o.ansatte_per_bedrift
        when 'lonnsandel' then o.lonnsandel_pct
      end verdi
    from kategori_oversikt() o
  )
  select row_number() over (order by
      case when retning = 'asc' then verdi end asc nulls last,
      case when retning = 'desc' then verdi end desc nulls last,
      slug),
    slug, navn, verden, farge, verdi, ar, eierlonn_i_resultat
  from v
  where verdi is not null
  order by 1
  limit antall
$$;
