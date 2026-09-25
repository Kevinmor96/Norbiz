// Hente-laget: HTTP mot Brreg, mellomlager og normalisering til et øyeblikksbilde.
//
// Endepunktene er de samme som i arkiv/bransjesjekk/supabase/functions/import-brreg,
// som kjørte mot Brreg i produksjon, og feltnavnene er holdt mot det levende
// API-et 2026-09-25:
//
//   Enhetsregisteret     https://data.brreg.no/enhetsregisteret/api/enheter
//                        https://data.brreg.no/enhetsregisteret/api/underenheter
//   Roller               https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}/roller
//   Regnskapsregisteret  https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
//
// Regnskapsstien har IKKE /api/ i seg. Med /api/ svarer Brreg 200 med HTML.
//
// Personvern: rolle-API-et gir fødselsdato. Den hashes her, sammen med navnet,
// til en personnøkkel (`pid`) og kastes. Mellomlageret, øyeblikksbildet,
// datasettet, loggen og avviksrapporten ser aldri datoen. Adresser kastes på
// samme sted; bare kommunenummeret beholdes.
//
// HTTP-laget er injiserbart (`Http`), så testene aldri går mot nettet.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { navneord, orgNavnNokkel, pentPersonNavn, personHash } from "./tekst";

export const BRREG = {
  enheter: "https://data.brreg.no/enhetsregisteret/api/enheter",
  underenheter: "https://data.brreg.no/enhetsregisteret/api/underenheter",
  regnskap: "https://data.brreg.no/regnskapsregisteret/regnskap",
} as const;

/** Brreg dokumenterer maks dybde 10 000 treff per søk. */
export const MAKS_DYBDE = 10_000;

/** Rollene Maktkart tar inn. Resten (revisor, regnskapsfører, kontaktperson …) hentes ikke. */
export const ROLLEKODER = ["DAGL", "LEDE", "NEST", "MEDL", "VARA"] as const;
export type Rollekode = (typeof ROLLEKODER)[number];

export interface HttpSvar {
  status: number;
  tekst: string;
}
export type Http = (url: string) => Promise<HttpSvar>;

// ---------------------------------------------------------------------------
// Normaliserte former. Dette er alt importøren får se.
// ---------------------------------------------------------------------------

export interface Naering {
  kode: string;
  tittel: string;
}

export interface Enhet {
  orgnr: string;
  navn: string;
  orgform: string;
  orgformNavn: string | null;
  naering: Naering[];
  ansatte: number | null;
  /** Forretningsadressens kommunenummer. Resten av adressen kastes. */
  kommunenr: string | null;
  /** `overordnetEnhet`, for offentlige enheter i et hierarki. */
  overordnet: string | null;
  sektor: string | null;
  stiftet: string | null;
  slettet: string | null;
  konkurs: boolean;
  underAvvikling: boolean;
}

export interface Underenhet {
  orgnr: string;
  navn: string;
  naering: Naering[];
  ansatte: number | null;
  /** Beliggenhetsadressens kommunenummer. */
  kommunenr: string | null;
  overordnet: string | null;
  oppstart: string | null;
  nedlagt: string | null;
}

export interface Rolle {
  kode: Rollekode;
  /** Personen, med `pid` i stedet for fødselsdato. */
  person: { pid: string; navn: string; doed: boolean } | null;
  /** En enhet som har rollen (styreplass eid av en organisasjon). */
  enhet: { orgnr: string; navn: string; slettet: boolean } | null;
  fratradt: boolean;
  avregistrert: boolean;
  /** `valgtAv.kode`, f.eks. AREP for styremedlemmer valgt av de ansatte. */
  valgtAv: string | null;
}

export interface Regnskap {
  type: "SELSKAP" | "KONSERN";
  fra: string | null;
  til: string;
  valuta: string;
  morselskap: boolean | null;
  omsetning: number | null;
  driftsresultat: number | null;
  aarsresultat: number | null;
  egenkapital: number | null;
}

