-- RPC: kommune_grader(), region_oversikt(), fylke_oversikt(), sok().
--
-- Formene står i src/lib/data/kontrakt.ts, og lokal.ts regner det samme i
-- TypeScript. Tellingene gjøres her, i basen: PostgREST avviser aggregater i
-- spørrestrengen og kapper ved 1 000 rader. Over et fylke telles hver påstand
-- én gang, også når den står i omfanget til flere kommuner.

-- ---------------------------------------------------------------------------
-- Gradene
-- ---------------------------------------------------------------------------

-- Hver påstand i kommunens omfang, med tabell og id. Samme påstander som
-- intern.kommune_belegg (0009), men med id, så de kan telles distinkt over
-- flere kommuner.
create function intern.omfang_pastander(p_kommune uuid)
returns table (tabell text, id uuid, kilde_id uuid, verifisering verifisering, per text)
language sql stable
set search_path = public, intern
as $$
  select 'organisasjon', o.id, o.kilde_id, o.verifisering, o.per from organisasjon o
  where o.id in (select intern.omfang(p_kommune))
  union all
  select 'rolleinnehav', r.id, r.kilde_id, r.verifisering, r.per from rolleinnehav r
  where r.org_id in (select intern.omfang(p_kommune))
  union all
  select 'relasjon', re.id, re.kilde_id, re.verifisering, re.per from relasjon re
  where re.fra_org_id in (select intern.omfang(p_kommune))
    and re.til_org_id in (select intern.omfang(p_kommune))
  union all
  select 'nokkeltall', n.id, n.kilde_id, n.verifisering, n.per from nokkeltall n
  where n.org_id in (select intern.omfang(p_kommune))
  union all
  select 'hendelse', h.id, h.kilde_id, h.verifisering, h.per from hendelse h
  where h.id in (select intern.omfang_hendelser(p_kommune))
  union all
  select 'prosess_steg', st.id, st.kilde_id, st.verifisering, st.per from prosess_steg st
  join prosess p on p.id = st.prosess_id
  where p.kommune_id = p_kommune
$$;

-- Grader over omfanget til kommunene i `p_kommuner`, hver påstand én gang.
create function intern.j_grader(p_kommuner uuid[]) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with p as (
    select distinct x.tabell, x.id, x.kilde_id, x.verifisering, x.per
    from unnest(p_kommuner) as k (id)
    cross join lateral intern.omfang_pastander(k.id) x
  ),
  t as (
    select p.tabell, p.verifisering, p.per, ki.type = 'register' as fra_register
    from p join kilde ki on ki.id = p.kilde_id
  ),
  telling as (
    select coalesce(t.tabell, 'alle') as del,
           jsonb_build_object(
             'totalt', count(*),
             'verifisert', count(*) filter (where t.verifisering = 'verifisert'),
             'oppgitt', count(*) filter (where t.verifisering = 'oppgitt'),
             'maa_verifiseres', count(*) filter (where t.verifisering = 'maa_verifiseres'),
             'fra_register', count(*) filter (where t.fra_register)
           ) as j
    from t
    group by grouping sets ((t.tabell), ())
  ),
  tom as (
    select jsonb_build_object(
      'totalt', 0, 'verifisert', 0, 'oppgitt', 0, 'maa_verifiseres', 0, 'fra_register', 0
    ) as j
  )
  select jsonb_build_object(
    'alle', coalesce((select j from telling where del = 'alle'), (select j from tom)),
    'organer', coalesce((select j from telling where del = 'organisasjon'), (select j from tom)),
    'roller', coalesce((select j from telling where del = 'rolleinnehav'), (select j from tom)),
    'relasjoner', coalesce((select j from telling where del = 'relasjon'), (select j from tom)),
    'nokkeltall', coalesce((select j from telling where del = 'nokkeltall'), (select j from tom)),
    'hendelser', coalesce((select j from telling where del = 'hendelse'), (select j from tom)),
    'prosess_steg', coalesce((select j from telling where del = 'prosess_steg'), (select j from tom)),
    'forst_hentet', (
      select min(t.per collate "C") from t where t.verifisering = 'verifisert' and t.per is not null
    ),
    'sist_hentet', (
      select max(t.per collate "C") from t where t.verifisering = 'verifisert' and t.per is not null
    )
  )
