/**
 * generate-artikkel — skriver bloggartikler forankret i tallene.
 *
 * Fyller: articles. Kalles ukentlig av pg_cron (se headeren nederst) eller
 * manuelt:
 *
 *   ?kategori=frisor    skriv om én bestemt kategori
 *   ?dry=1              kall modellen, valider, IKKE skriv
 *   ?versjon=v1         prompt_version
 *   ?modell=...         overstyrer modellvalget
 *
 * Uten ?kategori velger funksjonen kategorien som har stått lengst uten
 * artikkel (aldri dekket først, deretter eldst). Én artikkel per kall — cron
 * gir én i uka, og 40 kategorier gir dermed nesten et år med innhold før
 * rotasjonen begynner på nytt med ferskere tall.
 *
 * SAMME FORANKRING SOM generate-insights, av samme grunn: en artikkel som
 * høres riktig ut og ikke er det, er verre enn ingen artikkel. Tallene hentes
 * fra basen FØRST og sendes inn i prompten; svaret valideres mot nyttelasten:
 * hvert år og felt modellen viser til må være år og felt vi sendte. Artikler
 * der referansene ikke holder, forkastes og telles — de publiseres ikke.
 *
 * SEO-JOBBEN artikkelen skal gjøre: H1 og tittel svarer på et spørsmål folk
 * googler, ingressen svarer i første setning, og brødteksten er tallene
 * skrevet ut som resonnement — ikke fyllstoff rundt et nøkkelord. Google
 * rangerer sider som svarer; vi har målte svar ingen konkurrent har satt
 * sammen.
 */
const API = 'https://api.anthropic.com/v1/messages';
const STANDARD_MODELL = 'claude-sonnet-5';
const STANDARD_VERSJON = 'v1';

const SERIE_FELT = [
  'year', 'n_enheter', 'omsetning_total', 'omsetning_per_enhet', 'driftsmargin_pct',
  'lonnsandel_pct', 'sysselsatte_total', 'sysselsatte_per_enhet',
] as const;
const OVERSIKT_FELT = [
  'driftsmargin_pct', 'vekst_1ar_pct', 'vekst_cagr_pct', 'n_foretak', 'n_virksomheter',
  'omsetning_per_foretak', 'ansatte_per_foretak', 'lonnsandel_pct', 'sysselsatte', 'ar',
] as const;
const SELSKAP_FELT = ['navn', 'omsetning', 'driftsmargin_pct', 'ansatte', 'regnskapsar', 'kommune_navn'] as const;
const DEMOGRAFI_FELT = ['year', 'nyetableringer', 'konkurser'] as const;

const svar = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

const SYSTEM = `Du skriver artikler for Bransjesjekk, et norsk verktøy for folk
som vurderer å starte, kjøpe eller investere i en bedrift. Leseren er ikke
økonom, men tar en økonomisk beslutning. Artikkelen skal ligne god
næringslivsjournalistikk: konkret, nøktern, med tallene som bærebjelke.

Du får ekte tall fra SSB og Regnskapsregisteret. Du har ingen andre kilder.
Regler du ikke kan bryte:

1. Hvert tall i teksten skal stå i nyttelasten, eller være en enkel utregning
   av to slike — differanse, endring i prosentpoeng, andel. Ikke finn opp.
2. Ingen bransjekunnskap utenfra. Ingen «det er kjent at», ingen råd om
   markedsføring eller drift som ikke kan leses av tallene.
3. Tittelen er spørsmålet leseren googler, på naturlig norsk. Ingressen svarer
   på det i første setning — ikke «i denne artikkelen skal vi se på».
4. Selskapstall gjelder ETT regnskapsår per selskap. Skriv aldri vekst for et
   selskap, og bland aldri selskapets år med statistikkens år uten å si det.
5. Der eierens arbeid ligger i driftsresultatet (får du eierlonn_i_resultat
   som true), skal en høy margin alltid forklares med det.
6. Ingen ferskhetspåstander, ingen «i år», ingen «nylig». Skriv årstallet.
7. Norsk bokmål, aktive verb, korte avsnitt. Mellomtitler som selv er
   spørsmål eller påstander, ikke «Innledning» og «Oppsummering».
8. Demografitall (nyetableringer/konkurser) gjelder hele den tosifrede
   næringen — skriv det, ikke la det se ut som kategoriens egne tall.

Artikkelen skal kunne stå seg i to år: skriv om tallene og sammenhengene, ikke
om «nå».`;

