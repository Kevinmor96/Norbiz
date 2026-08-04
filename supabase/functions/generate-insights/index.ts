/**
 * generate-insights — produserer anslag og innsikt forankret i tallene.
 *
 * Fyller: industry_estimates, ai_insights
 *
 *   ?fra=<indeks>&antall=<n>   hvilken skive av næringslista (3 som standard)
 *   ?bare=56.101               kjør én næring, for inspeksjon
 *   ?dry=1                     kall modellen, valider, IKKE skriv
 *   ?versjon=v1                prompt_version. Endres når prompten endres
 *   ?modell=claude-sonnet-5    overstyrer modellvalget
 *
 * REKKEFØLGEN ER POENGET. Tallene hentes fra basen FØRST, sendes inn i
 * prompten, og svaret skrives tilbake. En modell som svarer uten å ha sett
 * radene produserer tekst som høres riktig ut og ikke er det.
 *
 * FORANKRING HÅNDHEVES TO GANGER, og bare den andre er verdt noe. Databasen
 * krever at `referanser` og `basert_pa` er ikke-tomme — men en modell kan fylle
 * dem med noe som ser ut som en referanse. Derfor validerer denne funksjonen
 * hver referanse mot nyttelasten vi faktisk sendte: næringskoden må være
 * næringens egen, årstallene må være år vi sendte, feltnavnene må være felt vi
 * sendte. Rader som viser til noe modellen ikke fikk, forkastes og telles i
 * `forkastet`. En prompt som begynner å hallusinere blir dermed synlig som et
 * tall i svaret, i stedet for som feilaktig tekst i UI-et.
 *
 * ANSLAG ER SPENN. `intervall_lav`/`intervall_hoy` med konfidens, aldri ett
 * presist tall. «Etableringskapital 300 000–800 000, middels konfidens» er et
 * ærlig svar; «512 000» er det ikke. Metrikkene er de samme tre som seed-en
 * brukte, slik at frontend ikke må lære et nytt vokabular.
 *
 * LØNNSTALL SENDES IKKE INN. `industry_wages` er fortsatt seed-data
 * (`data_quality='mock'`), og en innsikt forankret i mock-tall ville vært en
 * oppdiktet påstand med kildehenvisning — verre enn ingen innsikt. Bare rader
 * med `data_quality='ssb'` går inn i prompten. Når lønnsimporten er ekte, kan
 * serien legges til her.
 *
 * BATCH, IKKE BRUKERFLYT. Kjøres planlagt, og resultatet caches på
 * (industry_id, region_id, prompt_version). Ingen modellkall når en bruker
 * åpner en side — det er forskjellen mellom en engangskostnad på noen kroner og
 * en regning som vokser med trafikken.
 *
 * IDEMPOTENS. `industry_estimates` har naturlig nøkkel
 * (industry_id, region_id, metrikk). `ai_insights` har ingen — en næring kan ha
 * tre innsikter én gang og fem den neste — så radene slettes for
 * (industry_id, region_id, prompt_version) før den nye batchen skrives. Uten
 * det ville en ny kjøring dublert alt som står i UI-et.
 *
 * NØKKEL. Krever `ANTHROPIC_API_KEY` som function secret i Supabase-prosjektet.
 * Den kan ikke settes herfra, og funksjonen svarer med en tydelig feil framfor å
 * kaste hvis den mangler.
 */
const API = 'https://api.anthropic.com/v1/messages';
const STANDARD_MODELL = 'claude-sonnet-5';
const STANDARD_VERSJON = 'v1';

/** Feltene vi sender. Validering av referanser skjer mot disse to listene. */
const SERIE_FELT = [
  'year', 'n_enheter', 'omsetning_total', 'omsetning_per_enhet', 'driftsmargin_pct',
  'lonnsandel_pct', 'sysselsatte_total', 'sysselsatte_per_enhet',
  'verdiskaping_per_sysselsatt', 'bruttoinvestering_total',
] as const;
const DEMOGRAFI_FELT = ['year', 'nyetableringer', 'konkurser'] as const;

const METRIKKER = ['etableringskapital', 'tid_til_lonnsomhet', 'sesongvariasjon'] as const;
const ENHETER: Record<string, string> = {
  etableringskapital: 'NOK', tid_til_lonnsomhet: 'mnd', sesongvariasjon: 'pct',
};
const KONFIDENS = ['lav', 'middels', 'hoy'];
const TYPER = ['risiko', 'mulighet', 'avvik', 'sammenligning', 'kontekst'];

