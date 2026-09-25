// Regler for kommunedatasettene i src/data/*.json.
//
// Datasettene er den eneste kilden: siden leser dem, og seed-en genereres fra
// dem. Reglene her er de CLAUDE.md og spec-en setter, sjekket på dataene
// før de når basen.

import { describe, expect, it } from "vitest";

import type { Belegg, Kommunedatasett } from "@/data/types";
import {
  ENHETER,
  HENDELSESTYPER,
  IKKE_SKJEDD_TYPER,
  KILDETYPER,
  MYNDIGHETER,
  NIVAAER,
  NOKKELTALLTYPER,
  ORGANTYPER,
  ORGSTATUSER,
  POLITISKE_ORGANTYPER,
  PRESISJONER,
  REKKEVIDDER,
  RELASJONSTYPER,
  ROLLESTATUSER,
  ROLLETYPER,
  SENSITIV_SYNLIGE_ROLLETYPER,
  VERIFISERINGER,
} from "@/lib/data/kontrakt";
import { datafiler, lokal } from "@/lib/data/datasett";
import { nokkel, samle, valider } from "@/lib/data/samle";
import { lesDatasett } from "../scripts/seed-build";

const filer = lesDatasett();
const ISO = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Alle belegg i et datasett, med hvor de står. */
function alleBelegg(d: Kommunedatasett): { hvor: string; b: Belegg }[] {
  return [
    ...d.organisasjoner.map((o) => ({ hvor: `organisasjon ${o.key}`, b: o.belegg })),
    ...d.roller.map((r) => ({ hvor: `rolle ${nokkel.rolle(r)}`, b: r.belegg })),
    ...d.relasjoner.map((r) => ({ hvor: `relasjon ${nokkel.relasjon(r)}`, b: r.belegg })),
    ...d.nokkeltall.map((n) => ({ hvor: `nøkkeltall ${nokkel.nokkeltall(n)}`, b: n.belegg })),
    ...d.hendelser.map((h) => ({ hvor: `hendelse ${h.dato} ${h.tittel}`, b: h.belegg })),
    ...d.prosesser.flatMap((p) =>
      p.steg.map((s, i) => ({ hvor: `prosess ${p.key} steg ${i + 1}`, b: s.belegg })),
    ),
  ];
}

/** Navnematching som tåler aksenter og æøå, som CLAUDE.md krever. */
const fold = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .toLowerCase();

it("finner minst ett datasett, og datalaget laster de samme filene", () => {
  expect(filer.length).toBeGreaterThan(0);
  expect(Object.keys(datafiler).sort()).toEqual(filer.map((f) => f.slug));
});

it("samles uten konflikter og uten referansefeil", () => {
  expect(valider(samle(filer))).toEqual([]);
});

