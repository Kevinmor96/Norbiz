// Nettstedets adresse, til kanoniske lenker og delingskort. Navn og domene er
// ikke bestemt (spec §8), så adressen settes med VITE_NETTSTED_URL når den
// finnes. Uten den blir lenkene relative, og vi later ikke som vi har et domene.

const BASE = String(import.meta.env["VITE_NETTSTED_URL"] ?? "").replace(/\/+$/, "");

/** Om domenet er satt. Uten domene kan robots.txt ikke peke til sitemap, som krever absolutt adresse. */
export const harDomene = BASE !== "";

/** Absolutt URL når domenet er satt, ellers stien slik den er. */
export function nettstedUrl(sti: string): string {
  return `${BASE}${sti}`;
}