const svar = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

const SYSTEM = `Du skriver forankret bransjeinnsikt for Bransjeindeks, et norsk
beslutningsverktøy for folk som vurderer å starte, kjøpe eller investere i en
bedrift. Leseren er ikke økonom, men tar en økonomisk beslutning.

Du får ekte tall fra SSBs strukturstatistikk og foretaksdemografi. Du har ingen
andre kilder. Regler du ikke kan bryte:

1. Hver påstand skal kunne leses av tallene du får. Får du ikke tallet, skal du
   ikke påstå det. Ingen bransjekunnskap utenfra, ingen «det er kjent at».
2. Hvert tall du nevner i teksten skal stå i nyttelasten, eller være en enkel
   utregning av to slike — differanse, endring i prosentpoeng, andel. Rund gjerne
   av, men ikke finn opp.
3. Referansene er ikke pynt. De skal peke på de faktiske radene påstanden hviler
   på: riktig næringskode, riktige år, riktige feltnavn. Svar som viser til år
   eller felt du ikke fikk, blir forkastet.
4. Anslagene er spenn med konfidens, aldri ett tall. Konfidensen skal være lav
   der tallgrunnlaget er tynt eller indirekte.
5. Norsk, konkret, uten markedsføringsspråk. «Driftsmarginen falt fra 6,1 % til
   4,3 % mellom 2019 og 2024» er bra. «Bransjen står ved et veiskille» er ikke.
6. Ingen ferskhetspåstander. SSB publiserer årlig med etterslep; det seneste året
   du får er det seneste som finnes.

Om driftsmargin: der lønnskostnad per sysselsatt er lav og bedriftene har få
ansatte, ligger eierens eget arbeid i driftsresultatet og ikke i lønnskostnaden.
Marginen er da ikke sammenlignbar med en næring som lønner ansatte. Nevner du en
høy margin i en slik næring, skal du si hvorfor.

Om demografien: nyetableringer og konkurser finnes bare på tosifret næring, altså
for hele divisjonen. Du skal ikke skrive dem som om de gjaldt den femsifrede
næringen alene.`;

const REF_SKJEMA = {
  type: 'object',
  properties: {
    table: { type: 'string', enum: ['industry_stats', 'industry_demography'] },
    nace_code: { type: 'string' },
    years: { type: 'array', items: { type: 'integer' } },
    felt: { type: 'array', items: { type: 'string' } },
  },
  required: ['table', 'nace_code', 'years', 'felt'],
};

const VERKTOY = {
  name: 'lever_innsikt',
  description: 'Leverer innsikt og anslag for én næring.',
  input_schema: {
    type: 'object',
    properties: {
      innsikter: {
        type: 'array', minItems: 2, maxItems: 5,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: TYPER },
            tittel: { type: 'string', description: 'Kort og konkret, maks 70 tegn.' },
            body: { type: 'string', description: '2–4 setninger med tallene i.' },
            alvorlighet: { type: 'integer', minimum: 1, maximum: 5,
              description: 'Hvor mye dette bør vekte i en beslutning. 1 = bakgrunn, 5 = avgjørende.' },
            year: { type: 'integer', description: 'Året påstanden gjelder.' },
            knyttet_til: { type: 'string',
              description: 'Feltnavnet KPI-en heter, f.eks. driftsmargin_pct.' },
            referanser: { type: 'array', minItems: 1, items: REF_SKJEMA },
          },
          required: ['type', 'tittel', 'body', 'alvorlighet', 'year', 'knyttet_til', 'referanser'],
        },
      },
      anslag: {
        type: 'array', minItems: 1, maxItems: 3,
        items: {
          type: 'object',
          properties: {
            metrikk: { type: 'string', enum: [...METRIKKER] },
            intervall_lav: { type: 'number' },
            intervall_hoy: { type: 'number' },
            konfidens: { type: 'string', enum: KONFIDENS },
            begrunnelse: { type: 'string', description: 'Hvorfor spennet ligger der. 1–2 setninger.' },
            basert_pa: { type: 'array', minItems: 1, items: REF_SKJEMA },
          },
          required: ['metrikk', 'intervall_lav', 'intervall_hoy', 'konfidens', 'begrunnelse', 'basert_pa'],
        },
      },
    },
    required: ['innsikter', 'anslag'],
  },
};

