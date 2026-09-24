-- Aggregater frontend ikke kan regne selv.
--
-- PostgREST avviser aggregatfunksjoner i spørrestrengen — «Use of aggregate
-- functions is not allowed» — og det finnes ingen vei til percentile_cont
-- gjennom REST-grensesnittet. Frontend sto derfor igjen med to valg: hente alle
-- radene og regne medianen i JavaScript, eller snevre utvalget inn til noe lite
-- nok å hente. Den valgte det siste, og gjorde det riktig: 65 nasjonale
-- foretaksrader på ett NACE-nivå, med samme lineære interpolasjon som
-- percentile_cont.
--
-- Men det er datalagets jobb, ikke frontendens. Én definisjon i basen betyr at
-- hver flate får samme tall, og at medianen kan regnes over hele utvalget i
-- stedet for over den skiven som tilfeldigvis var liten nok å laste ned.
--
-- IKKE security definer. Tabellene har allerede `grant select` til anon og en
-- RLS-policy som tillater offentlig lesing, så funksjonen trenger ingen utvidede
-- rettigheter — den kan kjøre som den som kaller. Security definer her ville
-- lagt til en risikoklasse uten å løse noe.

-- Regionale rader har ingen driftsmargin i det hele tatt, så et snitt som tar
-- dem med regner på et utvalg der halve grunnlaget mangler. Funksjonen tar
-- derfor bare nasjonale foretaksrader, og det er ikke et argument — det er
-- innebygd, slik at ingen flate kan gjøre det feil.
create function industry_medians(p_year int default null, p_nace_level int default null)
returns table (
  year                        int,
  nace_level                  int,
  n_naeringer                 bigint,
  n_enheter_sum               bigint,
  median_driftsmargin         numeric,
  median_omsetning_per_enhet   numeric,
  median_sysselsatte_per_enhet numeric,
  -- Hvor mange næringer hver median faktisk er regnet over. Fire av seks er en
  -- svakere påstand enn seks av seks, og det gjelder medianer like mye som
  -- delscorer — så tallet skal følge med ut.
  n_med_driftsmargin          bigint,
  n_med_omsetning             bigint,
  n_med_sysselsatte           bigint
)
language sql
stable
set search_path = public
as $$
  select
    s.year,
    s.nace_level,
    count(distinct s.industry_id),
    coalesce(sum(s.n_enheter), 0)::bigint,
    percentile_cont(0.5) within group (order by s.driftsmargin_pct)
      filter (where s.driftsmargin_pct is not null),
    percentile_cont(0.5) within group (order by s.omsetning_per_enhet)
      filter (where s.omsetning_per_enhet is not null),
    percentile_cont(0.5) within group (order by s.sysselsatte_per_enhet)
      filter (where s.sysselsatte_per_enhet is not null),
    count(s.driftsmargin_pct),
    count(s.omsetning_per_enhet),
    count(s.sysselsatte_per_enhet)
  from industry_stats s
  where s.region_level = 'land'
    and s.unit_type = 'foretak'
    and (p_year is null or s.year = p_year)
    and (p_nace_level is null or s.nace_level = p_nace_level)
  group by s.year, s.nace_level
  order by s.year, s.nace_level;
$$;

comment on function industry_medians is
  'Medianer over nasjonale foretaksrader. Regionale rader er utelatt fordi de '
  'ikke har driftsmargin. Returnerer også hvor mange næringer hver median er '
  'regnet over, slik at dekningsgraden kan vises ved tallet.';

-- Marginfordelingen som histogram. Samme grunn: frontend kan ikke gruppere i
-- databasen gjennom PostgREST, og skal ikke laste ned alt for å gjøre det selv.
create function industry_margin_histogram(
  p_year int, p_nace_level int, p_bucket_width numeric default 2
)
returns table (bucket_from numeric, bucket_to numeric, n_naeringer bigint)
language sql
stable
set search_path = public
as $$
  select
    b.bucket_from,
    b.bucket_from + p_bucket_width,
    count(*)::bigint
  from industry_stats s
  cross join lateral (
    select floor(s.driftsmargin_pct / p_bucket_width) * p_bucket_width as bucket_from
  ) b
  where s.region_level = 'land'
    and s.unit_type = 'foretak'
    and s.year = p_year
    and s.nace_level = p_nace_level
    and s.driftsmargin_pct is not null
  group by b.bucket_from
  order by b.bucket_from;
$$;

-- Kommuneaggregatene, med vår egen undertrykking innebygd.
--
-- Dette er det ene stedet vi bygger tall nedenfra fra companies, og terskelen
-- må ligge i databasen framfor i frontend. Snitt av tre selskaper i én næring i
-- én liten kommune er lett å regne baklengs til hva hver enkelt tjente, og et
-- filter som bare finnes i UI-et er ikke en terskel — det er en anbefaling.
--
-- Under terskelen returneres NULL for tallene og `konfidensielt` som årsak, ikke
-- et utelatt rad: at kombinasjonen finnes men er skjult ER informasjon.
create function kommune_aggregat(p_nace_code text default null)
returns table (
  kommune_code    text,
  nace_code       text,
  n_selskaper     bigint,
  omsetning_sum   numeric,
  ansatte_sum     bigint,
  driftsmargin_pct numeric,
  regnskapsar     int,
  mangel_arsak    mangel_arsak
)
language sql
stable
set search_path = public
as $$
  select
    a.kommune_code,
    a.nace_code,
    a.n_selskaper,
    case when a.n_selskaper >= cfg.min_enheter_aggregat then a.omsetning_sum end,
    case when a.n_selskaper >= cfg.min_enheter_aggregat then a.ansatte_sum end,
    case when a.n_selskaper >= cfg.min_enheter_aggregat and a.omsetning_sum > 0
         then round(100.0 * a.driftsresultat_sum / a.omsetning_sum, 2) end,
    a.regnskapsar,
    case when a.n_selskaper < cfg.min_enheter_aggregat
         then 'konfidensielt'::mangel_arsak end
  from (
    select
      c.kommune_code,
      c.nace_code,
      count(*)::bigint            as n_selskaper,
      sum(c.omsetning)            as omsetning_sum,
      sum(c.driftsresultat)       as driftsresultat_sum,
      sum(c.ansatte)::bigint      as ansatte_sum,
      max(c.regnskapsar)          as regnskapsar
    from companies c
    -- Kun de som faktisk leverer årsregnskap. ENK gjør ikke det, og et snitt
    -- som teller dem med i nevneren men ikke i telleren er feil.
    where c.inngar_i_regnskapssnitt
      and (p_nace_code is null or c.nace_code = p_nace_code)
    group by c.kommune_code, c.nace_code
  ) a
  cross join score_config cfg
  order by a.kommune_code, a.nace_code;
$$;

comment on function kommune_aggregat is
  'Kommunetall bygget nedenfra fra companies, med score_config.min_enheter_aggregat '
  'håndhevet i basen. Under terskelen er tallene NULL og mangel_arsak = '
  'konfidensielt — raden finnes, tallet er skjult.';

grant execute on function industry_medians to anon, authenticated;
grant execute on function industry_margin_histogram to anon, authenticated;
grant execute on function kommune_aggregat to anon, authenticated;
