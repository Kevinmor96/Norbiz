-- To ting: kommunenavn i selskapslistene, og et segmentfelt på kjedelisten.
--
-- 1. `topp_selskaper` returnerte bare `kommune_code`, og frontend hadde en
--    delvis navneliste. Resultatet var «Kommune 3103 · 840 ansatte» på
--    skjermen — et firesifret tall som ikke betyr noe for en leser, og som
--    dessuten ser ut som et postnummer. Navnet kommer nå fra `kommuner`
--    (SSB klassifikasjon 131), så frontend ikke trenger å vite noe.
--
-- 2. `brands.segment` gjør det mulig å vise en luksusstripe uten å late som
--    luksus er en bransje. SSB har ingen luksuskode: en «luksuskategori» med
--    marginer og vekst måtte enten lånt tallene fra klesbutikk og gullsmed
--    eller diktet dem. Segmentet er derfor en merking på aktørene — ekte
--    selskapstall fra Regnskapsregisteret, ingen påstand om et bransjeaggregat
--    som ikke finnes.
alter table brands add column segment text;

comment on column brands.segment is
  'Valgfri merking av aktøren, f.eks. luksus. Ikke en bransje — SSB har ingen kode for segmentet, så det finnes ingen bransjetall bak.';

drop function topp_selskaper(text, text, text, int);

create function topp_selskaper(
  kategori_slug text,
  fylke text default null,
  metrikk text default 'omsetning',
  antall int default 10
)
returns table (
  rang bigint, navn text, org_nr text, kommune_code text, kommune_navn text,
  omsetning bigint, driftsresultat bigint, driftsmargin_pct numeric,
  ansatte int, regnskapsar int
)
language sql stable
set search_path = public
as $$
  with kandidater as (
    select c.navn, c.org_nr, c.kommune_code, k.navn kommune_navn,
      c.omsetning, c.driftsresultat,
      case when c.omsetning > 0
        then round(100.0 * c.driftsresultat / c.omsetning, 1) end margin,
      c.ansatte, c.regnskapsar
    from companies c
    left join kommuner k on k.code = c.kommune_code
    where c.inngar_i_regnskapssnitt
      and (fylke is null or left(c.kommune_code, 2) = fylke)
      -- Matcher begge kildespråk: companies.nace_code bærer koden slik kilden
      -- ga den, SN2025 fra Brreg og SN2007 i seed.
      and exists (
        select 1 from categories kat
        join category_members m on m.category_id = kat.id
        where kat.slug = kategori_slug and c.nace_code like m.nace_code || '%')
  )
  select row_number() over (order by
      case when metrikk = 'omsetning' then omsetning end desc nulls last,
      case when metrikk = 'ansatte' then ansatte end desc nulls last,
      case when metrikk = 'margin' then margin end desc nulls last,
      org_nr),
    navn, org_nr, kommune_code, kommune_navn, omsetning, driftsresultat, margin,
    ansatte, regnskapsar
  from kandidater
  order by 1
  limit antall
$$;

drop function brand_liste(text);

create function brand_liste(i_kategori text default null, i_segment text default null)
returns table (navn text, kategori text, kategori_slug text, kategori_farge text,
  org_nr text, merknad text, segment text, kommune_navn text,
  omsetning bigint, driftsmargin_pct numeric, ansatte int, regnskapsar int)
language sql stable
set search_path = public
as $$
  select b.navn, k.navn, k.slug, k.farge, b.org_nr, b.merknad, b.segment,
    km.navn,
    c.omsetning,
    case when c.omsetning > 0
      then round(100.0 * c.driftsresultat / c.omsetning, 1) end,
    c.ansatte, c.regnskapsar
  from brands b
  join categories k on k.id = b.category_id
  left join companies c on c.org_nr = b.org_nr
  left join kommuner km on km.code = c.kommune_code
  where (i_kategori is null or k.slug = i_kategori)
    and (i_segment is null or b.segment = i_segment)
  order by k.sortering, b.navn
$$;
