/**
 * brreg-sonde — skrivefri oppslagssonde mot Enhetsregisteret.
 *
 *   ?tell=47.81,95.31        antall treff per næringsprefiks, med de første
 *                            radene så man ser at prefikset betyr det vi tror
 *   ?finn=URMAKER BJERKE|THUNE   navnesøk, samme svarform
 *
 * HVORFOR DEN FINNES. Et næringsprefiks uten treff gir en TOM toppliste, ikke
 * en feilmelding. Da bil-kategoriene ble lagt inn med prefikser gjettet ut fra
 * SSB-koden, sto alle fire topplistene tomme uten at noe i loggen sa fra —
 * SN2025 hadde oppløst divisjon 45, og «45» ga 0 treff. Den eneste måten å
 * oppdage det uten en sonde er å savne selskaper man ikke visste skulle vært
 * der. Så: tell treff FØR kategorien legges inn, aldri etter.
 *
 * Antallet er `page.totalElements`. Det er riktig filtrert selv i tilfellene
 * der radene ikke er (se `sort`-advarselen i import-brreg), så det er trygt å
 * telle med.
 *
 * Funksjonen leser bare — ingen skriving til basen, ingen service-role-nøkkel.
 * Den kan trygt kalles med anon-nøkkelen: nyttelasten er offentlige Brreg-data.
 *
 * Containeren i utviklingsmiljøet har ingen rute til data.brreg.no (TLS-feil),
 * og basens `extensions.http` har det heller ikke. Edge-runtimen har det.
 * Derfor er en deployet funksjon eneste vei til disse svarene, og den kalles
 * fra basen:
 *
 *   select extensions.http_set_curlopt('CURLOPT_TIMEOUT','150');
 *   select content from extensions.http((
 *     'GET',
 *     'https://<ref>.supabase.co/functions/v1/brreg-sonde?tell=73.1,59.11',
 *     array[extensions.http_header('Authorization','Bearer <anon-jwt>')]::extensions.http_header[],
 *     null, null)::extensions.http_request);
 */
const ENHETER = 'https://data.brreg.no/enhetsregisteret/api/enheter';

async function hent(url: string, f = 0): Promise<Response> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if ((r.status === 429 || r.status >= 500) && f < 4) {
    const e = Number(r.headers.get('Retry-After') ?? 0);
    await new Promise((s) => setTimeout(s, e > 0 ? e * 1000 : Math.min(2 ** f * 1000, 20_000)));
    return hent(url, f + 1);
  }
  return r;
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const tell = u.searchParams.get('tell');
    const finn = u.searchParams.get('finn');
    const per = Number(u.searchParams.get('per') ?? 3);
    if (!tell && !finn) {
      return new Response(JSON.stringify({
        feil: 'oppgi ?tell=<prefikser, komma> eller ?finn=<navn, adskilt med |>',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const resultat: Record<string, unknown>[] = [];
    const spor = async (nokkel: string, sti: string) => {
      const r = await hent(sti);
      if (!r.ok) { resultat.push({ nokkel, feil: r.status }); return; }
      const j = await r.json();
      const treff = (j?._embedded?.enheter ?? []) as Record<string, unknown>[];
      resultat.push({
        nokkel,
        antall: j?.page?.totalElements ?? 0,
        treff: treff.map((e) => ({
          navn: e['navn'],
          org_nr: e['organisasjonsnummer'],
          nace: (e['naeringskode1'] as Record<string, string>)?.['kode'],
          form: (e['organisasjonsform'] as Record<string, string>)?.['kode'],
          ansatte: e['antallAnsatte'],
          kommune: (e['forretningsadresse'] as Record<string, string>)?.['kommunenummer'],
        })),
      });
    };

    for (const p of (tell ?? '').split(',').map((s) => s.trim()).filter(Boolean))
      await spor(p, `${ENHETER}?naeringskode=${encodeURIComponent(p)}&size=${per}`);
    for (const n of (finn ?? '').split('|').map((s) => s.trim()).filter(Boolean))
      await spor(n, `${ENHETER}?navn=${encodeURIComponent(n)}&size=${Math.max(per, 5)}`);

    return new Response(JSON.stringify({ sonde: true, resultat }, null, 2),
      { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    // Uten denne gir edge-runtimen bare "Internal Server Error" uten logg.
    return new Response(JSON.stringify({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 600) }),
      { headers: { 'Content-Type': 'application/json' } });
  }
});
