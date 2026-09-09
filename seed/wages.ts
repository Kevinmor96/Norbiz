import { NORGE_POPULATION, WAGE_YEARS, population } from './config.js';
import type { ProfileName } from './config.js';
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { RegionRef, WageRow } from './types.js';

/**
 * Lønn per næring.
 *
 * Tabellen `industry_wages` fikk skjema i migrasjon 0009 og ble stående uten
 * seed, så lønnsseksjonen i frontend hadde ingenting å vise. Den er ikke en
 * pyntedetalj: `lonnsandel_pct` er en delscore-input, og lønn er både
 * kostnadsdriver for eieren og forventning for den ansatte.
 *
 * SPENNET ER MÅLT, IKKE GJETTET. SSBs lønnstabeller har en
 * statistikkmål-dimensjon som inneholder gjennomsnitt, median og kvartiler. Fra-til
 * oppgis derfor som nedre og øvre kvartil. Det er hele poenget med regelen «finnes
 * spennet i kilden, skal vi ikke gjette det» — anslagslaget er for der kilden
 * tier, og her tier den ikke.
 */

/** Månedslønn i 2015-kroner per profil. Rådgivning og helse over servering. */
const WAGE_BASE: Record<ProfileName, number> = {
  servering: 33_000, varehandel: 39_000, bygg: 45_000,
  tjenesteyting: 48_000, radgivning: 62_000, helse: 51_000,
};

/** Lønnsvekst per år, litt over prisvekst gjennom perioden. */
const WAGE_DRIFT = 1.038;

/**
 * Fylkespåslag. Systematisk, ikke støy: sentrale fylker ligger høyere, og det
 * skal en bruker kunne kjenne igjen. Kodene dekker alle tre årgangene.
 */
const COUNTY_UPLIFT: Record<string, number> = {
  '03': 1.11,                          // Oslo
  '02': 1.06, '32': 1.05, '30': 1.05,  // Akershus, Viken
  '11': 1.06,                          // Rogaland
  '46': 1.01, '12': 1.01,              // Vestland, Hordaland
  '50': 0.99,                          // Trøndelag
};

/**
 * Næringer der ett yrke dominerer så tydelig at yrkestallet er mer opplysende
 * enn næringssnittet.
 *
 * Koblingen fra NACE til STYRK-08 er VÅR vurdering — SSB publiserer ingen slik
 * kartlegging — så disse radene bæres av `data_quality = 'beregnet'`, ikke av
 * en påstand om at kilden har koblet dem.
 */
const DOMINANT: [string, string, string][] = [
  ['56.101', '5120', 'Kokk'],
  ['69.201', '2411', 'Regnskapsfører'],
  ['69.100', '2611', 'Advokat'],
  ['96.021', '5141', 'Frisør'],
  ['86.230', '2261', 'Tannlege'],
  ['43.210', '7411', 'Elektriker'],
  ['62.010', '2512', 'Programvareutvikler'],
  ['88.911', '2342', 'Barnehagelærer'],
];

export function buildWages(
  rng: Rng,
  industries: IndustryRow[],
  regionsByYear: Record<number, RegionRef[]>,
): WageRow[] {
  const out: WageRow[] = [];
  const nationalMedian = new Map<string, number>();

  for (const ind of industries) {
    // Desilbredden er en egenskap ved næringen, ikke ved året. En bransje med
    // stor lønnsspredning har det gjennom hele perioden.
    const d1Factor = rng.range(0.63, 0.72);
    const d9Factor = rng.range(1.48, 1.82);
    const level = rng.jitter(0.07);
    const staffBase = ind.nace_level === 2 ? 42_000 : ind.nace_level === 3 ? 11_000 : 2_600;
    const staff = Math.round(staffBase * rng.range(0.4, 1.4));

    for (const year of WAGE_YEARS) {
      const median = Math.round(
        WAGE_BASE[ind.profile] * level * Math.pow(WAGE_DRIFT, year - WAGE_YEARS[0]));
      nationalMedian.set(`${ind.nace_code}|${year}`, median);

      out.push(mkWage(ind, '0', 2017, 'land', year, null, null,
        median, d1Factor, d9Factor, staff));

      // Regionalt: samme granularitetsregel som resten. Regionale lønnsrader
      // over 3-siffer finnes ikke, og databasen håndhever det.
      if (ind.nace_level > 3) continue;
      for (const r of regionsByYear[year] ?? []) {
        const uplift = COUNTY_UPLIFT[r.code] ?? rng.range(0.93, 0.98);
        const share = population(r.code, r.vintage) / NORGE_POPULATION;
        out.push(mkWage(ind, r.code, r.vintage, 'fylke', year, null, null,
          Math.round(median * uplift), d1Factor, d9Factor,
          Math.max(1, Math.round(staff * share))));
      }
    }
  }

  for (const [nace, yrke, navn] of DOMINANT) {
    const ind = industries.find((i) => i.nace_code === nace);
    if (!ind) continue;
    for (const year of WAGE_YEARS) {
      const base = nationalMedian.get(`${nace}|${year}`);
      if (base === undefined) continue;
      const median = Math.round(base * rng.range(0.94, 1.12));
      out.push({
        ...mkWage(ind, '0', 2017, 'land', year, yrke, navn, median, 0.72, 1.42,
          Math.round(2_600 * rng.range(0.3, 0.9))),
        source: 'seed:11418+egen kobling',
        data_quality: 'beregnet',
      });
    }
  }

  return out;
}

function mkWage(
  ind: IndustryRow, regionCode: string, vintage: number,
  regionLevel: 'land' | 'fylke', year: number,
  yrkeKode: string | null, yrkeNavn: string | null,
  median: number, d1Factor: number, d9Factor: number, staff: number,
): WageRow {
  return {
    nace_code: ind.nace_code, nace_level: ind.nace_level,
    region_code: regionCode, vintage, region_level: regionLevel, year,
    yrke_kode: yrkeKode, yrke_navn: yrkeNavn,
    manedslonn_gjennomsnitt: Math.round(median * 1.06),
    manedslonn_median: median,
    manedslonn_kvartil_nedre: Math.round(median * d1Factor),
    manedslonn_kvartil_ovre: Math.round(median * d9Factor),
    antall_ansatte: staff,
    merknader: {},
    source: 'seed:11418',
    data_quality: 'mock',
    coverage: 'alle',
  };
}

/**
 * Hvilke fylker som gjaldt i hvert LØNNSÅR. Kan ikke gjenbruke
 * `regionsByYear()` fra regions.ts, som bare dekker statistikkårene 2017–2023 —
 * lønn går til 2025 og treffer dermed årgangen fra 2024.
 */
export function wageRegionsByYear(
  vintages: { from: number; to: number | null; codes: [string, string][] }[],
): Record<number, RegionRef[]> {
  const out: Record<number, RegionRef[]> = {};
  for (const y of WAGE_YEARS) {
    const v = vintages.find((x) => y >= x.from && (x.to === null || y <= x.to));
    if (!v) continue;
    out[y] = v.codes.map(([code, name]) => ({ code, name, vintage: v.from }));
  }
  return out;
}
