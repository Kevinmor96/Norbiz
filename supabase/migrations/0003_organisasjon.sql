-- Organisasjonene, hvilke kommuner de hører til, og hvilke næringssegmenter
-- de påvirker.
--
-- En organisasjon er felles for hele landet. Statsforvalteren i Troms og
-- Finnmark er samme rad for Tromsø og Balsfjord. Hvilke organer som hører til
-- en kommune, står i kommune_org, og det er den tabellen som avgrenser alle
-- kommunespørringene.

create table organisasjon (
  id uuid primary key,
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  orgnr text unique check (orgnr ~ '^\d{9}$'),
  navn text not null check (length(navn) between 1 and 300),
  kortnavn text,
  nivaa nivaa not null,
  organtype organtype not null,
  overordnet_id uuid references organisasjon (id),
  kommunenr text check (kommunenr ~ '^\d{4}$'),
  fylkesnr text check (fylkesnr ~ '^\d{2}$'),
  rekkevidde rekkevidde,
  -- I kildens rekkefølge. Rekkefølgen vises.
  myndighet myndighet[] not null default '{}',
  antall_medlemmer integer check (antall_medlemmer > 0),
  gyldig_fra text check (intern.er_isodato(gyldig_fra)),
  gyldig_til text check (intern.er_isodato(gyldig_til)),
  gyldig daterange generated always as (
    daterange(intern.dato_fra(gyldig_fra), intern.dato_etter(gyldig_til), '[)')
  ) stored,
  status orgstatus not null,
  -- Domstol, politi, påtale og Forsvaret. Bare toppledere er synlige (RLS på
  -- rolleinnehav), og organet er aldri med i nettverksgrafen.
  sensitiv boolean not null,
  beskrivelse text not null check (length(beskrivelse) between 1 and 1000),
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint organisasjon_id_fra_key check (id = intern.nokkel_id('organisasjon', key)),
  constraint organisasjon_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint organisasjon_ikke_egen_overordnet check (overordnet_id <> id)
);

create index organisasjon_overordnet_idx on organisasjon (overordnet_id);
create index organisasjon_kilde_idx on organisasjon (kilde_id);

create trigger organisasjon_belegg
  before insert or update on organisasjon
  for each row execute function intern.sjekk_belegg();

comment on column organisasjon.gyldig is
  'Avledet av gyldig_fra/gyldig_til. Teksten er kilden og beholder presisjonen; intervallet er for spørringer.';

create table kommune_org (
  kommune_id uuid not null references kommune (id) on delete cascade,
  org_id uuid not null references organisasjon (id) on delete cascade,
  primary key (kommune_id, org_id)
);

create index kommune_org_org_idx on kommune_org (org_id);

comment on table kommune_org is
  'Organene i kommunens datasett. Avgrenser organkart, eierskap, nettverk, endringer og tellinger.';

create table segment (
  id uuid primary key,
  kode text not null unique check (kode ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  navn text not null,
  constraint segment_id_fra_kode check (id = intern.nokkel_id('segment', kode))
);

-- Vår egen klassifisering av hvilke segmenter et organ påvirker, ikke en
-- påstand om verden. Derfor uten belegg.
create table org_segment (
  org_id uuid not null references organisasjon (id) on delete cascade,
  segment_id uuid not null references segment (id) on delete cascade,
  -- 3 = primær, 2 = sekundær, 1 = indirekte.
  styrke smallint not null check (styrke between 1 and 3),
  primary key (org_id, segment_id)
);

create index org_segment_segment_idx on org_segment (segment_id);