const REF_SKJEMA = {
  type: 'object',
  properties: {
    kilde: { type: 'string', enum: ['kategori_oversikt', 'serie', 'topp_selskaper', 'demografi'] },
    years: { type: 'array', items: { type: 'integer' } },
    felt: { type: 'array', items: { type: 'string' } },
  },
  required: ['kilde', 'years', 'felt'],
};

const VERKTOY = {
  name: 'lever_artikkel',
  description: 'Leverer én ferdig artikkel forankret i tallene.',
  input_schema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'url-slug, a-z0-9 og bindestrek, f.eks. hva-tjener-en-frisorsalong' },
      tittel: { type: 'string', description: 'Spørsmålet leseren googler. Maks 65 tegn.' },
      ingress: { type: 'string', description: '2–3 setninger. Første setning svarer på tittelen, med tall.' },
      seo_beskrivelse: { type: 'string', description: 'Maks 155 tegn, med det viktigste tallet i.' },
      brodtekst: {
        type: 'string',
        description: 'Markdown, 500–800 ord. Mellomtitler med ##. Ingen H1 — tittelen er H1.',
      },
      referanser: { type: 'array', minItems: 2, items: REF_SKJEMA },
    },
    required: ['slug', 'tittel', 'ingress', 'seo_beskrivelse', 'brodtekst', 'referanser'],
  },
};

