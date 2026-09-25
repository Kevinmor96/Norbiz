// Det Pengene-seksjonen viser, regnet fra datasettet (DESIGN.md §5.4). Ingen
// funksjon her vet hvilken kommune eller hvilket selskap det gjelder: det
// største utbyttet til kommunen finnes ved å lete, ikke ved navn.

import type {
  BeleggUt,
  Eierandel,
  Eierskap,
  Endringer,
  HullPunkt,
  Nokkeltalltype,
  NokkeltallUt,
  OrganRef,
} from "@/lib/data";
import type { Kommuneside } from "@/lib/kommuneside";
import { DEL_AV_EIEREN } from "@/lib/graf/modell";

const nb = new Intl.Collator("nb");
const etterNavn = (a: OrganRef, b: OrganRef) =>
  nb.compare(a.navn, b.navn) || (a.key < b.key ? -1 : 1);

/** Kilden sier at beløpet er et forslag. Datasettet har det i fritekst, ikke i et felt. */
const FORSLAG = /foresl|forslag/i;

/** Hull om eierskapet til kommunen selv: det som mangler i oversikten. */
const EIERHULL = /interkommunal|konsern|eierandel|eierskap|datterselskap/i;

export interface Eierrad {
  org: OrganRef;
  /** Kommunens andel, eller `null` når den ikke er oppgitt. */
  andel: number | null;
  belegg: BeleggUt;
  /** De andre eierne i datasettet, med andel når den er oppgitt. */
  andre: Eierandel[];
  /** Tallene fra siste regnskapsår i datasettet. */
  tall: NokkeltallUt[];
}

export interface Foretaksrad {
  org: OrganRef;
  belegg: BeleggUt;
  tall: NokkeltallUt[];
}

export interface Indirekterad {
  org: OrganRef;
  eiere: Eierandel[];
  tall: NokkeltallUt[];
}

/** Tallene fra det siste året selskapet har tall for. Utbyttet i elva tas ikke med to ganger. */
function sisteAar(tall: NokkeltallUt[], utenUtbytte: boolean): NokkeltallUt[] {
  const aktuelle = tall.filter((t) => !(utenUtbytte && t.type === "utbytte"));
  const aar = aktuelle[0]?.aar;
  return aar === undefined ? [] : aktuelle.filter((t) => t.aar === aar);
}

export function eierandeler(side: Kommuneside, elvSelskap: string | null) {
  const e: Eierskap = side.eierskap;
  const eier = e.eier;
  if (!eier) return null;

  const direkte: Eierrad[] = [];
  const foretak: Foretaksrad[] = [];
  const indirekte: Indirekterad[] = [];
  for (const s of e.selskaper) {
    const tall = sisteAar(s.nokkeltall, s.org.key === elvSelskap);
    const egen = s.eiere.find((x) => x.org.key === eier.key);
    if (s.ledd === 1 && egen) {
      if (DEL_AV_EIEREN.has(s.org.organtype)) {
        foretak.push({ org: s.org, belegg: egen.belegg, tall });
      } else {
        direkte.push({
          org: s.org,
          andel: egen.andel,
          belegg: egen.belegg,
          andre: s.eiere.filter((x) => x.org.key !== eier.key),
          tall,
        });
      }
    } else {
      indirekte.push({ org: s.org, eiere: s.eiere, tall });
    }
  }
  // Størst andel først. Ved lik andel kommer det største selskapet først, målt
  // i siste omsetning eller egenkapital. Ukjent andel sist, fordi den ikke kan
  // rangeres. Da står de viktigste øverst også når lista er lang.
  const storrelse = (r: Eierrad) =>
    Math.max(
      0,
      ...r.tall
        .filter((t) => t.type === "omsetning" || t.type === "egenkapital")
        .map((t) => t.verdi),
    );
  direkte.sort(
    (a, b) =>
      (a.andel === null ? 1 : 0) - (b.andel === null ? 1 : 0) ||
      (b.andel ?? 0) - (a.andel ?? 0) ||
      storrelse(b) - storrelse(a) ||
      etterNavn(a.org, b.org),
  );
  foretak.sort((a, b) => etterNavn(a.org, b.org));
  indirekte.sort((a, b) => etterNavn(a.org, b.org));

  const hull: HullPunkt[] = side.hull.filter(
    (h) => h.gjelder.key === eier.key && EIERHULL.test(`${h.hva} ${h.hvorfor}`),
  );

  return { eier, direkte, foretak, indirekte, hull };
}

