// Fra datalaget til grafen: hvilke organer som er noder, hvilke personer som
// er kanter, og hvilke koblinger som ikke vises (DESIGN.md §5.5).
//
// Institusjon først: noden er organet, og personen er kanten. `nettverk()` i
// datalaget gir alle personer med aktive roller i minst to organer, der
// sensitive organer alt er fjernet. Her legges utvalgsregelen på:
//
//   En kobling mellom et organ og organet rett under det (formannskapet under
//   kommunestyret) følger av styringsmodellen. Den sier ingenting om hvem som
//   sitter flere steder, så den vises ikke som kant. Regelen leses fra
//   `overordnet` i datasettet, ikke fra titler, så den gjelder alle kommuner.
//
// Eierskapet er et eget lag, hentet fra eierskapet til kommunen. Kommunale
// foretak er en del av kommunen og tegnes aldri som eierandel.
//
// Ingen React her, så sjekkeskriptet kan bygge nøyaktig den samme grafen.

import { avledBelegg, type AvledetBelegg } from "../belegg";
import {
  LEDERTYPER,
  type Eierandel,
  type Eierskap,
  type Nettverk,
  type Organkart,
  type OrganRef,
  type PersonRef,
  type RolleIOrgan,
} from "../data/kontrakt";
import { prosent } from "../format";
import { tekstbredde, type GrafInn, type KantInn } from "./layout";

/** Organtypene som er en del av kommunen og ikke en eierandel. */
export const DEL_AV_EIEREN = new Set(["KF", "FKF"]);

const LEDER = new Set<string>(LEDERTYPER);

export interface GrafNode {
  organ: OrganRef;
  /** Navnet slik det står i grafen, brutt i linjer. */
  linjer: string[];
  /** Bare med når eierskapslaget er på (kommunen selv, som eier). */
  bareEierskap: boolean;
}

export interface Personkant {
  id: string;
  fra: string;
  til: string;
  person: PersonRef;
  /** Rollene kanten bygger på, i begge organene. */
  roller: RolleIOrgan[];
  maaVerifiseres: boolean;
  belegg: AvledetBelegg;
  pastand: string;
  /** Satt når kanten tegnes som en del av en knute (personen sitter i tre eller flere organer). */
  knute: string | null;
}

/**
 * En person med roller i tre eller flere organer, der alle parene vises. Den
 * tegnes som én kant med flere ender: ett navneskilt og en eike til hvert
 * organ. Parene telles fortsatt hver for seg i «N av M koblinger».
 */
export interface Personknute {
  id: string;
  person: PersonRef;
  organer: string[];
  roller: RolleIOrgan[];
  kanter: Personkant[];
  maaVerifiseres: boolean;
  belegg: AvledetBelegg;
  pastand: string;
}

export interface Eierkant {
  id: string;
  /** Eieren. */
  fra: string;
  /** Selskapet. */
  til: string;
  andel: number | null;
  maaVerifiseres: boolean;
  eierandel: Eierandel;
}

export interface Strukturkobling {
  person: PersonRef;
  over: RolleIOrgan;
  under: RolleIOrgan;
  beggeLedere: boolean;
}

export interface Grafmodell {
  noder: GrafNode[];
  /** Alle organpar som vises, også de som tegnes i en knute. */
  personkanter: Personkant[];
  knuter: Personknute[];
  eierkanter: Eierkant[];
  struktur: Strukturkobling[];
  /** Personene i grafen, alfabetisk. Til lista. */
  personer: { person: PersonRef; roller: RolleIOrgan[]; kanter: Personkant[] }[];
}

const nb = new Intl.Collator("nb");

export const organnavn = (o: OrganRef) => o.kortnavn ?? o.navn;

/**
 * Et organnavn midt i en setning. «Kommunestyret» blir «kommunestyret», men
 * et egennavn som «Troms Kraft» beholder store bokstaver: bare navn med én
 * stor forbokstav og ellers små bokstaver regnes som fellesnavn.
 */
export function iSetning(navn: string): string {
  const resten = navn.slice(1);
  if (resten !== resten.toLowerCase()) return navn;
  return navn.charAt(0).toLowerCase() + resten;
}

/** En tittel midt i en setning: «Styreleder» blir «styreleder». */
export const tittelISetning = iSetning;

