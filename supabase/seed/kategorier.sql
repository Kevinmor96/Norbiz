-- Det kuraterte kategorilaget. Redaksjon, ikke generert: dette er
-- oppdelingen som er produktets konkurransefortrinn, og den vedlikeholdes
-- for hånd her. Kjøres ETTER seed.sql — seed-ens truncate av industries
-- kaskaderer til category_members.
begin;

truncate category_members, brands, categories restart identity cascade;
-- nace_sn2025 tømmes ikke: den er kodeverk, ikke redaksjon.

-- Offisiell tittel for hvert brreg-prefiks vi bruker, fra SSBs SN2025-kodeverk.
--
-- Radene ligger her og ikke bare i livebasen fordi det er DENNE sjekken som
-- manglet: uten titlene kan man bare telle treff, og det var nettopp det som
-- lot 47.64 stå som «sportsbutikk» når koden heter «Detaljhandel med spill og
-- leker». Med titlene i testbasen kan tests/categories.test.ts holde hvert
-- prefiks mot sin egen tittel, uten nett.
--
-- Livebasen har alle 1 785 kodene fra Klass-API-et; her er bare de vi bruker.
insert into nace_sn2025 (code, navn, nivaa) values
  ('10.71','Produksjon av brød og ferske konditorvarer',4),
  ('41.0','Oppføring av bygninger',3),
  ('43.21','Elektrisk installasjonsarbeid',4),
  ('43.22','VVS-arbeid',4),
  ('43.33','Gulvlegging og tapetsering',4),
  ('43.34','Maler- og glassarbeid',4),
  ('47.11','Detaljhandel med bredt vareutvalg med hovedvekt på nærings- og nytelsesmidler',4),
  ('47.12','Detaljhandel med bredt vareutvalg ellers',4),
  ('47.24','Detaljhandel med bakervarer, konditorvarer og sukkervarer',4),
  ('47.4','Detaljhandel med informasjons- og kommunikasjonsteknologiutstyr',3),
  ('47.53','Detaljhandel med tapet, gulvtepper og gulvbelegg',4),
  ('47.55','Detaljhandel med møbler, belysningsutstyr, dekketøy og andre innredningsartikler',4),
  ('47.631','Detaljhandel med sportsvarer',5),
  ('47.71','Detaljhandel med klær',4),
  ('47.72','Detaljhandel med skotøy og lærvarer',4),
  ('47.74','Detaljhandel med medisinske og ortopediske artikler',4),
  ('47.761','Detaljhandel med blomster, planter, gjødsel og plantevernmidler',5),
  ('47.77','Detaljhandel med ur, klokker og smykker',4),
  ('47.81','Detaljhandel med motorvogner',4),
  ('47.82','Detaljhandel med deler og utstyr til motorvogner',4),
  ('47.83','Detaljhandel med motorsykler og tilhørende deler og utstyr',4),
  ('55.1','Drift av hoteller',3),
  ('55.2','Drift av vandrerhjem og ferieleiligheter',3),
  ('55.3','Drift av campingplasser',3),
  ('56.11','Drift av restauranter',4),
  ('56.12','Drift av mobile serveringssteder',4),
  ('56.2','Catering for arrangementer, kantinedrift og annen cateringvirksomhet',3),
  ('56.30','Drift av barer',4),
  ('59.11','Produksjon av film, video og fjernsynsprogrammer',4),
  ('68.31','Eiendomsmegling og andre formidlingstjenester for eiendom',4),
  ('68.32','Eiendomsforvaltning på oppdrag',4),
  ('69.1','Juridisk tjenesteyting',3),
  ('69.2','Regnskapsføring, bokføring, revisjon og skatterådgivning',3),
  ('73.1','Annonse- og reklamevirksomhet',3),
  ('79','Reisebyrå- og reisearrangørvirksomhet og tilknyttede tjenester',2),
  ('81.2','Rengjøringsvirksomhet',3),
  ('86.23','Tannlegetjenester',4),
  ('86.95','Fysioterapi- og ergoterapitjenester',4),
  ('93.13','Treningssentervirksomhet',4),
  ('93.2','Fornøyelses- og fritidsaktiviteter',3),
  ('95.31','Reparasjon og vedlikehold av motorvogner',4),
  ('95.32','Reparasjon og vedlikehold av motorsykler',4),
  ('96.21','Frisering og barbering',4),
  ('96.22','Skjønnhetspleie',4)
