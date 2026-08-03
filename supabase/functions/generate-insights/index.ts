/**
 * generate-insights — produserer anslag og innsikt forankret i tallene.
 *
 * Fyller: industry_estimates, ai_insights
 *
 * REKKEFØLGEN ER POENGET. Hent tallene fra basen FØRST, send dem inn i
 * prompten, og skriv resultatet tilbake. En modell som svarer uten å ha sett
 * radene produserer tekst som høres riktig ut og ikke er det.
 *
 * OBLIGATORISK FORANKRING. Hver rad i ai_insights må ha ikke-tom referanser,
 * hver rad i industry_estimates ikke-tom basert_pa. Databasen håndhever det
 * med en check-constraint, så en uforankret påstand feiler ved skriving i
 * stedet for å havne i UI-et.
 *
 * ANSLAG ER SPENN. Oppgi intervall_lav og intervall_hoy med konfidens, ikke
 * ett presist tall. «Etableringskapital 300 000-800 000, middels konfidens» er
 * et ærlig svar; «512 000» er det ikke.
 *
 * BATCH, IKKE BRUKERFLYT. Kjøres planlagt og caches på
 * (industry_id, region_id, prompt_version). Ingen live modellkall når en
 * bruker åpner en side.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('generate-insights er ikke implementert — se kommentarblokken.');
}