/** Bryter et organnavn i høyst to linjer, så den lengste linja blir kortest mulig. */
export function brytNavn(navn: string, maks = 20): string[] {
  if (navn.length <= maks) return [navn];
  const ord = navn.split(" ");
  let best: string[] = [navn];
  let bestLengde = Infinity;
  for (let i = 1; i < ord.length; i++) {
    const a = ord.slice(0, i).join(" ");
    const b = ord.slice(i).join(" ");
    const l = Math.max(a.length, b.length);
    if (l < bestLengde) {
      bestLengde = l;
      best = [a, b];
    }
  }
  return best;
}

/** Skriftstørrelsene i grafen. Komponenten bruker de samme tallene. */
export const GRAFSKRIFT = {
  organ: 13,
  organLinje: 16,
  skilt: 12.5,
  skiltHoyde: 24,
  /** Plass til kildemerket og luften rundt navnet i skiltet. */
  skiltLuft: 12 + 20,
  andel: 12,
};

export function byggGrafmodell({
  nettverk,
  organkart,
  eierskap,
  sammenstilt,
}: {
  nettverk: Nettverk;
  organkart: Organkart;
  eierskap: Eierskap;
  sammenstilt: string;
}): Grafmodell {
  const overordnet = new Map<string, string | null>();
  for (const g of organkart.grupper) for (const o of g.organer) overordnet.set(o.key, o.overordnet);
  const erRettUnder = (a: string, b: string) => overordnet.get(a) === b || overordnet.get(b) === a;

  const roller = new Map(nettverk.personer.map((p) => [p.person.key, p.roller]));

  // Personkantene, med utvalgsregelen lagt på.
  const personkanter: Personkant[] = [];
  const struktur: Strukturkobling[] = [];
  for (const k of nettverk.kanter) {
    const rs = (roller.get(k.person.key) ?? []).filter(
      (r) => r.org.key === k.fra || r.org.key === k.til,
    );
    if (erRettUnder(k.fra, k.til)) {
      const overKey = overordnet.get(k.fra) === k.til ? k.til : k.fra;
      const over = rs.find((r) => r.org.key === overKey);
      const under = rs.find((r) => r.org.key !== overKey);
      if (over && under) {
        struktur.push({
          person: k.person,
          over,
          under,
          beggeLedere: LEDER.has(over.rolletype) && LEDER.has(under.rolletype),
        });
      }
      continue;
    }
    const iFra = rs.filter((r) => r.org.key === k.fra);
    const iTil = rs.filter((r) => r.org.key === k.til);
    const beskriv = (r: RolleIOrgan) => `${r.tittel} i ${r.org.navn}`;
    const merknad =
      `Koblingen bygger på ${rs.length === 2 ? "to aktive roller" : `${rs.length} aktive roller`}: ` +
      `${[...iFra, ...iTil].map(beskriv).join(" og ")}. Graden er den svakeste av rollene.`;
    personkanter.push({
      id: `${k.person.key}:${k.fra}:${k.til}`,
      fra: k.fra,
      til: k.til,
      person: k.person,
      roller: rs,
      maaVerifiseres: rs.some((r) => r.belegg.verifisering === "maa_verifiseres"),
      belegg: avledBelegg(
        rs.map((r) => r.belegg),
        { per: sammenstilt, merknad },
      ),
      pastand: `${k.person.navn} er ${[...iFra, ...iTil]
        .map((r) => `${tittelISetning(r.tittel)} i ${r.org.navn}`)
        .join(" og ")}`,
      knute: null,
    });
  }

  // Knutene: en person med tre eller flere organer, der alle parene vises.
  // Mangler et par (fordi det er en strukturkobling), tegnes parene hver for
  // seg, så knuten ikke antyder en kobling som ikke vises.
  const knuter: Personknute[] = [];
  const perPerson = new Map<string, Personkant[]>();
  for (const k of personkanter)
    perPerson.set(k.person.key, [...(perPerson.get(k.person.key) ?? []), k]);
  for (const [personKey, ks] of [...perPerson.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const organerSett = [...new Set(ks.flatMap((k) => [k.fra, k.til]))].sort();
    const n = organerSett.length;
    if (n < 3 || ks.length !== (n * (n - 1)) / 2) continue;
    const forste = ks[0];
    if (!forste) continue;
    const rs = (roller.get(personKey) ?? []).filter((r) => organerSett.includes(r.org.key));
    const id = `knute:${personKey}`;
    for (const k of ks) k.knute = id;
    knuter.push({
      id,
      person: forste.person,
      organer: organerSett,
      roller: rs,
      kanter: ks,
      maaVerifiseres: rs.some((r) => r.belegg.verifisering === "maa_verifiseres"),
      belegg: avledBelegg(
        rs.map((r) => r.belegg),
        {
          per: sammenstilt,
          merknad: `Koblingene bygger på ${rs.length} aktive roller: ${rs
            .map((r) => `${r.tittel} i ${r.org.navn}`)
            .join(", ")}. Graden er den svakeste av rollene.`,
        },
      ),
      pastand: `${forste.person.navn} er ${rs
        .map((r) => `${tittelISetning(r.tittel)} i ${r.org.navn}`)
        .join(", ")
        .replace(/, ([^,]*)$/, " og $1")}`,
    });
  }

  // Nodene: organer med minst én kant som vises.
  const iGrafen = new Set<string>();
  for (const k of personkanter) {
    iGrafen.add(k.fra);
    iGrafen.add(k.til);
  }
  const organer = new Map(nettverk.noder.map((o) => [o.key, o]));

  // Eierskapslaget: eierandeler mellom organer i grafen, og kommunen selv når
  // den eier et av dem. Et kommunalt foretak er ikke en eierandel.
  const eierkanter: Eierkant[] = [];
  const bareEier = new Map<string, OrganRef>();
  for (const s of eierskap.selskaper) {
    if (!iGrafen.has(s.org.key) || DEL_AV_EIEREN.has(s.org.organtype)) continue;
    for (const e of s.eiere) {
      const erKommunen = eierskap.eier?.key === e.org.key;
      if (!iGrafen.has(e.org.key) && !erKommunen) continue;
      if (!iGrafen.has(e.org.key)) bareEier.set(e.org.key, e.org);
      eierkanter.push({
        id: `eier:${e.org.key}:${s.org.key}`,
        fra: e.org.key,
        til: s.org.key,
        andel: e.andel,
        maaVerifiseres: e.belegg.verifisering === "maa_verifiseres",
        eierandel: e,
      });
    }
  }
  eierkanter.sort((a, b) => (a.id < b.id ? -1 : 1));

  const noder: GrafNode[] = [
    ...[...iGrafen].map((key) => organer.get(key)).filter((o): o is OrganRef => Boolean(o)),
  ].map((organ) => ({ organ, linjer: brytNavn(organnavn(organ)), bareEierskap: false }));
  for (const [, organ] of bareEier)
    noder.push({ organ, linjer: brytNavn(organnavn(organ)), bareEierskap: true });
  noder.sort((a, b) => (a.organ.key < b.organ.key ? -1 : 1));

  const personer = nettverk.personer
    .map((p) => ({
      person: p.person,
      roller: p.roller,
      kanter: personkanter.filter((k) => k.person.key === p.person.key),
    }))
    .filter((p) => p.kanter.length > 0)
    .sort(
      (a, b) => nb.compare(a.person.navn, b.person.navn) || (a.person.key < b.person.key ? -1 : 1),
    );

  return { noder, personkanter, knuter, eierkanter, struktur, personer };
}

/** Andelen slik den står på eierkanten. */
export const andelTekst = (andel: number | null) => (andel === null ? "eier" : prosent(andel));

/** Det layoutfunksjonen trenger: størrelsene på alt som skal plasseres. */
export function grafInn(m: Grafmodell): GrafInn {
  const s = GRAFSKRIFT;
  return {
    noder: m.noder.map((n) => ({
      key: n.organ.key,
      etikett: {
        bredde: Math.max(...n.linjer.map((l) => tekstbredde(l, s.organ))),
        hoyde: n.linjer.length * s.organLinje + 2,
      },
    })),
    kanter: [
      ...m.personkanter
        .filter((k) => !k.knute)
        .map<KantInn>((k) => ({
          id: k.id,
          fra: k.fra,
          til: k.til,
          lag: "person",
          skilt: { bredde: tekstbredde(k.person.navn, s.skilt) + s.skiltLuft, hoyde: s.skiltHoyde },
        })),
      ...m.eierkanter.map<KantInn>((k) => ({
        id: k.id,
        fra: k.fra,
        til: k.til,
        lag: "eier",
        skilt: { bredde: tekstbredde(andelTekst(k.andel), s.andel) + 26, hoyde: 20 },
      })),
    ],
    knuter: m.knuter.map((k) => ({
      id: k.id,
      organer: k.organer,
      skilt: { bredde: tekstbredde(k.person.navn, s.skilt) + s.skiltLuft, hoyde: s.skiltHoyde },
    })),
  };
}
