// Det publikum sender inn: stemmer på neste kommune, påmelding til Pro og
// «Er dette deg?». Alt går til to tabeller i Supabase (0007_venteliste_og_innsigelse.sql),
// som bare kan skrives og aldri leses med den offentlige nøkkelen.
//
// Uten VITE_SUPABASE_URL og VITE_SUPABASE_PUBLISHABLE_KEY gjør modulen
// ingenting, og svaret sier det. Kvitteringen i skjemaet skal aldri si at noe er
// lagret når det ikke er det (DESIGN.md §5.8). Derfor finnes det ingen
// reserve i nettleseren (localStorage): en stemme som bare ligger hos leseren,
// er ikke en stemme.
//
// supabase-js lastes først når noe faktisk sendes, så klienten ikke havner i
// hovedbunten for lesere som aldri sender noe.

const URL = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim();
const NOKKEL = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();

/** Er det en base å lagre i? Lik på server og i nettleser, så første maling er lik. */
export const harLagring = URL.length > 0 && NOKKEL.length > 0;

/**
 * Samme regel som check-en i basen. Sjekkes før sending, så leseren får en
 * feilmelding som sier hva som mangler, ikke en databasefeil.
 */
export const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function gyldigEpost(epost: string): boolean {
  const e = epost.trim();
  return e.length >= 6 && e.length <= 254 && EPOST.test(e);
}

export type Mottak =
  /** Raden er skrevet i basen. */
  | { status: "lagret" }
  /** Ingen base er satt opp. Ingenting er sendt. */
  | { status: "ingen_lagring" }
  /** Basen krever e-post i ventelisten. En stemme uten adresse kan ikke lagres. */
  | { status: "mangler_epost" }
  /** Sendingen feilet. `melding` er skrevet for leseren. */
  | { status: "feil"; melding: string };

interface Innsettbar {
  from(tabell: string): {
    insert(rad: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
}

let klient: Promise<Innsettbar> | null = null;

function hentKlient(): Promise<Innsettbar> {
  klient ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL, NOKKEL, {
      // Ingen innlogging og ingen økt: skjemaene er anonyme, og ingenting skal
      // lagres i nettleseren.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
  return klient;
}

async function settInn(tabell: string, rad: Record<string, unknown>): Promise<Mottak> {
  if (!harLagring) return { status: "ingen_lagring" };
  try {
    const k = await hentKlient();
    // Uten .select() ber supabase-js om `return=minimal`. anon har ingen
    // leserett på tabellene, så et svar med raden ville feilet.
    const { error } = await k.from(tabell).insert(rad);
    if (error) return { status: "feil", melding: "Basen tok ikke imot skjemaet." };
    return { status: "lagret" };
  } catch {
    return { status: "feil", melding: "Vi fikk ikke kontakt med basen." };
  }
}

/**
 * Ventelisten: en stemme på neste kommune eller en påmelding til Pro.
 *
 * Tabellen skiller ikke de to ennå (den har bare `kommunenr` og `epost`), så
 * `formaal` sendes ikke. Den står i signaturen fordi skjemaene vet hva de er,
 * og fordi en kolonne for det er det neste tabellen trenger.
 */
export function meldPaa({
  kommunenr,
  epost,
}: {
  formaal: "stemme" | "pro";
  kommunenr: string;
  epost: string | null;
}): Promise<Mottak> {
  if (!harLagring) return Promise.resolve({ status: "ingen_lagring" });
  const e = epost?.trim() ?? "";
  if (!e) return Promise.resolve({ status: "mangler_epost" });
  return settInn("venteliste", { kommunenr, epost: e });
}

export type Innsigelsestype = "retting" | "protest" | "sletting";

/**
 * «Er dette deg?» Basen krever at henvendelsen gjelder et organ eller en
 * person. Skjemaet sender organet. Navnet står i teksten, fordi leseren ikke
 * kjenner personnøklene våre.
 */
export function sendInnsigelse(rad: {
  type: Innsigelsestype;
  org_key: string;
  tekst: string;
  epost: string;
}): Promise<Mottak> {
  return settInn("innsigelse", {
    type: rad.type,
    org_key: rad.org_key,
    tekst: rad.tekst.trim(),
    epost: rad.epost.trim(),
  });
}