/** Alt som ble hentet for én kommune. Fødselsdatoer og adresser finnes ikke her. */
export interface Oyeblikksbilde {
  kommunenr: string;
  /** Hentedatoen, YYYY-MM-DD. Blir `per` på hver påstand. */
  hentet: string;
  terskel: number;
  terskelUnderenheter: number;
  /** Hver enhet som ble hentet, uansett hvorfor. */
  enheter: Record<string, Enhet>;
  /** Orgnr fra søket på kommunen, etter kontrollen av kommune og terskel. */
  iKommunen: string[];
  /** Orgnr som alltid tas med: fra datasettet, fra konfigurasjonen og fra navneoppslag. */
  alltid: string[];
  /** Underenheter i kommunen over terskelen, før sjekken av hvor forelderen ligger. */
  underenheter: Underenhet[];
  /** Per orgnr. Mangler nøkkelen, ble rollene ikke hentet. */
  roller: Record<string, Rolle[]>;
  /** Per orgnr. Mangler nøkkelen, ble regnskapet ikke hentet eller var utilgjengelig. */
  regnskap: Record<string, Regnskap[]>;
  /** Orgnr Brreg ikke kjente (404) eller som var slettet (410). */
  ikkeFunnet: { orgnr: string; status: number }[];
  /** Regnskap Brreg ikke kunne levere (5xx etter nye forsøk). */
  regnskapUtilgjengelig: string[];
  /** Navneoppslag uten entydig treff. `grunnlag` er true for grunnlagets egne organer. */
  navneoppslag: { navn: string; treff: number; grunnlag: boolean }[];
  forkastet: {
    feilKommune: number;
    underTerskel: number;
    underenhetFeilKommune: number;
    underenhetUnderTerskel: number;
    andreRoller: number;
  };
}

// ---------------------------------------------------------------------------
// JSON-hjelpere. Brreg-svaret er `unknown` til det er lest felt for felt.
// ---------------------------------------------------------------------------

type J = Record<string, unknown>;
const obj = (v: unknown): J | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as J) : null;
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const tekst = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const tall = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const helt = (v: unknown): number | null => {
  const t = tall(v);
  return t === null ? null : Math.round(t);
};

function naeringer(e: J): Naering[] {
  return ["naeringskode1", "naeringskode2", "naeringskode3"].flatMap((f) => {
    const n = obj(e[f]);
    const kode = tekst(n?.["kode"]);
    return kode ? [{ kode, tittel: tekst(n?.["beskrivelse"]) ?? "" }] : [];
  });
}

export function lesEnhet(e: J): Enhet {
  const form = obj(e["organisasjonsform"]);
  const sektor = obj(e["institusjonellSektorkode"]);
  return {
    orgnr: String(e["organisasjonsnummer"] ?? ""),
    navn: tekst(e["navn"]) ?? "",
    orgform: tekst(form?.["kode"]) ?? "UKJENT",
    orgformNavn: tekst(form?.["beskrivelse"]),
    naering: naeringer(e),
    ansatte: tall(e["antallAnsatte"]),
    kommunenr: tekst(obj(e["forretningsadresse"])?.["kommunenummer"]),
    overordnet: tekst(e["overordnetEnhet"]),
    sektor: tekst(sektor?.["kode"]),
    stiftet: tekst(e["stiftelsesdato"]),
    slettet: tekst(e["slettedato"]),
    konkurs: e["konkurs"] === true,
    underAvvikling:
      e["underAvvikling"] === true || e["underTvangsavviklingEllerTvangsopplosning"] === true,
  };
}

export function lesUnderenhet(u: J): Underenhet {
  return {
    orgnr: String(u["organisasjonsnummer"] ?? ""),
    navn: tekst(u["navn"]) ?? "",
    naering: naeringer(u),
    ansatte: tall(u["antallAnsatte"]),
    kommunenr: tekst(obj(u["beliggenhetsadresse"])?.["kommunenummer"]),
    overordnet: tekst(u["overordnetEnhet"]),
    oppstart: tekst(u["oppstartsdato"]),
    nedlagt: tekst(u["nedleggelsesdato"]) ?? tekst(u["slettedato"]),
  };
}

/**
 * Rollene fra `/enheter/{orgnr}/roller`, med fødselsdatoen byttet mot `pid`.
 * Har personen ingen fødselsdato, får hun en pid som er unik for rollen, så
 * to navnebrødre uten dato aldri slås sammen.
 */
