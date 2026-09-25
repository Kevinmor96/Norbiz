// Utvider et kommunedatasett med enheter, roller og regnskap fra Brreg.
//
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --dry-run      skriv ingenting, vis tallene
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --terskel 50   overstyr terskelen
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --oppfrisk     tøm mellomlageret og hent på nytt
//
// Hva som hentes, hvordan det avstemmes mot grunnlaget, og hvorfor, står i
// docs/brreg-import.md. Kort:
//
// - Enheter i kommunen med minst N ansatte (`fraAntallAnsatte`, aldri `sort`),
//   underenheter i kommunen med overordnet enhet utenfor, og en liste som alltid
//   tas med (orgnr i datasettet, orgnr og navn i scripts/brreg.config.json).
// - Roller (daglig leder, styreleder, nestleder, styremedlem, varamedlem) og
//   siste årsregnskap.
// - Utdata UTVIDER src/data/<kommune>.json. Grunnlagets rader står i samme
//   rekkefølge; importørens rader kommer sist, sortert på naturlig nøkkel.
//   Avvik mot grunnlaget skrives til docs/avvik/brreg-<kommunenr>-<dato>.md.
// - Svarene mellomlagres (vasket for fødselsdato og adresser) under
//   node_modules/.cache/maktkart-brreg/<kommunenr>/. En ny kjøring på det
//   samme mellomlageret gir byte-like filer.
//
// Uten MAKTKART_PERSON_SALT nekter skriptet å kjøre: saltet nøkler hashen av
// navn og fødselsdato som skiller navnebrødre.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Kommunedatasett } from "../src/data/types";
import { samle, valider } from "../src/lib/data/samle";
import { lesDatasett } from "./seed-build";
import {
  curlHttp,
  hentedato,
  hentKommune,
  mellomlagretHttp,
  tomMellomlager,
  type Http,
} from "./brreg/hent";
import { importer, navneBrudd, sensitivType, type ImportUt } from "./brreg/importer";
import { lesKonfig, lesTabeller, ROT, type Konfig, type Tabeller } from "./brreg/konfig";
import { avviksrapport, oppsummeringslinjer } from "./brreg/rapport";
import { dagensDato, orgNavnNokkel } from "./brreg/tekst";

export const MELLOMLAGER = join(ROT, "node_modules", ".cache", "maktkart-brreg");
export const AVVIKMAPPE = join(ROT, "docs", "avvik");

/** Organtyper som aldri er egne rettssubjekter, og som derfor ikke slås opp på navn. */
const IKKE_RETTSSUBJEKT = new Set(["folkevalgt_organ", "utvalg", "raad", "administrasjon", "lovgivende"]);

export interface KjorValg {
  kommunenr: string[];
  dataMappe: string;
  avvikMappe: string;
  /** Rå HTTP mot Brreg. Mellomlageret legges utenpå når `mellomlager` er satt. */
  http: Http;
  mellomlager: string | null;
  salt: string;
  idag: string;
  konfig: Konfig;
  tabeller: Tabeller;
  skriv: boolean;
  logg: (linje: string) => void;
  /** Overstyrer terskelen for både enheter og underenheter. */
  terskel?: number;
}

export interface KjorResultat {
  kommunenr: string;
  datasettfil: string;
  avviksfil: string;
  resultat: ImportUt;
}

export const serialiser = (d: Kommunedatasett): string => `${JSON.stringify(d, null, 2)}\n`;

