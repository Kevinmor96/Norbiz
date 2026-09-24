-- Byggesteiner for RPC-ene: JSON for hver type i src/lib/data/kontrakt.ts, og
-- kommunens omfang.
--
-- Alt her er `security invoker` (standard) og `stable`. Funksjonene leser med
-- kallerens rettigheter, så RLS og kolonnerettighetene i 0008 gjelder også
-- her. Ingen av dem leser person.brreg_person_hash eller
-- person.innsigelse_status; anon har ikke rettighet til det, og kallet ville
-- feilet.
--
-- Sortering: tekst med `collate "C"` (kodepunkt), enumer i
-- deklarasjonsrekkefølge. lokal.ts sorterer likt.

-- Regler som også står i kontrakt.ts (LEDERTYPER, IKKE_SKJEDD_TYPER).
create function intern.er_leder(p rolletype) returns boolean
language sql immutable strict parallel safe
set search_path = public, intern
as $$
  select p in ('politisk_leder', 'utvalgsleder', 'toppleder', 'styreleder', 'daglig_leder',
               'dommer_leder', 'paatale_leder')
$$;

create function intern.er_skjedd(p hendelsestype) returns boolean
language sql immutable strict parallel safe
set search_path = public, intern
as $$ select p not in ('planlagt', 'strukturdebatt') $$;

-- ---------------------------------------------------------------------------
-- Kommunens omfang
-- ---------------------------------------------------------------------------

create function intern.kommune_for(p_kommunenr text) returns uuid
language sql stable
set search_path = public, intern
as $$ select k.id from kommune k where k.kommunenr = p_kommunenr $$;

-- Organene i kommunens datasett.
create function intern.omfang(p_kommune uuid) returns setof uuid
language sql stable
set search_path = public, intern
as $$ select ko.org_id from kommune_org ko where ko.kommune_id = p_kommune $$;

-- Hendelser om et organ i omfanget, eller om kommunen selv.
create function intern.omfang_hendelser(p_kommune uuid) returns setof uuid
language sql stable
set search_path = public, intern
as $$
  select h.id from hendelse h
  where h.org_id in (select intern.omfang(p_kommune)) or h.kommune_id = p_kommune
$$;

-- Hver påstand i kommunens omfang, med kilde og grad. Grunnlaget for
-- verifiseringstellingen og kildelista i kommune_oversikt.
create function intern.kommune_belegg(p_kommune uuid)
returns table (kilde_id uuid, verifisering verifisering)
language sql stable
set search_path = public, intern
as $$
  select o.kilde_id, o.verifisering from organisasjon o
  where o.id in (select intern.omfang(p_kommune))
  union all
  select r.kilde_id, r.verifisering from rolleinnehav r
  where r.org_id in (select intern.omfang(p_kommune))
  union all
  select re.kilde_id, re.verifisering from relasjon re
  where re.fra_org_id in (select intern.omfang(p_kommune))
    and re.til_org_id in (select intern.omfang(p_kommune))
  union all
  select n.kilde_id, n.verifisering from nokkeltall n
  where n.org_id in (select intern.omfang(p_kommune))
  union all
  select h.kilde_id, h.verifisering from hendelse h
  where h.id in (select intern.omfang_hendelser(p_kommune))
  union all
  select st.kilde_id, st.verifisering from prosess_steg st
  join prosess p on p.id = st.prosess_id
  where p.kommune_id = p_kommune
$$;

-- ---------------------------------------------------------------------------
-- JSON for typene i kontrakt.ts
-- ---------------------------------------------------------------------------

-- KildeUt
create function intern.j_kilde(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object('key', k.key, 'navn', k.navn, 'url', k.url, 'type', k.type, 'lisens', k.lisens)
  from kilde k where k.id = p_id
$$;

-- BeleggUt
create function intern.j_belegg(
  p_kilde uuid, p_verifisering verifisering, p_per text, p_merknad text, p_hentet timestamptz
) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'kilde', intern.j_kilde(p_kilde),
    'verifisering', p_verifisering,
    'per', p_per,
    'merknad', p_merknad,
    'hentet', p_hentet
  )
$$;

-- Kommune
create function intern.j_kommune(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'kommunenr', k.kommunenr, 'navn', k.navn, 'slug', k.slug, 'fylkesnr', k.fylkesnr,
    'fylke', k.fylke, 'sammenstilt', to_char(k.sammenstilt, 'YYYY-MM-DD')
  )
  from kommune k where k.id = p_id
$$;

-- OrganRef
create function intern.j_organ_ref(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'key', o.key, 'navn', o.navn, 'kortnavn', o.kortnavn, 'nivaa', o.nivaa,
    'organtype', o.organtype, 'status', o.status, 'sensitiv', o.sensitiv
  )
  from organisasjon o where o.id = p_id