$$;

-- Gradene i kommunens omfang, delt på hva påstanden gjelder. null når
-- kommunen ikke finnes.
create function public.kommune_grader(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select intern.j_grader(array[k.id]) from kommune k where k.kommunenr = p_kommunenr
$$;

-- ---------------------------------------------------------------------------
-- Regionen
-- ---------------------------------------------------------------------------

-- FolketallUt
create function intern.j_folketall(
  p_verdi integer, p_aar smallint, p_kilde uuid, p_verifisering verifisering,
  p_per text, p_merknad text, p_hentet timestamptz
) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'verdi', p_verdi,
    'aar', p_aar,
    'belegg', intern.j_belegg(p_kilde, p_verifisering, p_per, p_merknad, p_hentet)
  )
$$;

-- Datasettdekning for kommunen (datasettet), eller null.
create function intern.j_dekning(p_kommune uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with k as (select * from kommune where id = p_kommune),
  o as (select intern.omfang(p_kommune) as id),
  r as (
    select r.id, r.person_id, r.rolletype, r.til, r.motsagt, r.org_id
    from rolleinnehav r where r.org_id in (select id from o)
  ),
  ledere as (
    select r.rolletype from r
    join organisasjon og on og.id = r.org_id
    where intern.er_aktiv(r.til, r.motsagt)
      and r.rolletype in ('politisk_leder', 'toppleder')
      and og.kommunenr = (select kommunenr from k)
  )
  select jsonb_build_object(
    'sammenstilt', to_char(k.sammenstilt, 'YYYY-MM-DD'),
    'organer', (select count(*) from o),
    'roller', (select count(*) from r),
    'personer', (select count(distinct person_id) from r),
    'ledere', jsonb_build_object(
      'politisk_leder', (select count(*) from ledere where rolletype = 'politisk_leder'),
      'toppleder', (select count(*) from ledere where rolletype = 'toppleder')
    ),
    'grader', intern.j_grader(array[k.id])
  )
  from k
$$;

-- RegionKommune
create function intern.j_region_kommune(p_id uuid) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'kommunenr', rk.kommunenr,
    'navn', rk.navn,
    'navn_offisielt', rk.navn_offisielt,
    'slug', rk.slug,
    'fylkesnr', rk.fylkesnr,
    'folketall', intern.j_folketall(
      rk.folketall, rk.folketall_aar, rk.folketall_kilde_id, rk.folketall_verifisering,
      rk.folketall_per, rk.folketall_merknad, rk.folketall_hentet
    ),
    'samisk_forvaltningsomrade', rk.samisk_forvaltningsomrade,
    'belegg', intern.j_belegg(rk.kilde_id, rk.verifisering, rk.per, rk.merknad, rk.hentet),
    'geografi_belegg', intern.j_belegg(
      rk.geografi_kilde_id, rk.geografi_verifisering, rk.geografi_per, rk.geografi_merknad,
      rk.geografi_hentet
    ),
    'datasett', (select intern.j_dekning(k.id) from kommune k where k.kommunenr = rk.kommunenr)
  )
  from region_kommune rk where rk.id = p_id
$$;

