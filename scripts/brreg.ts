// Utvider kommunedatasettene med enheter, roller og regnskap fra Brreg.
//
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 5503 5601    flere kommuner i én kjøring
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --dry-run      skriv ingenting, vis tallene
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --terskel 50   overstyr kandidatterskelen
//   MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --oppfrisk     tøm mellomlageret og hent på nytt
//
// Hva som hentes, hvordan utvalget gjøres, hvordan det avstemmes mot
// grunnlaget og hvorfor, står i docs/brreg-import.md. Kort:
//
// - Kandidater er enhetene i kommunen med minst 20 ansatte og underenhetene i
//   kommunen med minst 20 ansatte og overordnet utenfor. Med kommer de med minst
//   50 ansatte, minst 100 mill. kr i omsetning eller blant de ti største, pluss
//   en liste som alltid tas med. Regelen står i scripts/brreg.config.json.
// - Utdata UTVIDER src/data/<slug>.json. Finnes ikke fila, lages den, med slug
//   og navn fra src/data/region/nord-norge.json. Avvik mot grunnlaget skrives
//   til docs/avvik/brreg-<kommunenr>-<dato>.md.
// - Et organ som står i flere kommuner, får én kanonisk rad, skrevet av
//   kommunen det ligger i (eller grunnlagets rad), og kopiert likt til de
//   andre. Rollene og regnskapet føres i ett datasett; hvilket, avgjøres én
//   gang for hele kjøringen (`fordelEierskap` i scripts/brreg/importer.ts).
// - Svarene mellomlagres (vasket for fødselsdato og adresser) i ett felles
//   mellomlager under node_modules/.cache/maktkart-brreg/. Hentedatoen er den
//   samme for alle kommunene i lageret, og en ny kjøring gir byte-like filer.
//
// Uten MAKTKART_PERSON_SALT nekter skriptet å kjøre: saltet nøkler hashen av
// navn og fødselsdato som skiller navnebrødre.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Dekningsregister, Regionregister } from "../src/data/region/types";
import type { Kommunedatasett, Person } from "../src/data/types";
import { samle, valider } from "../src/lib/data/samle";
import { lesDatasett } from "./seed-build";
import {
  curlHttp,
  hentedato,
  hentKommune,
  mellomlagretHttp,
  tomMellomlager,
  type Enhet,
  type Http,
  type Oyeblikksbilde,
} from "./brreg/hent";
import {
  erImportert,
  forerRegisterrader,
  fordelEierskap,
  IKKE_RETTSSUBJEKT,
  importer,
  KILDER,
  kopierteOrganer,
  navneBrudd,
  sensitivType,
  type ImportUt,
} from "./brreg/importer";
import {
  kommunekonfig,
  lesKonfig,
  lesTabeller,
  ROT,
  type Kommunekonfig,
  type Konfig,
  type Tabeller,
} from "./brreg/konfig";
import { avviksrapport, oppsummeringslinjer } from "./brreg/rapport";
import { dagensDato, orgNavnNokkel, pentOrgNavn, slug } from "./brreg/tekst";

export const MELLOMLAGER = join(ROT, "node_modules", ".cache", "maktkart-brreg");
export const AVVIKMAPPE = join(ROT, "docs", "avvik");
export const REGIONFIL = join(ROT, "src", "data", "region", "nord-norge.json");
export const DEKNINGFIL = join(ROT, "src", "data", "region", "dekning.json");

const KOMMUNELOVEN = {
  key: "kommuneloven",
  navn: "Kommuneloven (lovdata.no)",
  url: "https://lovdata.no/lov/2018-06-22-83",
  type: "register",
  lisens: "NLOD",
} as const;

export interface KjorValg {
  kommunenr: string[];
  dataMappe: string;
  avvikMappe: string;
  /** Rå HTTP mot Brreg. Mellomlageret legges utenpå når `mellomlager` er satt. */
  http: Http;
  /** Felles mellomlager for alle kommunene, eller null. */
  mellomlager: string | null;
  /** Regionregisteret med slug og navn for nye kommuner, eller null. */
  regionfil?: string | null;
  /**
   * Dekningsregisteret: hvilke regionale organer som har myndighet over hver
   * kommune. Organenes rader kopieres inn i kommunenes datasett. Null eller en
   * fil som ikke finnes: ingen dekning.
   */
  dekningfil?: string | null;
  salt: string;
  idag: string;
  konfig: Konfig;
  tabeller: Tabeller;
  skriv: boolean;
  logg: (linje: string) => void;
  /** Overstyrer kandidatterskelen for både enheter og underenheter. */
  terskel?: number;
}

