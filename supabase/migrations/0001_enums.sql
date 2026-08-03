-- Provenienshierarkiet. Se spec seksjon 1: målt, utledet, anslått.
create type data_quality as enum ('mock', 'ssb', 'brreg', 'beregnet', 'ai_anslag');

create type region_level as enum ('land', 'fylke', 'kommune');

-- SSB publiserer nasjonalt for både foretak og virksomheter, regionalt kun for
-- virksomheter. En frisørkjede er ett foretak og ti virksomheter.
create type unit_type as enum ('foretak', 'virksomhet');

-- ENK leverer ikke årsregnskap. En as_only-rad skal aldri sammenlignes
-- ufiltrert med en alle-rad.
create type coverage as enum ('alle', 'as_only');

-- Kun meningsfull for data_quality = 'ai_anslag'.
create type konfidens as enum ('lav', 'middels', 'hoy');

-- NULL er fem forskjellige svar. SSB bruker standardtegn: '.' ikke relevant,
-- '..' oppgave mangler, ':' kommer senere, pluss undertrykking av hensyn til
-- konfidensialitet. Et undertrykt tall er ikke det samme som et upublisert.
create type mangel_arsak as enum
  ('ikke_publisert', 'konfidensielt', 'ikke_relevant', 'kommer_senere', 'brudd');
