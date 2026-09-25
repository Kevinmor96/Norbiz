// Brreg-importen, kjørt mot oppdiktede svar. Testene går aldri mot nettet:
// HTTP-laget er byttet ut med svarene i tests/fixtures/brreg/.
//
// To kommuner:
//
// - Fiskvik (9998) er oppdiktet og treffer kantene: flere sider, terskel,
//   feil kommune, underenhet med overordnet utenfor kommunen, sensitive
//   organer, fratrådt og død, styreplass eid av en enhet, navnebrødre som
//   trenger hashsuffiks, bekreftelse, motsigelse, regnskap i USD,
//   SN2025-koder, enkeltpersonforetak og et orgnr som ikke finnes.
// - Tromsø kjøres på det ekte datasettet med syntetiske svar for to orgnr,
//   så avstemmingen prøves mot grunnlagets egne påstander.
//
// Resultatet valideres med samle.ts og med reglene fra datasett-testen, og en
// ny kjøring på de samme svarene må gi byte-like filer.

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Belegg, Kommunedatasett } from "@/data/types";
import {
  ENHETER,
  KILDETYPER,
  MYNDIGHETER,
  NIVAAER,
  NOKKELTALLTYPER,
  ORGANTYPER,
  POLITISKE_ORGANTYPER,
  RELASJONSTYPER,
  ROLLESTATUSER,
  ROLLETYPER,
  SENSITIV_SYNLIGE_ROLLETYPER,
  VERIFISERINGER,
} from "@/lib/data/kontrakt";
import { lagLokal } from "@/lib/data/lokal";
import { nokkel, samle, valider } from "@/lib/data/samle";
import { kjor, serialiser, type KjorResultat } from "../scripts/brreg";
import { lesRoller, vaskSvar, velgUtvalg, type Enhet, type Http } from "../scripts/brreg/hent";
import { BEKREFTER, navneBrudd, sammeTall, VALUTA_HVORFOR } from "../scripts/brreg/importer";
import {
  lesKonfig,
  lesTabeller,
  MIN_TERSKEL,
  segmentFor,
  tolkKonfig,
  type Konfig,
  type NaeringTabell,
} from "../scripts/brreg/konfig";
import { navnKanVaereSamme, orgNavnNokkel, pentOrgNavn } from "../scripts/brreg/tekst";

const FIKSTUR = join(__dirname, "fixtures", "brreg");
const SALT = "test-salt-bare-for-testene";
const IDAG = "2026-09-25";
const tabeller = lesTabeller();
const felles = lesKonfig().felles;

/** HTTP som svarer fra fiksturmappa og kaster på alt den ikke kjenner. */
function fiksturHttp(mappe: string): { http: Http; kall: string[] } {
  const svar = JSON.parse(readFileSync(join(mappe, "svar.json"), "utf8")) as Record<
    string,
    string | { status: number }
  >;
  const kall: string[] = [];
  const http: Http = async (url) => {
    kall.push(url);
    const s = svar[url];
    if (s === undefined) throw new Error(`Uventet kall i testen: ${url}`);
    if (typeof s !== "string") return { status: s.status, tekst: "" };
    return { status: 200, tekst: readFileSync(join(mappe, s), "utf8") };
  };
  return { http, kall };
}

/** Fødselsdatoene i fiksturene. Ingen av dem skal finnes i noe importøren skriver. */
function fodselsdatoer(mappe: string): string[] {
  const ut = new Set<string>();
  for (const f of readdirSync(mappe)) {
    for (const m of readFileSync(join(mappe, f), "utf8").matchAll(/"fodselsdato": "([\d-]+)"/g))
      if (m[1]) ut.add(m[1]);
  }
  return [...ut];
}

function alleFiler(mappe: string): string[] {
  return readdirSync(mappe, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name));
}

// ---------------------------------------------------------------------------
// Reglene fra tests/datasett.test.ts, som en funksjon over ett datasett.
// Unntaket er «ingenting verifisert»: her gjelder regelen for pipelinen,
// at `verifisert` bare kommer fra en registerkilde med hentedato i `per`.
// ---------------------------------------------------------------------------

function regelbrudd(d: Kommunedatasett): string[] {
  const feil: string[] = [];
  const krev = (ok: boolean, hva: string) => {
    if (!ok) feil.push(hva);
  };
  const ISO = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const unike = (xs: string[], hva: string) => {
    const sett = new Set<string>();
    for (const x of xs) {
      krev(!sett.has(x), `${hva}: ${x} to ganger`);
      sett.add(x);
    }
  };
  unike(
    d.kilder.map((x) => x.key),
    "kilde",
  );
  unike(
    d.organisasjoner.map((x) => x.key),
    "organisasjon",
  );
  unike(
    d.personer.map((x) => x.key),
    "person",
  );
  unike(
    d.segmenter.map((x) => x.kode),
    "segment",
  );
  unike(d.roller.map(nokkel.rolle), "rolle");
  unike(d.relasjoner.map(nokkel.relasjon), "relasjon");
  unike(d.nokkeltall.map(nokkel.nokkeltall), "nøkkeltall");
  unike(
    d.hendelser.map((h) => nokkel.hendelse(h)),
    "hendelse",
  );
  unike(d.org_segment.map(nokkel.orgSegment), "org_segment");
  unike(d.hull.map(nokkel.hull), "hull");
  unike(
    d.organisasjoner.flatMap((o) => (o.orgnr ? [o.orgnr] : [])),
    "orgnr",
  );

  const i = (liste: readonly string[], v: string, hva: string) =>
    krev(liste.includes(v), `${hva}: ${v}`);
  const belegg: { hvor: string; b: Belegg }[] = [
    ...d.organisasjoner.map((o) => ({ hvor: o.key, b: o.belegg })),
    ...d.roller.map((r) => ({ hvor: nokkel.rolle(r), b: r.belegg })),
    ...d.relasjoner.map((r) => ({ hvor: nokkel.relasjon(r), b: r.belegg })),
    ...d.nokkeltall.map((n) => ({ hvor: nokkel.nokkeltall(n), b: n.belegg })),
    ...d.hendelser.map((h) => ({ hvor: h.tittel, b: h.belegg })),
  ];
  const kildetype = new Map(d.kilder.map((k) => [k.key, k.type]));
  for (const k of d.kilder) i(KILDETYPER, k.type, "kildetype");
  for (const o of d.organisasjoner) {
    krev(SLUG.test(o.key), `slug ${o.key}`);
    i(NIVAAER, o.nivaa, o.key);
    i(ORGANTYPER, o.organtype, o.key);
    for (const m of o.myndighet) i(MYNDIGHETER, m, o.key);
    if (o.orgnr !== undefined) krev(/^\d{9}$/.test(o.orgnr), `orgnr ${o.key}`);
    for (const v of [o.gyldig_fra, o.gyldig_til]) if (v) krev(ISO.test(v), `dato ${o.key}`);
  }
  for (const p of d.personer) krev(SLUG.test(p.key), `slug ${p.key}`);
  for (const r of d.roller) {
    i(ROLLETYPER, r.rolletype, nokkel.rolle(r));
    i(ROLLESTATUSER, r.status, nokkel.rolle(r));
  }
  for (const r of d.relasjoner) i(RELASJONSTYPER, r.type, nokkel.relasjon(r));
  for (const n of d.nokkeltall) {
    i(NOKKELTALLTYPER, n.type, nokkel.nokkeltall(n));
    i(ENHETER, n.enhet, nokkel.nokkeltall(n));
    krev(
      Number.isInteger(n.aar) && n.aar <= Number(d.meta.sammenstilt.slice(0, 4)),
      `år ${nokkel.nokkeltall(n)}`,
    );
    krev((n.enhet === "aarsverk") === (n.type === "aarsverk"), `enhet ${nokkel.nokkeltall(n)}`);
  }
  for (const { hvor, b } of belegg) {
    i(VERIFISERINGER, b.verifisering, hvor);
    krev(kildetype.has(b.kilde), `ukjent kilde ${b.kilde} (${hvor})`);
    if (b.per) krev(ISO.test(b.per), `per ${hvor}`);
    if (kildetype.get(b.kilde) === "sekundaer")
      krev(b.verifisering === "maa_verifiseres", `sekundær ${hvor}`);
    if (b.verifisering === "verifisert") {
      krev(kildetype.get(b.kilde) === "register", `verifisert uten registerkilde (${hvor})`);
      krev(/^\d{4}-\d{2}-\d{2}$/.test(b.per ?? ""), `verifisert uten hentedato (${hvor})`);
    }
  }
  const organer = new Set(d.organisasjoner.map((o) => o.key));
  const personer = new Set(d.personer.map((p) => p.key));
  const segmenter = new Set(d.segmenter.map((s) => s.kode));
  const org = (k: string | undefined, hvor: string) => {
    if (k !== undefined) krev(organer.has(k), `${hvor}: ukjent organ ${k}`);
  };
  for (const o of d.organisasjoner) {
    org(o.overordnet, o.key);
    for (const s of o.segmenter) krev(segmenter.has(s), `${o.key}: segment ${s}`);
  }
  for (const r of d.roller) {
    org(r.org, "rolle");
    krev(personer.has(r.person), `rolle: ukjent person ${r.person}`);
  }
  for (const r of d.relasjoner) {
    org(r.fra, "relasjon");
    org(r.til, "relasjon");
  }
  for (const n of d.nokkeltall) org(n.org, "nøkkeltall");
  for (const x of d.org_segment) org(x.org, "org_segment");
  for (const h of d.hull) org(h.gjelder, "hull");
  const nevnt = new Set([
    ...d.roller.map((r) => r.person),
    ...d.hendelser.flatMap((h) => h.personer ?? []),
    ...d.hull.flatMap((h) => h.personer ?? []),
  ]);
  for (const p of d.personer) krev(nevnt.has(p.key), `person uten rolle: ${p.key}`);
  for (const b of navneBrudd(d)) feil.push(`${b.eier} ${b.nokkel} nevner ${b.person} uten lenke`);
  const type = new Map(d.organisasjoner.map((o) => [o.key, o.organtype]));
  for (const r of d.roller)
    if (r.parti !== undefined)
      krev(
        (POLITISKE_ORGANTYPER as readonly string[]).includes(type.get(r.org) ?? ""),
        `parti ${nokkel.rolle(r)}`,
      );
  const sensitiv = new Set(d.organisasjoner.filter((o) => o.sensitiv).map((o) => o.key));
  for (const r of d.roller)
    if (sensitiv.has(r.org))
      krev(
        (SENSITIV_SYNLIGE_ROLLETYPER as readonly string[]).includes(r.rolletype),
        `sensitiv ${nokkel.rolle(r)}`,
      );
  for (const o of d.organisasjoner) {
    const fraTabell = d.org_segment
      .filter((x) => x.org === o.key && x.styrke >= 2)
      .map((x) => x.segment);
    krev(
      JSON.stringify([...o.segmenter].sort()) === JSON.stringify(fraTabell.sort()),
      `segmenter ${o.key}`,
    );
  }
  const fraFelt = d.organisasjoner
    .flatMap((o) => (o.overordnet ? [`${o.key}>${o.overordnet}`] : []))
    .sort();
  const fraRel = d.relasjoner
    .filter((r) => r.type === "overordnet")
    .map((r) => `${r.fra}>${r.til}`)
    .sort();
  krev(
    JSON.stringify(fraFelt) === JSON.stringify(fraRel),
    "overordnet-felt og -relasjoner er ulike",
  );
  for (const r of d.roller)
    krev(!(r.til && r.til_forventet), `til og til_forventet ${nokkel.rolle(r)}`);
  return feil;
}

