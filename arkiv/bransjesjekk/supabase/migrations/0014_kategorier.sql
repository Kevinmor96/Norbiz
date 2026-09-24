-- Det folkelige kategorilaget. Kategoriene er redaksjonen vår — «hva folk
-- faktisk vurderer å starte» — og bor i basen slik at Lovable bare leser,
-- og slik at premium-gating av filteret kan håndheves her senere.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  navn        text not null,
  verden      text not null,
  beskrivelse text not null default '',
  farge       text not null default '#1B2A41',
  ikon        text not null default 'store',
  sortering   int  not null default 0
);

-- Én kategori samler flere koder, i to kildespråk: kilde='ssb' er
-- SN2007-koder for statistikk (12910/12937), kilde='brreg' er
-- SN2025-prefikser for selskapsmatching. Ingen FK til industries: Brreg-
-- prefikser som 41.0 finnes ikke i SN2007-kodeverket. En test håndhever at
-- ssb-kodene finnes, og at koder i samme kategori og kilde aldri overlapper
-- hierarkisk — ellers dobbelteller summene.
create table category_members (
  category_id uuid not null references categories (id) on delete cascade,
  nace_code   text not null,
  kilde       text not null check (kilde in ('ssb', 'brreg')),
  primary key (category_id, nace_code, kilde)
);

-- Kuratert kjedeliste. org_nr er hovedselskapet og kan mangle til det
-- målrettede Brreg-oppslaget har kjørt; merknad sier hva org_nr faktisk er
-- (morselskap, driftsselskap), for kjedens tall er hovedselskapets regnskap
-- og skal aldri utgis for å være hele kjeden.
create table brands (
  id          uuid primary key default gen_random_uuid(),
  navn        text not null unique,
  category_id uuid not null references categories (id) on delete cascade,
  org_nr      text,
  merknad     text not null default ''
);

create index brands_category_id_idx on brands (category_id);

alter table categories enable row level security;
alter table category_members enable row level security;
alter table brands enable row level security;

create policy categories_read on categories for select using (true);
create policy category_members_read on category_members for select using (true);
create policy brands_read on brands for select using (true);

grant select on categories, category_members, brands to anon, authenticated;
