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

const NBSP = " ";

const heltall = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const endesimal = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const todesimaler = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

/** Intl bruker U+2212 som minus i nb-NO. Vi vil ha vanlig bindestrek-minus i tall. */
const rett = (s: string) => s.replace(/−/g, "-").replace(/[   ]/g, NBSP);

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

/**
 * Researchgrunnlaget merker usikre opplysninger med «[verifiser]». Den
 * teksten skal aldri nå leseren (DESIGN.md §3). Vi skriver hva som mangler og
 * hvor det skal hentes:
 *
 *   «merket [verifiser via innsyn.tromso.kommune.no]» → «merket «må verifiseres» mot innsyn.tromso.kommune.no»
 *   «merket [verifiser i Brreg]»                      → «merket «må verifiseres» i Brreg»
 *   «merket [verifiser]»                              → «merket «må verifiseres»»
 *
 * Bruk den på all fritekst fra datasettet: merknader, hull og beskrivelser.
 */
export function lesbar(tekst: string): string {
  return tekst.replace(/\[verifiser(?:\s+(via|i)\s+([^\]]+))?\]/gi, (_, prep, hvor) => {
    if (!hvor) return "«må verifiseres»";
    return `«må verifiseres» ${prep === "via" ? "mot" : "i"} ${String(hvor).trim()}`;
  });
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
