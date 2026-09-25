import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { makeRng } from './rng.js';
import { REGION_VINTAGES, YEARS, population } from './config.js';
import { buildWages, wageRegionsByYear } from './wages.js';
import { buildIndustries } from './industries.js';
import { buildRegions, regionsByYear } from './regions.js';
import { buildStats } from './stats.js';
import { buildCompanies } from './companies.js';
import { buildEstimates, buildInsights } from './ai.js';
import { emitSeed } from './emit.js';
import type { PopulationRow, SeedBundle, StatRow } from './types.js';

const SEED = 20260802;
/**
 * Kommunene de genererte selskapene får adresse i, med navn.
 *
 * Navnene er med fordi `kommuner`-tabellen (migrasjon 0024) må ha rader i
 * testbasen: uten dem returnerer `topp_selskaper` kommune_navn = null, og
 * frontend er tilbake til «Kommune 3103» — nettopp den feilen tabellen finnes
 * for å fjerne.
 *
 * Kodene er 2024-årgangen, den samme Brreg registrerer adresser mot. To av dem
 * var utdaterte da lista ble skrevet: 3801 (Horten) og 1507 (Ålesund) hører til
 * årgangen 2020–2023. Fra 2024 er de 3905 Tønsberg og 1508 Ålesund. Et
 * kommunenummer er ikke en konstant.
 */
const KOMMUNER: [string, string][] = [
  ['0301','Oslo'], ['1103','Stavanger'], ['4601','Bergen'],
  ['5001','Trondheim - Tråante'], ['3201','Bærum'], ['1806','Narvik'],
  ['1108','Sandnes'], ['3905','Tønsberg'], ['4204','Kristiansand'],
  ['1508','Ålesund'],
];

export function buildSeed(seed = SEED): SeedBundle {
  const rng = makeRng(seed);
  const industries = buildIndustries();
  const regions = buildRegions();
  const { rows, demography } = buildStats(rng, industries, regionsByYear());

  // Samme folketall som formet de regionale cellene i buildStats. Hentes fra
  // config, ikke fra en hash — se kommentaren over REGION_POPULATION.
  const populationRows: PopulationRow[] = [];
  for (const r of regions) {
    for (const y of YEARS) {
      if (r.valid_from_year > y) continue;
      if (r.valid_to_year !== null && r.valid_to_year < y) continue;
      populationRows.push({
        region_code: r.code, vintage: r.valid_from_year, year: y,
        innbyggere: Math.round(population(r.code, r.valid_from_year) * (1 + (y - 2017) * 0.006)),
      });
    }
  }

  const companies = buildCompanies(rng, industries, KOMMUNER.map(([c]) => c));

  const byNace = new Map<string, StatRow[]>();
  for (const r of rows) {
    if (!byNace.has(r.nace_code)) byNace.set(r.nace_code, []);
    byNace.get(r.nace_code)!.push(r);
  }

  return {
    industries, regions, rows, demography, population: populationRows, companies,
    kommuner: KOMMUNER.map(([code, navn]) => ({ code, navn })),
    estimates: buildEstimates(rng, industries),
    insights: buildInsights(rng, industries, byNace),
    wages: buildWages(rng, industries, wageRegionsByYear(REGION_VINTAGES)),
  };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const target = join(process.cwd(), 'supabase', 'seed', 'seed.sql');
  mkdirSync(dirname(target), { recursive: true });
  const sql = emitSeed(buildSeed());
  writeFileSync(target, sql);
  console.log(`Skrev ${target} (${(sql.length / 1024 / 1024).toFixed(1)} MB)`);
}
