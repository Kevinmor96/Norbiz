/**
 * import-brreg — henter foretak fra Enhetsregisteret og tall fra
 * Regnskapsregisteret.
 *
 * Fyller: companies, companies_snapshot
 *
 * Endepunktene er verifisert mot API-et, ikke antatt:
 *   Enhetsregisteret     https://data.brreg.no/enhetsregisteret/api/enheter
 *   Regnskapsregisteret  https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
 *
 * Merk at regnskapsstien IKKE har /api/ i seg. Med /api/ svarer Brreg 200 med en
 * HTML-side — altså ingen feil å fange, bare søppel som ville blitt parset som
 * om det var data.
 *
 * TRE TING SOM MÅ HÅNDTERES, ALLE VERIFISERT MOT EKTE SVAR:
 *
 * 1. VALUTA. Regnskapet har et `valuta`-felt, og det er ikke alltid NOK —
 *    Equinor rapporterer i USD. Lagres et USD-beløp i en kolonne alle andre
 *    leser som kroner, blir tallet galt med en faktor ti, og det ser ikke galt
 *    ut. Vi importerer bare NOK-regnskap og teller resten som utelatt.
 *
 * 2. NÆRINGSSTANDARD. Enhetsregisteret bruker en annen revisjon enn SSBs
 *    strukturstatistikk. Verifisert: `56.101` gir 0 treff hos Brreg mens
 *    `56.110` gir 11 962, og både `96.020` og `96.021` gir 0. SSBs 12910 er på
 *    SN2007. Vi lagrer derfor Brregs egen kode i companies.nace_code slik den
 *    kommer, og henter på tresifret nivå der standardene stemmer bedre. Å tvinge
 *    Brregs kode inn i SN2007 ville vært å dikte en kobling ingen av kildene har
 *    publisert.
 *
 * 3. ENK LEVERER IKKE ÅRSREGNSKAP. De skal fortsatt importeres — de finnes i
 *    Enhetsregisteret og teller i foretakstetthet — men med tallkolonnene NULL.
 *    Den genererte kolonnen inngar_i_regnskapssnitt faller da til false av seg
 *    selv. Et ENK uten regnskapstall er informasjon; et ENK som mangler er et
 *    hull.
 *
 * SNAPSHOT. Den åpne delen av Regnskapsregisteret gir bare siste innsendte
 * årsregnskap, så historikk kan ikke etterfylles. Hver kjøring skriver derfor
 * til companies_snapshot med hentet_dato, slik at serien bygges framover fra i
 * dag. Det er hele grunnen til at den tabellen finnes.
 */

const ENHETER = 'https://data.brreg.no/enhetsregisteret/api/enheter';
const REGNSKAP = 'https://data.brreg.no/regnskapsregisteret/regnskap';

interface Enhet {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode?: string };
  naeringskode1?: { kode?: string };
  forretningsadresse?: { kommunenummer?: string };
  antallAnsatte?: number;
  sisteInnsendteAarsregnskap?: string;
}

/** Organisasjonsformer som leverer årsregnskap. Speiler den genererte kolonnen. */
const LEVERER_REGNSKAP = new Set(['AS', 'ASA', 'NUF', 'SA']);

async function hent(url: string, forsok = 0): Promise<Response> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if ((r.status === 429 || r.status >= 500) && forsok < 5) {
    const etter = Number(r.headers.get('Retry-After') ?? 0);
    await new Promise((s) =>
      setTimeout(s, etter > 0 ? etter * 1000 : Math.min(2 ** forsok * 1000, 30_000)));
    return hent(url, forsok + 1);
  }
  return r;
}

interface Tall {
  omsetning: number | null;
  driftsresultat: number | null;
  egenkapital: number | null;
  regnskapsar: number | null;
  valuta: string | null;
  utelatt: string | null;
}

const TOMT: Tall = {
  omsetning: null, driftsresultat: null, egenkapital: null,
  regnskapsar: null, valuta: null, utelatt: null,
};

/**
 * Henter siste NOK-selskapsregnskap for et organisasjonsnummer.
 *
 * Returnerer alltid et svar. Mangler regnskapet, er det ikke en feil — det er et
 * faktum om selskapet, og skal lagres som NULL med en grunn.
 */
