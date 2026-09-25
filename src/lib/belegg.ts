// Ordene og reglene rundt belegg som UI-et deler: gradenes navn og forklaring,
// kildetypenes navn, og belegg for tall siden selv regner ut.
//
// Et tall siden teller opp («11 aksjeselskaper med oppgitt kommunal
// eierandel») har ingen kilde av seg selv. Det bygger på mange påstander. Det
// avledede belegget sier det rett ut: graden er den svakeste av delene, og
// kildelappen viser hvor mange påstander og hvilke kilder tallet bygger på.

import type { BeleggUt, KildeUt, Kildetype, Verifisering } from "@/lib/data";
import { VERIFISERINGER } from "@/lib/data/kontrakt";

export interface Grad {
  navn: string;
  /** Én linje, til tegnforklaringen. */
  kort: string;
  /** Hele forklaringen, til kildelappen og metoden. */
  lang: string;
}

export const GRADER: Record<Verifisering, Grad> = {
  verifisert: {
    navn: "Verifisert",
    kort: "Hentet av oss fra kilden, med tidsstempel.",
    lang: "Hentet av Maktkarts egen innhenting direkte fra registeret, med hentedatoen. Bare det innhentingen selv har hentet, har denne graden.",
  },
  oppgitt: {
    navn: "Oppgitt",
    kort: "Står i grunnlaget med en navngitt kilde.",
    lang: "Står i researchgrunnlaget med en navngitt kilde, men er ikke etterprøvd av oss.",
  },
  maa_verifiseres: {
    navn: "Må verifiseres",
    kort: "Ikke etterprøvd, eller fra Proff og Purehelp.",
    lang: "Merket som uverifisert, trolig eller antakelse i grunnlaget, hentet fra Proff eller Purehelp, eller uten kilde for raden. Skal sjekkes mot registeret.",
  },
};

/** Rekkefølgen gradene vises i: sterkest først, som i datakontrakten. */
export const GRADREKKEFOLGE = VERIFISERINGER;

export const KILDETYPER: Record<Kildetype, string> = {
  register: "Register",
  offisiell: "Organets egen side",
  media: "Redaksjonell kilde",
  sekundaer: "Videreformidler av registerdata",
  oppslagsverk: "Oppslagsverk",
};

/** Belegg for et tall siden regner ut fra flere påstander. */
export interface AvledetBelegg {
  avledet: true;
  /** Den svakeste graden blant delene. */
  verifisering: Verifisering;
  /** Datoen tallet gjelder, vanligvis datoen datasettet ble sammenstilt. */
  per: string | null;
  merknad: string;
  /** Hvor mange påstander tallet bygger på. */
  antall: number;
  /** Kildene bak delene, sortert på hvor mange påstander hver bærer. */
  kilder: KildeUt[];
}

export type Belegg = BeleggUt | AvledetBelegg;

export const erAvledet = (b: Belegg): b is AvledetBelegg => "avledet" in b;

/** Den svakeste graden i lista. Tom liste gir «må verifiseres»: ingen belegg er ikke belegg. */
export function svakeste(grader: Verifisering[]): Verifisering {
  let svakest = -1;
  for (const g of grader) svakest = Math.max(svakest, GRADREKKEFOLGE.indexOf(g));
  return GRADREKKEFOLGE[svakest] ?? "maa_verifiseres";
}

/**
 * Lager belegget for et opptalt tall.
 *
 *   avledBelegg(eierandeler.map((e) => e.belegg), {
 *     per: kommune.sammenstilt,
 *     merknad: "Telt fra eierandelene i datasettet.",
 *   })
 */
export function avledBelegg(
  deler: BeleggUt[],
  { per, merknad }: { per: string | null; merknad: string },
): AvledetBelegg {
  const telling = new Map<string, { kilde: KildeUt; n: number }>();
  for (const d of deler) {
    const t = telling.get(d.kilde.key);
    if (t) t.n += 1;
    else telling.set(d.kilde.key, { kilde: d.kilde, n: 1 });
  }
  return {
    avledet: true,
    verifisering: svakeste(deler.map((d) => d.verifisering)),
    per,
    merknad,
    antall: deler.length,
    kilder: [...telling.values()]
      .sort((a, b) => b.n - a.n || (a.kilde.key < b.kilde.key ? -1 : 1))
      .map((t) => t.kilde),
  };
}
