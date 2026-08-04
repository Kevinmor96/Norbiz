-- Kjedelisten trenger et søkenavn i tillegg til visningsnavnet. «REMA 1000»
-- er det brukeren kjenner; «REMA 1000 NORGE AS» er det Enhetsregisteret
-- kjenner. Uten skillet må org_nr slås opp for hånd for hver kjede, og et
-- manuelt oppslag kan ikke kjøres om igjen når kjeden bytter selskap.
--
-- import-brreg ?brands=1 bruker sok_navn til å finne selskapet med en streng
-- regel: Brreg-navnet må begynne med søkenavnet, organisasjonsformen må være
-- AS, ASA eller SA, og selskapet må ha ansatte. Treffer ingen, står org_nr
-- null og brand_liste viser navnet uten tall — som er ærligere enn å gjette
-- på et selskap med lignende navn.
alter table brands add column sok_navn text;

comment on column brands.sok_navn is
  'Juridisk navn til oppslag i Enhetsregisteret. null = ikke søkbart, org_nr må settes manuelt.';
