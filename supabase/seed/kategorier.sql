-- Det kuraterte kategorilaget. Redaksjon, ikke generert: dette er
-- oppdelingen som er produktets konkurransefortrinn, og den vedlikeholdes
-- for hånd her. Kjøres ETTER seed.sql — seed-ens truncate av industries
-- kaskaderer til category_members.
begin;

truncate category_members, brands, categories restart identity cascade;

insert into categories (slug, navn, verden, beskrivelse, farge, ikon, sortering) values
  ('restaurant-kafe','Restaurant & kafé','Mat & drikke','6 000 foretak kjemper om gjestene — se hvem som faktisk tjener penger.','#E4572E','utensils',10),
  ('gatekjokken','Gatekjøkken','Mat & drikke','Lave terskler, tøff konkurranse: tallene bak hurtigmaten.','#E4572E','pizza',11),
  ('bar-pub','Bar & pub','Mat & drikke','Skjenkestedene: omsetning, marginer og hvor de tjener penger.','#E4572E','beer',12),
  ('catering-kantine','Catering & kantine','Mat & drikke','Mat i volum: catering og kantinedrift for bedriftsmarkedet.','#E4572E','chef-hat',13),
  ('bakeri-konditori','Bakeri & konditori','Mat & drikke','Fra produksjon til utsalg — hele bakerinæringens tall.','#E4572E','croissant',14),
  ('dagligvare','Dagligvare','Butikk','235 milliarder i omsetning. Slik ser Norges største detaljbransje ut.','#2E86AB','shopping-cart',20),
  ('kiosk','Kiosk','Butikk','Småhandelen som lever av impulskjøp — tall og trender.','#2E86AB','store',21),
  ('klesbutikk','Klesbutikk','Butikk','Motehandelen i tall: hvem vokser, hvem skvises av netthandel.','#2E86AB','shirt',22),
  ('skobutikk','Skobutikk','Butikk','Skohandelens marginer og utvikling år for år.','#2E86AB','footprints',23),
  ('sportsbutikk','Sportsbutikk','Butikk','Sportshandelen etter kjedekrigen — tallene bak.','#2E86AB','dumbbell',24),
  ('mobel-interior','Møbel & interiør','Butikk','Møbel- og interiørhandelen: store billetter, sykliske svingninger.','#2E86AB','armchair',25),
  ('elektronikkbutikk','Elektronikkbutikk','Butikk','Elektronikkhandelen: tynne marginer, store volumer.','#2E86AB','tv',26),
  ('gullsmed','Gullsmed','Butikk','Gull- og sølvhandelens nisje — få aktører, lojale kunder.','#2E86AB','gem',27),
  ('optiker','Optiker','Butikk','Optikerbransjen: fagretail med helsemarginer.','#2E86AB','glasses',28),
  ('blomster-hage','Blomster & hage','Butikk','Blomsterbutikker og hagesentre gjennom sesongene.','#2E86AB','flower',29),
  ('hotell-overnatting','Hotell & overnatting','Turisme & opplevelser','Hotellnæringen fylke for fylke — belegg, omsetning, ansatte.','#7B4B94','bed',30),
  ('camping-hytter','Camping & hytter','Turisme & opplevelser','Camping og utleiehytter: distriktenes turistnæring i tall.','#7B4B94','tent',31),
  ('opplevelser-aktiviteter','Opplevelser & aktiviteter','Turisme & opplevelser','Aktivitets- og opplevelsesselskapene som vokser med turismen.','#7B4B94','mountain',32),
  ('reisebyra-arrangor','Reisebyrå & arrangør','Turisme & opplevelser','Reisebyråer og turoperatører — bransjen som overlevde alt.','#7B4B94','plane',33),
  ('frisor','Frisør','Helse & velvære','10 000 salonger og 17 % margin — bedre butikk enn ryktet sier.','#C05299','scissors',40),
  ('hudpleie-velvare','Hudpleie & velvære','Helse & velvære','Skjønnhetspleien vokser år for år. Se tallene.','#C05299','sparkles',41),
  ('treningssenter','Treningssenter','Helse & velvære','Treningssentrene i tall: medlemsvekst, marginer, kjeder.','#C05299','activity',42),
  ('tannlege','Tannlege','Helse & velvære','Tannhelse er privat næring — og en av de mest lønnsomme.','#C05299','tooth',43),
  ('fysioterapi','Fysioterapi','Helse & velvære','Fysioterapeutene: små foretak, stabil etterspørsel.','#C05299','heart-pulse',44),
  ('byggefirma','Byggefirma','Bygg & håndverk','Byggenæringen: konjunkturenes frontlinje, tall for hele landet.','#D08C1D','hammer',50),
  ('elektriker','Elektriker','Bygg & håndverk','Elektrikerfagets tall: jevn etterspørsel, gode marginer.','#D08C1D','zap',51),
  ('rorlegger','Rørlegger','Bygg & håndverk','Rørleggerbransjen — håndverket alle trenger, i tall.','#D08C1D','wrench',52),
  ('maler-overflate','Maler & overflate','Bygg & håndverk','Maler- og overflatefagene: lav terskel, hard priskonkurranse.','#D08C1D','paint-roller',53),
  ('renhold','Renhold','Tjenester','Renholdsbransjen: milliardmarked med små og store aktører.','#3B7A57','spray-can',60),
  ('regnskap-revisjon','Regnskap & revisjon','Tjenester','Regnskapsførerne og revisorene som alle andre bransjer trenger.','#3B7A57','calculator',61),
  ('bilforhandler','Bilforhandler','Bil & motor','130 milliarder i omsetning og 2,7 % margin — volumbransjen framfor noen.','#4C6EF5','car',70),
  ('bilverksted','Bilverksted','Bil & motor','4 500 verksteder: bedre margin enn å selge bilene.','#4C6EF5','wrench',71),
  ('dekk-bildeler','Dekk & bildeler','Bil & motor','Delehandel og dekkservice — verkstedbransjens tvilling.','#4C6EF5','disc',72),
  ('motorsykkel-fritid','Motorsykkel & fritidskjøretøy','Bil & motor','MC, snøscooter og ATV: liten bransje, lojale kunder.','#4C6EF5','bike',73);

