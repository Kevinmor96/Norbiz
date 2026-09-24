-- Eierlønnsflagget fra 0017 traff for bredt: 18 av 30 kategorier, og flere av
-- dem er ikke eierdrevne i det hele tatt.
--
-- Terskelen var lønnskostnad per sysselsatt alene, under 450 000. Den fanger
-- to helt ulike fenomen som ser like ut i tallet:
--
--   Eierdrift   — snittbedriften er så liten at eieren er hovedarbeidskraften,
--                 og tar ikke ut lønn. Fysioterapi: 148 000 kr per sysselsatt,
--                 0,9 ansatte per bedrift.
--   Deltid      — mange ansatte per bedrift, men lav lønn per hode fordi
--                 stillingene er små. Dagligvare: 374 000 kr per sysselsatt og
--                 23,4 ansatte per butikk.
--
-- Å merke Dagligvare med «eieren tar ikke ut lønn» er ikke en unøyaktighet,
-- det er en påstand som er usann — og den sto på forsiden. Samme gjaldt
-- klesbutikk (11,0 ansatte), skobutikk (14,1), restaurant (9,8), bakeri (10,6)
-- og sportsbutikk (8,9).
--
-- Flagget krever nå BEGGE forhold: lav lønn per sysselsatt OG under tre
-- ansatte per bedrift. Da står det igjen fem kategorier — Fysioterapi (0,9),
-- Hudpleie (1,1), Frisør (1,8), Camping & hytter (2,1) og Tannlege (2,3) — og
-- det er nettopp de som ellers topper marginlisten uten å være mer lønnsomme.
--
-- Treningssenter faller ut, og det er riktig: 16,7 % margin med 6,7 ansatte
-- per senter er reell drift, ikke et regnskapsartefakt.
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
language sql stable
set search_path = public
as $$
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
    -- Begge forhold må gjelde: arbeidet er i hovedsak ulønnet OG bedriften er
    -- for liten til å ha annet enn eieren som hovedarbeidskraft.
    case when si.sys > 0 and si.lo is not null and si.n > 0
      then si.lo / si.sys < 450000 and si.sys::numeric / si.n < 3 end,
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

create function kategori_rangering(
  metrikk text default 'driftsmargin',
  retning text default 'desc',
  antall int default 10
)
returns table (rang bigint, slug text, navn text, verden text, farge text,
  verdi numeric, ar int, eierlonn_i_resultat boolean)
language sql stable
set search_path = public
as $$
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
