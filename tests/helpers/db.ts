import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const STUB = join(process.cwd(), 'tests', 'helpers', 'supabase-stub.sql');

/** Fersk in-memory Postgres med Supabase-stub og alle migrasjoner applisert. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(await readFile(STUB, 'utf8'));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migrasjon ${file} feilet: ${(err as Error).message}`);
    }
  }
  return db;
}

/**
 * Kjører SQL og returnerer true hvis den feilet med nøyaktig dette
 * constraint-navnet. Postgres legger navnet i et eget felt på feilen; å lete
 * i feilmeldingsteksten i stedet ville matchet omtrentlig, og navnene her
 * ligner hverandre nok til at det er verdt å være presis.
 */
export async function rejects(db: PGlite, sql: string, constraint: string): Promise<boolean> {
  try {
    await db.exec(sql);
    return false;
  } catch (err) {
    const e = err as { constraint?: string; message?: string };
    if (typeof e.constraint === 'string') return e.constraint === constraint;
    // Enkelte feiltyper bærer ikke feltet; da er teksten det eneste vi har.
    return (e.message ?? '').includes(constraint);
  }
}

let cached: Promise<PGlite> | null = null;

/**
 * Én migrert database per testfil. Vitest kjører hver fil i sin egen worker,
 * så modulnivå-memoisering gir isolasjon mellom filer og gjenbruk innenfor.
 *
 * PGlite.create() tar 2-5 sekunder. Med freshDb() i hver enkelt test ville
 * suiten brukt flere minutter bare på oppstart. Bruk denne når testen kun
 * trenger et rent skjema, og freshDb() når den trenger en urørt instans.
 */
export function sharedDb(): Promise<PGlite> {
  cached ??= freshDb();
  return cached;
}

/** Tømmer alle tabeller, beholder skjemaet. Robust mot nye migrasjoner. */
export async function resetData(db: PGlite): Promise<void> {
  await db.exec(`
    do $$
    declare t text;
    begin
      for t in select tablename from pg_tables where schemaname = 'public' loop
        execute format('truncate table %I restart identity cascade', t);
      end loop;
    end $$;
  `);
}

/**
 * Rollebytte er transaksjonsavgrenset. Grunnen er at Postgres ikke lar seg
 * nullstille i ett grep: `reset role` rører ikke `request.jwt.claim.sub`, og
 * `reset all` rører ikke `role`. En håndskrevet opprydding må derfor huske
 * begge, og hoppes uansett over hvis en assertion feiler først.
 *
 * `set local` inne i en transaksjon reverserer begge deler automatisk ved
 * rollback, og `endAct` i en `afterEach` kjører uansett om testen feilet.
 */
export async function actAs(db: PGlite, userId: string): Promise<void> {
  await db.exec(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '${userId}';
  `);
}

export async function actAsAnon(db: PGlite): Promise<void> {
  await db.exec(`begin; set local role anon;`);
}

/** Avslutter rollebyttet. Skal kalles fra afterEach, ikke fra testen selv. */
export async function endAct(db: PGlite): Promise<void> {
  await db.exec(`rollback;`);
}
