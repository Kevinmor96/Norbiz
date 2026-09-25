import { REGION_VINTAGES, YEARS } from './config.js';
import type { RegionRef, RegionRow } from './types.js';

/** Norge pluss alle tre fylkesårgangene. */
export function buildRegions(): RegionRow[] {
  const rows: RegionRow[] = [{
    code: '0', name: 'Norge', level: 'land',
    parent_code: null, valid_from_year: 2017, valid_to_year: null,
  }];
  for (const v of REGION_VINTAGES) {
    for (const [code, name] of v.codes) {
      rows.push({
        code, name, level: 'fylke', parent_code: '0',
        valid_from_year: v.from, valid_to_year: v.to,
      });
    }
  }
  return rows;
}

/** Hvilke fylker som gjaldt i hvert statistikkår. */
export function regionsByYear(): Record<number, RegionRef[]> {
  const out: Record<number, RegionRef[]> = {};
  for (const y of YEARS) {
    const v = REGION_VINTAGES.find((x) => y >= x.from && (x.to === null || y <= x.to));
    if (!v) continue;
    out[y] = v.codes.map(([code, name]) => ({ code, name, vintage: v.from }));
  }
  return out;
}
