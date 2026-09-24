-- Grunnlaget: utvidelser, verdilister og hjelpefunksjoner.
--
-- Verdilistene er enumer i samme rekkefølge som i src/lib/data/kontrakt.ts.
-- Rekkefølgen er ikke pynt: RPC-ene sorterer på den, og lokal.ts gjør det
-- samme med listene i kontrakt.ts. tests/schema.test.ts sjekker at de er like.

-- btree_gist trengs for at samme person ikke kan ha samme rolle i samme organ
-- i to overlappende perioder (exclusion constraint på uuid, enum og daterange).
-- Supabase legger utvidelser i schemaet `extensions`.
create extension if not exists btree_gist with schema extensions;

-- Hjelpefunksjoner ligger i `intern`, ikke i `public`. PostgREST eksponerer
-- alle funksjoner i public som /rpc/..., og `supabase gen types` tar dem med.
-- Da er det offentlige API-et nøyaktig RPC-ene i 0010–0014 og ikke noe mer.
create schema if not exists intern;

create type kildetype as enum ('register', 'offisiell', 'media', 'sekundaer', 'oppslagsverk');
create type verifisering as enum ('verifisert', 'oppgitt', 'maa_verifiseres');
create type presisjon as enum ('dag', 'maaned', 'aar');

create type nivaa as enum (
  'stat', 'fylke', 'kommune', 'interkommunal', 'samisk', 'privat', 'interesse', 'mellomstatlig'
);
create type organtype as enum (
  'kommune', 'fylkeskommune', 'folkevalgt_organ', 'utvalg', 'raad', 'administrasjon',
  'departement', 'direktorat', 'etat', 'statsforvalter', 'domstol', 'paatale', 'politi',
  'tilsyn', 'nemnd', 'lovgivende', 'KF', 'FKF', 'AS', 'ASA', 'IKS', 'SA', 'sparebank',
  'stiftelse', 'HF', 'RHF', 'universitet', 'forskning', 'forening', 'samarbeid', 'saerlovselskap'
);
create type myndighet as enum (
  'vedtak', 'regelverk', 'tilsyn', 'konsesjon', 'klage', 'finansiering', 'innkjop',
  'eierskap', 'planmyndighet', 'innstilling', 'raadgivning', 'lobby'
);
create type rekkevidde as enum ('kommune', 'region', 'fylke', 'nasjonal', 'internasjonal');
create type orgstatus as enum ('aktiv', 'nedlagt');
create type rolletype as enum (
  'politisk_leder', 'folkevalgt', 'utvalgsleder', 'utvalgsmedlem', 'toppleder',
  'nestleder_adm', 'seksjonsleder', 'styreleder', 'nestleder', 'styremedlem', 'varamedlem',
  'daglig_leder', 'dommer_leder', 'paatale_leder', 'tillitsvalgt'
);
create type rollestatus as enum ('fast', 'fungerende', 'konstituert', 'permisjon', 'vara');
create type relasjonstype as enum (
  'eier', 'overordnet', 'medlem_av', 'sammenslatt_til', 'splittet_fra', 'erstattet_av',
  'samarbeid', 'finansierer', 'klageinstans_for', 'tilsyn_med', 'leverandor_til'
);
create type nokkeltalltype as enum (
  'omsetning', 'driftsresultat', 'aarsresultat', 'resultat_for_skatt', 'egenkapital',
  'utbytte', 'omsatt_verdi', 'merforbruk', 'underskudd', 'aarsverk'
);
create type enhet as enum ('NOK', 'aarsverk');
create type hendelsestype as enum (
  'rollebytte', 'opprettet', 'nedlagt', 'splittet', 'sammenslatt', 'vedtak', 'valg',
  'utbytte', 'regnskap', 'strukturdebatt', 'planlagt'
);

-- Personens status etter en innsigelse. `sperret` fjerner personen fra alle
-- offentlige lesninger (se 0008_personvern.sql).
create type innsigelse_status as enum ('ingen', 'under_behandling', 'sperret');
create type innsigelsestype as enum ('retting', 'protest', 'sletting');
create type innsigelse_behandling as enum ('mottatt', 'under_behandling', 'avsluttet');

-- Deterministisk id fra naturlig nøkkel. Seed-en kaller denne i stedet for
-- gen_random_uuid(): samme nøkkel gir samme id i hver kjøring og i hver base.
-- I Bransjesjekk flyttet en tilfeldig id alle avledede tall mellom kjøringer
-- mens kildedataene var byte-identiske.
create function intern.nokkel_id(p_tabell text, p_nokkel text) returns uuid
language sql immutable strict parallel safe
set search_path = public, intern
as $$ select md5(p_tabell || ':' || p_nokkel)::uuid $$;

-- ISO-dato med valgfri presisjon: YYYY, YYYY-MM eller YYYY-MM-DD.
create function intern.er_isodato(p text) returns boolean
language sql immutable strict parallel safe
set search_path = public, intern
as $$ select p ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$' $$;

-- Første dag i perioden en ISO-dato dekker: '2019' -> 2019-01-01.
-- Bygget med make_date, som er immutable, i stedet for en tekst-cast, som
-- avhenger av DateStyle.
create function intern.dato_fra(p text) returns date
language sql immutable strict parallel safe
set search_path = public, intern
as $$
  select make_date(
    substr(p, 1, 4)::int,
    coalesce(nullif(substr(p, 6, 2), '')::int, 1),
    coalesce(nullif(substr(p, 9, 2), '')::int, 1)
  )
$$;

-- Dagen etter perioden en ISO-dato dekker, altså en eksklusiv øvre grense:
-- '2019' -> 2020-01-01, '2025-09' -> 2025-10-01, '2025-09-30' -> 2025-10-01.
create function intern.dato_etter(p text) returns date
language sql immutable strict parallel safe
set search_path = public, intern
as $$
  select case length(p)
    when 4 then make_date(substr(p, 1, 4)::int + 1, 1, 1)
    when 7 then case substr(p, 6, 2)::int
      when 12 then make_date(substr(p, 1, 4)::int + 1, 1, 1)
      else make_date(substr(p, 1, 4)::int, substr(p, 6, 2)::int + 1, 1)
    end
    else dato_fra(p) + 1
  end
$$;

-- Presisjonen en ISO-dato har, ut fra lengden.
create function intern.presisjon_for(p text) returns presisjon
language sql immutable strict parallel safe
set search_path = public, intern
as $$ select (case length(p) when 4 then 'aar' when 7 then 'maaned' else 'dag' end)::presisjon $$;
