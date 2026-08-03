-- Kun siste tilgjengelige regnskapsår. Det åpne Regnskapsregister-API-et gir
-- nøkkeltall fra sist innsendte årsregnskap; tre år finnes bare i den lukkede
-- delen, som krever offentlig myndighet.
create table companies (
  id                uuid primary key default gen_random_uuid(),
  org_nr            text not null unique,
  navn              text not null,
  nace_code         text,
  kommune_code      text,
  organisasjonsform text not null,
  ansatte           int,
  omsetning         bigint,
  driftsresultat    bigint,
  egenkapital       bigint,
  regnskapsar       int,

  -- Gjør ENK-avgrensningen etterprøvbar i basen i stedet for i en UI-tekst.
  inngar_i_regnskapssnitt boolean
    generated always as (
      organisasjonsform in ('AS', 'ASA', 'NUF', 'SA') and regnskapsar is not null
    ) stored,

  source            text not null,
  data_quality      data_quality not null
);

create index companies_nace_code_idx on companies (nace_code);
create index companies_kommune_code_idx on companies (kommune_code);
create index companies_regnskapssnitt_idx
  on companies (nace_code) where inngar_i_regnskapssnitt;