export interface KjorResultat {
  kommunenr: string;
  slug: string;
  datasettfil: string;
  avviksfil: string;
  resultat: ImportUt;
}

export const serialiser = (d: Kommunedatasett): string => `${JSON.stringify(d, null, 2)}\n`;

function lesRegion(fil: string | null | undefined): Regionregister | null {
  if (!fil || !existsSync(fil)) return null;
  return JSON.parse(readFileSync(fil, "utf8")) as Regionregister;
}

/** kommunenr → organnøklene som dekker kommunen, sortert. */
function lesDekning(fil: string | null | undefined): Map<string, string[]> {
  const ut = new Map<string, string[]>();
  if (!fil || !existsSync(fil)) return ut;
  const d = JSON.parse(readFileSync(fil, "utf8")) as Dekningsregister;
  for (const x of d.dekning)
    for (const nr of x.kommuner) ut.set(nr, [...(ut.get(nr) ?? []), x.org]);
  for (const [nr, keys] of ut) ut.set(nr, [...new Set(keys)].sort());
  return ut;
}

/**
 * Et nytt datasett for en kommune uten grunnlag: kommunens egen enhet fra
 * Brreg (importøren bygger den på nytt) og kommunestyret, som alle kommuner har
 * etter kommuneloven § 5-1. Medlemmene er ikke hentet, og det sier merknaden.
 */
function nyttDatasett(
  nr: string,
  slugNy: string,
  bilde: Oyeblikksbilde,
  region: Regionregister | null,
  konfig: Konfig,
  brukteKeys: Set<string>,
): Kommunedatasett {
  const komm: Enhet | undefined = Object.values(bilde.enheter).find(
    (e) => e.orgform === "KOMM" && e.kommunenr === nr && !e.slettet,
  );
  if (!komm)
    throw new Error(`Fant ikke kommunens egen enhet (organisasjonsform KOMM) for ${nr} i Brreg.`);
  const r = region?.kommuner.find((k) => k.nr === nr);
  const fylkesnr = r?.fylkesnr ?? nr.slice(0, 2);
  const fylke =
    region?.fylker.find((f) => f.nr === fylkesnr)?.navn ?? konfig.felles.fylker[fylkesnr];
  if (!fylke)
    throw new Error(
      `Ukjent fylke ${fylkesnr} for ${nr}. Legg det i felles.fylker i scripts/brreg.config.json.`,
    );
  const navn =
    r?.navn_offisielt ??
    pentOrgNavn(komm.navn.replace(/\s+KOMMUNE$/i, ""), konfig.felles.navneformer);
  let kommKey = slug(orgNavnNokkel(pentOrgNavn(komm.navn)));
  if (brukteKeys.has(kommKey)) kommKey = `${kommKey}-${komm.orgnr}`;
  const lov = (merknad: string) => ({
    kilde: KOMMUNELOVEN.key,
    verifisering: "oppgitt" as const,
    per: bilde.hentet,
    merknad,
  });
  return {
    meta: {
      kommunenr: nr,
      kommune: navn,
      fylkesnr,
      fylke,
      sammenstilt: bilde.hentet,
      grunnlag: "docs/brreg-import.md",
      merknad:
        `Sammenstilt ${bilde.hentet} fra Brønnøysundregistrene av scripts/brreg.ts. Kommunen har ikke noe ` +
        "researchgrunnlag ennå: kommunestyret følger av kommuneloven, og medlemmene er ikke hentet.",
    },
    kilder: [{ ...KOMMUNELOVEN }],
    organisasjoner: [
      {
        key: `${slugNy}-kommunestyre`,
        navn: `Kommunestyret i ${navn}`,
        nivaa: "kommune",
        organtype: "folkevalgt_organ",
        overordnet: kommKey,
        kommunenr: nr,
        myndighet: ["vedtak"],
        segmenter: [],
        status: "aktiv",
        sensitiv: false,
        beskrivelse: "Kommunens øverste organ, som alle kommuner har.",
        belegg: lov("Følger av kommuneloven § 5-1. Medlemmer og ordfører er ikke hentet."),
      },
      {
        key: kommKey,
        orgnr: komm.orgnr,
        navn: pentOrgNavn(komm.navn, konfig.felles.navneformer),
        nivaa: "kommune",
        organtype: "kommune",
        kommunenr: nr,
        myndighet: [],
        segmenter: [],
        status: "aktiv",
        sensitiv: false,
        beskrivelse: "Kommune registrert i Enhetsregisteret.",
        belegg: {
          kilde: KILDER.enhet.key,
          verifisering: "verifisert",
          per: bilde.hentet,
          merknad: "Utvalg: kommunen.",
        },
      },
    ],
    personer: [],
    roller: [],
    relasjoner: [
      {
        fra: `${slugNy}-kommunestyre`,
        til: kommKey,
        type: "overordnet",
        belegg: lov("Kommunestyret er kommunens øverste organ (kommuneloven § 5-1)."),
      },
    ],
    nokkeltall: [],
    hendelser: [],
    prosesser: [],
    segmenter: [],
    org_segment: [],
    hull: [],
  };
}

