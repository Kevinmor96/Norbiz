import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { freshDb } from './helpers/db.js';

const DIR = join(process.cwd(), 'supabase', 'seed', 'indb');

/**
 * Seed-en som databasen genererer selv, i supabase/seed/indb/.
 *
 * Den lastes gjennom Supabase-connectoren i stedet for psql, så den kan ikke
 * verifiseres av den som kjører den — den er allerede i basen når man ser
 * resultatet. Derfor må formkravene stå her, og de er de samme kravene som
 * gjelder for seed.sql. Radantall er med vilje ikke låst: formen skal holde,
 * ikke tallene.
 */
describe('indb-seed', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(join(DIR, f), 'utf8'));
    }
  }, 60_000);

  const one = async (sql: string): Promise<number> => {
    const r = await db.query<{ c: string }>(sql);
    return Number(r.rows[0]!.c);
  };

  it('fyller hver tabell frontend leser fra', async () => {
    for (const t of ['industries', 'regions', 'region_population', 'industry_stats',
      'industry_demography', 'industry_wages', 'industry_estimates', 'ai_insights',
      'companies', 'industry_scores']) {
      expect(await one(`select count(*) c from ${t}`), t).toBeGreaterThan(0);
    }
  });

  it('legger ingen regional rad over 3-siffer', async () => {
    // Spec 2.1. SSB publiserer ikke femsifrede næringstall per fylke, så en slik
    // rad ville vært en påstand kilden ikke dekker.
    expect(await one(`select count(*) c from industry_stats
      where region_level <> 'land' and nace_level > 3`)).toBe(0);
    expect(await one(`select count(*) c from industry_wages
      where region_level is not null and region_level <> 'land' and nace_level > 3`)).toBe(0);
  });

  it('lar driftsmargin stå NULL i regionale rader', async () => {
    expect(await one(`select count(*) c from industry_stats
      where region_level <> 'land' and driftsmargin_pct is not null`)).toBe(0);
  });

  it('har bare virksomhet regionalt', async () => {
    expect(await one(`select count(*) c from industry_stats
      where region_level <> 'land' and unit_type <> 'virksomhet'`)).toBe(0);
  });

  it('inneholder undertrykte celler', async () => {
    // Uten dem får frontend aldri prøvd forskjellen mellom «ikke publisert» og
    // «skjult av konfidensialitetshensyn». Undertrykkingen oppstår der en liten
    // næring møter et lite fylke, så den forutsetter at begge er skjevfordelt.
    const n = await one(`select count(*) c from industry_stats
      where merknader ? 'bearbeidingsverdi_total'`);
    expect(n).toBeGreaterThan(0);
    expect(await one(`select count(*) c from industry_stats
      where merknader ? 'bearbeidingsverdi_total'
        and bearbeidingsverdi_total is not null`)).toBe(0);
  });

  it('holder ENK utenfor regnskapssnittet', async () => {
    expect(await one(`select count(*) c from companies
      where organisasjonsform = 'ENK' and inngar_i_regnskapssnitt`)).toBe(0);
  });

  it('gir selskaper ett årstall, ikke en tidsserie', async () => {
    // Brregs åpne API gir bare siste innsendte regnskapsår. Finnes det flere år
    // her, ville frontend kunne regne ut en vekst selskapet ikke har grunnlag for.
    expect(await one(`select count(distinct regnskapsar) c from companies
      where regnskapsar is not null`)).toBe(1);
  });

  it('bruker riktig fylkesårgang for året', async () => {
    const fylker = async (y: number): Promise<number> => one(
      `select count(distinct st.region_id) c from industry_stats st
       join regions r on r.id = st.region_id
       where st.year = ${y} and r.level = 'fylke'`);
    expect(await fylker(2019)).toBe(17);
    expect(await fylker(2023)).toBe(11);
  });

  it('lar lønnsserien gå lenger enn strukturstatistikken', async () => {
    const w = await db.query<{ lo: number; hi: number }>(
      `select min(year) lo, max(year) hi from industry_wages`);
    const s = await db.query<{ lo: number; hi: number }>(
      `select min(year) lo, max(year) hi from industry_stats`);
    expect(w.rows[0]!.lo).toBeLessThan(s.rows[0]!.lo);
    expect(w.rows[0]!.hi).toBeGreaterThan(s.rows[0]!.hi);
    // Og fordi den går til 2025 er den den eneste flaten som treffer
    // fylkesårgangen fra 2024, der kartet skal laste 15 fylker.
    expect(await one(`select count(distinct wg.region_id) c from industry_wages wg
      join regions r on r.id = wg.region_id
      where wg.year = 2025 and r.level = 'fylke'`)).toBe(15);
  });

  it('oppgir lønn som et målt spenn, ikke et anslag', async () => {
    expect(await one(`select count(*) c from industry_wages
      where data_quality = 'ai_anslag'`)).toBe(0);
    expect(await one(`select count(*) c from industry_wages
      where manedslonn_desil1 is null or manedslonn_desil9 is null`)).toBe(0);
  });

  it('påstår ikke at noe kommer fra SSB eller Brreg', async () => {
    for (const t of ['industry_stats', 'industry_demography', 'industry_wages',
      'companies', 'industry_estimates', 'ai_insights']) {
      expect(await one(`select count(*) c from ${t}
        where data_quality in ('ssb', 'brreg')`), t).toBe(0);
    }
  });

  it('gir anslag som spenn med konfidens', async () => {
    expect(await one(`select count(*) c from industry_estimates
      where intervall_hoy <= intervall_lav or konfidens is null`)).toBe(0);
  });

  it('holder anslagene utenfor score_total', async () => {
    // industry_estimates er en egen tabell nettopp for dette. Scoren skal kunne
    // regnes om fra målte tall alene.
    const r = await db.query<{ n: number }>(`
      select count(*) n from industry_scores s
      where not (s.forklaring ?| array['lonnsomhet','vekst','risiko',
                                       'konkurranse','kapitalbehov','ettersporsel'])`);
    expect(Number(r.rows[0]!.n)).toBe(0);
  });

  it('rydder bort byggetabellene og støyfunksjonen', async () => {
    expect(await one(`select count(*) c from pg_class
      where relnamespace = 'public'::regnamespace and relname in ('_src','_reg','_band')`)).toBe(0);
    expect(await one(`select count(*) c from pg_proc where proname = '_noise'`)).toBe(0);
  });

  it('etterlater ingen tabell uten RLS', async () => {
    const r = await db.query<{ tablename: string }>(`
      select c.relname as tablename from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and not c.relrowsecurity order by 1`);
    expect(r.rows.map((x) => x.tablename)).toEqual([]);
  });

  it('er deterministisk: to kjøringer gir samme tall', async () => {
    // Støyen må såes på naturlige nøkler. Sås den på id-kolonner, som er
    // gen_random_uuid(), flytter alt seg mellom kjøringer — og fordi demografien
    // mater risikodelscoren, flytter hele industry_scores seg med.
    const sum = async (d: PGlite): Promise<string> => {
      const r = await d.query<{ h: string }>(`
        select md5(string_agg(x, '|' order by x collate "C")) h from (
          select i.nace_code||':'||s.year||':'||s.region_level||':'||s.unit_type
                 ||':'||coalesce(s.score_total::text,'-')
                 ||':'||dm.konkurser||':'||dm.overlevelse_5ar_pct as x
          from industry_scores s
          join industries i on i.id = s.industry_id
          join industry_demography dm on dm.industry_id = s.industry_id
            and dm.region_id = s.region_id and dm.year = s.year) t`);
      return r.rows[0]!.h;
    };
    const first = await sum(db);
    const second = await freshDb();
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql')).sort()) {
      await second.exec(readFileSync(join(DIR, f), 'utf8'));
    }
    expect(await sum(second)).toBe(first);
  }, 60_000);
});
