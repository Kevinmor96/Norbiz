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
import { dato, kroner, lesbar, tall } from "@/lib/format";

// ---------------------------------------------------------------------------
// Fritekst fra datasettet
// ---------------------------------------------------------------------------

/**
 * Fritekst fra datasettet, skrevet om så «[verifiser]» aldri når leseren
 * (DESIGN.md §3). Grunnlaget skriver «Merket [verifiser via X] i
 * grunnlaget.». Leseren trenger å vite hva som mangler og hvor det skal
 * hentes, så det blir «Hentes fra X.».
 *
 * `lesbar()` i src/lib/format.ts dekker bare «[verifiser]», «[verifiser via
 * X]» og «[verifiser i X]». Datasettet har også «[verifiser navn]» og
 * «[verifiser org.form]», så denne tar alle former og faller til slutt tilbake
 * på «må verifiseres».
 */
export function ren(tekst: string): string {
  const hvorFra = (inni: string | undefined) => {
    const m = /^\s*(via|i)\s+(.+)$/i.exec(inni ?? "");
    return m ? { prep: m[1]!.toLowerCase(), hvor: m[2]!.trim() } : null;
  };
  let t = tekst;
  // «Merket [verifiser …] (via X) (og uverifisert) i grunnlaget.» som egen setning.
  // Stor M og setningsstart, så «Sluttdatoen er merket …» ikke tas her.
  t = t.replace(
    /(^|[.!?]\s+)Merket \[verifiser([^\]]*)\](?:\s+via\s+([^.]+?))?(?:\s+og uverifisert)?\s+i grunnlaget\./g,
    (_, foran: string, inni: string, via: string | undefined) => {
      const hvor = hvorFra(inni)?.hvor ?? via?.trim();
      return `${foran}${hvor ? `Hentes fra ${hvor}.` : "Grunnlaget merker opplysningen som usikker."}`;
    },
  );
  // «Per 2024, merket [verifiser] i grunnlaget.»
  t = t.replace(/,\s*merket \[verifiser([^\]]*)\](?:\s+i grunnlaget)?/gi, (_, inni: string) => {
    const h = hvorFra(inni);
    return h ? `. Må verifiseres ${h.prep === "via" ? "mot" : "i"} ${h.hvor}` : ". Må verifiseres";
  });
  // «Org.nr. er merket [verifiser i Brreg] i grunnlaget.» → «Org.nr. må verifiseres i Brreg.»
  t = t.replace(/\ber merket \[verifiser([^\]]*)\](?:\s+i grunnlaget)?/gi, (_, inni: string) => {
    const h = hvorFra(inni);
    return h ? `må verifiseres ${h.prep === "via" ? "mot" : "i"} ${h.hvor}` : "må verifiseres";
  });
  // Resten, i hvilken som helst form.
  t = t.replace(/\[verifiser([^\]]*)\]/gi, (_, inni: string) => {
    const h = hvorFra(inni);
    return h ? `«må verifiseres» ${h.prep === "via" ? "mot" : "i"} ${h.hvor}` : "«må verifiseres»";
  });
  return lesbar(t);
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
 * «[verifiser via innsyn.tromso.kommune.no]» gir «innsyn.tromso.kommune.no».
 */
export function hentesFra(h: Pick<HullPunkt, "hvorfor">): string | null {
  const m =
    /\[verifiser\s+(?:via|i)\s+([^\]]+)\]/i.exec(h.hvorfor) ??
    /\[verifiser[^\]]*\]\s+via\s+([^.]+?)\s+i grunnlaget/i.exec(h.hvorfor);
  return m ? m[1]!.trim() : null;
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
  if (r.til) return { tekst: fra ? `${fra} til ${dato(r.til)}` : `til ${dato(r.til)}`, planlagt: null };
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
  return merknad !== null && /foresl/i.test(merknad);
}

/** Verdien med enhet: «2 426 mill. kr», «3 600 årsverk». */
export function nokkelverdi(n: Pick<NokkeltallUt, "verdi" | "enhet">): string {
  return n.enhet === "aarsverk" ? `${tall(n.verdi)} årsverk` : kroner(n.verdi);
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
