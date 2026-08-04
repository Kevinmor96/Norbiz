import type { ProfileName } from './config.js';

export interface IndustryRow {
  nace_code: string;
  nace_level: number;
  parent_code: string | null;
  name: string;
  common_name: string;
  slug: string;
  profile: ProfileName;
  search_terms: string[];
}

type Leaf = [string, string, string];
type Group = [string, string, Leaf[]];
type Top = [string, string, ProfileName, Group[]];

/** 12 toppnæringer -> 3-siffer -> 60 femsifrede blader. */
export const TREE: Top[] = [
  ['56', 'Serveringsvirksomhet', 'servering', [
    ['56.1', 'Restauranter', [['56.101','Drift av restauranter og kafeer','Restaurant'],
                              ['56.102','Drift av gatekjøkken','Gatekjøkken']]],
    ['56.3', 'Drikkestedvirksomhet', [['56.301','Drift av puber','Pub'],
                                      ['56.309','Drikkesteder ellers','Bar']]],
    ['56.2', 'Cateringvirksomhet', [['56.210','Cateringvirksomhet','Cateringfirma'],
                                    ['56.290','Kantiner drevet som selvstendig virksomhet','Kantinedrift']]]]],
  ['47', 'Detaljhandel', 'varehandel', [
    ['47.1', 'Butikkhandel med bredt vareutvalg', [['47.111','Dagligvareforretning','Dagligvarebutikk'],
                                                    ['47.112','Kioskhandel med bredt vareutvalg','Kiosk'],
                                                    ['47.190','Butikkhandel ellers','Varehus']]],
    ['47.2', 'Butikkhandel med mat og drikke i spesialforretninger', [
        ['47.241','Butikkhandel med bakervarer og konditorvarer','Bakeriutsalg']]],
    ['47.4', 'Butikkhandel med IKT-utstyr', [
        ['47.410','Butikkhandel med datamaskiner og utstyr til datamaskiner','Databutikk'],
        ['47.420','Butikkhandel med telekommunikasjonsutstyr','Mobilbutikk'],
        ['47.430','Butikkhandel med audio- og videoutstyr','Elektronikkbutikk']]],
    ['47.5', 'Butikkhandel med husholdningsvarer', [
        ['47.531','Butikkhandel med tapeter og gulvbelegg','Fargehandel'],
        ['47.591','Butikkhandel med møbler','Møbelbutikk']]],
    ['47.7', 'Annen butikkhandel', [['47.710','Butikkhandel med klær','Klesbutikk'],
                                    ['47.721','Butikkhandel med skotøy','Skobutikk'],
                                    ['47.762','Butikkhandel med blomster','Blomsterbutikk'],
                                    ['47.772','Butikkhandel med gull- og sølvvarer','Gullsmed'],
                                    ['47.782','Butikkhandel med optiske artikler','Optiker'],
                                    ['47.641','Butikkhandel med sportsutstyr','Sportsbutikk'],
                                    ['47.761','Butikkhandel med blomster og planter','Hagesenter']]],
    ['47.3', 'Detaljhandel med drivstoff', [['47.300','Detaljhandel med drivstoff','Bensinstasjon']]]]],
  ['10', 'Næringsmiddelindustri', 'servering', [
    ['10.7', 'Produksjon av bakeri- og pastavarer', [
        ['10.710','Produksjon av brød og ferske konditorvarer','Bakeri']]]]],
  ['55', 'Overnattingsvirksomhet', 'servering', [
    ['55.1', 'Hotellvirksomhet', [['55.101','Drift av hoteller, pensjonater og moteller med restaurant','Hotell'],
                                  ['55.102','Drift av hoteller, pensjonater og moteller uten restaurant','Hotell garni']]],
    ['55.2', 'Ferieboliger og vandrerhjem', [['55.202','Drift av ferieleiligheter','Utleiehytter']]],
    ['55.3', 'Campingplasser', [['55.300','Drift av campingplasser','Campingplass']]]]],
  ['79', 'Reisebyråer og reisearrangører', 'tjenesteyting', [
    ['79.1', 'Reisebyrå- og reisearrangørvirksomhet', [['79.110','Reisebyråvirksomhet','Reisebyrå'],
                                                       ['79.120','Reisearrangørvirksomhet','Turoperatør']]]]],
  ['49', 'Landtransport', 'tjenesteyting', [
    ['49.3', 'Annen landtransport med passasjerer', [['49.392','Turbiltransport','Turbilselskap']]]]],
  ['45', 'Handel med og reparasjon av motorvogner', 'varehandel', [
    ['45.1', 'Handel med motorvogner', [
        ['45.112','Detaljhandel med biler og lette motorvogner','Bilforhandler']]],
    ['45.2', 'Vedlikehold og reparasjon av motorvogner', [
        ['45.200','Vedlikehold og reparasjon av motorvogner','Bilverksted']]],
    ['45.3', 'Handel med deler og utstyr til motorvogner', [
        ['45.320','Detaljhandel med deler og utstyr til motorvogner','Bildelbutikk']]],
    ['45.4', 'Handel med og reparasjon av motorsykler', [
        ['45.402','Detaljhandel med motorsykler, deler og utstyr','Motorsykkelbutikk'],
        ['45.403','Vedlikehold og reparasjon av motorsykler','MC-verksted']]]]],
  ['41', 'Oppføring av bygninger', 'bygg', [
    ['41.1', 'Utvikling av byggeprosjekter', [['41.101','Boligbyggelag','Boligbyggelag'],
                                              ['41.109','Utvikling av byggeprosjekter ellers','Boligutvikler']]],
    ['41.2', 'Oppføring av bygninger', [['41.200','Oppføring av bygninger','Byggefirma']]]]],
  ['43', 'Spesialisert bygge- og anleggsvirksomhet', 'bygg', [
    ['43.2', 'Elektrisk installasjon og VVS', [['43.210','Elektrisk installasjonsarbeid','Elektriker'],
                                               ['43.221','Rørleggerarbeid','Rørlegger'],
                                               ['43.222','Ventilasjonsarbeid','Ventilasjonsfirma']]],
    ['43.3', 'Ferdiggjøring av bygninger', [['43.310','Stukkatørarbeid og pussing','Murer'],
                                            ['43.320','Snekkerarbeid','Snekker'],
                                            ['43.341','Malerarbeid','Maler'],
                                            ['43.390','Ferdiggjøring ellers','Byggtapetserer']]],
    ['43.1', 'Riving og grunnarbeid', [['43.110','Riving av bygninger','Rivingsfirma'],
                                       ['43.120','Grunnarbeid','Grunnentreprenør'],
                                       ['43.130','Prøveboring','Borefirma']]],
    ['43.9', 'Annen spesialisert bygge- og anleggsvirksomhet', [
        ['43.919','Takarbeid','Takentreprenør'],
        ['43.911','Blikkenslagerarbeid','Blikkenslager'],
        ['43.990','Bygge- og anleggsvirksomhet ellers','Stillasfirma']]]]],
  ['96', 'Annen personlig tjenesteyting', 'tjenesteyting', [
    ['96.0', 'Annen personlig tjenesteyting', [['96.020','Frisering og annen skjønnhetspleie','Frisørsalong'],
                                               ['96.040','Skjønnhetspleie','Hudpleie og kroppspleie'],
                                               ['96.010','Vaskeri- og renserivirksomhet','Renseri'],
                                               ['96.090','Personlig tjenesteyting ellers','Tatoveringsstudio']]]]],
  ['93', 'Sport og fritid', 'tjenesteyting', [
    ['93.1', 'Sports- og idrettsaktiviteter', [['93.130','Treningssentre','Treningssenter'],
                                               ['93.110','Drift av idrettsanlegg','Idrettsanlegg'],
                                               ['93.190','Idrettslag og -klubber','Idrettsklubb'],
                                               ['93.120','Idrettslag og -klubber for enkeltidretter','Fotballklubb']]],
    ['93.2', 'Fornøyelse og fritid', [['93.210','Drift av fornøyelsesetablissementer','Fornøyelsespark'],
                                      ['93.291','Drift av treningsstudio for dans','Dansestudio'],
                                      ['93.292','Fritidsetablissement','Opplevelsessenter'],
                                      ['93.299','Fritidsvirksomhet ellers','Aktivitetssenter']]]]],
  ['69', 'Juridisk og regnskapsmessig tjenesteyting', 'radgivning', [
    ['69.1', 'Juridisk tjenesteyting', [['69.100','Juridisk tjenesteyting','Advokatfirma']]],
    ['69.2', 'Regnskap og revisjon', [['69.201','Regnskap og bokføring','Regnskapsfører'],
                                      ['69.202','Revisjon','Revisor']]]]],
  ['70', 'Hovedkontortjenester og administrativ rådgivning', 'radgivning', [
    ['70.2', 'Administrativ rådgivning', [['70.220','Bedriftsrådgivning','Bedriftsrådgiver'],
                                          ['70.210','PR og kommunikasjon','PR-byrå']]],
    ['70.1', 'Hovedkontortjenester', [['70.100','Hovedkontortjenester','Hovedkontor']]]]],
  ['62', 'Tjenester tilknyttet informasjonsteknologi', 'radgivning', [
    ['62.0', 'IT-tjenester', [['62.010','Programmeringstjenester','Programvarehus'],
                              ['62.020','Konsulentvirksomhet tilknyttet IT','IT-konsulent'],
                              ['62.030','Forvaltning og drift av IT-systemer','IT-drift']]]]],
  ['86', 'Helsetjenester', 'helse', [
    ['86.2', 'Lege- og tannlegetjenester', [['86.211','Allmenn legetjeneste','Legekontor'],
                                            ['86.230','Tannhelsetjenester','Tannlege']]],
    ['86.9', 'Andre helsetjenester', [['86.902','Fysioterapitjeneste','Fysioterapeut'],
                                      ['86.907','Kiropraktortjeneste','Kiropraktor'],
                                      ['86.905','Psykologtjeneste','Psykolog'],
                                      ['86.909','Helsetjenester ellers','Naprapat']]]]],
  ['88', 'Omsorg uten botilbud', 'helse', [
    ['88.9', 'Barnehager og annet sosialt arbeid', [['88.911','Barnehager','Barnehage'],
                                                    ['88.993','Dagsentre for eldre','Dagsenter']]]]],
  ['73', 'Annonse- og reklamevirksomhet', 'radgivning', [
    ['73.1', 'Annonse- og reklamevirksomhet', [['73.110','Reklamebyråer','Reklamebyrå'],
                                               ['73.120','Medieformidlingstjenester','Mediebyrå']]]]],
  ['59', 'Film-, video- og TV-produksjon', 'radgivning', [
    ['59.1', 'Produksjon og distribusjon av film og fjernsynsprogrammer', [
        ['59.110','Produksjon av film, video og fjernsynsprogrammer','Filmprodusent']]]]],
  // 68.3 er meglingen og forvaltningen — tjenestene. 68.1/68.2 (kjøp/salg og
  // utleie av EGEN eiendom) er kapitalforvaltning, ikke en bransje man «starter
  // i», og holdes utenfor: 78 000 enheter på 68.2 er stort sett ett selskap per
  // bygg, og de ville druknet alt annet i topplistene.
  ['68', 'Omsetning og drift av fast eiendom', 'tjenesteyting', [
    ['68.3', 'Eiendomsmegling og -forvaltning', [['68.310','Eiendomsmegling','Eiendomsmegler'],
                                                 ['68.320','Eiendomsforvaltning','Eiendomsforvalter']]]]],
  ['81', 'Tjenester tilknyttet eiendomsdrift', 'tjenesteyting', [
    ['81.2', 'Rengjøringsvirksomhet', [['81.210','Rengjøring av bygninger','Renholdsbyrå'],
                                       ['81.291','Skadedyrkontroll','Skadedyrfirma'],
                                       ['81.299','Rengjøringsvirksomhet ellers','Vinduspussfirma']]],
    ['81.3', 'Beplantning av hager', [['81.300','Beplantning av hager og parkanlegg','Anleggsgartner']]]]],
];

const slugify = (s: string): string => s.toLowerCase()
  .replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function buildIndustries(): IndustryRow[] {
  const out: IndustryRow[] = [];
  for (const [c2, n2, profile, kids3] of TREE) {
    out.push({ nace_code: c2, nace_level: 2, parent_code: null, name: n2,
               common_name: n2, slug: slugify(n2), profile, search_terms: [] });
    for (const [c3, n3, leaves] of kids3) {
      out.push({ nace_code: c3, nace_level: 3, parent_code: c2, name: n3,
                 common_name: n3, slug: slugify(c3 + '-' + n3), profile, search_terms: [] });
      for (const [c5, n5, common] of leaves) {
        out.push({ nace_code: c5, nace_level: 5, parent_code: c3, name: n5,
                   common_name: common, slug: slugify(common), profile,
                   search_terms: [common.toLowerCase(), firstWord(n5)] });
      }
    }
  }
  return out;
}

/** Første ord i navnet, som søketerm. Navnene er aldri tomme. */
function firstWord(s: string): string {
  return s.toLowerCase().split(' ')[0] ?? s.toLowerCase();
}
