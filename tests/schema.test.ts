import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { sharedDb } from './helpers/db.js';

describe('enums', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await sharedDb();
  });

  it('definerer de seks enumene med riktige verdier', async () => {
    const res = await db.query<{ typname: string; labels: string[] }>(`
      select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      group by t.typname
      order by t.typname
    `);
    const byName = Object.fromEntries(res.rows.map((r) => [r.typname, r.labels]));

    expect(byName['data_quality']).toEqual(['mock', 'ssb', 'brreg', 'beregnet', 'ai_anslag']);
    expect(byName['region_level']).toEqual(['land', 'fylke', 'kommune']);
    expect(byName['unit_type']).toEqual(['foretak', 'virksomhet']);
    expect(byName['coverage']).toEqual(['alle', 'as_only']);
    expect(byName['konfidens']).toEqual(['lav', 'middels', 'hoy']);
    expect(byName['mangel_arsak']).toEqual([
      'ikke_publisert', 'konfidensielt', 'ikke_relevant', 'kommer_senere', 'brudd',
    ]);
  });
});
