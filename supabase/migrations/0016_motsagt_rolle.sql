-- Roller registeret har motsagt.
--
-- Sier registeret noe annet om en rolle det selv fører (daglig leder,
-- styreleder, nestleder, styremedlem, varamedlem), har registeret forrang.
-- Grunnlagets rolle avsluttes likevel ikke med en dato: vi vet ikke når den
-- eventuelt sluttet, og hentedatoen ville vært en oppdiktet sluttdato. Rollen
-- merkes `motsagt`. Den er da ikke aktiv, men står i historikken, og
-- merknaden sier hva registeret har. Se `Rolleinnehav.motsagt` i
-- src/data/types.ts.
--
-- «Aktiv» er dermed ikke lenger bare `til is null`. Regelen står ett sted,
-- `intern.er_aktiv`, og de RPC-ene som skiller aktive roller fra tidligere,
-- byttes ut med samme kropp som før, bare med den regelen:
--
--   intern.j_rolle            fra 0009, med feltet motsagt
--   intern.j_ledere           fra 0009
--   public.kommune_oversikt   fra 0010, ledere
--   public.organ_profil       fra 0012, roller.naa og roller.tidligere
--   public.nettverk           fra 0013, aktuelle roller
--
-- Samme regel som `erAktiv` i src/lib/data/lokal.ts. tests/kontrakt.test.ts og
-- tests/mal.test.ts holder dem like.

alter table rolleinnehav add column motsagt boolean not null default false;

comment on column rolleinnehav.motsagt is
  'Registeret sier noe annet om rollen. Ikke aktiv, men i historikken. til settes ikke.';

-- En rolle er aktiv når den ikke er avsluttet og ikke motsagt.
create function intern.er_aktiv(p_til text, p_motsagt boolean) returns boolean
language sql immutable parallel safe
set search_path = public, intern
as $$ select p_til is null and not coalesce(p_motsagt, false) $$;

-- Samme rettigheter som byggesteinene i 0015.
revoke all on function intern.er_aktiv(text, boolean) from public, anon, authenticated;
grant execute on function intern.er_aktiv(text, boolean) to anon, authenticated, service_role;

create or replace function intern.j_rolle(p_id uuid) returns jsonb
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
    'motsagt', r.motsagt,
    'belegg', intern.j_belegg(r.kilde_id, r.verifisering, r.per, r.merknad, r.hentet)
  )
  from rolleinnehav r where r.id = p_id
$$;

create or replace function intern.j_ledere(p_org uuid) returns jsonb
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
  where r.org_id = p_org and intern.er_aktiv(r.til, r.motsagt) and intern.er_leder(r.rolletype)
$$;

