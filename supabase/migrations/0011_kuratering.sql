-- Kuratering: hvilke næringer skjermen viser.
--
-- Importen fra SSB henter hele kodeverket: 76 tosifrede, 237 tresifrede, 545
-- firesifrede og 744 femsifrede næringer. Det er riktig for datagrunnlaget —
-- persentilrangeringen i scoren blir mye sterkere av å rangere mot 744 andre
-- femsifrede næringer enn mot 64 — men det er feil for skjermen.
--
-- «Frisørsalong» er navnet en bruker kjenner. «Frisering og annen skjønnhetspleie»
-- er SSBs. Vi har kuratert ~100 næringer med det første; de øvrige ~1 500 ville
-- stått med det andre, og en toppliste over 1 600 byråkratisk navngitte næringer
-- er et annet produkt enn en indeks over noe gjenkjennelig.
--
-- Derfor: importer alt, vis det kuraterte. Kolonnen under er det redaksjonelle
-- valget gjort eksplisitt, slik at kurateringen vokser fordi noen bestemmer det
-- og ikke som en bivirkning av hva SSB tilfeldigvis publiserer.
--
-- import-ssb rører aldri denne kolonnen. Nye næringer fra importen får default
-- false og blir dermed usynlige i UI-et til noen aktivt kuraterer dem.
alter table industries
  add column kuratert boolean not null default false;

comment on column industries.kuratert is
  'Satt av oss, ikke av importen. Frontend viser bare kuraterte næringer i '
  'topplister og søk; alle importerte næringer ligger i industry_stats og teller '
  'i peer-gruppen bak scoren.';

create index industries_kuratert_idx on industries (kuratert) where kuratert;
