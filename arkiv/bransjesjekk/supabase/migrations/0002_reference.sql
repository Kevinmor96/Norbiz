-- Hierarkiet må være komplett: hvert femsifret kodepunkt trenger sine 3- og
-- 2-siffer-forfedre, fordi regionale rader kun finnes på nivå 2-3.
create table industries (
  id           uuid primary key default gen_random_uuid(),
  nace_code    text not null unique,
  nace_level   int  not null check (nace_level between 1 and 5),
  parent_code  text references industries (nace_code),
  name         text not null,
  common_name  text not null,
  slug         text not null unique,
  description  text,
  search_terms text[] not null default '{}'
);

create index industries_parent_code_idx on industries (parent_code);
create index industries_nace_level_idx on industries (nace_level);
create index industries_search_terms_idx on industries using gin (search_terms);

-- Fylkesinndelingen endret seg i 2020 (19 -> 11) og 2024 (11 -> 15). Uten
-- årgangsfelt blir en tidsserie per fylke stille feil.
create table regions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  level           region_level not null,
  parent_code     text,
  valid_from_year int not null,
  valid_to_year   int,
  unique (code, valid_from_year),
  constraint regions_valid_range check (valid_to_year is null or valid_to_year >= valid_from_year)
);

create index regions_level_idx on regions (level);

-- Konkurransescoren trenger folketall per region og år.
create table region_population (
  region_id    uuid not null references regions (id) on delete cascade,
  year         int  not null,
  innbyggere   int  not null check (innbyggere >= 0),
  source       text not null,
  data_quality data_quality not null,
  primary key (region_id, year)
);