// ---------------------------------------------------------------------------
// Enhetstester for reglene
// ---------------------------------------------------------------------------

describe("tekstreglene", () => {
  it("lar grunnlagets kortere navn passe registerets fulle, men ikke et annet navn", () => {
    expect(navnKanVaereSamme("Ellen Beate Lundberg", "Ellen Beate Jensen Lundberg")).toBe(true);
    expect(navnKanVaereSamme("Aslaug Haga", "Åslaug Marie Haga")).toBe(true);
    expect(navnKanVaereSamme("Inge K. Hansen", "Inge Kristian Hansen")).toBe(true);
    expect(navnKanVaereSamme("Kjell-Are Vassmyr", "Kjell Are Vassmyr")).toBe(true);
    expect(navnKanVaereSamme("Inge K. Hansen", "Inge Hansen")).toBe(false);
    expect(navnKanVaereSamme("Ola Hansen", "Kari Hansen")).toBe(false);
    expect(navnKanVaereSamme("Ola Hansen", "Ola Olsen")).toBe(false);
  });

  it("sammenligner organnavn uten form, aksenter og store bokstaver", () => {
    expect(orgNavnNokkel("TROMS KRAFT AS")).toBe(orgNavnNokkel("Troms Kraft AS"));
    expect(orgNavnNokkel("HERMÈS NORWAY AS")).toBe(orgNavnNokkel("Hermes Norway"));
    expect(orgNavnNokkel("UNIVERSITETSSYKEHUSET NORD-NORGE HF")).toBe(
      orgNavnNokkel("Universitetssykehuset Nord-Norge HF"),
    );
    expect(pentOrgNavn("STATSFORVALTEREN I TROMS OG FINNMARK", felles.navneformer)).toBe(
      "Statsforvalteren i Troms og Finnmark",
    );
    expect(pentOrgNavn("DNB BANK ASA")).toBe("DNB Bank ASA");
  });

  it("godtar et avrundet tall i grunnlaget, men ikke et annet tall", () => {
    expect(sammeTall(2_426_000_000, 2_426_136_000)).toBe(true);
    expect(sammeTall(412_000_000, 411_873_000)).toBe(true);
    expect(sammeTall(90_000_000, 120_345_000)).toBe(false);
    expect(sammeTall(1_000_000_000, 1_400_000_000)).toBe(false);
    expect(sammeTall(-12_000_000, 12_000_000)).toBe(false);
    expect(sammeTall(35_540_123, 35_540_000)).toBe(false);
  });
});

describe("konfigurasjonen og tabellene", () => {
  it("er gyldig, og terskelen kan ikke settes under Brregs gulv", () => {
    expect(lesKonfig().kommuner["5501"]?.terskel_ansatte).toBeGreaterThanOrEqual(MIN_TERSKEL);
    expect(() => tolkKonfig({ kommuner: { "5501": { terskel_ansatte: 4 } } })).toThrow(/400/);
  });

  it("har en næringstabell der hver regel passer sin egen SN2025-tittel og segmentene er Tromsøs", () => {
    const tromso = JSON.parse(
      readFileSync(join(__dirname, "..", "src", "data", "tromso.json"), "utf8"),
    ) as Kommunedatasett;
    for (const r of tabeller.naering.koder)
      expect(new RegExp(r.krav, "i").test(r.tittel.toLocaleLowerCase("nb")), r.prefiks).toBe(true);
    for (const s of tabeller.naering.segmenter)
      expect(tromso.segmenter.find((x) => x.kode === s.kode)?.navn, s.kode).toBe(s.navn);
  });

  it("mapper på SN2025-tittelen, ikke bare koden", () => {
    const t = tabeller.naering;
    expect(segmentFor("03.111", "Hav- og kystfiske", t).segment).toBe("sjomat");
    expect(segmentFor("35.150", "Handel med elektrisitet", t).segment).toBe("energi");
    // 47.762 er blomster i SN2007 og kjæledyr i SN2025. Tabellen har den ikke.
    expect(segmentFor("47.762", "Detaljhandel med kjæledyr og fôrvarer", t).segment).toBeNull();
    // Divisjon 45 finnes ikke i SN2025, og 30.1 er ikke 03.
    expect(segmentFor("30.110", "Bygging av skip og flytende materiell", t).segment).toBeNull();
    // En regel som treffer koden, men ikke tittelen, gir avvik og ikke segment.
    const sport: NaeringTabell = {
      standard: "SN2025",
      segmenter: [{ kode: "handel", navn: "Handel" }],
      koder: [
        {
          prefiks: "47.64",
          tittel: "Sportsutstyr (SN2007)",
          kontrollert: false,
          krav: "sport",
          segment: "handel",
        },
      ],
    };
    const r = segmentFor("47.640", "Detaljhandel med spill og leker", sport);
    expect(r.segment).toBeNull();
    expect(r.avvik?.prefiks).toBe("47.64");
  });
});

