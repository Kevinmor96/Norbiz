/**
 * import-ssb — henter fra SSBs statistikkbank (PxWebApi v2).
 *
 * Kilde:      https://data.ssb.no/api/pxwebapi/v2-beta
 * Tabeller:   12910 (nasjonalt, NACE 2-5), 12936 (fylke, NACE 2-3),
 *             foretaksdemografi, konkurser, folketall
 * Fyller:     industry_stats, industry_demography, region_population, industry_wages
 *
 * LØNN. Hentes per NÆRING, ikke per yrke, fordi SSB ikke gir noen kartlegging
 * fra NACE til STYRK-08 — bygger vi den selv, er den vår vurdering og skal
 * merkes 'beregnet'. statistikkmål-dimensjonen inneholder gjennomsnitt, median
 * og desiler; fra-til skal komme fra 1. og 9. desil framfor å anslås. Serien går
 * 2015-2025, altså lenger og ferskere enn strukturstatistikken, så årstempel må
 * settes per måltall.
 *
 * FØRSTE KALL SKAL VÆRE metadata. GET /api/v2/tables/{id}/metadata avgjør
 * hvilke variabler tabellen faktisk tilbyr. Tre ting er uverifisert og må
 * sjekkes der før noe skrives:
 *   1. Har 12936 driftsresultat og bruttoinvestering?
 *   2. Er 2017-2023 publisert på datidens fylkesinndeling eller tilbakeskrevet
 *      til dagens 15? SSB publiserer en egen liste over tilbakeskrevne serier.
 *   3. Finnes arsverk i det hele tatt?
 * Alle tre lander på nullable kolonner, så skjemaet holder uansett svar.
 *
 * CELLEGRENSE. MaxDataCells er 10000 i referansekonfigurasjonen, og for store
 * uttrekk avvises — de trunkeres ikke. Les GET /api/v2/config ved oppstart og
 * dimensjoner batchene etter den faktiske verdien. Del langs NACE-gruppe.
 *
 * UTTRYKKSSYNTAKS. valueCodes er ikke bare literaler: `*` og `?` er jokertegn,
 * og TOP(n) / BOTTOM(n) / RANGE(a,b) / FROM(a) / TO(a) finnes. FROM(2017)
 * henter hele tidsserien uten å liste årstall.
 *
 * STANDARDTEGN. SSB fyller ikke tomme celler med tomhet. '.' betyr ikke
 * relevant, '..' oppgave mangler, ':' kommer senere, '-' er et EKTE NULL som
 * skal lagres som 0. I tillegg undertrykkes celler av konfidensialitetshensyn.
 * Oversett til NULL pluss en mangel_arsak i merknader. Leser man tegnene som
 * manglende data, forsvinner ekte nulltall og undertrykte celler ser ut som
 * datahull — den letteste feilen å gjøre her og den vanskeligste å oppdage.
 *
 * RATE LIMITING. SSB svarer 429 ved hyppige kall og kan blokkere IP-er ved
 * publisering klokka 08.00. Respekter Retry-After, bruk eksponentiell backoff,
 * og planlegg jobben utenfor morgenvinduet.
 *
 * IDEMPOTENS. Upsert på (industry_id, region_id, year, unit_type). En avbrutt
 * import skal kunne kjøres om igjen uten å duplisere.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error(
    'import-ssb er ikke implementert. Verifiser tabellmetadata og cellegrense først — se kommentarblokken.',
  );
}
