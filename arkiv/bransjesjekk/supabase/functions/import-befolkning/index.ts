/**
 * import-befolkning — folketall per fylke og for landet, fra SSB-tabell 07459.
 *
 *   ?dry=1    hent, summer og valider, IKKE skriv
 *   ?fra=2017 første år (standard 2017)
 *
 * Folketallet mater konkurransedelscoren (enheter per innbygger), og var det
 * siste syntetiske tallet i basen sammen med lønnen. Kilden er 07459
 * (befolkning per kommune, 1. januar), og fylkestallene REGNES SOM SUM AV
 * KOMMUNENE per tosifret prefiks per år. Det er ikke en snarvei men poenget:
 * kommunenumrene bytter årgang sammen med fylkene, så summen per prefiks gir
 * automatisk riktig fylkesårgang for hvert år — 01/02/... til 2019, 30/34/...
 * 2020–2023, 31/32/... fra 2024 — og radene lander på riktig regions-rad via
 * (code, valid_from_year, valid_to_year). Landets tall er summen av alt.
 *
 * Kjønn og alder har elimination i 07459 og utelates — vi henter totalen.
 * Rader skrives bare der en regions-rad finnes for (prefiks, år); alt annet
 * telles som hoppet over. Valideringen i dry-modus sjekker at landssummen
 * ligger der Norges folketall skal ligge (5,2–5,7 mill.) for hvert år —
 * en sum som plutselig er det dobbelte betyr at en årgangsovergang
 * dobbelteller, og da skal ingenting skrives.
 *
 * Idempotent: delete + insert av data_quality='ssb'. Mock slettes eksplisitt
 * etterpå, som i import-lonn.
 */
const TABELL = 'https://data.ssb.no/api/v0/no/table/07459';

const svar = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const fraAr = Number(u.searchParams.get('fra') ?? 2017);

    const SB = Deno.env.get('SUPABASE_URL');
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SB || !KEY) return svar({ feil: 'mangler SUPABASE_URL eller SERVICE_ROLE_KEY' }, 500);
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

    const metaR = await fetch(TABELL);
    if (!metaR.ok) return svar({ feil: `metadata ${metaR.status}` }, 502);
    const meta = await metaR.json();
    const dimer = meta.variables as { code: string; values: string[] }[];
    const region = dimer.find((d) => d.code === 'Region');
    const tid = dimer.find((d) => d.code === 'Tid');
    if (!region || !tid) return svar({ feil: 'fant ikke Region/Tid i metadata' }, 502);

    // Bare firesifrede kommunekoder — regionsdimensjonen har også fylker og
    // aggregater, og å blande dem inn ville dobbeltellet summen.
    const kommuner = region.values.filter((v) => /^\d{4}$/.test(v));
    const ar = tid.values.filter((y) => Number(y) >= fraAr);

    const sp = await fetch(TABELL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: [
          { code: 'Region', selection: { filter: 'item', values: kommuner } },
          { code: 'Tid', selection: { filter: 'item', values: ar } },
        ],
        response: { format: 'json-stat2' },
      }),
    });
    if (!sp.ok) return svar({ feil: `spørring ${sp.status}`, detalj: (await sp.text()).slice(0, 300) }, 502);
    const js = await sp.json();

    const dimId = js.id as string[];
    const size = js.size as number[];
    const dimObj = js.dimension as Record<string, { category: { index: Record<string, number> } }>;
    const verdi = js.value as (number | null)[];
    const stride: number[] = new Array(dimId.length).fill(1);
    for (let i = dimId.length - 2; i >= 0; i--) stride[i] = stride[i + 1]! * size[i + 1]!;
    const regIdx = dimObj['Region']!.category.index;
    const tidIdx = dimObj['Tid']!.category.index;
    const iReg = stride[dimId.indexOf('Region')]!;
    const iTid = stride[dimId.indexOf('Tid')]!;

    // Sum per (fylkesprefiks, år) og (land, år). 0 betyr at koden ikke fantes
    // det året — den bidrar ikke, og det er riktig.
    //
    // Regionsmodellen vår fører 50 Trøndelag og 54 Troms og Finnmark også for
    // 2017–2019, slik SSBs regionsdimensjon i 12937 gjør. Kommunekodene fra de
    // årene bruker forgjengerfylkene, så prefiksene aliasmappes: 16/17 var
    // Sør- og Nord-Trøndelag, 19/20 var Troms og Finnmark hver for seg.
    const ALIAS: Record<string, string> = { '16': '50', '17': '50', '19': '54', '20': '54' };
    const perFylkeAr = new Map<string, number>();
    const perAr = new Map<number, number>();
    for (const k of kommuner) {
      for (const y of ar) {
        const v = verdi[regIdx[k]! * iReg + tidIdx[y]! * iTid];
        if (v == null || v === 0) continue;
        const prefiks = k.slice(0, 2);
        const nk = `${ALIAS[prefiks] ?? prefiks}|${y}`;
        perFylkeAr.set(nk, (perFylkeAr.get(nk) ?? 0) + v);
        perAr.set(Number(y), (perAr.get(Number(y)) ?? 0) + v);
      }
    }

    // Norges folketall per år som rimelighetskontroll.
    const utenforRimelig = [...perAr.entries()]
      .filter(([, sum]) => sum < 5_200_000 || sum > 5_700_000);
    if (utenforRimelig.length > 0) {
      return svar({
        feil: 'landssum utenfor 5,2–5,7 mill. — årgangsovergang dobbelteller?',
        summer: Object.fromEntries(perAr),
      }, 422);
    }

    const regR = await fetch(
      `${SB}/rest/v1/regions?select=id,code,level,valid_from_year,valid_to_year&limit=200`,
      { headers: H });
    const regioner = await regR.json() as {
      id: string; code: string; level: string;
      valid_from_year: number; valid_to_year: number | null;
    }[];

    const rader: Record<string, unknown>[] = [];
    const hoppet: string[] = [];
    for (const [nk, sum] of perFylkeAr) {
      const [prefiks, yS] = nk.split('|');
      const y = Number(yS);
      const r = regioner.find((x) =>
        x.level === 'fylke' && x.code === prefiks &&
        x.valid_from_year <= y && (x.valid_to_year == null || x.valid_to_year >= y));
      if (!r) { hoppet.push(nk); continue; }
      rader.push({ region_id: r.id, year: y, innbyggere: sum, source: 'ssb:07459', data_quality: 'ssb' });
    }
    const land = regioner.find((x) => x.level === 'land');
    if (land) {
      for (const [y, sum] of perAr)
        rader.push({ region_id: land.id, year: y, innbyggere: sum, source: 'ssb:07459', data_quality: 'ssb' });
    }

    const sammendrag = {
      kommunekoder: kommuner.length, ar: ar.length,
      rader: rader.length, hoppet_over: hoppet.length,
      hoppet_eksempler: hoppet.slice(0, 10),
      landssum: Object.fromEntries(perAr),
    };
    if (dry) return svar({ ...sammendrag, dry: true });

    const slett = await fetch(`${SB}/rest/v1/region_population?data_quality=eq.ssb`,
      { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
    if (!slett.ok) return svar({ feil: `slett: ${slett.status}` }, 500);

    for (let i = 0; i < rader.length; i += 500) {
      const w = await fetch(`${SB}/rest/v1/region_population?on_conflict=region_id,year`, {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rader.slice(i, i + 500)),
      });
      if (!w.ok) return svar({ feil: `skriv (${i}): ${w.status} ${(await w.text()).slice(0, 300)}` }, 500);
    }

    return svar({ ...sammendrag, skrev: 'ok' });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 800) }, 500);
  }
});