create or replace function public.kommune_oversikt(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with k as (
    select * from kommune where kommunenr = p_kommunenr
  ),
  o as (
    select intern.omfang((select id from k)) as id
  ),
  kommuneorgan as (
    select org.id from organisasjon org
    where org.id in (select id from o)
      and org.organtype = 'kommune' and org.kommunenr = p_kommunenr
    order by org.key collate "C"
    limit 1
  ),
  styret as (
    select org.id from organisasjon org
    where org.id in (select id from o)
      and org.organtype = 'folkevalgt_organ' and org.status = 'aktiv'
      and org.overordnet_id = (select id from kommuneorgan)
    order by org.key collate "C"
    limit 1
  ),
  roller as (
    select r.id, r.org_id, r.person_id, r.rolletype, r.status, r.til, r.motsagt from rolleinnehav r
    where r.org_id in (select id from o)
  ),
  eierrel as (
    select re.id, re.til_org_id, re.andel, re.belop_nok from relasjon re
    where re.type = 'eier' and re.til_dato is null
      and re.fra_org_id = (select id from kommuneorgan)
      and re.til_org_id in (select id from o)
  ),
  belegg as (
    select b.kilde_id, b.verifisering from intern.kommune_belegg((select id from k)) b
  ),
  hend as (
    select h.id, h.dato, h.type, h.tittel from hendelse h
    where h.id in (select intern.omfang_hendelser((select id from k)))
  )
  select jsonb_build_object(
    'kommune', intern.j_kommune(k.id)
      || jsonb_build_object('grunnlag', k.grunnlag, 'merknad', k.merknad),
    'kommuneorgan', (select intern.j_organ_ref(id) from kommuneorgan),
    'kommunestyre', (
      select jsonb_build_object(
        'org', intern.j_organ_ref(org.id),
        'antall_medlemmer', org.antall_medlemmer,
        'belegg', intern.j_belegg(org.kilde_id, org.verifisering, org.per, org.merknad, org.hentet)
      )
      from organisasjon org where org.id = (select id from styret)
    ),
    'ledere', (
      select coalesce(
        jsonb_agg(
          intern.j_rolle_i_organ(r.id)
          order by r.rolletype, og.key collate "C", r.status, p.key collate "C"
        ),
        '[]'::jsonb
      )
      from roller r
      join organisasjon og on og.id = r.org_id
      join person p on p.id = r.person_id
      where intern.er_aktiv(r.til, r.motsagt)
        and r.rolletype in ('politisk_leder', 'toppleder')
        and og.kommunenr = p_kommunenr
    ),
    'eierskap', jsonb_build_object(
      'direkte', (select count(distinct til_org_id) from eierrel),
      'heleide', (select count(distinct til_org_id) from eierrel where andel = 100)
    ),
    'utbytte', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'selskap', intern.j_organ_ref(re.til_org_id),
            'belop_nok', re.belop_nok,
            'belegg', intern.j_belegg(re.kilde_id, re.verifisering, re.per, re.merknad, re.hentet)
          )
          order by re.belop_nok desc, s.key collate "C"
        ),
        '[]'::jsonb
      )
      from eierrel e
      join relasjon re on re.id = e.id
      join organisasjon s on s.id = re.til_org_id
      where re.belop_nok is not null
    ),
    'siste_endringer', (
      select coalesce(
        jsonb_agg(intern.j_endring(x.id) order by x.dato collate "C" desc, x.type, x.tittel collate "C"),
        '[]'::jsonb
      )
      from (
        select h.id, h.dato, h.type, h.tittel from hend h
        where intern.er_skjedd(h.type)
        order by h.dato collate "C" desc, h.type, h.tittel collate "C"
        limit 5
      ) x
    ),
    'prosesser', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', pr.key,
            'tittel', pr.tittel,
            'sporsmal', pr.sporsmal,
            'antall_steg', (select count(*) from prosess_steg st where st.prosess_id = pr.id)
          )
          order by pr.key collate "C"
        ),
        '[]'::jsonb
      )
      from prosess pr where pr.kommune_id = k.id
    ),
    'segmenter', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'kode', sg.kode,
            'navn', sg.navn,
            'antall_organer', (
              select count(*) from org_segment os
              join organisasjon og on og.id = os.org_id
              where os.segment_id = sg.id and og.status = 'aktiv' and og.id in (select id from o)
            )
          )
          order by sg.kode collate "C"
        ),
        '[]'::jsonb
      )
      from segment sg
    ),
    'dekning', jsonb_build_object(
      'organer', (select count(*) from o),
      'roller', (select count(*) from roller),
      'personer', (select count(distinct person_id) from roller),
      'relasjoner', (
        select count(*) from relasjon re
        where re.fra_org_id in (select id from o) and re.til_org_id in (select id from o)
      ),
      'nokkeltall', (select count(*) from nokkeltall n where n.org_id in (select id from o)),
      'hendelser', (select count(*) from hend),
      'prosesser', (select count(*) from prosess pr where pr.kommune_id = k.id),
      'hull', (select count(*) from hull hu where hu.org_id in (select id from o)),
      'kilder', (select count(distinct kilde_id) from belegg)
    ),
    'verifisering', jsonb_build_object(
      'verifisert', (select count(*) from belegg where verifisering = 'verifisert'),
      'oppgitt', (select count(*) from belegg where verifisering = 'oppgitt'),
      'maa_verifiseres', (select count(*) from belegg where verifisering = 'maa_verifiseres')
    ),
    'kilder', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('kilde', intern.j_kilde(x.kilde_id), 'antall', x.antall)
          order by x.antall desc, x.key collate "C"
        ),
        '[]'::jsonb
      )
      from (
        select b.kilde_id, ki.key, count(*) as antall
        from belegg b join kilde ki on ki.id = b.kilde_id
        group by b.kilde_id, ki.key
      ) x
    )
  )
  from k
