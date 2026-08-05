-- To nye rangeringsmetrikker: vekst siste år, og median månedslønn.
--
-- Topplistesiden legges om fra filterflate til kuraterte lister, og to av
-- listene manglet metrikk i kategori_rangering: «vokser mest akkurat nå»
-- (vekst_1ar_pct fantes i oversikten men ikke i rangeringen) og «høyest lønn»
-- (kategori_lonn kom i 0033).
--
-- Lønnen krever sin egen års-kolonne: lønnsstatistikken (2025) er ferskere enn
-- strukturstatistikken (2024), og å stemple et 2025-lønnstall med 2024 ville
-- vært feil årstall på et målt tall — den ene tingen produktet aldri gjør.
-- Derfor bytter `ar` betydning per metrikk: lønnens år for 'lonn', ellers
-- statistikkåret. Kolonnen heter fortsatt `ar` og UI-et viser den ved tallet,
-- så semantikken er «året tallet gjelder».
drop function kategori_rangering(text, text, int);

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
    select o.slug, o.navn, o.verden, o.farge, o.eierlonn_i_resultat,
      case metrikk
        when 'driftsmargin' then o.driftsmargin_pct
        when 'omsetning' then o.omsetning_total::numeric
        when 'vekst' then o.vekst_cagr_pct
        when 'vekst_1ar' then o.vekst_1ar_pct
        when 'foretak' then o.n_foretak::numeric
        when 'virksomheter' then o.n_virksomheter::numeric
        when 'ansatte_per_foretak' then o.ansatte_per_foretak
        when 'lonnsandel' then o.lonnsandel_pct
        when 'lonn' then l.manedslonn_median::numeric
      end verdi,
      case when metrikk = 'lonn' then l.year else o.ar end ar
    from kategori_oversikt() o
    left join lateral (
      select kl.manedslonn_median, kl.year from kategori_lonn(o.slug) kl
    ) l on metrikk = 'lonn'
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

grant execute on function kategori_rangering(text, text, int) to anon, authenticated;

comment on function kategori_rangering(text, text, int) is
  'Rangerer kategoriene på én metrikk. `ar` er året verdien gjelder — lønnens eget år for metrikk=lonn, ellers statistikkåret.';