async function regnskap(orgnr: string): Promise<Tall> {
  const r = await hent(`${REGNSKAP}/${orgnr}`);
  if (r.status === 404) return { ...TOMT, utelatt: 'ingen_regnskap' };
  if (!r.ok) return { ...TOMT, utelatt: `brreg_${r.status}` };

  const tekst = await r.text();
  // Brreg svarer 200 med HTML på noen stier. Uten denne sjekken ville JSON.parse
  // kastet, og hele bolken feilet på ett selskap.
  if (!tekst.trimStart().startsWith('[') && !tekst.trimStart().startsWith('{')) {
    return { ...TOMT, utelatt: 'ikke_json' };
  }

  const alle = JSON.parse(tekst);
  const liste: Record<string, unknown>[] = Array.isArray(alle) ? alle : [alle];
  if (liste.length === 0) return { ...TOMT, utelatt: 'ingen_regnskap' };

  // Bare selskapsregnskap, nyeste periode først. Et konsernregnskap ville gjort
  // morselskapet mye større enn virksomheten det faktisk driver.
  const periode = (x: Record<string, unknown>): string =>
    String((x['regnskapsperiode'] as Record<string, string>)?.['tilDato'] ?? '');

  const selskap = liste
    .filter((x) => (x['regnskapstype'] ?? 'SELSKAP') === 'SELSKAP')
    .sort((a, b) => periode(b).localeCompare(periode(a)));

  const siste = selskap[0];
  if (!siste) return { ...TOMT, utelatt: 'bare_konsern' };

  const valuta = String(siste['valuta'] ?? 'NOK');
  const tilDato = periode(siste);
  const aar = tilDato ? Number(tilDato.slice(0, 4)) : null;

  // Et USD-beløp i en kolonne alle leser som kroner er ikke unøyaktig, det er
  // galt — og det ser ikke galt ut. Da er det bedre å ikke ha tallet.
  if (valuta !== 'NOK') return { ...TOMT, regnskapsar: aar, valuta, utelatt: 'annen_valuta' };

  const res = siste['resultatregnskapResultat'] as Record<string, unknown> | undefined;
  const drift = res?.['driftsresultat'] as Record<string, unknown> | undefined;
  const inntekt = drift?.['driftsinntekter'] as Record<string, unknown> | undefined;
  const ekGjeld = siste['egenkapitalGjeld'] as Record<string, unknown> | undefined;
  const ek = ekGjeld?.['egenkapital'] as Record<string, unknown> | undefined;

  const tall = (v: unknown): number | null => (typeof v === 'number' ? Math.round(v) : null);

  return {
    omsetning: tall(inntekt?.['sumDriftsinntekter']),
    driftsresultat: tall(drift?.['driftsresultat']),
    egenkapital: tall(ek?.['sumEgenkapital']),
    regnskapsar: aar,
    valuta,
    utelatt: null,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const torrkjoring = url.searchParams.get('dry') === '1';
  // Enhetsregisteret er 1,17 millioner enheter, så importen må avgrenses.
  const perNaering = Number(url.searchParams.get('per') ?? 50);

  const SB = Deno.env.get('SUPABASE_URL')!;
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hodet = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const les = async (sti: string): Promise<Record<string, unknown>[]> => {
    const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: hodet });
    if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };

  const upsert = async (tabell: string, onConflict: string, rader: unknown[]): Promise<void> => {
    if (rader.length === 0) return;
    const r = await fetch(`${SB}/rest/v1/${tabell}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...hodet, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rader),
    });
    if (!r.ok) throw new Error(`upsert ${tabell}: ${r.status} ${(await r.text()).slice(0, 400)}`);
  };

  const logg: string[] = [];
  const grunner = new Map<string, number>();
  const tell = (g: string) => grunner.set(g, (grunner.get(g) ?? 0) + 1);

  // Tresifret nivå: Brregs revisjon avviker fra SSBs på femsifret, men stemmer
  // grovere opp. `56.1` traff 12 298 enheter der `56.101` traff null.
  const naeringer = await les('industries?select=nace_code&nace_level=eq.3&limit=500');
  const koder = naeringer.map((n) => n['nace_code'] as string);
  logg.push(`henter for ${koder.length} tresifrede næringer, maks ${perNaering} hver`);

  const enheter: Enhet[] = [];
  for (const kode of koder) {
    const r = await hent(`${ENHETER}?naeringskode=${encodeURIComponent(kode)}&size=${perNaering}`);
    if (!r.ok) { tell(`enhetsregister_${r.status}`); continue; }
    const bolk: Enhet[] = (await r.json())?._embedded?.enheter ?? [];
    if (bolk.length === 0) tell('naering_uten_treff');
    enheter.push(...bolk);
  }
  logg.push(`${enheter.length} enheter fra Enhetsregisteret`);

  const rader: Record<string, unknown>[] = [];
  const snapshot: Record<string, unknown>[] = [];
  const idag = new Date().toISOString().slice(0, 10);

  for (const e of enheter) {
    const form = e.organisasjonsform?.kode ?? 'UKJENT';
    // Å spørre Regnskapsregisteret for et ENK er et kall som alltid gir 404.
    const t = LEVERER_REGNSKAP.has(form)
      ? await regnskap(e.organisasjonsnummer)
      : { ...TOMT, utelatt: 'leverer_ikke_regnskap' };
    if (t.utelatt) tell(t.utelatt);

    const rad = {
      org_nr: e.organisasjonsnummer,
      navn: e.navn,
      nace_code: e.naeringskode1?.kode ?? null,
      kommune_code: e.forretningsadresse?.kommunenummer ?? null,
      organisasjonsform: form,
      ansatte: e.antallAnsatte ?? null,
      omsetning: t.omsetning,
      driftsresultat: t.driftsresultat,
      egenkapital: t.egenkapital,
      // Årstallet settes bare der det finnes et tall å stemple. Et regnskapsår
      // uten omsetning ville gjort inngar_i_regnskapssnitt sann uten dekning.
      regnskapsar: t.omsetning != null ? t.regnskapsar : null,
      source: 'brreg',
      data_quality: 'brreg',
    };
    rader.push(rad);

    if (t.omsetning != null && t.regnskapsar != null) {
      snapshot.push({ ...rad, regnskapsar: t.regnskapsar, hentet_dato: idag });
    }
  }

  logg.push(`${rader.length} selskaper klare, ${snapshot.length} med regnskapstall`);
  for (const [g, n] of [...grunner].sort((a, b) => b[1] - a[1])) logg.push(`  ${g}: ${n}`);

  if (torrkjoring) return svar({ torrkjoring: true, logg, eksempel: rader.slice(0, 3) });

  for (let i = 0; i < rader.length; i += 500) {
    await upsert('companies', 'org_nr', rader.slice(i, i + 500));
  }
  for (let i = 0; i < snapshot.length; i += 500) {
    await upsert('companies_snapshot', 'org_nr,regnskapsar,hentet_dato', snapshot.slice(i, i + 500));
  }
  logg.push("skrevet med data_quality = 'brreg'");

  return svar({ ok: true, logg });
}

const svar = (o: unknown): Response =>
  new Response(JSON.stringify(o, null, 2), { headers: { 'Content-Type': 'application/json' } });