export async function kjor(v: KjorValg): Promise<KjorResultat[]> {
  if (!v.salt || v.salt.length < 16) {
    throw new Error(
      "MAKTKART_PERSON_SALT mangler eller er kortere enn 16 tegn. Saltet nøkler hashen som skiller " +
        "navnebrødre. Uten det kan importen ikke kjøre. Se docs/brreg-import.md.",
    );
  }
  const kommuner = [...new Set(v.kommunenr)].sort();
  let http = v.http;
  let hentet = v.idag;
  if (v.mellomlager) {
    hentet = hentedato(v.mellomlager, v.idag);
    http = mellomlagretHttp(v.http, v.mellomlager, v.salt, v.logg).http;
  }
  const region = lesRegion(v.regionfil);
  const dekning = lesDekning(v.dekningfil);
  const paaDisk = lesDatasett(v.dataMappe);
  const tilstand = new Map(paaDisk.map((d) => [d.slug, d.data]));
  const opprinnelig = new Map(paaDisk.map((d) => [d.slug, serialiser(d.data)]));

  // 1. Hent alle kommunene først. Nye kommuner får et datasett med kommunens
  //    enhet og kommunestyret.
  const jobber: { nr: string; slug: string; k: Kommunekonfig; bilde: Oyeblikksbilde }[] = [];
  for (const nr of kommuner) {
    const k0 = kommunekonfig(v.konfig, nr);
    const k =
      v.terskel !== undefined
        ? { ...k0, terskel_ansatte: v.terskel, terskel_underenheter: v.terskel }
        : k0;
    const egen = [...tilstand].find(([, d]) => d.meta.kommunenr === nr);
    const d = egen?.[1];
    // Grunnlaget, uten kopier av grunnlagsrader fra andre datasett: de er med
    // bare fordi et organ her viste til dem sist, og utvalget skal ikke avhenge
    // av forrige kjøring.
    const kopier = d
      ? kopierteOrganer(
          d,
          [...tilstand].filter(([s]) => s !== egen?.[0]).map(([s, data]) => ({ slug: s, data })),
        ).kopier
      : new Set<string>();
    const grunnOrg = (d?.organisasjoner ?? []).filter(
      (o) => !erImportert(o.belegg) && !kopier.has(o.key),
    );
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
    v.logg(
      `${d?.meta.kommune ?? nr} (${nr}): henter fra Brreg, kandidater med minst ${k.terskel_ansatte} ansatte`,
    );
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
      utvalg: k.utvalg,
      erSensitiv: (navn, naering) => sensitivType(navn, naering, v.konfig.felles) !== null,
      salt: v.salt,
      hentet,
      logg: v.logg,
    });
    let slugNy = egen?.[0];
    if (!slugNy) {
      const r = region?.kommuner.find((x) => x.nr === nr);
      slugNy =
        r?.slug ??
        slug(
          pentOrgNavn(
            (
              Object.values(bilde.enheter).find((e) => e.orgform === "KOMM" && e.kommunenr === nr)
                ?.navn ?? nr
            ).replace(/\s+KOMMUNE$/i, ""),
          ),
        );
      if (tilstand.has(slugNy)) throw new Error(`Slugen ${slugNy} for ${nr} er allerede i bruk.`);
      const brukte = new Set(
        [...tilstand.values()].flatMap((x) => x.organisasjoner.map((o) => o.key)),
      );
      tilstand.set(slugNy, nyttDatasett(nr, slugNy, bilde, region, v.konfig, brukte));
      v.logg(`  nytt datasett: src/data/${slugNy}.json`);
    }
    jobber.push({ nr, slug: slugNy, k, bilde });
  }
  const kjoringen = new Set(jobber.map((j) => j.slug));
  const utenfor = [...tilstand]
    .filter(([s]) => !kjoringen.has(s))
    .map(([s, data]) => ({ slug: s, data }))
    .sort((a, b) => (a.data.meta.kommunenr < b.data.meta.kommunenr ? -1 : 1));
  // `koblinger` i konfigurasjonen for datasett utenfor kjøringen: grunnlagets
  // organ er kjent uten at kommunen hentes.
  const koblingerUtenfor = new Map<string, { slug: string; key: string }>();
  for (const { slug: s, data } of utenfor) {
    const koblinger = kommunekonfig(v.konfig, data.meta.kommunenr).koblinger;
    for (const [key, orgnr] of Object.entries(koblinger).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (koblingerUtenfor.has(orgnr)) continue;
      if (data.organisasjoner.some((o) => o.key === key && !erImportert(o.belegg)))
        koblingerUtenfor.set(orgnr, { slug: s, key });
    }
  }
  const inn = (
    j: (typeof jobber)[number],
    personregister: Map<string, Person>,
    eierskap: {
      grunnlenker: Map<string, { slug: string; key: string }>;
      eiere?: Map<string, string>;
    },
  ) => ({
    datasett: tilstand.get(j.slug)!,
    slug: j.slug,
    bilde: j.bilde,
    konfig: j.k,
    felles: v.konfig.felles,
    tabeller: v.tabeller,
    andre: [...tilstand].filter(([s]) => s !== j.slug).map(([s, data]) => ({ slug: s, data })),
    kjoringen,
    personregister,
    dekning: dekning.get(j.nr) ?? [],
    ...eierskap,
  });

  // 2. Forhåndskjøring for alle kommunene: grunnlagskoblingene for personer,
  //    så en person i grunnlaget i én kommune får samme nøkkel i de andre, og
  //    for organer, så et grunnlagsorgan får samme nøkkel overalt. Og utvalget
  //    til hver kommune, som eierskapet fordeles etter.
  const register = new Map<string, Person>();
  const motstrid = new Set<string>();
  const forhand = new Map<string, ImportUt>();
  for (const j of jobber) {
    const r = importer(inn(j, new Map(), { grunnlenker: koblingerUtenfor }));
    forhand.set(j.slug, r);
    for (const [pid, p] of r.personlenker) {
      const f = register.get(pid);
      if (f && f.key !== p.key) motstrid.add(pid);
      else register.set(pid, p);
    }
  }
  for (const pid of motstrid) register.delete(pid);

  const grunnlenker = new Map<string, { slug: string; key: string }>();
  for (const j of jobber)
    for (const [orgnr, key] of forhand.get(j.slug)!.grunnlagHer)
      if (!grunnlenker.has(orgnr)) grunnlenker.set(orgnr, { slug: j.slug, key });
  for (const [orgnr, x] of koblingerUtenfor) if (!grunnlenker.has(orgnr)) grunnlenker.set(orgnr, x);
  const grunnlagUtenfor = new Map([...koblingerUtenfor].map(([o, x]) => [o, x.slug] as const));
  for (const j of jobber)
    for (const [orgnr, s] of forhand.get(j.slug)!.grunnlagAndre)
      if (!kjoringen.has(s) && !grunnlagUtenfor.has(orgnr)) grunnlagUtenfor.set(orgnr, s);
  // Hvem som fører roller og regnskap for hvert organ: én gang for hele
  // kjøringen, så rekkefølgen kommunene importeres i, ikke spiller inn.
  const eiere = fordelEierskap({
    kommuner: jobber.map((j) => ({
      slug: j.slug,
      kommunenr: j.nr,
      omfang: new Set(forhand.get(j.slug)!.omfang),
      grunnlag: new Set(forhand.get(j.slug)!.grunnlagHer.keys()),
    })),
    sete: (orgnr) => jobber.find((j) => j.bilde.enheter[orgnr])?.bilde.enheter[orgnr]?.kommunenr,
    grunnlagUtenfor,
    forerUtenfor: forerRegisterrader(utenfor),
  });

  // 3. Importen, kommune for kommune. Hver kommune ser de andres resultat.
  const ut: KjorResultat[] = [];
  for (const j of jobber) {
    const resultat = importer(inn(j, register, { grunnlenker, eiere }));
    tilstand.set(j.slug, resultat.datasett);
    for (const [s, d] of resultat.andreOppdatert) tilstand.set(s, d);
    for (const [pid, p] of resultat.personnokler) if (!register.has(pid)) register.set(pid, p);
    ut.push({
      kommunenr: j.nr,
      slug: j.slug,
      datasettfil: join(v.dataMappe, `${j.slug}.json`),
      avviksfil: join(v.avvikMappe, `brreg-${j.nr}-${hentet}.md`),
      resultat,
    });
  }

  // 4. Samme kontroll som seed-byggeren og datasett-testen, over alle
  //    datasettene: ingen konflikter, ingen døde referanser, ingen tekst som
  //    nevner en person uten lenke. Feiler noe, skrives ingenting.
  const alle = [...tilstand].map(([s, data]) => ({ slug: s, data }));
  const feil = [
    ...valider(samle(alle)),
    ...alle.flatMap((d) =>
      navneBrudd(d.data).map(
        (b) => `${d.slug}: ${b.eier} ${b.nokkel} nevner ${b.person} uten lenke`,
      ),
    ),
  ];
  if (feil.length > 0) {
    throw new Error(`Resultatet er ikke gyldig, og ingenting er skrevet:\n  ${feil.join("\n  ")}`);
  }

  for (const r of ut) {
    v.logg(`${r.resultat.oppsummering.kommune} (${r.kommunenr}):`);
    for (const l of oppsummeringslinjer(r.resultat.oppsummering)) v.logg(`  ${l}`);
  }
  if (!v.skriv) {
    v.logg("Tørrkjøring: ingenting er skrevet.");
    return ut;
  }
  mkdirSync(v.avvikMappe, { recursive: true });
  for (const [s, d] of tilstand) {
    const tekst = serialiser(d);
    if (opprinnelig.get(s) === tekst) continue;
    const fil = join(v.dataMappe, `${s}.json`);
    writeFileSync(fil, tekst);
    v.logg(`Skrev ${relative(ROT, fil)}.`);
  }
  for (const r of ut) {
    const kommando = `npm run brreg -- ${r.kommunenr}${v.terskel !== undefined ? ` --terskel ${v.terskel}` : ""}`;
    writeFileSync(r.avviksfil, avviksrapport(r.resultat, kommando));
    v.logg(`Skrev ${relative(ROT, r.avviksfil)}.`);
  }
  return ut;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const kommunenr = args.filter((a) => /^\d{4}$/.test(a));
  const terskelArg = args.indexOf("--terskel");
  const terskel = terskelArg >= 0 ? Number(args[terskelArg + 1]) : undefined;
  if (kommunenr.length === 0) {
    console.error(
      "Bruk: npm run brreg -- <kommunenr> [flere kommunenr] [--dry-run] [--terskel N] [--oppfrisk]",
    );
    process.exit(2);
  }
  const salt = process.env["MAKTKART_PERSON_SALT"] ?? "";
  const konfig = lesKonfig();
  if (terskel !== undefined && (!Number.isInteger(terskel) || terskel < 5)) {
    console.error("--terskel må være et heltall på minst 5 (Brreg svarer 400 under det).");
    process.exit(2);
  }
  if (args.includes("--oppfrisk")) tomMellomlager(MELLOMLAGER);
  await kjor({
    kommunenr,
    dataMappe: join(ROT, "src", "data"),
    avvikMappe: AVVIKMAPPE,
    http: curlHttp({ minIntervallMs: konfig.felles.min_intervall_ms }),
    mellomlager: MELLOMLAGER,
    regionfil: REGIONFIL,
    dekningfil: DEKNINGFIL,
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
