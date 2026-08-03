import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/** Fersk in-memory Postgres med alle migrasjoner applisert i filnavnrekkefølge. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create();
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