export function lesRoller(
  j: J,
  orgnr: string,
  salt: string,
): { roller: Rolle[]; andre: number } {
  const ut: Rolle[] = [];
  let andre = 0;
  for (const gruppe of liste(j["rollegrupper"])) {
    // Et vasket svar har tatt bort de andre rollene og telt dem her.
    andre += tall(obj(gruppe)?.["forkastet"]) ?? 0;
    liste(obj(gruppe)?.["roller"]).forEach((r0, i0) => {
      const r = obj(r0);
      if (!r) return;
      const i = tall(r["indeks"]) ?? i0;
      const kode = tekst(obj(r["type"])?.["kode"]);
      if (!kode || !(ROLLEKODER as readonly string[]).includes(kode)) {
        andre++;
        return;
      }
      const p = obj(r["person"]);
      const e = obj(r["enhet"]);
      let person: Rolle["person"] = null;
      if (p) {
        const n = obj(p["navn"]);
        const navn = pentPersonNavn([
          tekst(n?.["fornavn"]),
          tekst(n?.["mellomnavn"]),
          tekst(n?.["etternavn"]),
        ]);
        const fodt = tekst(p["fodselsdato"]);
        // Et mellomlagret svar har allerede pid i stedet for fødselsdato.
        const pid =
          tekst(p["pid"]) ??
          personHash(salt, navn, fodt ?? `ukjent|${orgnr}|${kode}|${i}|${navneord(navn).join(" ")}`);
        person = { pid, navn, doed: p["erDoed"] === true };
      }
      let enhet: Rolle["enhet"] = null;
      if (e) {
        const n = e["navn"];
        enhet = {
          orgnr: String(e["organisasjonsnummer"] ?? ""),
          navn: Array.isArray(n) ? n.filter((x) => typeof x === "string").join(" ") : (tekst(n) ?? ""),
          slettet: e["erSlettet"] === true,
        };
      }
      if (!person && !enhet) return;
      ut.push({
        kode: kode as Rollekode,
        person,
        enhet,
        fratradt: r["fratraadt"] === true,
        avregistrert: r["avregistrert"] === true,
        valgtAv: tekst(obj(r["valgtAv"])?.["kode"]),
      });
    });
  }
  return { roller: ut, andre };
}

export function lesRegnskap(arr: unknown): Regnskap[] {
  const ut: Regnskap[] = [];
  for (const x0 of liste(arr)) {
    const x = obj(x0);
    if (!x) continue;
    const periode = obj(x["regnskapsperiode"]);
    const til = tekst(periode?.["tilDato"]);
    if (!til) continue; // Et tall uten år tas ikke inn.
    const res = obj(x["resultatregnskapResultat"]);
    const drift = obj(res?.["driftsresultat"]);
    const ek = obj(obj(x["egenkapitalGjeld"])?.["egenkapital"]);
    const morselskap = obj(x["virksomhet"])?.["morselskap"];
    ut.push({
      type: x["regnskapstype"] === "KONSERN" ? "KONSERN" : "SELSKAP",
      fra: tekst(periode?.["fraDato"]),
      til,
      valuta: tekst(x["valuta"]) ?? "NOK",
      morselskap: typeof morselskap === "boolean" ? morselskap : null,
      omsetning: helt(obj(drift?.["driftsinntekter"])?.["sumDriftsinntekter"]),
      driftsresultat: helt(drift?.["driftsresultat"]),
      aarsresultat: helt(res?.["aarsresultat"]),
      egenkapital: helt(ek?.["sumEgenkapital"]),
    });
  }
  return ut;
}

// ---------------------------------------------------------------------------
// Vasking før mellomlagring: det som skrives til disk, har ingen fødselsdato
// og ingen adresse.
// ---------------------------------------------------------------------------

function vaskAdresse(a: unknown): unknown {
  const o = obj(a);
  return o ? { kommunenummer: o["kommunenummer"] ?? null } : a;
}

function vaskEnhetslik(e: J): J {
  const ut: J = { ...e };
  // Adresser, kontaktdata, tidligere navn (et ENK bærer innehaverens navn) og
  // fritekst om aktivitet og formål trengs ikke og lagres ikke.
  for (const f of [
    "postadresse",
    "historiskeNavn",
    "telefon",
    "mobil",
    "epostadresse",
    "aktivitet",
    "vedtektsfestetFormaal",
    "paategninger",
  ])
    delete ut[f];
  for (const f of ["forretningsadresse", "beliggenhetsadresse"])
    if (f in ut) ut[f] = vaskAdresse(ut[f]);
  return ut;
}

/**
 * Tar bort fødselsdato og adresser fra et Brreg-svar. Rollesvar får `pid` per
 * person. Svaret som returneres, er det samme som lagres, så en kjøring fra
 * mellomlageret og en kjøring mot nettet ser nøyaktig det samme.
 */