$$;

create or replace function public.organ_profil(p_org_key text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'organ', intern.j_organ(o.id) || jsonb_build_object(
      'segmenter', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('kode', sg.kode, 'navn', sg.navn, 'styrke', os.styrke)
            order by os.styrke desc, sg.kode collate "C"
          )
          from org_segment os join segment sg on sg.id = os.segment_id
          where os.org_id = o.id
        ),
        '[]'::jsonb
      )
    ),
    'overordnet', intern.j_organ_ref(o.overordnet_id),
    'underordnede', coalesce(
      (
        select jsonb_agg(intern.j_organ_ref(u.id) order by u.key collate "C")
        from organisasjon u where u.overordnet_id = o.id
      ),
      '[]'::jsonb
    ),
    'roller', jsonb_build_object(
      'naa', coalesce(
        (
          select jsonb_agg(
            intern.j_rolle(r.id)
            order by r.rolletype, r.status, p.key collate "C", r.fra collate "C" nulls first
          )
          from rolleinnehav r join person p on p.id = r.person_id
          where r.org_id = o.id and intern.er_aktiv(r.til, r.motsagt)
        ),
        '[]'::jsonb
      ),
      'tidligere', coalesce(
        (
          select jsonb_agg(
            intern.j_rolle(r.id)
            order by r.til collate "C" desc nulls first, r.rolletype, p.key collate "C",
                     r.fra collate "C" nulls first
          )
          from rolleinnehav r join person p on p.id = r.person_id
          where r.org_id = o.id and not intern.er_aktiv(r.til, r.motsagt)
        ),
        '[]'::jsonb
      )
    ),
    'eiere', coalesce(
      (
        select jsonb_agg(
          intern.j_eierandel(re.id, re.fra_org_id)
          order by re.andel desc nulls last, a.key collate "C", re.fra_dato collate "C" nulls first
        )
        from relasjon re join organisasjon a on a.id = re.fra_org_id
        where re.til_org_id = o.id and re.type = 'eier'
      ),
      '[]'::jsonb
    ),
    'eierandeler', coalesce(
      (
        select jsonb_agg(
          intern.j_eierandel(re.id, re.til_org_id)
          order by re.andel desc nulls last, a.key collate "C", re.fra_dato collate "C" nulls first
        )
        from relasjon re join organisasjon a on a.id = re.til_org_id
        where re.fra_org_id = o.id and re.type = 'eier'
      ),
      '[]'::jsonb
    ),
    'relasjoner', coalesce(
      (
        select jsonb_agg(
          intern.j_relasjon_ut(x.id, x.retning)
          order by x.type, x.retning_nr, x.annen collate "C", x.fra_dato collate "C" nulls first
        )
        from (
          select re.id, re.type, 'ut' as retning, 0 as retning_nr, a.key as annen, re.fra_dato
          from relasjon re join organisasjon a on a.id = re.til_org_id
          where re.fra_org_id = o.id and re.type <> 'eier'
          union all
          select re.id, re.type, 'inn', 1, a.key, re.fra_dato
          from relasjon re join organisasjon a on a.id = re.fra_org_id
          where re.til_org_id = o.id and re.type <> 'eier'
        ) x
      ),
      '[]'::jsonb
    ),
    'nokkeltall', coalesce(
      (
        select jsonb_agg(
          intern.j_nokkeltall(n.id)
          order by n.aar desc, n.type, n.periode collate "C" nulls first, n.konsern nulls first
        )
        from nokkeltall n where n.org_id = o.id
      ),
      '[]'::jsonb
    ),
    'hendelser', coalesce(
      (
        select jsonb_agg(intern.j_endring(h.id) order by h.dato collate "C" desc, h.type, h.tittel collate "C")
        from hendelse h where h.org_id = o.id
      ),
      '[]'::jsonb
    ),
    'hull', coalesce(
      (
        select jsonb_agg(intern.j_hull(hu.id) order by hu.hva collate "C")
        from hull hu where hu.org_id = o.id
      ),
      '[]'::jsonb
    ),
    'kilder', coalesce(
      (
        select jsonb_agg(intern.j_kilde(ki.id) order by ki.key collate "C")
        from kilde ki
        where ki.id = o.kilde_id
           or ki.id in (select r.kilde_id from rolleinnehav r where r.org_id = o.id)
           or ki.id in (
             select re.kilde_id from relasjon re where re.fra_org_id = o.id or re.til_org_id = o.id
           )
           or ki.id in (select n.kilde_id from nokkeltall n where n.org_id = o.id)
           or ki.id in (select h.kilde_id from hendelse h where h.org_id = o.id)
      ),
      '[]'::jsonb
    ),
    'kommuner', coalesce(
      (
        select jsonb_agg(intern.j_kommune(k.id) order by k.slug collate "C")
        from kommune k join kommune_org ko on ko.kommune_id = k.id
        where ko.org_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from organisasjon o where o.key = p_org_key
$$;

create or replace function public.nettverk(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with k as (
    select id from kommune where kommunenr = p_kommunenr
  ),
  o as (
    select intern.omfang((select id from k)) as id
  ),
  utelatt as (
    select distinct r.person_id
    from rolleinnehav r join organisasjon og on og.id = r.org_id
    where og.sensitiv
  ),
  aktuelle as (
    select r.id, r.person_id, r.org_id, r.rolletype
    from rolleinnehav r join organisasjon og on og.id = r.org_id
    where intern.er_aktiv(r.til, r.motsagt)
      and og.id in (select id from o)
      and not og.sensitiv
      and r.person_id not in (select person_id from utelatt)
  ),
  med as (
    select a.person_id from aktuelle a
    group by a.person_id
    having count(distinct a.org_id) >= 2
  ),
  par as (
    select distinct oa.key as fra, ob.key as til, a.person_id
    from aktuelle a
    join aktuelle b on b.person_id = a.person_id
    join organisasjon oa on oa.id = a.org_id
    join organisasjon ob on ob.id = b.org_id
    where a.person_id in (select person_id from med)
      and oa.key collate "C" < ob.key collate "C"
  )
  select case when not exists (select 1 from k) then null else jsonb_build_object(
    'noder', coalesce(
      (
        select jsonb_agg(intern.j_organ_ref(og.id) order by og.key collate "C")
        from organisasjon og
        where og.id in (select a.org_id from aktuelle a where a.person_id in (select person_id from med))
      ),
      '[]'::jsonb
    ),
    'kanter', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('fra', pa.fra, 'til', pa.til, 'person', intern.j_person(pa.person_id))
          order by pa.fra collate "C", pa.til collate "C", p.key collate "C"
        )
        from par pa join person p on p.id = pa.person_id
      ),
      '[]'::jsonb
    ),
    'personer', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'person', intern.j_person(m.person_id),
            'roller', (
              select jsonb_agg(intern.j_rolle_i_organ(a.id) order by og.key collate "C", a.rolletype)
              from aktuelle a join organisasjon og on og.id = a.org_id
              where a.person_id = m.person_id
            )
          )
          order by p.key collate "C"
        )
        from med m join person p on p.id = m.person_id
      ),
      '[]'::jsonb
    )
  ) end
$$;
