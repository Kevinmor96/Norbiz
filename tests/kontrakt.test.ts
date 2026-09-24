// Kontrakttesten: basen og lokal.ts skal gi nøyaktig samme svar.
//
// Seed-en lastes i PGlite, og hver RPC kalles som `anon` gjennom
// `lagSupabaseDatalag`, altså samme vei siden vil gå når den bytter til
// Supabase. Svaret sammenlignes felt for felt med `lokal.ts`. Er de like her,
// er byttet i src/lib/data/index.ts bare et bytte av implementasjon.

import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import type { Datalag } from "@/lib/data/kontrakt";
import { datasett, lokal } from "@/lib/data/lokal";
import { lagSupabaseDatalag } from "@/lib/data/supabase";
import { byggSeed, lesDatasett } from "../scripts/seed-build";
import { samle } from "@/lib/data/samle";
import { anonKlient, SEED, seedetDb } from "./helpers/db";

let db: PGlite;
let base: Datalag;

beforeAll(async () => {
  db = await seedetDb();
  base = lagSupabaseDatalag(anonKlient(db));
});

const kommuner = datasett.map((d) => d.data);

describe("seed-en", () => {
  it("er oppdatert: supabase/seed/seed.sql er det seed-byggeren lager av dagens datasett", async () => {
    const lagret = await readFile(SEED, "utf8");
    expect(lagret, "Kjør `npm run seed:build`.").toBe(byggSeed(samle(lesDatasett())));
  });

  it("bygger på de samme datasettene som lokal.ts", () => {
    expect(lesDatasett().map((d) => d.slug)).toEqual(datasett.map((d) => d.slug).sort());
  });

  it("gir samme database når den kjøres to ganger", async () => {
    const tabeller = [
      "kilde",
      "kommune",
      "kommune_org",
      "organisasjon",
      "segment",
      "org_segment",
      "person",
      "rolleinnehav",
      "relasjon",
      "nokkeltall",
      "hendelse",
      "prosess",
      "prosess_steg",
      "hull",
    ];
    const avtrykk = async () => {
      const ut: Record<string, string> = {};
      for (const t of tabeller) {
        const r = await db.query<{ a: string }>(
          `select coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as a from ${t} x`,
        );
        ut[t] = r.rows[0]!.a;
      }
      return ut;
    };
    const foer = await avtrykk();
    await db.exec(await readFile(SEED, "utf8"));
    expect(await avtrykk()).toEqual(foer);
  });

  it("bruker aldri tilfeldige id-er", async () => {
    expect(await readFile(SEED, "utf8")).not.toMatch(/gen_random_uuid|uuid_generate|random\(/);
  });
});

describe("RPC-ene gir det samme som lokal.ts", () => {
  it("kommuner()", async () => {
    expect(await base.kommuner()).toStrictEqual(await lokal.kommuner());
  });

  for (const k of kommuner) {
    const nr = k.meta.kommunenr;

    describe(`${k.meta.kommune} (${nr})`, () => {
      it("kommune_oversikt", async () => {
        const svar = await base.kommune_oversikt(nr);
        expect(svar).not.toBeNull();
        expect(svar).toStrictEqual(await lokal.kommune_oversikt(nr));
      });

      for (const p of k.prosesser) {
        it(`beslutningskjede: ${p.key}`, async () => {
          const svar = await base.beslutningskjede(nr, p.key);
          expect(svar?.steg.length).toBe(p.steg.length);
          expect(svar).toStrictEqual(await lokal.beslutningskjede(nr, p.key));
        });
      }

      it("organkart", async () => {
        expect(await base.organkart(nr)).toStrictEqual(await lokal.organkart(nr));
      });

      it("eierskap", async () => {
        const svar = await base.eierskap(nr);
        expect(svar?.selskaper.length).toBeGreaterThan(0);
        expect(svar).toStrictEqual(await lokal.eierskap(nr));
      });

      it("nettverk", async () => {
        const svar = await base.nettverk(nr);
        expect(svar?.personer.length).toBeGreaterThan(0);
        expect(svar).toStrictEqual(await lokal.nettverk(nr));
      });

      it("endringer", async () => {
        expect(await base.endringer(nr)).toStrictEqual(await lokal.endringer(nr));
      });

      it("hull", async () => {
        expect(await base.hull(nr)).toStrictEqual(await lokal.hull(nr));
      });

      it("organer_for_segment, for hvert segment", async () => {
        for (const seg of k.segmenter) {
          expect(await base.organer_for_segment(seg.kode, nr), seg.kode).toEqual(
            await lokal.organer_for_segment(seg.kode, nr),
          );
        }
      });

      it("organ_profil, for hvert organ", async () => {
        for (const o of k.organisasjoner) {
          expect(await base.organ_profil(o.key), o.key).toStrictEqual(
            await lokal.organ_profil(o.key),
          );
        }
      });
    });
  }

  it("gir null for det som ikke finnes, i begge", async () => {
    const svar = async (d: Datalag) => [
      await d.kommune_oversikt("9999"),
      await d.beslutningskjede("9999", "reguleringsplan"),
      await d.beslutningskjede(kommuner[0]!.meta.kommunenr, "finnes-ikke"),
      await d.organkart("9999"),
      await d.organ_profil("finnes-ikke"),
      await d.eierskap("9999"),
      await d.nettverk("9999"),
      await d.endringer("9999"),
      await d.organer_for_segment("finnes-ikke", kommuner[0]!.meta.kommunenr),
      await d.organer_for_segment(kommuner[0]!.segmenter[0]!.kode, "9999"),
      await d.hull("9999"),
    ];
    const fraBase = await svar(base);
    expect(fraBase.every((x) => x === null)).toBe(true);
    expect(fraBase).toStrictEqual(await svar(lokal));
  });
});
