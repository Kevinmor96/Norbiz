-- `inngar_i_regnskapssnitt` krever nå at omsetningen er POSITIV.
--
-- Kolonnen sa bare at selskapsformen leverer årsregnskap og at det finnes et
-- regnskapsår. Den sa ingenting om at det finnes et tall å regne på, og det ga
-- to slags rader som telte som «har regnskapstall» uten å ha det:
--
--   88 selskaper med omsetning = 0 der driftsresultatet likevel er satt
--    2 selskaper med NEGATIV omsetning (−1 379 og −875 354 kroner)
--
-- Negativ omsetning er ikke et driftsregnskap. Null omsetning med et resultat
-- ulikt null er en rad som ikke kan brukes til noe. Begge sto med
-- `inngar_i_regnskapssnitt = true`, altså i grunnlaget for hvert
-- «selskaper med tall»-antall vi oppgir, og i topplistene — der de riktignok
-- havnet nederst, siden marginen ble NULL av `case when omsetning > 0`.
--
-- Marginberegningen var altså aldri gal. Det var TELLINGEN som var det: vi sa
-- 4 946 selskaper med regnskapstall når 88 av dem ikke hadde et tall å vise.
--
-- Kolonnen må slippes og legges på nytt — uttrykket i en generert kolonne kan
-- ikke endres på plass i denne Postgres-versjonen — og indeksen som hang på den
-- gjenopprettes etterpå. Funksjonene som leser kolonnen er `language sql` og
-- slår opp navnet ved kjøring, så de trenger ingen endring.
alter table companies drop column inngar_i_regnskapssnitt;

alter table companies add column inngar_i_regnskapssnitt boolean
  generated always as (
    organisasjonsform in ('AS', 'ASA', 'NUF', 'SA')
    and regnskapsar is not null
    and omsetning is not null
    and omsetning > 0
  ) stored;

create index companies_regnskapssnitt_idx
  on companies (nace_code) where inngar_i_regnskapssnitt;

comment on column companies.inngar_i_regnskapssnitt is
  'Sann bare der det finnes et tall å regne på: regnskapspliktig form, et regnskapsår, og positiv omsetning. ENK leverer ikke årsregnskap og faller ut av seg selv.';
