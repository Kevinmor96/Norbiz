-- RPC: beslutningskjede(), organkart(), organer_for_segment().

-- «Hvem bestemmer en reguleringsplan?» Stegene i rekkefølge, hvert med organ,
-- myndighet og hvem som leder organet nå. null når prosessen ikke finnes.
--
-- Tar kommunenummer i tillegg til prosessnøkkelen: prosessen «reguleringsplan»
-- finnes i hver kommune, og den er ikke den samme kjeden.
create function public.beslutningskjede(p_kommunenr text, p_prosess_key text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'prosess', jsonb_build_object('key', pr.key, 'tittel', pr.tittel, 'sporsmal', pr.sporsmal),
    'steg', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'nr', st.nr,
            'org', intern.j_organ_ref(st.org_id),
            'myndighet', st.myndighet,
            'hva', st.hva,
            'belegg', intern.j_belegg(st.kilde_id, st.verifisering, st.per, st.merknad, st.hentet),
            'ledere', intern.j_ledere(st.org_id)
          )
          order by st.nr
        ),
        '[]'::jsonb
      )
      from prosess_steg st where st.prosess_id = pr.id
    )
  )
  from prosess pr
  join kommune k on k.id = pr.kommune_id
  where k.kommunenr = p_kommunenr and pr.key = p_prosess_key
$$;

-- Hvem sitter hvor: aktive organer gruppert på nivå, med ledere.
create function public.organkart(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'grupper', coalesce(
      (
        select jsonb_agg(jsonb_build_object('nivaa', g.nivaa, 'organer', g.organer) order by g.nivaa)
        from (
          select
            o.nivaa,
            jsonb_agg(
              intern.j_organ(o.id) || jsonb_build_object('ledere', intern.j_ledere(o.id))
              order by o.organtype, o.key collate "C"
            ) as organer
          from organisasjon o
          where o.id in (select intern.omfang(k.id)) and o.status = 'aktiv'
          group by o.nivaa
        ) g
      ),
      '[]'::jsonb
    )
  )
  from kommune k where k.kommunenr = p_kommunenr
$$;

-- Din bransje: aktive organer i kommunen som påvirker segmentet.
create function public.organer_for_segment(p_segment_kode text, p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'segment', jsonb_build_object('kode', sg.kode, 'navn', sg.navn),
    'organer', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'org', intern.j_organ_ref(o.id),
            'styrke', os.styrke,
            'myndighet', to_jsonb(o.myndighet),
            'beskrivelse', o.beskrivelse
          )
          order by os.styrke desc, o.nivaa, o.key collate "C"
        )
        from org_segment os
        join organisasjon o on o.id = os.org_id
        where os.segment_id = sg.id
          and o.status = 'aktiv'
          and o.id in (select intern.omfang(k.id))
      ),
      '[]'::jsonb
    )
  )
  from segment sg, kommune k
  where sg.kode = p_segment_kode and k.kommunenr = p_kommunenr
$$;
