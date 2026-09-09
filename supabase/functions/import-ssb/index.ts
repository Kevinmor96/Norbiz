/**
 * import-ssb — henter strukturstatistikk fra SSBs statistikkbank.
 * Dette er koden som er deployet (v3), kjørt 2026-08-04: 51 468 rader
 * data_quality='ssb' over nivå 2/3/5 nasjonalt og nivå 2/3 regionalt.
 *
 * Kilde:    https://data.ssb.no/api/pxwebapi/v2
 * Tabeller: 12910 nasjonalt (NACE til 5-siffer, 19 måltall)
 *           12937 regionalt (NACE til 3-siffer, 4 måltall)
 * Fyller:   industries, industry_stats
 *
 * Alt her er verifisert mot API-et, ikke antatt. Spørringene som beviser det
 * står i docs/superpowers/specs/2026-08-04-ssb-api-verifisert.md.
 *
 * FIRE TING SPEC-EN TOK FEIL OM, og som denne koden retter:
 *   - Base-URL er /api/pxwebapi/v2, ikke /api/v2 (som gir 404).
 *   - maxDataCells er 800 000, ikke 10 000.
 *   - Regionaltabellen er 12937. 12936 har ingen regionsdimensjon i det hele
 *     tatt — den er delt på sysselsettingsgruppe.
 *   - Perioden går til 2024, ikke 2023.
 *
 * ARBEIDET ER AVGRENSET PER KALL. Første utkast forsøkte hele kodeverket i én
 * kjøring: batchberegningen tillot 1 603 næringer × 2 enhetstyper × 8 måltall
 * × 8 år = 205 000 celler i ett kall. Lovlig hos SSB, men det sprengte minne-
 * eller tidsgrensen i edge-runtimen, og alt man fikk var «Internal Server
 * Error» — ingen stack, ingen logg. Derfor tar hvert kall en skive:
 *
 *   ?niva=2|3|4|5   hvilket NACE-nivå
 *   ?fra=<indeks>   hvor i lista skiven starter
 *   ?antall=<n>     hvor mange næringer (40 som standard)
 *   ?regionalt=1    hent 12937 i stedet for 12910
 *   ?dry=1          regn ut, ikke skriv
 *
 * Svaret returnerer `neste_fra` og `flere`, så importen kan drives framover
 * uten å holde alt i minnet. Handleren er pakket i try/catch og returnerer
 * feilen som JSON — uten det var «Internal Server Error» alt man fikk.
 *
 * REGIONALT FINNES DET INGEN DRIFTSMARGIN. 12937 har kun Omsetning, Lønn,
 * Antall bedrifter og Sysselsatte — ikke driftsresultat, bruttoinvestering,
 * bearbeidingsverdi eller årsverk. Denne importen skriver derfor NULL i de
 * kolonnene for regionale rader. Ikke en forenkling: tallet finnes ikke.
 *
 * INDUSTRIES ER INSERT-ONLY. Seed-en eier navn, slug og kuratert for de
 * kuraterte kodene; en import som overskriver dem stryker i praksis
 * kurateringen. Det skjedde: SSB-labels og kodesuffiks-slugs klobret 101
 * kuraterte rader og måtte gjenopprettes fra seed-kilden. Bare koder basen
 * ikke kjenner settes inn. FK-vern: SSB-dimensjonen kan ha barn uten forelder
 * i utvalget (35.1 finnes, 35 gjør ikke), så parent_code settes bare når
 * forelderen faktisk finnes.
 *
 * INGEN VILKÅRLIG SQL. Skrivingen går gjennom PostgREST med
 * `Prefer: resolution=merge-duplicates`, ikke gjennom en funksjon som tar SQL
 * som parameter. En slik funksjon måtte vært `security definer`, og det finnes
 * en test som håndhever at ingen funksjon i public er det.
 *
 * SSBs STANDARDTEGN oversettes til mangel_arsak i MANGEL under. Den letteste
 * feilen i hele importen og den vanskeligste å oppdage: leses tegnene som
 * «mangler data», forsvinner forskjellen mellom et tall som er skjult av
 * konfidensialitetshensyn og et som ikke finnes. Symbolene står i `status`-
 * feltet i json-stat2-svaret, verifisert mot ekte data i begge tabellene.
 */
const BASE = 'https://data.ssb.no/api/pxwebapi/v2';

const MANGEL: Record<string, string> = {
  ':': 'konfidensielt', '.': 'ikke_relevant', '..': 'ikke_publisert',
  '...': 'ikke_publisert', '~': 'kommer_senere',
};

const MAAL_N = ['Oms', 'Enheter', 'Sysselsatte', 'BruttoDriftsres', 'Lonnskost', 'BearbVerdi', 'BruttoInvesteringer', 'Arsverk'];
const MAAL_R = ['Oms', 'Bedrifter', 'Sysselsatte', 'Lonn'];

