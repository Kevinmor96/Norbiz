-- kategori_oversikt() kalte foretak for «bedrifter», og det er ikke bare et
-- upresist ord — i SSBs terminologi betyr bedrift nettopp virksomhet.
--
-- Skobutikk: 205 foretak, men 565 virksomheter. Kortet viste 205 under
-- etiketten BEDRIFTER, og en leser som vet hvor mange skobutikker det finnes i
-- Norge konkluderer med at tallet er feil. Tallet var riktig; ordet var galt.
-- Kjeder er ett foretak med mange utsalg, så avviket er størst i nettopp de
-- kategoriene der folk har best magefølelse: butikk og servering.
--
-- Funksjonen returnerer nå begge, med navn som sier hva de er:
--   n_foretak, ansatte_per_foretak         — juridiske enheter (12910, foretak)
--   n_virksomheter, ansatte_per_virksomhet — utsalg og avdelinger (12910, virksomhet)
--
-- Omsetning, margin og lønn hentes fortsatt fra foretaksraden. Det er den som
-- har fullt regnskap; virksomhetsraden mangler driftsresultat i flere næringer,
-- og en margin regnet på ulikt grunnlag mellom kategorier er verre enn ingen.
--
-- Regelen om komplette år gjelder begge seriene uavhengig: mangler
-- virksomhetstallet et år, faller virksomhetstallet ut for det året — ikke hele
-- kategorien.
drop function kategori_rangering(text, text, int);
drop function kategori_oversikt();

create function kategori_oversikt()
returns table (
  slug text, navn text, verden text, beskrivelse text, farge text,
  ikon text, sortering int,
  ar int, n_foretak bigint, n_virksomheter bigint,
  omsetning_total bigint, omsetning_per_foretak bigint,
  driftsmargin_pct numeric, sysselsatte bigint,
  ansatte_per_foretak numeric, ansatte_per_virksomhet numeric,
  lonnsandel_pct numeric, lonn_per_sysselsatt bigint, eierlonn_i_resultat boolean,
  vekst_cagr_pct numeric, vekst_1ar_pct numeric, serie jsonb
)
language sql stable
set search_path = public
as $$
  with raa as (
    select c.id cid, s.year, s.unit_type,
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
    join industry_stats s on s.industry_id = i.id and s.region_level = 'land'
    group by c.id, s.year, s.unit_type
  ),
  -- Antall koder kategorien skal ha, per enhetstype. En kode som mangler året
  -- helt gir lavere koder_med_rad, og året faller ut for den enhetstypen.
  forventet as (
    select cid, unit_type, max(koder_med_rad) koder from raa group by cid, unit_type
  ),
  tall as (
    select r.* from raa r
    join forventet f on f.cid = r.cid and f.unit_type = r.unit_type
    where r.koder_med_rad = f.koder and r.koder_med_oms = f.koder
  ),
  foretak as (select * from tall where unit_type = 'foretak'),
  virksomhet as (select * from tall where unit_type = 'virksomhet'),
  siste as (
    select distinct on (cid) cid, year, n, oms, dr, lo, sys
    from foretak order by cid, year desc
  ),
  basis as (
    select distinct on (f.cid) f.cid, f.year, f.oms
    from foretak f join siste si on si.cid = f.cid
    where f.year >= si.year - 5 and f.year < si.year
    order by f.cid, f.year asc
  ),
  serie as (
    select cid, jsonb_agg(jsonb_build_object(
      'ar', year, 'omsetning', oms, 'foretak', n) order by year) j
    from foretak group by cid
  )
  select c.slug, c.navn, c.verden, c.beskrivelse, c.farge, c.ikon, c.sortering,
    si.year, si.n, vi.n,
    si.oms,
    case when si.n > 0 then si.oms / si.n end,
    case when si.oms > 0 and si.dr is not null
      then round(100.0 * si.dr / si.oms, 2) end,
    si.sys,
    case when si.n > 0 and si.sys is not null
      then round(si.sys::numeric / si.n, 1) end,
    case when vi.n > 0 and vi.sys is not null
      then round(vi.sys::numeric / vi.n, 1) end,
    case when si.oms > 0 and si.lo is not null
      then round(100.0 * si.lo / si.oms, 1) end,
    case when si.sys > 0 and si.lo is not null then si.lo / si.sys end,
    -- Begge forhold må gjelde: arbeidet er i hovedsak ulønnet OG bedriften er
    -- for liten til å ha annet enn eieren som hovedarbeidskraft. Målt per
    -- foretak, for det er der eierskapet ligger.
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
  -- Virksomhetstallet for samme år som foretakstallet. Finnes det ikke, står
  -- kolonnen null og UI-et viser bare foretak.
  left join virksomhet vi on vi.cid = c.id and vi.year = si.year
  left join lateral (
    select case when f.oms > 0 then round(100.0 * (si.oms - f.oms) / f.oms, 1) end vekst
    from foretak f where f.cid = c.id and f.year = si.year - 1
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
        when 'foretak' then o.n_foretak::numeric
        when 'virksomheter' then o.n_virksomheter::numeric
        when 'ansatte_per_foretak' then o.ansatte_per_foretak
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
