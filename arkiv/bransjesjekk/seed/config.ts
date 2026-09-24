export const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023] as const;

export type ProfileName =
  | 'servering' | 'varehandel' | 'bygg' | 'tjenesteyting' | 'radgivning' | 'helse';

export interface Profile {
  margin: [number, number];
  lonnsandel: [number, number];
  invest: [number, number];
  konkursrate: [number, number];
  overlevelse5: [number, number];
}

/** Lønnsserien er lengre og ferskere enn strukturstatistikken. Det er ikke en
 *  detalj: den skal tvinge frontend til å vise årstempel per måltall i stedet
 *  for å behandle de to seriene som samme periode. Den er også den eneste som
 *  rekker fram til fylkesårgangen fra 2024. */
export const WAGE_YEARS = [
  2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

export interface Vintage { from: number; to: number | null; codes: [string, string][] }

/** Fylkesårganger. Statistikkrader legges på den som gjaldt i året. */
export const REGION_VINTAGES: Vintage[] = [
  { from: 2017, to: 2019, codes: [
    ['01','Østfold'],['02','Akershus'],['03','Oslo'],['04','Hedmark'],['05','Oppland'],
    ['06','Buskerud'],['07','Vestfold'],['08','Telemark'],['09','Aust-Agder'],['10','Vest-Agder'],
    ['11','Rogaland'],['12','Hordaland'],['14','Sogn og Fjordane'],['15','Møre og Romsdal'],
    ['18','Nordland'],['50','Trøndelag'],['54','Troms og Finnmark'] ] },
  { from: 2020, to: 2023, codes: [
    ['03','Oslo'],['11','Rogaland'],['15','Møre og Romsdal'],['18','Nordland'],
    ['30','Viken'],['34','Innlandet'],['38','Vestfold og Telemark'],['42','Agder'],
    ['46','Vestland'],['50','Trøndelag'],['54','Troms og Finnmark'] ] },
  { from: 2024, to: null, codes: [
    ['03','Oslo'],['11','Rogaland'],['15','Møre og Romsdal'],['18','Nordland'],
    ['31','Østfold'],['32','Akershus'],['33','Buskerud'],['34','Innlandet'],
    ['39','Vestfold'],['40','Telemark'],['42','Agder'],['46','Vestland'],
    ['50','Trøndelag'],['55','Troms'],['56','Finnmark'] ] },
];

/**
 * Folketall per fylke og årgang, avrundede SSB-tall.
 *
 * Disse gjør to jobber, og det er derfor de må være ekte og bo på ett sted:
 * de bestemmer hvor store de regionale cellene blir — og dermed hvor
 * undertrykkingen slår inn — og de er nevneren i konkurransedelscoren
 * (`n_enheter` per innbygger). Var populasjonen tilfeldig mens cellestørrelsen
 * fulgte en ekte vekt, ville konkurransescoren blitt støy framfor signal.
 *
 * Nøkkelen er `code|vintage`, fordi samme fylkeskode har ulikt folketall i
 * ulike årganger.
 */
export const REGION_POPULATION: Record<string, number> = {
  '0|2017': 5_300_000,
  // 17 fylker 2017–2019
  '01|2017': 297_000, '02|2017': 614_000, '03|2017': 681_000, '04|2017': 197_000,
  '05|2017': 189_000, '06|2017': 279_000, '07|2017': 249_000, '08|2017': 173_000,
  '09|2017': 117_000, '10|2017': 186_000, '11|2017': 472_000, '12|2017': 522_000,
  '14|2017': 110_000, '15|2017': 266_000, '18|2017': 243_000, '50|2017': 458_000,
  '54|2017': 243_000,
  // 11 fylker 2020–2023
  '03|2020': 709_000, '11|2020': 485_000, '15|2020': 265_000, '18|2020': 240_000,
  '30|2020': 1_256_000, '34|2020': 371_000, '38|2020': 424_000, '42|2020': 308_000,
  '46|2020': 638_000, '50|2020': 470_000, '54|2020': 244_000,
  // 15 fylker fra 2024 — nås bare av lønnsserien
  '03|2024': 717_000, '11|2024': 500_000, '15|2024': 268_000, '18|2024': 238_000,
  '31|2024': 320_000, '32|2024': 730_000, '33|2024': 226_000, '34|2024': 373_000,
  '39|2024': 260_000, '40|2024': 176_000, '42|2024': 316_000, '46|2024': 653_000,
  '50|2024': 483_000, '55|2024': 172_000, '56|2024': 74_000,
};

export const NORGE_POPULATION = 5_300_000;

export const population = (code: string, vintage: number): number =>
  REGION_POPULATION[`${code}|${vintage}`] ?? 200_000;

/** Bransjeprofiler: marginbånd, lønnsandel, kapitalintensitet, konkursrate. */
export const PROFILES: Record<ProfileName, Profile> = {
  servering:    { margin: [1.5, 6.0],  lonnsandel: [32, 42], invest: [18000, 45000],  konkursrate: [0.045, 0.085], overlevelse5: [28, 42] },
  varehandel:   { margin: [2.5, 7.5],  lonnsandel: [14, 22], invest: [12000, 38000],  konkursrate: [0.025, 0.050], overlevelse5: [38, 52] },
  bygg:         { margin: [4.0, 9.5],  lonnsandel: [26, 36], invest: [22000, 60000],  konkursrate: [0.035, 0.070], overlevelse5: [33, 48] },
  tjenesteyting:{ margin: [8.0, 16.0], lonnsandel: [38, 52], invest: [8000, 25000],   konkursrate: [0.015, 0.035], overlevelse5: [48, 64] },
  radgivning:   { margin: [14.0, 26.0],lonnsandel: [42, 58], invest: [6000, 20000],   konkursrate: [0.010, 0.025], overlevelse5: [55, 72] },
  helse:        { margin: [6.0, 14.0], lonnsandel: [44, 60], invest: [15000, 42000],  konkursrate: [0.008, 0.020], overlevelse5: [60, 78] },
};
