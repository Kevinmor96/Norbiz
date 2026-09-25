// Tall og datoer på norsk, slik DESIGN.md §9 skriver dem:
// «2 426 mill. kr», «19,07 mrd. kr», «70 mill. kr», «40 %», «14. mai 2025».
//
// Alle mellomrom mellom tall og enhet er harde (U+00A0), så «70 mill. kr»
// aldri brytes over to linjer. Tusenskilletegnet er også hardt.
//
// Ingen funksjon her leser klokka. Datoer kommer som ISO-strenger med den
// presisjonen kilden oppga (YYYY, YYYY-MM eller YYYY-MM-DD), og formateres uten
// Date-objekter, så tidssonen på serveren ikke kan flytte en dato en dag.

import type { Presisjon } from "@/lib/data";

const NBSP = "\u00a0";

const heltall = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const endesimal = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const todesimaler = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

/** Intl bruker U+2212 som minus i nb-NO. Vi vil ha vanlig bindestrek-minus i tall. */
const rett = (s: string) => s.replace(/\u2212/g, "-").replace(/[\u202f\u00a0 ]/g, NBSP);

/** «43», «2 426». */
export function tall(verdi: number): string {
  return rett(heltall.format(verdi));
}

/** «205,1», «2 426». Én desimal når den finnes. */
export function tallEnDesimal(verdi: number): string {
  return rett(endesimal.format(verdi));
}

/**
 * Kroner, skalert til det leseren kan lese:
 * under 1 mill. i hele kroner, under 10 mrd. i millioner (med én desimal når
 * den finnes), ellers i milliarder med to desimaler.
 *
 *   kroner(70e6)      → «70 mill. kr»
 *   kroner(205.1e6)   → «205,1 mill. kr»
 *   kroner(2426e6)    → «2 426 mill. kr»
 *   kroner(19.07e9)   → «19,07 mrd. kr»
 *   kroner(850_000)   → «850 000 kr»
 */
export function kroner(verdi: number): string {
  const abs = Math.abs(verdi);
  if (abs >= 1e10) return `${rett(todesimaler.format(verdi / 1e9))}${NBSP}mrd.${NBSP}kr`;
  if (abs >= 1e6) return `${rett(endesimal.format(verdi / 1e6))}${NBSP}mill.${NBSP}kr`;
  return `${rett(heltall.format(verdi))}${NBSP}kr`;
}

/** Bare tallet i millioner, til «70 av 175 mill. kr». */
export function millioner(verdi: number): string {
  return rett(endesimal.format(verdi / 1e6));
}

/** «40 %», «99,99 %», «16,67 %». Mellomrom foran prosenttegnet, som i norsk. */
export function prosent(verdi: number): string {
  return `${rett(todesimaler.format(verdi))}${NBSP}%`;
}

/** «940 101 808». */
export function orgnr(nr: string): string {
  const n = nr.replace(/\D/g, "");
  return n.length === 9 ? `${n.slice(0, 3)}${NBSP}${n.slice(3, 6)}${NBSP}${n.slice(6)}` : nr;
}

const MAANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

/** Presisjonen som ligger i selve strengen: 2016 → år, 2025-08 → måned. */
export function presisjonAv(iso: string): Presisjon {
  const deler = iso.split("-").length;
  return deler >= 3 ? "dag" : deler === 2 ? "maaned" : "aar";
}

/**
 * Dato med den presisjonen kilden har: «14. mai 2025», «august 2025», «2016».
 * Presisjonen kan overstyres nedover (en dag vist som måned), aldri oppover.
 */
export function dato(iso: string, presisjon: Presisjon = presisjonAv(iso)): string {
  const [aar, mnd, dag] = iso.split("-");
  const m = mnd ? MAANEDER[Number(mnd) - 1] : undefined;
  if (presisjon === "aar" || !m) return aar ?? iso;
  if (presisjon === "maaned" || !dag) return `${m}${NBSP}${aar}`;
  return `${Number(dag)}.${NBSP}${m}${NBSP}${aar}`;
}

