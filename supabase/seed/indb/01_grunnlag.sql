-- Bransjeindeks: demo-seed generert i databasen.
--
-- Samme FORM som supabase/seed/seed.sql, ikke samme bytes. Den kanoniske seed-en
-- er 1,7 MB og må kjøres med psql; dette skriptet bygger et tilsvarende datasett
-- internt slik at det kan sendes gjennom Supabase-connectoren.
--
-- Formkravene som må holde, fra spec 2.1 og seksjon 1:
--   nasjonale rader på NACE 2-5, regionale kun på 2-3
--   driftsmargin NULL i regionale rader (SSB publiserer den ikke der)
--   undertrykte celler med merknader, fordi frontend må håndtere dem
--   fylkesårganger: 17 fylker 2017-2019, 11 fra 2020, 15 fra 2024 uten statistikk
--   alt merket data_quality = 'mock'

truncate ai_insights, industry_estimates, ai_reports, industry_scores,
         industry_demography, industry_stats, industry_wages, region_population,
         companies, companies_snapshot, industries, regions restart identity cascade;

-- Byggetabellene er vanlige tabeller, ikke temp. Skriptet sendes i fem deler
-- gjennom connectoren, og hver del kan lande på en ny tilkobling — en temp-tabell
-- ville da vært borte i del B. Del E rydder dem bort igjen.
drop table if exists _src, _reg, _band;

-- Deterministisk støy: hashtext gir samme tall for samme nøkkel, hver kjøring.
create or replace function _noise(k text) returns numeric language sql immutable as
$$ select (abs(hashtext(k)) % 1000000)::numeric / 1000000.0 $$;

