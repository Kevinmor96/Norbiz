// Organkartets nivåbånd (DESIGN.md §5.3), regnet fra datalaget.
//
// Fire bånd: STAT, FYLKE, KOMMUNE og SELSKAPER. Et femte felt, «Utenfor
// nivåene», tar interesseorganisasjoner og mellomstatlige organer, så ingen
// organ i datasettet faller ut av kartet. Det står under den siste
// grenselinjen og er ikke et forvaltningsnivå.
//
// Malen vet ikke at den handler om Tromsø. Alt her regnes fra nivå, organtype,
// kommunenummer og fylkesnummer. Ingen nøkler og ingen navn er skrevet inn.

import { avledBelegg, type AvledetBelegg } from "@/lib/belegg";
import type { HullPunkt, OrganKort, Organtype } from "@/lib/data";
import type { Kommuneside } from "@/lib/kommuneside";
import { erForetak, myndighetslag, normaliser } from "@/components/organ/tekst";
import { MYNDIGHETNAVN, ORGANTYPENAVN } from "@/lib/navn";

export type BaandId = "stat" | "fylke" | "kommune" | "selskaper" | "utenfor";

export interface Plassert {
  kort: OrganKort;
  /** Plassen i båndets rekkefølge etter viktighet, fra 0. Styrer hva et sammenfoldet bånd viser. */
  rang: number;
  hull: HullPunkt[];
}

export interface Gruppe {
  id: string;
  tittel: string | null;
  /** Belegg for en påstand gruppen selv gjør, som «Eid av Tromsø kommune». */
  belegg?: AvledetBelegg;
  organer: Plassert[];
}

export interface Kolonne {
  id: "folkevalgte" | "administrasjon";
  tittel: string;
  grupper: Gruppe[];
}

export interface Baand {
  id: BaandId;
  /** Regionnavnet, satt i sperret versal: «Stat». */
  region: string;
  forklaring: string;
  /** Kommunen eller fylkeskommunen selv, som båndet handler om. Står i hodet. */
  paraply: Plassert | null;
  /** Folkevalgte organer og administrasjon, for fylke og kommune. Ellers tom. */
  kolonner: Kolonne[];
  /** Grupper over hele bredden (under kolonnene når de finnes). */
  grupper: Gruppe[];
  /** Organer i båndet, uten paraplyen. */
  antall: number;
  /** Organer i båndet (uten paraplyen) med navngitt leder. */
  medLeder: number;
}

/**
 * Hvor mange organer et sammenfoldet bånd viser. Mobil etter DESIGN.md §5.3.
 * Skrivebord er vårt valg: kartet har over hundre organer, og helt utfoldet
 * blir seksjonen seks skjermhøyder lang.
 */
export const FORHAND_MOBIL = 3;
export const FORHAND_SKRIVEBORD = 8;
/** «Vis flere» legger til så mange om gangen. Et bånd med hundrevis av organer tegnes aldri helt på én gang. */
export const STEG = 24;
/** Bånd med minst så mange organer får et eget søk. */
export const SOK_FRA = 16;

// ---------------------------------------------------------------------------
// Viktighet
// ---------------------------------------------------------------------------

/**
 * Hvilke organer et sammenfoldet bånd viser først. Regelen er åpen og regnes
 * bare fra organets egne data, aldri fra personene i det:
 *
 * 1. Myndighetslaget (se MYNDIGHETSLAG): organer som vedtar eller forbereder
 *    saken (vedtak, planmyndighet, innstilling) før dem som kontrollerer
 *    (klage, tilsyn, konsesjon, regelverk), før penger (eierskap,
 *    finansiering, innkjøp), før råd (rådgivning, lobby), før organer uten
 *    kartlagt myndighet.
 * 2. Flere myndighetstyper før færre.
 * 3. Flere medlemmer før færre. Ukjent regnes som null.
 * 4. Selskaper kommunen eier direkte, før dem den eier gjennom andre, før resten.
 * 5. Rekkefølgen fra datalaget: organtype, så nøkkel.
 *
 * Før alt dette: andre kommuner og fylkeskommuner i datasettet (medeiere,
 * forgjengere) kommer sist i båndet. De står der fordi de er koblet til
 * kommunen, ikke fordi de har makt i den.
 */
