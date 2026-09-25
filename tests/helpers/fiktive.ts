// Fiktive kommunedatasett for å teste malen. Ingenting her er fakta:
// kommunene, personene og tallene er oppdiktet og brukes bare i tester.
//
// Datasettene er laget for å treffe kantene Tromsø ikke treffer: et organ
// som deles med en annen kommune, en hendelse uten organ, en eiersykel, et
// avsluttet eierskap, like sorteringsnøkler, en skjult rolle i en domstol,
// en prosess uten steg, en rolle registeret har motsagt, og to nesten tomme
// kommuner.

import type { Belegg, Kommunedatasett, Organisasjon, Rolleinnehav } from "@/data/types";

const b = (merknad?: string): Belegg => ({
  kilde: "testkilde",
  verifisering: "oppgitt",
  per: "2026-09",
  ...(merknad ? { merknad } : {}),
});
const purehelp = (): Belegg => ({
  kilde: "purehelp",
  verifisering: "maa_verifiseres",
  per: "2025",
});

const TESTKILDE = { key: "testkilde", navn: "Fiktiv testkilde", type: "offisiell" as const };

function org(
  key: string,
  felt: Partial<Organisasjon> & Pick<Organisasjon, "nivaa" | "organtype">,
): Organisasjon {
  return {
    key,
    navn: `Fiktiv ${key}`,
    myndighet: [],
    segmenter: [],
    status: "aktiv",
    sensitiv: false,
    beskrivelse: `Oppdiktet organ for tester (${key}).`,
    belegg: b(),
    ...felt,
  };
}

function rolle(
  orgKey: string,
  person: string,
  rolletype: Rolleinnehav["rolletype"],
  felt: Partial<Rolleinnehav> = {},
): Rolleinnehav {
  return {
    org: orgKey,
    person,
    tittel: rolletype,
    rolletype,
    status: "fast",
    belegg: b(),
    ...felt,
  };
}

