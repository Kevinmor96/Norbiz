// Offisielle navn med flere språkformer: «Gáivuotna - Kåfjord - Kaivuono».
//
// SSB skiller formene med « - ». Står navnet i en tittel som brytes, skal en
// linje aldri begynne med bindestreken. Mellomrommet foran bindestreken gjøres
// hardt, så bindestreken følger formen foran seg, og linja kan brytes etter
// den. Den samiske og kvenske formen skal aldri falle bort der kommunen omtales
// formelt. Den norske formen (`navn`) brukes bare der plassen er knapp.

/** «Gáivuotna - Kåfjord - Kaivuono» med harde mellomrom foran bindestrekene. */
export function offisielt(navn: string): string {
  return navn.replace(/ - /g, " - ");
}

/** Om det offisielle navnet har flere språkformer enn den norske. */
export function flerspraklig(offisieltNavn: string, navn: string): boolean {
  return offisieltNavn.replace(/\s*\(.*\)$/, "") !== navn;
}
