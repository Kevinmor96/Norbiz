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
      union all select 'industry_wages', count(*)::text from industry_wages
      union all select 'companies', count(*)::text from companies
      union all select 'industry_estimates', count(*)::text from industry_estimates
      union all select 'ai_insights', count(*)::text from ai_insights
    `);
    const by = Object.fromEntries(counts.rows.map((r) => [r.t, Number(r.c)]));
    // Faste antall bare der tallet ER kontrakten: kildelistene i industries.ts
    // og regions.ts, og de eksplisitte løkkegrensene for selskaper og anslag.
    expect(by['industries']).toBe(102);
    expect(by['regions']).toBe(44);
    expect(by['companies']).toBe(300);
    expect(by['industry_estimates']).toBe(195);
    expect(by['ai_insights']).toBe(50);
    // Statistikk- og lønnsradene faller ut av en top-down splitt med terskler.
    // Et fast tall her måtte redigeres hver gang genereringen endres, og ville
    // sagt ingenting om at seed-en er riktig — bare at den er uendret.
    expect(by['industry_stats']).toBeGreaterThan(3000);
    expect(by['industry_wages']).toBeGreaterThan(1000);
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

  it('er idempotent — ny kjøring gir samme rader', async () => {
    // Sammenlign mot forrige kjøring, ikke mot et hardkodet tall. Det er det
    // idempotens betyr, og en literal her ville dessuten passert selv om
    // radene hadde endret innhold så lenge antallet holdt seg.
    const fingerprint = async (): Promise<Record<string, string>> => {
      const r = await db.query<{ t: string; h: string }>(`
        select 'stats' t, md5(string_agg(x, '|' order by x collate "C")) h from (
          select i.nace_code||':'||s.year||':'||s.unit_type||':'||s.region_level
                 ||':'||s.n_enheter||':'||coalesce(s.driftsmargin_pct::text,'-') x
          from industry_stats s join industries i on i.id = s.industry_id) a
        union all
        select 'wages', md5(string_agg(x, '|' order by x collate "C")) from (
          select i.nace_code||':'||w.year||':'||coalesce(w.yrke_kode,'-')
                 ||':'||w.manedslonn_median x
          from industry_wages w join industries i on i.id = w.industry_id) b
        union all
        select 'demo', md5(string_agg(x, '|' order by x collate "C")) from (
          select i.nace_code||':'||d.year||':'||d.konkurser||':'||d.overlevelse_5ar_pct x
          from industry_demography d join industries i on i.id = d.industry_id) c`);
      return Object.fromEntries(r.rows.map((x) => [x.t, x.h]));
    };
    const before = await fingerprint();
    await db.exec(sql);
    expect(await fingerprint()).toEqual(before);
  });
});
