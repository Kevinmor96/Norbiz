-- RPC: kommuner(), kommune_oversikt(), hull().
--
-- Formene står i src/lib/data/kontrakt.ts. Tellinger og summer gjøres her, i
-- basen: PostgREST avviser aggregater i spørrestrengen og kapper ved 1 000
-- rader, og en sum regnet i klienten over en kappet liste blir feil uten
-- feilmelding.

-- Kommuneliste. Sortert på slug.
create function public.kommuner() returns jsonb
language sql stable
set search_path = public, intern
as $$
  select coalesce(
    jsonb_agg(
      intern.j_kommune(k.id)
        || jsonb_build_object('antall_organer', (select count(*) from kommune_org ko where ko.kommune_id = k.id))
      order by k.slug collate "C"
    ),
    '[]'::jsonb
  )
  from kommune k
$$;

-- Toppen av kommunesiden. null når kommunen ikke finnes.
create function public.kommune_oversikt(p_kommunenr text) returns jsonb
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
    select r.id, r.org_id, r.person_id, r.rolletype, r.status, r.til from rolleinnehav r
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
      where r.til is null
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

-- Hullene i kommunens omfang. Sortert på gjelder.key, hva.
create function public.hull(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select coalesce(
    (
      select jsonb_agg(intern.j_hull(hu.id) order by og.key collate "C", hu.hva collate "C")
      from hull hu
      join organisasjon og on og.id = hu.org_id
      where hu.org_id in (select intern.omfang(k.id))
    ),
    '[]'::jsonb
  )
  from kommune k where k.kommunenr = p_kommunenr
$$;
