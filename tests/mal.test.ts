// Malen vet ikke at den handler om Tromsø.
//
// Tromsø alene treffer ikke alle grener i RPC-ene. Her lastes Tromsø sammen
// med tre fiktive kommuner (tests/helpers/fiktive.ts) i én base, og hver RPC
// sammenlignes med lokal.ts over den samme samlingen. I tillegg sjekkes det
// at kantene faktisk ble truffet, så testen ikke passerer på tomme svar.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import type { Datalag } from "@/lib/data/kontrakt";
import { lagLokal } from "@/lib/data/lokal";
import { samle, valider } from "@/lib/data/samle";
import { lagSupabaseDatalag } from "@/lib/data/supabase";
import { byggSeed, lesDatasett, lesRegion } from "../scripts/seed-build";
import { anonKlient, nyDb } from "./helpers/db";
import { fiktiveDatasett } from "./helpers/fiktive";

const datasett = lesDatasett();
const region = lesRegion();
const tromso = datasett.find((d) => d.slug === "tromso")!;
const alle = [...datasett, ...fiktiveDatasett(tromso.data)];
const samling = samle(alle);
const lokal = lagLokal(samling, { region });

let db: PGlite;
let base: Datalag;

beforeAll(async () => {
  db = await nyDb();
  await db.exec(byggSeed(samling, region));
  base = lagSupabaseDatalag(anonKlient(db));
});

/** Kaller samme metode på begge og krever likt svar. Returnerer svaret. */
async function lik<K extends keyof Datalag>(
  metode: K,
  ...args: Parameters<Datalag[K]>
): Promise<Awaited<ReturnType<Datalag[K]>>> {
  const f = (d: Datalag) => (d[metode] as (...a: unknown[]) => Promise<unknown>)(...args);
  const fraBase = await f(base);
  expect(fraBase, `${metode}(${args.join(", ")})`).toStrictEqual(await f(lokal));
  return fraBase as Awaited<ReturnType<Datalag[K]>>;
}

it("de fiktive datasettene er gyldige og samles med Tromsø", () => {
  expect(valider(samling)).toEqual([]);
  expect(samling.kommuner.map((k) => k.slug)).toEqual(["nullvik", "testvik", "tomvik", "tromso"]);
});

it("kommuner() er lik", async () => {
  const k = await lik("kommuner");
  expect(k.map((x) => x.slug)).toEqual(["nullvik", "testvik", "tomvik", "tromso"]);
});

for (const { slug, data } of alle) {
  const nr = data.meta.kommunenr;
  it(`${slug}: hver RPC er lik i basen og lokalt`, async () => {
    await lik("kommune_oversikt", nr);
    await lik("organkart", nr);
    await lik("eierskap", nr);
    await lik("nettverk", nr);
    await lik("endringer", nr);
    await lik("hull", nr);
    await lik("kommune_grader", nr);
    for (const p of data.prosesser) await lik("beslutningskjede", nr, p.key);
    for (const s of samling.segmenter.keys()) await lik("organer_for_segment", s, nr);
  });
}

it("regionen, fylkene og søket er like, også med fiktive kommuner utenfor registeret", async () => {
  await lik("region_oversikt");
  for (const f of region?.fylker ?? []) await lik("fylke_oversikt", f.nr);
  for (const q of ["testvik", "fiktiv", "kari fiktiv", "Ola", "lise", "mette motsagt", "styreleder"]) {
    await lik("sok", q, 20);
  }
});

it("organ_profil er lik for hvert organ i samlingen", async () => {
  for (const key of samling.organisasjoner.keys()) await lik("organ_profil", key);
});

