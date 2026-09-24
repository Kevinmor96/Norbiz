-- RPC: eierskap(), nettverk().

-- Hva kommunen eier, direkte og gjennom selskapene sine, og utbyttet som flyt.
--
-- Følger aktive eierrelasjoner (uten til_dato) der begge ender er i kommunens
-- omfang, i inntil 10 ledd (MAKS_EIERLEDD i kontrakt.ts). `ledd` er korteste
-- vei fra kommuneorganet. Rekursjonen bruker `union`, så hvert (organ, ledd)
-- telles én gang, og grensen stopper sykler.
create function public.eierskap(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with recursive k as (
    select id from kommune where kommunenr = p_kommunenr
  ),
  o as (
    select intern.omfang((select id from k)) as id
  ),
  eier as (
    select org.id from organisasjon org
    where org.id in (select id from o)
      and org.organtype = 'kommune' and org.kommunenr = p_kommunenr
    order by org.key collate "C"
    limit 1
  ),
  eierrel as (
    select re.id, re.fra_org_id, re.til_org_id, re.andel, re.belop_nok, re.fra_dato
    from relasjon re
    where re.type = 'eier' and re.til_dato is null
      and re.fra_org_id in (select id from o)
      and re.til_org_id in (select id from o)
  ),
  kjede (org_id, ledd) as (
    select id, 0 from eier
    union
    select e.til_org_id, kj.ledd + 1
    from kjede kj join eierrel e on e.fra_org_id = kj.org_id
    where kj.ledd < 10
  ),
  selskap as (
    select kj.org_id, min(kj.ledd) as ledd
    from kjede kj
    where kj.org_id <> (select id from eier)
    group by kj.org_id
  )
  select case
    when not exists (select 1 from k) then null
    when not exists (select 1 from eier) then
      jsonb_build_object('eier', null, 'selskaper', '[]'::jsonb, 'utbytte', '[]'::jsonb)
    else jsonb_build_object(
      'eier', (select intern.j_organ_ref(id) from eier),
      'selskaper', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'org', intern.j_organ_ref(s.org_id),
              'ledd', s.ledd,
              'eiere', coalesce(
                (
                  select jsonb_agg(
                    intern.j_eierandel(e.id, e.fra_org_id)
                    order by e.andel desc nulls last, a.key collate "C", e.fra_dato collate "C" nulls first
                  )
                  from eierrel e join organisasjon a on a.id = e.fra_org_id
                  where e.til_org_id = s.org_id
                ),
                '[]'::jsonb
              ),
              'nokkeltall', coalesce(
                (
                  select jsonb_agg(
                    intern.j_nokkeltall(n.id)
                    order by n.aar desc, n.type, n.periode collate "C" nulls first, n.konsern nulls first
                  )
                  from nokkeltall n where n.org_id = s.org_id
                ),
                '[]'::jsonb
              )
            )
            order by s.ledd, og.key collate "C"
          )
          from selskap s join organisasjon og on og.id = s.org_id
        ),
        '[]'::jsonb
      ),
      'utbytte', coalesce(
        (
          select jsonb_agg(u.flyt order by u.key collate "C")
          from (
            select og.key, jsonb_build_object(
              'selskap', intern.j_organ_ref(s.org_id),
              'total', (
                select intern.j_nokkeltall(n.id)
                from nokkeltall n
                where n.org_id = s.org_id and n.type = 'utbytte'
                order by n.aar desc, n.type, n.periode collate "C" nulls first, n.konsern nulls first
                limit 1
              ),
              'mottakere', coalesce(
                (
                  select jsonb_agg(
                    intern.j_eierandel(e.id, e.fra_org_id)
                    order by e.belop_nok desc, a.key collate "C", e.fra_dato collate "C" nulls first
                  )
                  from eierrel e join organisasjon a on a.id = e.fra_org_id
                  where e.til_org_id = s.org_id and e.belop_nok is not null
                ),
                '[]'::jsonb
              ),
              'sum_mottakere', coalesce(
                (select sum(e.belop_nok) from eierrel e where e.til_org_id = s.org_id),
                0
              )
            ) as flyt
            from selskap s join organisasjon og on og.id = s.org_id
            where exists (select 1 from nokkeltall n where n.org_id = s.org_id and n.type = 'utbytte')
               or exists (select 1 from eierrel e where e.til_org_id = s.org_id and e.belop_nok is not null)
          ) u
        ),
        '[]'::jsonb
      )
    )
  end
$$;

-- De som sitter flere steder. Institusjonsgraf: noden er organet, og personen
-- er kanten mellom to organer.
--
-- Personer med aktive roller i minst to ulike organer i omfanget. Sensitive
-- organer er aldri med, og en person med en synlig rolle i et sensitivt organ
-- er ikke med i det hele tatt (ingen nettverksgraf for dommere, politi,
-- påtale og Forsvaret).
create function public.nettverk(p_kommunenr text) returns jsonb
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
    where r.til is null
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
