/**
 * import-demografi — nyetableringer (08076) og åpnede konkurser (07165) fra
 * SSB, per fylke × næring. Fyller industry_demography med
 * data_quality='ssb' og erstatter mock-radene via upsert på den naturlige
 * nøkkelen (industry_id, region_id, year).
 *
 * FIRE TING VERIFISERT MOT METADATA-ENDEPUNKTET, ikke antatt:
 *
 * 1. ORGANISASJONSFORM ER EN EGEN DIMENSJON, og den har en totalkode: '99'
 *    = «I alt». Uten å velge den eksplisitt får man én rad per
 *    organisasjonsform, og en summering over dem dobbelteller — totalen
 *    ligger i samme dimensjon som delene.
 *
 * 2. NÆRINGSDIMENSJONEN ER BARE TOSIFRET. Begge tabellene har 89 koder, alle
 *    på tosifret nivå pluss aggregatene '00' og '01-99'. Demografi finnes
 *    altså ikke per tresifret næring, og radene skrives med nace_level = 2.
 *    En kategori som samler femsifrede koder får derfor etableringstall fra
 *    næringen over — det er UI-ets ansvar å si hvilket nivå tallet gjelder.
 *
 * 3. TABELLENE ER KVARTALSVISE ('2023K1'). Importen summerer til år og hopper
 *    over år der ikke alle fire kvartaler finnes: et trekvart år utgitt som
 *    helt ser ut som en kollaps i etableringstakten.
 *
 * 4. REGIONSDIMENSJONEN HAR 994 KODER — kommuner, fylker og landet i samme
 *    liste. Vi tar bare tosifrede (fylker), og mapper dem til riktig
 *    fylkesårgang via valid_from_year/valid_to_year, samme måte som
 *    import-ssb.
 *
 * 13701 (overlevelse) er IKKE brukt: den har ingen næringsdimensjon, så den
 * kan ikke fylle overlevelse_*_pct per næring. Kolonnene forblir null i
 * ssb-radene.
 *
 * Skiveprotokoll som i import-ssb: ?felt=nyetableringer|konkurser, ?fra,
 * ?antall, ?dry=1.
 */
const BASE = 'https://data.ssb.no/api/pxwebapi/v2';

const KILDER = {
  nyetableringer: { tabell: '08076', kolonne: 'nyetableringer' },
  konkurser: { tabell: '07165', kolonne: 'konkurser' },
} as const;

const MANGEL: Record<string, string> = {
  ':': 'konfidensielt', '.': 'ikke_relevant', '..': 'ikke_publisert',
  '...': 'ikke_publisert', '~': 'kommer_senere',
};

