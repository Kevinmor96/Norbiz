-- De to tabellene publikum skriver til. Begge kan bare skrives, aldri leses,
-- av anon og authenticated (0008_personvern.sql). Ingen av dem seedes, så
-- gen_random_uuid() er greit her.

-- Venteliste til Pro og «stem fram neste kommune».
--
-- Ingen unik-constraint på e-post. En feilmelding ved duplikat ville fortalt
-- hvem som helst om en adresse allerede står på lista. Duplikater ryddes når
-- lista leses, med service-nøkkelen.
create table venteliste (
  id uuid primary key default gen_random_uuid(),
  opprettet timestamptz not null default now(),
  -- Kommunen de vil ha. Trenger ikke finnes i basen ennå.
  kommunenr text not null check (kommunenr ~ '^\d{4}$'),
  epost text not null check (
    length(epost) between 6 and 254 and epost ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

comment on table venteliste is
  'Skrives av anon, leses bare med service-nøkkelen. Personopplysning: e-post.';

-- «Er dette deg?» Retting, protest (GDPR art. 21) eller sletting.
--
-- person_key og org_key er tekst, ikke fremmednøkler. En innsigelse skal
-- bevares selv om personen slettes, og den er ofte skrevet om noe vi har
-- feil.
create table innsigelse (
  id uuid primary key default gen_random_uuid(),
  mottatt timestamptz not null default now(),
  type innsigelsestype not null,
  person_key text check (length(person_key) between 1 and 200),
  org_key text check (length(org_key) between 1 and 200),
  tekst text not null check (length(tekst) between 1 and 4000),
  -- For å kunne svare. Påkrevd.
  epost text not null check (
    length(epost) between 6 and 254 and epost ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  -- Settes av den som behandler innsigelsen, aldri av innsenderen.
  status innsigelse_behandling not null default 'mottatt',
  behandlet timestamptz,
  constraint innsigelse_gjelder_noe check (person_key is not null or org_key is not null)
);

comment on table innsigelse is
  'Skrives av anon, leses bare med service-nøkkelen. Behandles innen fristen i personvernerklæringen.';
