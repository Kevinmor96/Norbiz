-- Nyhetsbrevpåmelding. Målet er én ting: e-postadressen, med minst mulig
-- friksjon. Alt annet er valgfritt og kan komme senere.
--
-- RETTIGHETENE ER ASYMMETRISKE, og det er hele poenget: anon kan INSERT, men
-- ikke SELECT, UPDATE eller DELETE. En liste over e-postadresser er den ene
-- tabellen i basen som ikke er offentlig informasjon — resten er SSB- og
-- Brreg-tall som allerede er publisert. Med select-rett på anon ville hvem som
-- helst kunnet laste ned abonnentlisten med anon-nøkkelen fra frontend-bundelen.
--
-- Utsending og domene håndteres i Lovable; denne tabellen er bare registeret.
create table newsletter_signups (
  id         uuid primary key default gen_random_uuid(),
  epost      text not null,
  kilde      text not null default 'forside',
  opprettet  timestamptz not null default now(),
  -- Normalisert form, slik at «Kari@Eksempel.no» og «kari@eksempel.no» er
  -- samme abonnent. Unikhet håndheves på denne, ikke på det brukeren skrev.
  epost_norm text generated always as (lower(btrim(epost))) stored,
  -- Sjekken kjører på den trimmede formen, ikke på det brukeren skrev. Folk
  -- limer inn adresser med mellomrom rundt, og en avvist påmelding på grunn av
  -- et usynlig tegn er en tapt abonnent. Mellomrom INNE i adressen avvises
  -- fortsatt.
  constraint newsletter_epost_format
    check (btrim(epost) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint newsletter_epost_lengde check (length(btrim(epost)) between 5 and 254),
  constraint newsletter_kilde_lengde check (length(kilde) <= 40)
);

create unique index newsletter_signups_epost_norm_key on newsletter_signups (epost_norm);

alter table newsletter_signups enable row level security;

-- Alle kan melde seg på. Ingen kan lese, endre eller slette — heller ikke
-- innloggede brukere. Eksport av lista gjøres med service-role-nøkkelen.
create policy newsletter_insert_alle on newsletter_signups
  for insert to anon, authenticated with check (true);

grant insert on newsletter_signups to anon, authenticated;

comment on table newsletter_signups is
  'Nyhetsbrevabonnenter. anon har kun insert — aldri select, ellers kan lista lastes ned med den offentlige nøkkelen.';
