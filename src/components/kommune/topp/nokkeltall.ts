// Tallene i kartbladets rand, regnet fra datasettet (DESIGN.md §5.1). Ingen
// tall her er skrevet inn for hånd, og ingen av dem vet at de handler om
// Tromsø. Mangler grunnlaget for et tall, gir funksjonen `null`, og randen
// viser det som et hull.

import { avledBelegg, type AvledetBelegg } from "@/lib/belegg";
import type { BeleggUt, Eierandel, Endring, NokkeltallUt, OrganRef } from "@/lib/data";
import { dato, datoKort } from "@/lib/format";
import type { Kommuneside } from "@/lib/kommuneside";

const AKSJESELSKAP = new Set(["AS", "ASA"]);

/** Setene i kommunestyret. */
export function seter(side: Kommuneside) {
  const ks = side.oversikt.kommunestyre;
  if (!ks || ks.antall_medlemmer === null) return null;
  return { org: ks.org, antall: ks.antall_medlemmer, belegg: ks.belegg };
}

/**
 * Aksjeselskaper kommunen eier direkte, med oppgitt andel. Kommunale foretak
 * (KF) er ikke med: et KF er en del av kommunen, ikke en eierandel
 * (DESIGN.md §5.4).
 */
export function aksjeselskaper(side: Kommuneside) {
  const eier = side.eierskap.eier;
  if (!eier || side.eierskap.selskaper.length === 0) return null;
  const rader = side.eierskap.selskaper
    .filter((s) => s.ledd === 1 && AKSJESELSKAP.has(s.org.organtype))
    .map((s) => ({ org: s.org, andel: s.eiere.find((e) => e.org.key === eier.key) }))
    .filter((r): r is { org: OrganRef; andel: Eierandel & { andel: number } } =>
      Boolean(r.andel && r.andel.andel !== null),
    )
    .sort((a, b) => b.andel.andel - a.andel.andel || (a.org.key < b.org.key ? -1 : 1));
  const utenAndel = side.eierskap.selskaper.filter(
    (s) =>
      s.ledd === 1 &&
      AKSJESELSKAP.has(s.org.organtype) &&
      !s.eiere.some((e) => e.org.key === eier.key && e.andel !== null),
  ).length;
  const belegg: AvledetBelegg = avledBelegg(
    rader.map((r) => r.andel.belegg),
    {
      per: side.kommune.sammenstilt,
      merknad:
        `Telt fra eierandelene til ${eier.navn} i datasettet: aksjeselskaper kommunen eier direkte, der andelen er oppgitt.` +
        (utenAndel ? ` ${utenAndel} selskaper uten oppgitt andel er ikke med.` : "") +
        " Kommunale foretak er ikke med, fordi de er en del av kommunen.",
    },
  );
  return { eier, rader, utenAndel, belegg };
}

/** Er utbyttet et forslag? Datasettet sier det i fritekst, ikke i et felt. */
const FORSLAG = /foresl|forslag/i;

/**
 * Kommunens største utbytte, med totalen og hvordan den deles. `forslag` er
 * sann når kilden sier at beløpet er styrets forslag og ikke vedtatt.
 */
export function utbytte(side: Kommuneside) {
  const topp = side.oversikt.utbytte[0];
  if (!topp) return null;
  const flyt = side.eierskap.utbytte.find((u) => u.selskap.key === topp.selskap.key);
  const total: NokkeltallUt | null = flyt?.total ?? null;
  const sum = total?.verdi ?? flyt?.sum_mottakere ?? topp.belop_nok;
  const mottakere: Eierandel[] = flyt?.mottakere ?? [];
  const hendelse = side.endringer.skjedd.find(
    (e) => e.type === "utbytte" && e.org?.key === topp.selskap.key,
  );
  const tekster = [
    total?.belegg.merknad,
    topp.belegg.merknad,
    hendelse?.tittel,
    hendelse?.tekst,
  ].filter((t): t is string => Boolean(t));
  return {
    selskap: topp.selskap,
    belop: topp.belop_nok,
    belegg: topp.belegg as BeleggUt,
    total: sum,
    aar: total?.aar ?? null,
    mottakere,
    kommunenKey: side.eierskap.eier?.key ?? side.oversikt.kommuneorgan?.key ?? null,
    forslag: tekster.some((t) => FORSLAG.test(t)),
  };
}

/** Fyller en dato med kjent presisjon ut til en hel dag, midt i perioden. */
function midtI(iso: string): string {
  const [a, m, d] = iso.split("-");
  if (!m) return `${a}-07-01`;
  if (!d) return `${a}-${m}-15`;
  return iso;
}
const dagnummer = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
};

/**
 * Rollebytter fra 1. januar to år før sammenstillingen og fram til den. For et
 * datasett sammenstilt i 2026 er det «siden 1.1.2024». Vinduet følger datoen i
 * datasettet, ikke klokka.
 */
export function rollebytter(side: Kommuneside) {
  const til = side.kommune.sammenstilt;
  const fra = `${Number(til.slice(0, 4)) - 2}-01-01`;
  const start = dagnummer(fra);
  const slutt = dagnummer(til);
  const hendelser = side.endringer.skjedd
    .filter((e) => e.type === "rollebytte")
    .filter((e) => {
      // En hendelse med bare år eller måned teller når perioden starter i vinduet.
      const [a, m = "01", d = "01"] = e.dato.split("-");
      return `${a}-${m}-${d}` >= fra && midtI(e.dato) <= til;
    })
    .sort((a, b) => (a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : 0));
  const merker = hendelser.map((e: Endring) => ({
    hendelse: e,
    x: Math.min(1, Math.max(0, (dagnummer(midtI(e.dato)) - start) / (slutt - start))),
  }));
  const belegg = avledBelegg(
    hendelser.map((e) => e.belegg),
    {
      per: til,
      merknad: `Telt fra hendelsene av typen rollebytte i datasettet, fra ${dato(fra)} til sammenstillingen ${datoKort(til)}.`,
    },
  );
  return { fra, til, hendelser, merker, belegg };
}