const FELT: Record<string, string> = {
  Oms: 'omsetning_total', Enheter: 'n_enheter', Bedrifter: 'n_enheter',
  Sysselsatte: 'sysselsatte_total', BruttoDriftsres: 'driftsresultat_total',
  Lonnskost: 'lonnskostnad_total', Lonn: 'lonnskostnad_total',
  BearbVerdi: 'bearbeidingsverdi_total', BruttoInvesteringer: 'bruttoinvestering_total',
  Arsverk: 'arsverk_per_enhet',
};

interface Js { id: string[]; size: number[]; value: (number|null)[]; status?: Record<string,string>;
  dimension: Record<string, { category: { index: Record<string,number>; label: Record<string,string> } }> }

function* celler(j: Js) {
  const dims = j.id;
  const pos = dims.map((d) => { const u: string[] = [];
    for (const [k, p] of Object.entries(j.dimension[d]!.category.index)) u[p] = k; return u; });
  for (let f = 0; f < j.value.length; f++) {
    let rest = f; const koder: Record<string,string> = {};
    for (let d = dims.length - 1; d >= 0; d--) {
      const len = j.size[d]!; koder[dims[d]!] = pos[d]![rest % len]!; rest = Math.floor(rest / len);
    }
    yield { koder, verdi: j.value[f] ?? null, symbol: j.status?.[String(f)] ?? null };
  }
}

