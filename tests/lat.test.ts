// Den late implementasjonen gir samme svar som hele samlingen.
//
// Datalaget laster bare filene indeksen sier et svar trenger (lat.ts,
// indeks.ts). Det er bare riktig hvis indeksen har tatt med hver fil som har en
// rad svaret leser. Her lastes Tromsø og de fiktive kommunene, som deler organer
// med Tromsø og med hverandre, og hvert svar sammenlignes med `lagLokal` over
// hele samlingen: hver kommune, hvert organ, hvert fylke, regionen og søket, i
// to ulike rekkefølger. I tillegg sjekkes det at et svar faktisk laster færre
// filer, at en gammel indeks oppdages, og at den innsjekkede indeksen er
// oppdatert.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Kommunedatasett } from "@/data/types";
import { datafiler, region as registeret } from "@/lib/data/datasett";
import { byggIndeks, type Dataindeks } from "@/lib/data/indeks";
import type { Datalag } from "@/lib/data/kontrakt";
import { lagLatLokal } from "@/lib/data/lat";
import { lagLokal } from "@/lib/data/lokal";
import { samle } from "@/lib/data/samle";
import { INDEKSFIL, lagIndekstekst } from "../scripts/dataindeks";
import { lesDatasett, lesRegion } from "../scripts/seed-build";
import { fiktiveDatasett } from "./helpers/fiktive";

const region = lesRegion();
const ekte = lesDatasett();
const tromso = ekte.find((d) => d.slug === "tromso")!;
const alle = [...ekte, ...fiktiveDatasett(tromso.data)];
const hel = lagLokal(samle(alle), { region });
const indeks = byggIndeks(alle, region);

/** En lat datalag over `datasett`, med kopier, så en test ikke kan endre et annet. */
function lat(datasett = alle, ix: Dataindeks | null = indeks, varsler: string[] = []) {
  const filer = Object.fromEntries(
    datasett.map(({ slug, data }) => [slug, async () => structuredClone(data) as Kommunedatasett]),
  );
  return lagLatLokal({
    filer,
    indeks: ix,
    region,
    kontroll: "lastede",
    varsle: (m) => varsler.push(m),
  });
}

/** Hvert kall datalaget har, med argumenter som dekker samlingen. */
function kall(): [string, (d: Datalag) => Promise<unknown>][] {
  const s = samle(alle);
  const ut: [string, (d: Datalag) => Promise<unknown>][] = [["kommuner", (d) => d.kommuner()]];
  for (const k of s.kommuner) {
    const nr = k.meta.kommunenr;
    ut.push(
      [`kommune_oversikt ${nr}`, (d) => d.kommune_oversikt(nr)],
      [`organkart ${nr}`, (d) => d.organkart(nr)],
      [`eierskap ${nr}`, (d) => d.eierskap(nr)],
      [`nettverk ${nr}`, (d) => d.nettverk(nr)],
      [`endringer ${nr}`, (d) => d.endringer(nr)],
      [`hull ${nr}`, (d) => d.hull(nr)],
      [`kommune_grader ${nr}`, (d) => d.kommune_grader(nr)],
    );
    for (const p of k.prosesser) {
      ut.push([`beslutningskjede ${nr} ${p.key}`, (d) => d.beslutningskjede(nr, p.key)]);
    }
    for (const seg of s.segmenter.keys()) {
      ut.push([`organer_for_segment ${seg} ${nr}`, (d) => d.organer_for_segment(seg, nr)]);
    }
  }
  for (const key of s.organisasjoner.keys()) {
    ut.push([`organ_profil ${key}`, (d) => d.organ_profil(key)]);
  }
  ut.push(["region_oversikt", (d) => d.region_oversikt()]);
  for (const f of region?.fylker ?? []) {
    ut.push([`fylke_oversikt ${f.nr}`, (d) => d.fylke_oversikt(f.nr)]);
  }
  for (const q of ["tromsø", "testvik", "fiktiv", "statsforvalteren", "kraft", "ordfører"]) {
    ut.push([`sok ${q}`, (d) => d.sok(q, 25)]);
  }
  ut.push(
    ["ukjent kommune", (d) => d.kommune_oversikt("9999")],
    ["ukjent organ", (d) => d.organ_profil("finnes-ikke")],
    ["ukjent fylke", (d) => d.fylke_oversikt("99")],
  );
  return ut;
}

