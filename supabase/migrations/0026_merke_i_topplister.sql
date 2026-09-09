-- Kjedenavn og segment inn i selskapstopplistene.
--
-- Bakgrunn: Louis Vuitton Norge AS står i skobutikk-topplisten fordi Brreg har
-- selskapet registrert på 47.720, skotøy. Det ser ut som en feil i indeksen,
-- men det er kildens registrering, og å filtrere selskapet bort ville vært å
-- redigere Enhetsregisteret. Alternativet er å forklare: står det «Louis
-- Vuitton · luksus» ved raden, er det ikke lenger en rar rad, det er en
-- opplysning.
--
-- Samme kobling gjør nytte overalt ellers: «REITAN CONVENIENCE NORWAY AS» sier
-- ingenting, «Narvesen» sier alt.
--
-- Ett selskap kan bære flere merker — Varner AS er både Dressmann og Cubus,
-- Reitan Convenience både Narvesen og 7-Eleven. Lateral-en velger derfor én
-- deterministisk: merket med segment først (det er det som må vises), deretter
-- alfabetisk. Uten `limit 1` ville selskapet dukket opp én gang per merke og
-- topplistens «topp 10» blitt 12 rader.
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
  ansatte int, regnskapsar int, merke text, segment text
)
language sql stable
set search_path = public
as $$
  with kandidater as (
    select c.navn, c.org_nr, c.kommune_code, k.navn kommune_navn,
      c.omsetning, c.driftsresultat,
      case when c.omsetning > 0
        then round(100.0 * c.driftsresultat / c.omsetning, 1) end margin,
      c.ansatte, c.regnskapsar, mk.merke, mk.segment
    from companies c
    left join kommuner k on k.code = c.kommune_code
    left join lateral (
      select b.navn merke, b.segment from brands b
      where b.org_nr = c.org_nr
      order by (b.segment is null), b.navn
      limit 1
    ) mk on true
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
    ansatte, regnskapsar, merke, segment
  from kandidater
  order by 1
  limit antall
$$;