export function vaskSvar(url: string, tekstSvar: string, salt: string): string {
  let j: unknown;
  try {
    j = JSON.parse(tekstSvar);
  } catch {
    return tekstSvar;
  }
  const orgnr = /\/enheter\/(\d{9})\/roller/.exec(url)?.[1];
  if (orgnr) {
    const o = obj(j);
    for (const gruppe of liste(o?.["rollegrupper"])) {
      const g = obj(gruppe);
      if (!g) continue;
      // Bare rollene Maktkart bruker, lagres. Kontaktpersoner, innehavere og
      // andre persondata fra svaret skrives ikke til disk. Indeksen i gruppen
      // beholdes som felt, fordi den inngår i pid-en til personer uten fødselsdato.
      const roller = liste(g["roller"]);
      roller.forEach((r0, i) => {
        const r = obj(r0);
        if (r && r["indeks"] === undefined) r["indeks"] = i;
      });
      g["roller"] = roller.filter((r0) =>
        (ROLLEKODER as readonly string[]).includes(tekst(obj(obj(r0)?.["type"])?.["kode"]) ?? ""),
      );
      if (g["forkastet"] === undefined) g["forkastet"] = roller.length - liste(g["roller"]).length;
      liste(g["roller"]).forEach((r0) => {
        const i = tall(obj(r0)?.["indeks"]) ?? 0;
        const p = obj(obj(r0)?.["person"]);
        if (!p) return;
        const kode = tekst(obj(obj(r0)?.["type"])?.["kode"]) ?? "";
        const n = obj(p["navn"]);
        const navn = pentPersonNavn([
          tekst(n?.["fornavn"]),
          tekst(n?.["mellomnavn"]),
          tekst(n?.["etternavn"]),
        ]);
        const fodt = tekst(p["fodselsdato"]);
        if (tekst(p["pid"]) === null) {
          p["pid"] = personHash(
            salt,
            navn,
            fodt ?? `ukjent|${orgnr}|${kode}|${i}|${navneord(navn).join(" ")}`,
          );
        }
        delete p["fodselsdato"];
      });
    }
    return JSON.stringify(j);
  }
  const o = obj(j);
  const innebygd = obj(o?.["_embedded"]);
  if (innebygd) {
    for (const f of ["enheter", "underenheter"]) {
      if (Array.isArray(innebygd[f]))
        innebygd[f] = (innebygd[f] as unknown[]).map((e) => (obj(e) ? vaskEnhetslik(obj(e)!) : e));
    }
    return JSON.stringify(j);
  }
  if (o && "organisasjonsnummer" in o) return JSON.stringify(vaskEnhetslik(o));
  return JSON.stringify(j);
}

// ---------------------------------------------------------------------------
// HTTP: curl gjennom proxyen, med tempo, nye forsøk og mellomlager.
// ---------------------------------------------------------------------------

const vent = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * curl, ikke fetch: Node sin fetch bruker ikke proxyen i utviklingsmiljøet.
 * Minst `minIntervallMs` mellom kall, og nye forsøk med økende pause ved 429
 * og 5xx. En 403 fra proxyen på CONNECT betyr at verten er stengt herfra.
 */
export function curlHttp(valg: { minIntervallMs?: number; forsok?: number } = {}): Http {
  const intervall = valg.minIntervallMs ?? 220;
  const forsok = valg.forsok ?? 4;
  let sist = 0;
  const ett = async (url: string): Promise<HttpSvar> => {
    const nå = Date.now();
    if (nå - sist < intervall) await vent(intervall - (nå - sist));
    sist = Date.now();
    try {
      const ut = execFileSync(
        "curl",
        ["-sS", "-m", "60", "-H", "Accept: application/json", "-w", "\n%{http_code}", url],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
      );
      const i = ut.lastIndexOf("\n");
      return { status: Number(ut.slice(i + 1)), tekst: ut.slice(0, i) };
    } catch (e) {
      const stderr = String((e as { stderr?: unknown }).stderr ?? "").trim();
      if (/CONNECT tunnel failed, response 403/.test(stderr)) {
        throw new Error(
          "data.brreg.no er stengt fra dette miljøet: proxyen svarer 403 på CONNECT. " +
            "Importen kan ikke kjøre før verten slippes gjennom.",
        );
      }
      return { status: 0, tekst: stderr.split("\n")[0] ?? "curl feilet" };
    }
  };
  return async (url) => {
    let svar = await ett(url);
    for (let f = 1; f <= forsok && (svar.status === 0 || svar.status === 429 || svar.status >= 500); f++) {
      await vent(Math.min(1000 * 2 ** (f - 1), 20_000));
      svar = await ett(url);
    }
    return svar;
  };
}

