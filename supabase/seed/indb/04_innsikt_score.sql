-- Innsikt: forankret i tall, med obligatoriske referanser. Alle fem typer.
insert into ai_insights
  (industry_id, region_id, year, type, tittel, body, alvorlighet,
   referanser, knyttet_til, model, prompt_version, data_quality)
select
  i.id, r.id, 2023, t.type,
  case t.type
    when 'risiko'        then 'Marginpress i ' || lower(i.common_name)
    when 'mulighet'      then 'Rom for konsolidering i ' || lower(i.common_name)
    when 'avvik'         then 'Marginen beveger seg mot foretaksveksten'
    when 'sammenligning' then i.common_name || ' mot resten av næringsgruppen'
    else 'Slik leses tallene for ' || lower(i.common_name)
  end,
  'Fra 2020 til 2023 endret driftsmarginen seg ' ||
  to_char(round(d.margin_delta, 1), 'FM990D9') || ' prosentpoeng, mens antall foretak endret seg med ' ||
  to_char(d.unit_delta, 'FMS999999') || '. ' ||
  case t.type
    when 'risiko'        then 'Fallende margin kombinert med flere aktører tyder på priskonkurranse.'
    when 'mulighet'      then 'Et fragmentert marked med synkende margin er ofte modent for oppkjøp.'
    when 'avvik'         then 'Retningene er verdt å undersøke nærmere.'
    when 'sammenligning' then 'Sammenlignet med søsternæringene i samme 3-siffer ligger dette i midtsjiktet.'
    else 'Tallene gjelder foretak nasjonalt; regionale tall finnes kun på 3-siffer.'
  end,
  1 + (abs(hashtext('alv' || i.nace_code || t.type)) % 5),
  jsonb_build_array(jsonb_build_object(
    'table','industry_stats','nace_code',i.nace_code,
    'years', jsonb_build_array(2020, 2023),
    'felt', jsonb_build_array('driftsmargin_pct','n_enheter'))),
  case when t.type in ('mulighet','sammenligning') then 'n_enheter' else 'driftsmargin' end,
  'seed', 'v0', 'ai_anslag'
from industries i
join regions r on r.level = 'land'
cross join (values ('risiko'),('mulighet'),('avvik'),('sammenligning'),('kontekst')) t(type)
cross join lateral (
  select
    max(driftsmargin_pct) filter (where year = 2023)
      - max(driftsmargin_pct) filter (where year = 2020) as margin_delta,
    max(n_enheter) filter (where year = 2023)
      - max(n_enheter) filter (where year = 2020) as unit_delta
  from industry_stats st
  where st.industry_id = i.id and st.region_level = 'land' and st.unit_type = 'foretak'
) d
where i.nace_level = 5 and d.margin_delta is not null
  and i.nace_code in (select nace_code from industries where nace_level = 5 order by nace_code limit 10);

-- Materialiser scoren fra viewet, slik compute-scores skal gjøre.
insert into industry_scores
  (industry_id, region_id, year, nace_level, region_level, unit_type,
   score_lonnsomhet, score_vekst, score_risiko, score_konkurranse,
   score_kapitalbehov, score_ettersporsel, score_total, forklaring)
select industry_id, region_id, year, nace_level, region_level, unit_type,
       score_lonnsomhet, score_vekst, score_risiko, score_konkurranse,
       score_kapitalbehov, score_ettersporsel, score_total, forklaring
from industry_scores_computed
where score_total is not null;
