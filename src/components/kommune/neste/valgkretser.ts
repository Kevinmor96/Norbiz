// Valgkretsene kartbladoversikten viser, og malen en kommune får før den er
// kartlagt. Dette er data, ikke design: komponentene vet ikke hvilken
// valgkrets eller hvilke kommuner det gjelder, og en ny valgkrets legges til
// her uten at noe annet endres.
//
// Kommunene står bare her når grunnlaget navngir dem. Tromsøs grunnlag lister
// de 21 kommunene i Troms valgkrets (researchgrunnlaget §1.5). Andre fylker har
// ingen liste ennå, og da viser oversikten bare kommunene som har datasett.
//
// Kommunenumrene står ikke i grunnlaget. De er satt etter kommuneinndelingen
// fra 1.1.2024 og sjekket mot Postens postnummerregister slik npm-pakken
// «postnummer» 2.0.0 gjengir det. Det er en videreformidler, så numrene er
// «må verifiseres» til de er hentet fra SSBs klassifikasjon 131. Numrene betyr
// noe: stemmene lagres på kommunenummer (tabellen venteliste).

import type { BeleggUt, KildeUt, Kommune } from "@/lib/data";

const RESEARCHGRUNNLAGET: KildeUt = {
  key: "researchgrunnlag",
  navn: "Researchgrunnlaget for Maktkart (sammenstilt 24.09.2026)",
  url: null,
  type: "sekundaer",
  lisens: null,
};

const POSTNUMMERREGISTERET: KildeUt = {
  key: "postnummerregisteret",
  navn: "Postnummerregisteret fra Posten, gjengitt i npm-pakken postnummer 2.0.0",
  url: "https://www.npmjs.com/package/postnummer",
  type: "sekundaer",
  lisens: "MIT (pakken)",
};

export interface Valgkrets {
  /** Fylkesnummeret valgkretsen følger. Slås opp fra `kommune.fylkesnr`. */
  fylkesnr: string;
  navn: string;
  /** I grunnlagets rekkefølge. Oversikten sorterer selv. */
  kommuner: { kommunenr: string; navn: string }[];
  /** Belegg for at kommunene hører til valgkretsen. */
  belegg: BeleggUt;
  /** Belegg for kommunenumrene. */
  nummerbelegg: BeleggUt;
}

export const VALGKRETSER: readonly Valgkrets[] = [
  {
    fylkesnr: "55",
    navn: "Troms valgkrets",
    kommuner: [
      { kommunenr: "5532", navn: "Balsfjord" },
      { kommunenr: "5520", navn: "Bardu" },
      { kommunenr: "5528", navn: "Dyrøy" },
      { kommunenr: "5516", navn: "Gratangen" },
      { kommunenr: "5503", navn: "Harstad" },
      { kommunenr: "5514", navn: "Ibestad" },
      { kommunenr: "5540", navn: "Gáivuotna-Kåfjord" },
      { kommunenr: "5534", navn: "Karlsøy" },
      { kommunenr: "5510", navn: "Kvæfjord" },
      { kommunenr: "5546", navn: "Kvænangen" },
      { kommunenr: "5518", navn: "Lavangen" },
      { kommunenr: "5536", navn: "Lyngen" },
      { kommunenr: "5524", navn: "Målselv" },
      { kommunenr: "5544", navn: "Nordreisa" },
      { kommunenr: "5522", navn: "Salangen" },
      { kommunenr: "5530", navn: "Senja" },
      { kommunenr: "5542", navn: "Skjervøy" },
      { kommunenr: "5526", navn: "Sørreisa" },
      { kommunenr: "5538", navn: "Storfjord" },
      { kommunenr: "5512", navn: "Tjeldsund" },
      { kommunenr: "5501", navn: "Tromsø" },
    ],
    belegg: {
      kilde: RESEARCHGRUNNLAGET,
      verifisering: "oppgitt",
      per: "2026-09-24",
      merknad: "Researchgrunnlaget §1.5 lister de 21 kommunene i Troms valgkrets.",
      hentet: null,
    },
    nummerbelegg: {
      kilde: POSTNUMMERREGISTERET,
      verifisering: "maa_verifiseres",
      per: "2025-12",
      merknad:
        "Kommunenumrene står ikke i grunnlaget. De følger kommuneinndelingen fra 1.1.2024 og er sjekket mot postnummerregisteret. De skal hentes fra SSBs klassifikasjon 131.",
      hentet: null,
    },
  },
];

/**
 * Det en kommune har i grunnlagets generiske struktur (§1.5): «kommunestyre →
 * formannskap → hovedutvalg/plan-utvalg → kontrollutvalg → klagenemnd →
 * lovpålagte råd → kommunedirektør → sektorledere → KF/AS/IKS». Dette er
 * rutene en tom kommune viser før noe er kartlagt.
 */
export const KOMMUNEMAL: readonly { navn: string; hva: "leder" | "organer" }[] = [
  { navn: "Kommunestyret", hva: "leder" },
  { navn: "Formannskapet", hva: "leder" },
  { navn: "Hovedutvalg og planutvalg", hva: "organer" },
  { navn: "Kontrollutvalget", hva: "leder" },
  { navn: "Klagenemnda", hva: "leder" },
  { navn: "Lovpålagte råd", hva: "organer" },
  { navn: "Kommunedirektøren", hva: "leder" },
  { navn: "Sektorlederne", hva: "organer" },
  { navn: "Foretak og selskaper", hva: "organer" },
];

export const KOMMUNEMAL_BELEGG: BeleggUt = {
  kilde: RESEARCHGRUNNLAGET,
  verifisering: "oppgitt",
  per: "2026-09-24",
  merknad:
    "Researchgrunnlaget §1.5 beskriver den generiske strukturen per kommune: kommunestyre, formannskap, hovedutvalg og planutvalg, kontrollutvalg, klagenemnd, lovpålagte råd, kommunedirektør, sektorledere og foretak og selskaper (KF, AS, IKS).",
  hentet: null,
};

/** En kommune leseren kan velge: kartlagt (har datasett) eller åpen (kan stemmes fram). */
export interface KjentKommune {
  kommunenr: string;
  navn: string;
  /** Satt når kommunen har datasett. Da lenker ruta til kommunesiden. */
  slug: string | null;
  /** Valgkretsen den står i, eller fylket når ingen valgkrets lister den. */
  gruppe: string;
}

/** Valgkretsen kommunen hører til, eller `null` når grunnlaget ikke lister en. */
export function valgkretsFor(fylkesnr: string): Valgkrets | null {
  return VALGKRETSER.find((v) => v.fylkesnr === fylkesnr) ?? null;
}

const samlet = new Intl.Collator("nb");

/**
 * Alle kommuner siden kjenner: de med datasett og de valgkretsene lister.
 * Samme kommune står én gang, og navnet fra datasettet vinner.
 */
export function kjenteKommuner(kartlagte: readonly Kommune[]): KjentKommune[] {
  const ut = new Map<string, KjentKommune>();
  for (const v of VALGKRETSER) {
    for (const k of v.kommuner) {
      ut.set(k.kommunenr, { kommunenr: k.kommunenr, navn: k.navn, slug: null, gruppe: v.navn });
    }
  }
  for (const k of kartlagte) {
    const fra = ut.get(k.kommunenr);
    ut.set(k.kommunenr, {
      kommunenr: k.kommunenr,
      navn: k.navn,
      slug: k.slug,
      gruppe: fra?.gruppe ?? valgkretsFor(k.fylkesnr)?.navn ?? k.fylke,
    });
  }
  return [...ut.values()].sort((a, b) => samlet.compare(a.navn, b.navn));
}