for (const { slug, data: d } of filer) {
  describe(`${slug}.json`, () => {
    it("har gyldig meta og slug", () => {
      expect(slug).toMatch(SLUG);
      expect(d.meta.kommunenr).toMatch(/^\d{4}$/);
      expect(d.meta.fylkesnr).toMatch(/^\d{2}$/);
      expect(d.meta.sammenstilt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("har unike nøkler innenfor fila", () => {
      const unike = (xs: string[]) => expect(new Set(xs).size, JSON.stringify(xs)).toBe(xs.length);
      unike(d.kilder.map((x) => x.key));
      unike(d.organisasjoner.map((x) => x.key));
      unike(d.personer.map((x) => x.key));
      unike(d.segmenter.map((x) => x.kode));
      unike(d.prosesser.map((x) => x.key));
      unike(d.roller.map(nokkel.rolle));
      unike(d.relasjoner.map(nokkel.relasjon));
      unike(d.nokkeltall.map(nokkel.nokkeltall));
      unike(d.hendelser.map((h) => nokkel.hendelse(h)));
      unike(d.org_segment.map(nokkel.orgSegment));
      unike(d.hull.map(nokkel.hull));
      unike(d.organisasjoner.flatMap((o) => (o.orgnr ? [o.orgnr] : [])));
    });

    it("bruker bare verdier fra verdilistene", () => {
      const i = <T extends string>(liste: readonly T[], v: string, hvor: string) =>
        expect(liste as readonly string[], hvor).toContain(v);
      for (const k of d.kilder) i(KILDETYPER, k.type, `kilde ${k.key}`);
      for (const o of d.organisasjoner) {
        i(NIVAAER, o.nivaa, o.key);
        i(ORGANTYPER, o.organtype, o.key);
        i(ORGSTATUSER, o.status, o.key);
        if (o.rekkevidde) i(REKKEVIDDER, o.rekkevidde, o.key);
        for (const m of o.myndighet) i(MYNDIGHETER, m, o.key);
        expect(new Set(o.myndighet).size, o.key).toBe(o.myndighet.length);
      }
      for (const r of d.roller) {
        i(ROLLETYPER, r.rolletype, nokkel.rolle(r));
        i(ROLLESTATUSER, r.status, nokkel.rolle(r));
      }
      for (const r of d.relasjoner) i(RELASJONSTYPER, r.type, nokkel.relasjon(r));
      for (const n of d.nokkeltall) {
        i(NOKKELTALLTYPER, n.type, nokkel.nokkeltall(n));
        i(ENHETER, n.enhet, nokkel.nokkeltall(n));
      }
      for (const h of d.hendelser) {
        i(HENDELSESTYPER, h.type, h.tittel);
        i(PRESISJONER, h.presisjon, h.tittel);
      }
      for (const p of d.prosesser) for (const s of p.steg) i(MYNDIGHETER, s.myndighet, p.key);
      for (const { hvor, b } of alleBelegg(d)) i(VERIFISERINGER, b.verifisering, hvor);
    });

    it("har gyldige nøkler og ISO-datoer med riktig presisjon", () => {
      for (const x of [...d.kilder, ...d.organisasjoner, ...d.personer, ...d.prosesser])
        expect(x.key).toMatch(SLUG);
      const dato = (v: string | undefined, hvor: string) => {
        if (v !== undefined) expect(v, hvor).toMatch(ISO);
      };
      for (const o of d.organisasjoner) {
        dato(o.gyldig_fra, o.key);
        dato(o.gyldig_til, o.key);
        if (o.orgnr !== undefined) expect(o.orgnr).toMatch(/^\d{9}$/);
      }
      for (const r of d.roller)
        for (const v of [r.fra, r.til, r.til_forventet]) dato(v, nokkel.rolle(r));
      for (const r of d.relasjoner)
        for (const v of [r.fra_dato, r.til_dato]) dato(v, nokkel.relasjon(r));
      for (const { hvor, b } of alleBelegg(d)) dato(b.per, hvor);
      for (const h of d.hendelser) {
        dato(h.dato, h.tittel);
        expect(h.presisjon, h.tittel).toBe({ 4: "aar", 7: "maaned", 10: "dag" }[h.dato.length]);
      }
    });

    it("hver påstand har en kilde som finnes i datasettet", () => {
      const kilder = new Set(d.kilder.map((k) => k.key));
      for (const { hvor, b } of alleBelegg(d))
        expect(kilder.has(b.kilde), `${hvor}: ${b.kilde}`).toBe(true);
    });

    it("har verifisert bare fra pipelinen: en registerkilde og hentedatoen i per", () => {
      // Bare pipelinen (scripts/brreg.ts) kan sette `verifisert`, og da med
      // hentedatoen som full dato i `per`. Seed-en gjør den til `hentet` i
      // basen. En håndført påstand er aldri verifisert.
      const type = new Map(d.kilder.map((k) => [k.key, k.type]));
      const brudd = alleBelegg(d).filter(
        ({ b }) =>
          b.verifisering === "verifisert" &&
          (type.get(b.kilde) !== "register" || !/^\d{4}-\d{2}-\d{2}$/.test(b.per ?? "")),
      );
      expect(brudd.map((x) => x.hvor)).toEqual([]);
    });

    it("har aldri mer enn maa_verifiseres fra en sekundærkilde (Proff, Purehelp)", () => {
      const type = new Map(d.kilder.map((k) => [k.key, k.type]));
      const brudd = alleBelegg(d).filter(
        ({ b }) => type.get(b.kilde) === "sekundaer" && b.verifisering !== "maa_verifiseres",
      );
      expect(brudd.map((x) => x.hvor)).toEqual([]);
    });

    it("har år på hvert nøkkeltall, og enhet som passer typen", () => {
      for (const n of d.nokkeltall) {
        expect(Number.isInteger(n.aar), nokkel.nokkeltall(n)).toBe(true);
        expect(n.aar).toBeGreaterThanOrEqual(1800);
        expect(n.aar).toBeLessThanOrEqual(Number(d.meta.sammenstilt.slice(0, 4)));
        expect(n.enhet === "aarsverk", nokkel.nokkeltall(n)).toBe(n.type === "aarsverk");
        expect(Number.isFinite(n.verdi)).toBe(true);
      }
    });

    it("har referanser som peker inn i samme fil", () => {
      const organer = new Set(d.organisasjoner.map((o) => o.key));
      const personer = new Set(d.personer.map((p) => p.key));
      const segmenter = new Set(d.segmenter.map((s) => s.kode));
      const org = (k: string | undefined, hvor: string) => {
        if (k !== undefined) expect(organer.has(k), `${hvor}: ${k}`).toBe(true);
      };
      for (const o of d.organisasjoner) {
        org(o.overordnet, o.key);
        for (const s of o.segmenter) expect(segmenter.has(s), `${o.key}: ${s}`).toBe(true);
      }
      for (const r of d.roller) {
        org(r.org, "rolle");
        expect(personer.has(r.person), r.person).toBe(true);
      }
      for (const r of d.relasjoner) {
        org(r.fra, "relasjon");
        org(r.til, "relasjon");
      }
      for (const n of d.nokkeltall) org(n.org, "nøkkeltall");
      for (const h of d.hendelser) {
        org(h.org, h.tittel);
        for (const p of h.personer ?? []) expect(personer.has(p), `${h.tittel}: ${p}`).toBe(true);
      }
      for (const p of d.prosesser) for (const s of p.steg) org(s.org, p.key);
      for (const x of d.org_segment) {
        org(x.org, "org_segment");
        expect(segmenter.has(x.segment)).toBe(true);
      }
      for (const h of d.hull) {
        org(h.gjelder, h.hva);
        for (const p of h.personer ?? []) expect(personer.has(p), `${h.hva}: ${p}`).toBe(true);
      }
    });

    it("har hver person gjennom en rolle, en hendelse eller et hull", () => {
      const nevnt = new Set([
        ...d.roller.map((r) => r.person),
        ...d.hendelser.flatMap((h) => h.personer ?? []),
        ...d.hull.flatMap((h) => h.personer ?? []),
      ]);
      expect(d.personer.filter((p) => !nevnt.has(p.key)).map((p) => p.key)).toEqual([]);
    });

    it("lenker hver tekst som nevner en person ved navn, til den personen", () => {
      // Sperres en person, forsvinner radene som er lenket til henne. En tekst
      // som nevner henne uten lenke, ville blitt stående.
      const personer = d.personer.map((p) => ({ key: p.key, navn: fold(p.navn) }));
      const brudd: string[] = [];
      const sjekk = (tekster: (string | undefined)[], lenket: string[], hvor: string) => {
        const t = fold(tekster.filter(Boolean).join(" "));
        for (const p of personer) {
          if (t.includes(p.navn) && !lenket.includes(p.key)) brudd.push(`${hvor} nevner ${p.key}`);
        }
      };
      for (const o of d.organisasjoner)
        sjekk([o.navn, o.beskrivelse, o.belegg.merknad], [], `organisasjon ${o.key}`);
      for (const r of d.roller)
        sjekk([r.tittel, r.belegg.merknad], [r.person], `rolle ${nokkel.rolle(r)}`);
      for (const r of d.relasjoner) sjekk([r.belegg.merknad], [], `relasjon ${nokkel.relasjon(r)}`);
      for (const n of d.nokkeltall)
        sjekk([n.belegg.merknad], [], `nøkkeltall ${nokkel.nokkeltall(n)}`);
      for (const h of d.hendelser)
        sjekk([h.tittel, h.tekst, h.belegg.merknad], h.personer ?? [], `hendelse ${h.tittel}`);
      for (const p of d.prosesser) {
        sjekk([p.tittel, p.sporsmal], [], `prosess ${p.key}`);
        for (const s of p.steg) sjekk([s.hva, s.belegg.merknad], [], `prosess ${p.key}`);
      }
      for (const h of d.hull)
        sjekk([h.hva, h.hvorfor], h.personer ?? [], `hull ${h.gjelder}: ${h.hva.slice(0, 40)}`);
      expect(brudd).toEqual([]);
    });

    it("fører parti bare for roller i folkevalgte organer", () => {
      const type = new Map(d.organisasjoner.map((o) => [o.key, o.organtype]));
      const brudd = d.roller.filter(
        (r) =>
          r.parti !== undefined &&
          !(POLITISKE_ORGANTYPER as readonly string[]).includes(type.get(r.org) ?? ""),
      );
      expect(brudd.map(nokkel.rolle)).toEqual([]);
    });

    it("har bare lederroller i sensitive organer", () => {
      // Basen skjuler resten med RLS, men datasettet ligger i repoet. Det som
      // ikke står der, kan ikke lekke.
      const sensitiv = new Set(d.organisasjoner.filter((o) => o.sensitiv).map((o) => o.key));
      const brudd = d.roller.filter(
        (r) =>
          sensitiv.has(r.org) &&
          !(SENSITIV_SYNLIGE_ROLLETYPER as readonly string[]).includes(r.rolletype),
      );
      expect(brudd.map(nokkel.rolle)).toEqual([]);
    });

    it("holder sensitive organer utenfor nettverket", async () => {
      const n = await lokal.nettverk(d.meta.kommunenr);
      const sensitiv = new Set(d.organisasjoner.filter((o) => o.sensitiv).map((o) => o.key));
      expect(n?.noder.filter((o) => sensitiv.has(o.key) || o.sensitiv)).toEqual([]);
      expect(n?.kanter.filter((k) => sensitiv.has(k.fra) || sensitiv.has(k.til))).toEqual([]);
      const iSensitivt = new Set(d.roller.filter((r) => sensitiv.has(r.org)).map((r) => r.person));
      expect(n?.personer.filter((p) => iSensitivt.has(p.person.key))).toEqual([]);
    });

    it("skiller planlagt fra skjedd: det som ligger etter sammenstillingen, har en ikke-skjedd-type", () => {
      const ikkeSkjedd = IKKE_SKJEDD_TYPER as readonly string[];
      const fremtid = d.hendelser.filter(
        (h) => h.dato.slice(0, 10) > d.meta.sammenstilt.slice(0, h.dato.length),
      );
      expect(fremtid.filter((h) => !ikkeSkjedd.includes(h.type)).map((h) => h.tittel)).toEqual([]);
      const planlagt = d.hendelser.filter((h) => h.type === "planlagt");
      expect(planlagt.filter((h) => !fremtid.includes(h)).map((h) => h.tittel)).toEqual([]);
    });

    it("har samme segmenter på organet som i org_segment med styrke 2 eller 3", () => {
      for (const o of d.organisasjoner) {
        const fraTabell = d.org_segment
          .filter((x) => x.org === o.key && x.styrke >= 2)
          .map((x) => x.segment);
        expect([...o.segmenter].sort(), o.key).toEqual(fraTabell.sort());
      }
    });

    it("har en overordnet-relasjon for hvert organ med overordnet, og omvendt", () => {
      const fraFelt = d.organisasjoner
        .flatMap((o) => (o.overordnet ? [`${o.key}>${o.overordnet}`] : []))
        .sort();
      const fraRelasjon = d.relasjoner
        .filter((r) => r.type === "overordnet")
        .map((r) => `${r.fra}>${r.til}`)
        .sort();
      expect(fraRelasjon).toEqual(fraFelt);
    });

    it("har eierandeler som summerer til høyst 100 prosent per selskap", () => {
      const sum = new Map<string, number>();
      for (const r of d.relasjoner) {
        if (r.type === "eier" && r.andel !== undefined && r.til_dato === undefined) {
          sum.set(r.til, (sum.get(r.til) ?? 0) + r.andel);
        }
      }
      expect([...sum].filter(([, s]) => s > 100.0001)).toEqual([]);
      for (const r of d.relasjoner) {
        if (r.andel !== undefined) {
          expect(r.type).toBe("eier");
          expect(r.andel).toBeGreaterThan(0);
          expect(r.andel).toBeLessThanOrEqual(100);
        }
      }
    });

    it("merker motsagte roller bare med true, uten sluttdato, og sier hva registeret har", () => {
      // En motsagt rolle er ikke aktiv, men står i historikken. Sluttdatoen er
      // ukjent, så `til` settes ikke; merknaden sier hva registeret har.
      for (const r of d.roller) {
        if (r.motsagt === undefined) continue;
        expect(r.motsagt, nokkel.rolle(r)).toBe(true);
        expect(r.til, nokkel.rolle(r)).toBeUndefined();
        expect(r.til_forventet, nokkel.rolle(r)).toBeUndefined();
        expect(r.belegg.merknad ?? "", nokkel.rolle(r)).toMatch(/^Motsagt av /);
      }
    });

    it("har ingen rolle som både er avsluttet og har forventet slutt", () => {
      expect(
        d.roller
          .filter((r) => r.til !== undefined && r.til_forventet !== undefined)
          .map(nokkel.rolle),
      ).toEqual([]);
    });

    it("har et kommuneorgan og et kommunestyre, som alle kommuner har", async () => {
      const o = await lokal.kommune_oversikt(d.meta.kommunenr);
      expect(o?.kommuneorgan).not.toBeNull();
      expect(o?.kommunestyre).not.toBeNull();
    });
  });
}