create table _src (code text, lvl int, parent text, nm text, common text, slug text, profile text);
insert into _src values
('56',2,null,'Serveringsvirksomhet','Serveringsvirksomhet','serveringsvirksomhet','servering'),
('56.1',3,'56','Restauranter','Restauranter','56-1-restauranter','servering'),
('56.101',5,'56.1','Drift av restauranter og kafeer','Restaurant','restaurant','servering'),
('56.102',5,'56.1','Drift av gatekjøkken','Gatekjøkken','gatekjokken','servering'),
('56.104',5,'56.1','Drift av kaffebarer','Kaffebar','kaffebar','servering'),
('56.3',3,'56','Drikkestedvirksomhet','Drikkestedvirksomhet','56-3-drikkestedvirksomhet','servering'),
('56.301',5,'56.3','Drift av puber','Pub','pub','servering'),
('56.309',5,'56.3','Drikkesteder ellers','Bar','bar','servering'),
('56.2',3,'56','Cateringvirksomhet','Cateringvirksomhet','56-2-cateringvirksomhet','servering'),
('56.210',5,'56.2','Cateringvirksomhet','Cateringfirma','cateringfirma','servering'),
('56.290',5,'56.2','Kantiner drevet som selvstendig virksomhet','Kantinedrift','kantinedrift','servering'),
('47',2,null,'Detaljhandel','Detaljhandel','detaljhandel','varehandel'),
('47.1',3,'47','Butikkhandel med bredt vareutvalg','Butikkhandel med bredt vareutvalg','47-1-butikkhandel-med-bredt-vareutvalg','varehandel'),
('47.111',5,'47.1','Dagligvareforretning','Dagligvarebutikk','dagligvarebutikk','varehandel'),
('47.190',5,'47.1','Butikkhandel ellers','Varehus','varehus','varehandel'),
('47.7',3,'47','Annen butikkhandel','Annen butikkhandel','47-7-annen-butikkhandel','varehandel'),
('47.710',5,'47.7','Butikkhandel med klær','Klesbutikk','klesbutikk','varehandel'),
('47.721',5,'47.7','Butikkhandel med skotøy','Skobutikk','skobutikk','varehandel'),
('47.762',5,'47.7','Butikkhandel med blomster','Blomsterbutikk','blomsterbutikk','varehandel'),
('47.782',5,'47.7','Butikkhandel med gull og sølv','Gullsmed','gullsmed','varehandel'),
('47.752',5,'47.7','Butikkhandel med tapeter og gulvbelegg','Fargehandel','fargehandel','varehandel'),
('47.641',5,'47.7','Butikkhandel med sportsutstyr','Sportsbutikk','sportsbutikk','varehandel'),
('47.761',5,'47.7','Butikkhandel med blomster og planter','Hagesenter','hagesenter','varehandel'),
('47.3',3,'47','Detaljhandel med drivstoff','Detaljhandel med drivstoff','47-3-detaljhandel-med-drivstoff','varehandel'),
('47.300',5,'47.3','Detaljhandel med drivstoff','Bensinstasjon','bensinstasjon','varehandel'),
('41',2,null,'Oppføring av bygninger','Oppføring av bygninger','oppforing-av-bygninger','bygg'),
('41.1',3,'41','Utvikling av byggeprosjekter','Utvikling av byggeprosjekter','41-1-utvikling-av-byggeprosjekter','bygg'),
('41.101',5,'41.1','Boligbyggelag','Boligbyggelag','boligbyggelag','bygg'),
('41.109',5,'41.1','Utvikling av byggeprosjekter ellers','Boligutvikler','boligutvikler','bygg'),
('41.2',3,'41','Oppføring av bygninger','Oppføring av bygninger','41-2-oppforing-av-bygninger','bygg'),
('41.200',5,'41.2','Oppføring av bygninger','Byggefirma','byggefirma','bygg'),
('43',2,null,'Spesialisert bygge- og anleggsvirksomhet','Spesialisert bygge- og anleggsvirksomhet','spesialisert-bygge-og-anleggsvirksomhet','bygg'),
('43.2',3,'43','Elektrisk installasjon og VVS','Elektrisk installasjon og VVS','43-2-elektrisk-installasjon-og-vvs','bygg'),
('43.210',5,'43.2','Elektrisk installasjonsarbeid','Elektriker','elektriker','bygg'),
('43.221',5,'43.2','Rørleggerarbeid','Rørlegger','rorlegger','bygg'),
('43.222',5,'43.2','Ventilasjonsarbeid','Ventilasjonsfirma','ventilasjonsfirma','bygg'),
('43.3',3,'43','Ferdiggjøring av bygninger','Ferdiggjøring av bygninger','43-3-ferdiggjoring-av-bygninger','bygg'),
('43.310',5,'43.3','Stukkatørarbeid og pussing','Murer','murer','bygg'),
('43.320',5,'43.3','Snekkerarbeid','Snekker','snekker','bygg'),
('43.341',5,'43.3','Malerarbeid','Maler','maler','bygg'),
('43.390',5,'43.3','Ferdiggjøring ellers','Byggtapetserer','byggtapetserer','bygg'),
('43.1',3,'43','Riving og grunnarbeid','Riving og grunnarbeid','43-1-riving-og-grunnarbeid','bygg'),
('43.110',5,'43.1','Riving av bygninger','Rivingsfirma','rivingsfirma','bygg'),
('43.120',5,'43.1','Grunnarbeid','Grunnentreprenør','grunnentreprenor','bygg'),
('43.130',5,'43.1','Prøveboring','Borefirma','borefirma','bygg'),
('43.9',3,'43','Annen spesialisert bygge- og anleggsvirksomhet','Annen spesialisert bygge- og anleggsvirksomhet','43-9-annen-spesialisert-bygge-og-anleggsvirksomhet','bygg'),
('43.910',5,'43.9','Takarbeid','Takentreprenør','takentreprenor','bygg'),
('43.991',5,'43.9','Blikkenslagerarbeid','Blikkenslager','blikkenslager','bygg'),
('43.999',5,'43.9','Bygge- og anleggsvirksomhet ellers','Stillasfirma','stillasfirma','bygg'),
('96',2,null,'Annen personlig tjenesteyting','Annen personlig tjenesteyting','annen-personlig-tjenesteyting','tjenesteyting'),
('96.0',3,'96','Annen personlig tjenesteyting','Annen personlig tjenesteyting','96-0-annen-personlig-tjenesteyting','tjenesteyting'),
('96.021',5,'96.0','Frisering og annen skjønnhetspleie','Frisørsalong','frisorsalong','tjenesteyting'),
('96.022',5,'96.0','Skjønnhetspleie','Hudpleiesalong','hudpleiesalong','tjenesteyting'),
('96.011',5,'96.0','Vaskeri- og renserivirksomhet','Renseri','renseri','tjenesteyting'),
('96.090',5,'96.0','Personlig tjenesteyting ellers','Tatoveringsstudio','tatoveringsstudio','tjenesteyting'),
('93',2,null,'Sport og fritid','Sport og fritid','sport-og-fritid','tjenesteyting'),
('93.1',3,'93','Sports- og idrettsaktiviteter','Sports- og idrettsaktiviteter','93-1-sports-og-idrettsaktiviteter','tjenesteyting'),
('93.130',5,'93.1','Treningssentre','Treningssenter','treningssenter','tjenesteyting'),
('93.110',5,'93.1','Drift av idrettsanlegg','Idrettsanlegg','idrettsanlegg','tjenesteyting'),
('93.191',5,'93.1','Idrettslag og -klubber','Idrettsklubb','idrettsklubb','tjenesteyting'),
('93.120',5,'93.1','Idrettslag og -klubber for enkeltidretter','Fotballklubb','fotballklubb','tjenesteyting'),
('93.2',3,'93','Fornøyelse og fritid','Fornøyelse og fritid','93-2-fornoyelse-og-fritid','tjenesteyting'),
('93.210',5,'93.2','Drift av fornøyelsesetablissementer','Fornøyelsespark','fornoyelsespark','tjenesteyting'),
('93.291',5,'93.2','Drift av treningsstudio for dans','Dansestudio','dansestudio','tjenesteyting'),
('93.299',5,'93.2','Fritidsvirksomhet ellers','Aktivitetssenter','aktivitetssenter','tjenesteyting'),
('69',2,null,'Juridisk og regnskapsmessig tjenesteyting','Juridisk og regnskapsmessig tjenesteyting','juridisk-og-regnskapsmessig-tjenesteyting','radgivning'),
('69.1',3,'69','Juridisk tjenesteyting','Juridisk tjenesteyting','69-1-juridisk-tjenesteyting','radgivning'),
('69.100',5,'69.1','Juridisk tjenesteyting','Advokatfirma','advokatfirma','radgivning'),
('69.2',3,'69','Regnskap og revisjon','Regnskap og revisjon','69-2-regnskap-og-revisjon','radgivning'),
('69.201',5,'69.2','Regnskap og bokføring','Regnskapsfører','regnskapsforer','radgivning'),
('69.202',5,'69.2','Revisjon','Revisor','revisor','radgivning'),
('70',2,null,'Hovedkontortjenester og administrativ rådgivning','Hovedkontortjenester og administrativ rådgivning','hovedkontortjenester-og-administrativ-radgivning','radgivning'),
('70.2',3,'70','Administrativ rådgivning','Administrativ rådgivning','70-2-administrativ-radgivning','radgivning'),
('70.220',5,'70.2','Bedriftsrådgivning','Bedriftsrådgiver','bedriftsradgiver','radgivning'),
('70.210',5,'70.2','PR og kommunikasjon','PR-byrå','pr-byra','radgivning'),
('70.1',3,'70','Hovedkontortjenester','Hovedkontortjenester','70-1-hovedkontortjenester','radgivning'),
('70.100',5,'70.1','Hovedkontortjenester','Hovedkontor','hovedkontor','radgivning'),
('62',2,null,'Tjenester tilknyttet informasjonsteknologi','Tjenester tilknyttet informasjonsteknologi','tjenester-tilknyttet-informasjonsteknologi','radgivning'),
('62.0',3,'62','IT-tjenester','IT-tjenester','62-0-it-tjenester','radgivning'),
('62.010',5,'62.0','Programmeringstjenester','Programvarehus','programvarehus','radgivning'),
('62.020',5,'62.0','Konsulentvirksomhet tilknyttet IT','IT-konsulent','it-konsulent','radgivning'),
('62.030',5,'62.0','Forvaltning og drift av IT-systemer','IT-drift','it-drift','radgivning'),
('86',2,null,'Helsetjenester','Helsetjenester','helsetjenester','helse'),
('86.2',3,'86','Lege- og tannlegetjenester','Lege- og tannlegetjenester','86-2-lege-og-tannlegetjenester','helse'),
('86.211',5,'86.2','Allmenn legetjeneste','Legekontor','legekontor','helse'),
('86.230',5,'86.2','Tannhelsetjenester','Tannlege','tannlege','helse'),
('86.9',3,'86','Andre helsetjenester','Andre helsetjenester','86-9-andre-helsetjenester','helse'),
('86.901',5,'86.9','Fysioterapitjeneste','Fysioterapeut','fysioterapeut','helse'),
('86.907',5,'86.9','Kiropraktortjeneste','Kiropraktor','kiropraktor','helse'),
('86.905',5,'86.9','Psykologtjeneste','Psykolog','psykolog','helse'),
('86.909',5,'86.9','Helsetjenester ellers','Naprapat','naprapat','helse'),
('88',2,null,'Omsorg uten botilbud','Omsorg uten botilbud','omsorg-uten-botilbud','helse'),
('88.9',3,'88','Barnehager og annet sosialt arbeid','Barnehager og annet sosialt arbeid','88-9-barnehager-og-annet-sosialt-arbeid','helse'),
('88.911',5,'88.9','Barnehager','Barnehage','barnehage','helse'),
('88.993',5,'88.9','Dagsentre for eldre','Dagsenter','dagsenter','helse'),
('81',2,null,'Tjenester tilknyttet eiendomsdrift','Tjenester tilknyttet eiendomsdrift','tjenester-tilknyttet-eiendomsdrift','tjenesteyting'),
('81.2',3,'81','Rengjøringsvirksomhet','Rengjøringsvirksomhet','81-2-rengjoringsvirksomhet','tjenesteyting'),
('81.210',5,'81.2','Rengjøring av bygninger','Renholdsbyrå','renholdsbyra','tjenesteyting'),
('81.291',5,'81.2','Skadedyrkontroll','Skadedyrfirma','skadedyrfirma','tjenesteyting'),
('81.299',5,'81.2','Rengjøringsvirksomhet ellers','Vinduspussfirma','vinduspussfirma','tjenesteyting'),
('81.3',3,'81','Beplantning av hager','Beplantning av hager','81-3-beplantning-av-hager','tjenesteyting'),
('81.300',5,'81.3','Beplantning av hager og parkanlegg','Anleggsgartner','anleggsgartner','tjenesteyting');

