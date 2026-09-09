/**
 * import-lonn — månedslønn per næring fra SSB-tabell 11419.
 *
 *   ?dry=1        hent og parse, IKKE skriv
 *   ?fra=2020     første år (standard 2015)
 *
 * Verifisert mot API-et 2026-08-05: 11419 har statistikkmålene Gjennomsnitt,
 * Median, Nedre kvartil og Øvre kvartil (IKKE desiler — skjemaet byttet til
 * kvartilkolonner i migrasjon 0033), pluss Antall arbeidsforhold. Yrke og
 * Sektor har elimination og utelates: tallene gjelder alle yrker, alle
 * sektorer.
 *
 * LØNNSGRUPPENE ER IKKE NACE-KODER. Dimensjonen bærer SSBs egne grupper:
 * rene koder («47», «69», «81.2»), sammensatte («56.1_56.3») og spenn
 * («41-43», «10-12»). Hver gruppe EKSPANDERES til enkeltkodene den dekker,
 * og hver kode som finnes i `industries` får sin egen rad med gruppens kode
 * og navn i `merknader`. Slik kan `kategori_lonn()` prefiksmatche mot vanlige
 * NACE-koder, og UI-et kan si hvilken lønnsgruppe tallet gjelder. Koder som
 * ikke finnes i industries (aggregater som «10-33») telles som hoppet over.
 *
 * Grupper med tresifret spenn («64.1_65.1-65.3») ekspanderes ledd for ledd:
 * splitt på `_`, deretter spenn ved samme presisjon. Uparserbare ledd logges
 * og hopper — de skal ikke gjette.
 *
 * Standardtegnene håndteres som i import-ssb: `.` `..` `:` gir NULL, `-` er
 * et ekte null. For lønn er null kroner aldri et reelt tall, så begge veier
 * ender som NULL her — men skillet logges ikke bort.
 *
 * Idempotent: upsert på (industry_id, region_id, year, yrke_kode) via
 * delete + insert per kjøring for data_quality='ssb'-radene. Mock-radene
 * slettes IKKE her — det gjøres eksplisitt etter verifisert import.
 */
const TABELL = 'https://data.ssb.no/api/v0/no/table/11419';

const MAAL: Record<string, string> = {
  '02': 'manedslonn_gjennomsnitt',
  '01': 'manedslonn_median',
  '051': 'manedslonn_kvartil_nedre',
  '061': 'manedslonn_kvartil_ovre',
  '10': 'antall_ansatte',
};

const svar = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

/** «41-43» → [41,42,43] på heltall; «65.1-65.3» → [65.1, 65.2, 65.3]. */
function utvidSpenn(ledd: string): string[] | null {
  const m = ledd.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const [a, b] = [m[1]!, m[2]!];
  const desimal = a.includes('.');
  if (desimal !== b.includes('.')) return null;
  if (!desimal) {
    const [fra, til] = [Number(a), Number(b)];
    if (til < fra || til - fra > 40) return null;
    return Array.from({ length: til - fra + 1 }, (_, i) => String(fra + i).padStart(2, '0'));
  }
  const [ah, ad] = a.split('.'); const [bh, bd] = b.split('.');
  if (ah !== bh) return null;
  const [fra, til] = [Number(ad), Number(bd)];
  if (til < fra || til - fra > 15) return null;
  return Array.from({ length: til - fra + 1 }, (_, i) => `${ah}.${fra + i}`);
}

