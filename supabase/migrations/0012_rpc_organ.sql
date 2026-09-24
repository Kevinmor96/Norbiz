-- RPC: organ_profil().
--
-- Organet uansett kommune: myndighet, roller nå og før, eierskap, andre
-- relasjoner, nøkkeltall, hendelser, hull og kildene bak. null når organet
-- ikke finnes. For sensitive organer slipper RLS bare topplederne gjennom.
create function public.organ_profil(p_org_key text) returns jsonb
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
          where r.org_id = o.id and r.til is null
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
          where r.org_id = o.id and r.til is not null
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