describe("hente-laget", () => {
  it("bytter fødselsdato mot en hash og kaster adresser og andre roller før noe lagres", () => {
    const roller = readFileSync(join(FIKSTUR, "fiktiv", "roller-999100001.json"), "utf8");
    const vasket = vaskSvar(
      "https://data.brreg.no/enhetsregisteret/api/enheter/999100001/roller",
      roller,
      SALT,
    );
    expect(vasket).not.toMatch(/fodselsdato|1902-02-12/);
    expect(vasket).not.toContain("Konrad"); // kontaktperson, ikke en rolle Maktkart bruker
    const enhet = readFileSync(join(FIKSTUR, "fiktiv", "enhet-999100007.json"), "utf8");
    const e = vaskSvar("https://data.brreg.no/enhetsregisteret/api/enheter/999100007", enhet, SALT);
    expect(e).not.toMatch(/Kaigata|Postboks|9990|12 34 56 78/);
    expect(e).toContain('"kommunenummer":"9998"');
    // Samme person gir samme pid vasket og uvasket.
    const fra = lesRoller(JSON.parse(roller), "999100001", SALT).roller;
    const til = lesRoller(JSON.parse(vasket), "999100001", SALT).roller;
    expect(til.map((r) => r.person?.pid)).toEqual(fra.map((r) => r.person?.pid));
  });

  it("skiller navnebrødre på fødselsdato og kjenner igjen samme person", () => {
    const a = lesRoller(
      JSON.parse(readFileSync(join(FIKSTUR, "fiktiv", "roller-999100001.json"), "utf8")),
      "999100001",
      SALT,
    ).roller;
    const b = lesRoller(
      JSON.parse(readFileSync(join(FIKSTUR, "fiktiv", "roller-999100002.json"), "utf8")),
      "999100002",
      SALT,
    ).roller;
    const c = lesRoller(
      JSON.parse(readFileSync(join(FIKSTUR, "fiktiv", "roller-999100003.json"), "utf8")),
      "999100003",
      SALT,
    ).roller;
    const ola = (rs: typeof a) => rs.find((r) => r.person?.navn === "Ola Nordmann")!.person!.pid;
    expect(ola(a)).not.toBe(ola(b));
    expect(ola(a)).toBe(ola(c));
    const per = (rs: typeof a) => rs.find((r) => r.person?.navn === "Per Fisker")!.person!.pid;
    expect(per(a)).toBe(per(b));
  });
});