/** Én lønnsgruppekode → NACE-prefiksene den dekker, eller null der parsing feiler. */
function utvidGruppe(kode: string): string[] | null {
  const ut: string[] = [];
  for (const ledd of kode.split('_')) {
    if (/^\d+(\.\d+)?$/.test(ledd)) { ut.push(ledd); continue; }
    if (ledd.includes('+')) {
      for (const del of ledd.split('+')) {
        const u = /^\d+(\.\d+)?$/.test(del) ? [del] : utvidSpenn(del);
        if (!u) return null;
        ut.push(...u);
      }
      continue;
    }
    const u = utvidSpenn(ledd);
    if (!u) return null;
    ut.push(...u);
  }
  return ut;
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const fraAr = Number(u.searchParams.get('fra') ?? 2015);

    const SB = Deno.env.get('SUPABASE_URL');
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SB || !KEY) return svar({ feil: 'mangler SUPABASE_URL eller SERVICE_ROLE_KEY' }, 500);
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

    // Metadata: gruppekoder med navn, og årene.
    const metaR = await fetch(TABELL);
    if (!metaR.ok) return svar({ feil: `metadata ${metaR.status}` }, 502);
    const meta = await metaR.json();
    const dimer = meta.variables as { code: string; values: string[]; valueTexts: string[] }[];
    const nace = dimer.find((d) => d.code === 'NACE2007');
    const tid = dimer.find((d) => d.code === 'Tid');
    if (!nace || !tid) return svar({ feil: 'fant ikke NACE2007/Tid i metadata' }, 502);
    const gruppeNavn = new Map(nace.values.map((v, i) => [v, nace.valueTexts[i]!]));
    const ar = tid.values.filter((y) => Number(y) >= fraAr);

    const sp = await fetch(TABELL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: [
          { code: 'MaaleMetode', selection: { filter: 'item', values: Object.keys(MAAL) } },
          { code: 'NACE2007', selection: { filter: 'item', values: nace.values } },
          { code: 'ContentsCode', selection: { filter: 'item', values: ['Manedslonn'] } },
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
    const status = (js.status ?? {}) as Record<string, string>;

    const idx = (navn: string) => dimId.indexOf(navn);
    const kat = (navn: string) => dimObj[navn]!.category.index;
    const stride: number[] = new Array(dimId.length).fill(1);
    for (let i = dimId.length - 2; i >= 0; i--) stride[i] = stride[i + 1]! * size[i + 1]!;
    const les = (pos: Record<string, string>): { v: number | null; s: string | null } => {
      let flat = 0;
      for (const [dim, kode] of Object.entries(pos))
        flat += kat(dim)[kode]! * stride[idx(dim)]!;
      return { v: verdi[flat] ?? null, s: status[String(flat)] ?? null };
    };

    // industries-oppslag for alle mulige koder.
    const indR = await fetch(`${SB}/rest/v1/industries?select=id,nace_code&limit=2000`, { headers: H });
    const industrier = await indR.json() as { id: string; nace_code: string }[];
    const perKode = new Map(industrier.map((i) => [i.nace_code, i.id]));

    const rader: Record<string, unknown>[] = [];
    const hoppet: Record<string, string> = {};
    let standardtegn = 0;

    // Gruppene overlapper på tvers av nivå: «41» finnes ved siden av «41-43»
    // og «10-12» ved siden av «10-33». Samme kode fra to grupper ville brutt
    // den naturlige nøkkelen — og viktigere: den smaleste gruppen er den
    // riktigste lønnen for koden. Én global runde velger vinnergruppe per
    // kode (færrest koder i gruppen; ved likhet korteste gruppekode).
    const vinner = new Map<string, string>();
    const utvidet = new Map<string, string[]>();
    for (const gruppe of nace.values) {
      const koder = utvidGruppe(gruppe);
      if (!koder) { hoppet[gruppe] = 'uparserbar'; continue; }
      utvidet.set(gruppe, koder);
      for (const k of koder) {
        if (!perKode.has(k)) continue;
        const g = vinner.get(k);
        if (!g) { vinner.set(k, gruppe); continue; }
        const gN = utvidet.get(g)!.length;
        if (koder.length < gN || (koder.length === gN && gruppe.length < g.length))
          vinner.set(k, gruppe);
      }
    }

    for (const gruppe of nace.values) {
      const koder = utvidet.get(gruppe);
      if (!koder) continue;
      const treff = koder.filter((k) => perKode.has(k) && vinner.get(k) === gruppe);
      if (treff.length === 0) { hoppet[gruppe] = `ingen av [${koder.join(',')}] vant i industries`; continue; }

      for (const y of ar) {
        const felt: Record<string, number | null> = {};
        let noe = false;
        for (const [maal, kolonne] of Object.entries(MAAL)) {
          const { v, s } = les({ MaaleMetode: maal, NACE2007: gruppe, ContentsCode: 'Manedslonn', Tid: y });
          if (s && s !== '-') { standardtegn++; felt[kolonne] = null; continue; }
          felt[kolonne] = v == null ? null : Math.round(v);
          if (v != null) noe = true;
        }
        if (!noe || felt['manedslonn_median'] == null) continue;

        for (const kode of treff) {
          rader.push({
            industry_id: perKode.get(kode),
            region_id: null, year: Number(y),
            nace_level: kode.includes('.') ? kode.replace('.', '').length : 2,
            region_level: null, yrke_kode: null, yrke_navn: null,
            ...felt,
            merknader: { lonnsgruppe: gruppe, gruppe_navn: gruppeNavn.get(gruppe) },
            source: 'ssb:11419', data_quality: 'ssb', coverage: 'alle',
          });
        }
      }
    }

    const sammendrag = {
      grupper: nace.values.length,
      hoppet_over: Object.keys(hoppet).length,
      hvorfor: Object.fromEntries(Object.entries(hoppet).slice(0, 12)),
      rader: rader.length,
      ar: ar.length, standardtegn,
      eksempel: rader.find((r) => (r['merknader'] as { lonnsgruppe: string }).lonnsgruppe === '56.1_56.3'),
    };
    if (dry) return svar({ ...sammendrag, dry: true });

    // Erstatt forrige ssb-import — mock-rader røres ikke her.
    const slett = await fetch(
      `${SB}/rest/v1/industry_wages?data_quality=eq.ssb&yrke_kode=is.null&region_id=is.null`,
      { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
    if (!slett.ok) return svar({ feil: `slett: ${slett.status} ${(await slett.text()).slice(0, 200)}` }, 500);

    for (let i = 0; i < rader.length; i += 500) {
      const w = await fetch(`${SB}/rest/v1/industry_wages`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify(rader.slice(i, i + 500)),
      });
      if (!w.ok) return svar({ feil: `skriv (${i}): ${w.status} ${(await w.text()).slice(0, 300)}` }, 500);
    }

    return svar({ ...sammendrag, skrev: 'ok' });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 800) }, 500);
  }
});
