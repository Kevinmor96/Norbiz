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
  ('regnskap-revisjon','Regnskap & revisjon','Tjenester','Regnskapsførerne og revisorene som alle andre bransjer trenger.','#3B7A57','calculator',61);

-- Medlemskoder. kilde='ssb' er SN2007 (statistikk), kilde='brreg' er
-- SN2025-prefikser (selskapsmatching). Prefiksene verifiseres mot Brreg i
-- utrullingstasken — et prefiks uten treff byttes der, ikke her.
insert into category_members (category_id, nace_code, kilde)
select c.id, m.kode, m.kilde from (values
  ('restaurant-kafe','56.101','ssb'), ('restaurant-kafe','56.11','brreg'),
  ('gatekjokken','56.102','ssb'), ('gatekjokken','56.12','brreg'),
  ('bar-pub','56.301','ssb'), ('bar-pub','56.309','ssb'), ('bar-pub','56.30','brreg'),
  ('catering-kantine','56.210','ssb'), ('catering-kantine','56.290','ssb'),
  ('catering-kantine','56.21','brreg'), ('catering-kantine','56.29','brreg'),
  ('bakeri-konditori','10.710','ssb'), ('bakeri-konditori','47.241','ssb'),
  ('bakeri-konditori','10.71','brreg'), ('bakeri-konditori','47.24','brreg'),
  ('dagligvare','47.111','ssb'), ('dagligvare','47.11','brreg'),
  ('kiosk','47.112','ssb'), ('kiosk','47.12','brreg'),
  ('klesbutikk','47.710','ssb'), ('klesbutikk','47.71','brreg'),
  ('skobutikk','47.721','ssb'), ('skobutikk','47.72','brreg'),
  ('sportsbutikk','47.641','ssb'), ('sportsbutikk','47.64','brreg'),
  ('mobel-interior','47.591','ssb'), ('mobel-interior','47.531','ssb'),
  ('mobel-interior','47.59','brreg'), ('mobel-interior','47.53','brreg'),
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
  ('opplevelser-aktiviteter','93.2','brreg'), ('opplevelser-aktiviteter','49.39','brreg'),
  ('reisebyra-arrangor','79.110','ssb'), ('reisebyra-arrangor','79.120','ssb'),
  ('reisebyra-arrangor','79','brreg'),
  ('frisor','96.020','ssb'), ('frisor','96.21','brreg'),
  ('hudpleie-velvare','96.040','ssb'), ('hudpleie-velvare','96.22','brreg'),
  ('treningssenter','93.130','ssb'), ('treningssenter','93.13','brreg'),
  ('tannlege','86.230','ssb'), ('tannlege','86.23','brreg'),
  ('fysioterapi','86.901','ssb'), ('fysioterapi','86.91','brreg'),
  ('byggefirma','41.200','ssb'), ('byggefirma','41.0','brreg'),
  ('elektriker','43.210','ssb'), ('elektriker','43.21','brreg'),
  ('rorlegger','43.221','ssb'), ('rorlegger','43.222','ssb'), ('rorlegger','43.22','brreg'),
  ('maler-overflate','43.341','ssb'), ('maler-overflate','43.390','ssb'),
  ('maler-overflate','43.3','brreg'),
  ('renhold','81.210','ssb'), ('renhold','81.291','ssb'), ('renhold','81.299','ssb'),
  ('renhold','81.2','brreg'),
  ('regnskap-revisjon','69.201','ssb'), ('regnskap-revisjon','69.202','ssb'),
  ('regnskap-revisjon','69.2','brreg')
) as m(slug, kode, kilde)
join categories c on c.slug = m.slug;

-- Kjedelisten. org_nr fylles av det målrettede Brreg-oppslaget (plan-task 6);
-- null her betyr «ennå ikke slått opp», og brand_liste() viser da navnet
-- uten tall. Tall som vises er hovedselskapets regnskap — merknaden sier
-- hvilket selskap det er.
insert into brands (navn, category_id, org_nr, merknad)
select b.navn, c.id, null, b.merknad from (values
  ('REMA 1000','dagligvare','Hovedkontoret Rema 1000 Norge AS'),
  ('KIWI','dagligvare','Kiwi Norge AS, del av NorgesGruppen'),
  ('Coop Extra','dagligvare','Coop Norge SA — samvirke, ett samlet regnskap'),
  ('Bunnpris','dagligvare','I.K. Lykke AS'),
  ('Narvesen','kiosk','Reitan Convenience Norway AS'),
  ('7-Eleven','kiosk','Reitan Convenience Norway AS'),
  ('Dressmann','klesbutikk','Varner-gruppen'),
  ('Cubus','klesbutikk','Varner-gruppen'),
  ('H&M Norge','klesbutikk','H & M Hennes & Mauritz AS'),
  ('Eurosko','skobutikk','Euro Sko Norge AS'),
  ('XXL','sportsbutikk','XXL Sport & Villmark AS'),
  ('Sport 1','sportsbutikk','Sport 1 Gruppen AS'),
  ('IKEA','mobel-interior','IKEA AS'),
  ('Skeidar','mobel-interior','Skeidar Living Group AS'),
  ('Elkjøp','elektronikkbutikk','Elkjøp Norge AS'),
  ('Power','elektronikkbutikk','Power Norge AS'),
  ('Bjørklund','gullsmed','Bjørklund Norge AS'),
  ('Gullfunn','gullsmed','Gullfunn-kjeden'),
  ('Specsavers','optiker','Specsavers Norway AS'),
  ('Brilleland','optiker','Brilleland AS'),
  ('Plantasjen','blomster-hage','Plantasjen Norge AS'),
  ('Mester Grønn','blomster-hage','Mester Grønn AS'),
  ('Scandic','hotell-overnatting','Scandic Hotels AS (norsk driftsselskap)'),
  ('Thon Hotels','hotell-overnatting','Thon Hotels AS'),
  ('Strawberry','hotell-overnatting','Strawberry Hotels-driftsselskapet'),
  ('McDonald''s','gatekjokken','McDonald''s Norge AS'),
  ('Burger King','gatekjokken','King Food AS'),
  ('Peppes Pizza','restaurant-kafe','Peppes Pizza AS'),
  ('Egon','restaurant-kafe','Norrein AS'),
  ('Espresso House','restaurant-kafe','Espresso House Norway AS'),
  ('SATS','treningssenter','SATS Norway AS'),
  ('Evo Fitness','treningssenter','Evo Fitness AS'),
  ('Fresh Fitness','treningssenter','Fresh Fitness AS'),
  ('Cutters','frisor','Cutters AS'),
  ('Nikita','frisor','Raise Gruppen AS'),
  ('Colosseum Tannlege','tannlege','Colosseum Dental Norway AS'),
  ('Oris Dental','tannlege','Oris Dental-driftsselskapet'),
  ('Azets','regnskap-revisjon','Azets Insight AS'),
  ('View Group','regnskap-revisjon','View Group-driftsselskapet'),
  ('Insider','renhold','Insider Facility Solutions AS')
) as b(navn, slug, merknad)
join categories c on c.slug = b.slug;

commit;
