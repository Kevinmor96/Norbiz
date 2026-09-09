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

  it('slår på RLS for hver eneste tabell i public', async () => {
    // Bevisst uten fast antall. En test som teller til 13 passerer fortsatt når
    // en ny migrasjon legger til en tabell uten policy — den ga falsk trygghet
    // presis da companies_snapshot og industry_wages kom inn.
    const r = await db.query<{ tablename: string }>(`
      select c.relname as tablename
      from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind = 'r'
        and not c.relrowsecurity
      order by 1
    `);
    expect(r.rows.map((x) => x.tablename)).toEqual([]);
  });

  it('gir anon lesetilgang til hver ikke-brukereid tabell', async () => {
    const r = await db.query<{ tablename: string }>(`
      select c.relname as tablename
      from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind = 'r'
        -- To unntak, begge bevisste: favorites er brukereid, og
        -- newsletter_signups er den ene tabellen som ikke inneholder
        -- offentlig informasjon. Resten er SSB- og Brreg-tall som allerede er
        -- publisert; en liste over e-postadresser er ikke det.
        and c.relname not in ('favorites', 'newsletter_signups')
        and not has_table_privilege('anon', c.oid, 'SELECT')
      order by 1
    `);
    // Næringssidene er offentlige. Glemmer en migrasjon granten, blir tabellen
    // usynlig for uinnloggede brukere uten at noe annet feiler.
    expect(r.rows.map((x) => x.tablename)).toEqual([]);
  });

  it('gir aldri anon skriverettigheter på data den bare skal lese', async () => {
    // Supabase gir nye tabeller ARWDXT til anon via default privileges, og
    // radnivåsikkerheten er da det eneste som stopper skriving. Migrasjon 0022
    // fjerner rettighetene, slik at tabellene også ville tålt en feilaktig
    // permissive policy. newsletter_signups er unntatt: den skal skrives til.
    const r = await db.query<{ tablename: string; rett: string }>(`
      select c.relname as tablename, p.rett
      from pg_class c
      cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as p(rett)
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and c.relname not in ('favorites', 'newsletter_signups')
        and has_table_privilege('anon', c.oid, p.rett)
      order by 1, 2`);
    expect(r.rows.map((x) => `${x.tablename}:${x.rett}`)).toEqual([]);
  });

  it('holder nyhetsbrevlista skrivbar men ulesbar for anon', async () => {
    // Unntaket over er bare trygt så lenge det faktisk er et unntak: anon skal
    // kunne melde seg på, men aldri hente ut lista. Med select-rett kunne hvem
    // som helst lastet ned abonnentene med nøkkelen fra frontend-bundelen.
    const r = await db.query<{ ins: boolean; sel: boolean; upd: boolean; del: boolean }>(`
      select has_table_privilege('anon', 'newsletter_signups', 'INSERT') ins,
             has_table_privilege('anon', 'newsletter_signups', 'SELECT') sel,
             has_table_privilege('anon', 'newsletter_signups', 'UPDATE') upd,
             has_table_privilege('anon', 'newsletter_signups', 'DELETE') del`);
    expect(r.rows[0]).toEqual({ ins: true, sel: false, upd: false, del: false });
  });
});