interface Ref { table: string; nace_code: string; years: number[]; felt: string[] }

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const fra = Number(u.searchParams.get('fra') ?? 0);
    const antall = Number(u.searchParams.get('antall') ?? 3);
    const bare = u.searchParams.get('bare');
    const versjon = u.searchParams.get('versjon') ?? STANDARD_VERSJON;
    const modell = u.searchParams.get('modell') ?? STANDARD_MODELL;

    const SB = Deno.env.get('SUPABASE_URL');
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const AI = Deno.env.get('ANTHROPIC_API_KEY');
    if (!SB || !KEY) return svar({ feil: 'mangler SUPABASE_URL eller SERVICE_ROLE_KEY' }, 500);
    if (!AI) {
      return svar({
        feil: 'mangler ANTHROPIC_API_KEY',
        hva_na: 'Sett den som function secret i Supabase (Edge Functions -> Secrets). ' +
          'Den kan ikke settes fra denne funksjonen.',
      }, 500);
    }

    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
    const les = async (sti: string) => {
      const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: H });
      if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return r.json() as Promise<Record<string, unknown>[]>;
    };

    const logg: string[] = [];

    // Utvalget er de SSB-kodene kategorilaget faktisk bruker. `industries` er
    // 1 058 koder, og de 995 ingen kategori peker på ville kostet modellkall
    // ingen leser.
    const medl = await les('category_members?select=nace_code&kilde=eq.ssb');
    const koder = [...new Set(medl.map((m) => m['nace_code'] as string))].sort();
    const utvalg = bare ? [bare] : koder.slice(fra, fra + antall);
    logg.push(`${koder.length} kategorikoder, tar ${utvalg.length}` +
      `${bare ? ` (bare ${bare})` : ` fra indeks ${fra}`}`);
    if (utvalg.length === 0) return svar({ ferdig: true, logg });

    const land = await les('regions?select=id&level=eq.land&code=eq.0');
    const landId = land[0]?.['id'] as string | undefined;
    if (!landId) throw new Error('fant ingen landregion med code=0');

    // Peiling for «sammenligning»: median driftsmargin på tvers av de
    // femsifrede næringene siste år. Uten en målestokk er en marginpåstand bare
    // et tall.
    const alleMarginer = await les(
      'industry_stats?select=driftsmargin_pct,year' +
      '&region_level=eq.land&unit_type=eq.foretak&nace_level=eq.5' +
      '&data_quality=eq.ssb&driftsmargin_pct=not.is.null&limit=20000');
    const sisteAr = alleMarginer.length ? Math.max(...alleMarginer.map((r) => Number(r['year']))) : null;
    const marginerSiste = alleMarginer
      .filter((r) => Number(r['year']) === sisteAr)
      .map((r) => Number(r['driftsmargin_pct'])).sort((a, b) => a - b);
    const medianMargin = marginerSiste.length
      ? marginerSiste[Math.floor(marginerSiste.length / 2)] : null;

    const resultat: Record<string, unknown>[] = [];

    for (const kode of utvalg) {
      const ind = await les(`industries?select=id,nace_code,name,common_name&nace_code=eq.${kode}`);
      const i = ind[0];
      if (!i) { resultat.push({ kode, hoppet_over: 'næringen finnes ikke' }); continue; }
      const industryId = i['id'] as string;

      const rader = await les(
        `industry_stats?select=${SERIE_FELT.join(',')}` +
        `&industry_id=eq.${industryId}&region_level=eq.land&unit_type=eq.foretak` +
        `&data_quality=eq.ssb&order=year&limit=50`);
      const serie = rader.map((r) => Object.fromEntries(
        SERIE_FELT.map((f) => [f, r[f] == null ? null : Number(r[f])])));
      if (serie.length < 2) {
        resultat.push({ kode, hoppet_over: 'under to år med målt statistikk' });
        continue;
      }

      // Demografien finnes bare på tosifret nivå og bare per fylke. Summen over
      // fylker er nasjonaltallet. Nivået står i nyttelasten, ellers kan en
      // påstand om «denne næringen» hvile på hele divisjonen uten at det synes.
      const to = kode.slice(0, 2);
      const forelder = await les(`industries?select=id&nace_code=eq.${to}`);
      const demografi: Record<string, number>[] = [];
      if (forelder[0]) {
        const d = await les(
          'industry_demography?select=year,nyetableringer,konkurser' +
          `&industry_id=eq.${forelder[0]['id']}&region_level=eq.fylke&data_quality=eq.ssb` +
          '&order=year&limit=5000');
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

      const nyttelast = {
        naering: { nace_code: kode, navn: i['name'], folkelig_navn: i['common_name'] },
        enhet: 'foretak, hele landet',
        kilde: 'SSB strukturstatistikk tabell 12910, data_quality=ssb',
        serie,
        demografi: {
          nace_code: to,
          nivaa: `tosifret næring, summert over fylker — gjelder hele divisjonen ${to}, ikke bare ${kode}`,
          kilde: 'SSB 08076 (nye foretak) og 07165 (konkurser)',
          rader: demografi,
        },
        peiling: {
          median_driftsmargin_femsifrede_naeringer: medianMargin,
          aar: sisteAr,
        },
      };

      const r = await fetch(API, {
        method: 'POST',
        headers: {
          'x-api-key': AI, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modell,
          max_tokens: 4000,
          system: SYSTEM,
          tools: [VERKTOY],
          tool_choice: { type: 'tool', name: 'lever_innsikt' },
          messages: [{
            role: 'user',
            content: `Næringen er ${i['common_name']} (${i['name']}, NACE ${kode}).\n\n` +
              `Tall:\n${JSON.stringify(nyttelast, null, 1)}\n\n` +
              'Skriv 2–5 innsikter, og anslag for de metrikkene du kan begrunne ut fra ' +
              'tallene over. Bruk ingen andre kilder.',
          }],
        }),
      });
      if (!r.ok) {
        resultat.push({ kode, feil: `modell ${r.status}`, detalj: (await r.text()).slice(0, 300) });
        continue;
      }
      const m = await r.json();
      const bruk = (m?.content ?? []).find((c: Record<string, unknown>) => c['type'] === 'tool_use');
      if (!bruk) { resultat.push({ kode, feil: 'modellen kalte ikke verktøyet' }); continue; }
      const ut = bruk['input'] as { innsikter?: unknown[]; anslag?: unknown[] };

      // Valideringen som gjør forankringen ekte. En referanse til et år vi ikke
      // sendte betyr at påstanden ikke hviler på noe vi kan vise leseren.
      const arSerie = new Set(serie.map((s) => s['year'] as number));
      const arDemo = new Set(demografi.map((d) => d['year']));
      const gyldigRef = (ref: Ref, hvorfor: string[]): boolean => {
        if (ref?.table === 'industry_stats') {
          if (ref.nace_code !== kode) { hvorfor.push(`nace ${ref.nace_code} != ${kode}`); return false; }
          for (const y of ref.years ?? [])
            if (!arSerie.has(y)) { hvorfor.push(`år ${y} ikke sendt`); return false; }
          for (const f of ref.felt ?? [])
            if (!(SERIE_FELT as readonly string[]).includes(f)) { hvorfor.push(`felt ${f} ikke sendt`); return false; }
          return true;
        }
        if (ref?.table === 'industry_demography') {
          if (ref.nace_code !== to) { hvorfor.push(`demografinace ${ref.nace_code} != ${to}`); return false; }
          for (const y of ref.years ?? [])
            if (!arDemo.has(y)) { hvorfor.push(`demografiår ${y} ikke sendt`); return false; }
          for (const f of ref.felt ?? [])
            if (!(DEMOGRAFI_FELT as readonly string[]).includes(f)) { hvorfor.push(`demografifelt ${f} ikke sendt`); return false; }
          return true;
        }
        hvorfor.push(`ukjent tabell ${ref?.table}`);
        return false;
      };

      const forkastet: string[] = [];
      const innsikter = (ut.innsikter ?? []).filter((x) => {
        const o = x as { type: string; alvorlighet: number; referanser: Ref[]; tittel: string };
        if (!TYPER.includes(o.type)) { forkastet.push(`innsikt: ukjent type ${o.type}`); return false; }
        if (!(o.alvorlighet >= 1 && o.alvorlighet <= 5)) { forkastet.push('innsikt: alvorlighet utenfor 1–5'); return false; }
        o.referanser = (o.referanser ?? []).filter((ref) => {
          const hvorfor: string[] = [];
          if (gyldigRef(ref, hvorfor)) return true;
          forkastet.push(`innsikt «${(o.tittel ?? '').slice(0, 40)}»: ${hvorfor[0]}`);
          return false;
        });
        return o.referanser.length > 0;
      }) as Record<string, unknown>[];

      const anslag = (ut.anslag ?? []).filter((x) => {
        const o = x as { metrikk: string; intervall_lav: number; intervall_hoy: number;
          konfidens: string; basert_pa: Ref[] };
        if (!(METRIKKER as readonly string[]).includes(o.metrikk)) { forkastet.push(`anslag: ukjent metrikk ${o.metrikk}`); return false; }
        if (!KONFIDENS.includes(o.konfidens)) { forkastet.push(`anslag ${o.metrikk}: ukjent konfidens`); return false; }
        if (!(o.intervall_hoy >= o.intervall_lav)) { forkastet.push(`anslag ${o.metrikk}: spennet står omvendt`); return false; }
        o.basert_pa = (o.basert_pa ?? []).filter((ref) => {
          const hvorfor: string[] = [];
          if (gyldigRef(ref, hvorfor)) return true;
          forkastet.push(`anslag ${o.metrikk}: ${hvorfor[0]}`);
          return false;
        });
        return o.basert_pa.length > 0;
      }) as Record<string, unknown>[];

      const innsiktRader = innsikter.map((o) => ({
        industry_id: industryId, region_id: landId,
        year: o['year'], type: o['type'], tittel: o['tittel'], body: o['body'],
        alvorlighet: o['alvorlighet'], referanser: o['referanser'], knyttet_til: o['knyttet_til'],
        model: modell, prompt_version: versjon, data_quality: 'ai_anslag',
      }));
      const anslagRader = anslag.map((o) => ({
        industry_id: industryId, region_id: null, metrikk: o['metrikk'],
        intervall_lav: o['intervall_lav'], intervall_hoy: o['intervall_hoy'],
        enhet: ENHETER[o['metrikk'] as string] ?? null,
        konfidens: o['konfidens'], begrunnelse: o['begrunnelse'], basert_pa: o['basert_pa'],
        model: modell, prompt_version: versjon,
        source: `ai:${modell}`, data_quality: 'ai_anslag',
      }));

      const sammendrag: Record<string, unknown> = {
        kode, navn: i['common_name'],
        innsikter: innsiktRader.length, anslag: anslagRader.length,
        forkastet: forkastet.length, hvorfor_forkastet: forkastet.slice(0, 5),
        tokens: m?.usage,
      };
      if (dry) {
        resultat.push({ ...sammendrag, dry: true, eksempel: innsiktRader[0], anslag_eksempel: anslagRader[0] });
        continue;
      }
      if (innsiktRader.length === 0 && anslagRader.length === 0) {
        resultat.push({ ...sammendrag, skrev: 'ingenting — alt forkastet' });
        continue;
      }

      // Slett før innsett: ai_insights har ingen naturlig nøkkel, og en ny
      // kjøring med samme prompt_version skal ERSTATTE forrige, ikke legge til.
      const slett = await fetch(
        `${SB}/rest/v1/ai_insights?industry_id=eq.${industryId}` +
        `&region_id=eq.${landId}&prompt_version=eq.${encodeURIComponent(versjon)}`,
        { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
      if (!slett.ok) throw new Error(`slett innsikt: ${slett.status} ${(await slett.text()).slice(0, 200)}`);

      if (innsiktRader.length > 0) {
        const w = await fetch(`${SB}/rest/v1/ai_insights`, {
          method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify(innsiktRader),
        });
        if (!w.ok) throw new Error(`skriv innsikt: ${w.status} ${(await w.text()).slice(0, 300)}`);
      }

      if (anslagRader.length > 0) {
        // `region_id` er NULL for nasjonale anslag, og NULL deltar ikke i en
        // unique-constraint: upserten ville derfor ikke truffet den gamle
        // seed-raden, og næringen ville fått to anslag for samme metrikk. Vi
        // sletter eksplisitt på metrikk i stedet.
        const metrikker = [...new Set(anslagRader.map((a) => a.metrikk as string))];
        const slettA = await fetch(
          `${SB}/rest/v1/industry_estimates?industry_id=eq.${industryId}` +
          `&region_id=is.null&metrikk=in.(${metrikker.join(',')})`,
          { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
        if (!slettA.ok) throw new Error(`slett anslag: ${slettA.status} ${(await slettA.text()).slice(0, 200)}`);
        const w = await fetch(`${SB}/rest/v1/industry_estimates`, {
          method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify(anslagRader),
        });
        if (!w.ok) throw new Error(`skriv anslag: ${w.status} ${(await w.text()).slice(0, 300)}`);
      }

      resultat.push({ ...sammendrag, skrev: 'ok' });
    }

    return svar({
      ok: true, logg, versjon, modell, resultat,
      neste_fra: bare ? null : fra + antall,
      flere: bare ? false : fra + antall < koder.length,
    });
  } catch (e) {
    // Uten denne gir edge-runtimen bare "Internal Server Error" uten logg.
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 800) }, 500);
  }
});
