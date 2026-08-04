/**
 * import-ssb — henter strukturstatistikk fra SSBs statistikkbank.
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
 * REGIONALT FINNES DET INGEN DRIFTSMARGIN. 12937 har kun Omsetning, Lønn,
 * Antall bedrifter og Sysselsatte — ikke driftsresultat, bruttoinvestering,
 * bearbeidingsverdi eller årsverk. Denne importen skriver derfor NULL i de
 * kolonnene for regionale rader. Ikke en forenkling: tallet finnes ikke.
 *
 * NÆRINGSLISTA KOMMER FRA SSB. Ni av de 65 femsifrede kodene i seed/industries.ts
 * var oppdiktet og ville trukket null rader. Derfor upsertes `industries` fra
 * SSBs egen kodeliste først, så nace_code og name per definisjon ikke kan avvike
 * fra kilden. `common_name` er vårt eget lag og overskrives ikke der den finnes.
 *
 * INGEN VILKÅRLIG SQL. Skrivingen går gjennom PostgREST med
 * `Prefer: resolution=merge-duplicates`, ikke gjennom en funksjon som tar SQL som
 * parameter. En slik funksjon måtte vært `security definer`, og det finnes en test
 * som håndhever at ingen funksjon i public er det.
 */

const BASE = 'https://data.ssb.no/api/pxwebapi/v2';
const NASJONAL = '12910';
const REGIONAL = '12937';

/**
 * SSBs standardtegn, oversatt til mangel_arsak.
 *
 * Den letteste feilen i hele importen og den vanskeligste å oppdage: leses
 * tegnene som «mangler data», forsvinner forskjellen mellom et tall som er
 * skjult av konfidensialitetshensyn og et som ikke finnes. For en rådgiver er
 * det første informasjon om markedet — næringen har for få aktører i regionen
 * til at tallet kan oppgis — mens det andre er et hull.
 *
 * Symbolene står i `note`-feltet på svaret. Verifisert mot 12937, der både `:`
 * og `.` forekommer i ekte data.
 */
const MANGEL: Record<string, string> = {
  ':': 'konfidensielt',    // Vises ikke av konfidensialitetshensyn.
  '.': 'ikke_relevant',    // Kategorien var ikke i bruk da tallene ble samlet inn.
  '..': 'ikke_publisert',  // Oppgave mangler.
  '...': 'ikke_publisert',
  '~': 'kommer_senere',
};

/** Måltall vi henter. Nasjonalt har alle; regionalt bare de fire første. */
const MAAL_NASJONALT = [
  'Oms', 'Enheter', 'Sysselsatte', 'BruttoDriftsres', 'Lonnskost',
  'BearbVerdi', 'BruttoInvesteringer', 'Arsverk',
];
const MAAL_REGIONALT = ['Oms', 'Bedrifter', 'Sysselsatte', 'Lonn'];

interface JsonStat2 {
  label: string;
  id: string[];
  size: number[];
  value: (number | null)[];
  status?: Record<string, string>;
  note?: string[];
  dimension: Record<string, {
    label: string;
    category: { index: Record<string, number>; label: Record<string, string> };
  }>;
}

interface Rad {
  nace_code: string;
  nace_level: number;
  region_code: string;
  year: number;
  unit_type: 'foretak' | 'virksomhet';
  region_level: 'land' | 'fylke';
  tall: Record<string, number | null>;
  merknader: Record<string, string>;
}

/**
 * Pakker ut den flate value-tabellen til celler med koder.
 *
 * json-stat2 gir `value` som én flat liste i radrekkefølge over dimensjonene i
 * `id`, med `size` som lengder, og `status` som kartlegger flat indeks til
 * standardtegn. Verifisert: 12910 med size [1,2,4,1] gir åtte verdier i
 * rekkefølgen NACE × Enhet × ContentsCode × Tid.
 */
function* celler(j: JsonStat2): Generator<{
  koder: Record<string, string>; verdi: number | null; symbol: string | null;
}> {
  const dims = j.id;
  const posTilKode = dims.map((d) => {
    const ut: string[] = [];
    for (const [kode, pos] of Object.entries(j.dimension[d]!.category.index)) ut[pos] = kode;
    return ut;
  });

  for (let flat = 0; flat < j.value.length; flat++) {
    let rest = flat;
    const koder: Record<string, string> = {};
    for (let d = dims.length - 1; d >= 0; d--) {
      const lengde = j.size[d]!;
      koder[dims[d]!] = posTilKode[d]![rest % lengde]!;
      rest = Math.floor(rest / lengde);
    }
    yield { koder, verdi: j.value[flat] ?? null, symbol: j.status?.[String(flat)] ?? null };
  }
}