async function hent(url: string, f = 0): Promise<Response> {
  const r = await fetch(url, { headers: { 'Accept-Language': 'no' } });
  if (r.status === 429 && f < 4) {
    const e = Number(r.headers.get('Retry-After') ?? 0);
    await new Promise((s) => setTimeout(s, e > 0 ? e * 1000 : Math.min(2 ** f * 1000, 20_000)));
    return hent(url, f + 1);
  }
  if (!r.ok) throw new Error(`SSB ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

const naceNiva = (k: string): number | null => {
  if (k.length === 1) return null;
  const s = k.replace('.', '').length;
  return s >= 2 && s <= 5 ? s : null;
};

const slug = (s: string) => s.toLowerCase().replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const mkr = (v: number|null|undefined) => v == null ? null : Math.round(v * 1e6);
const r2 = (v: number) => Math.round(v * 100) / 100;
const svar = (o: unknown) => new Response(JSON.stringify(o, null, 2), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const niva = Number(u.searchParams.get('niva') ?? 2);
    const fra = Number(u.searchParams.get('fra') ?? 0);
    const antall = Number(u.searchParams.get('antall') ?? 40);
    const regionalt = u.searchParams.get('regionalt') === '1';
    const tabell = regionalt ? '12937' : '12910';

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
    const meta = await hent(`${BASE}/tables/${tabell}/metadata?lang=no`).then((r) => r.json()) as Js;
    const aar = Object.keys(meta.dimension['Tid']!.category.index).map(Number).sort((a,b)=>a-b);

    const alle = Object.entries(meta.dimension['NACE2007']!.category.label)
      .map(([kode, navn]) => ({ kode, navn, niva: naceNiva(kode) }))
      .filter((n): n is { kode: string; navn: string; niva: number } => n.niva === niva);
    const skive = alle.slice(fra, fra + antall);
    logg.push(`niva ${niva}: ${alle.length} totalt, tar ${skive.length} fra indeks ${fra}`);
    if (skive.length === 0) return svar({ ferdig: true, logg });

    if (!dry && !regionalt) {
      const forelder = (k: string, n: number) => n >= 4 ? k.slice(0,4) : n === 3 ? k.slice(0,2) : null;
      const kjent = new Set<string>();
      for (const r of await les(`industries?select=nace_code&nace_code=in.(${skive.map((n)=>n.kode).join(',')})`))
        kjent.add(r['nace_code'] as string);
      const nye = skive.filter((n) => !kjent.has(n.kode));
      if (nye.length) {
        const onsket = [...new Set(nye.map((n) => forelder(n.kode, n.niva)).filter((p): p is string => p !== null))];
        const finnes = new Set<string>();
        if (onsket.length)
          for (const r of await les(`industries?select=nace_code&nace_code=in.(${onsket.join(',')})`))
            finnes.add(r['nace_code'] as string);
        await upsert('industries', 'nace_code', nye.map((n) => {
          const p = forelder(n.kode, n.niva);
          return {
            nace_code: n.kode, nace_level: n.niva, parent_code: p && finnes.has(p) ? p : null,
            name: n.navn, common_name: n.navn, slug: slug(n.navn) + '-' + n.kode.replace('.',''),
            search_terms: [n.navn.toLowerCase()],
          };
        }));
        logg.push(`industries: ${nye.length} nye, ${kjent.size} eksisterende urort`);
      } else logg.push(`industries: alle ${skive.length} finnes fra for`);
    }

    const q = regionalt
      ? { NACE2007: skive.map((n)=>n.kode).join(','), Tid: aar.join(','), Region: '*', ContentsCode: MAAL_R.join(',') }
      : { NACE2007: skive.map((n)=>n.kode).join(','), Tid: aar.join(','), Enhet: '*', ContentsCode: MAAL_N.join(',') };
    const j = await hent(`${BASE}/tables/${tabell}/data?lang=no&outputFormat=json-stat2&` +
      Object.entries(q).map(([k,v]) => `valueCodes[${k}]=${encodeURIComponent(v)}`).join('&')).then((r)=>r.json()) as Js;
    logg.push(`${j.value.length} celler fra ${tabell}`);

    const rader = new Map<string, { nace: string; niva: number; region: string; aar: number;
      unit: 'foretak'|'virksomhet'; lvl: 'land'|'fylke'; tall: Record<string, number|null>; merk: Record<string,string> }>();
    for (const c of celler(j)) {
      const nace = c.koder['NACE2007']!;
      const nl = naceNiva(nace); if (nl === null) continue;
      const region = regionalt ? c.koder['Region']! : '0';
      if (regionalt && !/^\d{2}$/.test(region)) continue;
      const unit: 'foretak'|'virksomhet' = regionalt ? 'virksomhet' : (c.koder['Enhet'] === '1' ? 'foretak' : 'virksomhet');
      const y = Number(c.koder['Tid']);
      const key = `${nace}|${region}|${y}|${unit}`;
      let rad = rader.get(key);
      if (!rad) { rad = { nace, niva: nl, region, aar: y, unit, lvl: regionalt ? 'fylke' : 'land', tall: {}, merk: {} }; rader.set(key, rad); }
      const cc = c.koder['ContentsCode']!;
      rad.tall[cc] = c.verdi;
      if (c.symbol && MANGEL[c.symbol]) rad.merk[FELT[cc] ?? cc] = MANGEL[c.symbol]!;
    }

    const iid = new Map<string,string>();
    for (const r of await les(`industries?select=id,nace_code&nace_level=eq.${niva}&limit=2000`)) iid.set(r['nace_code'] as string, r['id'] as string);
    const regs = await les('regions?select=id,code,valid_from_year,valid_to_year&limit=500');
    const rid = (kode: string, y: number) => {
      for (const r of regs) {
        if (r['code'] !== kode) continue;
        const f = r['valid_from_year'] as number, t = (r['valid_to_year'] as number|null) ?? 9999;
        if (f <= y && y <= t) return r['id'] as string;
      }
      return null;
    };

    let utenRegion = 0, utenNaering = 0;
    const rows = [...rader.values()].flatMap((r) => {
      const i = iid.get(r.nace); if (!i) { utenNaering++; return []; }
      const g = rid(r.region, r.aar); if (!g) { utenRegion++; return []; }
      const t = r.tall;
      const oms = mkr(t['Oms']);
      const enh = t['Enheter'] ?? t['Bedrifter'] ?? null;
      const dr = mkr(t['BruttoDriftsres']);
      const lo = mkr(t['Lonnskost'] ?? t['Lonn']);
      const sy = t['Sysselsatte'] ?? null;
      const be = mkr(t['BearbVerdi']);
      return [{
        industry_id: i, region_id: g, year: r.aar, unit_type: r.unit,
        nace_level: r.niva, region_level: r.lvl, n_enheter: enh,
        omsetning_total: oms,
        omsetning_per_enhet: oms != null && enh ? Math.round(oms/enh) : null,
        driftsresultat_total: dr,
        driftsmargin_pct: oms && oms > 0 && dr != null ? r2((dr/oms)*100) : null,
        lonnskostnad_total: lo,
        lonnsandel_pct: oms && oms > 0 && lo != null ? r2((lo/oms)*100) : null,
        sysselsatte_total: sy,
        sysselsatte_per_enhet: sy != null && enh ? r2(sy/enh) : null,
        arsverk_per_enhet: t['Arsverk'] != null && enh ? r2(t['Arsverk']!/enh) : null,
        bearbeidingsverdi_total: be,
        verdiskaping_per_sysselsatt: be != null && sy ? Math.round(be/sy) : null,
        bruttoinvestering_total: mkr(t['BruttoInvesteringer']),
        merknader: r.merk,
        source: regionalt ? 'ssb:12937' : 'ssb:12910',
        data_quality: 'ssb', coverage: 'alle',
      }];
    });
    logg.push(`${rows.length} rader klare (hoppet: ${utenNaering} naering, ${utenRegion} region/aar)`);

    if (dry) return svar({ dry: true, logg, neste_fra: fra + antall, eksempel: rows.slice(0,2) });

    for (let i = 0; i < rows.length; i += 500) await upsert('industry_stats','industry_id,region_id,year,unit_type', rows.slice(i, i+500));
    logg.push(`skrevet med data_quality='ssb'`);
    return svar({ ok: true, logg, neste_fra: fra + antall, flere: fra + antall < alle.length });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 600) });
  }
});
