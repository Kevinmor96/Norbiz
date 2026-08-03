/**
 * import-brreg — henter fra Brønnøysundregistrenes åpne API-er.
 *
 * Kilder:
 *   Enhetsregisteret:     https://data.brreg.no/enhetsregisteret/api/enheter
 *   Regnskapsregisteret:  https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
 * Fyller: companies
 *
 * DEKNING. Den åpne delen av Regnskapsregisteret gir nøkkeltall fra SIST
 * INNSENDTE årsregnskap — ett år, ikke tre. Tre år finnes bare i den lukkede
 * delen, som krever offentlig myndighet. Derfor har companies kun regnskapsar,
 * ikke en tidsserie.
 *
 * ENK. Enkeltpersonforetak leverer ikke årsregnskap. De skal fortsatt inn i
 * tabellen — de finnes i Enhetsregisteret og teller i foretakstetthet — men med
 * omsetning, driftsresultat, egenkapital og regnskapsar som NULL. Kolonnen
 * inngar_i_regnskapssnitt er generert og faller automatisk til false.
 *
 * ARBEIDSDELING. Enhetsregisteret støtter bulk og filtrering på naeringskode;
 * Regnskapsregisteret er oppslag per orgnr. Enumerer først fra
 * Enhetsregisteret, hent så regnskap kun for organisasjonsformer som leverer.
 *
 * IDEMPOTENS. Upsert på org_nr.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('import-brreg er ikke implementert — se kommentarblokken.');
}
