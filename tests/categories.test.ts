import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, actAsAnon, endAct } from './helpers/db.js';
import { buildSeed } from '../seed/index.js';
import { emitSeed } from '../seed/emit.js';

/**
 * Kategorilaget fra migrasjon 0014/0015 og supabase/seed/kategorier.sql.
 *
 * Kategoriene er redaksjon, ikke generert data: én håndskrevet SQL-fil er
 * eneste kilde, og den kjøres ETTER seed.sql fordi seed-ens
 * `truncate industries cascade` tømmer category_members.
 */
describe('kategorilag', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.exec(emitSeed(buildSeed()));
    await db.exec(readFileSync(
      new URL('../supabase/seed/kategorier.sql', import.meta.url), 'utf8'));
  });

  it('har tabellene med offentlig lesetilgang', async () => {
    await actAsAnon(db);
    try {
      const c = await db.query(`select count(*) c from categories`);
      const m = await db.query(`select count(*) c from category_members`);
      const b = await db.query(`select count(*) c from brands`);
      expect(c.rows.length).toBe(1);
      expect(m.rows.length).toBe(1);
      expect(b.rows.length).toBe(1);
    } finally {
      await endAct(db);
    }
  });
});
