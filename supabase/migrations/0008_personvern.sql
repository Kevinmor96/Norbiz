-- Personvernet håndheves her, på basistabellene. Ikke i views.
--
-- Et view som filtrerer, beskytter ingenting så lenge basistabellen er åpen:
-- hvem som helst med den offentlige nøkkelen kan spørre tabellen direkte.
-- Derfor:
--
--   1. RLS er på for hver tabell.
--   2. anon og authenticated får bare SELECT, og bare på det som er offentlig.
--      person er lesbar kolonne for kolonne: id, key og navn.
--   3. venteliste og innsigelse kan bare skrives, og bare de kolonnene
--      innsenderen skal fylle ut.
--   4. RPC-ene i 0010–0014 er `security invoker`. De ser nøyaktig det kalleren
--      ser, og ingen funksjon er `security definer`.
--
-- Reglene i policyene:
--
--   - En person med innsigelse_status = 'sperret' er usynlig. Det gjelder
--     personen, rollene hennes og hver hendelse og hvert hull som nevner
--     henne. Policyene på rolleinnehav, hendelse og hull spør person-tabellen,
--     og der er den sperrede personen allerede filtrert bort for kalleren.
--   - I sensitive organer (domstol, politi, påtale, Forsvaret) er bare
--     toppleder, dommer_leder og paatale_leder synlige.

-- ---------------------------------------------------------------------------
-- Rettigheter. Supabase gir anon og authenticated alle rettigheter på nye
-- tabeller (default privileges). Vi tar alt tilbake og gir eksplisitt.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  kilde, kommune, kommune_org, organisasjon, segment, org_segment,
  rolleinnehav, relasjon, nokkeltall, hendelse, prosess, prosess_steg, hull
to anon, authenticated;

-- Bare det offentlige. brreg_person_hash og innsigelse_status leses aldri.
grant select (id, key, navn) on person to anon, authenticated;

-- Bare skriving, og bare feltene innsenderen fyller ut. id, tidspunkt og
-- behandlingsstatus kommer fra standardverdiene.
grant insert (kommunenr, epost) on venteliste to anon, authenticated;
grant insert (type, person_key, org_key, tekst, epost) on innsigelse to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table kilde enable row level security;
alter table kommune enable row level security;
alter table kommune_org enable row level security;
alter table organisasjon enable row level security;
alter table segment enable row level security;
alter table org_segment enable row level security;
alter table person enable row level security;
alter table rolleinnehav enable row level security;
alter table relasjon enable row level security;
alter table nokkeltall enable row level security;
alter table hendelse enable row level security;
alter table prosess enable row level security;
alter table prosess_steg enable row level security;
alter table hull enable row level security;
alter table venteliste enable row level security;
alter table innsigelse enable row level security;

-- Offentlige tabeller uten personopplysninger: alle rader.
create policy kilde_les on kilde for select to anon, authenticated using (true);
create policy kommune_les on kommune for select to anon, authenticated using (true);
create policy kommune_org_les on kommune_org for select to anon, authenticated using (true);
create policy organisasjon_les on organisasjon for select to anon, authenticated using (true);
create policy segment_les on segment for select to anon, authenticated using (true);
create policy org_segment_les on org_segment for select to anon, authenticated using (true);
create policy relasjon_les on relasjon for select to anon, authenticated using (true);
create policy nokkeltall_les on nokkeltall for select to anon, authenticated using (true);
create policy prosess_les on prosess for select to anon, authenticated using (true);
create policy prosess_steg_les on prosess_steg for select to anon, authenticated using (true);

-- En sperret person finnes ikke for offentligheten.
create policy person_les on person for select to anon, authenticated
  using (innsigelse_status <> 'sperret');

-- En rolle er synlig når personen er synlig og organet enten ikke er
-- sensitivt eller rollen er en topplederrolle. Samme lister som
-- SENSITIV_SYNLIGE_ROLLETYPER i src/lib/data/kontrakt.ts.
create policy rolleinnehav_les on rolleinnehav for select to anon, authenticated
  using (
    exists (select 1 from person p where p.id = rolleinnehav.person_id)
    and (
      rolletype in ('toppleder', 'dommer_leder', 'paatale_leder')
      or exists (
        select 1 from organisasjon o
        where o.id = rolleinnehav.org_id and not o.sensitiv
      )
    )
  );

-- En hendelse eller et hull er synlig når alle personene det nevner, er
-- synlige. Teksten kan inneholde navnet, så raden må bort, ikke bare koblingen.
create policy hendelse_les on hendelse for select to anon, authenticated
  using (
    not exists (
      select 1 from unnest(hendelse.personer) as n(id)
      where not exists (select 1 from person p where p.id = n.id)
    )
  );
create policy hull_les on hull for select to anon, authenticated
  using (
    not exists (
      select 1 from unnest(hull.personer) as n(id)
      where not exists (select 1 from person p where p.id = n.id)
    )
  );

-- Innsending. Ingen select-policy og ingen select-rettighet: det som er
-- sendt inn, kan ikke leses tilbake med den offentlige nøkkelen.
create policy venteliste_send on venteliste for insert to anon, authenticated
  with check (true);
create policy innsigelse_send on innsigelse for insert to anon, authenticated
  with check (status = 'mottatt' and behandlet is null);