interface Js { id: string[]; size: number[]; value: (number|null)[];
  status?: Record<string,string>;
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
    await new Promise((s) => setTimeout(s, Math.min(2 ** f * 1000, 20_000)));
    return hent(url, f + 1);
  }
  if (!r.ok) throw new Error(`SSB ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

const svar = (o: unknown) => new Response(JSON.stringify(o, null, 2),
  { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const u = new URL(req.url);
    const felt = (u.searchParams.get('felt') ?? 'nyetableringer') as keyof typeof KILDER;
    const dry = u.searchParams.get('dry') === '1';
    const fra = Number(u.searchParams.get('fra') ?? 0);
    const antall = Number(u.searchParams.get('antall') ?? 20);
    const kilde = KILDER[felt];
    if (!kilde) return svar({ feil: `ukjent felt ${felt}` });

    const SB = Deno.env.get('SUPABASE_URL')!;
    const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
    const les = async (sti: string) => {
      const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: H });
      if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0,200)}`);
      return r.json() as Promise<Record<string, unknown>[]>;
    };

    const logg: string[] = [];
    const meta = await hent(`${BASE}/tables/${kilde.tabell}/metadata?lang=no&outputFormat=json-stat2`)
      .then((r) => r.json()) as Js;

    for (const d of ['NACE2007', 'Region', 'Tid', 'ContentsCode', 'OrgFormer']) {
      if (!meta.dimension[d]) return svar({ feil: `mangler dimensjon ${d}`,
        fant: Object.keys(meta.dimension) });
    }
    // '99' = I alt. Ligger i samme dimensjon som delene, så uten dette valget
    // ville summeringen tatt totalen pluss hver enkelt organisasjonsform.
    //
    // Sjekken må spørre om nøkkelen finnes, ikke om verdien er sann: index
    // mapper kode til posisjon, og totalen ligger først — posisjon 0. En
    // `if (!index['99'])` avviste derfor tabellen som manglet totalkoden.
    if (!('99' in meta.dimension['OrgFormer']!.category.index))
      return svar({ feil: 'OrgFormer mangler totalkoden 99',
        fant: Object.keys(meta.dimension['OrgFormer']!.category.index) });

    // Bare rene tosifrede næringskoder: '00' og '01-99' er aggregater, og
    // '01-99' ville dessuten passert en naiv lengdesjekk som femsifret.
    const alleNace = Object.keys(meta.dimension['NACE2007']!.category.index)
      .filter((k) => /^\d{2}$/.test(k) && k !== '00').sort();
    const skive = alleNace.slice(fra, fra + antall);
    logg.push(`${kilde.tabell}: ${alleNace.length} tosifrede naeringer, tar ${skive.length} fra ${fra}`);
    if (skive.length === 0) return svar({ ferdig: true, logg });

    const kvartaler = Object.keys(meta.dimension['Tid']!.category.index)
      .filter((t) => /^20(1[7-9]|2\d)K\d$/.test(t));
    const maal = Object.keys(meta.dimension['ContentsCode']!.category.index)[0]!;

    const regs = await les('regions?select=id,code,level,valid_from_year,valid_to_year&limit=500');
    // Regionsdimensjonen har 994 koder — kommuner, fylker og landet i samme
    // liste. Region=* ga 183 890 celler for fem næringer, og der ligger
    // edge-runtimens tålegrense ikke langt unna. Vi ber om fylkeskodene vi
    // faktisk lagrer, som er en trettitalls av dem.
    const fylker = [...new Set(regs.filter((r) => r['level'] === 'fylke')
      .map((r) => r['code'] as string))]
      .filter((k) => /^\d{2}$/.test(k) && meta.dimension['Region']!.category.index[k] !== undefined);
    if (fylker.length === 0) return svar({ feil: 'ingen av fylkeskodene finnes i Region-dimensjonen' });

    const url2 = `${BASE}/tables/${kilde.tabell}/data?lang=no&outputFormat=json-stat2` +
      `&valueCodes[NACE2007]=${encodeURIComponent(skive.join(','))}` +
      `&valueCodes[Tid]=${encodeURIComponent(kvartaler.join(','))}` +
      `&valueCodes[Region]=${encodeURIComponent(fylker.join(','))}` +
      `&valueCodes[OrgFormer]=99` +
      `&valueCodes[ContentsCode]=${encodeURIComponent(maal)}`;
    const j = await hent(url2).then((r) => r.json()) as Js;
    logg.push(`${j.value.length} celler over ${fylker.length} fylker, maaltall ${maal}`);

    const acc = new Map<string, { nace: string; region: string; aar: number;
      sum: number; kvartaler: number; merk: Record<string,string> }>();
    for (const c of celler(j)) {
      const nace = c.koder['NACE2007']!;
      if (!/^\d{2}$/.test(nace)) continue;
      const region = c.koder['Region']!;
      if (!/^\d{2}$/.test(region)) continue;
      const aar = Number(c.koder['Tid']!.slice(0, 4));
      const key = `${nace}|${region}|${aar}`;
      let a = acc.get(key);
      if (!a) { a = { nace, region, aar, sum: 0, kvartaler: 0, merk: {} }; acc.set(key, a); }
      if (c.verdi !== null) { a.sum += c.verdi; a.kvartaler += 1; }
      else if (c.symbol && MANGEL[c.symbol]) a.merk[kilde.kolonne] = MANGEL[c.symbol]!;
    }

    const iid = new Map<string, string>();
    for (const r of await les('industries?select=id,nace_code&nace_level=eq.2&limit=200'))
      iid.set(r['nace_code'] as string, r['id'] as string);
    const rid = (kode: string, y: number) => {
      for (const r of regs) {
        if (r['code'] !== kode) continue;
        const f = r['valid_from_year'] as number, t = (r['valid_to_year'] as number|null) ?? 9999;
        if (f <= y && y <= t) return r['id'] as string;
      }
      return null;
    };

    let utenNaering = 0, utenRegion = 0, ufullstendig = 0;
    const rows = [...acc.values()].flatMap((a) => {
      const i = iid.get(a.nace); if (!i) { utenNaering++; return []; }
      const g = rid(a.region, a.aar); if (!g) { utenRegion++; return []; }
      // Et trekvart år utgitt som helt ser ut som en kollaps i
      // etableringstakten. Da er det bedre å ikke ha året.
      if (a.kvartaler < 4) { ufullstendig++; return []; }
      return [{
        industry_id: i, region_id: g, year: a.aar,
        nace_level: 2, region_level: 'fylke',
        [kilde.kolonne]: a.sum,
        merknader: a.merk, source: `ssb:${kilde.tabell}`,
        data_quality: 'ssb', coverage: 'alle',
      }];
    });
    logg.push(`${rows.length} rader klare (hoppet: ${utenNaering} naering, ` +
      `${utenRegion} region/aar, ${ufullstendig} ufullstendige aar)`);

    if (dry) return svar({ dry: true, logg, neste_fra: fra + antall, eksempel: rows.slice(0, 3) });

    for (let i = 0; i < rows.length; i += 500) {
      const r = await fetch(
        `${SB}/rest/v1/industry_demography?on_conflict=industry_id,region_id,year`, {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
      if (!r.ok) throw new Error(`upsert: ${r.status} ${(await r.text()).slice(0, 300)}`);
    }
    logg.push(`skrevet ${felt} med data_quality='ssb'`);
    return svar({ ok: true, logg, neste_fra: fra + antall, flere: fra + antall < alleNace.length });
  } catch (e) {
    return svar({ feil: String(e), stack: (e as Error)?.stack?.slice(0, 600) });
  }
});
