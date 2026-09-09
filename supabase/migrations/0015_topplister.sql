-- Topplistefunksjonene bak forsiden. Samme regler som migrasjon 0010:
-- aggregering hører i basen (PostgREST avviser aggregater i spørrestrengen),
-- ingen funksjon er security definer, og terskler håndheves her.
--
-- Merk at funksjonene IKKE filtrerer på data_quality: statistikktabellen
-- inneholder én kvalitet per miljø (mock i test, ssb live), og
-- anslagstabellen er uansett en annen tabell. Å filtrere her ville gjort
-- PGlite-testene tomme uten å beskytte mot noe reelt.

-- Ett kort per kategori: siste års nøkkeltall + hele tidsserien for
-- sparkline. Kategorier uten statistikk kommer med (null-tall) — forsiden
-- avgjør selv om den viser kortet grått eller utelater det.
create function kategori_oversikt()
returns table (
  slug text, navn text, verden text, beskrivelse text, farge text,
  ikon text, sortering int,
  ar int, n_bedrifter bigint, omsetning_total bigint, omsetning_per_bedrift bigint,
  driftsmargin_pct numeric, sysselsatte bigint, ansatte_per_bedrift numeric,
  vekst_cagr_pct numeric, vekst_1ar_pct numeric, serie jsonb
)
language sql stable as $$
  with tall as (
    select c.id cid, s.year,
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
  siste as (
    select distinct on (cid) cid, year, n, oms, dr, sys
    from tall where oms is not null
    order by cid, year desc
  ),
  basis as (
    -- Eldste år innenfor femårsvinduet bak siste år: CAGR-grunnlaget.
    select distinct on (t.cid) t.cid, t.year, t.oms
    from tall t join siste si on si.cid = t.cid
    where t.oms is not null and t.year >= si.year - 5 and t.year < si.year
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

-- Største selskaper i en kategori, valgfritt avgrenset til fylke.
--
-- Matcher companies mot BEGGE kildespråkene, ikke bare brreg-prefiksene.
-- Grunnen er at kolonnen companies.nace_code bærer koden slik kilden ga den:
-- ekte Brreg-rader er SN2025 (41.000, 56.110), mens seed-selskapene i
-- testmiljøet er SN2007 (56.101). Matchet man bare på brreg-prefiks, ville
-- funksjonen vært tom i PGlite og altså utestet; matchet man bare på
-- ssb-koder, ville den vært tom mot ekte data. Å treffe på begge gir samme
-- svar i begge miljøer, og prefiksene er så vidt disjunkte mellom
-- revisjonene at kryssfeil ikke oppstår i kodesettet vårt.
--
-- Bare selskaper i regnskapssnittet: ENK og selskaper uten tall skal ikke
-- rangeres.
create function topp_selskaper(
  kategori_slug text,
  fylke text default null,
  metrikk text default 'omsetning',
  antall int default 10
)
returns table (
  rang bigint, navn text, org_nr text, kommune_code text,
  omsetning bigint, driftsresultat bigint, driftsmargin_pct numeric,
  ansatte int, regnskapsar int
)
language sql stable as $$
  with kandidater as (
    select c.navn, c.org_nr, c.kommune_code, c.omsetning, c.driftsresultat,
      case when c.omsetning > 0
        then round(100.0 * c.driftsresultat / c.omsetning, 1) end margin,
      c.ansatte, c.regnskapsar
    from companies c
    where c.inngar_i_regnskapssnitt
      and (fylke is null or left(c.kommune_code, 2) = fylke)
      and exists (
        select 1 from categories k
        join category_members m on m.category_id = k.id
        where k.slug = kategori_slug and c.nace_code like m.nace_code || '%')
  )
  select row_number() over (order by
      case when metrikk = 'omsetning' then omsetning end desc nulls last,
      case when metrikk = 'ansatte' then ansatte end desc nulls last,
      case when metrikk = 'margin' then margin end desc nulls last,
      org_nr),
    navn, org_nr, kommune_code, omsetning, driftsresultat, margin,
    ansatte, regnskapsar
  from kandidater
  order by 1
  limit antall
$$;

-- «Høyest margin i Norge», «størst vekst» osv. — rangerer kategoriene selv.
create function kategori_rangering(
  metrikk text default 'driftsmargin',
  retning text default 'desc',
  antall int default 10
)
returns table (rang bigint, slug text, navn text, verden text, farge text,
  verdi numeric, ar int)
language sql stable as $$
  with v as (
    select o.slug, o.navn, o.verden, o.farge, o.ar,
      case metrikk
        when 'driftsmargin' then o.driftsmargin_pct
        when 'omsetning' then o.omsetning_total::numeric
        when 'vekst' then o.vekst_cagr_pct
        when 'bedrifter' then o.n_bedrifter::numeric
        when 'ansatte_per_bedrift' then o.ansatte_per_bedrift
      end verdi
    from kategori_oversikt() o
  )
  select row_number() over (order by
      case when retning = 'asc' then verdi end asc nulls last,
      case when retning = 'desc' then verdi end desc nulls last,
      slug),
    slug, navn, verden, farge, verdi, ar
  from v
  where verdi is not null
  order by 1
  limit antall
$$;

-- Kjedelisten med tilkoblede tall. Selskap mangler til brand-oppslaget har
-- kjørt — da vises navnet uten tall, som er ærligere enn å gjette.
create function brand_liste(i_kategori text default null)
returns table (navn text, kategori text, kategori_slug text, kategori_farge text,
  org_nr text, merknad text, omsetning bigint, driftsmargin_pct numeric,
  ansatte int, regnskapsar int)
language sql stable as $$
  select b.navn, k.navn, k.slug, k.farge, b.org_nr, b.merknad,
    c.omsetning,
    case when c.omsetning > 0
      then round(100.0 * c.driftsresultat / c.omsetning, 1) end,
    c.ansatte, c.regnskapsar
  from brands b
  join categories k on k.id = b.category_id
  left join companies c on c.org_nr = b.org_nr
  where i_kategori is null or k.slug = i_kategori
  order by k.sortering, b.navn
$$;
