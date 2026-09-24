-- Lønnsspennet er kvartiler, ikke desiler — kilden bestemmer.
--
-- Skjemaet fra 0009 antok at SSBs statistikkmål-dimensjon bar 1. og 9. desil.
-- Verifisert mot tabell 11419 (2026-08-05): målene er Gjennomsnitt, Median,
-- Nedre kvartil og Øvre kvartil. Ingen desiler. Kolonnene bytter navn så de
-- sier hva de faktisk inneholder — å legge kvartiler i kolonner som heter
-- desil ville vært nøyaktig den typen etikettløgn resten av basen nekter seg.
-- Det eneste som går tapt er seed-genererte demo-tall.
alter table industry_wages rename column manedslonn_desil1 to manedslonn_kvartil_nedre;
alter table industry_wages rename column manedslonn_desil9 to manedslonn_kvartil_ovre;
alter table industry_wages rename constraint industry_wages_desil_order to industry_wages_kvartil_order;

comment on column industry_wages.manedslonn_kvartil_nedre is
  'Nedre kvartil fra SSB 11419. Spennet er målt — det er bare smalere enn desilene skjemaet først antok.';
comment on column industry_wages.manedslonn_kvartil_ovre is
  'Øvre kvartil fra SSB 11419.';

-- Lønnen for en kategori, med lønnsgruppens navn.
--
-- 11419 publiserer per LØNNSGRUPPE — sammensatte koder som «56.1_56.3» og
-- «41-43». import-lonn ekspanderer hver gruppe til enkeltkodene som finnes i
-- industries, og stempler raden med gruppens navn i merknader. Denne
-- funksjonen gjør prefiksmatchen fra kategoriens ssb-koder mot de radene:
-- den mest spesifikke lønnsraden som dekker flest av kategoriens koder vinner,
-- og gruppens navn følger med ut slik at UI-et kan si hvilken flate lønnen
-- gjelder («lønn for serveringsvirksomhet», ikke bare et tall).
--
-- Bare data_quality='ssb' returneres. En kategori uten ssb-lønn får ingen rad
-- — panelet hopper over lønn framfor å vise demo-tall.
create function kategori_lonn(i_slug text)
returns table (
  nace_code text, gruppe_navn text, year int,
  manedslonn_median int, manedslonn_gjennomsnitt int,
  manedslonn_kvartil_nedre int, manedslonn_kvartil_ovre int,
  medlemskoder_dekket bigint, medlemskoder_totalt bigint
)
language sql stable
set search_path = public
as $$
  with medlemmer as (
    select m.nace_code
    from categories c
    join category_members m on m.category_id = c.id and m.kilde = 'ssb'
    where c.slug = i_slug
  ),
  kandidater as (
    select
      i.nace_code, w.year,
      w.manedslonn_median, w.manedslonn_gjennomsnitt,
      w.manedslonn_kvartil_nedre, w.manedslonn_kvartil_ovre,
      coalesce(w.merknader->>'gruppe_navn', i.name) gruppe_navn,
      count(*) dekket
    from industry_wages w
    join industries i on i.id = w.industry_id
    join medlemmer md on md.nace_code like i.nace_code || '%'
    where w.data_quality = 'ssb'
      and w.yrke_kode is null
      and w.region_id is null
      and w.manedslonn_median is not null
    group by i.nace_code, w.year, w.manedslonn_median, w.manedslonn_gjennomsnitt,
      w.manedslonn_kvartil_nedre, w.manedslonn_kvartil_ovre, gruppe_navn
  )
  select
    k.nace_code, k.gruppe_navn, k.year,
    k.manedslonn_median, k.manedslonn_gjennomsnitt,
    k.manedslonn_kvartil_nedre, k.manedslonn_kvartil_ovre,
    k.dekket, (select count(*) from medlemmer)
  from kandidater k
  where k.year = (select max(year) from kandidater)
  order by k.dekket desc, length(k.nace_code) desc
  limit 1
$$;

grant execute on function kategori_lonn(text) to anon, authenticated;

comment on function kategori_lonn(text) is
  'Nyeste målte lønn for kategoriens nærmeste lønnsgruppe, med gruppens navn. Returnerer ingenting der kilden tier.';
