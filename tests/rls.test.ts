import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { actAs, actAsAnon, endAct, resetData, sharedDb } from './helpers/db.js';

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

describe('RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await sharedDb();
  });

  // Rullér tilbake rollebyttet uansett hvordan testen endte. En opprydding
  // på slutten av testen hoppes over når en assertion feiler først, og da
  // lekker rollen og auth.uid() inn i neste test i samme fil.
  afterEach(async () => {
    await endAct(db);
    await resetData(db);
  });

  it('lar en bruker kun se egne favoritter', async () => {
    await db.exec(`
      insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
      insert into industries (nace_code, nace_level, name, common_name, slug)
        values ('96', 2, 'x', 'x', 'pt');
      insert into regions (code, name, level, valid_from_year)
        values ('0', 'Norge', 'land', 2017);
      insert into favorites (user_id, industry_id, region_id) values
        ('${ALICE}', (select id from industries limit 1), (select id from regions limit 1)),
        ('${BOB}',   (select id from industries limit 1), (select id from regions limit 1));
    `);

    await actAs(db, ALICE);
    const mine = await db.query<{ count: number }>(`select count(*) from favorites`);
    expect(Number(mine.rows[0]!.count)).toBe(1);
  });

  it('gir anon lesetilgang til næringsdata uten innlogging', async () => {
    await db.exec(`
      insert into industries (nace_code, nace_level, name, common_name, slug)
        values ('96.021', 5, 'Frisering', 'Frisørsalong', 'frisorsalong');
    `);
    await actAsAnon(db);
    const r = await db.query<{ count: number }>(`select count(*) from industries`);
    expect(Number(r.rows[0]!.count)).toBe(1);
  });

  it('nekter anon tilgang til favoritter i det hele tatt', async () => {
    await actAsAnon(db);
    // Sterkere enn «tom via RLS»: anon har ingen GRANT på tabellen, så
    // spørringen avvises før RLS vurderes. Et lesbart-men-tomt resultat ville
    // vært svakere, siden det avhenger av at policyen er riktig skrevet.
    await expect(db.query(`select count(*) from favorites`)).rejects.toThrow(
      /permission denied for table favorites/,
    );
  });

  it('etterlater ingen brukerkontekst til neste test', async () => {
    // Vokter mot lekkasjen selve mønsteret finnes for å hindre.
    const r = await db.query<{ uid: string | null; who: string }>(
      `select auth.uid() as uid, current_user as who`,
    );
    expect(r.rows[0]!.uid).toBeNull();
    expect(r.rows[0]!.who).not.toBe('authenticated');
  });

  it('slår på RLS for alle offentlige tabeller', async () => {
    const r = await db.query<{ count: number }>(`
      select count(*) from pg_class
      where relrowsecurity and relnamespace = 'public'::regnamespace
    `);
    // Tolv offentlige tabeller pluss favorites.
    expect(Number(r.rows[0]!.count)).toBe(13);
  });
});
