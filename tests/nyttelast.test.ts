// Det som serialiseres inn i HTML-en, skal være lite, og terrenget skal stå
// i SVG-fila, ikke i siden.
//
// Kommunesiden sender bare `Lettside` i HTML-en; resten er `BareServer` og
// skrives som null (src/lib/kommuneside.ts, src/lib/bare-server.ts). Her
// sjekkes det for hver kommune, med samme serialisering som TanStack Start
// bruker (seroval), og at terrengfila og sidens terreng passer sammen.

import { serialize } from "seroval";
import { describe, expect, it } from "vitest";

import { BareServer, bareServerAdapter } from "@/lib/bare-server";
import { lastKommuneside } from "@/lib/kommuneside";
import { lettside } from "@/lib/lettside";
import { koteId } from "@/lib/terreng";
import { hentTerreng, terrengKommuner, terrengSvg } from "@/lib/terreng-fil";
import { lesDatasett } from "../scripts/seed-build";

/** Målet for kommunesidens serialiserte tilstand (oppgaven: 120 kB for Tromsø). */
const TILSTAND_MAKS = 60_000;

const datasett = lesDatasett();

describe("kommunesiden i HTML-en", () => {
  it("serialiserer bare den lette delen, for hver kommune", async () => {
    let storst = { slug: "", n: 0 };
    for (const { slug } of datasett) {
      const side = await lastKommuneside(slug);
      expect(side, slug).not.toBeNull();
      const n = serialize({ lett: lettside(side!) }).length;
      if (n > storst.n) storst = { slug, n };
    }
    expect(storst.n, `største: ${storst.slug}`).toBeLessThan(TILSTAND_MAKS);
  });

  it("skriver BareServer som null", () => {
    const hemmelig = new BareServer({ mye: "data" });
    expect(bareServerAdapter.test(hemmelig)).toBe(true);
    expect(bareServerAdapter.toSerializable(hemmelig)).toBeNull();
    expect(bareServerAdapter.fromSerializable(null).verdi).toBeNull();
  });

  it("har ingen terrengstier i siden, bare adressen til fila", async () => {
    const side = await lastKommuneside("tromso");
    const tekst = JSON.stringify(side);
    expect(side!.terreng?.fil).toMatch(/^\/kart\/terreng\/5501\.svg\?v=[a-z0-9]+$/);
    // En SVG-sti med hundrevis av koordinater ville vært en lang streng av tall.
    expect(tekst).not.toMatch(/"d":"/);
    expect(tekst).not.toMatch(/"hav":/);
  });
});

describe("terrengfilene", () => {
  it("har en sti for havet, kysten og hver kote siden viser, for hver kommune", async () => {
    expect(terrengKommuner.length).toBeGreaterThan(0);
    for (const nr of terrengKommuner) {
      const [t, svg] = await Promise.all([hentTerreng(nr), terrengSvg(nr)]);
      expect(t, nr).not.toBeNull();
      const ider = new Set([...svg!.matchAll(/<path id="([^"]+)"/g)].map((m) => m[1]));
      expect(ider.has("hav") && ider.has("kyst"), nr).toBe(true);
      for (const k of t!.koter) expect(ider.has(koteId(k.hoyde)), `${nr} ${k.hoyde}`).toBe(true);
      // Stiene har ingen farge selv; den arves fra <use> i siden.
      expect(svg, nr).not.toMatch(/\b(fill|stroke)=/);
    }
  });

  it("gir null for et ukjent kommunenummer og for noe som ikke er et nummer", async () => {
    expect(await terrengSvg("9999")).toBeNull();
    expect(await terrengSvg("../x")).toBeNull();
    expect(await hentTerreng("abcd")).toBeNull();
  });
});