-- RegionFylke. Dekning og grader distinkt over kommunene i fylket.
create function intern.j_region_fylke(p_fylkesnr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with kom as (
    select k.id from kommune k
    join region_kommune rk on rk.kommunenr = k.kommunenr
    where rk.fylkesnr = p_fylkesnr
  ),
  o as (
    select distinct ko.org_id from kommune_org ko where ko.kommune_id in (select id from kom)
  ),
  r as (
    select r.id, r.person_id from rolleinnehav r where r.org_id in (select org_id from o)
  )
  select jsonb_build_object(
    'fylkesnr', f.fylkesnr,
    'navn', f.navn,
    'navn_offisielt', f.navn_offisielt,
    'slug', f.slug,
    'folketall', intern.j_folketall(
      f.folketall, f.folketall_aar, f.folketall_kilde_id, f.folketall_verifisering,
      f.folketall_per, f.folketall_merknad, f.folketall_hentet
    ),
    'belegg', intern.j_belegg(f.kilde_id, f.verifisering, f.per, f.merknad, f.hentet),
    'antall_kommuner', (select count(*) from region_kommune rk where rk.fylkesnr = f.fylkesnr),
    'kartlagt', (select count(*) from kom),
    'dekning', jsonb_build_object(
      'organer', (select count(*) from o),
      'roller', (select count(*) from r),
      'personer', (select count(distinct person_id) from r)
    ),
    'grader', intern.j_grader(coalesce((select array_agg(id) from kom), '{}'::uuid[]))
  )
  from fylke f where f.fylkesnr = p_fylkesnr
$$;

-- Hele regionen. Uten regionregister i basen: tomme lister.
create function public.region_oversikt() returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'region', coalesce(
      (
        select jsonb_build_object(
          'navn', r.navn, 'sammenstilt', to_char(r.sammenstilt, 'YYYY-MM-DD'), 'merknad', r.merknad
        )
        from region r order by r.key collate "C" limit 1
      ),
      jsonb_build_object('navn', '', 'sammenstilt', '', 'merknad', '')
    ),
    'fylker', coalesce(
      (select jsonb_agg(intern.j_region_fylke(f.fylkesnr) order by f.fylkesnr collate "C") from fylke f),
      '[]'::jsonb
    ),
    'kommuner', coalesce(
      (
        select jsonb_agg(intern.j_region_kommune(rk.id) order by rk.kommunenr collate "C")
        from region_kommune rk
      ),
      '[]'::jsonb
    ),
    'kilder', coalesce(
      (
        select jsonb_agg(intern.j_kilde(ki.id) order by ki.key collate "C")
        from kilde ki
        where ki.id in (
          select kilde_id from fylke
          union select folketall_kilde_id from fylke
          union select kilde_id from region_kommune
          union select folketall_kilde_id from region_kommune
          union select geografi_kilde_id from region_kommune
        )
      ),
      '[]'::jsonb
    )
  )
$$;

-- Fylket: egne organer med ledere, kommunene, og de største virksomhetene
-- etter omsetning. null når fylket ikke er i registeret.
create function public.fylke_oversikt(p_fylkesnr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with f as (
    select * from fylke where fylkesnr = p_fylkesnr
  ),
  nr as (
    select kommunenr from region_kommune where fylkesnr = p_fylkesnr
  ),
  omfang as (
    select distinct ko.org_id from kommune_org ko
    join kommune k on k.id = ko.kommune_id
    where k.kommunenr in (select kommunenr from nr)
  ),
  egne as (
    select o.id, o.key, o.nivaa, o.organtype from organisasjon o
    where o.status = 'aktiv'
      and (
        o.fylkesnr = p_fylkesnr
        or (o.organtype = 'statsforvalter' and o.kommunenr is null
            and o.id in (select org_id from omfang))
      )
  ),
  -- Det første omsetningstallet uten periode per organ, i nøkkeltallsorteringen:
  -- nyeste år, så selskapets eget (konsern null, false) før konsernet.
  forste as (
    select distinct on (n.org_id) n.id as nt_id, n.org_id, n.verdi, o.key, o.kommunenr
    from nokkeltall n
    join organisasjon o on o.id = n.org_id
    where n.type = 'omsetning' and n.periode is null
      and o.status = 'aktiv' and o.kommunenr in (select kommunenr from nr)
    order by n.org_id, n.aar desc, n.konsern nulls first
  ),
  storste as (
    select * from forste order by verdi desc, key collate "C" limit 10
  )
  select jsonb_build_object(
    'fylke', intern.j_region_fylke(f.fylkesnr),
    'kommuner', coalesce(
      (
        select jsonb_agg(intern.j_region_kommune(rk.id) order by rk.kommunenr collate "C")
        from region_kommune rk where rk.fylkesnr = f.fylkesnr
      ),
      '[]'::jsonb
    ),
    'organer', coalesce(
      (
        select jsonb_agg(
          intern.j_organ(e.id) || jsonb_build_object(
            'ledere', intern.j_ledere(e.id),
            'representanter', case when e.organtype = 'lovgivende' then (
              select coalesce(
                jsonb_agg(
                  intern.j_rolle(r.id)
                  order by r.rolletype, r.status, p.key collate "C", r.fra collate "C" nulls first
                ),
                '[]'::jsonb
              )
              from rolleinnehav r join person p on p.id = r.person_id
              where r.org_id = e.id and intern.er_aktiv(r.til, r.motsagt)
            ) else '[]'::jsonb end
          )
          order by e.nivaa, e.organtype, e.key collate "C"
        )
        from egne e
      ),
      '[]'::jsonb
    ),
    'storste', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'org', intern.j_organ_ref(s.org_id),
            'kommunenr', s.kommunenr,
            'omsetning', intern.j_nokkeltall(s.nt_id)
          )
          order by s.verdi desc, s.key collate "C"
        )
        from storste s
      ),
      '[]'::jsonb
    )
  )
  from f