-- Medlemskoder. kilde='ssb' er SN2007 (statistikk), kilde='brreg' er
-- SN2025-prefikser (selskapsmatching).
--
-- Alle brreg-prefiksene er verifisert mot Enhetsregisteret 2026-08-04, og
-- fire av dem måtte byttes fordi SN2025 flyttet næringen:
--   møbel      47.59 -> 47.55  (47.551 møbler, 47.559 innredningsartikler)
--   kantine    56.29 -> 56.2   (56.29 finnes ikke; 56.210 er catering)
--   turbil     49.39 -> 49.32  («Passasjertransport utenom rutetabell»)
--   fysioterapi 86.91 -> 86.95 («Fysioterapi- og ergoterapitjenester»;
--                               86.93 er psykolog, ikke fysioterapi)
-- Et prefiks uten treff gir en tom toppliste, ikke en feilmelding — derfor
-- må antall treff sjekkes, ikke bare at kallet gikk igjennom.
insert into category_members (category_id, nace_code, kilde)
select c.id, m.kode, m.kilde from (values
  ('restaurant-kafe','56.101','ssb'), ('restaurant-kafe','56.11','brreg'),
  ('gatekjokken','56.102','ssb'), ('gatekjokken','56.12','brreg'),
  ('bar-pub','56.301','ssb'), ('bar-pub','56.309','ssb'), ('bar-pub','56.30','brreg'),
  ('catering-kantine','56.210','ssb'), ('catering-kantine','56.290','ssb'),
  ('catering-kantine','56.2','brreg'),
  ('bakeri-konditori','10.710','ssb'), ('bakeri-konditori','47.241','ssb'),
  ('bakeri-konditori','10.71','brreg'), ('bakeri-konditori','47.24','brreg'),
  ('dagligvare','47.111','ssb'), ('dagligvare','47.11','brreg'),
  ('kiosk','47.112','ssb'), ('kiosk','47.12','brreg'),
  ('klesbutikk','47.710','ssb'), ('klesbutikk','47.71','brreg'),
  ('skobutikk','47.721','ssb'), ('skobutikk','47.72','brreg'),
  ('sportsbutikk','47.641','ssb'), ('sportsbutikk','47.64','brreg'),
  ('mobel-interior','47.591','ssb'), ('mobel-interior','47.531','ssb'),
  ('mobel-interior','47.55','brreg'), ('mobel-interior','47.53','brreg'),
  ('elektronikkbutikk','47.410','ssb'), ('elektronikkbutikk','47.420','ssb'),
  ('elektronikkbutikk','47.430','ssb'), ('elektronikkbutikk','47.4','brreg'),
  ('gullsmed','47.772','ssb'), ('gullsmed','47.77','brreg'),
  ('optiker','47.782','ssb'), ('optiker','47.78','brreg'),
  ('blomster-hage','47.761','ssb'), ('blomster-hage','47.762','ssb'),
  ('blomster-hage','47.76','brreg'),
  ('hotell-overnatting','55.101','ssb'), ('hotell-overnatting','55.102','ssb'),
  ('hotell-overnatting','55.1','brreg'),
  ('camping-hytter','55.202','ssb'), ('camping-hytter','55.300','ssb'),
  ('camping-hytter','55.2','brreg'), ('camping-hytter','55.3','brreg'),
  ('opplevelser-aktiviteter','93.210','ssb'), ('opplevelser-aktiviteter','93.291','ssb'),
  ('opplevelser-aktiviteter','93.292','ssb'), ('opplevelser-aktiviteter','93.299','ssb'),
  ('opplevelser-aktiviteter','49.392','ssb'),
  ('opplevelser-aktiviteter','93.2','brreg'), ('opplevelser-aktiviteter','49.32','brreg'),
  ('reisebyra-arrangor','79.110','ssb'), ('reisebyra-arrangor','79.120','ssb'),
  ('reisebyra-arrangor','79','brreg'),
  ('frisor','96.020','ssb'), ('frisor','96.21','brreg'),
  ('hudpleie-velvare','96.040','ssb'), ('hudpleie-velvare','96.22','brreg'),
  ('treningssenter','93.130','ssb'), ('treningssenter','93.13','brreg'),
  ('tannlege','86.230','ssb'), ('tannlege','86.23','brreg'),
  ('fysioterapi','86.902','ssb'), ('fysioterapi','86.95','brreg'),
  ('byggefirma','41.200','ssb'), ('byggefirma','41.0','brreg'),
  ('elektriker','43.210','ssb'), ('elektriker','43.21','brreg'),
  ('rorlegger','43.221','ssb'), ('rorlegger','43.222','ssb'), ('rorlegger','43.22','brreg'),
  ('maler-overflate','43.341','ssb'), ('maler-overflate','43.390','ssb'),
  ('maler-overflate','43.3','brreg'),
  ('renhold','81.210','ssb'), ('renhold','81.291','ssb'), ('renhold','81.299','ssb'),
  ('renhold','81.2','brreg'),
  ('regnskap-revisjon','69.201','ssb'), ('regnskap-revisjon','69.202','ssb'),
  ('regnskap-revisjon','69.2','brreg'),
  -- Bil & motor. Her er avstanden mellom de to standardene størst i hele
  -- kodesettet: SN2025 har OPPLØST divisjon 45. Hele «45» gir 0 treff hos
  -- Brreg, og næringen ligger nå spredt på to helt andre divisjoner —
  -- verifisert med navn og volum 2026-08-04:
  --   45.112 bilsalg      -> 47.81 «Detaljhandel med motorvogner» (5 603)
  --   45.200 verksted     -> 95.31 «Reparasjon av motorvogner» (7 491)
  --   45.320 bildeler     -> 47.82 «Deler og utstyr til motorvogner» (1 361)
  --   45.402/403 motorsykkel -> 47.83 (386) og 95.32 (232)
  -- Bilia Norge AS ligger på 95.310, Toyota Bilia AS på 47.810. Hadde vi
  -- gjettet prefikset ut fra SSB-koden, ville alle fire topplistene vært tomme.
  --
  -- 45.111/45.191 er agentur og engros — importørleddet, ikke forhandleren
  -- folk kjører til — og holdes utenfor. Dekkhotell har ingen egen kode i noen
  -- av standardene; det er en tjeneste under verksted og delehandel.
  ('bilforhandler','45.112','ssb'), ('bilforhandler','47.81','brreg'),
  ('bilverksted','45.200','ssb'), ('bilverksted','95.31','brreg'),
  ('dekk-bildeler','45.320','ssb'), ('dekk-bildeler','47.82','brreg'),
  ('motorsykkel-fritid','45.402','ssb'), ('motorsykkel-fritid','45.403','ssb'),
  ('motorsykkel-fritid','47.83','brreg'), ('motorsykkel-fritid','95.32','brreg')
) as m(slug, kode, kilde)
join categories c on c.slug = m.slug;