describe("den late implementasjonen", () => {
  it("gir samme svar som hele samlingen, for hvert kall, forfra", async () => {
    const d = lat();
    for (const [navn, f] of kall()) expect(await f(d), navn).toStrictEqual(await f(hel));
  }, 120_000);

  it("gir samme svar bakfra, så rekkefølgen filene lastes i ikke spiller inn", async () => {
    const d = lat();
    for (const [navn, f] of kall().reverse()) expect(await f(d), navn).toStrictEqual(await f(hel));
  }, 120_000);

  it("laster bare filene indeksen sier en kommune trenger", async () => {
    for (const k of indeks.datasett) {
      const d = lat();
      await d.kommune_oversikt(k.meta.kommunenr);
      await d.nettverk(k.meta.kommunenr);
      expect(d.lastet(), k.slug).toEqual([...(indeks.kommune[k.slug] ?? [k.slug])].sort());
    }
    // Tomvik deler ingenting med de andre og skal klare seg med sin egen fil.
    const d = lat();
    await d.kommune_oversikt("9902");
    expect(d.lastet()).toEqual(["tomvik"]);
  });

  it("trenger ingen datasett for kommunelista og regionen", async () => {
    const d = lat();
    await d.kommuner();
    await d.region_oversikt();
    expect(d.lastet()).toEqual([]);
  });

  it("laster organets egen fil og filene med rader om det, ikke mer", async () => {
    const d = lat();
    await d.organ_profil("statsforvalteren-troms-og-finnmark");
    const trenger = indeks.organ["statsforvalteren-troms-og-finnmark"];
    expect(trenger, "Statsforvalteren har hendelser i Testviks fil").toBeDefined();
    expect(d.lastet()).toEqual([...trenger!].sort());
    expect(d.lastet().length).toBeLessThan(alle.length);
  });

  it("merker en gammel indeks, bygger den på nytt og svarer riktig", async () => {
    // Testvik får en ny rolle i Statsforvalteren, men indeksen er den gamle.
    const endret = alle.map((x) => ({ slug: x.slug, data: structuredClone(x.data) }));
    const testvik = endret.find((x) => x.slug === "testvik")!.data;
    testvik.personer.push({ key: "ny-fiktiv", navn: "Ny Fiktiv" });
    testvik.roller.push({
      org: "statsforvalteren-troms-og-finnmark",
      person: "ny-fiktiv",
      tittel: "Assisterende statsforvalter",
      rolletype: "nestleder_adm",
      status: "fast",
      belegg: { kilde: "testkilde", verifisering: "oppgitt", per: "2026-09" },
    });
    const varsler: string[] = [];
    const d = lat(endret, indeks, varsler);
    const fasit = lagLokal(samle(endret), { region });
    // Tromsø lastes først og ser riktig ut; testvik.json lastes for organet.
    const p = await d.organ_profil("statsforvalteren-troms-og-finnmark");
    expect(p).toStrictEqual(await fasit.organ_profil("statsforvalteren-troms-og-finnmark"));
    expect(varsler.join("\n")).toMatch(/utdatert/);
    expect(await d.kommune_oversikt(tromso.data.meta.kommunenr)).toStrictEqual(
      await fasit.kommune_oversikt(tromso.data.meta.kommunenr),
    );
  });

  it("bygger indeksen selv når det kommer en ny fil", async () => {
    const varsler: string[] = [];
    const uten = { ...indeks, datasett: indeks.datasett.filter((x) => x.slug !== "nullvik") };
    const d = lat(alle, uten, varsler);
    expect(await d.kommuner()).toStrictEqual(await hel.kommuner());
    expect(varsler.join("\n")).toMatch(/nye datasett nullvik/);
  });
});

describe("indeksen", () => {
  it("er oppdatert: src/lib/data/indeks.json er det `npm run data:indeks` skriver", () => {
    expect(readFileSync(INDEKSFIL, "utf8"), "Kjør `npm run data:indeks`.").toBe(lagIndekstekst());
  });

  it("er deterministisk: samme filer i annen rekkefølge gir samme indeks", () => {
    expect(byggIndeks([...alle].reverse(), region)).toStrictEqual(indeks);
  });

  it("dekker de ekte datasettene, og datalaget laster Tromsø uten resten", async () => {
    const ix = JSON.parse(readFileSync(INDEKSFIL, "utf8")) as Dataindeks;
    expect(ix.datasett.map((x) => x.slug)).toEqual(Object.keys(datafiler).sort());
    const d = lagLatLokal({
      filer: datafiler,
      indeks: ix,
      region: registeret,
      kontroll: "lastede",
    });
    await d.kommune_oversikt(tromso.data.meta.kommunenr);
    expect(d.lastet()).toEqual([...(ix.kommune["tromso"] ?? ["tromso"])].sort());
  });

  it("har samme slug som registeret for hver kommune med datasett", () => {
    for (const x of indeks.datasett) {
      const r = region?.kommuner.find((k) => k.nr === x.meta.kommunenr);
      if (r) expect(x.slug, x.meta.kommunenr).toBe(r.slug);
    }
  });
});
