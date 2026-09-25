import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, actAsAnon, endAct } from './helpers/db.js';
import { buildSeed } from '../seed/index.js';
import { emitSeed } from '../seed/emit.js';

/**
 * solo_oversikt() og hva_ma_du_omsette() fra migrasjon 0036 — inngangsporten
 * «hva tjener de som gjør dette?».
 *
 * Det som testes er ikke at aritmetikken går opp (den er triviell), men at de
 * to reglene som bærer ærligheten holder: en merking kan ikke peke en annen
 * vei enn tallet den begrunnes med, og en margin som ikke er positiv gir
 * ingen rad i stedet for et tull-tall.
 */
describe('solo og regnestykke', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.exec(emitSeed(buildSeed()));
    await db.exec(readFileSync(
      new URL('../supabase/seed/kategorier.sql', import.meta.url), 'utf8'));
  });

  it('rangerer kategoriene fra færrest ansatte og oppover', async () => {
    const r = await db.query<{ ans: string | null }>(
      `select ansatte_per_foretak::text ans from solo_oversikt()`);
    expect(r.rows.length).toBeGreaterThan(0);
    const tall = r.rows.map((x) => (x.ans === null ? null : Number(x.ans)));
    const uten_null = tall.filter((x): x is number => x !== null);
    expect(uten_null).toEqual([...uten_null].sort((a, b) => a - b));
    // Radene uten tall skal ligge bakerst, ikke spredt gjennom lista.
    expect(tall.indexOf(null)).toBe(tall.findIndex((x) => x === null));
    if (tall.includes(null)) {
      expect(tall.slice(tall.indexOf(null)).every((x) => x === null)).toBe(true);
    }
  });

  it('lar aldri soloklassen motsi det målte ansatte-tallet', async () => {
    // Samme disiplin som eierlonn-flagget i 0035: merkingen regnes på den
    // avrundede verdien UI-et viser, så «typisk én person» aldri kan stå ved
    // siden av 1,5 ansatte.
    const r = await db.query<{ ans: string | null; klasse: string | null }>(
      `select ansatte_per_foretak::text ans, soloklasse klasse from solo_oversikt()`);
    for (const rad of r.rows) {
      if (rad.ans === null) {
        expect(rad.klasse).toBeNull();
        continue;
      }
      const a = Number(rad.ans);
      const ventet = a < 1.5 ? 'alene' : a < 3 ? 'to' : a < 10 ? 'lag' : 'bedrift';
      expect(rad.klasse).toBe(ventet);
    }
  });

  it('regner driftsresultat per foretak av omsetning og målt margin', async () => {
    const r = await db.query<{ oms: string; margin: string; res: string }>(
      `select omsetning_per_foretak::text oms, driftsmargin_pct::text margin,
              driftsresultat_per_foretak::text res
       from solo_oversikt()
       where omsetning_per_foretak is not null and driftsmargin_pct is not null`);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const rad of r.rows) {
      const ventet = Math.round(Number(rad.oms) * Number(rad.margin) / 100);
      expect(Number(rad.res)).toBe(ventet);
    }
  });

  it('inverterer marginen til nødvendig omsetning', async () => {
    const kat = await db.query<{ slug: string; margin: string }>(
      `select slug, driftsmargin_pct::text margin from solo_oversikt()
       where driftsmargin_pct > 0 order by driftsmargin_pct desc limit 1`);
    const { slug, margin } = kat.rows[0]!;

    const r = await db.query<{ krav: string; ar: string; andel: string | null }>(
      `select nodvendig_omsetning_mnd::text krav, nodvendig_omsetning_ar::text ar,
              andel_av_typisk_pct::text andel
       from hva_ma_du_omsette($1, 10000)`, [slug]);
    expect(r.rows).toHaveLength(1);
    const krav = Number(r.rows[0]!.krav);
    expect(krav).toBe(Math.round(10000 * 100 / Number(margin)));
    // Årstallet er månedskravet ganget opp, ikke en egen avrunding.
    expect(Number(r.rows[0]!.ar)).toBe(Math.round(10000 * 100 / Number(margin) * 12));
    expect(Number(r.rows[0]!.andel)).toBeGreaterThan(0);
  });

  it('tier der marginen ikke er positiv', async () => {
    // Blomster & hage hadde -0,61 % margin i 2024. Å invertere en slik margin
    // gir et negativt omsetningskrav — tull med to desimaler. Regelen kan ikke
    // ligge i UI-et: et filter som bare finnes der er en anbefaling.
    const kat = await db.query<{ slug: string }>(
      `select slug from solo_oversikt() where driftsmargin_pct > 0 limit 1`);
    const slug = kat.rows[0]!.slug;

    await db.exec('begin');
    try {
      await db.query(`
        update industry_stats s set driftsresultat_total = -abs(omsetning_total / 10)
        from categories c
        join category_members m on m.category_id = c.id and m.kilde = 'ssb'
        join industries i on i.nace_code = m.nace_code
        where s.industry_id = i.id and c.slug = $1`, [slug]);
      const negativ = await db.query(
        `select 1 from solo_oversikt() where slug = $1 and driftsmargin_pct >= 0`, [slug]);
      expect(negativ.rows).toHaveLength(0);
      const r = await db.query(`select 1 from hva_ma_du_omsette($1, 10000)`, [slug]);
      expect(r.rows).toHaveLength(0);
    } finally {
      await db.exec('rollback');
    }
  });

  it('tier på et målbeløp som ikke er positivt', async () => {
    const kat = await db.query<{ slug: string }>(
      `select slug from solo_oversikt() where driftsmargin_pct > 0 limit 1`);
    const slug = kat.rows[0]!.slug;
    for (const mal of [0, -5000]) {
      const r = await db.query(`select 1 from hva_ma_du_omsette($1, $2)`, [slug, mal]);
      expect(r.rows).toHaveLength(0);
    }
  });

  it('bærer eierlonn-flagget ut av regnestykket', async () => {
    // Der flagget er usant er driftsresultatet regnet etter at lønn er betalt,
    // og målbeløpet er da ikke det eieren tar ut. Flagget må følge raden, ellers
    // kan UI-et ikke si hvilket av de to tallene leseren ser på.
    const r = await db.query<{ slug: string; flagg: boolean | null }>(
      `select h.slug, h.eierlonn_i_resultat flagg
       from solo_oversikt() s
       cross join lateral hva_ma_du_omsette(s.slug, 10000) h
       where s.driftsmargin_pct > 0`);
    expect(r.rows.length).toBeGreaterThan(0);
    const fasit = await db.query<{ slug: string; flagg: boolean | null }>(
      `select slug, eierlonn_i_resultat flagg from kategori_oversikt()`);
    const kart = new Map(fasit.rows.map((x) => [x.slug, x.flagg]));
    for (const rad of r.rows) expect(rad.flagg).toBe(kart.get(rad.slug));
  });

  it('lar anon kjøre begge funksjonene', async () => {
    await actAsAnon(db);
    try {
      const s = await db.query(`select 1 from solo_oversikt() limit 1`);
      expect(s.rows).toHaveLength(1);
      const kat = await db.query<{ slug: string }>(
        `select slug from solo_oversikt() where driftsmargin_pct > 0 limit 1`);
      const h = await db.query(
        `select 1 from hva_ma_du_omsette($1, 10000)`, [kat.rows[0]!.slug]);
      expect(h.rows).toHaveLength(1);
    } finally {
      await endAct(db);
    }
  });
});