on conflict (code) do update set navn = excluded.navn, nivaa = excluded.nivaa;

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
  ('rorlegger','Rørlegger & ventilasjon','Bygg & håndverk','Rørlegger- og ventilasjonsfaget: håndverket alle trenger, i tall.','#D08C1D','wrench',52),
  ('maler-overflate','Maler & overflate','Bygg & håndverk','Maler- og overflatefagene: lav terskel, hard priskonkurranse.','#D08C1D','paint-roller',53),
  ('renhold','Renhold','Tjenester','Renholdsbransjen: milliardmarked med små og store aktører.','#3B7A57','spray-can',60),
  ('regnskap-revisjon','Regnskap & revisjon','Tjenester','Regnskapsførerne og revisorene som alle andre bransjer trenger.','#3B7A57','calculator',61),
  ('bilforhandler','Bilforhandler','Bil & motor','130 milliarder i omsetning og 2,7 % margin — volumbransjen framfor noen.','#4C6EF5','car',70),
  ('bilverksted','Bilverksted','Bil & motor','4 500 verksteder: bedre margin enn å selge bilene.','#4C6EF5','wrench',71),
  ('dekk-bildeler','Dekk & bildeler','Bil & motor','Delehandel og dekkservice — verkstedbransjens tvilling.','#4C6EF5','disc',72),
  ('motorsykkel-fritid','Motorsykkel & fritidskjøretøy','Bil & motor','MC, snøscooter og ATV: liten bransje, lojale kunder.','#4C6EF5','bike',73),
  ('advokat','Advokat','Tjenester','34 % driftsmargin på 27,5 milliarder — den mest lønnsomme tjenestenæringen vi måler.','#3B7A57','scale',62),
  ('reklame-mediebyra','Reklame & mediebyrå','Media & kommunikasjon','5 600 byråer, 30 milliarder — og 6 % margin. Kreativt fag, tøff økonomi.','#0FA3B1','megaphone',80),
  ('film-tv','Film & TV-produksjon','Media & kommunikasjon','4 100 produksjonsselskaper på 8 milliarder. Prosjektbransjen i tall.','#0FA3B1','clapperboard',81),
  ('eiendomsmegler','Eiendomsmegler','Eiendom','1 291 foretak, 14,8 milliarder i provisjon. Følger boligmarkedet slag i slag.','#8C2F39','key',90),
  ('eiendomsforvaltning','Eiendomsforvaltning','Eiendom','18,9 % margin på å drifte andres bygg — stabil inntekt, lite kapital.','#8C2F39','building',91),
  ('eiendomsutvikler','Eiendomsutvikler','Eiendom','87 milliarder i prosjekter. Høyest oppside, høyest konjunkturrisiko.','#8C2F39','crane',92);