$$;

-- Organ
create function intern.j_organ(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select intern.j_organ_ref(o.id) || jsonb_build_object(
    'orgnr', o.orgnr,
    'overordnet', (select ov.key from organisasjon ov where ov.id = o.overordnet_id),
    'kommunenr', o.kommunenr,
    'fylkesnr', o.fylkesnr,
    'rekkevidde', o.rekkevidde,
    'myndighet', to_jsonb(o.myndighet),
    'antall_medlemmer', o.antall_medlemmer,
    'gyldig_fra', o.gyldig_fra,
    'gyldig_til', o.gyldig_til,
    'beskrivelse', o.beskrivelse,
    'belegg', intern.j_belegg(o.kilde_id, o.verifisering, o.per, o.merknad, o.hentet)
  )
  from organisasjon o where o.id = p_id
$$;

-- PersonRef. Bare key og navn; det er alt anon kan lese.
create function intern.j_person(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$ select jsonb_build_object('key', p.key, 'navn', p.navn) from person p where p.id = p_id $$;

-- Rolle
create function intern.j_rolle(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'person', intern.j_person(r.person_id),
    'tittel', r.tittel,
    'rolletype', r.rolletype,
    'status', r.status,
    'parti', r.parti,
    'fra', r.fra,
    'til', r.til,
    'til_forventet', r.til_forventet,
    'belegg', intern.j_belegg(r.kilde_id, r.verifisering, r.per, r.merknad, r.hentet)
  )
  from rolleinnehav r where r.id = p_id
$$;

-- RolleIOrgan
create function intern.j_rolle_i_organ(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select intern.j_rolle(r.id) || jsonb_build_object('org', intern.j_organ_ref(r.org_id))
  from rolleinnehav r where r.id = p_id
$$;

-- Aktive roller av ledertypene i organet, som Rolle[].
create function intern.j_ledere(p_org uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select coalesce(
    jsonb_agg(
      intern.j_rolle(r.id)
      order by r.rolletype, r.status, p.key collate "C", r.fra collate "C" nulls first
    ),
    '[]'::jsonb
  )
  from rolleinnehav r
  join person p on p.id = r.person_id
  where r.org_id = p_org and r.til is null and intern.er_leder(r.rolletype)
$$;

-- NokkeltallUt
create function intern.j_nokkeltall(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'aar', n.aar,
    'periode', n.periode,
    'type', n.type,
    'verdi', n.verdi,
    'enhet', n.enhet,
    'konsern', n.konsern,
    'belegg', intern.j_belegg(n.kilde_id, n.verifisering, n.per, n.merknad, n.hentet)
  )
  from nokkeltall n where n.id = p_id
$$;

-- Eierandel, sett fra organet i den andre enden (`p_annen`).
create function intern.j_eierandel(p_id uuid, p_annen uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'org', intern.j_organ_ref(p_annen),
    'andel', re.andel,
    'belop_nok', re.belop_nok,
    'fra_dato', re.fra_dato,
    'til_dato', re.til_dato,
    'belegg', intern.j_belegg(re.kilde_id, re.verifisering, re.per, re.merknad, re.hentet)
  )
  from relasjon re where re.id = p_id
$$;

-- RelasjonUt. `ut`: organet er fra, og den andre enden er til.
create function intern.j_relasjon_ut(p_id uuid, p_retning text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select intern.j_eierandel(
           re.id,
           case p_retning when 'ut' then re.til_org_id else re.fra_org_id end
         )
         || jsonb_build_object('retning', p_retning, 'type', re.type)
  from relasjon re where re.id = p_id
$$;

-- Endring
create function intern.j_endring(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'dato', h.dato,
    'presisjon', h.presisjon,
    'type', h.type,
    'skjedd', intern.er_skjedd(h.type),
    'tittel', h.tittel,
    'tekst', h.tekst,
    'org', intern.j_organ_ref(h.org_id),
    'personer', (
      select coalesce(jsonb_agg(intern.j_person(n.id) order by n.nr), '[]'::jsonb)
      from unnest(h.personer) with ordinality as n (id, nr)
    ),
    'belegg', intern.j_belegg(h.kilde_id, h.verifisering, h.per, h.merknad, h.hentet)
  )
  from hendelse h where h.id = p_id
$$;

-- HullPunkt
create function intern.j_hull(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object('gjelder', intern.j_organ_ref(hu.org_id), 'hva', hu.hva, 'hvorfor', hu.hvorfor)
  from hull hu where hu.id = p_id
$$;