export function fiktiveDatasett(
  tromso: Kommunedatasett,
): { slug: string; data: Kommunedatasett }[] {
  const fraTromso = <T extends { key: string }>(liste: T[], key: string) => {
    const x = liste.find((y) => y.key === key);
    if (!x) throw new Error(`Fant ikke ${key} i tromso.json`);
    return x;
  };
  // Delt med Tromsø. Må være identisk, ellers stopper samle().
  const statsforvalteren = fraTromso(tromso.organisasjoner, "statsforvalteren-troms-og-finnmark");
  const kilder = [
    TESTKILDE,
    fraTromso(tromso.kilder, "purehelp"),
    fraTromso(tromso.kilder, "statsforvalteren-no"),
  ];
  const segmenter = tromso.segmenter.filter((s) =>
    ["energi", "eiendom-bygg", "transport", "sjomat"].includes(s.kode),
  );

  const meta = (kommunenr: string, kommune: string): Kommunedatasett["meta"] => ({
    kommunenr,
    kommune,
    fylkesnr: "99",
    fylke: "Fiktivfylket",
    sammenstilt: "2026-09-24",
    grunnlag: "tests/helpers/fiktive.ts",
    merknad: "Oppdiktet testdatasett.",
  });

  const testvik: Kommunedatasett = {
    meta: meta("9901", "Testvik"),
    kilder,
    organisasjoner: [
      org("testvik-kommune", {
        nivaa: "kommune",
        organtype: "kommune",
        kommunenr: "9901",
        fylkesnr: "99",
        myndighet: ["vedtak", "eierskap"],
      }),
      org("testvik-kommunestyre", {
        nivaa: "kommune",
        organtype: "folkevalgt_organ",
        kommunenr: "9901",
        overordnet: "testvik-kommune",
        myndighet: ["vedtak"],
        segmenter: ["eiendom-bygg"],
      }),
      org("testvik-formannskap", {
        nivaa: "kommune",
        organtype: "folkevalgt_organ",
        kommunenr: "9901",
        overordnet: "testvik-kommunestyre",
        antall_medlemmer: 7,
        myndighet: ["innstilling"],
      }),
      org("testvik-rad", {
        nivaa: "kommune",
        organtype: "raad",
        kommunenr: "9901",
        overordnet: "testvik-kommunestyre",
      }),
      org("testvik-havn", {
        nivaa: "kommune",
        organtype: "KF",
        kommunenr: "9901",
        overordnet: "testvik-kommune",
        segmenter: ["transport"],
      }),
      org("testvik-tingrett", {
        nivaa: "stat",
        organtype: "domstol",
        sensitiv: true,
        myndighet: ["vedtak"],
      }),
      org("testvik-energi", {
        nivaa: "privat",
        organtype: "AS",
        orgnr: "999999901",
        kortnavn: "Energi",
        segmenter: ["energi"],
        myndighet: ["eierskap", "innkjop"],
      }),
      org("testvik-nett", { nivaa: "privat", organtype: "AS", segmenter: ["energi"] }),
      org("gammelt-selskap", {
        nivaa: "privat",
        organtype: "AS",
        status: "nedlagt",
        gyldig_fra: "1990",
        gyldig_til: "2019-06",
        segmenter: ["energi"],
      }),
      statsforvalteren,
    ],
    personer: [
      { key: "kari-fiktiv", navn: "Kari Fiktiv" },
      { key: "per-fiktiv", navn: "Per Fiktiv" },
      { key: "ola-fiktiv", navn: "Ola Fiktiv" },
      { key: "lise-fiktiv", navn: "Lise Fiktiv" },
      { key: "anne-fiktiv", navn: "Anne Fiktiv" },
      { key: "bjorn-fiktiv", navn: "Bjørn Fiktiv" },
      { key: "gammel-leder", navn: "Gammel Leder" },
      { key: "mona-fiktiv", navn: "Mona Fiktiv" },
      { key: "mette-motsagt", navn: "Mette Motsagt" },
    ],
    roller: [
      rolle("testvik-kommunestyre", "kari-fiktiv", "politisk_leder", {
        tittel: "Ordfører",
        parti: "Testparti",
        fra: "2023-10-11",
      }),
      rolle("testvik-kommunestyre", "gammel-leder", "politisk_leder", {
        tittel: "Ordfører",
        parti: "Annetparti",
        fra: "2019-10",
        til: "2023-10-10",
      }),
      rolle("testvik-kommunestyre", "per-fiktiv", "nestleder", {
        tittel: "Varaordfører",
        parti: "Annetparti",
      }),
      rolle("testvik-formannskap", "kari-fiktiv", "utvalgsleder", {
        tittel: "Leder",
        parti: "Testparti",
      }),
      rolle("testvik-energi", "kari-fiktiv", "styreleder", { fra: "2024" }),
      rolle("testvik-energi", "kari-fiktiv", "styremedlem", { fra: "2020", til: "2023-12-31" }),
      rolle("testvik-energi", "gammel-leder", "styremedlem", { til: "2023-12-31" }),
      rolle("testvik-energi", "ola-fiktiv", "styremedlem", { belegg: purehelp() }),
      rolle("testvik-nett", "ola-fiktiv", "styremedlem"),
      rolle("testvik-nett", "per-fiktiv", "styremedlem"),
      rolle("testvik-havn", "per-fiktiv", "styremedlem"),
      rolle("testvik-havn", "bjorn-fiktiv", "styremedlem", { status: "fungerende" }),
      rolle("testvik-havn", "anne-fiktiv", "styremedlem"),
      rolle("testvik-havn", "anne-fiktiv", "daglig_leder", {
        status: "konstituert",
        til_forventet: "2027-01",
      }),
      rolle("testvik-tingrett", "ola-fiktiv", "dommer_leder", { tittel: "Sorenskriver" }),
      rolle("testvik-tingrett", "lise-fiktiv", "seksjonsleder", { tittel: "Avdelingsleder" }),
      // Motsagt av registeret: ikke aktiv, bare i historikken. Uten merket
      // ville hun vært leder i energiselskapet og stått i nettverket, fordi
      // hun også sitter i nettselskapet.
      rolle("testvik-energi", "mette-motsagt", "daglig_leder", {
        tittel: "Daglig leder",
        motsagt: true,
        belegg: b("Motsagt av Brreg 25.09.2026: registeret har en annen daglig leder."),
      }),
      rolle("testvik-nett", "mette-motsagt", "styremedlem"),
    ],
    relasjoner: [
      { fra: "testvik-kommunestyre", til: "testvik-kommune", type: "overordnet", belegg: b() },
      { fra: "testvik-formannskap", til: "testvik-kommunestyre", type: "overordnet", belegg: b() },
      { fra: "testvik-rad", til: "testvik-kommunestyre", type: "overordnet", belegg: b() },
      { fra: "testvik-havn", til: "testvik-kommune", type: "overordnet", belegg: b() },
      {
        fra: "testvik-kommune",
        til: "testvik-energi",
        type: "eier",
        andel: 100,
        belop_nok: 5_000_000,
        belegg: b("Utbytte."),
      },
      { fra: "testvik-kommune", til: "testvik-havn", type: "eier", andel: 100, belegg: b() },
      {
        fra: "testvik-energi",
        til: "testvik-nett",
        type: "eier",
        andel: 60,
        belop_nok: 1_000_000,
        belegg: purehelp(),
      },
      // Eiersykel: havn og nett eier litt av hverandre.
      { fra: "testvik-havn", til: "testvik-nett", type: "eier", andel: 10, belegg: b() },
      { fra: "testvik-nett", til: "testvik-havn", type: "eier", belegg: b("Andel ikke oppgitt.") },
      // Avsluttet eierskap: med i profilen, ikke i eierskapet.
      {
        fra: "testvik-kommune",
        til: "gammelt-selskap",
        type: "eier",
        andel: 50,
        fra_dato: "1990",
        til_dato: "2019-06",
        belegg: b(),
      },
      {
        fra: "statsforvalteren-troms-og-finnmark",
        til: "testvik-kommune",
        type: "klageinstans_for",
        belegg: b(),
      },
      // To relasjoner med samme ender og type, skilt av fra_dato.
      {
        fra: "testvik-energi",
        til: "testvik-havn",
        type: "leverandor_til",
        fra_dato: "2025-01",
        belegg: b(),
      },
      { fra: "testvik-energi", til: "testvik-havn", type: "leverandor_til", belegg: b() },
    ],
    nokkeltall: [
      {
        org: "testvik-energi",
        aar: 2025,
        type: "utbytte",
        verdi: 5_000_000,
        enhet: "NOK",
        belegg: b(),
      },
      {
        org: "testvik-energi",
        aar: 2024,
        type: "utbytte",
        verdi: 4_000_000,
        enhet: "NOK",
        belegg: b(),
      },
      {
        org: "testvik-energi",
        aar: 2025,
        type: "omsetning",
        verdi: 90_000_000,
        enhet: "NOK",
        konsern: true,
        belegg: b(),
      },
      {
        org: "testvik-energi",
        aar: 2025,
        type: "omsetning",
        verdi: 80_000_000,
        enhet: "NOK",
        konsern: false,
        belegg: b(),
      },
      {
        org: "testvik-energi",
        aar: 2025,
        type: "omsetning",
        verdi: 85_000_000,
        enhet: "NOK",
        belegg: purehelp(),
      },
      {
        org: "testvik-energi",
        aar: 2025,
        periode: "H1",
        type: "driftsresultat",
        verdi: -1_500_000,
        enhet: "NOK",
        belegg: b(),
      },
      {
        org: "testvik-energi",
        aar: 2025,
        type: "driftsresultat",
        verdi: 2_500_000.5,
        enhet: "NOK",
        belegg: b(),
      },
      {
        org: "testvik-havn",
        aar: 2025,
        type: "aarsverk",
        verdi: 12.5,
        enhet: "aarsverk",
        belegg: b(),
      },
    ],
    hendelser: [
      {
        dato: "2024-05",
        presisjon: "maaned",
        type: "vedtak",
        tittel: "Testvik vedtar ny eierstrategi",
        belegg: b(),
      },
      {
        dato: "2023-10-11",
        presisjon: "dag",
        type: "rollebytte",
        tittel: "Kari Fiktiv blir ordfører",
        tekst: "Hun etterfulgte Gammel Leder.",
        org: "testvik-kommunestyre",
        personer: ["kari-fiktiv", "gammel-leder"],
        belegg: b(),
      },
      {
        dato: "2023-10-11",
        presisjon: "dag",
        type: "valg",
        tittel: "Valgresultatet er klart",
        org: "testvik-kommunestyre",
        belegg: b(),
      },
      {
        dato: "2023-10-11",
        presisjon: "dag",
        type: "valg",
        tittel: "Annet valgresultat",
        org: "testvik-kommunestyre",
        belegg: b(),
      },
      {
        dato: "2027",
        presisjon: "aar",
        type: "planlagt",
        tittel: "Kommunestyrevalget 2027",
        org: "testvik-kommunestyre",
        belegg: b(),
      },
      {
        dato: "2028",
        presisjon: "aar",
        type: "strukturdebatt",
        tittel: "Sammenslåing er foreslått",
        org: "testvik-kommune",
        belegg: b(),
      },
      {
        dato: "2027-01",
        presisjon: "maaned",
        type: "planlagt",
        tittel: "Konstitueringen ventes å ende",
        org: "testvik-havn",
        personer: ["anne-fiktiv"],
        belegg: b(),
      },
      {
        dato: "2025-01",
        presisjon: "maaned",
        type: "vedtak",
        tittel: "Statsforvalteren avgjør en klage fra Testvik",
        org: "statsforvalteren-troms-og-finnmark",
        belegg: b(),
      },
      {
        dato: "2022",
        presisjon: "aar",
        type: "rollebytte",
        tittel: "Ola Fiktiv blir sorenskriver",
        org: "testvik-tingrett",
        personer: ["ola-fiktiv"],
        belegg: b(),
      },
      {
        dato: "2021",
        presisjon: "aar",
        type: "regnskap",
        tittel: "Mona Fiktiv legger fram regnskapet",
        org: "testvik-kommune",
        personer: ["mona-fiktiv"],
        belegg: b(),
      },
    ],
    prosesser: [
      {
        key: "reguleringsplan",
        tittel: "Reguleringsplan",
        sporsmal: "Hvem bestemmer en reguleringsplan i Testvik?",
        steg: [
          { org: "testvik-formannskap", myndighet: "innstilling", hva: "Innstiller.", belegg: b() },
          { org: "testvik-kommunestyre", myndighet: "vedtak", hva: "Vedtar.", belegg: b() },
          {
            org: "statsforvalteren-troms-og-finnmark",
            myndighet: "klage",
            hva: "Behandler klager.",
            belegg: b(),
          },
        ],
      },
      { key: "tom-prosess", tittel: "Uten steg", sporsmal: "Hvem bestemmer ingenting?", steg: [] },
    ],
    segmenter,
    org_segment: [
      { org: "testvik-kommunestyre", segment: "eiendom-bygg", styrke: 3 },
      { org: "testvik-energi", segment: "energi", styrke: 3 },
      { org: "testvik-nett", segment: "energi", styrke: 2 },
      { org: "gammelt-selskap", segment: "energi", styrke: 2 },
      { org: "testvik-havn", segment: "transport", styrke: 2 },
      { org: "testvik-havn", segment: "sjomat", styrke: 1 },
      { org: "testvik-kommune", segment: "sjomat", styrke: 1 },
      { org: "testvik-kommune", segment: "energi", styrke: 1 },
    ],
    hull: [
      {
        gjelder: "testvik-energi",
        hva: "Kari Fiktiv sin startdato er ikke oppgitt.",
        hvorfor: "Oppdiktet.",
        personer: ["kari-fiktiv"],
      },
      { gjelder: "testvik-kommune", hva: "Antall ansatte er ikke oppgitt.", hvorfor: "Oppdiktet." },
      { gjelder: "testvik-kommune", hva: "Budsjettet er ikke oppgitt.", hvorfor: "Oppdiktet." },
    ],
  };

  // Bare et kommuneorgan: eier, men eier ingenting, og har ikke kommunestyre.
  const tomvik: Kommunedatasett = {
    meta: meta("9902", "Tomvik"),
    kilder: [TESTKILDE],
    organisasjoner: [
      org("tomvik-kommune", { nivaa: "kommune", organtype: "kommune", kommunenr: "9902" }),
    ],
    personer: [],
    roller: [],
    relasjoner: [],
    nokkeltall: [],
    hendelser: [],
    prosesser: [],
    segmenter: [],
    org_segment: [],
    hull: [],
  };

  // Ikke engang et kommuneorgan.
  const nullvik: Kommunedatasett = {
    ...tomvik,
    meta: meta("9903", "Nullvik"),
    organisasjoner: [org("nullvik-eldrerad", { nivaa: "kommune", organtype: "raad" })],
  };

  return [
    { slug: "testvik", data: testvik },
    { slug: "tomvik", data: tomvik },
    { slug: "nullvik", data: nullvik },
  ];
}
