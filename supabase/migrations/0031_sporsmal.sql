-- Spørsmålet i H1 er redaksjon, ikke en mal.
--
-- Kategorisidens H1 skal stille spørsmålet leseren googlet: «Hva tjener en
-- frisørsalong i Norge?». Frontend prøvde å utlede det med en mal — «Hva
-- tjener en ${navn}?» — og norsk grammatikk knakk den umiddelbart:
-- «Hva tjener en gatekjøkken» (intetkjønn), «en treningssenter», «en
-- bilverksted», «en renhold» (ikke engang en aktør). Kjønn, og om kategorien
-- i det hele tatt kan være subjekt i «hva tjener»-formen, kan ikke utledes av
-- navnet.
--
-- Derfor én håndskrevet setning per kategori, samme redaksjonelle lag som
-- navn, beskrivelse og sokeord. Teksten er komplett — frontend skal ikke
-- legge til eller trekke fra ord, bare vise den og bruke den i <title>.
alter table categories add column sporsmal text not null default '';

comment on column categories.sporsmal is
  'Håndskrevet spørsmål til H1 og <title> på kategorisiden. Komplett setning som ender med spørsmålstegn; frontend maler ikke over den.';
