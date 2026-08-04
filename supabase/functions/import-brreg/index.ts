/**
 * import-brreg — henter foretak fra Enhetsregisteret og tall fra
 * Regnskapsregisteret. Deployet som v8 og kjørt 2026-08-04; endringene etter det
 * er kommentarer, ikke kode.
 *
 * Fyller: companies, companies_snapshot
 *
 * ARBEIDET ER AVGRENSET PER KALL, av samme grunn som import-ssb: hvert
 * regnskapsoppslag er et eget HTTP-kall, og alt i én invokasjon sprenger
 * edge-runtimens grenser uten annen feilmelding enn "Internal Server Error".
 *
 *   ?fra=<indeks>&antall=<n>   hvilken skive av næringslista
 *   ?per=<n>                   enheter per næring (25 som standard)
 *   ?dry=1                     regn ut, ikke skriv
 *   ?stor=1                    de største per kategoriprefiks, via
 *                              fraAntallAnsatte — grunnutvalget er
 *                              alfabetisk, ikke etter størrelse
 *   ?stor=1&minansatte=<n>     terskelen. Kjør flere passeringer med synkende
 *                              terskel for å bygge utvalget nedover
 *   ?stor=1&hopp=1             hopp over selskaper som alt har regnskapstall.
 *                              Uten den går budsjettet til å lese om igjen
 *   ?brands=1                  kjedelisten: henter regnskap for kjedene som
 *                              har org_nr
 *   ?brands=1&slaopp=1         slår i tillegg opp manglende org_nr og skriver
 *                              dem — egen flagg fordi det overskriver kuratert
 *                              innhold, se kommentaren over modusen
 *
 * FØR DU LEGGER INN EN NY KATEGORI: tell treff på prefikset med den
 * skrivefrie sonden `brreg-sonde` (?tell=/?finn=). Et prefiks uten treff gir
 * en TOM toppliste, ikke en feilmelding — det er slik de fire bil-kategoriene
 * kunne stå tomme uten at noe i loggen sa fra.
 *
 * AUTORISASJON: funksjonen kjører med service-role-nøkkelen, men Supabases
 * `verify_jwt` tilfredsstilles av den offentlige anon-nøkkelen. Alle som har
 * frontend-bundelen kan altså trigge en import. Nyttelasten kommer fra Brreg
 * og ikke fra forespørselen, så en fremmed kan bare oppfriske offentlige tall
 * — bortsett fra ?slaopp=1, som derfor er skilt ut. Vil man stenge det helt,
 * må funksjonen kreve en egen hemmelighet i tillegg:
 *
 *   if (req.headers.get('x-import-secret') !== Deno.env.get('IMPORT_SECRET'))
 *     return new Response('{"feil":"ikke autorisert"}', { status: 401 });
 *
 * Det krever at IMPORT_SECRET settes som function secret i Supabase, og at
 * trigger-kallene sender headeren.
 *
 * Endepunktene er verifisert mot API-et, ikke antatt:
 *   Enhetsregisteret     https://data.brreg.no/enhetsregisteret/api/enheter
 *   Regnskapsregisteret  https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
 *
 * Merk at regnskapsstien IKKE har /api/ i seg. Med /api/ svarer Brreg 200 med
 * en HTML-side — altså ingen feil å fange, bare markup som ville blitt parset
 * som om det var data.
 *
 * SN2025-FALLBACK, verifisert mot API-et 2026-08-04: Brreg er på SN2025, og
 * fire av våre tresifrede SN2007-koder finnes ikke der lenger (41.1, 41.2,
 * 62.0, 96.0 gir alle 0 treff — SN2025 har 41.0, 62.1/62.2/62.9 og
 * 96.1/96.2/96.9). Søket støtter prefiks, så når tresifret gir null, prøver vi
 * tosifret. companies.nace_code lagrer uansett Brregs egen kode slik den
 * kommer; å tvinge den inn i SN2007 ville vært å dikte en kobling ingen av
 * kildene har publisert.
 *
 * TRE TING TIL, ALLE VERIFISERT MOT EKTE SVAR:
 *
 * 1. VALUTA. Regnskapet har et `valuta`-felt, og det er ikke alltid NOK —
 *    Equinor rapporterer i USD. Vi importerer bare NOK-regnskap.
 *
 * 2. KONSERN. Bare selskapsregnskap brukes; et konsernregnskap ville gjort
 *    morselskapet mye større enn virksomheten det faktisk driver.
 *
 * 3. ENK LEVERER IKKE ÅRSREGNSKAP. De importeres likevel — de teller i
 *    foretakstetthet — men med tallkolonnene NULL, og da faller den genererte
 *    kolonnen inngar_i_regnskapssnitt til false av seg selv.
 *
 * SNAPSHOT. Den åpne delen av Regnskapsregisteret gir bare siste innsendte
 * årsregnskap, så historikk kan ikke etterfylles. Hver kjøring skriver derfor
 * til companies_snapshot med hentet_dato, slik at serien bygges framover fra
 * i dag. Det er hele grunnen til at den tabellen finnes.
 */