interface Ref { kilde: string; years: number[]; felt: string[] }

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const onsketKategori = u.searchParams.get('kategori');
    const versjon = u.searchParams.get('versjon') ?? STANDARD_VERSJON;
    const modell = u.searchParams.get('modell') ?? STANDARD_MODELL;

    const SB = Deno.env.get('SUPABASE_URL');
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const AI = Deno.env.get('ANTHROPIC_API_KEY');
    if (!SB || !KEY) return svar({ feil: 'mangler SUPABASE_URL eller SERVICE_ROLE_KEY' }, 500);
    if (!AI) return svar({ feil: 'mangler ANTHROPIC_API_KEY som function secret' }, 500);

    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
    const les = async (sti: string) => {
      const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: H });
      if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return r.json() as Promise<Record<string, unknown>[]>;
    };

    // Velg kategori: aldri dekket først, ellers den med eldst artikkel. Slik
    // ruller cron-jobben gjennom alle 40 og begynner så forfra med nye tall.
    let slug = onsketKategori;
    if (!slug) {
      const kategorier = await les('categories?select=slug&order=sortering');
      const dekket = await les('articles?select=kategori_slug,publisert_dato&order=publisert_dato.desc&limit=1000');
      const sisteDato = new Map<string, string>();
      for (const a of dekket) {
        const k = a['kategori_slug'] as string | null;
        if (k && !sisteDato.has(k)) sisteDato.set(k, a['publisert_dato'] as string);
      }
      const udekket = kategorier.map((k) => k['slug'] as string).filter((s) => !sisteDato.has(s));
      slug = udekket[0] ??
        [...sisteDato.entries()].sort((a, b) => a[1].localeCompare(b[1]))[0]?.[0] ?? null;
      if (!slug) return svar({ feil: 'ingen kategorier i basen' }, 500);
    }

    // Nyttelasten: kategorioversikten (samme funksjon som frontend leser),
    // topplisten, og demografi via kategoriens ssb-koder. Alt målt.
    const oversiktAlle = await les('rpc/kategori_oversikt');
    const o = oversiktAlle.find((r) => r['slug'] === slug);
    if (!o) return svar({ feil: `kategori ${slug} finnes ikke i kategori_oversikt` }, 404);
    if (o['ar'] == null) return svar({ feil: `kategori ${slug} har ingen statistikk å skrive fra` }, 422);

    const oversikt = Object.fromEntries(OVERSIKT_FELT.map((f) => [f, o[f] ?? null]));
    const eierlonn = o['eierlonn_i_resultat'] === true;
    const serie = ((o['serie'] ?? []) as Record<string, unknown>[]).map((p) => ({
      year: Number(p['ar']), omsetning_total: p['omsetning'] == null ? null : Number(p['omsetning']),
    }));

    const selskaperRa = await les(
      `rpc/topp_selskaper?kategori_slug=${slug}&metrikk=omsetning&antall=5`);
    const selskaper = selskaperRa.map((s) =>
      Object.fromEntries(SELSKAP_FELT.map((f) => [f, s[f] ?? null])));

    const medl = await les(`categories?select=id,sporsmal&slug=eq.${slug}`);
    const medlemmer = medl[0]
      ? await les(`category_members?select=nace_code&kilde=eq.ssb&category_id=eq.${medl[0]['id']}`)
      : [];
    const toKoder = [...new Set(medlemmer.map((m) => (m['nace_code'] as string).slice(0, 2)))];
    const demografi: Record<string, number>[] = [];
    if (toKoder.length === 1) {
      const forelder = await les(`industries?select=id&nace_code=eq.${toKoder[0]}`);
      if (forelder[0]) {
        const d = await les(
          'industry_demography?select=year,nyetableringer,konkurser' +
          `&industry_id=eq.${forelder[0]['id']}&region_level=eq.fylke&data_quality=eq.ssb&order=year&limit=5000`);
        const perAr = new Map<number, { nyetableringer: number; konkurser: number }>();
        for (const r of d) {
          const y = Number(r['year']);
          const a = perAr.get(y) ?? { nyetableringer: 0, konkurser: 0 };
          a.nyetableringer += Number(r['nyetableringer'] ?? 0);
          a.konkurser += Number(r['konkurser'] ?? 0);
          perAr.set(y, a);
        }
        for (const [y, a] of [...perAr.entries()].sort((x, z) => x[0] - z[0]))
          demografi.push({ year: y, ...a });
      }
    }

    const nyttelast = {
      kategori: { slug, navn: o['navn'], verden: o['verden'], sporsmal: medl[0]?.['sporsmal'] ?? null },
      kilde: 'SSB strukturstatistikk (kategori_oversikt) og Regnskapsregisteret (topp_selskaper)',
      eierlonn_i_resultat: eierlonn,
      kategori_oversikt: oversikt,
      serie,
      topp_selskaper: {
        hva: 'de fem største selskapene på omsetning, hvert med ETT regnskapsår',
        rader: selskaper,
      },
      demografi: toKoder.length === 1
        ? {
          nivaa: `hele den tosifrede næringen ${toKoder[0]}, summert over fylker — ikke bare kategorien`,
          rader: demografi,
        }
        : { nivaa: 'kategorien spenner flere divisjoner — demografi utelatt', rader: [] },
    };

    const r = await fetch(API, {
      method: 'POST',
      headers: { 'x-api-key': AI, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modell,
        max_tokens: 4000,
        system: SYSTEM,
        tools: [VERKTOY],
        tool_choice: { type: 'tool', name: 'lever_artikkel' },
        messages: [{
          role: 'user',
          content: `Skriv én artikkel om kategorien ${o['navn']}.\n\n` +
            `Tall:\n${JSON.stringify(nyttelast, null, 1)}\n\n` +
            'Bruk bare tallene over. Referansene skal peke på kildene, årene og feltene du faktisk brukte.',
        }],
      }),
    });
    if (!r.ok) return svar({ feil: `modell ${r.status}`, detalj: (await r.text()).slice(0, 300) }, 502);
    const m = await r.json();
    const bruk = (m?.content ?? []).find((c: Record<string, unknown>) => c['type'] === 'tool_use');
    if (!bruk) return svar({ feil: 'modellen kalte ikke verktøyet' }, 502);
    const ut = bruk['input'] as {
      slug: string; tittel: string; ingress: string; seo_beskrivelse: string;
      brodtekst: string; referanser: Ref[];
    };

    // Forankringen: hvert år og felt modellen viser til må være sendt.
    const arSerie = new Set(serie.map((s) => s.year));
    const arDemo = new Set(demografi.map((d) => d['year']));
    const arSelskap = new Set(selskaper.map((s) => s['regnskapsar']).filter((y) => y != null));
    const statistikkAr = oversikt['ar'] == null ? null : Number(oversikt['ar']);
    const forkastet: string[] = [];
    const gyldig = (ref: Ref): boolean => {
      const sjekkFelt = (lov: readonly string[]) => {
        for (const f of ref.felt ?? [])
          if (!lov.includes(f)) { forkastet.push(`felt ${f} ikke sendt (${ref.kilde})`); return false; }
        return true;
      };
      if (ref?.kilde === 'kategori_oversikt') {
        for (const y of ref.years ?? [])
          if (y !== statistikkAr) { forkastet.push(`år ${y} != statistikkåret ${statistikkAr}`); return false; }
        return sjekkFelt(OVERSIKT_FELT);
      }
      if (ref?.kilde === 'serie') {
        for (const y of ref.years ?? [])
          if (!arSerie.has(y)) { forkastet.push(`serieår ${y} ikke sendt`); return false; }
        return sjekkFelt(SERIE_FELT);
      }
      if (ref?.kilde === 'topp_selskaper') {
        for (const y of ref.years ?? [])
          if (!arSelskap.has(y)) { forkastet.push(`regnskapsår ${y} ikke sendt`); return false; }
        return sjekkFelt(SELSKAP_FELT);
      }
      if (ref?.kilde === 'demografi') {
        for (const y of ref.years ?? [])
          if (!arDemo.has(y)) { forkastet.push(`demografiår ${y} ikke sendt`); return false; }
        return sjekkFelt(DEMOGRAFI_FELT);
      }
      forkastet.push(`ukjent kilde ${ref?.kilde}`);
      return false;
    };
    const referanser = (ut.referanser ?? []).filter(gyldig);

    // En artikkel der referansene ikke holder publiseres ikke. Terskelen er
    // to: én gyldig referanse kan være et lykketreff, en artikkel bygger på
    // flere tall.
    if (referanser.length < 2) {
      return svar({
        kategori: slug, skrev: 'ingenting — forankringen holdt ikke',
        gyldige_referanser: referanser.length, forkastet,
      }, 422);
    }

    // Den leservendte kildelisten utledes av de VALIDERTE referansene, ikke av
    // modellens tekst — da kan den ikke liste en kilde artikkelen ikke brukte.
    const kilder: Record<string, string>[] = [];
    if (referanser.some((x) => x.kilde === 'kategori_oversikt' || x.kilde === 'serie'))
      kilder.push({ navn: 'SSB strukturstatistikk', detalj: `tall til og med ${statistikkAr}` });
    if (referanser.some((x) => x.kilde === 'topp_selskaper'))
      kilder.push({ navn: 'Regnskapsregisteret via Enhetsregisteret', detalj: 'siste innsendte årsregnskap per selskap' });
    if (referanser.some((x) => x.kilde === 'demografi'))
      kilder.push({ navn: 'SSB foretaksdemografi', detalj: `hele den tosifrede næringen ${toKoder[0] ?? ''}` });

    const artikkelSlug = (ut.slug ?? '').replace(/[^a-z0-9-]/g, '') || `${slug}-analyse`;
    const rad = {
      slug: artikkelSlug,
      tittel: ut.tittel, ingress: ut.ingress, brodtekst: ut.brodtekst,
      seo_beskrivelse: (ut.seo_beskrivelse ?? '').slice(0, 155),
      kategori_slug: slug, status: 'publisert',
      referanser, kilder, model: modell, prompt_version: versjon,
    };
    const sammendrag = {
      kategori: slug, artikkel_slug: artikkelSlug, tittel: ut.tittel,
      ord: ut.brodtekst.split(/\s+/).length,
      referanser: referanser.length, forkastet: forkastet.length,
      hvorfor_forkastet: forkastet.slice(0, 5), tokens: m?.usage,
    };
    if (dry) return svar({ ...sammendrag, dry: true, ingress: ut.ingress });

    // Upsert på slug: en regenerering av samme tema erstatter, dubler ikke.
    const w = await fetch(`${SB}/rest/v1/articles?on_conflict=slug`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rad),
    });
    if (!w.ok) return svar({ feil: `skriv artikkel: ${w.status} ${(await w.text()).slice(0, 300)}` }, 500);

    return svar({ ...sammendrag, skrev: 'ok' });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 800) }, 500);
  }
});

/*
 * CRON-OPPSETTET (kjørt manuelt i livebasen, ikke en migrasjon — pg_cron og
 * pg_net finnes ikke i PGlite, så testene ville knekt på dem):
 *
 *   create extension if not exists pg_cron;
 *   create extension if not exists pg_net;
 *   select cron.schedule(
 *     'ukentlig-artikkel',
 *     '0 6 * * 1',  -- mandag 06:00 UTC
 *     $$ select net.http_get(
 *          url := 'https://jcpuhhrqhgrnihiacosy.supabase.co/functions/v1/generate-artikkel',
 *          headers := jsonb_build_object('Authorization', 'Bearer <anon-jwt>'),
 *          timeout_milliseconds := 120000) $$);
 *
 * net.http_get er asynkron — cron-jobben fyrer og glemmer, funksjonen jobber
 * ferdig på egen hånd. Én artikkel per mandag; funksjonen velger selv den
 * kategorien som har ventet lengst.
 */