$$;

-- ---------------------------------------------------------------------------
-- Søket
-- ---------------------------------------------------------------------------

-- Bretting og normalisering. Samme tegn som BRETTING i src/lib/data/kontrakt.ts,
-- og `translate` i stedet for `lower`, så svaret ikke avhenger av lokalet.
-- tests/sok.test.ts krever at dette gir det samme som `normaliser` i
-- src/lib/data/sok.ts.
create function intern.fold(p text) returns text
language sql immutable strict parallel safe
set search_path = public, intern
as $$
  select replace(replace(translate(
    p,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÁÂÃÄÅĀĂĄàáâãäåāăąÇĆČçćčĐÐđðÈÉÊËĒĖĘĚèéêëēėęěǦǤǧǥÌÍÎÏĪìíîïīǨǩŁłĽľÑŃŇŊñńňŋÒÓÔÕÖØŌòóôõöøōŔŘŕřŚŠŞśšşŦŢŤŧţťÙÚÛÜŪŮùúûüūůÝŸýÿŹŻŽƷǮźżžʒǯÆ',
    'abcdefghijklmnopqrstuvwxyzaaaaaaaaaaaaaaaaaaccccccddddeeeeeeeeeeeeeeeeggggiiiiiiiiiikkllllnnnnnnnnoooooooooooooorrrrssssssttttttuuuuuuuuuuuuyyyyzzzzzzzzzzæ'
  ), 'æ', 'ae'), 'ß', 'ss')
$$;

create function intern.normaliser(p text) returns text
language sql immutable strict parallel safe
set search_path = public, intern
as $$ select btrim(regexp_replace(intern.fold(p), '[^a-z0-9]+', ' ', 'g'), ' ') $$;

-- Rangen til et treff (0–3), eller null når et av ordene mangler. Samme regel
-- som `rang` i src/lib/data/sok.ts. Argumentene er normalisert.
create function intern.sok_rang(p_navn text[], p_tekst text, p_q text, p_ord text[]) returns integer
language sql immutable parallel safe
set search_path = public, intern
as $$
  select case
    when exists (select 1 from unnest(p_ord) o where position(o in p_tekst) = 0) then null
    when p_q = any (p_navn) then 0
    when exists (select 1 from unnest(p_navn) n where left(n, length(p_q)) = p_q) then 1
    when not exists (
      select 1 from unnest(p_ord) o where position(' ' || o in ' ' || p_tekst) = 0
    ) then 2
    else 3
  end
$$;

