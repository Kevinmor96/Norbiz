// Tekstregler for Brreg-importen: folding, nøkler, navnematching og
// personhashen.
//
// Alt her er rent og deterministisk. Samme inndata gir samme nøkkel på hver
// maskin, uavhengig av locale.

import { createHmac } from "node:crypto";

/**
 * Folder bort aksenter og æøå slik `tests/datasett.test.ts` gjør. Brreg har
 * `HERMÈS NORWAY AS`, og et søk på «HERMES» må finne det. «Åslaug» og
 * «Aslaug» er samme navn.
 */
export const fold = (t: string): string =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .toLowerCase();

/** Stabil slug for `key`: bare a–z, 0–9 og bindestrek. */
export const slug = (t: string): string =>
  fold(t)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Selskapsformene som kan stå sist i et navn og som ikke skiller to organer. */
const FORMSUFFIKS = new Set([
  "as",
  "asa",
  "sa",
  "hf",
  "rhf",
  "iks",
  "kf",
  "fkf",
  "ans",
  "da",
  "ba",
  "sf",
  "nuf",
]);

/**
 * Navnet slik organer sammenlignes: foldet, uten tegnsetting og uten
 * selskapsform til slutt. «Troms Kraft AS» og «TROMS KRAFT AS» er like, og
 * «Universitetssykehuset Nord-Norge HF» er lik «UNIVERSITETSSYKEHUSET
 * NORD-NORGE HF».
 */
export function orgNavnNokkel(navn: string): string {
  const ord = fold(navn)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (ord.length > 1 && FORMSUFFIKS.has(ord[ord.length - 1] ?? "")) ord.pop();
  return ord.join(" ");
}

/** Personnavnet som foldede ord. «Kjell-Are» og «Kjell Are» gir de samme ordene. */
export const navneord = (navn: string): string[] =>
  fold(navn)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * Om navnet i grunnlaget kan være det samme som navnet i registeret.
 *
 * Fornavn og etternavn må være like. Mellomnavn i grunnlaget må finnes i
 * registernavnet i samme rekkefølge, eller være forbokstaven i ett. Grunnlaget
 * skriver ofte kortere enn registeret: «Ellen Beate Lundberg» er «Ellen Beate
 * Jensen Lundberg», og «Inge K. Hansen» er «Inge Kristian Hansen».
 *
 * Regelen brukes bare når organet og rolletypen også er de samme. Alene er
 * et navn aldri nok til å si at to personer er én.
 */
export function navnKanVaereSamme(grunnlag: string, register: string): boolean {
  const g = navneord(grunnlag);
  const r = navneord(register);
  if (g.length === 0 || r.length === 0) return false;
  if (g.join(" ") === r.join(" ")) return true;
  if (g[0] !== r[0] || g[g.length - 1] !== r[r.length - 1] || g.length > r.length) return false;
  const gMidt = g.slice(1, -1);
  const rMidt = r.slice(1, -1);
  let j = 0;
  for (const ord of gMidt) {
    let funnet = false;
    while (j < rMidt.length) {
      const kandidat = rMidt[j++] ?? "";
      if (kandidat === ord || (ord.length === 1 && kandidat.startsWith(ord))) {
        funnet = true;
        break;
      }
    }
    if (!funnet) return false;
  }
  return true;
}

/** Eksakt samme navn etter folding. */
export const sammeNavn = (a: string, b: string): boolean =>
  navneord(a).join(" ") === navneord(b).join(" ");

/**
 * HMAC-SHA256 av navn og fødselsdato, nøklet med `MAKTKART_PERSON_SALT`.
 *
 * Brukes BARE til å skille to personer med samme navn, og bare når en
 * navnekollisjon faktisk finnes, som et kort suffiks i personnøkkelen.
 * Fødselsdatoen forlater aldri hente-laget: den hashes der og kastes.
 */
export function personHash(salt: string, navn: string, fodselsdato: string): string {
  return createHmac("sha256", salt).update(`${navneord(navn).join(" ")}|${fodselsdato}`).digest("hex");
}

const juridiskeFormer = new Set([
  "AS",
  "ASA",
  "SA",
  "HF",
  "RHF",
  "IKS",
  "KF",
  "FKF",
  "ANS",
  "DA",
  "BA",
  "SF",
  "NUF",
  "STI",
]);

const harVokal = (ord: string) => /[AEIOUYÆØÅÉÈÊÀÁÄÖÜ]/i.test(ord);

/**
 * Brreg fører organnavn med store bokstaver. For visning gjøres hvert ord om
 * til stor forbokstav, med unntak for selskapsformer, ord uten vokal (DNB, KF)
 * og ord i `navneformer`. Navn som allerede har små bokstaver, står urørt.
 */
export function pentOrgNavn(navn: string, navneformer: Record<string, string> = {}): string {
  const t = navn.trim().replace(/\s+/g, " ");
  if (/[a-zæøå]/.test(t)) return t;
  return t
    .split(/(\s|-|\/|\(|\))/)
    .map((del) => {
      if (del === "" || /^(\s|-|\/|\(|\))$/.test(del)) return del;
      const fast = navneformer[del];
      if (fast !== undefined) return fast;
      if (juridiskeFormer.has(del) || !harVokal(del) || /\d/.test(del)) return del;
      if (/^[A-ZÆØÅ]\.$/.test(del)) return del;
      return (del[0] ?? "") + del.slice(1).toLocaleLowerCase("nb");
    })
    .join("");
}

/** Personnavn fra Brreg. Rolle-API-et gir blandet skrift; store bokstaver gjøres om. */
export function pentPersonNavn(deler: (string | null | undefined)[]): string {
  const t = deler
    .filter((d): d is string => typeof d === "string" && d.trim() !== "")
    .map((d) => d.trim())
    .join(" ")
    .replace(/\s+/g, " ");
  if (/[a-zæøå]/.test(t)) return t;
  return t
    .split(/(\s|-)/)
    .map((d) =>
      d === "" || /^(\s|-)$/.test(d) ? d : (d[0] ?? "") + d.slice(1).toLocaleLowerCase("nb"),
    )
    .join("");
}

/** YYYY-MM-DD i norsk tid. */
export function dagensDato(na: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(na);
}