-- Folketall er med fordi de bestemmer hvor store de regionale cellene blir, og
-- dermed hvor undertrykkingen slår inn. Tallene er avrundede SSB-tall, ikke
-- tilfeldige: et lite fylke skal gi små celler slik det gjør i virkeligheten.
create table _reg (code text, nm text, lvl text, parent text, vfrom int, vto int, pop int);
insert into _reg values
('0','Norge','land',null,2017,null,5300000),
('01','Østfold','fylke','0',2017,2019,297000),
('02','Akershus','fylke','0',2017,2019,614000),
('03','Oslo','fylke','0',2017,2019,681000),
('04','Hedmark','fylke','0',2017,2019,197000),
('05','Oppland','fylke','0',2017,2019,189000),
('06','Buskerud','fylke','0',2017,2019,279000),
('07','Vestfold','fylke','0',2017,2019,249000),
('08','Telemark','fylke','0',2017,2019,173000),
('09','Aust-Agder','fylke','0',2017,2019,117000),
('10','Vest-Agder','fylke','0',2017,2019,186000),
('11','Rogaland','fylke','0',2017,2019,472000),
('12','Hordaland','fylke','0',2017,2019,522000),
('14','Sogn og Fjordane','fylke','0',2017,2019,110000),
('15','Møre og Romsdal','fylke','0',2017,2019,266000),
('18','Nordland','fylke','0',2017,2019,243000),
('50','Trøndelag','fylke','0',2017,2019,458000),
('54','Troms og Finnmark','fylke','0',2017,2019,243000),
('03','Oslo','fylke','0',2020,2023,709000),
('11','Rogaland','fylke','0',2020,2023,485000),
('15','Møre og Romsdal','fylke','0',2020,2023,265000),
('18','Nordland','fylke','0',2020,2023,240000),
('30','Viken','fylke','0',2020,2023,1256000),
('34','Innlandet','fylke','0',2020,2023,371000),
('38','Vestfold og Telemark','fylke','0',2020,2023,424000),
('42','Agder','fylke','0',2020,2023,308000),
('46','Vestland','fylke','0',2020,2023,638000),
('50','Trøndelag','fylke','0',2020,2023,470000),
('54','Troms og Finnmark','fylke','0',2020,2023,244000),
('03','Oslo','fylke','0',2024,null,717000),
('11','Rogaland','fylke','0',2024,null,500000),
('15','Møre og Romsdal','fylke','0',2024,null,268000),
('18','Nordland','fylke','0',2024,null,238000),
('31','Østfold','fylke','0',2024,null,320000),
('32','Akershus','fylke','0',2024,null,730000),
('33','Buskerud','fylke','0',2024,null,226000),
('34','Innlandet','fylke','0',2024,null,373000),
('39','Vestfold','fylke','0',2024,null,260000),
('40','Telemark','fylke','0',2024,null,176000),
('42','Agder','fylke','0',2024,null,316000),
('46','Vestland','fylke','0',2024,null,653000),
('50','Trøndelag','fylke','0',2024,null,483000),
('55','Troms','fylke','0',2024,null,172000),
('56','Finnmark','fylke','0',2024,null,74000);

