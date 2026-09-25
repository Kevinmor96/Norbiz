// Søket bretter likt i basen og i TypeScript, og brettingen dekker navnene.
//
// Kontrakttesten sammenligner hele svarene. Her sjekkes grunnlaget for at de
// kan bli like: `intern.normaliser` i basen og `normaliser` i sok.ts gir samme
// tekst for hvert tegn i BRETTING og for hvert navn i datasettene, og hver
// bokstav i navnene er med i BRETTING (ellers ville «Gáivuotna» bare finnes med
// aksent). Til slutt noen søk slik folk skriver dem.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { lokal } from "@/lib/data/datasett";
import { BRETTING } from "@/lib/data/kontrakt";
import { normaliser, sokI, sokLimit } from "@/lib/data/sok";
import { lesDatasett, lesRegion } from "../scripts/seed-build";
import { nyDb } from "./helpers/db";

let db: PGlite;
beforeAll(async () => {
  db = await nyDb();
});

const datasett = lesDatasett();
const region = lesRegion();

/** Alle navn søket leter i: kommuner, organer, personer og titler. */
const navn = [
  ...(region?.kommuner.flatMap((k) => [k.navn, k.navn_offisielt]) ?? []),
  ...(region?.fylker.flatMap((f) => [f.navn, f.navn_offisielt]) ?? []),
  ...datasett.flatMap(({ data }) => [
    ...data.organisasjoner.flatMap((o) => [o.navn, o.kortnavn ?? ""]),
    ...data.personer.map((p) => p.navn),
    ...data.roller.map((r) => r.tittel),
  ]),
];

async function iBasen(tekster: string[]): Promise<string[]> {
  const r = await db.query<{ n: string }>(
    "select intern.normaliser(t) as n from unnest($1::text[]) with ordinality as x (t, i) order by i",
    [tekster],
  );
  return r.rows.map((x) => x.n);
}

describe("brettingen", () => {
  it("er lik i basen og i sok.ts for hvert tegn i BRETTING", async () => {
    const tegn = [...BRETTING.fra, "æ", "ß", "Æ", "ø", "Ø", "å", "Å", "ŋ", "đ", "ŧ", "č", "š", "ž"];
    expect(await iBasen(tegn)).toEqual(tegn.map(normaliser));
    const blandet = [
      "  Gáivuotna – Kåfjord – Kaivuono ",
      "HERMÈS NORWAY AS",
      "Ærø-Øst/ÅSEN",
      "a\tb\nc",
    ];
    expect(await iBasen(blandet)).toEqual(blandet.map(normaliser));
  });

  it("er lik i basen og i sok.ts for hvert navn i datasettene og registeret", async () => {
    const unike = [...new Set(navn)];
    for (let i = 0; i < unike.length; i += 2000) {
      const del = unike.slice(i, i + 2000);
      expect(await iBasen(del)).toEqual(del.map(normaliser));
    }
  });

  it("dekker hver bokstav i navnene: ingen bokstav faller bort som mellomrom", () => {
    const utenfor = new Set<string>();
    for (const n of navn) {
      for (const c of n.normalize("NFC")) {
        if (/\p{L}/u.test(c) && normaliser(c) === "") utenfor.add(c);
      }
    }
    expect([...utenfor].sort()).toEqual([]);
  });

  it("navnene i datasettene er NFC, så en aksent aldri står som eget tegn", () => {
    expect(navn.filter((n) => n !== n.normalize("NFC"))).toEqual([]);
  });

  it("gjør store bokstaver små uten å spørre lokalet", () => {
    expect(normaliser("TROMSØ")).toBe("tromso");
    expect(normaliser("Guovdageaidnu - Kautokeino")).toBe("guovdageaidnu kautokeino");
    expect(normaliser("Unjárga - Nesseby")).toBe("unjarga nesseby");
    expect(normaliser("HERMÈS")).toBe("hermes");
  });
});

describe("søket", () => {
  it("finner kommunen uansett aksenter og store bokstaver, med eksakt treff først", async () => {
    const svar = await lokal.sok("TROMSO", 5);
    expect(svar.kommuner.treff[0]?.slug).toBe("tromso");
    expect((await lokal.sok("tromsø", 5)).kommuner.treff[0]?.slug).toBe("tromso");
  });

  it("finner en kommune på den samiske formen og på den norske", async () => {
    const kautokeino = region?.kommuner.find((k) => k.navn === "Kautokeino");
    if (!kautokeino) return;
    expect((await lokal.sok("guovdageaidnu", 5)).kommuner.treff.map((k) => k.kommunenr)).toContain(
      kautokeino.nr,
    );
    expect((await lokal.sok("kautokeino", 5)).kommuner.treff[0]?.kommunenr).toBe(kautokeino.nr);
  });

  it("viser en person bare som en rolle i et organ", async () => {
    const person = datasett[0]!.data.personer[0]!;
    const svar = await lokal.sok(person.navn, 50);
    for (const r of svar.roller.treff) {
      expect(r.org.key).toBeTruthy();
      expect(r.tittel).toBeTruthy();
    }
    expect(Object.keys(svar)).toEqual(["sporring", "kommuner", "organer", "roller"]);
  });

  it("svarer tomt på for korte spørringer, og teller alle treff selv om lista kappes", async () => {
    expect(await lokal.sok("a", 10)).toEqual({
      sporring: "a",
      kommuner: { antall: 0, treff: [] },
      organer: { antall: 0, treff: [] },
      roller: { antall: 0, treff: [] },
    });
    const svar = await lokal.sok("kommune", 3);
    expect(svar.organer.treff.length).toBe(3);
    expect(svar.organer.antall).toBeGreaterThan(3);
  });

  it("kapper limit til 1–50", () => {
    expect([0, -5, 1, 7.9, 50, 51, 1e9, Number.NaN].map(sokLimit)).toEqual([
      1, 1, 1, 7, 50, 50, 50, 1,
    ]);
  });

  it("rangerer eksakt navn, så navn som begynner med spørringen, så ordstart, så resten", () => {
    const org = (key: string, navn: string) => ({
      key,
      navn,
      kortnavn: null,
      nivaa: "privat" as const,
      organtype: "AS" as const,
      status: "aktiv" as const,
      sensitiv: false,
      orgnr: null,
      kommunenr: null,
    });
    const svar = sokI(
      {
        kommuner: [],
        organer: [
          org("d", "Havnekontoret"),
          org("c", "Nord Havn"),
          org("b", "Havn Nord AS"),
          org("a", "Havn"),
          org("e", "Sjøhavna"),
        ],
        roller: [],
      },
      "havn",
      10,
    );
    expect(svar.organer.treff.map((o) => o.key)).toEqual(["a", "b", "d", "c", "e"]);
  });
});