/** «24.09.2026». Formen for nå-linjen: «Sammenstilt 24.09.2026». */
export function datoKort(iso: string): string {
  const [aar, mnd, dag] = iso.split("-");
  if (!mnd) return aar ?? iso;
  if (!dag) return `${mnd}.${aar}`;
  return `${dag}.${mnd}.${aar}`;
}

/** Dato i løpende tekst når den står først i en setning: «August 2025». */
export function datoStor(iso: string, presisjon?: Presisjon): string {
  const s = dato(iso, presisjon);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «1 merke», «143 merker». */
export function antall(n: number, entall: string, flertall: string): string {
  return `${tall(n)}${NBSP}${n === 1 ? entall : flertall}`;
}

// ---------------------------------------------------------------------------
// «[verifiser]»: grunnlagets merke skal aldri nå leseren (DESIGN.md §3)
// ---------------------------------------------------------------------------

/** «[verifiser via X]» og «[verifiser i X]»: hvor opplysningen skal hentes. */
function sted(inni: string | undefined): { prep: "mot" | "i"; hvor: string } | null {
  const m = /^\s*(via|i)\s+(.+)$/i.exec(inni ?? "");
  if (!m) return null;
  return { prep: m[1]!.toLowerCase() === "via" ? "mot" : "i", hvor: m[2]!.trim() };
}

/**
 * «[verifiser navn]», «[verifiser org.form]»: hva som skal verifiseres, når
 * grunnlaget sier det og det ikke står i setningen fra før.
 */
const GJENSTAND: Record<string, string> = {
  navn: "Navnet",
  "org.form": "Organisasjonsformen",
  orgform: "Organisasjonsformen",
  "org.nr.": "Org.nr.",
  dato: "Datoen",
};

/**
 * Researchgrunnlaget merker usikre opplysninger med «[verifiser]» i mange
 * former. Merket skal aldri nå leseren (DESIGN.md §3). Vi skriver hva som
 * mangler og hvor det skal hentes. Dette er den eneste funksjonen som gjør
 * det. Den tar alle former og er idempotent, så den kan kjøres på tekst som
 * alt er skrevet om.
 *
 *   «Merket [verifiser via innsyn.tromso.kommune.no] i grunnlaget.» → «Hentes fra innsyn.tromso.kommune.no.»
 *   «Merket [verifiser] via Rolle-API i grunnlaget.»                 → «Hentes fra Rolle-API.»
 *   «Merket [verifiser] i grunnlaget.»                               → «Grunnlaget merker opplysningen som usikker.»
 *   «Merket [verifiser navn] i grunnlaget.»                          → «Navnet må verifiseres.»
 *   «Org.nr. er merket [verifiser].»                                 → «Org.nr. må verifiseres.»
 *   «adm. dir. er merket [verifiser i Brreg]»                        → «adm. dir. må verifiseres i Brreg»
 *   «Per 2024, merket [verifiser] i grunnlaget.»                     → «Per 2024. Må verifiseres.»
 *   «[verifiser via X]» ellers                                       → ««må verifiseres» mot X»
 *
 * Bruk den på all fritekst fra datasettet: merknader, hull, titler og
 * beskrivelser. Loaderne kjører `lesbarDypt` på alt de sender til siden, så
 * merket heller ikke står i den serialiserte tilstanden i HTML-en.
 */
export function lesbar(tekst: string): string {
  if (!tekst.includes("[")) return tekst;
  let t = tekst;
  // «Merket [verifiser …] (via X) (og uverifisert) i grunnlaget.» som egen
  // setning. Stor M og setningsstart, så «Sluttdatoen er merket …» tas lenger ned.
  t = t.replace(
    /(^|[.!?]\s+)Merket \[verifiser([^\]]*)\](?:\s+via\s+([^.]+?))?(?:\s+og uverifisert)?\s+i grunnlaget\./g,
    (_, foran: string, inni: string, via: string | undefined) => {
      const hvor = sted(inni)?.hvor ?? via?.trim();
      if (hvor) return `${foran}Hentes fra ${hvor}.`;
      const hva = GJENSTAND[inni.trim().toLowerCase()];
      return `${foran}${hva ? `${hva} må verifiseres.` : "Grunnlaget merker opplysningen som usikker."}`;
    },
  );
  // «Per 2024, merket [verifiser] i grunnlaget.»
  t = t.replace(/,\s*merket \[verifiser([^\]]*)\](?:\s+i grunnlaget)?/gi, (_, inni: string) => {
    const h = sted(inni);
    return h ? `. Må verifiseres ${h.prep} ${h.hvor}` : ". Må verifiseres";
  });
  // «Org.nr. er merket [verifiser i Brreg] i grunnlaget.» → «Org.nr. må verifiseres i Brreg.»
  t = t.replace(/\ber merket \[verifiser([^\]]*)\](?:\s+i grunnlaget)?/gi, (_, inni: string) => {
    const h = sted(inni);
    return h ? `må verifiseres ${h.prep} ${h.hvor}` : "må verifiseres";
  });
  // Resten, i hvilken som helst form.
  t = t.replace(/\[\s*verifiser([^\]]*)\]/gi, (_, inni: string) => {
    const h = sted(inni);
    return h ? `«må verifiseres» ${h.prep} ${h.hvor}` : "«må verifiseres»";
  });
  return t;
}

