// Det Pro skal gi, og prisene vi tester. Ingenting her finnes ennå: Pro vises
// som venteliste (spec §3.9), og prisene er hypoteser fra researchgrunnlaget
// (DEL 4, «alle priser er forslag»), ikke vedtatt prising (spec §1).
//
// Står her og ikke i komponenten, så seksjonen på kommunesiden, /pro og
// forsiden sier det samme.

export interface Prishypotese {
  plan: string;
  pris: string;
  /** Hva planen er tenkt å gi, på én linje. */
  gir: string;
}

/** Tabellen merkes alltid med denne setningen (DESIGN.md §5.9). */
export const PRISMERKNAD = "Prishypoteser vi tester, ikke vedtatt prising";

export const PRISHYPOTESER: readonly Prishypotese[] = [
  { plan: "Pro", pris: "490 kr/mnd", gir: "Én bruker. Varsler, hele grafen og historikk." },
  { plan: "Team", pris: "2 900 kr/mnd", gir: "Fem brukere. Alt i Pro, og eksport." },
  { plan: "Enterprise", pris: "fra 60 000 kr/år", gir: "API og avtale for hele virksomheten." },
];

export interface ProFunksjon {
  key: "varsler" | "graf" | "historikk" | "eksport";
  navn: string;
  /** Kort, til seksjonen og forsiden. */
  kort: string;
  /** Lengre, til /pro. */
  lang: string;
}

export const PRO_FUNKSJONER: readonly ProFunksjon[] = [
  {
    key: "varsler",
    navn: "Varsler ved rollebytte",
    kort: "Beskjed når en leder byttes, et styre får ny leder eller et organ endrer seg.",
    lang: "Du får beskjed når en rolle byttes i organene du følger: ny kommunedirektør, ny styreleder, et utvalg som får ny leder. Varselet har kilde og dato, som alt annet i kartet.",
  },
  {
    key: "graf",
    navn: "Hele grafen",
    kort: "Alle koblingene mellom organer, selskaper og roller. Den åpne siden viser de som sitter flere steder.",
    lang: "Den offentlige siden viser personer med minst to aktive roller. Pro viser hele nettverket: alle organer, alle roller og eierskapet mellom dem, med de samme kildemerkene.",
  },
  {
    key: "historikk",
    navn: "Historikk som per dato",
    kort: "Hvem satt hvor på en dato du velger.",
    lang: "Velg en dato og se kartet slik det var da: hvem som ledet organene, hvem som satt i styrene og hvem som eide hva. Roller og relasjoner har fra- og til-dato i datamodellen fra starten av.",
  },
  {
    key: "eksport",
    navn: "Eksport",
    kort: "Organer, roller og kilder som CSV, og API for Enterprise.",
    lang: "Ta med deg organene, rollene og kildene som CSV, med kildemerket på hver rad. Enterprise får et API.",
  },
];
