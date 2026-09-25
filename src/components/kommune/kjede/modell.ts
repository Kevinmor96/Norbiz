// Beslutningskjeden som orienteringsløype: fra datalagets `Beslutningskjede`
// til postene løypa og stegene tegnes fra. Alt her er rene funksjoner, så
// server og klient regner det samme.
//
// Løypa har tre symboler (DESIGN.md §5.2): starttrekant, post i ring og dobbel
// ring ved vedtaket. Klage er en stiplet etappe, fordi den bare skjer hvis noen
// klager. Et steg datasettet ikke kan fylle, står som posten «Ikke kartlagt».

import type {
  Beslutningskjede,
  BeleggUt,
  HullPunkt,
  Myndighet,
  Organkart,
  OrganKort,
  OrganRef,
  Rolle,
} from "@/lib/data";

import { erNavnehull, hullhint, type Hullhint } from "./hull";

export type Postform = "start" | "post" | "maal" | "mangler";

/**
 * Radien til postsymbolet i løypekartet (se symboler.tsx). Etappene kortes med
 * den, så streken stopper ved ringen i stedet for å gå gjennom den.
 */
export const POSTRADIUS: Record<Postform, number> = {
  start: 21,
  post: 18,
  maal: 22,
  mangler: 18,
};

export interface Post {
  /** Plassen i løypa, fra 0. Etappe `indeks` går fra forrige post til denne. */
  indeks: number;
  /** Stegnummeret i datasettet, fra 1. `null` for en post som ikke er kartlagt. */
  nr: number | null;
  form: Postform;
  org: OrganRef | null;
  /** Hele organet fra organkartet, når det står der: medlemstall og belegg. */
  organ: OrganKort | null;
  myndighet: Myndighet | null;
  hva: string;
  belegg: BeleggUt | null;
  ledere: Rolle[];
  /** Innstilling: den som skriver saken, former vedtaket. */
  forberedende: boolean;
  /** Etappen hit skjer bare hvis noen klager. */
  klage: boolean;
  /** Hvorfor lederen mangler, og hvor navnet skal hentes. Bare når `ledere` er tom. */
  lederhull: Hullhint | null;
  /** Andre navn som mangler i organet, som laget under lederen. */
  navnehull: Hullhint[];
}

export interface Loype {
  key: string;
  tittel: string;
  sporsmal: string;
  poster: Post[];
  /** Stegene i datasettet, uten poster som ikke er kartlagt. */
  steg: Post[];
}

/** Tekst for en post som mangler etter vedtaket. Sier noe om datasettet, ikke om loven. */
const ETTER_VEDTAKET =
  "Datasettet sier ikke hvem som kan overprøve vedtaket. Steget står åpent til det er kartlagt.";

export function byggLoype(kjede: Beslutningskjede, hull: HullPunkt[], organkart: Organkart): Loype {
  const organer = new Map<string, OrganKort>();
  for (const g of organkart.grupper) for (const o of g.organer) organer.set(o.key, o);

  const forsteVedtak = kjede.steg.findIndex((s) => s.myndighet === "vedtak");
  const poster: Post[] = kjede.steg.map((s, i) => {
    // Datalaget lover et organ per steg, men Supabase kan levere null for et
    // organ som er sperret eller slettet. Da er steget ikke kartlagt.
    const org = (s.org as OrganRef | null) ?? null;
    const organhull = org ? hull.filter((h) => h.gjelder.key === org.key && erNavnehull(h)) : [];
    const lederhullRaa =
      s.ledere.length === 0
        ? (organhull.find((h) => /leder|ledelse/i.test(h.hva)) ?? organhull[0] ?? null)
        : null;
    const form: Postform = !org
      ? "mangler"
      : i === forsteVedtak
        ? "maal"
        : i === 0
          ? "start"
          : "post";
    return {
      indeks: i,
      nr: s.nr,
      form,
      org,
      organ: org ? (organer.get(org.key) ?? null) : null,
      myndighet: s.myndighet,
      hva: s.hva,
      belegg: s.belegg,
      ledere: s.ledere,
      forberedende: s.myndighet === "innstilling",
      klage: s.myndighet === "klage",
      lederhull: lederhullRaa ? hullhint(lederhullRaa) : null,
      navnehull: organhull.filter((h) => h !== lederhullRaa).map(hullhint),
    };
  });

  // Ender kjeden ved vedtaket, vet datasettet ikke hva som kan skje etterpå.
  // Det vises som en åpen post, ikke som en tom plass.
  const sisteSteg = kjede.steg[kjede.steg.length - 1];
  if (sisteSteg?.myndighet === "vedtak") {
    poster.push({
      indeks: poster.length,
      nr: null,
      form: "mangler",
      org: null,
      organ: null,
      myndighet: null,
      hva: ETTER_VEDTAKET,
      belegg: null,
      ledere: [],
      forberedende: false,
      klage: false,
      lederhull: null,
      navnehull: [],
    });
  }

  return {
    key: kjede.prosess.key,
    tittel: kjede.prosess.tittel,
    sporsmal: kjede.prosess.sporsmal,
    poster,
    steg: poster.filter((p) => p.nr !== null && p.org !== null),
  };
}