-- Bransjeprofiler: marginbånd, lønnsandel, investering per sysselsatt,
-- konkursrate og 5-års overlevelse. Servering lavt, rådgivning høyt.
create table _band (profile text primary key,
  m_lo numeric, m_hi numeric, l_lo numeric, l_hi numeric,
  i_lo numeric, i_hi numeric, k_lo numeric, k_hi numeric, o_lo numeric, o_hi numeric);
insert into _band values
  ('servering',     1.5,  6.0, 32, 42, 18000, 45000, 0.045, 0.085, 28, 42),
  ('varehandel',    2.5,  7.5, 14, 22, 12000, 38000, 0.025, 0.050, 38, 52),
  ('bygg',          4.0,  9.5, 26, 36, 22000, 60000, 0.035, 0.070, 33, 48),
  ('tjenesteyting', 8.0, 16.0, 38, 52,  8000, 25000, 0.015, 0.035, 48, 64),
  ('radgivning',   14.0, 26.0, 42, 58,  6000, 20000, 0.010, 0.025, 55, 72),
  ('helse',         6.0, 14.0, 44, 60, 15000, 42000, 0.008, 0.020, 60, 78);

-- Hierarkiet nivå for nivå: parent_code er en selvreferanse, så forfedre først.
insert into industries (nace_code, nace_level, parent_code, name, common_name, slug, search_terms)
select code, lvl, parent, nm, common, slug, array[lower(common)]
from _src where lvl = 2;
insert into industries (nace_code, nace_level, parent_code, name, common_name, slug, search_terms)
select code, lvl, parent, nm, common, slug, array[lower(common)]
from _src where lvl = 3;
insert into industries (nace_code, nace_level, parent_code, name, common_name, slug, search_terms)
select code, lvl, parent, nm, common, slug, array[lower(common)]
from _src where lvl = 5;

insert into regions (code, name, level, parent_code, valid_from_year, valid_to_year)
select code, nm, lvl::region_level, parent, vfrom, vto from _reg;

-- Folketall fra _reg, med svak vekst gjennom perioden.
insert into region_population (region_id, year, innbyggere, source, data_quality)
select r.id, y, round(g.pop * (1 + (y - 2017) * 0.006)), 'seed:folketall', 'mock'
from regions r
join _reg g on g.code = r.code and g.vfrom = r.valid_from_year
cross join generate_series(2017, 2023) y
where r.valid_from_year <= y and coalesce(r.valid_to_year, 9999) >= y;