const ENHETER = 'https://data.brreg.no/enhetsregisteret/api/enheter';
const REGNSKAP = 'https://data.brreg.no/regnskapsregisteret/regnskap';
const LEVERER = new Set(['AS', 'ASA', 'NUF', 'SA']);

async function hent(url: string, f = 0): Promise<Response> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if ((r.status === 429 || r.status >= 500) && f < 4) {
    const e = Number(r.headers.get('Retry-After') ?? 0);
    await new Promise((s) => setTimeout(s, e > 0 ? e * 1000 : Math.min(2 ** f * 1000, 20_000)));
    return hent(url, f + 1);
  }
  return r;
}

interface Tall { omsetning: number|null; driftsresultat: number|null; egenkapital: number|null;
  regnskapsar: number|null; utelatt: string|null }
const TOMT: Tall = { omsetning: null, driftsresultat: null, egenkapital: null, regnskapsar: null, utelatt: null };

async function regnskap(orgnr: string): Promise<Tall> {
  const r = await hent(`${REGNSKAP}/${orgnr}`);
  if (r.status === 404) return { ...TOMT, utelatt: 'ingen_regnskap' };
  if (!r.ok) return { ...TOMT, utelatt: `brreg_${r.status}` };

  const t = await r.text();
  // Brreg svarer 200 med HTML på noen stier. Uten denne sjekken ville JSON.parse
  // kastet og hele bolken feilet på ett selskap.
  if (!t.trimStart().startsWith('[') && !t.trimStart().startsWith('{')) return { ...TOMT, utelatt: 'ikke_json' };

  let alle: unknown;
  try { alle = JSON.parse(t); } catch { return { ...TOMT, utelatt: 'ugyldig_json' }; }
  const liste = (Array.isArray(alle) ? alle : [alle]) as Record<string, unknown>[];
  if (liste.length === 0) return { ...TOMT, utelatt: 'ingen_regnskap' };

  const per = (x: Record<string, unknown>) => String((x['regnskapsperiode'] as Record<string,string>)?.['tilDato'] ?? '');
  // Bare selskapsregnskap. Et konsernregnskap ville gjort morselskapet mye
  // større enn virksomheten det faktisk driver i Norge.
  const sel = liste.filter((x) => (x['regnskapstype'] ?? 'SELSKAP') === 'SELSKAP')
    .sort((a, b) => per(b).localeCompare(per(a)));
  const s = sel[0];
  if (!s) return { ...TOMT, utelatt: 'bare_konsern' };

  const aar = per(s) ? Number(per(s).slice(0, 4)) : null;
  const valuta = String(s['valuta'] ?? 'NOK');
  // Et USD-beløp i en kolonne alle leser som kroner er ikke unøyaktig, det er
  // galt — og det ser ikke galt ut. Equinor rapporterer i USD.
  if (valuta !== 'NOK') return { ...TOMT, regnskapsar: aar, utelatt: `valuta_${valuta}` };

  const res = s['resultatregnskapResultat'] as Record<string, unknown> | undefined;
  const drift = res?.['driftsresultat'] as Record<string, unknown> | undefined;
  const inn = drift?.['driftsinntekter'] as Record<string, unknown> | undefined;
  const ekg = s['egenkapitalGjeld'] as Record<string, unknown> | undefined;
  const ek = ekg?.['egenkapital'] as Record<string, unknown> | undefined;
  const n = (v: unknown) => typeof v === 'number' ? Math.round(v) : null;

  return { omsetning: n(inn?.['sumDriftsinntekter']), driftsresultat: n(drift?.['driftsresultat']),
    egenkapital: n(ek?.['sumEgenkapital']), regnskapsar: aar, utelatt: null };
}

