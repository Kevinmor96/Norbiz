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

async function seedRefs(db: PGlite) {
  await db.exec(`
    insert into industries (nace_code, nace_level, name, common_name, slug) values
      ('96',    2, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'pt'),
      ('96.0',  3, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'pt3'),
      ('96.021',5, 'Frisering', 'Frisørsalong', 'frisorsalong');
    insert into regions (code, name, level, valid_from_year) values
      ('0',  'Norge', 'land',  2017),
      ('03', 'Oslo',  'fylke', 2020);
  `);
}

const ID = (t: string, w: string) => `(select id from ${t} where ${w})`;

describe('industry_stats', () => {
  it('tillater nasjonale rader på nivå 5', async () => {
    await seedRefs(db);
    await db.exec(`
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'foretak', 5, 'land', 3200, 6100000000, 'SSB:12910', 'ssb', 'alle');
    `);
    const n = await db.query<{ count: number }>(`select count(*) from industry_stats`);
    expect(Number(n.rows[0]!.count)).toBe(1);
  });

  it('avviser regionale rader på nivå 4 og 5', async () => {
    await seedRefs(db);
    const blocked = await rejects(
      db,
      `insert into industry_stats
         (industry_id, region_id, year, unit_type, nace_level, region_level,
          n_enheter, omsetning_total, source, data_quality, coverage)
       values
         (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='03'`)},
          2023, 'virksomhet', 5, 'fylke', 410, 780000000, 'SSB:12936', 'ssb', 'alle')`,
      'industry_stats_regional_grain',
    );
    expect(blocked).toBe(true);
  });

  it('tillater regionale rader på nivå 3', async () => {
    await seedRefs(db);
    await db.exec(`
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, driftsresultat_total, driftsmargin_pct,
         source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='03'`)},
         2023, 'virksomhet', 3, 'fylke', 410, 780000000, null, null,
         'SSB:12936', 'ssb', 'alle');
    `);
    const r = await db.query<{ driftsmargin_pct: number | null }>(
      `select driftsmargin_pct from industry_stats`,
    );
    expect(r.rows[0]!.driftsmargin_pct).toBeNull();
  });

  it('avviser duplikat på (industry, region, year, unit_type)', async () => {
    await seedRefs(db);
    const ins = `
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'foretak', 5, 'land', 3200, 6100000000, 'SSB:12910', 'ssb', 'alle')`;
    await db.exec(ins);
    const dup = await rejects(db, ins, 'industry_stats_natural_key');
    expect(dup).toBe(true);
  });
});

describe('companies', () => {
  it('utleder inngar_i_regnskapssnitt fra organisasjonsform og regnskapsar', async () => {
    await db.exec(`
      insert into companies (org_nr, navn, nace_code, kommune_code, organisasjonsform,
                             ansatte, omsetning, driftsresultat, egenkapital, regnskapsar,
                             source, data_quality)
      values
        ('811234567', 'Salong AS',  '96.021', '0301', 'AS',  6, 5200000, 410000, 900000, 2023, 'brreg', 'brreg'),
        ('922345678', 'Salong ENK', '96.021', '0301', 'ENK', 1, null,    null,   null,   null, 'brreg', 'brreg');
    `);
    const r = await db.query<{ org_nr: string; inngar: boolean }>(
      `select org_nr, inngar_i_regnskapssnitt as inngar from companies order by org_nr`,
    );
    expect(r.rows[0]!.inngar).toBe(true);
    expect(r.rows[1]!.inngar).toBe(false);
  });
});

describe('industry_estimates', () => {
  it('krever ai_anslag som data_quality og et ikke-tomt basert_pa', async () => {
    await seedRefs(db);
    await db.exec(`
      insert into industry_estimates
        (industry_id, metrikk, intervall_lav, intervall_hoy, enhet, konfidens,
         begrunnelse, basert_pa, model, prompt_version, source, data_quality)
      values
        (${ID('industries', `nace_code='96.021'`)}, 'etableringskapital',
         300000, 800000, 'NOK', 'middels',
         'Utstyr, stolleie og tre måneders drift før positiv kontantstrøm.',
         '[{"table":"industry_stats","year":2023}]'::jsonb,
         'claude', 'v1', 'ai:claude', 'ai_anslag');
    `);

    const wrongQuality = await rejects(
      db,
      `insert into industry_estimates
         (industry_id, metrikk, verdi_num, konfidens, begrunnelse, basert_pa,
          model, prompt_version, source, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, 'x', 1, 'lav', 'y',
               '[{"a":1}]'::jsonb, 'm', 'v1', 's', 'ssb')`,
      'industry_estimates_must_be_estimate',
    );
    expect(wrongQuality).toBe(true);

    const emptyBasis = await rejects(
      db,
      `insert into industry_estimates
         (industry_id, metrikk, verdi_num, konfidens, begrunnelse, basert_pa,
          model, prompt_version, source, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, 'x', 1, 'lav', 'y',
               '[]'::jsonb, 'm', 'v1', 's', 'ai_anslag')`,
      'industry_estimates_basert_pa_nonempty',
    );
    expect(emptyBasis).toBe(true);
  });
});

describe('ai_insights', () => {
  it('krever ikke-tomme referanser og alvorlighet 1-5', async () => {
    await seedRefs(db);
    await db.exec(`
      insert into ai_insights
        (industry_id, region_id, year, type, tittel, body, alvorlighet,
         referanser, knyttet_til, model, prompt_version, data_quality)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'avvik', 'Marginen faller mens antall foretak øker',
         'Driftsmarginen har falt tre år på rad samtidig som antall foretak har økt.',
         4, '[{"table":"industry_stats","field":"driftsmargin_pct"}]'::jsonb,
         'driftsmargin', 'claude', 'v1', 'ai_anslag');
    `);

    const badSeverity = await rejects(
      db,
      `insert into ai_insights
         (industry_id, region_id, type, tittel, body, alvorlighet, referanser,
          model, prompt_version, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='0'`)},
               'risiko', 't', 'b', 9, '[{"a":1}]'::jsonb, 'm', 'v1', 'ai_anslag')`,
      'ai_insights_alvorlighet_check',
    );
    expect(badSeverity).toBe(true);

    const noRefs = await rejects(
      db,
      `insert into ai_insights
         (industry_id, region_id, type, tittel, body, alvorlighet, referanser,
          model, prompt_version, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='0'`)},
               'risiko', 't', 'b', 3, '[]'::jsonb, 'm', 'v1', 'ai_anslag')`,
      'ai_insights_referanser_nonempty',
    );
    expect(noRefs).toBe(true);
  });
});
