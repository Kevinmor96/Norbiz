import { describe, expect, it } from 'vitest';
import { makeRng } from '../seed/rng.js';
import { PROFILES, REGION_VINTAGES, YEARS } from '../seed/config.js';
import { buildIndustries } from '../seed/industries.js';
import { buildRegions, regionsByYear } from '../seed/regions.js';
import { buildStats } from '../seed/stats.js';
import { buildCompanies } from '../seed/companies.js';
import { buildEstimates, buildInsights } from '../seed/ai.js';
import { buildWages, wageRegionsByYear } from '../seed/wages.js';

describe('rng', () => {
  it('gir samme sekvens for samme frø', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gir ulik sekvens for ulikt frø', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('holder seg innenfor range og jitter', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
      const j = r.jitter(0.1);
      expect(j).toBeGreaterThan(0.89);
      expect(j).toBeLessThan(1.11);
    }
  });
});

describe('config', () => {
  it('dekker 2017-2023, ikke ti år', () => {
    expect(YEARS).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023]);
  });

  it('har tre fylkesårganger med 17, 11 og 15 fylker', () => {
    expect(REGION_VINTAGES.map((v) => v.codes.length)).toEqual([17, 11, 15]);
    expect(REGION_VINTAGES[2]!.to).toBeNull();
  });

  it('gir servering lavere marginbånd enn rådgivning', () => {
    expect(PROFILES.servering.margin[1]).toBeLessThan(PROFILES.radgivning.margin[0]);
  });
});