const erAnnenEnhet = (k: OrganKort) => k.organtype === "kommune" || k.organtype === "fylkeskommune";

function viktighet(eierledd: Map<string, number>) {
  return (a: { kort: OrganKort; i: number }, b: { kort: OrganKort; i: number }) =>
    Number(erAnnenEnhet(a.kort)) - Number(erAnnenEnhet(b.kort)) ||
    myndighetslag(a.kort.myndighet) - myndighetslag(b.kort.myndighet) ||
    b.kort.myndighet.length - a.kort.myndighet.length ||
    (b.kort.antall_medlemmer ?? 0) - (a.kort.antall_medlemmer ?? 0) ||
    (eierledd.get(a.kort.key) ?? Infinity) - (eierledd.get(b.kort.key) ?? Infinity) ||
    a.i - b.i;
}

// ---------------------------------------------------------------------------
// Inndeling
// ---------------------------------------------------------------------------

const FOLKEVALGTE: readonly Organtype[] = ["folkevalgt_organ", "utvalg", "raad", "lovgivende"];

/** Undergruppene i statsbåndet, etter organtype. Tomme grupper utelates. */
const STATSGRUPPER: readonly { id: string; tittel: string; typer: readonly Organtype[] }[] = [
  { id: "folkevalgte", tittel: "Folkevalgte organer", typer: ["lovgivende", "folkevalgt_organ"] },
  {
    id: "forvaltning",
    tittel: "Statsforvalter og departement",
    typer: ["statsforvalter", "departement"],
  },
  {
    id: "etater",
    tittel: "Direktorater, etater og tilsyn",
    typer: [
      "direktorat",
      "etat",
      "tilsyn",
      "nemnd",
      "samarbeid",
      "administrasjon",
      "utvalg",
      "raad",
    ],
  },
  {
    id: "rettsvesen",
    tittel: "Domstoler, politi og påtale",
    typer: ["domstol", "politi", "paatale"],
  },
  {
    id: "kunnskap",
    tittel: "Helse, utdanning og forskning",
    typer: ["HF", "RHF", "universitet", "forskning"],
  },
];

function baandFor(o: OrganKort): BaandId {
  switch (o.nivaa) {
    case "stat":
    case "samisk":
      return "stat";
    case "fylke":
      return "fylke";
    case "kommune":
    case "interkommunal":
      return "kommune";
    case "privat":
      return "selskaper";
    default:
      return "utenfor";
  }
}

