export interface RegionRow {
  code: string;
  name: string;
  level: 'land' | 'fylke' | 'kommune';
  parent_code: string | null;
  valid_from_year: number;
  valid_to_year: number | null;
}

export interface RegionRef { code: string; name: string; vintage: number }

export interface StatRow {
  nace_code: string;
  nace_level: number;
  region_code: string;
  region_level: 'land' | 'fylke';
  year: number;
  unit_type: 'foretak' | 'virksomhet';
  n_enheter: number;
  omsetning_total: number;
  omsetning_per_enhet: number;
  driftsresultat_total: number | null;
  driftsmargin_pct: number | null;
  lonnskostnad_total: number;
  lonnsandel_pct: number | null;
  sysselsatte_total: number;
  sysselsatte_per_enhet: number | null;
  arsverk_per_enhet: number | null;
  bearbeidingsverdi_total: number | null;
  verdiskaping_per_sysselsatt: number | null;
  bruttoinvestering_total: number;
  merknader: Record<string, string>;
  source: string;
  data_quality: 'mock';
  coverage: 'alle';
}

export interface DemographyRow {
  nace_code: string;
  nace_level: number;
  region_code: string;
  region_level: 'land' | 'fylke';
  year: number;
  nyetableringer: number;
  nedleggelser: number;
  konkurser: number;
  overlevelse_1ar_pct: number | null;
  overlevelse_3ar_pct: number | null;
  overlevelse_5ar_pct: number | null;
  merknader: Record<string, string>;
  source: string;
  data_quality: 'mock';
  coverage: 'alle';
}

export interface CompanyRow {
  org_nr: string;
  navn: string;
  nace_code: string;
  kommune_code: string;
  organisasjonsform: string;
  ansatte: number;
  omsetning: number | null;
  driftsresultat: number | null;
  egenkapital: number | null;
  regnskapsar: number | null;
}

export interface EstimateRow {
  industry_nace: string;
  region_code: string | null;
  metrikk: string;
  intervall_lav: number;
  intervall_hoy: number;
  enhet: string;
  konfidens: 'lav' | 'middels' | 'hoy';
  begrunnelse: string;
  basert_pa: unknown[];
  model: string;
  prompt_version: string;
  source: string;
  data_quality: 'ai_anslag';
}

export interface InsightRow {
  industry_nace: string;
  region_code: string;
  year: number;
  type: 'risiko' | 'mulighet' | 'avvik' | 'sammenligning' | 'kontekst';
  tittel: string;
  body: string;
  alvorlighet: number;
  referanser: unknown[];
  knyttet_til: string;
  model: string;
  prompt_version: string;
  data_quality: 'ai_anslag';
}

export interface WageRow {
  nace_code: string;
  nace_level: number;
  region_code: string;
  vintage: number;
  region_level: 'land' | 'fylke';
  year: number;
  yrke_kode: string | null;
  yrke_navn: string | null;
  manedslonn_gjennomsnitt: number | null;
  manedslonn_median: number | null;
  manedslonn_desil1: number | null;
  manedslonn_desil9: number | null;
  antall_ansatte: number | null;
  merknader: Record<string, string>;
  source: string;
  // Yrkesradene er 'beregnet' fordi NACE-til-yrke er vår kobling, ikke kildens.
  data_quality: 'mock' | 'beregnet';
  coverage: 'alle';
}

export interface PopulationRow {
  region_code: string; vintage: number; year: number; innbyggere: number;
}

export interface SeedBundle {
  industries: import('./industries.js').IndustryRow[];
  regions: RegionRow[];
  rows: StatRow[];
  demography: DemographyRow[];
  population: PopulationRow[];
  companies: CompanyRow[];
  kommuner: { code: string; navn: string }[];
  estimates: EstimateRow[];
  insights: InsightRow[];
  wages: WageRow[];
}
