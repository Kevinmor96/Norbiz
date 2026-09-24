import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROT = process.cwd();
export const MIGRASJONER = join(ROT, "supabase", "migrations");
export const SEED = join(ROT, "supabase", "seed", "seed.sql");
const STUB = join(ROT, "tests", "helpers", "supabase-stub.sql");

export async function migrasjonsfiler(): Promise<string[]> {
  return (await readdir(MIGRASJONER)).filter((f) => f.endsWith(".sql")).sort();
}

/** Fersk Postgres i minnet med Supabase-stubben og alle migrasjonene. */
export async function nyDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(await readFile(STUB, "utf8"));
  for (const fil of await migrasjonsfiler()) {
    try {
      await db.exec(await readFile(join(MIGRASJONER, fil), "utf8"));
    } catch (err) {
      throw new Error(`Migrasjon ${fil} feilet: ${(err as Error).message}`);
    }
  }
  return db;
}

/** Som nyDb(), med seed-en fra supabase/seed/seed.sql lastet. */
export async function seedetDb(): Promise<PGlite> {
  const db = await nyDb();
  await db.exec(await readFile(SEED, "utf8"));
  return db;
}

/**
 * Kjører `fn` som `rolle` i en transaksjon som alltid rulles tilbake.
 *
 * `set local` i en transaksjon nullstilles av rollback, også når en
 * assertion i `fn` feiler. Da kan ikke rollen lekke inn i neste test.
 */
export async function som<T>(
  db: PGlite,
  rolle: "anon" | "authenticated" | "service_role",
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`begin; set local role ${rolle};`);
  try {
    return await fn();
  } finally {
    await db.exec("rollback;");
  }
}

/** Kaller en RPC og returnerer jsonb-svaret. */
export async function rpc<T = unknown>(db: PGlite, fn: string, args: unknown[] = []): Promise<T> {
  const plasser = args.map((_, i) => `$${i + 1}`).join(", ");
  const r = await db.query<{ svar: T }>(`select public.${fn}(${plasser}) as svar`, args);
  return r.rows[0]!.svar;
}

/**
 * En supabase-js-lignende klient over PGlite, som anon. `lagSupabaseDatalag`
 * bruker den som om det var Supabase: navngitte `p_`-argumenter inn, `data`
 * ut. Argumentene sendes med navn (`p_x => $1`), slik PostgREST gjør, så feil
 * parameternavn feiler her også.
 */
export function anonKlient(db: PGlite) {
  return {
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      const navn = Object.keys(args);
      const plasser = navn.map((n, i) => `${n} => $${i + 1}`).join(", ");
      try {
        const data = await som(db, "anon", async () => {
          const r = await db.query<{ svar: unknown }>(
            `select public.${fn}(${plasser}) as svar`,
            navn.map((n) => args[n]),
          );
          return r.rows[0]!.svar;
        });
        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
  };
}

/**
 * Kjører SQL i en transaksjon som rulles tilbake, og returnerer navnet på
 * constrainten som stoppet den, eller null hvis den gikk gjennom. Postgres
 * legger navnet i et eget felt; å lete i feilteksten ville matchet omtrentlig.
 */
export async function stoppetAv(
  db: PGlite,
  sql: string,
  rolle?: "anon" | "authenticated",
): Promise<string | null> {
  await db.exec(rolle ? `begin; set local role ${rolle};` : "begin;");
  try {
    await db.exec(sql);
    return null;
  } catch (err) {
    const e = err as { constraint?: string; message?: string };
    return e.constraint ?? `(uten constraint) ${e.message ?? ""}`;
  } finally {
    await db.exec("rollback;");
  }
}