describe("kantene ble truffet", () => {
  it("et organ delt mellom kommuner vises i begge, med hendelsene fra begge datasett", async () => {
    const p = await lik("organ_profil", "statsforvalteren-troms-og-finnmark");
    expect(p?.kommuner.map((k) => k.slug)).toEqual(["testvik", "tromso"]);
    const e = await lik("endringer", tromso.data.meta.kommunenr);
    expect(e?.skjedd.map((h) => h.tittel)).toContain(
      "Statsforvalteren avgjør en klage fra Testvik",
    );
  });

  it("prosessnøkkelen er per kommune, og en prosess kan være uten steg", async () => {
    const t = await lik("beslutningskjede", "9901", "reguleringsplan");
    const r = await lik("beslutningskjede", tromso.data.meta.kommunenr, "reguleringsplan");
    expect(t?.steg.length).toBe(3);
    expect(r?.steg.map((s) => s.org.key)).not.toEqual(t?.steg.map((s) => s.org.key));
    expect((await lik("beslutningskjede", "9901", "tom-prosess"))?.steg).toEqual([]);
  });

  it("en hendelse uten organ hører til kommunen den kom fra", async () => {
    const t = await lik("endringer", "9901");
    const hendelse = t?.skjedd.find((h) => h.tittel === "Testvik vedtar ny eierstrategi");
    expect(hendelse?.org).toBeNull();
    const r = await lik("endringer", tromso.data.meta.kommunenr);
    expect(r?.skjedd.map((h) => h.tittel)).not.toContain("Testvik vedtar ny eierstrategi");
  });

  it("planlagt og strukturdebatt står i ikke_skjedd, i stigende rekkefølge", async () => {
    const t = await lik("endringer", "9901");
    expect(t?.ikke_skjedd.map((h) => `${h.dato} ${h.type}`)).toEqual([
      "2027 planlagt",
      "2027-01 planlagt",
      "2028 strukturdebatt",
    ]);
    expect(t?.ikke_skjedd.every((h) => !h.skjedd)).toBe(true);
  });

  it("eierskapet følger kjeden, tåler sykelen og hopper over avsluttet eierskap", async () => {
    const e = await lik("eierskap", "9901");
    expect(e?.selskaper.map((s) => `${s.org.key}:${s.ledd}`)).toEqual([
      "testvik-energi:1",
      "testvik-havn:1",
      "testvik-nett:2",
    ]);
    expect(e?.utbytte.map((u) => [u.selskap.key, u.total?.aar ?? null, u.sum_mottakere])).toEqual([
      ["testvik-energi", 2025, 5_000_000],
      ["testvik-nett", null, 1_000_000],
    ]);
    const p = await lik("organ_profil", "testvik-kommune");
    expect(p?.eierandeler.map((x) => x.org.key)).toContain("gammelt-selskap");
  });

  it("nøkkeltallene sorteres på år, type, periode og konsern", async () => {
    const p = await lik("organ_profil", "testvik-energi");
    expect(
      p?.nokkeltall.map((n) => `${n.aar} ${n.type} ${n.periode ?? "-"} ${n.konsern ?? "-"}`),
    ).toEqual([
      "2025 omsetning - -",
      "2025 omsetning - false",
      "2025 omsetning - true",
      "2025 driftsresultat - -",
      "2025 driftsresultat H1 -",
      "2025 utbytte - -",
      "2024 utbytte - -",
    ]);
  });

  it("nettverket krever to ulike organer og holder domstolens leder ute", async () => {
    const n = await lik("nettverk", "9901");
    expect(n?.personer.map((p) => p.person.key)).toEqual(["kari-fiktiv", "per-fiktiv"]);
  });

  it("en motsagt rolle er ikke aktiv: den står under tidligere, uten sluttdato, og ikke i nettverket", async () => {
    const p = await lik("organ_profil", "testvik-energi");
    expect(p?.roller.naa.map((r) => r.person.key)).not.toContain("mette-motsagt");
    expect(p?.roller.tidligere).toContainEqual(
      expect.objectContaining({
        person: { key: "mette-motsagt", navn: "Mette Motsagt" },
        rolletype: "daglig_leder",
        motsagt: true,
        til: null,
      }),
    );
    // Den aktive rollen i nettselskapet står, og den er ikke motsagt.
    const nett = await lik("organ_profil", "testvik-nett");
    expect(nett?.roller.naa).toContainEqual(
      expect.objectContaining({
        person: { key: "mette-motsagt", navn: "Mette Motsagt" },
        motsagt: false,
      }),
    );
    // Ikke leder noe sted, og ikke i nettverket: bare én aktiv rolle.
    expect(JSON.stringify(await lik("organkart", "9901"))).not.toContain("Mette Motsagt");
    const n = await lik("nettverk", "9901");
    expect(n?.personer.map((x) => x.person.key)).not.toContain("mette-motsagt");
  });

  it("en ikke-leder i en domstol finnes ikke i noe svar", async () => {
    const svar = JSON.stringify([
      await lik("organ_profil", "testvik-tingrett"),
      await lik("organkart", "9901"),
      await lik("kommune_oversikt", "9901"),
    ]);
    expect(svar).toContain("Ola Fiktiv");
    expect(svar).not.toContain("Lise Fiktiv");
  });

  it("nesten tomme kommuner gir tomme lister, ikke feil", async () => {
    const tom = await lik("kommune_oversikt", "9902");
    expect(tom?.kommuneorgan?.key).toBe("tomvik-kommune");
    expect(tom?.kommunestyre).toBeNull();
    expect(tom?.ledere).toEqual([]);
    expect((await lik("eierskap", "9902"))?.selskaper).toEqual([]);
    expect(await lik("nettverk", "9902")).toEqual({ noder: [], kanter: [], personer: [] });

    const ingen = await lik("kommune_oversikt", "9903");
    expect(ingen?.kommuneorgan).toBeNull();
    expect(await lik("eierskap", "9903")).toEqual({ eier: null, selskaper: [], utbytte: [] });
    expect(await lik("endringer", "9903")).toEqual({ skjedd: [], ikke_skjedd: [] });
  });
});