/**
 * Mellomlager per URL under `mappe`. Bare 200 og 404/410 lagres; en 5xx
 * prøves på nytt neste gang. Svarene vaskes FØR de lagres (`vaskSvar`), så
 * fødselsdatoer og adresser aldri havner på disk. `hentet.txt` holder datoen
 * for første henting, og den blir `per` på påstandene, så en ny kjøring på
 * mellomlageret gir byte-like filer.
 */
export function mellomlagretHttp(
  indre: Http,
  mappe: string,
  salt: string,
  logg: (linje: string) => void = () => {},
): { http: Http; statistikk: { treff: number; hentet: number } } {
  mkdirSync(mappe, { recursive: true });
  const statistikk = { treff: 0, hentet: 0 };
  const http: Http = async (url) => {
    const fil = join(mappe, `${createHash("sha256").update(url).digest("hex").slice(0, 32)}.json`);
    if (existsSync(fil)) {
      statistikk.treff++;
      const lagret = JSON.parse(readFileSync(fil, "utf8")) as { url: string } & HttpSvar;
      return { status: lagret.status, tekst: lagret.tekst };
    }
    const svar = await indre(url);
    statistikk.hentet++;
    if (statistikk.hentet % 100 === 0) logg(`  … ${statistikk.hentet} kall mot Brreg`);
    const vasket =
      svar.status === 200 ? { status: 200, tekst: vaskSvar(url, svar.tekst, salt) } : svar;
    if (svar.status === 200 || svar.status === 404 || svar.status === 410) {
      writeFileSync(fil, JSON.stringify({ url, status: vasket.status, tekst: vasket.tekst }));
    }
    return vasket;
  };
  return { http, statistikk };
}

export function hentedato(mappe: string, idag: string): string {
  const fil = join(mappe, "hentet.txt");
  if (existsSync(fil)) return readFileSync(fil, "utf8").trim();
  mkdirSync(mappe, { recursive: true });
  writeFileSync(fil, `${idag}\n`);
  return idag;
}

