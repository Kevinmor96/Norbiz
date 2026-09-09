-- Inngangsporten snus: fra «er bransjen god?» til «hva tjener de som gjør dette?»
--
-- Ingen nye tall. To funksjoner som stiller de målte tallene mot spørsmålene
-- folk faktisk har — og som holder de samme reglene som resten av basen om
-- hva vi tier om.

-- ---------------------------------------------------------------------------
-- solo_oversikt(): «kan jeg gjøre dette alene?»
--
-- Ansatte per foretak har ligget i kategori_oversikt siden 0015 og aldri stått
-- på en side. Det er den mest leservendte kolonnen vi eier: et foretak med 0,9
-- ansatte er ikke en bedrift i dagligtale, det er én person — og vi har 5 224
-- av dem i fysioterapi alene.
--
-- `soloklasse` er en MERKING AV ET MÅLT TALL, ikke et nytt tall. Samme
-- konstruksjon som eierlonn_i_resultat: terskelen er redaksjonell, grunnlaget
-- er målt, og merkingen kan ikke peke en annen vei enn tallet den begrunnes
-- med, fordi den regnes på den samme avrundede verdien UI-et viser.
--
-- Rangeringen hører i basen av samme grunn som resten av aggregatene:
-- PostgREST avviser dem i spørrestrengen, og en sortering som bare finnes i
-- UI-et er en presentasjon, ikke en definisjon.
create function solo_oversikt()
returns table (
  slug text, navn text, verden text, farge text, ikon text,
  ar int, n_virksomheter bigint,
  ansatte_per_foretak numeric, soloklasse text,
  driftsmargin_pct numeric,
  omsetning_per_foretak bigint,
  driftsresultat_per_foretak bigint,
  eierlonn_i_resultat boolean,
  manedslonn_median int, lonn_gruppe_navn text, lonn_ar int,
  vekst_1ar_pct numeric, vekst_cagr_pct numeric
)
language sql stable
set search_path = public
as $$
  select
    o.slug, o.navn, o.verden, o.farge, o.ikon,
    o.ar, o.n_virksomheter,
    o.ansatte_per_foretak,
    case
      when o.ansatte_per_foretak is null then null
      when o.ansatte_per_foretak < 1.5 then 'alene'
      when o.ansatte_per_foretak < 3   then 'to'
      when o.ansatte_per_foretak < 10  then 'lag'
      else 'bedrift'
    end,
    o.driftsmargin_pct,
    o.omsetning_per_foretak,
    -- Driftsresultat per foretak: omsetning per foretak ganger målt margin.
    -- Begge ledd kommer fra samme år og samme rad, så dette er en omskriving
    -- av et målt tall, ikke et anslag.
    case when o.omsetning_per_foretak is not null and o.driftsmargin_pct is not null
      then round(o.omsetning_per_foretak * o.driftsmargin_pct / 100)::bigint end,
    o.eierlonn_i_resultat,
    l.manedslonn_median, l.gruppe_navn, l.year,
    o.vekst_1ar_pct, o.vekst_cagr_pct
  from kategori_oversikt() o
  left join lateral kategori_lonn(o.slug) l on true
  where o.ar is not null
  order by o.ansatte_per_foretak asc nulls last, o.navn
$$;

grant execute on function solo_oversikt() to anon, authenticated;

comment on function solo_oversikt() is
  'Kategoriene rangert på hvor få folk det typiske foretaket har. soloklasse er en merking av det målte tallet, ikke et nytt tall.';

-- ---------------------------------------------------------------------------
-- hva_ma_du_omsette(): det ærlige svaret på «hva kan jeg tjene?»
--
-- Målinntekt delt på bransjens målte driftsmargin. Funksjonen bærer det samme
-- løftet som en mulighetsindeks — «hva kan dette bli for meg» — men den kan
-- ikke lyve, fordi den aldri påstår at noen kommer til å kjøpe. Etterspørselen
-- er leserens vurdering; marginen er vår måling. Det er hele forskjellen på
-- dette og etableringskapital-anslagene som ble forkastet to ganger.
--
-- TO REGLER BÆRER ÆRLIGHETEN:
--
-- 1. IKKE-POSITIV MARGIN GIR INGEN RAD. Blomster & hage har -0,61 % margin i
--    2024. Å invertere den gir et negativt omsetningskrav — tull med to
--    desimaler. Funksjonen tier, slik kategori_lonn tier der kilden tier.
--    Regelen kan ikke ligge i UI-et: et filter som bare finnes der er en
--    anbefaling, ikke en terskel.
--
-- 2. eierlonn_i_resultat FØLGER RADEN UT, og UI-et MÅ vise den. Der flagget er
--    usant er driftsresultatet regnet ETTER at lønn er betalt — da er
--    målbeløpet ikke det du tar ut, det er hva foretaket sitter igjen med i
--    tillegg til lønna di. Der flagget er sant gjør eieren arbeidet ulønnet,
--    og beløpet ligger nærmere det hun faktisk lever av. Samme skille mellom
--    eierdrift og lønnsdrift som resten av basen håndhever. Er flagget null,
--    vet vi det ikke, og forbeholdet skal vises.
--
-- typisk_omsetning_mnd står ved siden av kravet med vilje: «du må omsette for
-- 59 000 kr i måneden — et typisk frisørforetak omsetter for 110 000» er et
-- brukbart svar. Kravet alene er bare skummelt.
create function hva_ma_du_omsette(i_slug text, i_mal_mnd int)
returns table (
  slug text, navn text, ar int,
  driftsmargin_pct numeric,
  mal_mnd int,
  nodvendig_omsetning_mnd bigint,
  nodvendig_omsetning_ar bigint,
  typisk_omsetning_mnd bigint,
  andel_av_typisk_pct numeric,
  eierlonn_i_resultat boolean,
  ansatte_per_foretak numeric
)
language sql stable
set search_path = public
as $$
  select
    o.slug, o.navn, o.ar,
    o.driftsmargin_pct,
    i_mal_mnd,
    round(i_mal_mnd * 100.0 / o.driftsmargin_pct)::bigint,
    round(i_mal_mnd * 100.0 / o.driftsmargin_pct * 12)::bigint,
    (o.omsetning_per_foretak / 12)::bigint,
    case when o.omsetning_per_foretak > 0 then
      round(100.0 * (i_mal_mnd * 100.0 / o.driftsmargin_pct)
            / (o.omsetning_per_foretak / 12.0), 1) end,
    o.eierlonn_i_resultat,
    o.ansatte_per_foretak
  from kategori_oversikt() o
  where o.slug = i_slug
    and i_mal_mnd > 0
    and o.driftsmargin_pct > 0
    and o.omsetning_per_foretak is not null
$$;

grant execute on function hva_ma_du_omsette(text, int) to anon, authenticated;

comment on function hva_ma_du_omsette(text, int) is
  'Målinntekt invertert gjennom bransjens målte driftsmargin. Tier der marginen ikke er positiv. eierlonn_i_resultat sier om målbeløpet er det eieren tar ut eller det som kommer i tillegg til lønn.';
