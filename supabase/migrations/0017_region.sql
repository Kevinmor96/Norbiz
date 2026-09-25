-- Regionregisteret: fylkene og kommunene Maktkart dekker, også de uten
-- datasett.
--
-- Registeret er ikke et kommunedatasett. Det sier hvilke kommuner som finnes,
-- hva de heter på alle språkformene, hvor mange som bor der og om kommunen er i
-- forvaltningsområdet for samisk språk. Alt er hentet med skript fra SSB og
-- Kartverket (src/data/region/nord-norge.json), så radene har belegg som
-- påstandene ellers i basen. Folketallet har sitt eget belegg (SSB 07459),
-- navn og nummer sitt (Klass), og det korte navnet og forvaltningsområdet sitt
-- (Kartverket).
--
-- `kommune` er fortsatt tabellen for datasettene. En kommune i registeret har
-- datasett når det finnes en rad i `kommune` med samme kommunenummer.
--
-- id-ene avledes av slug, som `kommune`: et kommunenummer er ikke en konstant.

create table region (
  id uuid primary key,
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  navn text not null,
  sammenstilt date not null,
  merknad text not null,
  constraint region_id_fra_key check (id = intern.nokkel_id('region', key))
);

comment on table region is 'Regionregisteret: navn, dato og merknad. Én rad per region.';

create table fylke (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  fylkesnr text not null unique check (fylkesnr ~ '^\d{2}$'),
  navn text not null,
  navn_offisielt text not null,
  -- Folketall per 1. januar i `folketall_aar`, med eget belegg.
  folketall integer not null check (folketall >= 0),
  folketall_aar smallint not null check (folketall_aar between 1900 and 2100),
  folketall_kilde_id uuid not null references kilde (id),
  folketall_verifisering verifisering not null,
  folketall_per text check (intern.er_isodato(folketall_per)),
  folketall_merknad text,
  folketall_hentet timestamptz,
  -- Belegg for nummer og offisielt navn.
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint fylke_id_fra_slug check (id = intern.nokkel_id('fylke', slug)),
  constraint fylke_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint fylke_folketall_verifisert_har_tid
    check (folketall_verifisering <> 'verifisert' or folketall_hentet is not null)
);

comment on table fylke is 'Fylkene i regionregisteret, med offisielle navn på alle språkformene.';

create table region_kommune (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kommunenr text not null unique check (kommunenr ~ '^\d{4}$'),
  fylkesnr text not null references fylke (fylkesnr) on update cascade,
  -- Den norske delen, til trange flater.
  navn text not null,
  -- SSBs offisielle navn med alle språkformene: «Guovdageaidnu - Kautokeino».
  navn_offisielt text not null,
  folketall integer not null check (folketall >= 0),
  folketall_aar smallint not null check (folketall_aar between 1900 and 2100),
  folketall_kilde_id uuid not null references kilde (id),
  folketall_verifisering verifisering not null,
  folketall_per text check (intern.er_isodato(folketall_per)),
  folketall_merknad text,
  folketall_hentet timestamptz,
  samisk_forvaltningsomrade boolean not null,
  -- Belegg for det korte navnet og forvaltningsområdet (Kartverket).
  geografi_kilde_id uuid not null references kilde (id),
  geografi_verifisering verifisering not null,
  geografi_per text check (intern.er_isodato(geografi_per)),
  geografi_merknad text,
  geografi_hentet timestamptz,
  -- Belegg for nummer og offisielt navn (Klass).
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint region_kommune_id_fra_slug check (id = intern.nokkel_id('region_kommune', slug)),
  constraint region_kommune_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint region_kommune_folketall_verifisert_har_tid
    check (folketall_verifisering <> 'verifisert' or folketall_hentet is not null),
  constraint region_kommune_geografi_verifisert_har_tid
    check (geografi_verifisering <> 'verifisert' or geografi_hentet is not null)
);

create index region_kommune_fylkesnr_idx on region_kommune (fylkesnr);

comment on table region_kommune is
  'Kommunene i regionregisteret. Har datasett når kommune har en rad med samme kommunenr.';

-- Personvern: ingen personopplysninger her. Lesbart for alle, som kilde og
-- kommune, med RLS på som for hver tabell i public.
alter table region enable row level security;
alter table fylke enable row level security;
alter table region_kommune enable row level security;

revoke all on region, fylke, region_kommune from anon, authenticated;
grant select on region, fylke, region_kommune to anon, authenticated;

create policy region_les on region for select to anon, authenticated using (true);
create policy fylke_les on fylke for select to anon, authenticated using (true);
create policy region_kommune_les on region_kommune for select to anon, authenticated using (true);
