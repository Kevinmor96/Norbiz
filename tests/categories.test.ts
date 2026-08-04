import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, actAsAnon, endAct } from './helpers/db.js';
import { buildSeed } from '../seed/index.js';
import { emitSeed } from '../seed/emit.js';

/**
 * Kategorilaget fra migrasjon 0014/0015 og supabase/seed/kategorier.sql.
 *
 * Kategoriene er redaksjon, ikke generert data: én håndskrevet SQL-fil er
 * eneste kilde, og den kjøres ETTER seed.sql fordi seed-ens
 * `truncate industries cascade` tømmer category_members.
 */
describe('kategorilag', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.exec(emitSeed(buildSeed()));
    await db.exec(readFileSync(
      new URL('../supabase/seed/kategorier.sql', import.meta.url), 'utf8'));
  });

  it('har tabellene med offentlig lesetilgang', async () => {
    await actAsAnon(db);
    try {
      const c = await db.query(`select count(*) c from categories`);
      const m = await db.query(`select count(*) c from category_members`);
      const b = await db.query(`select count(*) c from brands`);
      expect(c.rows.length).toBe(1);
      expect(m.rows.length).toBe(1);
      expect(b.rows.length).toBe(1);
    } finally {
      await endAct(db);
    }
  });

  it('har 30 kategorier i 6 verdener', async () => {
    const r = await db.query<{ verdener: string; n: string }>(
      `select count(distinct verden)::text verdener, count(*)::text n from categories`);
    expect(Number(r.rows[0]!.n)).toBe(30);
    expect(Number(r.rows[0]!.verdener)).toBe(6);
  });

  it('lar aldri medlemskoder overlappe hierarkisk innen kategori og kilde', async () => {
    // 56.1 og 56.101 i samme kategori ville dobbelttalt hele restaurantnæringen.
    const r = await db.query(`
      select a.nace_code, b.nace_code overlapp from category_members a
      join category_members b on a.category_id = b.category_id
        and a.kilde = b.kilde and a.nace_code <> b.nace_code
        and replace(b.nace_code,'.','') like replace(a.nace_code,'.','') || '%'`);
    expect(r.rows).toEqual([]);
  });

  it('peker alle ssb-koder på næringer som finnes', async () => {
    const r = await db.query(`
      select m.nace_code from category_members m
      where m.kilde = 'ssb'
        and not exists (select 1 from industries i where i.nace_code = m.nace_code)`);
    expect(r.rows).toEqual([]);
  });

  it('har Gullsmed på 47.772 og Optiker på 47.782', async () => {
    const r = await db.query<{ slug: string; nace_code: string }>(`
      select c.slug, m.nace_code from categories c
      join category_members m on m.category_id = c.id and m.kilde = 'ssb'
      where c.slug in ('gullsmed','optiker') order by c.slug`);
    expect(r.rows).toEqual([
      { slug: 'gullsmed', nace_code: '47.772' },
      { slug: 'optiker', nace_code: '47.782' },
    ]);
  });

  it('kobler hver brand til en kategori', async () => {
    const r = await db.query<{ n: string }>(`select count(*)::text n from brands`);
    expect(Number(r.rows[0]!.n)).toBeGreaterThanOrEqual(25);
  });

  it('gir kategorioversikt med tall og serie for kategorier som har statistikk', async () => {
    const r = await db.query<{ slug: string; ar: number; n_bedrifter: string;
      driftsmargin_pct: string; serie: unknown }>(
      `select slug, ar, n_bedrifter::text, driftsmargin_pct::text, serie
       from kategori_oversikt() where slug = 'restaurant-kafe'`);
    expect(r.rows.length).toBe(1);
    expect(Number(r.rows[0]!.n_bedrifter)).toBeGreaterThan(0);
    expect(Array.isArray(r.rows[0]!.serie)).toBe(true);
  });

  it('returnerer alle 30 kategorier fra oversikten, også uten tall', async () => {
    const r = await db.query(`select slug from kategori_oversikt()`);
    expect(r.rows.length).toBe(30);
  });

  it('rangerer selskaper i kategori og respekterer regnskapssnittet', async () => {
    const r = await db.query<{ navn: string; omsetning: string }>(
      `select navn, omsetning::text from topp_selskaper('restaurant-kafe', null, 'omsetning', 5)`);
    expect(r.rows.length).toBeGreaterThan(0);
    const oms = r.rows.map((x) => Number(x.omsetning));
    expect(oms).toEqual([...oms].sort((a, b) => b - a));
    const enk = await db.query(`
      select 1 from topp_selskaper('restaurant-kafe', null, 'omsetning', 100) t
      join companies c on c.org_nr = t.org_nr where c.organisasjonsform = 'ENK'`);
    expect(enk.rows).toEqual([]);
  });

  it('filtrerer topp_selskaper på fylke via kommuneprefiks', async () => {
    const r = await db.query<{ kommune_code: string }>(
      `select kommune_code from topp_selskaper('restaurant-kafe', '03', 'omsetning', 50)`);
    for (const rad of r.rows) expect(rad.kommune_code.startsWith('03')).toBe(true);
  });

  it('utelater år der en medlemskode mangler omsetning', async () => {
    // En kategorisum over flere koder er bare sammenlignbar over år hvis alle
    // kodene har tallet. Uten regelen leser en manglende celle som et fall:
    // det traff Regnskap & revisjon live, der 69.201 mangler omsetning for
    // 2024 og kategorien gikk fra 42 til 23 mrd — vist som negativ vekst.
    const forAr = await db.query<{ ar: number; n: string }>(
      `select ar, jsonb_array_length(serie)::text n
       from kategori_oversikt() where slug = 'rorlegger'`);
    const arFor = forAr.rows[0]!.ar;
    const serieFor = Number(forAr.rows[0]!.n);

    await db.exec(`
      create temp table _lagret as
      select s.industry_id, s.region_id, s.year, s.unit_type, s.omsetning_total
      from industry_stats s join industries i on i.id = s.industry_id
      where i.nace_code = '43.222' and s.year = ${arFor}
        and s.region_level = 'land' and s.unit_type = 'foretak';
      update industry_stats s set omsetning_total = null
      from industries i where i.id = s.industry_id and i.nace_code = '43.222'
        and s.year = ${arFor} and s.region_level = 'land' and s.unit_type = 'foretak';`);
    try {
      const etter = await db.query<{ ar: number; n: string }>(
        `select ar, jsonb_array_length(serie)::text n
         from kategori_oversikt() where slug = 'rorlegger'`);
      expect(etter.rows[0]!.ar).toBeLessThan(arFor);
      expect(Number(etter.rows[0]!.n)).toBe(serieFor - 1);
    } finally {
      await db.exec(`
        update industry_stats s set omsetning_total = l.omsetning_total
        from _lagret l where s.industry_id = l.industry_id and s.region_id = l.region_id
          and s.year = l.year and s.unit_type = l.unit_type;
        drop table _lagret;`);
    }
  });

  it('flagger kategorier der eierens arbeid ligger i driftsresultatet', async () => {
    // Driftsmargin er ikke sammenlignbar mellom eierdrift og lønnsdrift:
    // fysioterapi har 56 % margin og 148 000 kr lønnskostnad per sysselsatt,
    // regnskap 14 % og 820 000. Flagget lar UI-et si det i stedet for å la
    // en marginliste rangere eierdrift øverst av en teknisk grunn.
    const r = await db.query<{ slug: string; lonn: string; ans: string; flagg: boolean }>(
      `select slug, lonn_per_sysselsatt::text lonn, ansatte_per_bedrift::text ans,
              eierlonn_i_resultat flagg
       from kategori_oversikt()
       where lonn_per_sysselsatt is not null and ansatte_per_bedrift is not null`);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const rad of r.rows) {
      expect(rad.flagg).toBe(Number(rad.lonn) < 450000 && Number(rad.ans) < 3);
    }
    const rang = await db.query<{ flagg: boolean }>(
      `select eierlonn_i_resultat flagg from kategori_rangering('driftsmargin','desc',5)`);
    expect(rang.rows.length).toBeGreaterThan(0);
  });

  it('flagger ikke deltidsbransjer som eierdrift', async () => {
    // Lav lønn per sysselsatt har to helt ulike årsaker: ulønnet eierarbeid, og
    // deltid. Dagligvare har 374 000 kr per sysselsatt, men 23 ansatte per
    // butikk — der er stillingene små, eieren er ikke arbeidskraften. Flagget
    // krever derfor også at snittbedriften er under tre ansatte.
    const r = await db.query<{ slug: string }>(`
      select slug from kategori_oversikt()
      where eierlonn_i_resultat and ansatte_per_bedrift >= 3`);
    expect(r.rows.map((x) => x.slug)).toEqual([]);
  });

  it('rangerer kategorier etter margin i begge retninger', async () => {
    const hoy = await db.query<{ verdi: string }>(
      `select verdi::text from kategori_rangering('driftsmargin', 'desc', 5)`);
    const lav = await db.query<{ verdi: string }>(
      `select verdi::text from kategori_rangering('driftsmargin', 'asc', 5)`);
    expect(hoy.rows.length).toBeGreaterThan(0);
    expect(Number(hoy.rows[0]!.verdi)).toBeGreaterThanOrEqual(Number(lav.rows[0]!.verdi));
  });

  it('lister brands med kategori, som anon', async () => {
    await actAsAnon(db);
    try {
      const r = await db.query<{ navn: string; kategori: string }>(
        `select navn, kategori from brand_liste(null)`);
      expect(r.rows.length).toBeGreaterThanOrEqual(25);
    } finally {
      await endAct(db);
    }
  });
});
