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

/** Bransjeprofiler: marginbånd, lønnsandel, kapitalintensitet, konkursrate. */
export const PROFILES: Record<ProfileName, Profile> = {
  servering:    { margin: [1.5, 6.0],  lonnsandel: [32, 42], invest: [18000, 45000],  konkursrate: [0.045, 0.085], overlevelse5: [28, 42] },
  varehandel:   { margin: [2.5, 7.5],  lonnsandel: [14, 22], invest: [12000, 38000],  konkursrate: [0.025, 0.050], overlevelse5: [38, 52] },
  bygg:         { margin: [4.0, 9.5],  lonnsandel: [26, 36], invest: [22000, 60000],  konkursrate: [0.035, 0.070], overlevelse5: [33, 48] },
  tjenesteyting:{ margin: [8.0, 16.0], lonnsandel: [38, 52], invest: [8000, 25000],   konkursrate: [0.015, 0.035], overlevelse5: [48, 64] },
  radgivning:   { margin: [14.0, 26.0],lonnsandel: [42, 58], invest: [6000, 20000],   konkursrate: [0.010, 0.025], overlevelse5: [55, 72] },
  helse:        { margin: [6.0, 14.0], lonnsandel: [44, 60], invest: [15000, 42000],  konkursrate: [0.008, 0.020], overlevelse5: [60, 78] },
};
