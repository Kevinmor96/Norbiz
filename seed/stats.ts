import { PROFILES, YEARS } from './config.js';
import type { Profile } from './config.js';
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { StatRow, DemographyRow, RegionRef } from './types.js';

/**
 * Top-down generering. Nasjonale totaler lages på 2-siffer, splittes til
 * 3-siffer, så til 5-siffer. Regionale rader splitter 3-sifferet utover
 * fylkene. Konsistens er dermed en egenskap ved konstruksjonen, ikke noe
 * som må sjekkes i etterkant.
 */
export function buildStats(
  rng: Rng,
  industries: IndustryRow[],
  regionsByYear: Record<number, RegionRef[]>,
): { rows: StatRow[]; demography: DemographyRow[] } {
  const rows: StatRow[] = [];
  const demography: DemographyRow[] = [];
  const level2 = industries.filter((i) => i.nace_level === 2);

  for (const top of level2) {
    const profile = PROFILES[top.profile];
    const base = rng.range(4_000, 30_000);            // enheter i 2017
    const baseTurnoverPerUnit = rng.range(1.4e6, 9e6);
    const drift = rng.range(-0.01, 0.055);            // årlig trend

    for (const year of YEARS) {
      const t = year - YEARS[0]!;
      const growth = Math.pow(1 + drift, t) * rng.jitter(0.035);
      const units2 = Math.round(base * growth);
      const turnover2 = Math.round(units2 * baseTurnoverPerUnit * rng.jitter(0.05));
      const margin2 = clamp(lerp(profile.margin, rng.next()) * rng.jitter(0.12), -8, 40);

      // 2-siffer nasjonalt, begge enhetstyper
      for (const unit of ['foretak', 'virksomhet'] as const) {
        const mult = unit === 'virksomhet' ? 1.18 : 1.0;
        rows.push(mkRow(top, 'land', '0', year, unit,
          Math.round(units2 * mult), Math.round(turnover2), margin2, profile, rng));
      }

      // 3-siffer: splitt 2-sifferet
      const kids3 = industries.filter((i) => i.parent_code === top.nace_code);
      const shares3 = normalise(kids3.map(() => rng.range(0.5, 1.5)));
      kids3.forEach((kid, ix) => {
        const u3 = Math.max(25, Math.round(units2 * shares3[ix]!));
        const tv3 = Math.round(turnover2 * shares3[ix]!);
        const m3 = clamp(margin2 * rng.jitter(0.22), -8, 40);

        for (const unit of ['foretak', 'virksomhet'] as const) {
          const mult = unit === 'virksomhet' ? 1.18 : 1.0;
          rows.push(mkRow(kid, 'land', '0', year, unit,
            Math.round(u3 * mult), tv3, m3, profile, rng));
        }
        demography.push(mkDemo(kid, '0', 'land', year, u3, profile, rng));

        // regionalt: kun 3-siffer, kun virksomhet, kun driftsdata uten resultat.
        // Vektene er skjeve med vilje: ekte fylkesfordeling har Oslo mangedobbelt
        // av Finnmark, og det er i de små cellene undertrykking faktisk skjer.
        // Årganger utenfor dataperioden har ingen fylker, og skal ikke ha rader.
        const regions = regionsByYear[year] ?? [];
        const sharesR = normalise(regions.map((r) => regionWeight(r.code) * rng.jitter(0.25)));
        regions.forEach((r, ri) => {
          const uR = Math.round(u3 * 1.18 * sharesR[ri]!);
          if (uR < 5) return;
          rows.push(mkRow(kid, 'fylke', r.code, year, 'virksomhet',
            uR, Math.round(tv3 * sharesR[ri]!), null, profile, rng));
          demography.push(mkDemo(kid, r.code, 'fylke', year, uR, profile, rng));
        });

        // 5-siffer: splitt 3-sifferet, kun nasjonalt
        const kids5 = industries.filter((i) => i.parent_code === kid.nace_code);
        const shares5 = normalise(kids5.map(() => rng.range(0.6, 1.6)));
        kids5.forEach((leaf, li) => {
          const u5 = Math.max(12, Math.round(u3 * shares5[li]!));
          const tv5 = Math.round(tv3 * shares5[li]!);
          const m5 = clamp(m3 * rng.jitter(0.3), -8, 40);
          for (const unit of ['foretak', 'virksomhet'] as const) {
            const mult = unit === 'virksomhet' ? 1.18 : 1.0;
            rows.push(mkRow(leaf, 'land', '0', year, unit,
              Math.round(u5 * mult), tv5, m5, profile, rng));
          }
          demography.push(mkDemo(leaf, '0', 'land', year, u5, profile, rng));
        });
      });
    }
  }
  return { rows, demography };
}