/**
 * Hvilken prosess som vises først: den lengste kjeden, så den med flest
 * forberedende steg. Da ser leseren mest av det Maktkart viser, uten at malen
 * vet hvilken prosess det er.
 */
export function rangerLoyper(loyper: Loype[]): Loype[] {
  const innst = (l: Loype) => l.steg.filter((s) => s.forberedende).length;
  return loyper
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l.steg.length - a.l.steg.length || innst(b.l) - innst(a.l) || a.i - b.i)
    .map((x) => x.l);
}

/** Organets navn i løypa og framdriften: kortnavnet når det finnes. */
export function kortnavn(org: OrganRef): string {
  return org.kortnavn ?? org.navn;
}

const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ingressen, regnet fra kjeden: hvem som vedtar, om saken formes før, og om den kan påklages. */
export function ingress(l: Loype): string {
  const vedtak = l.steg.find((s) => s.myndighet === "vedtak");
  if (!l.steg.length) return "Kjeden for denne saken er ikke kartlagt ennå.";
  if (!vedtak?.org) return "Følg saken steg for steg, fra den skrives til den avgjøres.";
  const formesFoer = l.steg.some((s) => s.forberedende && s.indeks < vedtak.indeks);
  const kanPaaklages = l.steg.some((s) => s.klage && s.indeks > vedtak.indeks);
  const hvem = stor(kortnavn(vedtak.org));
  if (!formesFoer) return `${hvem} fatter vedtaket. Følg saken steg for steg.`;
  return `${hvem} fatter vedtaket, men saken formes før den kommer dit. Følg den fra den skrives til ${
    kanPaaklages ? "den kan påklages" : "den er vedtatt"
  }.`;
}

export interface Oppsummering {
  /** Steg uten navngitt leder. */
  uten: number;
  /** Stegene i datasettet. */
  av: number;
  /** Setningen etter «{uten} av {av} steg», eller hele setningen når `uten` er 0. */
  tekst: string;
  /** Belegget tellingen bygger på: stegene og lederne. */
  deler: BeleggUt[];
}

/**
 * Setningen fra B: «2 av 4 steg har ingen navngitt leder i datasettet, og det
 * er stegene der saken skrives. Det er dette laget Maktkart skal fylle.»
 *
 * Bare det datasettet bærer, blir sagt. «Stegene der saken skrives» står bare
 * når stegene uten leder faktisk er innstillingssteg. Har alle steg leder,
 * sier setningen det rolig, uten drama.
 */
export function oppsummering(l: Loype): Oppsummering | null {
  const steg = l.steg;
  if (!steg.length) return null;
  const deler = steg.flatMap((s) => [
    ...(s.belegg ? [s.belegg] : []),
    ...s.ledere.map((r) => r.belegg),
  ]);
  const uten = steg.filter((s) => s.ledere.length === 0);
  const innst = steg.filter((s) => s.forberedende);
  const aapenEtter = l.poster.some((p) => p.form === "mangler" && p.nr === null);

  if (uten.length === 0) {
    const alle =
      steg.length === 1
        ? "Steget har en navngitt leder i datasettet."
        : steg.length === 2
          ? "Begge stegene har en navngitt leder i datasettet."
          : `Alle ${steg.length} stegene har en navngitt leder i datasettet.`;
    return {
      uten: 0,
      av: steg.length,
      tekst: aapenEtter ? `${alle} Hvem som kan overprøve vedtaket, er ikke kartlagt.` : alle,
      deler,
    };
  }

  let tekst = "har ingen navngitt leder i datasettet";
  if (uten.every((s) => s.forberedende)) {
    if (uten.length === innst.length) {
      tekst +=
        uten.length === 1
          ? ", og det er steget der saken skrives."
          : ", og det er stegene der saken skrives.";
    } else {
      tekst +=
        uten.length === 1
          ? ", og det er ett av stegene der saken skrives."
          : ", og alle er steg der saken skrives.";
    }
    tekst += " Det er dette laget Maktkart skal fylle.";
  } else {
    tekst += " ennå.";
  }
  return { uten: uten.length, av: steg.length, tekst, deler };
}
