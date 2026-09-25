// Regionsidene hentes gjennom serverfunksjoner, ikke med datalaget i loaderen.
//
// En loader kjører i nettleseren når leseren navigerer til siden fra en annen
// side. Med datalaget importert i loaderen lastet nettleseren da de rå
// kommunedatasettene: hele fylket for en fylkesside, og i utvikling alle 80.
// Det er megabyte med JSON, og roller datalaget ellers holder tilbake (roller i
// sensitive organer). En serverfunksjon kjører på serveren også da, og
// nettleseren får bare svaret, akkurat som i HTML-en.
//
// Den statiske eksporten har ingen server, så kallet feiler der. Da ber
// loaderen om en vanlig sidelasting av adressen: siden er forhåndsrendret med
// svaret i HTML-en. Datalaget kommer aldri i nettleserbunten.

import { isNotFound, isRedirect, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/** Forsiden: eksempelkommunen og hele regionen. */
export const hentForside = createServerFn({ method: "GET" }).handler(async () => {
  const [{ lastForside }, { lastRegionside }] = await Promise.all([
    import("@/components/forside/last"),
    import("./last"),
  ]);
  const [forside, region] = await Promise.all([lastForside(), lastRegionside()]);
  return { utvalgt: forside.utvalgt, region };
});

/** Fylkessiden, eller `null` når sluggen ikke er et fylke i regionen. */
export const hentFylkeside = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => ({ slug: String(d?.slug ?? "").slice(0, 60) }))
  .handler(async ({ data }) => (await import("./last")).lastFylkeside(data.slug));

const NOKKEL = "maktkart:sidelasting";

/**
 * Om en ny sidelasting av `sti` kan hjelpe. Nei hvis vi nettopp lastet samme
 * adresse på nytt og kallet feilet igjen: da mangler siden også som fil, og en
 * ny lasting ville gått i ring.
 */
function kanLastePaaNytt(sti: string): boolean {
  try {
    const [forrige, tid] = (sessionStorage.getItem(NOKKEL) ?? "").split("|");
    if (forrige === sti && Date.now() - Number(tid) < 15_000) return false;
    sessionStorage.setItem(NOKKEL, `${sti}|${Date.now()}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kaller serverfunksjonen. Feiler den i nettleseren (den statiske eksporten
 * har ingen server), lastes adressen som et vanlig dokument i stedet.
 */
export async function fraServeren<T>(hent: () => Promise<T>, sti: string): Promise<T> {
  try {
    return await hent();
  } catch (feil) {
    if (isRedirect(feil) || isNotFound(feil)) throw feil;
    if (typeof window === "undefined" || !kanLastePaaNytt(sti)) throw feil;
    throw redirect({ href: sti, reloadDocument: true });
  }
}
