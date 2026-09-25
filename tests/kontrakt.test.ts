// Kontrakttesten: basen og lokal.ts skal gi nøyaktig samme svar.
//
// Seed-en lastes i PGlite, og hver RPC kalles som `anon` gjennom
// `lagSupabaseDatalag`, altså samme vei siden vil gå når den bytter til
// Supabase. Svaret sammenlignes felt for felt med datalaget siden bruker: den
// late implementasjonen over src/data/*.json og indeksen (datasett.ts). Er de
// like her, er byttet i src/lib/data/index.ts bare et bytte av implementasjon.

import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { lokal } from "@/lib/data/datasett";
import type { Datalag } from "@/lib/data/kontrakt";
import { lagSupabaseDatalag } from "@/lib/data/supabase";
import { byggSeed, lesDatasett, lesRegion } from "../scripts/seed-build";
import { samle } from "@/lib/data/samle";
import { anonKlient, ferskDb, SEED } from "./helpers/db";

let db: PGlite;
let base: Datalag;

beforeAll(async () => {
  db = await ferskDb();
  base = lagSupabaseDatalag(anonKlient(db));
});

const datasett = lesDatasett();
const kommuner = datasett.map((d) => d.data);
const region = lesRegion();

describe("seed-en", () => {
  it("er oppdatert: supabase/seed/seed.sql er det seed-byggeren lager av dagens datasett", async () => {
    const lagret = await readFile(SEED, "utf8");
    expect(lagret, "Kjør `npm run seed:build`.").toBe(byggSeed(samle(datasett), region));
  });

  it("bygger på de samme datasettene som datalaget", async () => {
    expect((await lokal.kommuner()).map((k) => k.slug)).toEqual(datasett.map((d) => d.slug));
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
      "region",
      "fylke",
      "region_kommune",
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
    await db.exec(byggSeed(samle(datasett), region));
    expect(await avtrykk()).toEqual(foer);
  });

  it("bruker aldri tilfeldige id-er", () => {
    expect(byggSeed(samle(datasett), region)).not.toMatch(/gen_random_uuid|uuid_generate|random\(/);
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

      it("kommune_grader", async () => {
        const svar = await base.kommune_grader(nr);
        expect(svar?.alle.totalt).toBeGreaterThan(0);
        expect(svar).toStrictEqual(await lokal.kommune_grader(nr));
        // Samme påstander som verifiseringstellingen i oversikten.
        const o = await lokal.kommune_oversikt(nr);
        expect(svar?.alle.totalt).toBe(
          o!.verifisering.verifisert + o!.verifisering.oppgitt + o!.verifisering.maa_verifiseres,
        );
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

  it("region_oversikt()", async () => {
    const svar = await base.region_oversikt();
    expect(svar.kommuner.length).toBe(region?.kommuner.length ?? 0);
    expect(svar).toStrictEqual(await lokal.region_oversikt());
  });

  for (const f of region?.fylker ?? []) {
    it(`fylke_oversikt(${f.nr})`, async () => {
      const svar = await base.fylke_oversikt(f.nr);
      expect(svar?.fylke.navn).toBe(f.navn);
      expect(svar).toStrictEqual(await lokal.fylke_oversikt(f.nr));
    });
  }

  it("sok(), for navn på kommuner, organer og personer i roller", async () => {
    const d = kommuner[0]!;
    const sporringer = [
      "tromsø",
      "TROMSO",
      "guovdageaidnu",
      "gáivuotna kåfjord",
      "kraft",
      "kommune",
      "ordfører",
      "styreleder",
      d.organisasjoner[0]!.navn,
      d.personer[0]!.navn,
      d.personer[d.personer.length - 1]!.navn.split(" ")[0]!,
      d.organisasjoner.find((o) => o.orgnr)?.orgnr ?? "",
      "a",
      "",
      "  -- ",
    ];
    for (const q of sporringer) {
      for (const limit of [1, 10, 500]) {
        expect(await base.sok(q, limit), `${q} (${limit})`).toStrictEqual(await lokal.sok(q, limit));
      }
    }
  });

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
      await d.kommune_grader("9999"),
      await d.fylke_oversikt("99"),
    ];
    const fraBase = await svar(base);
    expect(fraBase.every((x) => x === null)).toBe(true);
    expect(fraBase).toStrictEqual(await svar(lokal));
  });
});
