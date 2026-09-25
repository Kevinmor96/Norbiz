-- Kommunenavn. `companies.kommune_code` er et firesifret nummer fra Brreg, og
-- uten en navnetabell endte det som «Kommune 3103» på skjermen — et tall som
-- ikke betyr noe for en leser. Frontend hadde en delvis liste, men den dekket
-- bare noen av kommunene, så feilen viste seg bare av og til.
--
-- Kilden er SSBs klassifikasjon 131 (Standard for kommuneinndeling), hentet
-- for 2024-årgangen fordi det er den Brreg registrerer adressene mot.
--
-- Egen tabell, ikke rader i `regions`: regions bærer fylkesårganger med
-- valid_from_year/valid_to_year fordi statistikken må mappes til riktig
-- vintage, og kommuner har ingen slik rolle her. De er bare et oppslag fra
-- nummer til navn, og fylkestilhørigheten ligger i de to første sifrene.
create table kommuner (
  code       text primary key,
  navn       text not null,
  fylke_code text generated always as (left(code, 2)) stored,
  source     text not null default 'ssb:klass131',
  vintage    int  not null default 2024,
  constraint kommuner_code_format check (code ~ '^\d{4}$')
);

create index kommuner_fylke_code_idx on kommuner (fylke_code);

alter table kommuner enable row level security;
create policy kommuner_read on kommuner for select using (true);
grant select on kommuner to anon, authenticated;

comment on table kommuner is
  'Oppslag kommunenummer -> navn, SSB klassifikasjon 131, 2024-årgangen (den Brreg bruker).';