/** Oppramsing på norsk: «A, B og C». */
function liste(navn: string[]): string {
  if (navn.length <= 1) return navn.join("");
  return `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

export function lagBaand(side: Kommuneside): Baand[] {
  const { kommune, oversikt, organkart, eierskap } = side;
  const kommuneorgan = oversikt.kommuneorgan?.key ?? null;

  const hullPer = new Map<string, HullPunkt[]>();
  for (const h of side.hull) hullPer.set(h.gjelder.key, [...(hullPer.get(h.gjelder.key) ?? []), h]);

  const eierledd = new Map(eierskap.selskaper.map((s) => [s.org.key, s.ledd]));

  // Alle organene i kartets rekkefølge, med indeks til siste ledd i viktigheten.
  const alle = organkart.grupper.flatMap((g) => g.organer).map((kort, i) => ({ kort, i }));
  const per = new Map<BaandId, { kort: OrganKort; i: number }[]>();
  for (const o of alle) {
    const id = baandFor(o.kort);
    per.set(id, [...(per.get(id) ?? []), o]);
  }

  const bygg = (
    id: BaandId,
    region: string,
    lag: (
      organer: Plassert[],
      paraply: Plassert | null,
    ) => {
      forklaring: string;
      kolonner?: Kolonne[];
      grupper: Gruppe[];
    },
    finnParaply?: (k: OrganKort) => boolean,
  ): Baand | null => {
    const organer = per.get(id) ?? [];
    if (!organer.length) return null;
    const paraplyRad = finnParaply ? organer.find((o) => finnParaply(o.kort)) : undefined;
    const rest = organer.filter((o) => o !== paraplyRad).sort(viktighet(eierledd));
    const plassert = rest.map((o, rang) => ({
      kort: o.kort,
      rang,
      hull: hullPer.get(o.kort.key) ?? [],
    }));
    // Innenfor en gruppe står organene i viktighetsrekkefølge, så de som vises
    // sammenfoldet, står øverst der de hører hjemme.
    const paraply = paraplyRad
      ? { kort: paraplyRad.kort, rang: -1, hull: hullPer.get(paraplyRad.kort.key) ?? [] }
      : null;
    const { forklaring, kolonner = [], grupper } = lag(plassert, paraply);
    const rydd = (g: Gruppe[]) => g.filter((x) => x.organer.length > 0);
    return {
      id,
      region,
      forklaring,
      paraply,
      kolonner: kolonner
        .map((k) => ({ ...k, grupper: rydd(k.grupper) }))
        .filter((k) => k.grupper.length > 0),
      grupper: rydd(grupper),
      antall: plassert.length,
      medLeder: plassert.filter((p) => p.kort.ledere.length > 0).length,
    };
  };

  const hvor = kommune.navn;

  const stat = bygg("stat", "Stat", (organer) => {
    const samiske = organer.filter((o) => o.kort.nivaa === "samisk").map((o) => o.kort.navn);
    const brukt = new Set<string>();
    const grupper: Gruppe[] = STATSGRUPPER.map((g) => {
      const med = organer.filter((o) => g.typer.includes(o.kort.organtype));
      for (const o of med) brukt.add(o.kort.key);
      return { id: g.id, tittel: g.tittel, organer: med };
    });
    grupper.push({
      id: "selskaper",
      tittel: "Statlige selskaper",
      organer: organer.filter((o) => !brukt.has(o.kort.key)),
    });
    return {
      forklaring: `Statlige organer med myndighet i ${hvor}${samiske.length ? `, og ${liste(samiske)}` : ""}.`,
      grupper,
    };
  });

  // Fylke og kommune deles likt: paraplyen i hodet, folkevalgte organer og
  // administrasjonen i hver sin kolonne, foretakene under administrasjonen,
  // og andre fylker eller kommuner i datasettet under kolonnene.
  const toKolonner = (
    organer: Plassert[],
    { foretakstittel, andreTittel }: { foretakstittel: string; andreTittel: string },
  ) => {
    const folkevalgte = organer.filter((o) => FOLKEVALGTE.includes(o.kort.organtype));
    const foretak = organer.filter((o) => erForetak(o.kort.organtype));
    // Paraplyen er alt tatt ut. Andre kommuner og fylkeskommuner står for seg.
    const andre = organer.filter((o) => erAnnenEnhet(o.kort));
    const interkommunale = organer.filter(
      (o) => o.kort.nivaa === "interkommunal" && !andre.includes(o),
    );
    const brukt = new Set([...folkevalgte, ...foretak, ...andre, ...interkommunale]);
    const adm = organer.filter((o) => !brukt.has(o));
    return {
      kolonner: [
        {
          id: "folkevalgte" as const,
          tittel: "Folkevalgte organer",
          grupper: [{ id: "folkevalgte", tittel: null, organer: folkevalgte }],
        },
        {
          id: "administrasjon" as const,
          tittel: "Administrasjon",
          grupper: [
            { id: "adm", tittel: null, organer: adm },
            { id: "foretak", tittel: foretakstittel, organer: foretak },
          ],
        },
      ],
      grupper: [
        {
          id: "interkommunale",
          tittel: "Interkommunale selskaper og samarbeid",
          organer: interkommunale,
        },
        { id: "andre", tittel: andreTittel, organer: andre },
      ],
    };
  };

  const fylke = bygg(
    "fylke",
    "Fylke",
    (organer, paraply) => ({
      forklaring: paraply
        ? `${paraply.kort.navn}: folkevalgte organer og administrasjon.`
        : `Fylkeskommunale organer i ${kommune.fylke}.`,
      ...toKolonner(organer, {
        foretakstittel: "Fylkeskommunale foretak, del av fylkeskommunen",
        andreTittel: "Andre fylkeskommuner i datasettet",
      }),
    }),
    (k) => k.organtype === "fylkeskommune" && k.fylkesnr === kommune.fylkesnr,
  );

  const kommunebaand = bygg(
    "kommune",
    "Kommune",
    (organer, paraply) => {
      const harForetak = organer.some((o) => erForetak(o.kort.organtype));
      const navn = paraply?.kort.navn ?? `${hvor} kommune`;
      return {
        forklaring: `${navn}: folkevalgte organer, administrasjonen${harForetak ? " og de kommunale foretakene" : ""}.`,
        ...toKolonner(organer, {
          foretakstittel: "Kommunale foretak, del av kommunen",
          andreTittel: "Andre kommuner i datasettet",
        }),
      };
    },
    (k) => k.key === kommuneorgan,
  );

  const selskaper = bygg("selskaper", "Selskaper", (organer) => {
    const eid = organer.filter((o) => eierledd.has(o.kort.key));
    const forskning = organer.filter(
      (o) => !eierledd.has(o.kort.key) && o.kort.organtype === "forskning",
    );
    const andre = organer.filter((o) => !eid.includes(o) && !forskning.includes(o));
    const eier = eierskap.eier?.navn ?? `${hvor} kommune`;
    const eierBelegg = eid.length
      ? avledBelegg(
          eierskap.selskaper
            .filter((s) => eid.some((o) => o.kort.key === s.org.key))
            .flatMap((s) => s.eiere.map((e) => e.belegg)),
          {
            per: kommune.sammenstilt,
            merknad: `Telt fra eierrelasjonene i datasettet: selskaper ${eier} eier direkte eller gjennom andre selskaper.`,
          },
        )
      : undefined;
    return {
      forklaring: `Selskaper ${eier} eier, direkte eller gjennom andre selskaper, og andre selskaper og institutter grunnlaget kobler til kommunen.`,
      grupper: [
        {
          id: "eid",
          tittel: `Eid av ${eier}`,
          ...(eierBelegg ? { belegg: eierBelegg } : {}),
          organer: eid,
        },
        { id: "andre", tittel: "Andre selskaper", organer: andre },
        { id: "forskning", tittel: "Forskningsinstitutter", organer: forskning },
      ],
    };
  });

  const utenfor = bygg("utenfor", "Utenfor nivåene", (organer) => ({
    forklaring:
      "Interesseorganisasjoner og mellomstatlige organer. De har ingen plass i forvaltningen, men grunnlaget kobler dem til kommunen.",
    grupper: [
      {
        id: "interesse",
        tittel: "Interesseorganisasjoner",
        organer: organer.filter((o) => o.kort.nivaa === "interesse"),
      },
      {
        id: "mellomstatlig",
        tittel: "Mellomstatlige organer",
        organer: organer.filter((o) => o.kort.nivaa === "mellomstatlig"),
      },
      {
        id: "andre",
        tittel: "Andre",
        organer: organer.filter(
          (o) => o.kort.nivaa !== "interesse" && o.kort.nivaa !== "mellomstatlig",
        ),
      },
    ],
  }));

  return [stat, fylke, kommunebaand, selskaper, utenfor].filter((b): b is Baand => b !== null);
}

/**
 * Det søket i båndet leter i: organets navn, kortnavn og type, myndigheten og
 * lederne (tittel og navn). Normalisert, så «tromso» finner «Tromsø» og
 * «hermes» finner «Hermès».
 */
export function sokestreng(p: Plassert): string {
  const k = p.kort;
  return normaliser(
    [
      k.navn,
      k.kortnavn ?? "",
      ORGANTYPENAVN[k.organtype],
      ...k.myndighet.map((m) => MYNDIGHETNAVN[m]),
      ...k.ledere.map((r) => `${r.tittel} ${r.person.navn}`),
    ].join(" "),
  );
}