/**
 * Hvor en manglende opplysning skal hentes, når grunnlaget sier det, eller
 * `null`. Leser både råteksten og teksten `lesbar` har skrevet om:
 * «[verifiser via innsyn.tromso.kommune.no]» og «Hentes fra
 * innsyn.tromso.kommune.no.» gir begge «innsyn.tromso.kommune.no».
 */
export function hentesFra(tekst: string): string | null {
  const t = lesbar(tekst);
  // Stedet slutter ved punktum fulgt av en ny setning, eller ved slutten. Da
  // avslutter ikke punktumene i «innsyn.tromso.kommune.no» det, og heller ikke
  // en stor bokstav inne i stedet, som i «organisasjonsform IKS».
  const m =
    /\bHentes fra (.+?)(?:\.(?=\s+[A-ZÆØÅ«])|\.?$)/.exec(t) ??
    /\bmå verifiseres»? (?:mot|i) (.+?)(?:\.(?=\s+[A-ZÆØÅ«])|[,;]|\.?$)/i.exec(t);
  return m ? m[1]!.trim() : null;
}

/**
 * `lesbar` på hver streng i et svar fra datalaget, uten å endre svaret selv.
 * Loaderne bruker den, fordi alt en loader returnerer, serialiseres inn i
 * HTML-en, og der leser både søkemotorer og «vis kilde».
 *
 * Et objekt som står flere steder i svaret, blir ett objekt i kopien også.
 * Serialiseringen skriver et delt objekt bare én gang, og en kopi per
 * forekomst ville gjort HTML-en større.
 */
export function lesbarDypt<T>(verdi: T): T {
  const sett = new WeakMap<object, unknown>();
  const gaa = (v: unknown): unknown => {
    if (typeof v === "string") return lesbar(v);
    if (v === null || typeof v !== "object") return v;
    const kjent = sett.get(v);
    if (kjent !== undefined) return kjent;
    if (Array.isArray(v)) {
      const ut: unknown[] = [];
      sett.set(v, ut);
      for (const x of v) ut.push(gaa(x));
      return ut;
    }
    // Bare vanlige objekter. Datoer, Map og klasser slippes gjennom urørt.
    if (Object.getPrototypeOf(v) !== Object.prototype) return v;
    const ut: Record<string, unknown> = {};
    sett.set(v, ut);
    for (const [k, x] of Object.entries(v)) ut[k] = gaa(x);
    return ut;
  };
  return gaa(verdi) as T;
}

/**
 * Binder de to siste ordene i en tekst med hardt mellomrom, så et kildemerke
 * etter teksten aldri står alene med ett ord på neste linje. Brukes av
 * `Pastand` i Kildemerke. Returnerer [alt før siste ord, siste ord].
 */
export function splittSisteOrd(tekst: string): [string, string] {
  const t = tekst.trimEnd();
  const i = t.search(/\S+$/);
  if (i <= 0) return ["", t];
  return [t.slice(0, i), t.slice(i)];
}
