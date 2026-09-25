-- Relasjoner mellom organisasjoner, og nøkkeltall.

create table relasjon (
  id uuid primary key,
  -- Naturlig nøkkel: fra|type|til|fra_dato.
  key text not null unique,
  fra_org_id uuid not null references organisasjon (id),
  til_org_id uuid not null references organisasjon (id),
  type relasjonstype not null,
  -- Eierandel i prosent. Uten skala, så 99.99 og 40 kommer ut slik de kom inn.
  andel numeric check (andel > 0 and andel <= 100),
  belop_nok bigint check (belop_nok >= 0),
  fra_dato text check (intern.er_isodato(fra_dato)),
  til_dato text check (intern.er_isodato(til_dato)),
  gyldig daterange generated always as (daterange(intern.dato_fra(fra_dato), intern.dato_etter(til_dato), '[)')) stored,
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint relasjon_id_fra_key check (id = intern.nokkel_id('relasjon', key)),
  constraint relasjon_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint relasjon_ikke_til_seg_selv check (fra_org_id <> til_org_id),
  constraint relasjon_andel_bare_eier check (andel is null or type = 'eier')
);

create index relasjon_fra_idx on relasjon (fra_org_id);
create index relasjon_til_idx on relasjon (til_org_id);
create index relasjon_kilde_idx on relasjon (kilde_id);

create trigger relasjon_belegg
  before insert or update on relasjon
  for each row execute function intern.sjekk_belegg();

-- Et tall har år. Et nøkkeltall uten regnskapsår tas ikke inn; det føres som
-- hull i stedet. Morselskap og konsern skilles der kilden skiller dem.
create table nokkeltall (
  id uuid primary key,
  -- Naturlig nøkkel: org|aar|periode|type|konsern.
  key text not null unique,
  org_id uuid not null references organisasjon (id),
  aar smallint not null check (aar between 1800 and 2100),
  -- Delår: H1, H2, Q1–Q4.
  periode text check (periode ~ '^(H[12]|Q[1-4])$'),
  type nokkeltalltype not null,
  verdi numeric not null,
  enhet enhet not null,
  -- true = konsern, false = morselskap/selskap, null = kilden sier det ikke.
  konsern boolean,
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint nokkeltall_id_fra_key check (id = intern.nokkel_id('nokkeltall', key)),
  constraint nokkeltall_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint nokkeltall_enhet_passer check ((enhet = 'aarsverk') = (type = 'aarsverk')),
  constraint nokkeltall_en_per_aar unique nulls not distinct (org_id, aar, periode, type, konsern)
);

create index nokkeltall_kilde_idx on nokkeltall (kilde_id);

create trigger nokkeltall_belegg
  before insert or update on nokkeltall
  for each row execute function intern.sjekk_belegg();