export async function kjor(v: KjorValg): Promise<KjorResultat[]> {
  if (!v.salt || v.salt.length < 16) {
    throw new Error(
      "MAKTKART_PERSON_SALT mangler eller er kortere enn 16 tegn. Saltet nøkler hashen som skiller " +
        "navnebrødre. Uten det kan importen ikke kjøre. Se docs/brreg-import.md.",
    );
  }
  const ut: KjorResultat[] = [];
  for (const nr of v.kommunenr) {
    const k0 = v.konfig.kommuner[nr];
    if (!k0) throw new Error(`Kommunen ${nr} står ikke i scripts/brreg.config.json.`);
    const k =
      v.terskel !== undefined ? { ...k0, terskel_ansatte: v.terskel, terskel_underenheter: v.terskel } : k0;

    const alle = lesDatasett(v.dataMappe);
    const egen = alle.find((d) => d.data.meta.kommunenr === nr);
    if (!egen) throw new Error(`Fant ikke noe datasett for ${nr} i ${v.dataMappe}. Lag grunnlaget først.`);
    const andre = alle.filter((d) => d !== egen).map((d) => d.data);

    let http = v.http;
    let hentet = v.idag;
    if (v.mellomlager) {
      const mappe = join(v.mellomlager, nr);
      hentet = hentedato(mappe, v.idag);
      http = mellomlagretHttp(v.http, mappe, v.salt, v.logg).http;
    }

    // Hva som alltid tas med, og hva som slås opp på navn. Grunnlagets egne
    // organer skilles fra importørens på belegget (se importer.ts).
    const d = egen.data;
    const erImportert = (o: Kommunedatasett["organisasjoner"][number]) =>
      o.belegg.verifisering === "verifisert" &&
      ["enhetsregisteret", "brreg-roller", "regnskapsregisteret"].includes(o.belegg.kilde) &&
      !(o.belegg.merknad ?? "").startsWith("Bekrefter grunnlaget");
    const grunnOrg = d.organisasjoner.filter((o) => !erImportert(o));
    const alltidOrgnr = [
      ...k.alltid.orgnr,
      ...Object.values(k.koblinger),
      ...(k.alltid.fra_datasett ? grunnOrg.flatMap((o) => (o.orgnr ? [o.orgnr] : [])) : []),
    ];
    const sett = new Set<string>();
    const navneoppslag: { navn: string; organisasjonsform?: string; grunnlag: boolean }[] = [];
    for (const n of k.alltid.navn) {
      if (sett.has(orgNavnNokkel(n.navn))) continue;
      sett.add(orgNavnNokkel(n.navn));
      navneoppslag.push({ ...n, grunnlag: false });
    }
    if (k.navnesok_for_grunnlaget) {
      for (const o of grunnOrg) {
        if (o.orgnr || k.koblinger[o.key] || IKKE_RETTSSUBJEKT.has(o.organtype)) continue;
        if (sett.has(orgNavnNokkel(o.navn))) continue;
        sett.add(orgNavnNokkel(o.navn));
        navneoppslag.push({ navn: o.navn, grunnlag: true });
      }
    }

    v.logg(`${d.meta.kommune} (${nr}): henter fra Brreg, terskel ${k.terskel_ansatte} ansatte`);
    const bilde = await hentKommune(http, {
      kommunenr: nr,
      terskel: k.terskel_ansatte,
      terskelUnderenheter: k.terskel_underenheter,
      sidestorrelse: v.konfig.felles.sidestorrelse,
      alltidOrgnr,
      navneoppslag,
      regnskapOrgformer: v.konfig.felles.regnskap_orgformer,
      hoppOrgformer: Object.keys(v.tabeller.orgform.hoppes_over),
      rollerForOverordnede: k.roller_for_overordnede,
      erSensitiv: (navn, naering) => sensitivType(navn, naering, v.konfig.felles) !== null,
      salt: v.salt,
      hentet,
      logg: v.logg,
    });

    const resultat = importer({
      datasett: d,
      bilde,
      konfig: k,
      felles: v.konfig.felles,
      tabeller: v.tabeller,
      andre,
    });

    // Samme kontroll som seed-byggeren og datasett-testen: ingen konflikter,
    // ingen døde referanser, ingen tekst som nevner en person uten lenke.
    const feil = valider(samle([...alle.filter((x) => x !== egen), { slug: egen.slug, data: resultat.datasett }]));
    const brudd = navneBrudd(resultat.datasett);
    if (feil.length > 0 || brudd.length > 0) {
      throw new Error(
        `Resultatet for ${nr} er ikke gyldig, og ingenting er skrevet:\n  ` +
          [...feil, ...brudd.map((b) => `${b.eier} ${b.nokkel} nevner ${b.person} uten lenke`)].join("\n  "),
      );
    }

    const datasettfil = join(v.dataMappe, `${egen.slug}.json`);
    const avviksfil = join(v.avvikMappe, `brreg-${nr}-${hentet}.md`);
    const kommando = `npm run brreg -- ${nr}${v.terskel !== undefined ? ` --terskel ${v.terskel}` : ""}`;
    if (v.skriv) {
      writeFileSync(datasettfil, serialiser(resultat.datasett));
      mkdirSync(v.avvikMappe, { recursive: true });
      writeFileSync(avviksfil, avviksrapport(resultat, kommando));
    }
    for (const l of oppsummeringslinjer(resultat.oppsummering)) v.logg(`  ${l}`);
    v.logg(
      v.skriv
        ? `  Skrev ${relative(ROT, datasettfil)} og ${relative(ROT, avviksfil)}.`
        : "  Tørrkjøring: ingenting er skrevet.",
    );
    ut.push({ kommunenr: nr, datasettfil, avviksfil, resultat });
  }
  return ut;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const kommunenr = args.filter((a) => /^\d{4}$/.test(a));
  const terskelArg = args.indexOf("--terskel");
  const terskel = terskelArg >= 0 ? Number(args[terskelArg + 1]) : undefined;
  if (kommunenr.length === 0) {
    console.error("Bruk: npm run brreg -- <kommunenr> [flere kommunenr] [--dry-run] [--terskel N] [--oppfrisk]");
    process.exit(2);
  }
  const salt = process.env["MAKTKART_PERSON_SALT"] ?? "";
  const konfig = lesKonfig();
  if (terskel !== undefined && (!Number.isInteger(terskel) || terskel < 5)) {
    console.error("--terskel må være et heltall på minst 5 (Brreg svarer 400 under det).");
    process.exit(2);
  }
  if (args.includes("--oppfrisk")) for (const nr of kommunenr) tomMellomlager(join(MELLOMLAGER, nr));
  await kjor({
    kommunenr,
    dataMappe: join(ROT, "src", "data"),
    avvikMappe: AVVIKMAPPE,
    http: curlHttp({ minIntervallMs: konfig.felles.min_intervall_ms }),
    mellomlager: MELLOMLAGER,
    salt,
    idag: dagensDato(),
    konfig,
    tabeller: lesTabeller(),
    skriv: !args.includes("--dry-run"),
    logg: (l) => console.log(l),
    ...(terskel !== undefined ? { terskel } : {}),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
