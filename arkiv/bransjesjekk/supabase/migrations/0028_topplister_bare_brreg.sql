-- `topp_selskaper` skal matche selskaper mot brreg-kodene ALENE.
--
-- Funksjonen matchet mot begge kodespråk: både `kilde='ssb'` (SN2007) og
-- `kilde='brreg'` (SN2025). Det ble gjort for å få topplistene til å gi treff i
-- testbasen, der seed-selskapene bærer SN2007-koder. Det var galt, og det er en
-- feil som ikke kan ha rett:
--
--   `companies.nace_code` kommer ALLTID fra Brreg, altså SN2025. Å matche den
--   mot en SN2007-kode er å sammenligne to kodeverk som deler tallformat og
--   ikke betydning.
--
-- 47.762 er beviset. I SN2007 betyr den «Butikkhandel med blomster». I SN2025
-- betyr den «Detaljhandel med kjæledyr og varer til kjæledyr». Blomster & hage
-- hadde koden på ssb-siden, og fikk derfor Musti Norge (1,1 mrd) og PetXL inn i
-- blomstertopplisten — 14 selskaper i alt. Ingen andre kategorier tjente noe på
-- ssb-matchingen: den ga null ekstra treff andre steder, så hele mekanismen
-- gjorde bare skade.
--
-- Testene løses der de hører: `tests/categories.test.ts` setter inn selskaper
-- med brreg-koder før den sjekker rangeringen, i stedet for at funksjonen
-- strekker seg for å passe seed-dataene.
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
      and exists (
        select 1 from categories kat
        join category_members m on m.category_id = kat.id
        where kat.slug = kategori_slug
          -- Bare SN2025. companies.nace_code er Brregs kode slik den kom.
          and m.kilde = 'brreg'
          and c.nace_code like m.nace_code || '%')
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
