/**
 * compute-scores — materialiserer industry_scores fra scoring-viewet.
 *
 * Kilde:  viewet industry_scores_computed (migrasjon 0006)
 * Fyller: industry_scores
 *
 * Selve beregningen ligger i SQL, ikke her. Et view kan ikke komme ut av synk
 * med dataene slik en cachet funksjon kan; denne funksjonen kopierer bare
 * resultatet til en tabell frontend kan lese raskt.
 *
 * Anslag fra industry_estimates inngår ALDRI. Se spec seksjon 4: blandes de
 * inn, blir scoren usammenlignbar på tvers av næringer — noen ville hvile på
 * SSB-tall, andre på en språkmodell, uten at rangeringen viser forskjellen.
 *
 * Kjøres etter hver import-ssb. Hele tabellen bygges om; det er noen tusen
 * rader, så inkrementell oppdatering er ikke verdt kompleksiteten.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('compute-scores er ikke implementert — se kommentarblokken.');
}
