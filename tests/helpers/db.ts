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

/** Kjører SQL og returnerer true hvis den feilet med forventet constraint-navn. */
export async function rejects(db: PGlite, sql: string, constraint: string): Promise<boolean> {
  try {
    await db.exec(sql);
    return false;
  } catch (err) {
    return (err as Error).message.includes(constraint);
  }
}
