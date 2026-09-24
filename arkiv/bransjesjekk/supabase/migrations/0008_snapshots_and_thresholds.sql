-- Brreg-historikk kan ikke etterfylles. Det åpne Regnskapsregisteret gir kun
-- siste innsendte år; tre år finnes bare i den lukkede delen, som krever
-- offentlig myndighet. Historikk vi ikke fanger nå, er tapt permanent.
--
-- import-brreg skriver derfor til denne tabellen ved hver kjøring i stedet for
-- å overskrive companies. Etter noen år har vi tidsserien de andre må kjøpe.
create table companies_snapshot (
  org_nr            text not null,
  regnskapsar       int  not null,
  hentet_dato       date not null default current_date,

  navn              text not null,
  nace_code         text,
  kommune_code      text,
  organisasjonsform text not null,
  ansatte           int,
  omsetning         bigint,
  driftsresultat    bigint,
  egenkapital       bigint,

  source            text not null,
  data_quality      data_quality not null,

  -- Ett regnskapsår per selskap per uttrekk. Kjører importen to ganger samme
  -- dag, skal den andre være en oppdatering og ikke en ny rad.
  primary key (org_nr, regnskapsar, hentet_dato)
);

create index companies_snapshot_org_idx on companies_snapshot (org_nr, regnskapsar);
create index companies_snapshot_nace_idx on companies_snapshot (nace_code, regnskapsar);

-- Terskel for aggregater vi bygger selv, nedenfra fra companies.
--
-- SSB undertrykker celler bygget på under tre enheter. Bygger vi kommunetall
-- nedenfra i stedet for fra SSBs ferdig undertrykte tabeller, omgår vi regelen
-- og overtar vurderingen selv. Snitt av tre selskaper i én NACE-kode i en liten
-- kommune er lett å regne baklengs, og hvert regnskap er offentlig — men det er
-- ikke derfor det er greit.
alter table score_config
  add column min_enheter_aggregat int not null default 5;

comment on column score_config.min_enheter_aggregat is
  'Minste antall selskaper før et egenbygget aggregat vises. Under terskelen: '
  'NULL med mangel_arsak = konfidensielt. Se spec 2.17.';

-- RLS må settes av migrasjonen som lager tabellen. 0007 kan ikke kjenne tabeller
-- som kommer senere, og en hardkodet liste der ville stille etterlatt nye
-- tabeller uten policy.
alter table companies_snapshot enable row level security;
create policy companies_snapshot_public_read on companies_snapshot for select to anon, authenticated using (true);
grant select on companies_snapshot to anon, authenticated;