const svar = (o: unknown) => new Response(JSON.stringify(o, null, 2), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const fra = Number(u.searchParams.get('fra') ?? 0);
    const antall = Number(u.searchParams.get('antall') ?? 6);
    const per = Number(u.searchParams.get('per') ?? 25);
    // Terskel for ?stor=1. Små kategorier har få store aktører, så den må
    // kunne senkes per kjøring.
    //
    // MEN IKKE UNDER 5. `fraAntallAnsatte=4` svarer HTTP 400 fra Brreg, `=5`
    // svarer 200 — verifisert mot API-et 2026-08-04. Grensa er ikke dokumentert
    // noe sted vi fant, og feilen kommer som en tom liste med
    // `enhetsregister_400` i grunnene, ikke som en tydelig melding.
    //
    // Konsekvensen er en systematisk skjevhet det ikke finnes noen vei rundt
    // her: i næringer der snittbedriften har 1–2 ansatte — frisør, fysioterapi,
    // hudpleie — kan selskapslistene BARE nå den øvre halen. Det er ikke et
    // utvalg av bransjen, det er de største i den, og UI-et må si det.
    const minAnsatte = Number(u.searchParams.get('minansatte') ?? 20);

    const SB = Deno.env.get('SUPABASE_URL')!;
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!SB || !KEY) return svar({ feil: 'mangler SUPABASE_URL eller SERVICE_ROLE_KEY' });
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

    const les = async (sti: string) => {
      const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: H });
      if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0,200)}`);
      return r.json() as Promise<Record<string, unknown>[]>;
    };
    const upsert = async (t: string, oc: string, rows: unknown[]) => {
      if (rows.length === 0) return;
      const r = await fetch(`${SB}/rest/v1/${t}?on_conflict=${oc}`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(`upsert ${t}: ${r.status} ${(await r.text()).slice(0,300)}`);
    };

    const logg: string[] = [];
    const grunner: Record<string, number> = {};
    const tell = (g: string) => { grunner[g] = (grunner[g] ?? 0) + 1; };

    /**
     * Bygger companies- og snapshot-rader fra Enhetsregister-treff. Delt av
     * alle tre modusene (kategoriskive, ?stor=1 og ?brands=1).
     */
    const byggRader = async (enheter: Record<string, unknown>[]) => {
      const rader: Record<string, unknown>[] = [];
      const snap: Record<string, unknown>[] = [];
      const idag = new Date().toISOString().slice(0, 10);
      for (const e of enheter) {
        const orgnr = String(e['organisasjonsnummer']);
        const form = String((e['organisasjonsform'] as Record<string,string>)?.['kode'] ?? 'UKJENT');
        // Å spørre Regnskapsregisteret for et ENK er et kall som alltid gir 404.
        const t = LEVERER.has(form) ? await regnskap(orgnr) : { ...TOMT, utelatt: 'leverer_ikke_regnskap' };
        if (t.utelatt) tell(t.utelatt);
        const rad = {
          org_nr: orgnr,
          navn: String(e['navn'] ?? ''),
          nace_code: (e['naeringskode1'] as Record<string,string>)?.['kode'] ?? null,
          kommune_code: (e['forretningsadresse'] as Record<string,string>)?.['kommunenummer'] ?? null,
          organisasjonsform: form,
          ansatte: typeof e['antallAnsatte'] === 'number' ? e['antallAnsatte'] : null,
          omsetning: t.omsetning,
          driftsresultat: t.driftsresultat,
          egenkapital: t.egenkapital,
          // Årstallet settes bare der det finnes et tall å stemple. Et regnskapsår
          // uten omsetning ville gjort inngar_i_regnskapssnitt sann uten dekning.
          regnskapsar: t.omsetning != null ? t.regnskapsar : null,
          source: 'brreg', data_quality: 'brreg',
        };
        rader.push(rad);
        if (t.omsetning != null && t.regnskapsar != null) snap.push({ ...rad, hentet_dato: idag });
      }
      return { rader, snap };
    };

    const skriv = async (rader: Record<string, unknown>[], snap: Record<string, unknown>[]) => {
      for (let i = 0; i < rader.length; i += 500) await upsert('companies', 'org_nr', rader.slice(i, i + 500));
      for (let i = 0; i < snap.length; i += 500)
        await upsert('companies_snapshot', 'org_nr,regnskapsar,hentet_dato', snap.slice(i, i + 500));
    };

    /**
     * ?brands=1 — kjedelisten: henter regnskap for kjedene som har org_nr.
     *
     * ?slaopp=1 i tillegg slår OPP manglende org_nr fra sok_navn og SKRIVER
     * dem til brands. Oppslaget er bak eget flagg fordi det er den eneste
     * stien i denne funksjonen som overskriver kuratert redaksjonelt innhold,
     * og funksjonen kan kalles av alle som har anon-nøkkelen — den ligger i
     * frontend-bundelen. Uten flagget kan et fremmed kall bare oppfriske tall
     * fra Brreg, ikke bytte hvilket selskap et merkenavn peker på.
     *
     * Oppslaget bruker en streng regel: Brreg-navnet må BEGYNNE med
     * søkenavnet, formen må være en som leverer regnskap, og selskapet må ha
     * ansatte. Et løsere kriterium ville koblet «Power Norge AS» til
     * «Powerhouse AS» — og et feil selskaps tall under et kjent merkenavn er
     * verre enn ingen tall.
     */
    if (u.searchParams.get('brands') === '1') {
      const slaOpp = u.searchParams.get('slaopp') === '1';
      const brands = await les('brands?select=id,navn,org_nr,sok_navn');
      const enheter: Record<string, unknown>[] = [];
      const funnet: Record<string, string> = {};
      const sett = new Set<string>();
      for (const b of brands) {
        let orgnr = b['org_nr'] as string | null;
        const sok = b['sok_navn'] as string | null;
        if (!orgnr && sok && slaOpp) {
          const r = await hent(`${ENHETER}?navn=${encodeURIComponent(sok)}&size=20`);
          if (r.ok) {
            const treff = ((await r.json())?._embedded?.enheter ?? []) as Record<string, unknown>[];
            const kandidater = treff.filter((e) =>
              String(e['navn'] ?? '').toUpperCase().startsWith(sok.toUpperCase()) &&
              LEVERER.has(String((e['organisasjonsform'] as Record<string,string>)?.['kode'] ?? '')) &&
              typeof e['antallAnsatte'] === 'number' && (e['antallAnsatte'] as number) > 0);
            kandidater.sort((a, z) => (z['antallAnsatte'] as number) - (a['antallAnsatte'] as number));
            if (kandidater[0]) {
              orgnr = String(kandidater[0]['organisasjonsnummer']);
              funnet[b['navn'] as string] = orgnr;
            } else tell('brand_uten_treff');
          } else tell(`brand_sok_${r.status}`);
        }
        if (!orgnr) continue;
        if (sett.has(orgnr)) continue;
        sett.add(orgnr);
        const r = await hent(`${ENHETER}/${orgnr}`);
        if (!r.ok) { tell(`brand_${r.status}`); continue; }
        enheter.push(await r.json());
      }
      logg.push(`${brands.length} kjeder, ${Object.keys(funnet).length} orgnr slaatt opp` +
        `${slaOpp ? '' : ' (oppslag av nye orgnr krever ?slaopp=1)'}, ${enheter.length} selskaper hentet`);
      logg.push(`grunner: ${JSON.stringify(grunner)}`);
      const { rader, snap } = await byggRader(enheter);
      if (dry) return svar({ dry: true, logg, funnet, eksempel: rader.slice(0, 5) });
      await skriv(rader, snap);
      for (const [navn, nr] of Object.entries(funnet)) {
        const r = await fetch(`${SB}/rest/v1/brands?navn=eq.${encodeURIComponent(navn)}`, {
          method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify({ org_nr: nr }),
        });
        if (!r.ok) throw new Error(`patch brand ${navn}: ${r.status}`);
      }
      logg.push(`org_nr lagret for ${Object.keys(funnet).length} kjeder`);
      return svar({ ok: true, logg, funnet });
    }

    /**
     * ?stor=1 — de største selskapene per kategoriprefiks, via
     * `fraAntallAnsatte`.
     *
     * IKKE `sort=antallAnsatte,desc`. Den ser ut som det riktige verktøyet og
     * ga tilsynelatende perfekte resultater — 93.13 ga SATS Norway først,
     * 96.21 ga Nikita Gruppen — men den BRYTER næringsfilteret: `47.11` med
     * sortering returnerer «HELSE MØRE OG ROMSDAL HF» som treff nummer én, et
     * helseforetak uten noe med dagligvare å gjøre. Antallet i `page` er
     * riktig filtrert; radene er ikke. Feilen er usynlig i de kategoriene der
     * den største aktøren tilfeldigvis er riktig.
     *
     * `fraAntallAnsatte` respekterer filteret, verifisert: 47.11 med
     * fraAntallAnsatte=200 gir 52 treff, alle dagligvare (Coop Finnmark,
     * CC Vest Mat, Cheffelo). Treffene kommer alfabetisk innenfor filteret, så
     * terskelen — ikke sorteringen — er det som gjør listene store nok til å
     * være interessante.
     *
     * Ansatte er ikke omsetning. Rangeringen i topplistene skjer på omsetning
     * i basen; dette filteret bestemmer bare hvem som blir hentet.
     */
    if (u.searchParams.get('stor') === '1') {
      const medl = await les('category_members?select=nace_code&kilde=eq.brreg');
      const alleP = [...new Set(medl.map((m) => m['nace_code'] as string))].sort();
      const prefikser = alleP.slice(fra, fra + antall);
      logg.push(`${prefikser.length} prefikser fra indeks ${fra} av ${alleP.length}`);
      if (prefikser.length === 0) return svar({ ferdig: true, logg });

      /**
       * ?hopp=1 — hopp over selskaper som allerede har regnskapstall.
       *
       * Dette er forskjellen mellom å utvide utvalget og å lese det om igjen.
       * Hvert regnskapsoppslag er ett HTTP-kall, og det er den knappe ressursen:
       * en kjøring med 200 oppslag ga 61 nye selskaper fordi de 139 andre
       * allerede sto i basen. `fraAntallAnsatte` gir treffene alfabetisk innenfor
       * filteret, så flere kjøringer med synkende terskel overlapper kraftig —
       * uten hopp brukes budsjettet på overlappen.
       *
       * Det MÅ hoppes helt over, ikke bare over oppslaget: upserten sender alle
       * kolonner, så en rad uten regnskapsoppslag ville skrevet omsetning = null
       * over et tall som fantes. Kolonnene i `companies` er ikke merge-trygge
       * hver for seg — hele raden er nyttelasten.
       *
       * Uten flagget oppfriskes tallene som før. Det er den kjøringen man vil ha
       * når Regnskapsregisteret har fått nye årsregnskap.
       */
      const hopp = u.searchParams.get('hopp') === '1';
      const kjent = new Set<string>();
      if (hopp) {
        const har = await les('companies?select=org_nr&regnskapsar=not.is.null&limit=50000');
        for (const c of har) kjent.add(String(c['org_nr']));
        logg.push(`hopper over ${kjent.size} selskaper som alt har regnskapstall`);
      }

      const enheter: Record<string, unknown>[] = [];
      const sett = new Set<string>();
      for (const p of prefikser) {
        const r = await hent(`${ENHETER}?naeringskode=${encodeURIComponent(p)}` +
          `&fraAntallAnsatte=${minAnsatte}&size=${per}`);
        if (!r.ok) { tell(`enhetsregister_${r.status}`); continue; }
        const b = ((await r.json())?._embedded?.enheter ?? []) as Record<string, unknown>[];
        if (b.length === 0) tell('prefiks_uten_store');
        for (const e of b) {
          const o = String(e['organisasjonsnummer']);
          if (kjent.has(o)) { tell('alt_importert'); continue; }
          if (!sett.has(o)) { sett.add(o); enheter.push(e); }
        }
      }
      logg.push(`${enheter.length} store enheter`);
      const { rader, snap } = await byggRader(enheter);
      logg.push(`${snap.length} med regnskapstall`);
      logg.push(`grunner: ${JSON.stringify(grunner)}`);
      if (dry) return svar({ dry: true, logg, neste_fra: fra + antall, eksempel: rader.slice(0, 3) });
      await skriv(rader, snap);
      return svar({ ok: true, logg, neste_fra: fra + antall, flere: fra + antall < alleP.length });
    }

    // Grunnutvalget: tresifret nivå, ~50 enheter i Brregs egen rekkefølge.
    // Brregs revisjon avviker fra SSBs på femsifret, men stemmer grovere opp:
    // `56.1` traff 12 298 enheter der `56.101` traff null.
    //
    // Lista leses her, etter modusene over — ?brands=1 og ?stor=1 bruker den
    // ikke, og med lesingen først returnerte de «ferdig» så snart ?fra pekte
    // forbi enden av den.
    const alle = await les('industries?select=nace_code&nace_level=eq.3&order=nace_code&limit=500');
    const koder = alle.map((n) => n['nace_code'] as string).slice(fra, fra + antall);
    logg.push(`${alle.length} tresifrede naeringer, tar ${koder.length} fra indeks ${fra}`);
    if (koder.length === 0) return svar({ ferdig: true, logg });

    const enheter: Record<string, unknown>[] = [];
    const sett = new Set<string>();
    for (const kode of koder) {
      let r = await hent(`${ENHETER}?naeringskode=${encodeURIComponent(kode)}&size=${per}`);
      if (!r.ok) { tell(`enhetsregister_${r.status}`); continue; }
      let b = ((await r.json())?._embedded?.enheter ?? []) as Record<string, unknown>[];
      if (b.length === 0) {
        // SN2025-fallback: koden finnes ikke lenger, prøv tosifret prefiks.
        r = await hent(`${ENHETER}?naeringskode=${kode.slice(0, 2)}&size=${per}`);
        if (r.ok) b = ((await r.json())?._embedded?.enheter ?? []) as Record<string, unknown>[];
        tell(b.length === 0 ? 'naering_uten_treff' : 'sn2025_prefiks');
      }
      // Dedupe innen kallet: to koder som faller tilbake til samme prefiks ville
      // ellers hentet regnskap for de samme selskapene to ganger.
      for (const e of b) {
        const o = String(e['organisasjonsnummer']);
        if (!sett.has(o)) { sett.add(o); enheter.push(e); }
      }
    }
    logg.push(`${enheter.length} enheter fra Enhetsregisteret`);

    const { rader, snap } = await byggRader(enheter);
    logg.push(`${rader.length} selskaper, ${snap.length} med regnskapstall`);
    logg.push(`grunner: ${JSON.stringify(grunner)}`);

    if (dry) return svar({ dry: true, logg, neste_fra: fra + antall, eksempel: rader.slice(0, 3) });

    await skriv(rader, snap);
    logg.push("skrevet med data_quality='brreg'");

    return svar({ ok: true, logg, neste_fra: fra + antall, flere: fra + antall < alle.length });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 600) });
  }
});
