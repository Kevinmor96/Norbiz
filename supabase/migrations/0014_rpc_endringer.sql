-- RPC: endringer().
--
-- Tidslinjen, delt i det som har skjedd og det som ikke har det. Planlagt er
-- ikke skjedd: valget i 2027 og byrådsdebatten står i ikke_skjedd. Skillet
-- går på hendelsestypen, ikke på dagens dato, så svaret er det samme hver
-- dag til noen endrer dataene.
create function public.endringer(p_kommunenr text) returns jsonb
language sql stable
set search_path = public, intern
as $$
  select jsonb_build_object(
    'skjedd', coalesce(
      (
        select jsonb_agg(intern.j_endring(h.id) order by h.dato collate "C" desc, h.type, h.tittel collate "C")
        from hendelse h
        where h.id in (select intern.omfang_hendelser(k.id)) and intern.er_skjedd(h.type)
      ),
      '[]'::jsonb
    ),
    'ikke_skjedd', coalesce(
      (
        select jsonb_agg(intern.j_endring(h.id) order by h.dato collate "C", h.type, h.tittel collate "C")
        from hendelse h
        where h.id in (select intern.omfang_hendelser(k.id)) and not intern.er_skjedd(h.type)
      ),
      '[]'::jsonb
    )
  )
  from kommune k where k.kommunenr = p_kommunenr
$$;
