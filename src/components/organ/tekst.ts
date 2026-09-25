// Ordene og reglene rundt et organ som flere flater deler: kortet i
// organkartet, organskuffen, organsiden og bransjematrisen. Samlet her så en
// rolle, et hull eller en eierandel skrives likt overalt.
//
// Ingen React og ingen klokke. Alt regnes fra datalaget.

import type {
  HullPunkt,
  Myndighet,
  NokkeltallUt,
  Organtype,
  Relasjonstype,
  Rolle,
  Rollestatus,
} from "@/lib/data";
import { LEDERTYPER } from "@/lib/data/kontrakt";
import { dato, hentesFra as hentesFraTekst, kroner, tall } from "@/lib/format";

// ---------------------------------------------------------------------------
// Fritekst fra datasettet
// ---------------------------------------------------------------------------

// Fritekst skrives om med `lesbar()` fra src/lib/format.ts. Den er den eneste
// funksjonen som fjerner «[verifiser]», så organflatene og resten av siden
// skriver et hull likt.

/**
 * Tekst til søk: små bokstaver, uten aksenter, med ø og æ skrevet om. Samme
 * regel på søket og på det det søkes i. Brreg-lærdommen: «HERMÈS NORWAY AS»
 * skal finnes med «hermes».
 */
export function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/\s+/g, " ");
}

/** Første setning i en tekst. Til kort der hele hull-teksten ikke får plass. */
export function forsteSetning(tekst: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(tekst.trim());
  return m ? m[1]! : tekst.trim();
}

// ---------------------------------------------------------------------------
// Hull: det grunnlaget nevner, men som ikke kan vises som fakta
// ---------------------------------------------------------------------------

/**
 * «Kildene er uenige» (DESIGN.md §3, fra retning A). Datasettet har ikke et
 * eget felt for motstridende kilder. Konflikten står som et hull der grunnen
 * sier at kildene er i konflikt, som for styringsmodellen i Troms
 * fylkeskommune. Regelen er derfor en tekstregel, og den står her, ett sted.
 * Et strukturert felt (for eksempel `Hull.type = 'konflikt'`) bør erstatte den.
 */
export function erKonflikt(h: Pick<HullPunkt, "hva" | "hvorfor">): boolean {
  return /kildene er (i konflikt|uenige)|kildene spriker|motstrid/i.test(`${h.hva} ${h.hvorfor}`);
}

/** Hull om ledelsen: «Leder og medlemmer er ikke navngitt», «Adm. dir. er ikke navngitt». */
export function erLederhull(h: Pick<HullPunkt, "hva">): boolean {
  return /ikke navngitt|ledelsen|ledere\b/i.test(h.hva);
}

/**
 * Hvor en manglende opplysning skal hentes, når grunnlaget sier det:
 * «Merket [verifiser via innsyn.tromso.kommune.no] i grunnlaget.» gir
 * «innsyn.tromso.kommune.no». Regelen står i `hentesFra` i src/lib/format.ts.
 */
export function hentesFra(h: Pick<HullPunkt, "hvorfor">): string | null {
  return hentesFraTekst(h.hvorfor);
}

