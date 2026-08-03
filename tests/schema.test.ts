import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rejects, resetData, sharedDb } from './helpers/db.js';

let db: PGlite;

beforeAll(async () => {
  db = await sharedDb();
});

beforeEach(async () => {
  await resetData(db);
});

describe('enums', () => {
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

describe('industries', () => {
  it('håndhever nace_level 1-5 og selvrefererende hierarki', async () => {
    await db.exec(`
      insert into industries (nace_code, nace_level, name, common_name, slug)
      values ('96', 2, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'personlig-tjenesteyting');
    `);
    await db.exec(`
      insert into industries (nace_code, nace_level, parent_code, name, common_name, slug)
      values ('96.021', 5, '96', 'Frisering', 'Frisørsalong', 'frisorsalong');
    `);
    const n = await db.query<{ count: number }>(`select count(*) from industries`);
    expect(Number(n.rows[0]!.count)).toBe(2);

    const badLevel = await rejects(
      db,
      `insert into industries (nace_code, nace_level, name, common_name, slug)
       values ('99', 7, 'x', 'x', 'x')`,
      'industries_nace_level_check',
    );
    expect(badLevel).toBe(true);

    const badParent = await rejects(
      db,
      `insert into industries (nace_code, nace_level, parent_code, name, common_name, slug)
       values ('55.101', 5, 'finnes-ikke', 'x', 'x', 'x')`,
      'industries_parent_code_fkey',
    );
    expect(badParent).toBe(true);
  });
});

describe('regions', () => {
  it('tillater samme kode i flere årganger, men ikke duplikat årgang', async () => {
    await db.exec(`
      insert into regions (code, name, level, valid_from_year, valid_to_year) values
        ('0', 'Norge', 'land', 2017, null),
        ('46', 'Vestland', 'fylke', 2020, 2023),
        ('46', 'Vestland', 'fylke', 2024, null);
    `);
    const n = await db.query<{ count: number }>(`select count(*) from regions`);
    expect(Number(n.rows[0]!.count)).toBe(3);

    const dup = await rejects(
      db,
      `insert into regions (code, name, level, valid_from_year)
       values ('46', 'Vestland', 'fylke', 2024)`,
      'regions_code_valid_from_year_key',
    );
    expect(dup).toBe(true);
  });
});
