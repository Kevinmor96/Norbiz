import { industryId, regionId } from './ids.js';
import type { SeedBundle } from './types.js';

type Val = string | number | null | undefined | boolean;

const q = (v: Val): string => v === null || v === undefined ? 'NULL'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? (v ? 'true' : 'false')
  : `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs: string[]): string => xs.length ? `ARRAY[${xs.map(q).join(',')}]` : `'{}'::text[]`;
const jb = (o: unknown): string => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

/** Deler lange INSERT-er i bolker så ingen enkeltsetning blir urimelig stor. */
function insertMany(
  table: string, cols: string[], rows: (string | number)[][], batch = 500,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    out.push(`insert into ${table} (${cols.join(', ')}) values\n  ` +
      chunk.map((r) => `(${r.join(', ')})`).join(',\n  ') + ';');
  }
  return out;
}

export function emitSeed(a: SeedBundle): string {
  const parts = [
    '-- Generert av seed/index.ts. Ikke rediger for hånd.',
    '-- Deterministisk: samme frø gir identisk fil.',
    'begin;',
    '',
    '-- Idempotent: en ny kjøring erstatter hele seed-settet.',
    'truncate ai_insights, industry_estimates, ai_reports, industry_scores,',
    '         industry_demography, industry_stats, industry_wages, region_population,',
    '         companies, companies_snapshot, industries, regions, kommuner restart identity cascade;',
    '',
  ];

  const regFor = (code: string, year: number): string => {
    const r = a.regions.find((x) => x.code === code
      && x.valid_from_year <= year && (x.valid_to_year === null || x.valid_to_year >= year));
    return regionId(r!.code, r!.valid_from_year);
  };

  // Hierarkiet må inn nivå for nivå, ellers feiler selvreferansen på parent_code.
  for (const lvl of [2, 3, 5]) {
    parts.push(...insertMany('industries',
      ['id','nace_code','nace_level','parent_code','name','common_name','slug','search_terms','kuratert'],
      a.industries.filter((i) => i.nace_level === lvl).map((i) => [
        q(industryId(i.nace_code)), q(i.nace_code), i.nace_level, q(i.parent_code),
        q(i.name), q(i.common_name), q(i.slug), arr(i.search_terms), 'true',
      ])));
  }

  parts.push(...insertMany('regions',
    ['id','code','name','level','parent_code','valid_from_year','valid_to_year'],
    a.regions.map((r) => [
      q(regionId(r.code, r.valid_from_year)), q(r.code), q(r.name), q(r.level),
      q(r.parent_code), r.valid_from_year, q(r.valid_to_year),
    ])));

  parts.push(...insertMany('region_population',
    ['region_id','year','innbyggere','source','data_quality'],
    a.population.map((p) => [
      q(regionId(p.region_code, p.vintage)), p.year, p.innbyggere, q('seed:folketall'), q('mock'),
    ])));

  parts.push(...insertMany('industry_stats',
    ['industry_id','region_id','year','unit_type','nace_level','region_level','n_enheter',
     'omsetning_total','omsetning_per_enhet','driftsresultat_total','driftsmargin_pct',
     'lonnskostnad_total','lonnsandel_pct','sysselsatte_total','sysselsatte_per_enhet',
     'arsverk_per_enhet','bearbeidingsverdi_total','verdiskaping_per_sysselsatt',
     'bruttoinvestering_total','merknader','source','data_quality','coverage'],
    a.rows.map((r) => [
      q(industryId(r.nace_code)), q(regFor(r.region_code, r.year)), r.year, q(r.unit_type),
      r.nace_level, q(r.region_level), q(r.n_enheter), q(r.omsetning_total),
      q(r.omsetning_per_enhet), q(r.driftsresultat_total), q(r.driftsmargin_pct),
      q(r.lonnskostnad_total), q(r.lonnsandel_pct), q(r.sysselsatte_total),
      q(r.sysselsatte_per_enhet), q(r.arsverk_per_enhet), q(r.bearbeidingsverdi_total),
      q(r.verdiskaping_per_sysselsatt), q(r.bruttoinvestering_total), jb(r.merknader),
      q(r.source), q('mock'), q('alle'),
    ])));

  parts.push(...insertMany('industry_demography',
    ['industry_id','region_id','year','nace_level','region_level','nyetableringer','nedleggelser',
     'konkurser','overlevelse_1ar_pct','overlevelse_3ar_pct','overlevelse_5ar_pct',
     'merknader','source','data_quality','coverage'],
    a.demography.map((d) => [
      q(industryId(d.nace_code)), q(regFor(d.region_code, d.year)), d.year, d.nace_level,
      q(d.region_level), q(d.nyetableringer), q(d.nedleggelser), q(d.konkurser),
      q(d.overlevelse_1ar_pct), q(d.overlevelse_3ar_pct), q(d.overlevelse_5ar_pct),
      jb(d.merknader), q(d.source), q('mock'), q('alle'),
    ])));

  // Lønn bruker regionId direkte framfor regFor(), fordi serien går til 2025 og
  // dermed treffer fylkesårgangen fra 2024. regFor() slår opp på år, og ville
  // for 2024–2025 landet riktig — men raden bærer allerede sin egen vintage, så
  // det er ærligere å bruke den enn å slå den opp på nytt.
  parts.push(...insertMany('industry_wages',
    ['industry_id','region_id','year','nace_level','region_level','yrke_kode','yrke_navn',
     'manedslonn_gjennomsnitt','manedslonn_median','manedslonn_desil1','manedslonn_desil9',
     'antall_ansatte','merknader','source','data_quality','coverage'],
    a.wages.map((w) => [
      q(industryId(w.nace_code)), q(regionId(w.region_code, w.vintage)), w.year,
      w.nace_level, q(w.region_level), q(w.yrke_kode), q(w.yrke_navn),
      q(w.manedslonn_gjennomsnitt), q(w.manedslonn_median), q(w.manedslonn_desil1),
      q(w.manedslonn_desil9), q(w.antall_ansatte), jb(w.merknader), q(w.source),
      q(w.data_quality), q('alle'),
    ])));

  // Kommunenavn. Uten dem gir topp_selskaper kommune_navn = null i testbasen,
  // og «Kommune 3103» er tilbake på skjermen. Livebasen fylles fra SSBs
  // klassifikasjon 131; her holder de tiende kommunene selskapene bor i.
  parts.push(...insertMany('kommuner',
    ['code','navn','source','vintage'],
    a.kommuner.map((k) => [q(k.code), q(k.navn), q('seed:ssb-klass131'), 2024])));

  parts.push(...insertMany('companies',
    ['org_nr','navn','nace_code','kommune_code','organisasjonsform','ansatte','omsetning',
     'driftsresultat','egenkapital','regnskapsar','source','data_quality'],
    a.companies.map((c) => [
      q(c.org_nr), q(c.navn), q(c.nace_code), q(c.kommune_code), q(c.organisasjonsform),
      q(c.ansatte), q(c.omsetning), q(c.driftsresultat), q(c.egenkapital), q(c.regnskapsar),
      q('seed:brreg'), q('mock'),
    ])));

  parts.push(...insertMany('industry_estimates',
    ['industry_id','region_id','metrikk','intervall_lav','intervall_hoy','enhet','konfidens',
     'begrunnelse','basert_pa','model','prompt_version','source','data_quality'],
    a.estimates.map((e) => [
      q(industryId(e.industry_nace)), 'NULL', q(e.metrikk), e.intervall_lav, e.intervall_hoy,
      q(e.enhet), q(e.konfidens), q(e.begrunnelse), jb(e.basert_pa), q(e.model),
      q(e.prompt_version), q(e.source), q('ai_anslag'),
    ])));

  parts.push(...insertMany('ai_insights',
    ['industry_id','region_id','year','type','tittel','body','alvorlighet','referanser',
     'knyttet_til','model','prompt_version','data_quality'],
    a.insights.map((i) => [
      q(industryId(i.industry_nace)), q(regFor(i.region_code, i.year)), i.year, q(i.type),
      q(i.tittel), q(i.body), i.alvorlighet, jb(i.referanser), q(i.knyttet_til),
      q(i.model), q(i.prompt_version), q('ai_anslag'),
    ])));

  parts.push('', 'commit;', '');
  return parts.join('\n');
}