/** Hvor ledelsen skal hentes fra, fra organets hull, eller `null`. */
export function lederHentesFra(hull: readonly HullPunkt[]): string | null {
  for (const h of hull) {
    if (!erLederhull(h)) continue;
    const hvor = hentesFra(h);
    if (hvor) return hvor;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Roller
// ---------------------------------------------------------------------------

export const erLederrolle = (r: Pick<Rolle, "rolletype">) =>
  (LEDERTYPER as readonly string[]).includes(r.rolletype);

/**
 * Rollene i skuffen og på organsiden grupperes, så et organ med et helt styre
 * og mange varamedlemmer fortsatt er lett å lese: ledelsen først, så styret
 * eller medlemmene, varamedlemmene sammenfoldet til slutt.
 */
export type Rollegruppe = "ledelse" | "styre" | "medlemmer" | "vara" | "andre";

export const ROLLEGRUPPER: readonly { id: Rollegruppe; navn: string }[] = [
  { id: "ledelse", navn: "Ledelse" },
  { id: "styre", navn: "Styret" },
  { id: "medlemmer", navn: "Medlemmer" },
  { id: "andre", navn: "Andre roller" },
  { id: "vara", navn: "Varamedlemmer" },
];

/**
 * Gruppen til en rolle. `selskap` avgjør nestlederen: i et selskap sitter
 * nestlederen i styret, i et folkevalgt organ hører hen til ledelsen.
 */
export function rollegruppe(r: Pick<Rolle, "rolletype" | "status">, selskap: boolean): Rollegruppe {
  if (r.rolletype === "varamedlem" || r.status === "vara") return "vara";
  switch (r.rolletype) {
    case "styreleder":
    case "styremedlem":
      return "styre";
    case "nestleder":
      return selskap ? "styre" : "ledelse";
    case "folkevalgt":
    case "utvalgsmedlem":
      return "medlemmer";
    case "tillitsvalgt":
      return "andre";
    default:
      return "ledelse";
  }
}

/** Statusen slik leseren ser den. `fast` vises ikke: det er normaltilstanden. */
export const STATUSNAVN: Record<Rollestatus, string | null> = {
  fast: null,
  fungerende: "fungerende",
  konstituert: "konstituert",
  permisjon: "i permisjon",
  vara: "vara",
};

/** «Ordfører Gunnar Wilhelmsen (Ap)». Til kildelappen og skjermlesere. */
export function rollePastand(r: Rolle, organnavn: string): string {
  const status = STATUSNAVN[r.status];
  return `${r.tittel} i ${organnavn}: ${r.person.navn}${r.parti ? ` (${r.parti})` : ""}${status ? `, ${status}` : ""}`;
}

/**
 * Tiden rollen gjelder, som tekst. En forventet slutt er planlagt og har ikke
 * skjedd, så den skilles fra en slutt som har skjedd.
 */
export function rolleTid(r: Rolle): { tekst: string | null; planlagt: string | null } {
  const fra = r.fra ? dato(r.fra) : null;
  // Motsagt av registeret: vi vet ikke når rollen eventuelt sluttet, så det
  // står ingen sluttdato. Merknaden i kildemerket sier hva registeret har.
  if (r.motsagt)
    return {
      tekst: fra ? `fra ${fra}, motsagt av registeret` : "motsagt av registeret",
      planlagt: null,
    };
  if (r.til)
    return { tekst: fra ? `${fra} til ${dato(r.til)}` : `til ${dato(r.til)}`, planlagt: null };
  return {
    tekst: fra ? `fra ${fra}` : null,
    planlagt: r.til_forventet ? `til ${dato(r.til_forventet)}` : null,
  };
}

// ---------------------------------------------------------------------------
// Myndighet
// ---------------------------------------------------------------------------

/**
 * Myndighetene i lag, fra den som avgjør saken til den som gir råd. Brukes
 * av organkartet til å velge hvilke organer et sammenfoldet bånd viser først,
 * og av bransjematrisen til å gruppere kolonnene. Laget sier hva slags makt,
 * ikke hvor mye.
 */
export const MYNDIGHETSLAG: readonly { navn: string; myndigheter: readonly Myndighet[] }[] = [
  { navn: "Vedtar og forbereder", myndigheter: ["vedtak", "planmyndighet", "innstilling"] },
  { navn: "Kontrollerer", myndigheter: ["klage", "tilsyn", "konsesjon", "regelverk"] },
  { navn: "Penger", myndigheter: ["finansiering", "innkjop", "eierskap"] },
  { navn: "Påvirker", myndigheter: ["raadgivning", "lobby"] },
];

/** Laget til den sterkeste myndigheten organet har. Ingen myndighet gir laget etter det siste. */
export function myndighetslag(myndighet: readonly Myndighet[]): number {
  let best = MYNDIGHETSLAG.length;
  for (const m of myndighet) {
    const i = MYNDIGHETSLAG.findIndex((l) => l.myndigheter.includes(m));
    if (i >= 0 && i < best) best = i;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Organtyper
// ---------------------------------------------------------------------------

/** Kommunale og fylkeskommunale foretak er en del av kommunen eller fylket, ikke en eierandel. */
export const erForetak = (t: Organtype) => t === "KF" || t === "FKF";

/** Organtyper som leverer regnskap. Mangler de nøkkeltall, sier profilen hvor de skal hentes. */
export const REGNSKAPSTYPER: readonly Organtype[] = [
  "AS",
  "ASA",
  "SA",
  "IKS",
  "sparebank",
  "stiftelse",
  "saerlovselskap",
  "HF",
  "RHF",
];

// ---------------------------------------------------------------------------
// Nøkkeltall
// ---------------------------------------------------------------------------

/** «2025», «1. halvår 2026», «2. kvartal 2025». */
export function regnskapsperiode(n: Pick<NokkeltallUt, "aar" | "periode">): string {
  if (!n.periode) return String(n.aar);
  const h = /^H([12])$/i.exec(n.periode);
  if (h) return `${h[1]}. halvår ${n.aar}`;
  const q = /^Q([1-4])$/i.exec(n.periode);
  if (q) return `${q[1]}. kvartal ${n.aar}`;
  return `${n.periode} ${n.aar}`;
}

/** Morselskap eller konsern, bare der kilden skiller dem. */
export function konsernmerke(n: Pick<NokkeltallUt, "konsern">): string | null {
  if (n.konsern === true) return "konsern";
  if (n.konsern === false) return "morselskap";
  return null;
}

/**
 * Et beløp på en eierrelasjon er eierens del av utbyttet (se `Eierskap` i
 * kontrakt.ts). Datasettet har ikke eget felt for om utbyttet er vedtatt, så
 * «foreslått» leses fra merknaden, som toppen gjør. Et forslag har ikke skjedd.
 */
export function erForeslatt(merknad: string | null): boolean {
  return merknad !== null && /foresl|forslag/i.test(merknad);
}

/** Verdien med enhet: «2 426 mill. kr», «3 600 årsverk». */
export function nokkelverdi(n: Pick<NokkeltallUt, "verdi" | "enhet">): string {
  return n.enhet === "aarsverk" ? `${tall(n.verdi)}\u00a0årsverk` : kroner(n.verdi);
}

// ---------------------------------------------------------------------------
// Relasjoner
// ---------------------------------------------------------------------------

/** Hvordan en relasjon leses fra organet i profilen, ut og inn. */
export const RELASJONSNAVN: Record<Relasjonstype, { ut: string; inn: string }> = {
  eier: { ut: "Eier", inn: "Eies av" },
  overordnet: { ut: "Hører under", inn: "Har under seg" },
  medlem_av: { ut: "Medlem av", inn: "Medlemmer" },
  sammenslatt_til: { ut: "Slått sammen til", inn: "Slått sammen fra" },
  // Datasettet fører delingen fra det gamle organet til det nye:
  // Troms og Finnmark → Troms fylkeskommune, «gjenopprettet 1.1.2024».
  splittet_fra: { ut: "Delt til", inn: "Delt fra" },
  erstattet_av: { ut: "Erstattet av", inn: "Erstattet" },
  samarbeid: { ut: "Samarbeider med", inn: "Samarbeider med" },
  finansierer: { ut: "Finansierer", inn: "Finansieres av" },
  klageinstans_for: { ut: "Klageinstans for", inn: "Klager behandles av" },
  tilsyn_med: { ut: "Fører tilsyn med", inn: "Under tilsyn av" },
  leverandor_til: { ut: "Leverandør til", inn: "Leverandører" },
};