create function public.sok(p_sporring text, p_limit integer) returns jsonb
language sql stable
set search_path = public, intern
as $$
  with q as (
    select intern.normaliser(coalesce(p_sporring, '')) as q
  ),
  a as (
    select q.q, string_to_array(q.q, ' ') as ord,
           greatest(1, least(50, coalesce(p_limit, 1))) as n,
           length(q.q) >= 2 as gyldig
    from q
  ),
  kom as (
    select rk.id, rk.kommunenr,
           intern.sok_rang(
             array[intern.normaliser(rk.navn_offisielt), intern.normaliser(rk.navn)],
             intern.normaliser(rk.navn_offisielt || ' ' || rk.navn),
             a.q, a.ord
           ) as rang
    from region_kommune rk, a where a.gyldig
  ),
  org as (
    select o.id, o.key, o.status,
           intern.sok_rang(
             array[intern.normaliser(o.navn)]
               || case when o.kortnavn is null then '{}'::text[] else array[intern.normaliser(o.kortnavn)] end,
             intern.normaliser(o.navn || ' ' || coalesce(o.kortnavn, '') || ' ' || coalesce(o.orgnr, '')),
             a.q, a.ord
           ) as rang
    from organisasjon o, a where a.gyldig
  ),
  -- Samme regel som nettverket: en person med en synlig rolle i et sensitivt
  -- organ er ikke med, og ingen roller i sensitive organer er med.
  utelatt as (
    select distinct r.person_id
    from rolleinnehav r join organisasjon og on og.id = r.org_id
    where og.sensitiv
  ),
  rol as (
    select r.id, r.rolletype, r.fra, p.key as pkey, o.key as okey,
           intern.sok_rang(
             array[intern.normaliser(p.navn)],
             intern.normaliser(p.navn || ' ' || r.tittel || ' ' || o.navn || ' ' || coalesce(o.kortnavn, '')),
             a.q, a.ord
           ) as rang
    from rolleinnehav r
    join person p on p.id = r.person_id
    join organisasjon o on o.id = r.org_id
    cross join a
    where a.gyldig and intern.er_aktiv(r.til, r.motsagt) and not o.sensitiv
      and r.person_id not in (select person_id from utelatt)
  )
  select jsonb_build_object(
    'sporring', a.q,
    'kommuner', jsonb_build_object(
      'antall', (select count(*) from kom where rang is not null),
      'treff', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'kommunenr', rk.kommunenr,
            'navn', rk.navn,
            'navn_offisielt', rk.navn_offisielt,
            'slug', rk.slug,
            'fylkesnr', rk.fylkesnr,
            'har_datasett', exists (select 1 from kommune k where k.kommunenr = rk.kommunenr)
          )
          order by x.rang, x.kommunenr collate "C"
        )
        from (
          select * from kom where rang is not null
          order by rang, kommunenr collate "C" limit (select n from a)
        ) x
        join region_kommune rk on rk.id = x.id
      ), '[]'::jsonb)
    ),
    'organer', jsonb_build_object(
      'antall', (select count(*) from org where rang is not null),
      'treff', coalesce((
        select jsonb_agg(
          intern.j_organ_ref(x.id)
            || jsonb_build_object('orgnr', o.orgnr, 'kommunenr', o.kommunenr)
          order by x.rang, x.status <> 'aktiv', x.key collate "C"
        )
        from (
          select * from org where rang is not null
          order by rang, status <> 'aktiv', key collate "C" limit (select n from a)
        ) x
        join organisasjon o on o.id = x.id
      ), '[]'::jsonb)
    ),
    'roller', jsonb_build_object(
      'antall', (select count(*) from rol where rang is not null),
      'treff', coalesce((
        select jsonb_agg(
          intern.j_rolle_i_organ(x.id)
          order by x.rang, x.pkey collate "C", x.okey collate "C", x.rolletype,
                   x.fra collate "C" nulls first
        )
        from (
          select * from rol where rang is not null
          order by rang, pkey collate "C", okey collate "C", rolletype, fra collate "C" nulls first
          limit (select n from a)
        ) x
      ), '[]'::jsonb)
    )
  )
  from a
$$;

-- ---------------------------------------------------------------------------
-- Rettigheter, som i 0015: byggesteinene for alle som kan lese, RPC-ene
-- eksplisitt.
-- ---------------------------------------------------------------------------

revoke all on function
  intern.omfang_pastander(uuid),
  intern.j_grader(uuid[]),
  intern.j_folketall(integer, smallint, uuid, verifisering, text, text, timestamptz),
  intern.j_dekning(uuid),
  intern.j_region_kommune(uuid),
  intern.j_region_fylke(text),
  intern.fold(text),
  intern.normaliser(text),
  intern.sok_rang(text[], text, text, text[]),
  public.kommune_grader(text),
  public.region_oversikt(),
  public.fylke_oversikt(text),
  public.sok(text, integer)
from public, anon, authenticated;

grant execute on function
  intern.omfang_pastander(uuid),
  intern.j_grader(uuid[]),
  intern.j_folketall(integer, smallint, uuid, verifisering, text, text, timestamptz),
  intern.j_dekning(uuid),
  intern.j_region_kommune(uuid),
  intern.j_region_fylke(text),
  intern.fold(text),
  intern.normaliser(text),
  intern.sok_rang(text[], text, text, text[])
to anon, authenticated, service_role;

grant execute on function
  public.kommune_grader(text),
  public.region_oversikt(),
  public.fylke_oversikt(text),
  public.sok(text, integer)
to anon, authenticated, service_role;
