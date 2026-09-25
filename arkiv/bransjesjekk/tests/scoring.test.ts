import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './helpers/db.js';

/** Fire næringer med kjente marginer, to årganger, folketall for alle år. */
async function seedScoring(db: PGlite) {
  await db.exec(`
    insert into industries (nace_code, nace_level, name, common_name, slug) values
      ('96.021', 5, 'Frisering',      'Frisørsalong',   'frisorsalong'),
      ('56.101', 5, 'Restaurant',     'Restaurant',     'restaurant'),
      ('69.201', 5, 'Regnskap',       'Regnskapsfører', 'regnskapsforer'),
      ('93.130', 5, 'Treningssenter', 'Treningssenter', 'treningssenter');
    insert into regions (code, name, level, valid_from_year)
      values ('0', 'Norge', 'land', 2017);
    insert into region_population (region_id, year, innbyggere, source, data_quality)
      select id, y, 5500000, 'SSB', 'ssb' from regions, generate_series(2020, 2023) y;
  `);

  const margins: Record<string, number> = {
    '96.021': 11.2, '56.101': 3.1, '69.201': 22.5, '93.130': 7.4,
  };
  for (const [code, margin] of Object.entries(margins)) {
    for (const [year, mult] of [[2020, 0.8], [2023, 1.0]] as const) {
      await db.exec(`
        insert into industry_stats
          (industry_id, region_id, year, unit_type, nace_level, region_level,
           n_enheter, omsetning_total, driftsresultat_total, driftsmargin_pct,
           sysselsatte_total, bruttoinvestering_total, source, data_quality, coverage)
        values
          ((select id from industries where nace_code = '${code}'),
           (select id from regions where code = '0'),
           ${year}, 'foretak', 5, 'land',
           ${Math.round(500 * mult)}, ${Math.round(1e9 * mult)}, ${Math.round(1e8 * mult)},
           ${margin * mult}, ${Math.round(4000 * mult)}, ${Math.round(5e7 * mult)},
           'SSB:12910', 'ssb', 'alle');
      `);
    }
  }

  // Demografi kun for to av fire, så risiko blir NULL for de andre to.
  for (const [code, konkurser, overlevelse] of [
    ['96.021', 12, 61], ['56.101', 40, 38],
  ] as const) {
    await db.exec(`
      insert into industry_demography
        (industry_id, region_id, year, nace_level, region_level,
         konkurser, overlevelse_5ar_pct, source, data_quality, coverage)
      values
        ((select id from industries where nace_code = '${code}'),
         (select id from regions where code = '0'),
         2023, 5, 'land', ${konkurser}, ${overlevelse}, 'SSB', 'ssb', 'alle');
    `);
  }
}

describe('industry_scores_computed', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb();
    await seedScoring(db);
  });

  it('rangerer lønnsomhet etter driftsmargin', async () => {
    const r = await db.query<{ common_name: string; score_lonnsomhet: number }>(`
      select i.common_name, s.score_lonnsomhet
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023
      order by s.score_lonnsomhet desc
    `);
    expect(r.rows.map((x) => x.common_name)).toEqual([
      'Regnskapsfører', 'Frisørsalong', 'Treningssenter', 'Restaurant',
    ]);
    // Midtrangert persentil: fire distinkte verdier gir 13 / 38 / 63 / 88.
    expect(r.rows.map((x) => x.score_lonnsomhet)).toEqual([88, 63, 38, 13]);
  });

  it('gir uavgjort midtpunktet, ikke bunnen', async () => {
    // Alle fire vokste like mye, så alle skal ha 50.
    const r = await db.query<{ score_vekst: number }>(
      `select score_vekst from industry_scores_computed where year = 2023`,
    );
    expect(r.rows.every((x) => x.score_vekst === 50)).toBe(true);
  });

  it('lar delscorer uten datagrunnlag være NULL og renormaliserer totalen', async () => {
    const r = await db.query<{ score_risiko: number | null; score_total: number }>(`
      select s.score_risiko, s.score_total
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023 and i.nace_code = '69.201'
    `);
    expect(r.rows[0]!.score_risiko).toBeNull();
    // Totalen finnes likevel, regnet over de delscorene som har data.
    expect(r.rows[0]!.score_total).toBeGreaterThan(0);
  });

  it('legger råtall, persentil og vekt i forklaring', async () => {
    const r = await db.query<{ fl: { raw: string; pct: number; vekt: string } }>(`
      select forklaring->'lonnsomhet' as fl
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023 and i.nace_code = '69.201'
    `);
    expect(Number(r.rows[0]!.fl.raw)).toBe(22.5);
    expect(r.rows[0]!.fl.pct).toBe(88);
  });

  it('utelater næringer under min_enheter', async () => {
    await db.exec(`update score_config set min_enheter = 100000`);
    const r = await db.query<{ count: number }>(
      `select count(*) from industry_scores_computed`,
    );
    expect(Number(r.rows[0]!.count)).toBe(0);
    await db.exec(`update score_config set min_enheter = 20`);
  });
});