export function tomMellomlager(mappe: string): void {
  rmSync(mappe, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Henting for én kommune
// ---------------------------------------------------------------------------

async function hentJson(http: Http, url: string): Promise<{ status: number; json: unknown }> {
  const svar = await http(url);
  if (svar.status === 404 || svar.status === 410) return { status: svar.status, json: null };
  if (svar.status !== 200) return { status: svar.status, json: null };
  const t = svar.tekst.trimStart();
  // Brreg svarer 200 med HTML på noen stier. Det er ikke data.
  if (!t.startsWith("{") && !t.startsWith("[")) {
    throw new Error(`Brreg svarte 200 uten JSON på ${url}. Er stien riktig?`);
  }
  return { status: 200, json: JSON.parse(t) };
}

async function sokAlle(
  http: Http,
  grunnUrl: string,
  felt: "enheter" | "underenheter",
  size: number,
): Promise<J[]> {
  const ut: J[] = [];
  for (let side = 0; ; side++) {
    if ((side + 1) * size > MAKS_DYBDE) {
      throw new Error(
        `Søket ${grunnUrl} går forbi Brregs dybdegrense på ${MAKS_DYBDE} treff. Hev terskelen.`,
      );
    }
    const url = `${grunnUrl}&size=${size}&page=${side}`;
    const { status, json } = await hentJson(http, url);
    if (status !== 200) throw new Error(`Brreg svarte ${status} på ${url}`);
    const j = obj(json);
    const rader = liste(obj(j?.["_embedded"])?.[felt]).flatMap((x) => (obj(x) ? [obj(x)!] : []));
    ut.push(...rader);
    const side0 = obj(j?.["page"]);
    const totalt = tall(side0?.["totalElements"]) ?? 0;
    const sider = tall(side0?.["totalPages"]) ?? 0;
    if (totalt > MAKS_DYBDE) {
      throw new Error(`Søket ${grunnUrl} gir ${totalt} treff, over Brregs dybdegrense. Hev terskelen.`);
    }
    if (side + 1 >= sider || rader.length === 0) break;
  }
  return ut;
}

export interface HenteValg {
  kommunenr: string;
  terskel: number;
  terskelUnderenheter: number;
  sidestorrelse: number;
  /** Orgnr som alltid hentes, med roller og regnskap. */
  alltidOrgnr: string[];
  /** Navn som slås opp. `grunnlag` = grunnlagets eget organ (null treff er da normalt). */
  navneoppslag: { navn: string; organisasjonsform?: string; grunnlag: boolean }[];
  regnskapOrgformer: string[];
  /** Former som ikke tas inn (enkeltpersonforetak o.l.). Roller og regnskap hentes ikke for dem. */
  hoppOrgformer: string[];
  rollerForOverordnede: boolean;
  /** Sensitive enheter får bare daglig leder med seg allerede her. */
  erSensitiv: (navn: string, naering: Naering[]) => boolean;
  salt: string;
  hentet: string;
  logg?: (linje: string) => void;
}

/** Henter alt importøren trenger for én kommune. */
export async function hentKommune(http: Http, v: HenteValg): Promise<Oyeblikksbilde> {
  const logg = v.logg ?? (() => {});
  const bilde: Oyeblikksbilde = {
    kommunenr: v.kommunenr,
    hentet: v.hentet,
    terskel: v.terskel,
    terskelUnderenheter: v.terskelUnderenheter,
    enheter: {},
    iKommunen: [],
    alltid: [],
    underenheter: [],
    roller: {},
    regnskap: {},
    ikkeFunnet: [],
    regnskapUtilgjengelig: [],
    navneoppslag: [],
    forkastet: {
      feilKommune: 0,
      underTerskel: 0,
      underenhetFeilKommune: 0,
      underenhetUnderTerskel: 0,
      andreRoller: 0,
    },
  };

  // 1. Enheter i kommunen over terskelen. `fraAntallAnsatte`, aldri `sort`:
  //    sorteringen bryter filteret. Radene sjekkes likevel på nytt her.
  const enheter = await sokAlle(
    http,
    `${BRREG.enheter}?kommunenummer=${v.kommunenr}&fraAntallAnsatte=${v.terskel}`,
    "enheter",
    v.sidestorrelse,
  );
  for (const r of enheter) {
    const e = lesEnhet(r);
    if (e.kommunenr !== v.kommunenr) {
      bilde.forkastet.feilKommune++;
      continue;
    }
    if ((e.ansatte ?? 0) < v.terskel) {
      bilde.forkastet.underTerskel++;
      continue;
    }
    if (!bilde.enheter[e.orgnr]) bilde.iKommunen.push(e.orgnr);
    bilde.enheter[e.orgnr] = e;
  }
  logg(`  ${bilde.iKommunen.length} enheter i kommunen med minst ${v.terskel} ansatte`);

  // 2. Underenheter i kommunen over terskelen.
  const under = await sokAlle(
    http,
    `${BRREG.underenheter}?kommunenummer=${v.kommunenr}&fraAntallAnsatte=${v.terskelUnderenheter}`,
    "underenheter",
    v.sidestorrelse,
  );
  for (const r of under) {
    const u = lesUnderenhet(r);
    if (u.kommunenr !== v.kommunenr) {
      bilde.forkastet.underenhetFeilKommune++;
      continue;
    }
    if ((u.ansatte ?? 0) < v.terskelUnderenheter) {
      bilde.forkastet.underenhetUnderTerskel++;
      continue;
    }
    bilde.underenheter.push(u);
  }
  logg(`  ${bilde.underenheter.length} underenheter i kommunen med minst ${v.terskelUnderenheter} ansatte`);

  const hentEnhet = async (orgnr: string): Promise<Enhet | null> => {
    const kjent = bilde.enheter[orgnr];
    if (kjent) return kjent;
    const { status, json } = await hentJson(http, `${BRREG.enheter}/${orgnr}`);
    if (status === 404 || status === 410) {
      if (!bilde.ikkeFunnet.some((x) => x.orgnr === orgnr)) bilde.ikkeFunnet.push({ orgnr, status });
      return null;
    }
    if (status !== 200 || !obj(json)) throw new Error(`Brreg svarte ${status} på enhet ${orgnr}`);
    const e = lesEnhet(obj(json)!);
    bilde.enheter[orgnr] = e;
    return e;
  };

  // 3. Alltid med: orgnr fra datasettet og konfigurasjonen, og navneoppslag.
  const alltid = new Set<string>();
  for (const orgnr of [...new Set(v.alltidOrgnr)].sort()) {
    const e = await hentEnhet(orgnr);
    if (e && !e.slettet) alltid.add(orgnr);
  }
  for (const n of v.navneoppslag) {
    const url =
      `${BRREG.enheter}?navn=${encodeURIComponent(n.navn)}&size=50` +
      (n.organisasjonsform ? `&organisasjonsform=${encodeURIComponent(n.organisasjonsform)}` : "");
    const { status, json } = await hentJson(http, url);
    if (status !== 200) throw new Error(`Brreg svarte ${status} på navneoppslaget «${n.navn}»`);
    const treff = liste(obj(obj(json)?.["_embedded"])?.["enheter"])
      .flatMap((x) => (obj(x) ? [lesEnhet(obj(x)!)] : []))
      .filter((e) => orgNavnNokkel(e.navn) === orgNavnNokkel(n.navn) && !e.slettet);
    const [eneste] = treff;
    if (treff.length === 1 && eneste) {
      bilde.enheter[eneste.orgnr] ??= eneste;
      alltid.add(eneste.orgnr);
    } else if (!(n.grunnlag && treff.length === 0)) {
      bilde.navneoppslag.push({ navn: n.navn, treff: treff.length, grunnlag: n.grunnlag });
    }
  }
  bilde.alltid = [...alltid].filter((o) => !bilde.iKommunen.includes(o)).sort();
  logg(`  ${bilde.alltid.length} enheter tatt med uansett størrelse`);

  // 4. Overordnede til underenhetene.
  const foreldre = [...new Set(bilde.underenheter.flatMap((u) => (u.overordnet ? [u.overordnet] : [])))].sort();
  for (const orgnr of foreldre) await hentEnhet(orgnr);

  // 5. Roller for enhetene i kommunen og de som alltid er med.
  const medRoller = [...bilde.iKommunen, ...bilde.alltid];
  if (v.rollerForOverordnede) {
    for (const u of bilde.underenheter) {
      const f = u.overordnet ? bilde.enheter[u.overordnet] : undefined;
      if (f && f.kommunenr !== v.kommunenr && !medRoller.includes(f.orgnr)) medRoller.push(f.orgnr);
    }
  }
  for (const orgnr of medRoller.sort()) {
    const e = bilde.enheter[orgnr];
    if (e && v.hoppOrgformer.includes(e.orgform)) continue;
    const { status, json } = await hentJson(http, `${BRREG.enheter}/${orgnr}/roller`);
    if (status === 404 || status === 410) {
      bilde.roller[orgnr] = [];
      continue;
    }
    if (status !== 200 || !obj(json)) throw new Error(`Brreg svarte ${status} på roller for ${orgnr}`);
    const { roller, andre } = lesRoller(obj(json)!, orgnr, v.salt);
    bilde.forkastet.andreRoller += andre;
    // Sensitive organer: bare daglig leder, så resten ikke engang ligger i minnet lenger enn nødvendig.
    bilde.roller[orgnr] =
      e && v.erSensitiv(e.navn, e.naering) ? roller.filter((r) => r.kode === "DAGL") : roller;
  }
  logg(`  roller for ${medRoller.length} enheter`);

  // 6. Enheter som har styreplasser.
  const styreeiere = new Set<string>();
  for (const roller of Object.values(bilde.roller)) {
    for (const r of roller) {
      if (r.enhet && !r.enhet.slettet && r.kode !== "DAGL" && r.kode !== "VARA")
        styreeiere.add(r.enhet.orgnr);
    }
  }
  for (const orgnr of [...styreeiere].sort()) await hentEnhet(orgnr);

  // 7. Regnskap.
  let antallRegnskap = 0;
  for (const orgnr of [...bilde.iKommunen, ...bilde.alltid].sort()) {
    const e = bilde.enheter[orgnr];
    if (!e || !v.regnskapOrgformer.includes(e.orgform)) continue;
    const { status, json } = await hentJson(http, `${BRREG.regnskap}/${orgnr}`);
    if (status === 404 || status === 410) continue;
    if (status !== 200) {
      bilde.regnskapUtilgjengelig.push(orgnr);
      continue;
    }
    bilde.regnskap[orgnr] = lesRegnskap(json);
    antallRegnskap++;
  }
  logg(`  regnskap for ${antallRegnskap} enheter`);

  return bilde;
}
