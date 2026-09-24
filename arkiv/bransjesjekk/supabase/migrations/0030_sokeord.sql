-- Søkeord på kategoriene: det folk faktisk skriver, ikke det vi kaller ting.
--
-- Forsiden får ett søkefelt — «Hva vil du sjekke?» — og det slår mot de 40
-- kategoriene lokalt. Uten dette laget må brukeren gjette kategorinavnet vårt:
-- «gym» gir null treff fordi kategorien heter Treningssenter, «vvs» gir null
-- fordi den heter Rørlegger & ventilasjon. Da er søkefeltet bare et filter med
-- ett felt, og hele poenget med et folkelig lag er borte.
--
-- Ordene lagres ASCII-foldet og i små bokstaver (kafe, ikke kafé; frisorsalong,
-- ikke frisørsalong). Det er ikke slurv, det er kontrakten med frontend:
-- søkestrengen foldes én gang (NFD, strip kombinerende tegn, ø->o æ->ae å->a)
-- og sammenlignes mot lagrede ord som allerede ER foldet. Foldes bare den ene
-- siden, feiler «frisor» mot «frisørsalong» eller «kafé» mot «kafe» — et søk
-- som feiler på ø er ubrukelig i Norge. Kategorinavnet selv trenger ikke stå
-- her; frontend folder og matcher navn og verden i tillegg.
--
-- Ordene er redaksjon og bor i kategorier.sql sammen med resten av
-- kategorilaget. tests/categories.test.ts håndhever formatet og at ingen ord
-- peker på to kategorier.
alter table categories add column sokeord text[] not null default '{}';

comment on column categories.sokeord is
  'Folkelige søkeord, ASCII-foldet og i små bokstaver. Frontend folder søkestrengen på samme måte og matcher mot disse pluss navn og verden.';
