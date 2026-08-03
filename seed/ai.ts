import type { ProfileName } from './config.js';
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { EstimateRow, InsightRow, StatRow } from './types.js';

type Band = Record<ProfileName, [number, number]>;
interface Metric { metrikk: string; enhet: string; band: Band; begrunnelse: string }

const METRICS: Metric[] = [
  { metrikk: 'etableringskapital', enhet: 'NOK',
    band: { servering: [400000,1400000], varehandel: [350000,1200000], bygg: [250000,900000],
            tjenesteyting: [150000,600000], radgivning: [50000,250000], helse: [300000,1500000] },
    begrunnelse: 'Utstyr, lokaler og drift fram til positiv kontantstrøm.' },
  { metrikk: 'tid_til_lonnsomhet', enhet: 'mnd',
    band: { servering: [12,30], varehandel: [10,24], bygg: [6,18],
            tjenesteyting: [6,15], radgivning: [3,10], helse: [9,20] },
    begrunnelse: 'Typisk tid før driften bærer seg, gitt marginbåndet i næringen.' },
  { metrikk: 'sesongvariasjon', enhet: 'pct',
    band: { servering: [25,55], varehandel: [15,40], bygg: [20,45],
            tjenesteyting: [8,22], radgivning: [5,15], helse: [4,12] },
    begrunnelse: 'Spredning mellom sterkeste og svakeste kvartal.' },
];

/** Anslag oppgis som spenn med konfidens, aldri som ett presist tall. */
export function buildEstimates(rng: Rng, industries: IndustryRow[]): EstimateRow[] {
  const out: EstimateRow[] = [];
  for (const ind of industries.filter((i) => i.nace_level === 5)) {
    for (const m of METRICS) {
      const [lo, hi] = m.band[ind.profile];
      const low = Math.round(lo * rng.jitter(0.15));
      const high = Math.round(hi * rng.jitter(0.15));
      // Konfidensen varierer med vilje, ellers får frontend aldri testet
      // hvordan et lavkonfidens-anslag ser ut ved siden av et høykonfidens.
      const konfidens = rng.pick(['lav', 'middels', 'middels', 'hoy'] as const);
      out.push({
        industry_nace: ind.nace_code, region_code: null, metrikk: m.metrikk,
        intervall_lav: Math.min(low, high), intervall_hoy: Math.max(low, high),
        enhet: m.enhet, konfidens, begrunnelse: m.begrunnelse,
        basert_pa: [{ table: 'industry_stats', nace_code: ind.nace_code, year: 2023,
                      felt: ['driftsmargin_pct','bruttoinvestering_total'] }],
        model: 'seed', prompt_version: 'v0', source: 'seed:ai', data_quality: 'ai_anslag',
      });
    }
  }
  return out;
}

const TYPES = ['risiko', 'mulighet', 'avvik', 'sammenligning', 'kontekst'] as const;
type InsightType = (typeof TYPES)[number];

/** Innsikt forankret i KPI-en den handler om, med obligatoriske referanser. */
export function buildInsights(
  rng: Rng, industries: IndustryRow[], statsByNace: Map<string, StatRow[]>,
): InsightRow[] {
  const out: InsightRow[] = [];
  const leaves = industries.filter((i) => i.nace_level === 5).slice(0, 10);
  for (const ind of leaves) {
    const series = (statsByNace.get(ind.nace_code) ?? [])
      .filter((r) => r.region_level === 'land' && r.unit_type === 'foretak')
      .sort((a, b) => a.year - b.year);
    if (series.length < 2) continue;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    const marginDelta = (last.driftsmargin_pct ?? 0) - (first.driftsmargin_pct ?? 0);
    const unitDelta = last.n_enheter - first.n_enheter;

    // Én av hver type, så alle varianter av InsightCard er dekket i seed.
    for (const type of TYPES) {
      out.push({
        industry_nace: ind.nace_code, region_code: '0', year: last.year, type,
        tittel: titleFor(type, ind, marginDelta, unitDelta),
        body: bodyFor(type, ind, marginDelta, unitDelta, first, last),
        alvorlighet: 1 + Math.floor(rng.next() * 5),
        referanser: [{ table: 'industry_stats', nace_code: ind.nace_code,
                       years: [first.year, last.year], felt: ['driftsmargin_pct','n_enheter'] }],
        knyttet_til: knyttetTil(type),
        model: 'seed', prompt_version: 'v0', data_quality: 'ai_anslag',
      });
    }
  }
  return out;
}

const pct = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
function titleFor(type: InsightType, ind: IndustryRow, dm: number, du: number): string {
  switch (type) {
    case 'risiko': return `Marginpress i ${ind.common_name.toLowerCase()}`;
    case 'mulighet': return `Rom for konsolidering i ${ind.common_name.toLowerCase()}`;
    case 'avvik': return dm < 0 ? 'Marginen faller mens antall foretak øker'
                                : 'Marginen stiger raskere enn foretaksveksten';
    case 'sammenligning': return `${ind.common_name} mot resten av næringsgruppen`;
    default: return `Slik leses tallene for ${ind.common_name.toLowerCase()}`;
  }
}
function bodyFor(
  type: InsightType, ind: IndustryRow, dm: number, du: number,
  first: StatRow, last: StatRow,
): string {
  const base = `Fra ${first.year} til ${last.year} endret driftsmarginen seg ${pct(dm)} prosentpoeng, `
    + `mens antall foretak endret seg med ${du > 0 ? '+' : ''}${du}.`;
  switch (type) {
    case 'risiko': return `${base} Fallende margin kombinert med flere aktører tyder på priskonkurranse.`;
    case 'mulighet': return `${base} Et fragmentert marked med synkende margin er ofte modent for oppkjøp.`;
    case 'avvik': return `${base} Retningene peker hver sin vei, som er verdt å undersøke nærmere.`;
    case 'sammenligning': return `${base} Sammenlignet med søsternæringene i samme 3-siffer ligger dette i midtsjiktet.`;
    default: return `${base} Tallene gjelder foretak nasjonalt; regionale tall finnes kun på 3-siffer.`;
  }
}

/**
 * KPI-nøkkelen innsikten ankres ved i UI-et. Muligheter og sammenligninger
 * handler om markedsstruktur, resten om marginen.
 */
function knyttetTil(type: InsightType): string {
  return type === 'mulighet' || type === 'sammenligning' ? 'n_enheter' : 'driftsmargin';
}