describe('industries', () => {
  const rows = buildIndustries();

  it('har minst 60 femsifrede næringer', () => {
    expect(rows.filter((r) => r.nace_level === 5).length).toBeGreaterThanOrEqual(60);
  });

  it('har unike koder og slugs', () => {
    expect(new Set(rows.map((r) => r.nace_code)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });

  it('har komplett hierarki uten foreldreløse noder', () => {
    const codes = new Set(rows.map((r) => r.nace_code));
    const orphans = rows.filter((r) => r.parent_code !== null && !codes.has(r.parent_code));
    expect(orphans).toEqual([]);
  });

  it('gir hvert 5-siffer en 3-siffer-forelder som selv har en 2-siffer-forelder', () => {
    const byCode = new Map(rows.map((r) => [r.nace_code, r]));
    for (const leaf of rows.filter((r) => r.nace_level === 5)) {
      const parent = byCode.get(leaf.parent_code!);
      expect(parent?.nace_level).toBe(3);
      expect(byCode.get(parent!.parent_code!)?.nace_level).toBe(2);
    }
  });

  it('dekker alle seks bransjeprofilene', () => {
    expect(new Set(rows.map((r) => r.profile)).size).toBe(6);
  });
});

describe('regions', () => {
  it('lager Norge pluss alle tre fylkesårgangene', () => {
    const rows = buildRegions();
    expect(rows.filter((r) => r.level === 'land')).toHaveLength(1);
    expect(rows.filter((r) => r.level === 'fylke')).toHaveLength(17 + 11 + 15);
  });

  it('velger riktig årgang per år', () => {
    const byYear = regionsByYear();
    expect(byYear[2019]!).toHaveLength(17);
    expect(byYear[2020]!).toHaveLength(11);
    expect(byYear[2023]!).toHaveLength(11);
    // 2024-årgangen er utenfor dataperioden og skal ikke ha statistikkår.
    expect(byYear[2024]).toBeUndefined();
  });

  it('lar Oslo beholde koden 03 gjennom alle årganger', () => {
    const oslo = buildRegions().filter((r) => r.code === '03');
    expect(oslo).toHaveLength(3);
    expect(new Set(oslo.map((r) => r.valid_from_year))).toEqual(new Set([2017, 2020, 2024]));
  });
});

describe('stats', () => {
  const built = buildStats(makeRng(20260802), buildIndustries(), regionsByYear());

  it('lager ingen regionale rader over 3-siffer', () => {
    const bad = built.rows.filter((r) => r.region_level !== 'land' && r.nace_level > 3);
    expect(bad).toEqual([]);
  });

  it('lar driftsmargin være NULL i alle regionale rader', () => {
    const bad = built.rows.filter(
      (r) => r.region_level !== 'land' && r.driftsmargin_pct !== null,
    );
    expect(bad).toEqual([]);
  });

  it('lager både foretak og virksomhet nasjonalt, kun virksomhet regionalt', () => {
    const regionalUnits = new Set(
      built.rows.filter((r) => r.region_level === 'fylke').map((r) => r.unit_type),
    );
    expect([...regionalUnits]).toEqual(['virksomhet']);
  });

  it('følger fylkesårgangene', () => {
    const fylker = (y: number) => new Set(
      built.rows.filter((r) => r.year === y && r.region_level === 'fylke')
        .map((r) => r.region_code),
    ).size;
    expect(fylker(2019)).toBe(17);
    expect(fylker(2023)).toBe(11);
  });

  it('produserer undertrykte celler med merknad', () => {
    const suppressed = built.rows.filter(
      (r) => r.merknader['bearbeidingsverdi_total'] === 'konfidensielt',
    );
    expect(suppressed.length).toBeGreaterThan(0);
    for (const r of suppressed) expect(r.bearbeidingsverdi_total).toBeNull();
  });

  it('holder marginene innenfor bransjeprofilen', () => {
    const radgivning = built.rows.filter(
      (r) => r.nace_code === '69.201' && r.driftsmargin_pct !== null,
    );
    const servering = built.rows.filter(
      (r) => r.nace_code === '56.101' && r.driftsmargin_pct !== null,
    );
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(radgivning.map((r) => r.driftsmargin_pct!)))
      .toBeGreaterThan(avg(servering.map((r) => r.driftsmargin_pct!)));
  });

  it('lager tidsserier med støy, ikke rette linjer', () => {
    const serie = built.rows
      .filter((r) => r.nace_code === '96.020' && r.region_level === 'land' && r.unit_type === 'foretak')
      .sort((a, b) => a.year - b.year)
      .map((r) => r.omsetning_total);
    const diffs = serie.slice(1).map((v, i) => v - serie[i]!);
    expect(new Set(diffs).size).toBeGreaterThan(1);
  });

  it('er deterministisk', () => {
    const again = buildStats(makeRng(20260802), buildIndustries(), regionsByYear());
    expect(again.rows[500]).toEqual(built.rows[500]);
  });
});

describe('companies', () => {
  const rows = buildCompanies(makeRng(1), buildIndustries(), ['0301', '1103', '4601']);

  it('lager 300 selskaper med unike organisasjonsnummer', () => {
    expect(rows).toHaveLength(300);
    expect(new Set(rows.map((r) => r.org_nr)).size).toBe(300);
  });

  it('lar ENK stå uten regnskapstall', () => {
    const enk = rows.filter((r) => r.organisasjonsform === 'ENK');
    expect(enk.length).toBeGreaterThan(0);
    for (const r of enk) {
      expect(r.regnskapsar).toBeNull();
      expect(r.omsetning).toBeNull();
    }
  });

  it('gir AS regnskapstall for siste år', () => {
    for (const r of rows.filter((x) => x.organisasjonsform === 'AS')) {
      expect(r.regnskapsar).toBe(2023);
      expect(r.omsetning).not.toBeNull();
    }
  });
});

describe('estimates', () => {
  const rows = buildEstimates(makeRng(2), buildIndustries());

  it('oppgir alltid et spenn, aldri ett tall', () => {
    for (const r of rows) {
      expect(r.intervall_hoy).toBeGreaterThanOrEqual(r.intervall_lav);
    }
  });

  it('varierer konfidensen', () => {
    expect(new Set(rows.map((r) => r.konfidens)).size).toBe(3);
  });

  it('har ikke-tom basert_pa og begrunnelse på hver rad', () => {
    for (const r of rows) {
      expect(r.basert_pa.length).toBeGreaterThan(0);
      expect(r.begrunnelse.length).toBeGreaterThan(10);
    }
  });

  it('gir rådgivning lavere etableringskapital enn servering', () => {
    const forCode = (c: string) =>
      rows.find((r) => r.industry_nace === c && r.metrikk === 'etableringskapital')!;
    expect(forCode('69.201').intervall_hoy).toBeLessThan(forCode('56.101').intervall_hoy);
  });
});

describe('insights', () => {
  it('dekker alle fem innsiktstypene og har alltid referanser', () => {
    const industries = buildIndustries();
    const built = buildStats(makeRng(3), industries, regionsByYear());
    const byNace = new Map<string, typeof built.rows>();
    for (const r of built.rows) {
      if (!byNace.has(r.nace_code)) byNace.set(r.nace_code, []);
      byNace.get(r.nace_code)!.push(r);
    }
    const rows = buildInsights(makeRng(4), industries, byNace);

    expect(new Set(rows.map((r) => r.type)).size).toBe(5);
    for (const r of rows) {
      expect(r.referanser.length).toBeGreaterThan(0);
      expect(r.alvorlighet).toBeGreaterThanOrEqual(1);
      expect(r.alvorlighet).toBeLessThanOrEqual(5);
    }
  });
});

describe('wages', () => {
  const industries = buildIndustries();
  const rows = buildWages(makeRng(5), industries, wageRegionsByYear(REGION_VINTAGES));

  it('går lenger og er ferskere enn strukturstatistikken', () => {
    const years = rows.map((r) => r.year);
    expect(Math.min(...years)).toBeLessThan(YEARS[0]);
    expect(Math.max(...years)).toBeGreaterThan(YEARS[YEARS.length - 1]!);
  });

  it('treffer fylkesårgangen fra 2024, som ingen annen serie gjør', () => {
    // Regionale lønnsrader i 2025 må ligge på den siste årgangen, ikke på den
    // som gjaldt da strukturstatistikken sluttet.
    const r2025 = rows.filter((r) => r.year === 2025 && r.region_level === 'fylke');
    expect(new Set(r2025.map((r) => r.vintage))).toEqual(new Set([2024]));
    expect(new Set(r2025.map((r) => r.region_code)).size).toBe(15);
  });

  it('holder regionale rader på 2- og 3-siffer', () => {
    for (const r of rows.filter((x) => x.region_level === 'fylke')) {
      expect(r.nace_level).toBeLessThanOrEqual(3);
    }
  });

  it('oppgir spennet som målte kvartiler rundt medianen', () => {
    // Spennet er nedre og øvre kvartil fra kilden, ikke et anslag vi har gjettet. Da
    // må medianen faktisk ligge inni det, ellers er spennet meningsløst.
    for (const r of rows) {
      expect(r.manedslonn_kvartil_nedre!).toBeLessThanOrEqual(r.manedslonn_median!);
      expect(r.manedslonn_kvartil_ovre!).toBeGreaterThanOrEqual(r.manedslonn_median!);
    }
  });

  it('merker aldri lønn som anslag', () => {
    expect(rows.some((r) => (r.data_quality as string) === 'ai_anslag')).toBe(false);
  });

  it('merker yrkesradene som beregnet, fordi koblingen er vår', () => {
    // SSB publiserer ingen kartlegging fra NACE til yrke. Radene med yrke_kode
    // hviler derfor på vår vurdering, og skal ikke utgi seg for målt statistikk.
    const yrke = rows.filter((r) => r.yrke_kode !== null);
    expect(yrke.length).toBeGreaterThan(0);
    for (const r of yrke) expect(r.data_quality).toBe('beregnet');
    for (const r of rows.filter((x) => x.yrke_kode === null)) {
      expect(r.data_quality).toBe('mock');
    }
  });

  it('gir rådgivning høyere lønn enn servering', () => {
    const median = (nace: string): number => {
      const r = rows.find((x) => x.nace_code === nace && x.year === 2023
        && x.region_level === 'land' && x.yrke_kode === null);
      return r!.manedslonn_median!;
    };
    expect(median('69.100')).toBeGreaterThan(median('56.101'));
  });

  it('er unik per næring, region, år og yrke', () => {
    // industry_wages har unique nulls not distinct på nettopp denne nøkkelen.
    // Kolliderer to rader her, feiler seed.sql ved lasting.
    const keys = rows.map((r) =>
      `${r.nace_code}|${r.region_code}|${r.vintage}|${r.year}|${r.yrke_kode ?? '-'}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