-- Medlemskoder. kilde='ssb' er SN2007 (statistikk), kilde='brreg' er
-- SN2025-prefikser (selskapsmatching).
--
-- Å TELLE TREFF ER IKKE Å VERIFISERE. Første runde sjekket at hvert
-- brreg-prefiks ga treff hos Enhetsregisteret, og det var ikke nok. Fem
-- prefikser ga tusenvis av treff på HELT ANDRE bransjer, og feilen ble oppdaget
-- av en bruker som åpnet Sportsbutikk og fant leketøysbutikker:
--
--   sportsbutikk    47.64 -> 47.631  47.64 er «spill og leker» i SN2025.
--                                    Lekekassen og Extra Leker toppet lista.
--   optiker         47.78 -> 47.74   47.78 er «annen detaljhandel med andre nye
--                                    varer», en samlekode. Optikerne (Synsam,
--                                    Interoptik, Krogh) ligger på 47.740.
--   maler-overflate 43.3  -> 43.34   43.3 er all «ferdiggjøring av bygninger»;
--                          + 43.33   8 av 15 i lista var snekkere.
--   blomster-hage   47.76 -> 47.761  47.76 dro inn kjæledyrbutikkene i 47.762.
--   opplevelser     49.32 fjernet    bussturtransport var 10 av 15 i lista.
--
-- Regelen som følger av det: SLÅ OPP HVA KODEN HETER, ikke bare hvor mange
-- treff den gir. `nace_sn2025` under gjør oppslaget mulig uten nett, og
-- tests/categories.test.ts holder hvert prefiks mot sin offisielle tittel.
--
-- Fire prefikser måtte i tillegg byttes fordi SN2025 flyttet næringen:
--   møbel      47.59 -> 47.55  (47.551 møbler, 47.559 innredningsartikler)
--   kantine    56.29 -> 56.2   (56.29 finnes ikke; 56.210 er catering)
--   fysioterapi 86.91 -> 86.95 («Fysioterapi- og ergoterapitjenester»;
--                               86.93 er psykolog, ikke fysioterapi)
--   bil: hele divisjon 45 er oppløst, se blokka lenger ned.
--
-- To prefikser er bredere enn kategorinavnet, og det er bevisst fordi noe
-- smalere ikke finnes: 47.74 heter «medisinske og ortopediske artikler» og
-- rommer bandagister ved siden av optikerne, og 47.12 «bredt vareutvalg ellers»
-- er der kioskene bor. Begge er dominert av riktig bransje i praksis.
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
  ('sportsbutikk','47.641','ssb'), ('sportsbutikk','47.631','brreg'),
  ('mobel-interior','47.591','ssb'), ('mobel-interior','47.531','ssb'),
  ('mobel-interior','47.55','brreg'), ('mobel-interior','47.53','brreg'),
  ('elektronikkbutikk','47.410','ssb'), ('elektronikkbutikk','47.420','ssb'),
  ('elektronikkbutikk','47.430','ssb'), ('elektronikkbutikk','47.4','brreg'),
  ('gullsmed','47.772','ssb'), ('gullsmed','47.77','brreg'),
  ('optiker','47.782','ssb'), ('optiker','47.74','brreg'),
  ('blomster-hage','47.761','ssb'), ('blomster-hage','47.762','ssb'),
  ('blomster-hage','47.761','brreg'),
  ('hotell-overnatting','55.101','ssb'), ('hotell-overnatting','55.102','ssb'),
  ('hotell-overnatting','55.1','brreg'),
  ('camping-hytter','55.202','ssb'), ('camping-hytter','55.300','ssb'),
  ('camping-hytter','55.2','brreg'), ('camping-hytter','55.3','brreg'),
  ('opplevelser-aktiviteter','93.210','ssb'), ('opplevelser-aktiviteter','93.291','ssb'),
  ('opplevelser-aktiviteter','93.292','ssb'), ('opplevelser-aktiviteter','93.299','ssb'),
  ('opplevelser-aktiviteter','93.2','brreg'),
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
  ('maler-overflate','43.34','brreg'), ('maler-overflate','43.33','brreg'),
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
  ('motorsykkel-fritid','47.83','brreg'), ('motorsykkel-fritid','95.32','brreg'),
  -- Advokat, byråene og eiendom. Alle prefikser tellt med brreg-sonde før de
  -- ble skrevet inn, aldri gjettet ut fra SSB-koden (2026-08-04):
  --   69.1  advokat            2 878
  --   73.1  reklame + medie   11 084  (73.11 10 910 + 73.12 178)
  --   59.11 film og TV         7 708
  --   68.31 eiendomsmegling      781
  --   68.32 eiendomsforvaltning 12 742
  --   41.0  bygg og utvikling  25 347
  ('advokat','69.100','ssb'), ('advokat','69.1','brreg'),
  -- PR (70.210) hører hjemme her på folkemunne — «byrå» er «byrå» — men SN2025
  -- har ingen 70.21: prefikset gir 0 treff. Statistikken tar den derfor med,
  -- selskapslisten kan ikke. Det er riktig vei rundt: tallene blir komplette,
  -- og det som mangler er noen navn, ikke en verdi.
  ('reklame-mediebyra','73.110','ssb'), ('reklame-mediebyra','73.120','ssb'),
  ('reklame-mediebyra','70.210','ssb'), ('reklame-mediebyra','73.1','brreg'),
  ('film-tv','59.110','ssb'), ('film-tv','59.11','brreg'),
  ('eiendomsmegler','68.310','ssb'), ('eiendomsmegler','68.31','brreg'),
  ('eiendomsforvaltning','68.320','ssb'), ('eiendomsforvaltning','68.32','brreg'),
  -- Eiendomsutvikler deler brreg-prefiks med Byggefirma, og det er ikke en
  -- forglemmelse: SN2025 har SLÅTT SAMMEN utvikling og oppføring til én kode,
  -- 41.000 (25 347 enheter; 41.001 og 41.009 gir 0). SSB skiller dem fortsatt
  -- — 41.101/41.109 mot 41.200 — så statistikken er ekte og forskjellig, mens
  -- selskapslisten er den samme populasjonen fordi kilden ikke kan skille dem.
  -- Alternativet var en tom toppliste, og et tomt panel er ikke mer sant enn
  -- et delt et. UI-et skal si det: «Brreg skiller ikke utvikler fra utfører.»
  ('eiendomsutvikler','41.101','ssb'), ('eiendomsutvikler','41.109','ssb'),
  ('eiendomsutvikler','41.0','brreg')
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
-- org_nr-kolonnen er nå fylt for de fleste: verdiene under er de oppslagene
-- ?brands=1&slaopp=1 gjorde mot Enhetsregisteret 2026-08-04, skrevet tilbake
-- hit slik at fila er kilden og oppslaget bare en oppfriskning. De som ennå er
-- tomme fant ikke et selskap som besto den strenge navnematchingen.
--
-- SEGMENT. `segment='luksus'` er en merking av AKTØREN, ikke en bransje. Det er
-- et bevisst valg: SSB har ingen luksuskode, så en «luksuskategori» med margin
-- og vekst måtte enten lånt tallene fra klesbutikk og gullsmed eller diktet
-- dem. Her er hvert tall selskapets eget, fra Regnskapsregisteret.
--
-- Lista er kort med vilje. Norge har noen få reelle luksusbutikker, og alle ni
-- under er slått opp i Enhetsregisteret med organisasjonsform, næringskode og
-- ansatte kontrollert. Rolex, Burberry og Tiffany er IKKE med: de har ingen
-- norsk registrert enhet.
--
-- Hermès ble funnet på annen måte enn de øvrige, og det er verdt å merke seg:
-- navnesøket «HERMES» ga bare støy (et forsikringsselskap, et reisebyrå), fordi
-- selskapet heter HERMÈS NORWAY AS med aksent. Det dukket opp av seg selv i
-- skobutikk-topplisten etter at selskapsutvalget ble utvidet. Å søke i basen på
-- navn vi allerede har hentet er en bedre kilde til kandidater enn å gjette
-- navnene — gjettingen bommer på skrivemåten. Chanel Norway AS er ikke med heller — selskapet er
-- engros kosmetikk (46.450), ikke butikkdrift. Hugo Boss og Acne er premium,
-- ikke luksus, og ville utvannet stripa.
--
-- Merk næringskoden: Louis Vuitton Norge AS står på 47.720, skotøy. Det er
-- Brregs registrering, ikke vår, og forklarer hvorfor et luksushus dukker opp i
-- skobutikk-topplisten. Merkingen gjør det forståelig i stedet for å skjule det.
--
-- PRADA NORWAY AS (930067733) sto her en runde og ble tatt ut igjen. Selskapet
-- finnes, men tallene stemmer ikke med en boutique: 8,3 mill. omsetning på 13
-- ansatte er 640 000 per hode, langt under luksusretail, og næringskoden er
-- 47.120 — kiosk. Sannsynligvis ikke butikkdriften. Et feil selskaps tall under
-- et kjent merkenavn er verre enn ingen tall, og det gjelder dobbelt i den
-- delen av produktet der navnene er mest gjenkjennelige.
insert into brands (navn, category_id, org_nr, sok_navn, segment, merknad)
select b.navn, c.id, nullif(b.org_nr, ''), b.sok_navn, nullif(b.segment,''), b.merknad from (values
  ('REMA 1000','dagligvare','982254604','REMA 1000 NORGE AS','','Rema 1000 Norge AS — franchisegiver (NACE 77.400), ikke butikkdrift'),
  ('KIWI','dagligvare','975959171','KIWI NORGE AS','','Kiwi Norge AS — kjedekontor i NorgesGruppen (NACE 82.990)'),
  ('Coop Extra','dagligvare','936560288','COOP NORGE SA','','Coop Norge SA — samvirkets fellesregnskap, engros (NACE 46.390)'),
  ('Bunnpris','dagligvare','814055922','I K LYKKE AS','','I.K. Lykke AS — eier Bunnpris-kjeden'),
  ('Narvesen','kiosk','983415660','REITAN CONVENIENCE NORWAY AS','','Reitan Convenience Norway AS — driver både Narvesen og 7-Eleven'),
  ('7-Eleven','kiosk','983415660','REITAN CONVENIENCE NORWAY AS','','Samme selskap som Narvesen: Reitan Convenience Norway AS'),
  ('Dressmann','klesbutikk','979490674','VARNER AS','','Varner AS — driver Dressmann, Cubus, Bik Bok m.fl.'),
  ('Cubus','klesbutikk','979490674','VARNER AS','','Samme selskap som Dressmann: Varner AS'),
  ('H&M Norge','klesbutikk','912618900','H & M HENNES & MAURITZ AS','','Norsk driftsselskap'),
  ('Eurosko','skobutikk','','EUROSKO NORGE AS','','Kjedekontoret; butikkene er egne aksjeselskaper'),
  ('XXL','sportsbutikk','881932792','XXL SPORT & VILLMARK AS','','XXL Sport & Villmark AS — 2 045 ansatte'),
  ('Sport 1','sportsbutikk','984889070','SPORT 1 AS','','Sport 1 AS — kjedekontor'),
  ('IKEA','mobel-interior','914787521','IKEA AS','','IKEA AS — norsk driftsselskap, 3 060 ansatte'),
  ('Skeidar','mobel-interior','','SKEIDAR LIVING GROUP AS','','Kjedekontoret; varehusene er egne aksjeselskaper'),
  ('Elkjøp','elektronikkbutikk','947054600','ELKJØP NORGE AS','','Norsk driftsselskap'),
  ('Power','elektronikkbutikk','977047838','POWER NORGE AS','','Norsk driftsselskap'),
  ('Bjørklund','gullsmed','964086192','BJØRKLUND NORGE AS','','Kjedekontoret'),
  ('Gullfunn','gullsmed','916588739','GULLFUNN AS','','Kjedekontoret'),
  ('Specsavers','optiker','987644087','SPECSAVERS NORWAY AS','','Norsk driftsselskap'),
  ('Brilleland','optiker','','BRILLELAND AS','','Kjedekontoret'),
  ('Plantasjen','blomster-hage','937087977','PLANTASJEN NORGE AS','','Norsk driftsselskap'),
  ('Mester Grønn','blomster-hage','933944522','MESTER GRØNN AS','','Driftsselskapet'),
  ('Scandic','hotell-overnatting','953149117','SCANDIC HOTELS AS','','Norsk driftsselskap'),
  ('Thon Hotels','hotell-overnatting','987753579','THON HOTELS AS','','Driftsselskapet'),
  ('Strawberry','hotell-overnatting','917784620','STRAWBERRY','','Tidligere Nordic Choice; driftsselskapet'),
  ('McDonald''s','gatekjokken','','MCDONALD''S NORGE AS','','Norsk driftsselskap'),
  ('Burger King','gatekjokken','984388608','KING FOOD AS','','King Food AS — norsk franchisetaker'),
  ('Peppes Pizza','restaurant-kafe','984388659','PEPPES PIZZA AS','','Driftsselskapet'),
  ('Egon','restaurant-kafe','917377529','NORREIN AS','','Norrein AS — driver Egon-kjeden'),
  ('Espresso House','restaurant-kafe','','ESPRESSO HOUSE NORWAY AS','','Norsk driftsselskap'),
  ('SATS','treningssenter','892625522','SATS NORWAY AS','','Norsk driftsselskap'),
  ('Evo Fitness','treningssenter','','EVO FITNESS','','Kjedekontoret'),
  ('Fresh Fitness','treningssenter','995415569','FRESH FITNESS AS','','Del av SATS-konsernet'),
  ('Cutters','frisor','916024649','CUTTERS AS','','Cutters AS — kjedekontoret'),
  ('Nikita','frisor','998945941','RAISE GRUPPEN AS','','Raise Gruppen AS — driver Nikita'),
  ('Colosseum Tannlege','tannlege','','COLOSSEUM DENTAL NORWAY AS','','Norsk driftsselskap'),
  ('Oris Dental','tannlege','921349890','ORIS DENTAL','','Driftsselskapet'),
  ('Azets','regnskap-revisjon','983338917','AZETS INSIGHT AS','','Norsk driftsselskap'),
  ('View Group','regnskap-revisjon','','VIEW LEDGER AS','','View-gruppens regnskapsselskap'),
  ('Insider','renhold','834327082','INSIDER FACILITY SOLUTIONS AS','','Driftsselskapet'),
  -- Luksus. Ni aktører, alle verifisert i Enhetsregisteret 2026-08-04.
  ('Urmaker Bjerke','gullsmed','929740114','URMAKER BJERKE AS','luksus','Urmaker Bjerke AS — 122 ansatte, NACE 47.770'),
  ('Thune','gullsmed','957338879','THUNE GULLSMED & URMAKER AS','luksus','Thune Gullsmed & Urmaker AS — 119 ansatte'),
  ('David-Andersen','gullsmed','985172277','DAVID-ANDERSEN AS','luksus','David-Andersen AS — norsk gullsmedhus, 90 ansatte'),
  ('Juveler Conrad Langaard','gullsmed','934536770','JUVELER CONRAD LANGAARD AS','luksus','Står på NACE 32.120 (smykkeproduksjon), så selskapet er ikke med i gullsmed-topplisten'),
  ('Louis Vuitton','skobutikk','989331388','LOUIS VUITTON NORGE AS','luksus','Louis Vuitton Norge AS. Brreg har selskapet på 47.720 (skotøy) — derfor står det i skobutikk-topplisten'),
  ('Hermès','skobutikk','925176486','HERMÈS NORWAY AS','luksus','Hermès Norway AS, også på 47.720. 332 mill. på 18 ansatte — høyeste omsetning per hode i stripa'),
  ('Mulberry','skobutikk','961545684','MULBERRY OSLO AS','luksus','Mulberry Oslo AS, NACE 47.720'),
  ('Ferner Jacobsen','klesbutikk','813025582','FERNER JACOBSEN AKTIESELSKAP','luksus','Ferner Jacobsen Aktieselskap — Oslos klassiske motehus, 55 ansatte'),
  ('Illums Bolighus','mobel-interior','993075930','ILLUMS BOLIGHUS NORGE AS','luksus','Illums Bolighus Norge AS — 224 ansatte, NACE 47.551')
) as b(navn, slug, org_nr, sok_navn, segment, merknad)
join categories c on c.slug = b.slug;

commit;