export interface Mottaker {
  org: OrganRef;
  belop: number;
  andel: number | null;
  belegg: BeleggUt;
  erEieren: boolean;
}

/**
 * Utbyttet som elv: selskapet med det største utbyttet til kommunen, delt på
 * mottakerne. Finnes ingen utbytte til kommunen, brukes det største utbyttet
 * i eierkjeden. `null` når datasettet ikke har utbytte med beløp.
 */
export function utbytteElv(side: Kommuneside) {
  const e = side.eierskap;
  const eierKey = e.eier?.key ?? null;
  const tilEier = (u: Eierskap["utbytte"][number]) =>
    u.mottakere.find((m) => m.org.key === eierKey)?.belop_nok ?? 0;
  const total = (u: Eierskap["utbytte"][number]) => Math.max(u.total?.verdi ?? 0, u.sum_mottakere);
  const kandidater = e.utbytte.filter((u) => u.mottakere.some((m) => (m.belop_nok ?? 0) > 0));
  const valgt = [...kandidater].sort(
    (a, b) =>
      tilEier(b) - tilEier(a) || total(b) - total(a) || (a.selskap.key < b.selskap.key ? -1 : 1),
  )[0];
  if (!valgt) return null;

  const mottakere: Mottaker[] = valgt.mottakere
    .filter((m) => (m.belop_nok ?? 0) > 0)
    .map((m) => ({
      org: m.org,
      belop: m.belop_nok ?? 0,
      andel: m.andel,
      belegg: m.belegg,
      erEieren: m.org.key === eierKey,
    }));
  const sum = mottakere.reduce((s, m) => s + m.belop, 0);
  const totalbelop = Math.max(valgt.total?.verdi ?? 0, sum);

  const endringer = [...side.endringer.skjedd, ...side.endringer.ikke_skjedd].filter(
    (x: Endringer["skjedd"][number]) => x.type === "utbytte" && x.org?.key === valgt.selskap.key,
  );
  const hull = side.hull.filter(
    (h) => h.gjelder.key === valgt.selskap.key && /utbytte/i.test(h.hva),
  );
  const tekster = [
    valgt.total?.belegg.merknad,
    ...valgt.mottakere.map((m) => m.belegg.merknad),
    ...endringer.flatMap((x) => [x.tittel, x.tekst]),
    ...hull.map((h) => h.hva),
  ].filter((t): t is string => Boolean(t));

  return {
    selskap: valgt.selskap,
    totalbelop,
    /** Utbyttetallet selskapet selv har, med år og kilde. `null` når bare mottakernes beløp finnes. */
    totaltall: valgt.total,
    mottakere,
    /** Det som ikke er fordelt på mottakere i kilden. */
    ufordelt: Math.max(0, totalbelop - sum),
    forslag: tekster.some((t) => FORSLAG.test(t)),
    hull,
  };
}

/** Kommunens egne regnskapstall, gruppert på mål. Hvert mål står for seg. */
export function kommuneregnskap(side: Kommuneside) {
  const p = side.kommuneprofil;
  if (!p) return [];
  const grupper = new Map<Nokkeltalltype, NokkeltallUt[]>();
  for (const t of p.nokkeltall) grupper.set(t.type, [...(grupper.get(t.type) ?? []), t]);
  // Rekkefølgen er datakontraktens (nøkkeltallene er alt sortert på type innenfor året).
  const rekke: Nokkeltalltype[] = [];
  for (const t of p.nokkeltall) if (!rekke.includes(t.type)) rekke.push(t.type);
  const ordnet = [...rekke].sort((a, b) => TYPEREKKE.indexOf(a) - TYPEREKKE.indexOf(b));
  return ordnet.map((type) => ({
    type,
    tall: [...(grupper.get(type) ?? [])].sort((a, b) => b.aar - a.aar),
  }));
}

const TYPEREKKE: Nokkeltalltype[] = [
  "merforbruk",
  "underskudd",
  "driftsresultat",
  "aarsresultat",
  "resultat_for_skatt",
  "omsetning",
  "egenkapital",
  "utbytte",
  "omsatt_verdi",
  "aarsverk",
];

/** Kildens navn uten nettadressen i parentes: «Tromsø kommune (tromso.kommune.no)» blir «Tromsø kommune». */
export const kildeKort = (navn: string) => navn.replace(/\s*\([^)]*\)\s*$/, "");
