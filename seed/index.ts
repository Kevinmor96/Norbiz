import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { makeRng } from './rng.js';
import { YEARS } from './config.js';
import { buildIndustries } from './industries.js';
import { buildRegions, regionsByYear } from './regions.js';
import { buildStats } from './stats.js';
import { buildCompanies } from './companies.js';
import { buildEstimates, buildInsights } from './ai.js';
import { emitSeed } from './emit.js';
import type { PopulationRow, SeedBundle, StatRow } from './types.js';

const SEED = 20260802;
const KOMMUNER = ['0301','1103','4601','5001','3201','1806','1108','3801','4204','1507'];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
};

export function buildSeed(seed = SEED): SeedBundle {
  const rng = makeRng(seed);
  const industries = buildIndustries();
  const regions = buildRegions();
  const { rows, demography } = buildStats(rng, industries, regionsByYear());

  const population: PopulationRow[] = [];
  for (const r of regions) {
    for (const y of YEARS) {
      if (r.valid_from_year > y) continue;
      if (r.valid_to_year !== null && r.valid_to_year < y) continue;
      const base = r.level === 'land' ? 5_300_000 : 60_000 + (Math.abs(hash(r.code)) % 640_000);
      population.push({
        region_code: r.code, vintage: r.valid_from_year, year: y,
        innbyggere: Math.round(base * (1 + (y - 2017) * 0.006)),
      });
    }
  }

  const companies = buildCompanies(rng, industries, KOMMUNER);

  const byNace = new Map<string, StatRow[]>();
  for (const r of rows) {
    if (!byNace.has(r.nace_code)) byNace.set(r.nace_code, []);
    byNace.get(r.nace_code)!.push(r);
  }

  return {
    industries, regions, rows, demography, population, companies,
    estimates: buildEstimates(rng, industries),
    insights: buildInsights(rng, industries, byNace),
  };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const target = join(process.cwd(), 'supabase', 'seed', 'seed.sql');
  mkdirSync(dirname(target), { recursive: true });
  const sql = emitSeed(buildSeed());
  writeFileSync(target, sql);
  console.log(`Skrev ${target} (${(sql.length / 1024 / 1024).toFixed(1)} MB)`);
}