async function hent(url: string, forsok = 0): Promise<Response> {
  const r = await fetch(url, { headers: { 'Accept-Language': 'no' } });

  // SSB svarer 429 ved hyppige kall og kan blokkere IP-er rundt publisering
  // klokka 08.00. Respekter Retry-After framfor å gjette.
  if (r.status === 429 && forsok < 5) {
    const etter = Number(r.headers.get('Retry-After') ?? 0);
    await new Promise((s) => setTimeout(s, etter > 0 ? etter * 1000 : Math.min(2 ** forsok * 1000, 30_000)));
    return hent(url, forsok + 1);
  }
  if (!r.ok) throw new Error(`SSB ${r.status} på ${url}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

const metadata = (tabell: string): Promise<JsonStat2> =>
  hent(`${BASE}/tables/${tabell}/metadata?lang=no`).then((r) => r.json());

const data = (tabell: string, valg: Record<string, string>): Promise<JsonStat2> =>
  hent(`${BASE}/tables/${tabell}/data?lang=no&outputFormat=json-stat2&` +
    Object.entries(valg).map(([k, v]) => `valueCodes[${k}]=${encodeURIComponent(v)}`).join('&'),
  ).then((r) => r.json());

/** Kodelengde hos SSB til vårt nace_level. '56'=2, '56.1'=3, '56.101'=5. */
function naceNiva(kode: string): number | null {
  if (kode.length === 1) return null;              // bokstav = hovedområde
  const siffer = kode.replace('.', '').length;
  return siffer >= 2 && siffer <= 5 ? siffer : null;
}

const slugify = (s: string): string =>
  s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** SSB oppgir mill. kr. Vi lagrer hele kroner. */
const millTilKr = (v: number | null | undefined): number | null =>
  v == null ? null : Math.round(v * 1e6);

/** SSBs måltallkode til vår kolonne, for merknader. */
const FELT: Record<string, string> = {
  Oms: 'omsetning_total', Enheter: 'n_enheter', Bedrifter: 'n_enheter',
  Sysselsatte: 'sysselsatte_total', BruttoDriftsres: 'driftsresultat_total',
  Lonnskost: 'lonnskostnad_total', Lonn: 'lonnskostnad_total',
  BearbVerdi: 'bearbeidingsverdi_total', BruttoInvesteringer: 'bruttoinvestering_total',
  Arsverk: 'arsverk_per_enhet',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const torrkjoring = url.searchParams.get('dry') === '1';
  const fraAr = Number(url.searchParams.get('fra') ?? 2017);

  const SB = Deno.env.get('SUPABASE_URL')!;
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const hodet = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const les = async (sti: string): Promise<Record<string, unknown>[]> => {
    const r = await fetch(`${SB}/rest/v1/${sti}`, { headers: hodet });
    if (!r.ok) throw new Error(`les ${sti}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };

  const upsert = async (tabell: string, onConflict: string, rader: unknown[]): Promise<void> => {
    const r = await fetch(`${SB}/rest/v1/${tabell}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...hodet, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rader),
    });
    if (!r.ok) throw new Error(`upsert ${tabell}: ${r.status} ${(await r.text()).slice(0, 400)}`);
  };

  const logg: string[] = [];

  // ---------------------------------------------------------------- 1. Grenser
  const cfg = await hent(`${BASE}/config`).then((r) => r.json());
  const maksCeller = Number(cfg.maxDataCells ?? 800_000);
  logg.push(`API ${cfg.apiVersion}, maxDataCells ${maksCeller}`);

  // -------------------------------------------------- 2. Næringslista fra SSB
  const metaN = await metadata(NASJONAL);
  const aar = Object.keys(metaN.dimension['Tid']!.category.index)
    .map(Number).filter((y) => y >= fraAr).sort((a, b) => a - b);
  logg.push(`år ${aar[0]}–${aar[aar.length - 1]}`);

  const naeringer = Object.entries(metaN.dimension['NACE2007']!.category.label)
    .map(([kode, navn]) => ({ kode, navn, niva: naceNiva(kode) }))
    .filter((n): n is { kode: string; navn: string; niva: number } => n.niva !== null)
    .sort((a, b) => a.niva - b.niva);   // forelder før barn: parent_code er selvreferanse

  if (!torrkjoring) {
    const finnesFra = new Set(naeringer.map((n) => n.kode));
    const forelder = (kode: string, niva: number): string | null => {
      const kandidat = niva === 5 || niva === 4 ? kode.slice(0, 4) : niva === 3 ? kode.slice(0, 2) : null;
      return kandidat && finnesFra.has(kandidat) ? kandidat : null;
    };
    // Nivå for nivå, ellers feiler selvreferansen på parent_code.
    for (const niva of [2, 3, 4, 5]) {
      const bolk = naeringer.filter((n) => n.niva === niva);
      if (bolk.length === 0) continue;
      await upsert('industries', 'nace_code', bolk.map((n) => ({
        nace_code: n.kode, nace_level: n.niva, parent_code: forelder(n.kode, n.niva),
        name: n.navn, common_name: n.navn, slug: slugify(n.navn),
        search_terms: [n.navn.toLowerCase()],
      })));
    }
    logg.push(`industries: ${naeringer.length} koder fra SSB`);
  }

  // ------------------------------------------- 3. Hent nasjonalt og regionalt
  const rader = new Map<string, Rad>();

  const samle = (j: JsonStat2, regionLevel: 'land' | 'fylke') => {
    for (const c of celler(j)) {
      const nace = c.koder['NACE2007']!;
      const niva = naceNiva(nace);
      if (niva === null) continue;

      const region = regionLevel === 'land' ? '0' : c.koder['Region']!;
      // Landsdeler (L1, L01…), uoppgitt (88, 99) og landet (0) hører ikke i
      // fylkesrader. Bare tosifrede fylkeskoder.
      if (regionLevel === 'fylke' && !/^\d{2}$/.test(region)) continue;

      const unitType: 'foretak' | 'virksomhet' =
        regionLevel === 'fylke' ? 'virksomhet'
          : c.koder['Enhet'] === '1' ? 'foretak' : 'virksomhet';

      const aarTall = Number(c.koder['Tid']);
      const nokkel = `${nace}|${region}|${aarTall}|${unitType}`;
      let rad = rader.get(nokkel);
      if (!rad) {
        rad = {
          nace_code: nace, nace_level: niva, region_code: region, year: aarTall,
          unit_type: unitType, region_level: regionLevel, tall: {}, merknader: {},
        };
        rader.set(nokkel, rad);
      }
      rad.tall[c.koder['ContentsCode']!] = c.verdi;

      // Et standardtegn er ikke et hull. '-' er dessuten et EKTE null og kommer
      // som verdien 0, ikke som symbol — det skal lagres som 0.
      if (c.symbol && MANGEL[c.symbol]) {
        rad.merknader[FELT[c.koder['ContentsCode']!] ?? c.koder['ContentsCode']!] =
          MANGEL[c.symbol]!;
      }
    }
  };

  // Bolkstørrelsen regnes ut av cellegrensen framfor å velges.
  const perKall = (dimensjoner: number) =>
    Math.max(1, Math.floor(maksCeller / (dimensjoner * aar.length)));

  const stegN = perKall(2 * MAAL_NASJONALT.length);
  for (let i = 0; i < naeringer.length; i += stegN) {
    samle(await data(NASJONAL, {
      NACE2007: naeringer.slice(i, i + stegN).map((n) => n.kode).join(','),
      Tid: aar.join(','), Enhet: '*', ContentsCode: MAAL_NASJONALT.join(','),
    }), 'land');
  }
  logg.push(`etter nasjonalt: ${rader.size} rader`);

  const regionale = naeringer.filter((n) => n.niva <= 3);
  const stegR = perKall(56 * MAAL_REGIONALT.length);
  for (let i = 0; i < regionale.length; i += stegR) {
    samle(await data(REGIONAL, {
      NACE2007: regionale.slice(i, i + stegR).map((n) => n.kode).join(','),
      Tid: aar.join(','), Region: '*', ContentsCode: MAAL_REGIONALT.join(','),
    }), 'fylke');
  }
  logg.push(`etter regionalt: ${rader.size} rader`);

  // -------------------------------------------------- 4. Slå opp id-ene lokalt
  const naeringId = new Map<string, string>();
  for (const r of await les('industries?select=id,nace_code&limit=5000')) {
    naeringId.set(r['nace_code'] as string, r['id'] as string);
  }
  // Fylkeskoden må treffe årgangen som gjaldt i året — dimensjonen tilbyr alle
  // årganger samtidig, så uten dette havner 2017-tall på 2024-fylker.
  const regionRader = await les('regions?select=id,code,valid_from_year,valid_to_year&limit=500');
  const regionId = (kode: string, y: number): string | null => {
    for (const r of regionRader) {
      if (r['code'] !== kode) continue;
      const fra = r['valid_from_year'] as number;
      const til = (r['valid_to_year'] as number | null) ?? 9999;
      if (fra <= y && y <= til) return r['id'] as string;
    }
    return null;
  };

  // --------------------------------------------------------- 5. Bygg og skriv
  const utenRegion = new Set<string>();
  const rekker = [...rader.values()].flatMap((r) => {
    const iid = naeringId.get(r.nace_code);
    const rid = regionId(r.region_code, r.year);
    if (!iid || !rid) {
      if (!rid) utenRegion.add(`${r.region_code}/${r.year}`);
      return [];
    }

    const t = r.tall;
    const oms = millTilKr(t['Oms']);
    const enheter = t['Enheter'] ?? t['Bedrifter'] ?? null;
    const driftsres = millTilKr(t['BruttoDriftsres']);
    const lonn = millTilKr(t['Lonnskost'] ?? t['Lonn']);
    const syss = t['Sysselsatte'] ?? null;
    const bearb = millTilKr(t['BearbVerdi']);

    // Driftsmarginen regnes bare der begge leddene finnes. Regionalt gjør de
    // aldri det, siden 12937 ikke har driftsresultat — og det er meningen.
    const rund2 = (v: number) => Math.round(v * 100) / 100;

    return [{
      industry_id: iid, region_id: rid, year: r.year, unit_type: r.unit_type,
      nace_level: r.nace_level, region_level: r.region_level,
      n_enheter: enheter,
      omsetning_total: oms,
      omsetning_per_enhet: oms != null && enheter ? Math.round(oms / enheter) : null,
      driftsresultat_total: driftsres,
      driftsmargin_pct: oms && oms > 0 && driftsres != null ? rund2((driftsres / oms) * 100) : null,
      lonnskostnad_total: lonn,
      lonnsandel_pct: oms && oms > 0 && lonn != null ? rund2((lonn / oms) * 100) : null,
      sysselsatte_total: syss,
      sysselsatte_per_enhet: syss != null && enheter ? rund2(syss / enheter) : null,
      arsverk_per_enhet: t['Arsverk'] != null && enheter ? rund2(t['Arsverk']! / enheter) : null,
      bearbeidingsverdi_total: bearb,
      verdiskaping_per_sysselsatt: bearb != null && syss ? Math.round(bearb / syss) : null,
      bruttoinvestering_total: millTilKr(t['BruttoInvesteringer']),
      merknader: r.merknader,
      source: r.region_level === 'land' ? 'ssb:12910' : 'ssb:12937',
      data_quality: 'ssb',
      coverage: 'alle',
    }];
  });

  if (utenRegion.size > 0) {
    // Ikke en feil: fylkeskoder utenfor sin årgang er forventet, siden
    // dimensjonen tilbyr alle samtidig. Loggføres for å kunne se at filteret
    // faktisk gjør noe.
    logg.push(`hoppet over ${utenRegion.size} region/år-kombinasjoner utenfor årgang`);
  }

  if (torrkjoring) {
    return svar({ torrkjoring: true, logg, klare_rader: rekker.length, eksempel: rekker.slice(0, 2) });
  }

  for (let i = 0; i < rekker.length; i += 500) {
    await upsert('industry_stats', 'industry_id,region_id,year,unit_type', rekker.slice(i, i + 500));
  }
  logg.push(`skrevet ${rekker.length} rader med data_quality = 'ssb'`);

  return svar({ ok: true, logg });
}

const svar = (o: unknown): Response =>
  new Response(JSON.stringify(o, null, 2), { headers: { 'Content-Type': 'application/json' } });
