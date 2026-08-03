import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './helpers/db.js';
import { buildSeed } from '../seed/index.js';
import { emitSeed } from '../seed/emit.js';

describe('seed.sql', () => {
  let db: PGlite;
  let sql: string;

  beforeAll(async () => {
    sql = emitSeed(buildSeed());
    db = await freshDb();
    await db.exec(sql);
  });

  it('er deterministisk', () => {
    expect(emitSeed(buildSeed())).toBe(sql);
  });

  it('laster uten å bryte noen constraint', async () => {
    const counts = await db.query<{ t: string; c: number }>(`
      select 'industries' t, count(*)::text c from industries
      union all select 'regions', count(*)::text from regions
      union all select 'industry_stats', count(*)::text from industry_stats
      union all select 'companies', count(*)::text from companies
      union all select 'industry_estimates', count(*)::text from industry_estimates
      union all select 'ai_insights', count(*)::text from ai_insights
    `);
    const by = Object.fromEntries(counts.rows.map((r) => [r.t, Number(r.c)]));
    expect(by['industries']).toBe(102);
    expect(by['regions']).toBe(44);
    expect(by['industry_stats']).toBe(3803);
    expect(by['companies']).toBe(300);
    expect(by['industry_estimates']).toBe(195);
    expect(by['ai_insights']).toBe(50);
  });

  it('respekterer granularitetsregelen', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from industry_stats where region_level <> 'land' and nace_level > 3`,
    );
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it('bevarer undertrykte celler som merknad', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from industry_stats where merknader <> '{}'::jsonb`,
    );
    expect(Number(r.rows[0]!.c)).toBeGreaterThan(0);
  });

  it('holder ENK utenfor regnskapssnittet', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from companies
       where organisasjonsform = 'ENK' and inngar_i_regnskapssnitt`,
    );
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it('gir scoring-viewet noe å regne på', async () => {
    const r = await db.query<{ c: number }>(`select count(*) c from industry_scores_computed`);
    expect(Number(r.rows[0]!.c)).toBeGreaterThan(3000);
  });

  it('er idempotent — ny kjøring gir samme radtall', async () => {
    await db.exec(sql);
    const r = await db.query<{ c: number }>(`select count(*) c from industry_stats`);
    expect(Number(r.rows[0]!.c)).toBe(3803);
  });
});