-- Kjedelisten. org_nr fylles av det målrettede Brreg-oppslaget (plan-task 6);
-- null her betyr «ennå ikke slått opp», og brand_liste() viser da navnet
-- uten tall. Tall som vises er hovedselskapets regnskap — merknaden sier
-- hvilket selskap det er.
-- Kjedelisten. Visningsnavnet er det brukeren kjenner; sok_navn er det
-- Enhetsregisteret kjenner, og import-brreg ?brands=1 slår opp org_nr fra
-- det med streng matching. De org_nr som står her er verifiserte oppslag —
-- merk at flere kjedekontorer har næringskode 77.400 (franchisegiver) eller
-- 82.990, ikke detaljhandel: de dukker derfor ikke opp i kategorienes
-- topplister, bare her. Tallene er hovedselskapets, aldri hele kjedens, og
-- merknaden sier hvilket selskap det er.
insert into brands (navn, category_id, org_nr, sok_navn, merknad)
select b.navn, c.id, nullif(b.org_nr, ''), b.sok_navn, b.merknad from (values
  ('REMA 1000','dagligvare','982254604','REMA 1000 NORGE AS','Rema 1000 Norge AS — franchisegiver (NACE 77.400), ikke butikkdrift'),
  ('KIWI','dagligvare','975959171','KIWI NORGE AS','Kiwi Norge AS — kjedekontor i NorgesGruppen (NACE 82.990)'),
  ('Coop Extra','dagligvare','936560288','COOP NORGE SA','Coop Norge SA — samvirkets fellesregnskap, engros (NACE 46.390)'),
  ('Bunnpris','dagligvare','814055922','I K LYKKE AS','I.K. Lykke AS — eier Bunnpris-kjeden'),
  ('Narvesen','kiosk','983415660','REITAN CONVENIENCE NORWAY AS','Reitan Convenience Norway AS — driver både Narvesen og 7-Eleven'),
  ('7-Eleven','kiosk','983415660','REITAN CONVENIENCE NORWAY AS','Samme selskap som Narvesen: Reitan Convenience Norway AS'),
  ('Dressmann','klesbutikk','979490674','VARNER AS','Varner AS — driver Dressmann, Cubus, Bik Bok m.fl.'),
  ('Cubus','klesbutikk','979490674','VARNER AS','Samme selskap som Dressmann: Varner AS'),
  ('H&M Norge','klesbutikk','','H & M HENNES & MAURITZ AS','Norsk driftsselskap'),
  ('Eurosko','skobutikk','','EUROSKO NORGE AS','Kjedekontoret; butikkene er egne aksjeselskaper'),
  ('XXL','sportsbutikk','881932792','XXL SPORT & VILLMARK AS','XXL Sport & Villmark AS — 2 045 ansatte'),
  ('Sport 1','sportsbutikk','984889070','SPORT 1 AS','Sport 1 AS — kjedekontor'),
  ('IKEA','mobel-interior','914787521','IKEA AS','IKEA AS — norsk driftsselskap, 3 060 ansatte'),
  ('Skeidar','mobel-interior','','SKEIDAR LIVING GROUP AS','Kjedekontoret; varehusene er egne aksjeselskaper'),
  ('Elkjøp','elektronikkbutikk','','ELKJØP NORGE AS','Norsk driftsselskap'),
  ('Power','elektronikkbutikk','','POWER NORGE AS','Norsk driftsselskap'),
  ('Bjørklund','gullsmed','','BJØRKLUND NORGE AS','Kjedekontoret'),
  ('Gullfunn','gullsmed','','GULLFUNN AS','Kjedekontoret'),
  ('Specsavers','optiker','','SPECSAVERS NORWAY AS','Norsk driftsselskap'),
  ('Brilleland','optiker','','BRILLELAND AS','Kjedekontoret'),
  ('Plantasjen','blomster-hage','','PLANTASJEN NORGE AS','Norsk driftsselskap'),
  ('Mester Grønn','blomster-hage','','MESTER GRØNN AS','Driftsselskapet'),
  ('Scandic','hotell-overnatting','','SCANDIC HOTELS AS','Norsk driftsselskap'),
  ('Thon Hotels','hotell-overnatting','','THON HOTELS AS','Driftsselskapet'),
  ('Strawberry','hotell-overnatting','','STRAWBERRY','Tidligere Nordic Choice; driftsselskapet'),
  ('McDonald''s','gatekjokken','','MCDONALD''S NORGE AS','Norsk driftsselskap'),
  ('Burger King','gatekjokken','','KING FOOD AS','King Food AS — norsk franchisetaker'),
  ('Peppes Pizza','restaurant-kafe','','PEPPES PIZZA AS','Driftsselskapet'),
  ('Egon','restaurant-kafe','','NORREIN AS','Norrein AS — driver Egon-kjeden'),
  ('Espresso House','restaurant-kafe','','ESPRESSO HOUSE NORWAY AS','Norsk driftsselskap'),
  ('SATS','treningssenter','','SATS NORWAY AS','Norsk driftsselskap'),
  ('Evo Fitness','treningssenter','','EVO FITNESS','Kjedekontoret'),
  ('Fresh Fitness','treningssenter','','FRESH FITNESS AS','Del av SATS-konsernet'),
  ('Cutters','frisor','','CUTTERS AS','Cutters AS — kjedekontoret'),
  ('Nikita','frisor','','RAISE GRUPPEN AS','Raise Gruppen AS — driver Nikita'),
  ('Colosseum Tannlege','tannlege','','COLOSSEUM DENTAL NORWAY AS','Norsk driftsselskap'),
  ('Oris Dental','tannlege','','ORIS DENTAL','Driftsselskapet'),
  ('Azets','regnskap-revisjon','','AZETS INSIGHT AS','Norsk driftsselskap'),
  ('View Group','regnskap-revisjon','','VIEW LEDGER AS','View-gruppens regnskapsselskap'),
  ('Insider','renhold','','INSIDER FACILITY SOLUTIONS AS','Driftsselskapet')
) as b(navn, slug, org_nr, sok_navn, merknad)
join categories c on c.slug = b.slug;

commit;