describe("utvalget", () => {
  const e = (orgnr: string, ansatte: number, orgform = "AS", kommunenr = "9998"): Enhet => ({
    orgnr,
    navn: `TEST ${orgnr}`,
    orgform,
    orgformNavn: null,
    naering: [],
    ansatte,
    kommunenr,
    overordnet: null,
    sektor: null,
    stiftet: null,
    slettet: null,
    konkurs: false,
    underAvvikling: false,
  });
  const regel = { ansatte: 50, omsetning_nok: 100_000_000, topp_ansatte: 3 };
  const regnskap = (verdi: number, valuta = "NOK") => [
    {
      type: "SELSKAP" as const,
      fra: "2025-01-01",
      til: "2025-12-31",
      valuta,
      morselskap: null,
      omsetning: verdi,
      driftsresultat: null,
      aarsresultat: null,
      egenkapital: null,
    },
  ];
  const enheter = [
    e("1", 900, "KOMM"),
    e("2", 60),
    e("3", 25),
    e("4", 25),
    e("5", 22),
    e("6", 21),
    e("7", 30, "ENK"),
    e("8", 20),
  ];
  const utvalg = velgUtvalg(
    {
      kommunenr: "9998",
      enheter: {
        ...Object.fromEntries(enheter.map((x) => [x.orgnr, x])),
        f: e("f", 5000, "ORGL", "0301"),
      },
      iKommunen: enheter.map((x) => x.orgnr),
      underenheter: [
        {
          orgnr: "u1",
          navn: "U1",
          naering: [],
          ansatte: 40,
          kommunenr: "9998",
          overordnet: "f",
          oppstart: null,
          nedlagt: null,
        },
        {
          orgnr: "u2",
          navn: "U2",
          naering: [],
          ansatte: 55,
          kommunenr: "9998",
          overordnet: "1",
          oppstart: null,
          nedlagt: null,
        },
      ],
      regnskap: { "5": regnskap(150_000_000), "6": regnskap(150_000_000, "USD") },
    },
    regel,
    ["ENK"],
  );

  it("tar med store arbeidsgivere, store omsetninger og de største i kommunen, og sier hvorfor", () => {
    expect(utvalg["1"]).toEqual(["kommunen", "ansatte>=50", "topp3-ansatte"]);
    expect(utvalg["2"]).toEqual(["ansatte>=50", "topp3-ansatte"]);
    // Topp tre: 900, 60 og underenheten med 40. Likhet brytes på orgnr, ikke tilfeldig.
    expect(utvalg["u1"]).toEqual(["topp3-ansatte"]);
    expect(utvalg["3"]).toBeUndefined();
    expect(utvalg["5"]).toEqual(["omsetning>=100000000:2025"]);
  });

  it("regner bare kroner, hopper over enkeltpersonforetak og tar ikke underenheter med forelder i kommunen", () => {
    expect(utvalg["6"]).toBeUndefined(); // omsetningen er i USD
    expect(utvalg["7"]).toBeUndefined(); // enkeltpersonforetak
    expect(utvalg["u2"]).toBeUndefined(); // forelderen ligger i kommunen
    expect(utvalg["8"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fiskvik: hele løypa, to ganger
// ---------------------------------------------------------------------------

describe("Fiskvik (oppdiktet kommune)", () => {
  const mappe = join(FIKSTUR, "fiktiv");
  const konfig: Konfig = tolkKonfig({
    felles: { ...felles, sidestorrelse: 3 },
    kommuner: {
      "9998": {
        terskel_ansatte: 20,
        alltid: {
          fra_datasett: true,
          orgnr: [],
          navn: [{ navn: "Fiskvik fylkesting", organisasjonsform: "FYLK" }],
        },
      },
    },
  });
  let tmp: string;
  let data: string;
  let avvikMappe: string;
  let lager: string;
  let kall: string[];
  let logg: string[];
  let forste: KjorResultat;
  let d: Kommunedatasett;
  let rapport: string;
  const filer: Record<string, string> = {};

  const kjorEn = async (medLager: boolean) => {
    const f = fiksturHttp(mappe);
    const linjer: string[] = [];
    const [r] = await kjor({
      kommunenr: ["9998"],
      dataMappe: data,
      avvikMappe,
      http: f.http,
      mellomlager: medLager ? lager : null,
      salt: SALT,
      idag: IDAG,
      konfig,
      tabeller,
      skriv: true,
      logg: (l) => linjer.push(l),
    });
    return { r: r!, kall: f.kall, linjer };
  };

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "maktkart-brreg-"));
    data = join(tmp, "data");
    avvikMappe = join(tmp, "avvik");
    lager = join(tmp, "lager");
    cpSync(join(mappe, "datasett.json"), join(data, "fiskvik.json"));
    const k = await kjorEn(true);
    forste = k.r;
    kall = k.kall;
    logg = k.linjer;
    filer["datasett"] = readFileSync(forste.datasettfil, "utf8");
    filer["avvik"] = readFileSync(forste.avviksfil, "utf8");
    d = JSON.parse(filer["datasett"]) as Kommunedatasett;
    rapport = filer["avvik"];
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const org = (key: string) => d.organisasjoner.find((o) => o.key === key);
  const orgNr = (orgnr: string) => d.organisasjoner.find((o) => o.orgnr === orgnr);
  const roller = (key: string) => d.roller.filter((r) => r.org === key);

  it("nekter å kjøre uten salt", async () => {
    await expect(
      kjor({
        kommunenr: ["9998"],
        dataMappe: data,
        avvikMappe,
        http: fiksturHttp(mappe).http,
        mellomlager: null,
        salt: "",
        idag: IDAG,
        konfig,
        tabeller,
        skriv: false,
        logg: () => {},
      }),
    ).rejects.toThrow(/MAKTKART_PERSON_SALT/);
  });

  it("blar gjennom alle sidene og holder terskel og kommune", () => {
    const sider = kall.filter((u) => u.includes("/enheter?kommunenummer=9998"));
    expect(sider.map((u) => u.replace(/.*page=/, ""))).toEqual(["0", "1", "2", "3"]);
    expect(kall.every((u) => !u.includes("sort="))).toBe(true);
    expect(kall.some((u) => u.includes("fraAntallAnsatte=20"))).toBe(true);
    expect(orgNr("999100004")).toBeUndefined(); // forretningsadresse i en annen kommune
    expect(orgNr("999100006")).toBeUndefined(); // under terskelen
    expect(orgNr("999200004")).toBeUndefined(); // underenhet under terskelen
    expect(orgNr("999100010")).toBeUndefined(); // enkeltpersonforetak
    expect(kall.some((u) => u.includes("999100010/roller"))).toBe(false);
  });

  it("tar med underenheter med overordnet utenfor kommunen, knyttet til forelderen", () => {
    const u = orgNr("999200001")!;
    const f = orgNr("999400001")!;
    expect(u.overordnet).toBe(f.key);
    expect(u.navn).toBe("Statens Testverk Avd Fiskvik");
    expect(f.nivaa).toBe("stat");
    expect(d.relasjoner).toContainEqual(
      expect.objectContaining({ fra: u.key, til: f.key, type: "overordnet" }),
    );
    expect(orgNr("999200002")).toBeUndefined(); // forelderen er i kommunen
    // Politiet: sensitivt, uten roller og utenfor nettverket.
    expect(orgNr("999200003")?.sensitiv).toBe(true);
    expect(orgNr("999400002")?.sensitiv).toBe(true);
    expect(orgNr("999400002")?.organtype).toBe("politi");
  });

  it("hopper over fratrådte, døde og roller holdt av revisor og regnskapsfører", () => {
    const navn = d.personer.map((p) => p.navn);
    expect(navn).not.toContain("Frida Fratrådt");
    expect(navn).not.toContain("Dag Død");
    expect(navn).not.toContain("Konrad Kontakt");
    expect(d.organisasjoner.map((o) => o.orgnr)).not.toContain("999600002");
    // Revisor, regnskapsfører og kontaktperson (4) kastes allerede i hente-laget.
    expect(forste.resultat.oppsummering.hoppetOver).toMatchObject({
      fratradt: 1,
      doed: 1,
      andreRoller: 4,
    });
  });

  it("fører en styreplass eid av en enhet som relasjon mellom organer", () => {
    const holding = orgNr("999300001")!;
    const salg = orgNr("999100008")!;
    expect(d.relasjoner).toContainEqual(
      expect.objectContaining({ fra: holding.key, til: salg.key, type: "medlem_av" }),
    );
    expect(d.personer.map((p) => p.navn)).not.toContain("Nordfisk Holding AS");
  });

  it("skiller navnebrødre med hashsuffiks, og samme person får samme nøkkel", () => {
    const olaer = d.personer.filter((p) => p.navn === "Ola Nordmann");
    expect(olaer).toHaveLength(2);
    for (const p of olaer) expect(p.key).toMatch(/^ola-nordmann-[0-9a-f]{6}$/);
    const iHavfiske = roller("fiskvik-havfiske").find((r) =>
      r.person.startsWith("ola-nordmann"),
    )!.person;
    const iReiser = roller(orgNr("999100003")!.key).find((r) =>
      r.person.startsWith("ola-nordmann"),
    )!.person;
    expect(iReiser).toBe(iHavfiske);
    // Uten navnekollisjon: ingen suffiks.
    expect(d.personer.find((p) => p.navn === "Siri Sparer")?.key).toBe("siri-sparer");
  });

  it("bekrefter grunnlagets påstander og oppgraderer dem til verifisert med hentedatoen", () => {
    const dl = roller("fiskvik-havfiske").find((r) => r.person === "per-fisker")!;
    expect(dl.belegg).toMatchObject({
      kilde: "brreg-roller",
      verifisering: "verifisert",
      per: IDAG,
    });
    expect(dl.belegg.merknad).toMatch(new RegExp(`^${BEKREFTER}`));
    // Kommunedirektøren står under administrasjonen i grunnlaget og som daglig
    // leder i kommunen i registeret, med et mellomnavn grunnlaget ikke har.
    const kd = roller("fiskvik-administrasjonen")[0]!;
    expect(kd.belegg.verifisering).toBe("verifisert");
    expect(roller("fiskvik-kommune")).toEqual([]);
    const dommer = roller("fiskvik-tingrett");
    expect(dommer).toHaveLength(1);
    expect(dommer[0]!.belegg.verifisering).toBe("verifisert");
    const oms = d.nokkeltall.find((n) => n.org === "fiskvik-havfiske" && n.type === "omsetning")!;
    expect(oms).toMatchObject({
      verdi: 411_873_000,
      belegg: { kilde: "regnskapsregisteret", verifisering: "verifisert" },
    });
    expect(oms.belegg.merknad).toContain("412 000 000");
    const konsern = d.nokkeltall.find(
      (n) => n.org === "nordvik-kraft" && n.type === "aarsresultat" && n.konsern,
    )!;
    expect(konsern.belegg.verifisering).toBe("verifisert");
    // Et år registeret ikke viser, blir stående urørt.
    const eldre = d.nokkeltall.find((n) => n.org === "nordvik-kraft" && n.aar === 2024)!;
    expect(eldre.belegg.verifisering).toBe("maa_verifiseres");
    expect(forste.resultat.oppsummering.bekreftet).toEqual({ roller: 3, nokkeltall: 2 });
  });

  it("kobler en person i grunnlaget til registeret gjennom et felles organ", () => {
    const leder = roller("fiskvik-sparebank").find((r) => r.rolletype === "styreleder")!;
    expect(leder.person).toBe("per-fisker");
    expect(leder.belegg.verifisering).toBe("verifisert");
  });

  it("overskriver aldri i stillhet: motsigelsen står ved siden av og går til avviksrapporten", () => {
    const styreledere = roller("fiskvik-havfiske").filter((r) => r.rolletype === "styreleder");
    expect(styreledere.map((r) => r.person).sort()).toEqual(["line-lederberg", "olga-styrmann"]);
    const olga = styreledere.find((r) => r.person === "olga-styrmann")!;
    expect(olga.belegg.verifisering).toBe("maa_verifiseres");
    expect(rapport).toMatch(
      /fiskvik-havfiske: styreleder \| Olga Styrmann[^|]*\| Styreleder: Line Lederberg/,
    );
    const ek = d.nokkeltall.filter((n) => n.org === "fiskvik-havfiske" && n.type === "egenkapital");
    expect(ek).toHaveLength(1);
    expect(ek[0]!.verdi).toBe(90_000_000);
    expect(rapport).toContain("90 000 000 kr");
    expect(rapport).toContain("120 345 000 kr");
  });

  it("slår aldri sammen en person i grunnlaget med en navnebror uten felles organ, og holder navnebroren tilbake", () => {
    // To poster med samme navn ville gjort en innsigelse halv. Navnebroren
    // venter på en menneskelig vurdering (samme_person eller ulik_person).
    expect(d.personer.filter((p) => p.navn === "Jon Hansen").map((p) => p.key)).toEqual([
      "jon-hansen",
    ]);
    expect(d.personer.filter((p) => p.navn === "Tore Tekst").map((p) => p.key)).toEqual([
      "tore-tekst",
    ]);
    expect(roller(orgNr("999100005")!.key)).toEqual([]);
    expect(rapport).toMatch(
      /jon-hansen-[0-9a-f]{6} \| Jon Hansen \(jon-hansen\) \|.*Ikke tatt inn.*ulik_person/,
    );
    expect(rapport).toMatch(/tore-tekst-[0-9a-f]{6} \| Tore Tekst \(tore-tekst\)/);
    expect(forste.resultat.oppsummering.hoppetOver.navnebror).toBe(2);
  });

  it("tar ikke inn en person som grunnlagets tekst nevner uten lenke (navneregelen)", () => {
    expect(d.personer.map((p) => p.navn)).not.toContain("Reidun Reise");
    expect(rapport).toMatch(/reidun-reise \| Teksten i hull fiskvik-kommune/);
  });

  it("tar inn navnebroren som egen person når et menneske har sagt at det er en annen", async () => {
    const key = /(jon-hansen-[0-9a-f]{6})/.exec(rapport)![1]!;
    const tmp2 = mkdtempSync(join(tmpdir(), "maktkart-brreg-ulik-"));
    try {
      cpSync(join(mappe, "datasett.json"), join(tmp2, "data", "fiskvik.json"));
      const k2 = tolkKonfig({
        felles: { ...felles, sidestorrelse: 3 },
        kommuner: {
          "9998": {
            terskel_ansatte: 20,
            ulik_person: [key],
            alltid: {
              fra_datasett: true,
              orgnr: [],
              navn: [{ navn: "Fiskvik fylkesting", organisasjonsform: "FYLK" }],
            },
          },
        },
      });
      const [r] = await kjor({
        kommunenr: ["9998"],
        dataMappe: join(tmp2, "data"),
        avvikMappe: join(tmp2, "avvik"),
        http: fiksturHttp(mappe).http,
        mellomlager: null,
        salt: SALT,
        idag: IDAG,
        konfig: k2,
        tabeller,
        skriv: true,
        logg: () => {},
      });
      const d2 = JSON.parse(readFileSync(r!.datasettfil, "utf8")) as Kommunedatasett;
      expect(
        d2.personer
          .filter((p) => p.navn === "Jon Hansen")
          .map((p) => p.key)
          .sort(),
      ).toEqual(["jon-hansen", key]);
      expect(regelbrudd(d2)).toEqual([]);
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });

  it("fører regnskap i annen valuta som hull, aldri som kroner", () => {
    const arktis = orgNr("999100005")!;
    expect(d.nokkeltall.filter((n) => n.org === arktis.key)).toEqual([]);
    expect(d.hull).toContainEqual({
      gjelder: arktis.key,
      hva: "Regnskapstallene for 2025 er ført i USD.",
      hvorfor: VALUTA_HVORFOR,
    });
  });

  it("merker konsern, morselskap og avvikende regnskapsår", () => {
    const nk = d.nokkeltall.filter((n) => n.org === "nordvik-kraft" && n.aar === 2025);
    expect(nk.find((n) => n.type === "omsetning" && n.konsern === true)?.belegg.merknad).toBe(
      "Konsernregnskap.",
    );
    expect(nk.find((n) => n.type === "omsetning" && n.konsern === false)?.belegg.merknad).toBe(
      "Morselskapets eget regnskap, ikke konsern.",
    );
    const salg = d.nokkeltall.find(
      (n) => n.org === orgNr("999100008")!.key && n.type === "omsetning",
    )!;
    expect(salg.aar).toBe(2025);
    expect(salg.belegg.merknad).toContain("2024-07-01–2025-06-30");
  });

  it("skriver hvorfor hvert importert organ er med, maskinlesbart først i merknaden", () => {
    expect(orgNr("999100005")?.belegg.merknad).toBe("Utvalg: ansatte>=50, topp10-ansatte.");
    expect(orgNr("999100003")?.belegg.merknad).toBe("Utvalg: topp10-ansatte.");
    expect(orgNr("999400001")?.belegg.merknad).toBe("Utvalg: overordnet.");
    expect(orgNr("999300001")?.belegg.merknad).toBe("Utvalg: styreplass.");
    const utenGrunn = d.organisasjoner.filter(
      (o) => o.belegg.kilde === "enhetsregisteret" && !o.belegg.merknad?.startsWith("Utvalg: "),
    );
    expect(utenGrunn.map((o) => o.key)).toEqual([]);
  });

  it("gir segment etter SN2025-tittelen og legger til segmentet i lista", () => {
    expect(orgNr("999100003")?.segmenter).toEqual(["reiseliv"]);
    expect(orgNr("999100009")?.segmenter).toEqual([]);
    expect(d.segmenter.map((s) => s.kode)).toContain("reiseliv");
  });

  it("kobler grunnlagets organer uten orgnr på eksakt navn, og sier fra om det", () => {
    expect(orgNr("999100002")).toBeUndefined(); // sparebanken er grunnlagets
    expect(roller("fiskvik-sparebank").length).toBeGreaterThan(0);
    expect(rapport).toMatch(
      /fiskvik-sparebank \| Fiskvik Sparebank \| FISKVIK SPAREBANK \(999100002\)/,
    );
    expect(rapport).toMatch(/Fiskvik fylkesting \| Navn i scripts\/brreg.config.json/);
    expect(rapport).toMatch(
      /fiskvik-havn-kf \| Fiskvik Havn KF, orgnr 999100099 \| Finnes ikke \(404\)/,
    );
    expect(rapport).toMatch(/fiskvik-sparebank \| – \| Regnskapsregisteret svarte med feil/);
  });

  it("tar bare toppleder med i sensitive organer", () => {
    expect(d.personer.map((p) => p.navn)).not.toContain("Sensitiv Sensitivsen");
    expect(roller("fiskvik-tingrett").map((r) => r.rolletype)).toEqual(["dommer_leder"]);
  });

  it("fører varamedlemmer med egen status og merker ansattvalgte", () => {
    const vara = roller("fiskvik-havfiske").find((r) => r.rolletype === "varamedlem")!;
    expect(vara.status).toBe("vara");
    expect(
      roller("fiskvik-sparebank").some((r) => r.tittel === "Styremedlem (valgt av de ansatte)"),
    ).toBe(true);
  });

  it("skriver aldri fødselsdato, alder eller adresse, verken i datasett, rapport, mellomlager eller logg", () => {
    const datoer = fodselsdatoer(mappe);
    expect(datoer.length).toBeGreaterThan(10);
    const tekster = [
      filer["datasett"]!,
      filer["avvik"]!,
      logg.join("\n"),
      ...alleFiler(lager).map((f) => readFileSync(f, "utf8")),
    ];
    for (const t of tekster) {
      for (const dato of datoer) expect(t).not.toContain(dato);
      expect(t).not.toMatch(/"fodselsdato"|Kaigata|Postboks/);
    }
  });

  it("gir et gyldig datasett etter samle.ts og reglene i datasett-testen", async () => {
    expect(valider(samle([{ slug: "fiskvik", data: d }]))).toEqual([]);
    expect(regelbrudd(d)).toEqual([]);
    const lokal = lagLokal(samle([{ slug: "fiskvik", data: d }]));
    const n = await lokal.nettverk("9998");
    const sensitive = new Set(d.organisasjoner.filter((o) => o.sensitiv).map((o) => o.key));
    expect(n?.noder.filter((o) => sensitive.has(o.key))).toEqual([]);
    expect(n?.personer.map((p) => p.person.key)).toContain("per-fisker");
    expect((await lokal.kommune_oversikt("9998"))?.verifisering.verifisert).toBeGreaterThan(0);
  });

  it("gir byte-like filer når den kjøres igjen på de samme svarene", async () => {
    const andre = await kjorEn(true);
    expect(readFileSync(andre.r.datasettfil, "utf8")).toBe(filer["datasett"]);
    expect(readFileSync(andre.r.avviksfil, "utf8")).toBe(filer["avvik"]);
    // Mellomlageret svarte på alt unntatt feilen fra Regnskapsregisteret.
    expect(andre.kall).toEqual(["https://data.brreg.no/regnskapsregisteret/regnskap/999100002"]);
    // Og uten mellomlager, rett på svarene: samme resultat.
    const tredje = await kjorEn(false);
    expect(readFileSync(tredje.r.datasettfil, "utf8")).toBe(filer["datasett"]);
  });

  it("står urørt når det ikke er noe å importere, bortsett fra kildene", async () => {
    const grunnlag = JSON.parse(
      readFileSync(join(mappe, "datasett.json"), "utf8"),
    ) as Kommunedatasett;
    const ut = JSON.parse(filer["datasett"]!) as Kommunedatasett;
    // Hver grunnlagsrad som ikke ble bekreftet, står byte-lik og i samme rekkefølge.
    const urort = (xs: unknown[]) => xs.map((x) => JSON.stringify(x));
    const inn = urort(grunnlag.hendelser);
    expect(urort(ut.hendelser)).toEqual(inn);
    expect(ut.organisasjoner.slice(0, grunnlag.organisasjoner.length)).toEqual(
      grunnlag.organisasjoner,
    );
    expect(ut.relasjoner.slice(0, grunnlag.relasjoner.length)).toEqual(grunnlag.relasjoner);
    writeFileSync(join(tmp, "x.json"), serialiser(ut));
    expect(readFileSync(join(tmp, "x.json"), "utf8")).toBe(filer["datasett"]);
  });
});

// ---------------------------------------------------------------------------
// Flere kommuner: felles organer, felles personer og en ny kommune
// ---------------------------------------------------------------------------

describe("motsagte roller og ledere som ikke er registerroller (Fiskvik)", () => {
  // Grunnlaget endret slik et menneske ville gjort det etter første kjøring:
  // styrelederen registeret motsier, er merket motsagt; daglig leder var merket
  // motsagt, men registeret bekrefter henne nå. Tre ledere er en annen enn
  // registerets daglig leder: sorenskriveren i en domstol (organisasjonsledd,
  // ikke et avvik), kommunedirektøren (kommunens daglig leder etter loven, et
  // avvik) og en administrerende direktør i et AS (et avvik). Og en styreleder i
  // et organ som ikke har styret sitt i registeret.
  const mappe = join(FIKSTUR, "fiktiv");
  const konfig: Konfig = tolkKonfig({
    felles: { ...felles, sidestorrelse: 3 },
    kommuner: {
      "9998": {
        terskel_ansatte: 20,
        alltid: {
          fra_datasett: true,
          orgnr: [],
          navn: [{ navn: "Fiskvik fylkesting", organisasjonsform: "FYLK" }],
        },
      },
    },
  });
  let tmp: string;
  let r: KjorResultat;
  let d: Kommunedatasett;
  let rapport: string;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "maktkart-brreg-motsagt-"));
    const g = JSON.parse(readFileSync(join(mappe, "datasett.json"), "utf8")) as Kommunedatasett;
    const merk = (x: Kommunedatasett["roller"][number], hva: string) => ({
      ...x,
      motsagt: true,
      belegg: { ...x.belegg, merknad: `Motsagt av Brreg 24.09.2026: ${hva}` },
    });
    g.roller = g.roller.map((x) =>
      x.person === "olga-styrmann"
        ? merk(x, "registeret har en annen styreleder.")
        : x.person === "per-fisker"
          ? merk(x, "registeret hadde en annen daglig leder.")
          : x,
    );
    g.personer = g.personer.map((p) =>
      p.key === "kari-kommunesen"
        ? { ...p, navn: "Kari Annensen" }
        : p.key === "dina-dommer"
          ? { ...p, navn: "Dina Annen" }
          : p,
    );
    // En toppleder i et AS er registerets daglig leder etter aksjeloven.
    g.personer.push({ key: "tone-toppsen", navn: "Tone Toppsen" });
    g.roller.push({
      org: "fiskvik-havfiske",
      person: "tone-toppsen",
      tittel: "Administrerende direktør",
      rolletype: "toppleder",
      status: "fast",
      belegg: { kilde: "fiskvik-kommune-no", verifisering: "oppgitt", per: "2026-09" },
    });
    // Nordvik Kraft har bare daglig leder i registeret, ikke noe styre.
    g.personer.push({ key: "siv-styre", navn: "Siv Styre" });
    g.roller.push({
      org: "nordvik-kraft",
      person: "siv-styre",
      tittel: "Styreleder",
      rolletype: "styreleder",
      status: "fast",
      belegg: { kilde: "testgrunnlag", verifisering: "maa_verifiseres", per: "2026-09" },
    });
    mkdirSync(join(tmp, "data"), { recursive: true });
    writeFileSync(join(tmp, "data", "fiskvik.json"), serialiser(g));
    [r] = (await kjor({
      kommunenr: ["9998"],
      dataMappe: join(tmp, "data"),
      avvikMappe: join(tmp, "avvik"),
      http: fiksturHttp(mappe).http,
      mellomlager: null,
      salt: SALT,
      idag: IDAG,
      konfig,
      tabeller,
      skriv: true,
      logg: () => {},
    })) as [KjorResultat];
    d = JSON.parse(readFileSync(r.datasettfil, "utf8")) as Kommunedatasett;
    rapport = readFileSync(r.avviksfil, "utf8");
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const rad = (org: string, person: string) =>
    d.roller.find((x) => x.org === org && x.person === person)!;

  it("lar en motsagt rad stå som motsagt, og sier det i rapporten", () => {
    const olga = rad("fiskvik-havfiske", "olga-styrmann");
    expect(olga.motsagt).toBe(true);
    expect(olga.belegg.verifisering).toBe("maa_verifiseres");
    expect(rapport).toMatch(
      /fiskvik-havfiske: styreleder \| Olga Styrmann[^|]*\| Styreleder: Line Lederberg\.[^|]*\| Merket motsagt i datasettet/,
    );
  });

  it("tar bort merket når registeret bekrefter en rad som var motsagt", () => {
    const per = rad("fiskvik-havfiske", "per-fisker");
    expect(per).not.toHaveProperty("motsagt");
    expect(per.belegg).toMatchObject({ kilde: "brreg-roller", verifisering: "verifisert" });
    expect(per.belegg.merknad).toMatch(new RegExp(`^${BEKREFTER}.*Var merket motsagt`));
  });

  it("kaller ikke en rolle registeret ikke fører for et avvik", () => {
    // Sorenskriveren i en domstol (organisasjonsledd) er ikke en registerrolle:
    // en annen daglig leder motsier henne ikke.
    const dina = rad("fiskvik-tingrett", "dina-dommer");
    expect(dina.belegg.verifisering).toBe("oppgitt");
    expect(dina).not.toHaveProperty("motsagt");
    // Et organ uten styre i registeret motsier ikke en styreleder.
    expect(rad("nordvik-kraft", "siv-styre").belegg.verifisering).toBe("maa_verifiseres");
    const del = (tittel: string) => rapport.split(`## ${tittel}`)[1]!.split("\n## ")[0]!;
    const ikke = del("Roller registeret ikke fører (ikke avvik) (2)");
    expect(ikke).toMatch(
      /fiskvik-tingrett: sorenskriver \| Dina Annen \(dina-dommer\).*Ikke et avvik.*Begge står/,
    );
    expect(ikke).toMatch(/nordvik-kraft: styreleder \| Siv Styre.*registeret fører ikke styret/);
    expect(ikke).not.toContain("fiskvik-administrasjonen");
    expect(ikke).not.toContain("Tone Toppsen");
    const motsagt = del("Roller der registeret sier noe annet");
    expect(motsagt).not.toContain("fiskvik-tingrett");
    expect(motsagt).not.toContain("nordvik-kraft");
    // I en kommune og i et AS er topplederen registerets daglig leder etter
    // loven. En annen daglig leder der er et avvik, ikke en rolle registeret
    // ikke fører.
    expect(motsagt).toMatch(
      /fiskvik-kommune: daglig leder \| Kari Annensen \(kari-kommunesen\), «Kommunedirektør»[^|]*\| Daglig leder: Kari Anne Kommunesen\./,
    );
    expect(motsagt).toMatch(
      /fiskvik-havfiske: daglig leder \| Tone Toppsen \(tone-toppsen\), «Administrerende direktør»[^|]*\| Daglig leder: Per Fisker\./,
    );
    expect(rad("fiskvik-administrasjonen", "kari-kommunesen").belegg.verifisering).toBe("oppgitt");
    expect(rad("fiskvik-havfiske", "tone-toppsen").belegg.verifisering).toBe("oppgitt");
    const o = r.resultat.oppsummering;
    expect(o.motsagt.roller).toBe(r.resultat.avvik.filter((a) => a.kategori === "roller").length);
    expect(o.avvik).toBe(
      r.resultat.avvik.filter((a) => a.kategori !== "ikke_registerrolle").length,
    );
  });

  it("gir et gyldig datasett", () => {
    expect(valider(samle([{ slug: "fiskvik", data: d }]))).toEqual([]);
    expect(regelbrudd(d)).toEqual([]);
  });
});

describe("flere kommuner (Fiskvik og Testnes)", () => {
  const mappe = join(FIKSTUR, "fiktiv");
  const konfig: Konfig = tolkKonfig({
    felles: { ...felles, sidestorrelse: 3 },
    kommuner: {
      "9998": {
        terskel_ansatte: 20,
        alltid: {
          fra_datasett: true,
          orgnr: [],
          navn: [{ navn: "Fiskvik fylkesting", organisasjonsform: "FYLK" }],
        },
      },
    },
  });
  const kjorI = async (tmp: string, kommunenr: string[]) =>
    kjor({
      kommunenr,
      dataMappe: join(tmp, "data"),
      avvikMappe: join(tmp, "avvik"),
      http: fiksturHttp(mappe).http,
      mellomlager: join(tmp, "lager"),
      regionfil: join(mappe, "region.json"),
      salt: SALT,
      idag: IDAG,
      konfig,
      tabeller,
      skriv: true,
      logg: () => {},
    });
  const les = (tmp: string, slug: string) =>
    JSON.parse(readFileSync(join(tmp, "data", `${slug}.json`), "utf8")) as Kommunedatasett;
  const ny = () => {
    const tmp = mkdtempSync(join(tmpdir(), "maktkart-brreg-flere-"));
    cpSync(join(mappe, "datasett.json"), join(tmp, "data", "fiskvik.json"));
    return tmp;
  };
  const tmper: string[] = [];
  afterAll(() => {
    for (const t of tmper) rmSync(t, { recursive: true, force: true });
  });

  it("lager et nytt datasett med slug og navn fra regionregisteret, kommunen og kommunestyret", async () => {
    const tmp = ny();
    tmper.push(tmp);
    await kjorI(tmp, ["9998", "9997"]);
    const t = les(tmp, "testnes");
    expect(t.meta).toMatchObject({
      kommunenr: "9997",
      kommune: "Testnes - Deatnu",
      fylkesnr: "99",
      fylke: "Fiktivfylket",
    });
    const kommune = t.organisasjoner.find((o) => o.organtype === "kommune")!;
    expect(kommune).toMatchObject({ orgnr: "999700001", kommunenr: "9997" });
    expect(t.organisasjoner.find((o) => o.key === "testnes-kommunestyre")?.overordnet).toBe(
      kommune.key,
    );
    expect(regelbrudd(t)).toEqual([]);
    const lokal = lagLokal(
      samle([
        { slug: "fiskvik", data: les(tmp, "fiskvik") },
        { slug: "testnes", data: t },
      ]),
    );
    const o = await lokal.kommune_oversikt("9997");
    expect(o?.kommuneorgan).not.toBeNull();
    expect(o?.kommunestyre).not.toBeNull();
  });

  it("gir felles organer én kanonisk rad og roller bare hos kommunen organet ligger i", async () => {
    const tmp = ny();
    tmper.push(tmp);
    await kjorI(tmp, ["9998", "9997"]);
    const f = les(tmp, "fiskvik");
    const t = les(tmp, "testnes");
    expect(
      valider(
        samle([
          { slug: "fiskvik", data: f },
          { slug: "testnes", data: t },
        ]),
      ),
    ).toEqual([]);
    expect(regelbrudd(f)).toEqual([]);
    for (const orgnr of ["999400002", "999400001"]) {
      const a = f.organisasjoner.find((o) => o.orgnr === orgnr);
      const b = t.organisasjoner.find((o) => o.orgnr === orgnr);
      expect(a, orgnr).toBeDefined();
      expect(a).toEqual(b);
    }
    const politi = t.organisasjoner.find((o) => o.orgnr === "999400002")!;
    expect(politi.belegg.merknad).toBe("Utvalg: ansatte>=50, topp10-ansatte.");
    expect(t.roller.filter((r) => r.org === politi.key).map((r) => r.rolletype)).toEqual([
      "toppleder",
    ]);
    expect(f.roller.filter((r) => r.org === politi.key)).toEqual([]);
    // Samme person i begge kommunene: samme nøkkel og samme rad.
    expect(t.roller.find((r) => r.person === "per-fisker")?.rolletype).toBe("styremedlem");
    expect(t.personer.find((p) => p.key === "per-fisker")).toEqual(
      f.personer.find((p) => p.key === "per-fisker"),
    );
  });

  it("holder felles organer like når kommunene kjøres hver for seg, i hvilken som helst rekkefølge", async () => {
    const tmp = ny();
    tmper.push(tmp);
    await kjorI(tmp, ["9998"]);
    const forst = les(tmp, "fiskvik").organisasjoner.find((o) => o.orgnr === "999400002")!;
    expect(forst.belegg.merknad).toBe("Utvalg: overordnet.");
    await kjorI(tmp, ["9997"]);
    const f = les(tmp, "fiskvik");
    const t = les(tmp, "testnes");
    expect(
      valider(
        samle([
          { slug: "fiskvik", data: f },
          { slug: "testnes", data: t },
        ]),
      ),
    ).toEqual([]);
    // Testnes eier politidistriktet og har skrevet den kanoniske raden inn i Fiskvik.
    expect(f.organisasjoner.find((o) => o.orgnr === "999400002")).toEqual(
      t.organisasjoner.find((o) => o.orgnr === "999400002"),
    );
    const fFor = readFileSync(join(tmp, "data", "fiskvik.json"), "utf8");
    await kjorI(tmp, ["9998"]);
    expect(readFileSync(join(tmp, "data", "fiskvik.json"), "utf8")).toBe(fFor);
  });

  it("gir byte-like filer når flere kommuner kjøres igjen på de samme svarene", async () => {
    const tmp = ny();
    tmper.push(tmp);
    await kjorI(tmp, ["9998", "9997"]);
    const filer = ["fiskvik", "testnes"].map((s) =>
      readFileSync(join(tmp, "data", `${s}.json`), "utf8"),
    );
    const avvik = readdirSync(join(tmp, "avvik")).map((f) =>
      readFileSync(join(tmp, "avvik", f), "utf8"),
    );
    await kjorI(tmp, ["9997", "9998"]);
    expect(
      ["fiskvik", "testnes"].map((s) => readFileSync(join(tmp, "data", `${s}.json`), "utf8")),
    ).toEqual(filer);
    expect(
      readdirSync(join(tmp, "avvik")).map((f) => readFileSync(join(tmp, "avvik", f), "utf8")),
    ).toEqual(avvik);
    for (const dato of fodselsdatoer(mappe))
      for (const t of [...filer, ...avvik]) expect(t).not.toContain(dato);
  });
});

// ---------------------------------------------------------------------------
// Eierskap: hvem fører rollene og regnskapet for et organ som står i flere
// kommuner. Austvik (9995) har grunnlag; Vestvik (9994) har ikke datasett.
// Alle de delte organene ligger i Vestvik:
//
// - Regionhelse RHF: grunnlag i Austvik uten orgnr (koblet på navn), og i
//   Vestviks eget utvalg. Som Helse Nord RHF i Tromsø og Bodø.
// - Fjellkraft AS: alltid med i Austvik, men for lite til å være kandidat i
//   Vestvik. Som Nordkraft AS i Tromsø og Narvik.
// - Kystbanken: alltid med i Austvik og i Vestviks eget utvalg.
// - Vestvik kommune: Vestviks egen enhet, og grunnlag i Austvik uten orgnr.
//   Som Karlsøy kommune.
// ---------------------------------------------------------------------------

describe("eierskap på tvers av kommuner (Austvik og Vestvik)", () => {
  const mappe = join(FIKSTUR, "eierskap");
  const konfig: Konfig = tolkKonfig({
    felles: { ...felles, sidestorrelse: 50 },
    kommuner: {
      "9995": { alltid: { fra_datasett: true, orgnr: ["999940003", "999940004"], navn: [] } },
    },
  });
  const tmper: string[] = [];
  afterAll(() => {
    for (const t of tmper) rmSync(t, { recursive: true, force: true });
  });
  const ny = () => {
    const tmp = mkdtempSync(join(tmpdir(), "maktkart-brreg-eierskap-"));
    tmper.push(tmp);
    cpSync(join(mappe, "datasett.json"), join(tmp, "data", "austvik.json"));
    return tmp;
  };
  const kjorI = (tmp: string, kommunenr: string[]) =>
    kjor({
      kommunenr,
      dataMappe: join(tmp, "data"),
      avvikMappe: join(tmp, "avvik"),
      http: fiksturHttp(mappe).http,
      mellomlager: join(tmp, "lager"),
      regionfil: join(mappe, "region.json"),
      salt: SALT,
      idag: IDAG,
      konfig,
      tabeller,
      skriv: true,
      logg: () => {},
    });
  const datasett = (tmp: string) =>
    readdirSync(join(tmp, "data"))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => ({
        slug: f.slice(0, -5),
        data: JSON.parse(readFileSync(join(tmp, "data", f), "utf8")) as Kommunedatasett,
      }));
  const filer = (tmp: string) =>
    Object.fromEntries(
      readdirSync(join(tmp, "data"))
        .sort()
        .map((f) => [f, readFileSync(join(tmp, "data", f), "utf8")]),
    );
  /** Grunnlaget kobler disse på navn; ellers er orgnr på raden identiteten. */
  const PAA_NAVN: Record<string, string> = {
    "regionhelse-rhf": "999940002",
    "vestvik-kommune": "999940001",
  };
  const identitet = (d: Kommunedatasett, key: string) =>
    d.organisasjoner.find((o) => o.key === key)?.orgnr ?? PAA_NAVN[key] ?? key;

  /**
   * Hver rolle fra registeret (bekreftet eller importert) i alle datasettene:
   * organets identitet, personens navn og rolletypen, med fila den står i.
   */
  const registerroller = (tmp: string) => {
    const ut: { rolle: string; fil: string; org: string }[] = [];
    for (const { slug, data } of datasett(tmp)) {
      const navn = new Map(data.personer.map((p) => [p.key, p.navn]));
      for (const r of data.roller) {
        if (r.belegg.kilde !== "brreg-roller") continue;
        ut.push({
          rolle: `${identitet(data, r.org)}|${navn.get(r.person)}|${r.rolletype}|${r.status}`,
          fil: slug,
          org: r.org,
        });
      }
    }
    return ut.sort((a, b) => (a.rolle < b.rolle ? -1 : a.rolle > b.rolle ? 1 : 0));
  };
  const registertall = (tmp: string) =>
    datasett(tmp).flatMap(({ slug, data }) =>
      data.nokkeltall
        .filter((n) => n.belegg.kilde === "regnskapsregisteret")
        .map((n) => `${identitet(data, n.org)}|${n.aar}|${n.type}|${slug}`),
    );

  const FORVENTET = [
    "999940001|Viggo Vestmann|daglig_leder|fast",
    "999940002|Dag Direktør|daglig_leder|fast",
    "999940002|Mats Medlem|styremedlem|fast",
    "999940002|Mona Medlem|styremedlem|fast",
    "999940002|Stine Styre|styreleder|fast",
    "999940002|Vera Vara|varamedlem|vara",
    "999940003|Frida Foss|styremedlem|fast",
    "999940003|Kari Kraft|daglig_leder|fast",
    "999940003|Leif Leder|styreleder|fast",
    "999940004|Bent Bank|daglig_leder|fast",
    "999940004|Siri Sparer|styreleder|fast",
    "999950001|Anne Austmann|daglig_leder|fast",
  ];

  it("fører rollene og regnskapet for hvert organ nøyaktig én gang når begge kommunene er med", async () => {
    const tmp = ny();
    await kjorI(tmp, ["9995", "9994"]);
    const alle = datasett(tmp);
    expect(valider(samle(alle))).toEqual([]);
    for (const { data } of alle) expect(regelbrudd(data)).toEqual([]);
    const roller = registerroller(tmp);
    expect(roller.map((r) => r.rolle)).toEqual(FORVENTET);
    // Fjellkraft ligger i Vestvik, men er bare i Austviks utvalg: Austvik fører det.
    expect(roller.filter((r) => r.rolle.startsWith("999940003|")).map((r) => r.fil)).toEqual([
      "austvik",
      "austvik",
      "austvik",
    ]);
    expect(registertall(tmp).sort()).toEqual([
      "999940003|2025|aarsresultat|austvik",
      "999940003|2025|driftsresultat|austvik",
      "999940003|2025|egenkapital|austvik",
      "999940003|2025|omsetning|austvik",
    ]);
    // Kystbanken er i begge utvalgene: kommunen den ligger i, fører den.
    expect(
      new Set(roller.filter((r) => r.rolle.startsWith("999940004|")).map((r) => r.fil)),
    ).toEqual(new Set(["vestvik"]));
    // Regionhelse er grunnlag i Austvik: Austvik bekrefter styrelederen og fører resten.
    expect(
      new Set(roller.filter((r) => r.rolle.startsWith("999940002|")).map((r) => r.org)),
    ).toEqual(new Set(["regionhelse-rhf"]));
    expect(
      new Set(roller.filter((r) => r.rolle.startsWith("999940002|")).map((r) => r.fil)),
    ).toEqual(new Set(["austvik"]));
  });

  it("gir et grunnlagsorgan koblet på navn samme nøkkel i kommunen det ligger i", async () => {
    const tmp = ny();
    await kjorI(tmp, ["9995", "9994"]);
    const a = datasett(tmp).find((d) => d.slug === "austvik")!.data;
    const v = datasett(tmp).find((d) => d.slug === "vestvik")!.data;
    // Ingen egen rad for Regionhelse i Vestvik: grunnlagets rad, kopiert likt.
    for (const { data } of datasett(tmp))
      expect(data.organisasjoner.filter((o) => o.orgnr === "999940002")).toEqual([]);
    expect(v.organisasjoner.find((o) => o.key === "regionhelse-rhf")).toEqual(
      a.organisasjoner.find((o) => o.key === "regionhelse-rhf"),
    );
    // Vestviks egen kommune beholder sin nøkkel, for kommunestyret viser til den.
    const kommunen = v.organisasjoner.find((o) => o.orgnr === "999940001")!;
    expect(kommunen.kommunenr).toBe("9994");
    expect(v.organisasjoner.find((o) => o.key === "vestvik-kommunestyre")?.overordnet).toBe(
      kommunen.key,
    );
    const o = await lagLokal(samle(datasett(tmp))).kommune_oversikt("9994");
    expect(o?.kommuneorgan?.key).toBe(kommunen.key);
  });

  it("gir samme rollesett når Austvik kjøres alene som når begge kjøres sammen", async () => {
    const alene = ny();
    await kjorI(alene, ["9995"]);
    const sammen = ny();
    await kjorI(sammen, ["9995", "9994"]);
    const sett = (tmp: string) => registerroller(tmp).map((r) => r.rolle);
    // Alene fører Austvik alt i sitt utvalg; sammen fører Vestvik Kystbanken.
    // Rollene er de samme, og hver står én gang.
    expect(sett(alene)).toEqual(FORVENTET);
    expect(sett(sammen)).toEqual(FORVENTET);
    expect(registertall(alene).sort()).toEqual(registertall(sammen).sort());
  });

  it("står stille når kommunene kjøres hver for seg etterpå, i hvilken som helst rekkefølge", async () => {
    const tmp = ny();
    await kjorI(tmp, ["9995", "9994"]);
    const etter = filer(tmp);
    await kjorI(tmp, ["9995"]);
    expect(filer(tmp)).toEqual(etter);
    await kjorI(tmp, ["9994"]);
    expect(filer(tmp)).toEqual(etter);
    await kjorI(tmp, ["9994", "9995"]);
    expect(filer(tmp)).toEqual(etter);
  });

  it("ender likt når Vestvik kjøres først, alene, før Austvik har vært kjørt", async () => {
    const sammen = ny();
    await kjorI(sammen, ["9995", "9994"]);
    const tmp = ny();
    await kjorI(tmp, ["9994"]);
    await kjorI(tmp, ["9995"]);
    // Hvert organ har rollene sine nøyaktig én gang underveis ...
    expect(registerroller(tmp).map((r) => r.rolle)).toEqual(FORVENTET);
    await kjorI(tmp, ["9994"]);
    // ... og etter en runde til er datasettene de samme som når begge kjøres
    // sammen. Unntaket er segmentlista: en segmentdefinisjon importøren la til
    // for Vestviks første, egne rad for Regionhelse, blir stående, fordi den
    // ikke kan skilles fra grunnlagets egne definisjoner.
    const utenSegmenter = (t: string) =>
      datasett(t).map(({ slug, data }) => ({ slug, data: { ...data, segmenter: [] } }));
    expect(utenSegmenter(tmp)).toEqual(utenSegmenter(sammen));
    expect(registerroller(tmp)).toEqual(registerroller(sammen));
  });
});

// ---------------------------------------------------------------------------
// Tromsø: grunnlagets egne påstander mot syntetiske svar for to orgnr
// ---------------------------------------------------------------------------

describe("Tromsø (ekte grunnlag, syntetiske svar)", () => {
  const mappe = join(FIKSTUR, "tromso");
  const konfig: Konfig = tolkKonfig({
    felles,
    kommuner: {
      "5501": {
        terskel_ansatte: 20,
        navnesok_for_grunnlaget: false,
        alltid: { fra_datasett: false, orgnr: ["940101808", "979468792"], navn: [] },
      },
    },
  });
  let tmp: string;
  let d: Kommunedatasett;
  let rapport: string;
  let foer: Kommunedatasett;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "maktkart-brreg-tromso-"));
    cpSync(join(__dirname, "..", "src", "data", "tromso.json"), join(tmp, "data", "tromso.json"));
    foer = JSON.parse(readFileSync(join(tmp, "data", "tromso.json"), "utf8")) as Kommunedatasett;
    const [r] = await kjor({
      kommunenr: ["5501"],
      dataMappe: join(tmp, "data"),
      avvikMappe: join(tmp, "avvik"),
      http: fiksturHttp(mappe).http,
      mellomlager: null,
      salt: SALT,
      idag: IDAG,
      konfig,
      tabeller,
      skriv: true,
      logg: () => {},
    });
    d = JSON.parse(readFileSync(r!.datasettfil, "utf8")) as Kommunedatasett;
    rapport = readFileSync(r!.avviksfil, "utf8");
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const rolle = (org: string, person: string) =>
    d.roller.find((r) => r.org === org && r.person === person);

  it("bekrefter daglig leder og styreleder i Troms Kraft og kommunedirektøren", () => {
    for (const [org, person] of [
      ["troms-kraft", "erling-andreas-dalberg"],
      ["troms-kraft", "aslaug-haga"],
      ["tromso-kommune-administrasjonen", "ellen-beate-lundberg"],
    ] as const) {
      expect(rolle(org, person)?.belegg, `${org}/${person}`).toMatchObject({
        verifisering: "verifisert",
        per: IDAG,
        kilde: "brreg-roller",
      });
    }
    // Rollen som er avsluttet i grunnlaget, røres ikke.
    const avsluttet = d.roller.find(
      (r) => r.org === "troms-kraft" && r.person === "inge-k-hansen",
    )!;
    expect(avsluttet).toEqual(
      foer.roller.find((r) => r.org === "troms-kraft" && r.person === "inge-k-hansen"),
    );
  });

  it("melder nestlederen som avvik når registeret har henne som styremedlem", () => {
    expect(rolle("troms-kraft", "kathrine-tveiteras")?.belegg.verifisering).not.toBe("verifisert");
    expect(rapport).toMatch(
      /troms-kraft: nestleder \| Kathrine Tveiterås .*Ingen nestleder registrert\. Kathrine Tveiterås står som styremedlem/,
    );
    // Og styremedlemsrollen fra registeret er lagt til på samme person.
    expect(d.roller).toContainEqual(
      expect.objectContaining({
        org: "troms-kraft",
        person: "kathrine-tveiteras",
        rolletype: "styremedlem",
      }),
    );
  });

  it("bekrefter egenkapitalen og lar konserntallet stå", () => {
    const ek = d.nokkeltall.find(
      (n) => n.org === "troms-kraft" && n.type === "egenkapital" && n.aar === 2025,
    )!;
    expect(ek.belegg.verifisering).toBe("verifisert");
    const konsern = d.nokkeltall.find(
      (n) => n.org === "troms-kraft" && n.type === "aarsresultat" && n.konsern === true,
    )!;
    expect(konsern.belegg.verifisering).toBe("maa_verifiseres");
  });

  it("er fortsatt gyldig etter samle.ts og datasett-reglene", () => {
    expect(valider(samle([{ slug: "tromso", data: d }]))).toEqual([]);
    expect(regelbrudd(d)).toEqual([]);
    for (const dato of fodselsdatoer(mappe))
      expect(JSON.stringify(d) + rapport).not.toContain(dato);
  });
});
