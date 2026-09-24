-- Hendelser, beslutningskjeder og hull.

-- Personene en hendelse eller et hull nevner ved navn, som en ordnet liste av
-- person-id-er. En liste på raden i stedet for en koblingstabell, fordi
-- RLS-policyen på hendelse og hull må kunne se hele lista for å skjule raden
-- når én av personene er sperret. En koblingstabell ville enten lekket id-en
-- til den sperrede personen eller skjult nettopp koblingen policyen trenger.
--
-- Postgres har ingen fremmednøkkel på elementer i en liste, så denne
-- triggeren gjør jobben ved skriving. Slettes en person senere, blir raden
-- usynlig (policyen finner ikke personen), ikke ødelagt.
create function intern.sjekk_personer() returns trigger
language plpgsql
set search_path = public, intern
as $$
begin
  if exists (
    select 1 from unnest(new.personer) as n(id)
    where not exists (select 1 from person p where p.id = n.id)
  ) then
    raise exception 'personer i % peker på en person som ikke finnes (%)', tg_table_name, new.key
      using errcode = 'foreign_key_violation', constraint = tg_table_name || '_personer_finnes';
  end if;
  if cardinality(new.personer) <> (select count(distinct x) from unnest(new.personer) as x) then
    raise exception 'personer i % har samme person to ganger (%)', tg_table_name, new.key
      using errcode = 'check_violation', constraint = tg_table_name || '_personer_unike';
  end if;
  return new;
end
$$;

create table hendelse (
  id uuid primary key,
  -- Naturlig nøkkel: dato|type|org|tittel.
  key text not null unique,
  dato text not null check (intern.er_isodato(dato)),
  presisjon presisjon not null,
  type hendelsestype not null,
  tittel text not null check (length(tittel) between 1 and 300),
  tekst text,
  org_id uuid references organisasjon (id),
  -- Bare når hendelsen ikke gjelder ett organ: da hører den til kommunen.
  kommune_id uuid references kommune (id) on delete cascade,
  personer uuid[] not null default '{}',
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint hendelse_id_fra_key check (id = intern.nokkel_id('hendelse', key)),
  constraint hendelse_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  constraint hendelse_presisjon_passer check (presisjon = intern.presisjon_for(dato)),
  constraint hendelse_org_eller_kommune check ((org_id is null) <> (kommune_id is null))
);

create index hendelse_org_idx on hendelse (org_id);
create index hendelse_kilde_idx on hendelse (kilde_id);

create trigger hendelse_belegg
  before insert or update on hendelse
  for each row execute function intern.sjekk_belegg();
create trigger hendelse_personer
  before insert or update on hendelse
  for each row execute function intern.sjekk_personer();

comment on column hendelse.type is
  'planlagt og strukturdebatt har ikke skjedd. RPC-ene skiller dem ut på typen, ikke på datoen.';

-- «Hvem bestemmer X?» som en ordnet kjede av organer. En prosess hører til én
-- kommune: reguleringsplanen i Tromsø er ikke den i Balsfjord.
create table prosess (
  id uuid primary key,
  kommune_id uuid not null references kommune (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tittel text not null,
  sporsmal text not null,
  unique (kommune_id, key)
);

create table prosess_steg (
  id uuid primary key,
  -- Naturlig nøkkel: kommune-slug|prosess|nr.
  key text not null unique,
  prosess_id uuid not null references prosess (id) on delete cascade,
  nr smallint not null check (nr >= 1),
  org_id uuid not null references organisasjon (id),
  myndighet myndighet not null,
  hva text not null,
  -- Belegg
  kilde_id uuid not null references kilde (id),
  verifisering verifisering not null,
  per text check (intern.er_isodato(per)),
  merknad text,
  hentet timestamptz,
  constraint prosess_steg_id_fra_key check (id = intern.nokkel_id('prosess_steg', key)),
  constraint prosess_steg_verifisert_har_tid check (verifisering <> 'verifisert' or hentet is not null),
  unique (prosess_id, nr)
);

create index prosess_steg_org_idx on prosess_steg (org_id);

create trigger prosess_steg_belegg
  before insert or update on prosess_steg
  for each row execute function intern.sjekk_belegg();

-- Noe grunnlaget nevner, men som ikke kan vises som fakta ennå. Metadata om
-- datasettet, ikke en påstand, og derfor uten belegg.
create table hull (
  id uuid primary key,
  -- Naturlig nøkkel: gjelder|hva.
  key text not null unique,
  org_id uuid not null references organisasjon (id),
  hva text not null,
  hvorfor text not null,
  personer uuid[] not null default '{}',
  constraint hull_id_fra_key check (id = intern.nokkel_id('hull', key))
);

create index hull_org_idx on hull (org_id);

create trigger hull_personer
  before insert or update on hull
  for each row execute function intern.sjekk_personer();
