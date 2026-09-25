// Avviksrapporten og oppsummeringen på stdout.
//
// Rapporten er en generert fil i docs/avvik/. Den har ingen tidsstempel utover
// hentedatoen, så en ny kjøring på de samme svarene gir en byte-lik fil. Den
// inneholder aldri fødselsdatoer, aldre eller adresser: importøren ser dem
// ikke (se hent.ts), og kan derfor ikke skrive dem.

import type { Avvik, Avvikskategori, ImportUt, Oppsummering } from "./importer";

const OVERSKRIFT: Record<Avvikskategori, { tittel: string; forklaring: string }> = {
  roller: {
    tittel: "Roller der registeret sier noe annet",
    forklaring:
      "Grunnlagets rolle står. Har registeret en annen person i rollen, er den lagt til ved siden av, merket verifisert.",
  },
  nokkeltall: {
    tittel: "Nøkkeltall der registeret sier noe annet",
    forklaring:
      "Grunnlagets tall står. Registertallet er lagt til ved siden av når det har en annen nøkkel (konsern eller selskap).",
  },
  organer: {
    tittel: "Organer: orgnr, navn og status",
    forklaring:
      "Orgnr som ikke finnes, organer som er slettet eller konkurs, og navn som ikke stemmer.",
  },
  personer: {
    tittel: "Personer som kan være den samme",
    forklaring:
      "Et navn alene er aldri nok til å slå sammen to personer. Er de samme person, legg koblingen i samme_person i scripts/brreg.config.json.",
  },
  koblinger: {
    tittel: "Koblinger på navn",
    forklaring:
      "Grunnlagets organer uten orgnr, koblet til registeret på eksakt navn, og navneoppslag uten entydig treff.",
  },
  naeringskoder: {
    tittel: "Næringskoder med en annen tittel enn tabellen venter",
    forklaring:
      "Brreg fører SN2025. Når tittelen ikke passer, er koden trolig en annen næring enn tabellen tror, og organet har ikke fått segment.",
  },
  ikke_tatt_inn: {
    tittel: "Ikke tatt inn",
    forklaring: "Det registeret har, men som importøren bevisst lot ligge.",
  },
};

const REKKEFOLGE = Object.keys(OVERSKRIFT) as Avvikskategori[];

const celle = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");
const tall = (n: number) => new Intl.NumberFormat("nb-NO").format(n).replace(/ /g, " ");

export function oppsummeringslinjer(o: Oppsummering): string[] {
  const h = o.hentetFra;
  const l = o.lagtTil;
  return [
    `Hentet ${o.hentet}: ${tall(h.enheterIKommunen)} enheter og ` +
      `${tall(h.underenheterMedForelderUtenfor)} underenheter med overordnet utenfor kommunen er kandidater; ` +
      `${tall(h.iUtvalget)} er i utvalget, medregnet ${tall(h.alltidMed)} som alltid er med. ` +
      `Rollene til ${tall(h.rollelister)} og regnskapet til ${tall(h.regnskap)} er hentet.` +
      (h.ikkeFunnet ? ` ${tall(h.ikkeFunnet)} orgnr finnes ikke.` : ""),
    `Lagt til: ${tall(l.organer)} organer, ${tall(l.personer)} personer, ${tall(l.roller)} roller, ` +
      `${tall(l.relasjoner)} relasjoner, ${tall(l.nokkeltall)} nøkkeltall og ${tall(l.hull)} hull.`,
    `Bekreftet i grunnlaget: ${tall(o.bekreftet.roller)} roller og ${tall(o.bekreftet.nokkeltall)} nøkkeltall, nå verifisert.`,
    `Motsagt av registeret: ${tall(o.motsagt.roller)} roller, ${tall(o.motsagt.nokkeltall)} nøkkeltall og ${tall(o.motsagt.organer)} organopplysninger.`,
    `Hoppet over: ${tall(o.hoppetOver.fratradt)} fratrådte, ${tall(o.hoppetOver.doed)} døde, ` +
      `${tall(o.hoppetOver.andreRoller)} roller av typer Maktkart ikke bruker (revisor, regnskapsfører, kontaktperson o.l.), ` +
      `${tall(o.hoppetOver.enhetsroller)} andre roller holdt av enheter, ` +
      `${tall(o.hoppetOver.sensitive)} roller under toppleder i sensitive organer, ` +
      `${tall(o.hoppetOver.orgform)} enheter med en form som ikke tas inn, ` +
      `${tall(o.hoppetOver.navnebror)} navnebrødre av personer i grunnlaget (venter på vurdering), ` +
      `${tall(o.hoppetOver.navnITekst)} for navneregelen.`,
    `Avvik til menneskelig vurdering: ${tall(o.avvik)}.`,
  ];
}

export function avviksrapport(ut: ImportUt, kommando: string): string {
  const o = ut.oppsummering;
  const deler: string[] = [
    `# Avvik mot Brønnøysundregistrene: ${o.kommune} (${o.kommunenr})`,
    "",
    `Hentet ${o.hentet} med \`${kommando}\`. Filen er generert og skrives på nytt ved neste kjøring; ` +
      "vurderingene hører hjemme i datasettet eller i scripts/brreg.config.json, ikke her.",
    "",
    "Hver rad krever en menneskelig vurdering. Grunnlagets påstand står uendret i datasettet, " +
      "og ingenting er overskrevet i stillhet. Rapporten har ingen fødselsdatoer, aldre eller adresser.",
    "",
    "## Oppsummering",
    "",
    ...oppsummeringslinjer(o).map((l) => `- ${l}`),
    "",
  ];
  for (const k of REKKEFOLGE) {
    const rader: Avvik[] = ut.avvik.filter((a) => a.kategori === k);
    deler.push(`## ${OVERSKRIFT[k].tittel} (${rader.length})`, "", OVERSKRIFT[k].forklaring, "");
    if (rader.length === 0) {
      deler.push("Ingen.", "");
      continue;
    }
    deler.push("| Gjelder | Grunnlaget | Registeret | Tiltak |", "|---|---|---|---|");
    for (const a of rader)
      deler.push(
        `| ${celle(a.gjelder)} | ${celle(a.grunnlaget)} | ${celle(a.registeret)} | ${celle(a.tiltak)} |`,
      );
    deler.push("");
  }
  return deler.join("\n");
}
