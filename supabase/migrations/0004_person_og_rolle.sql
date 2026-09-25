-- Personer og rollene deres.
--
-- Institusjon først: en person finnes bare gjennom en rolle i en organisasjon
-- (eller fordi en hendelse nevner henne). Tabellen er derfor tynn. Offentlig
-- lesbare kolonner er id, key og navn, gitt med kolonnerettigheter i
-- 0008_personvern.sql. Resten er for pipelinen og innsigelsesflyten.

create table person (
  id uuid primary key,
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  navn text not null check (length(navn) between 1 and 200),
  -- Hash av navn og fødselsdato fra Brregs rolle-API, bare for å skille
  -- navnebrødre i pipelinen. Fødselsdatoen lagres ikke. Aldri lesbar for
  -- anon eller authenticated.
  brreg_person_hash text unique,
  -- `sperret` skjuler personen, rollene hennes og hver hendelse og hvert
  -- hull som nevner henne, fra alle offentlige lesninger (RLS).
  innsigelse_status innsigelse_status not null default 'ingen',
  constraint person_id_fra_key check (id = intern.nokkel_id('person', key))
);

-- Én tabell for rolleinnehav, med tittel og rolletype på raden.
--
-- Grunnlaget (§5.2) foreslår en egen `rolle`-tabell for stillingen, uavhengig
-- av hvem som har den. Den gir mening når stillingen har egne fakta: vakanser,
-- rollevekt, om vervet er lovpålagt. Datasettet har ingen slike fakta, og hver
-- rad i det er et innehav. En egen tabell ville vært et tomt mellomledd med
-- nøkler vi måtte finne på. Trengs den senere, kan den skilles ut med en
-- migrasjon uten å endre RPC-formene.
create table rolleinnehav (
  id uuid primary key,
  -- Naturlig nøkkel: org|person|rolletype|fra (se src/lib/data/samle.ts).
  key text not null unique,
  org_id uuid not null references organisasjon (id),
  person_id uuid not null references person (id),
  tittel text not null check (length(tittel) between 1 and 200),
  rolletype rolletype not null,
  status rollestatus not null,
  -- Bare for roller i folkevalgte organer (trigger under).
  parti text check (length(parti) between 1 and 60),
  fra text check (intern.er_isodato(fra)),
  -- Satt når rollen er avsluttet. En rolle uten til er aktiv.
  til text check (intern.er_isodato(til)),
  -- Satt når slutten er kjent, men ikke inntruffet.
  til_forventet text check (intern.er_isodato(til_forventet)),
  gyldig daterange generated always as (daterange(intern.dato_fra(fra), intern.dato_etter(til), '[)')) stored,
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint rolleinnehav_id_fra_key check (id = intern.nokkel_id('rolleinnehav', key)),
  constraint rolleinnehav_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint rolleinnehav_til_eller_forventet check (til is null or til_forventet is null),
  -- Samme person kan ikke ha samme rolle i samme organ to ganger samtidig.
  constraint rolleinnehav_ingen_overlapp exclude using gist (
    org_id with =, person_id with =, rolletype with =, gyldig with &&
  )
);

create index rolleinnehav_person_idx on rolleinnehav (person_id);
create index rolleinnehav_kilde_idx on rolleinnehav (kilde_id);

create trigger rolleinnehav_belegg
  before insert or update on rolleinnehav
  for each row execute function intern.sjekk_belegg();

-- Partitilhørighet er en særlig kategori (GDPR art. 9). Den er bare åpenbart
-- offentliggjort for folkevalgte, og skal aldri utledes for andre. Samme liste
-- som POLITISKE_ORGANTYPER i src/lib/data/kontrakt.ts.
create function intern.sjekk_parti() returns trigger
language plpgsql
set search_path = public, intern
as $$
begin
  if new.parti is not null
     and (select o.organtype from organisasjon o where o.id = new.org_id)
         not in ('folkevalgt_organ', 'utvalg', 'lovgivende') then
    raise exception 'Parti føres bare for roller i folkevalgte organer (%)', new.key
      using errcode = 'check_violation', constraint = 'rolleinnehav_parti_bare_folkevalgte';
  end if;
  return new;
end
$$;

create trigger rolleinnehav_parti
  before insert or update on rolleinnehav
  for each row execute function intern.sjekk_parti();