function mkRow(
  ind: IndustryRow, regionLevel: 'land' | 'fylke', regionCode: string, year: number,
  unit: 'foretak' | 'virksomhet', units: number, turnover: number,
  margin: number | null, profile: Profile, rng: Rng,
): StatRow {
  const regional = regionLevel !== 'land';
  // Regionalt publiserer SSB ikke driftsresultat -> NULL, ikke 0.
  const driftsresultat = regional || margin === null
    ? null : Math.round(turnover * (margin / 100));
  const lonnsandel = lerp(profile.lonnsandel, rng.next()) * rng.jitter(0.08);
  const sysselsatte = Math.round(units * rng.range(1.8, 7.5));
  const merknader: Record<string, string> = {};
  // Undertrykking treffer små celler. Seed-en må inneholde dem, ellers
  // får frontend aldri testet hvordan konfidensielle hull ser ut.
  let bearbeidingsverdi: number | null = Math.round(turnover * rng.range(0.28, 0.55));
  if (units < 40 && rng.chance(0.45)) {
    bearbeidingsverdi = null;
    merknader.bearbeidingsverdi_total = 'konfidensielt';
  }
  return {
    nace_code: ind.nace_code, nace_level: ind.nace_level,
    region_code: regionCode, region_level: regionLevel, year, unit_type: unit,
    n_enheter: units,
    omsetning_total: turnover,
    omsetning_per_enhet: Math.round(turnover / units),
    driftsresultat_total: driftsresultat,
    driftsmargin_pct: regional ? null : round2(margin),
    lonnskostnad_total: Math.round(turnover * (lonnsandel / 100)),
    lonnsandel_pct: round2(lonnsandel),
    sysselsatte_total: sysselsatte,
    sysselsatte_per_enhet: round2(sysselsatte / units),
    arsverk_per_enhet: round2((sysselsatte / units) * rng.range(0.78, 0.94)),
    bearbeidingsverdi_total: bearbeidingsverdi,
    verdiskaping_per_sysselsatt: bearbeidingsverdi ? Math.round(bearbeidingsverdi / sysselsatte) : null,
    bruttoinvestering_total: Math.round(sysselsatte * lerp(profile.invest, rng.next())),
    merknader,
    source: regional ? 'seed:12936' : 'seed:12910',
    data_quality: 'mock',
    coverage: 'alle',
  };
}

function mkDemo(
  ind: IndustryRow, regionCode: string, regionLevel: 'land' | 'fylke', year: number,
  units: number, profile: Profile, rng: Rng,
): DemographyRow {
  const konkursrate = lerp(profile.konkursrate, rng.next()) * rng.jitter(0.25);
  return {
    nace_code: ind.nace_code, nace_level: ind.nace_level,
    region_code: regionCode, region_level: regionLevel, year,
    nyetableringer: Math.round(units * rng.range(0.06, 0.16)),
    nedleggelser: Math.round(units * rng.range(0.04, 0.12)),
    konkurser: Math.round(units * konkursrate),
    overlevelse_1ar_pct: round2(clamp(lerp(profile.overlevelse5, rng.next()) + rng.range(28, 40), 0, 100)),
    overlevelse_3ar_pct: round2(clamp(lerp(profile.overlevelse5, rng.next()) + rng.range(10, 20), 0, 100)),
    overlevelse_5ar_pct: round2(lerp(profile.overlevelse5, rng.next()) * rng.jitter(0.08)),
    merknader: {},
    source: 'seed:foretaksdemografi', data_quality: 'mock', coverage: 'alle',
  };
}

const lerp = ([lo, hi]: [number, number], t: number): number => lo + (hi - lo) * t;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number | null): number | null => v === null ? null : Math.round(v * 100) / 100;
function normalise(xs: number[]): number[] {
  const s = xs.reduce((a, b) => a + b, 0);
  return xs.map((x) => x / s);
}

/**
 * Grov befolkningsvekt per fylkeskode, på tvers av alle tre årgangene.
 * Trenger ikke være presis — den skal bare gi realistisk skjevhet, så
 * små fylker får små celler og dermed undertrykking.
 */
const REGION_WEIGHTS: Record<string, number> = {
  '03': 7.0, '30': 6.2, '46': 3.2, '11': 2.4, '50': 2.1, '34': 1.6, '38': 1.6,
  '42': 1.4, '15': 1.4, '18': 0.9, '54': 0.7, '02': 3.0, '01': 1.4, '12': 2.2,
  '31': 1.1, '32': 3.0, '33': 1.4, '39': 1.0, '40': 0.8, '55': 0.5, '56': 0.2,
  '04': 0.7, '05': 0.7, '06': 1.2, '07': 0.9, '08': 0.7, '09': 0.4, '10': 0.7,
  '14': 0.4,
};
const regionWeight = (code: string): number => REGION_WEIGHTS[code] ?? 1.0;
