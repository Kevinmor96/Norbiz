import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { freshDb, actAsAnon, endAct } from './helpers/db.js';

const INDB = join(process.cwd(), 'supabase', 'seed', 'indb');

/**
 * Aggregatfunksjonene i migrasjon 0010.
 *
 * De finnes fordi PostgREST avviser aggregater i spørrestrengen, så frontend
 * ellers måtte laste ned hele utvalget og regne selv. Det viktigste de gjør er
 * ikke ytelse: det er at terskelen for kommuneaggregatene ligger i BASEN. Et
 * filter som bare finnes i UI-et er ikke en terskel, det er en anbefaling.
 */
describe('aggregatfunksjoner', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    for (const f of readdirSync(INDB).filter((x) => x.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(join(INDB, f), 'utf8'));
    }
  }, 60_000);

  describe('industry_medians', () => {
    it('utelater regionale rader, som ikke har driftsmargin', async () => {
      // Kan ikke testes ved å sammenligne med et tall — det må testes ved at
      // funksjonen gir samme svar som den eksplisitte spørringen over kun
      // nasjonale foretaksrader. Var regionale rader med, ville de to sprikt.
      const r = await db.query<{ fra_funksjon: string; fra_spoerring: string }>(`
        select
          (select median_driftsmargin::text from industry_medians(2023, 5)) fra_funksjon,
          (select percentile_cont(0.5) within group (order by driftsmargin_pct)::text
             from industry_stats
             where year = 2023 and nace_level = 5
               and region_level = 'land' and unit_type = 'foretak') fra_spoerring`);
      expect(r.rows[0]!.fra_funksjon).toBe(r.rows[0]!.fra_spoerring);
    });

    it('oppgir hvor mange næringer hver median er regnet over', async () => {
      const r = await db.query<{ n_naeringer: string; n_med_driftsmargin: string }>(
        `select n_naeringer::text, n_med_driftsmargin::text from industry_medians(2023, 5)`);
      const row = r.rows[0]!;
      expect(Number(row.n_med_driftsmargin)).toBeGreaterThan(0);
      expect(Number(row.n_med_driftsmargin)).toBeLessThanOrEqual(Number(row.n_naeringer));
    });

    it('gir én rad per år og nivå når argumentene utelates', async () => {
      const r = await db.query<{ n: string }>(
        `select count(*)::text n from industry_medians()`);
      // Sju år x tre NACE-nivåer.
      expect(Number(r.rows[0]!.n)).toBe(21);
    });
  });

  describe('industry_margin_histogram', () => {
    it('dekker alle næringene med publisert margin, uten dobbelttelling', async () => {
      const r = await db.query<{ i_botter: string; i_utvalget: string }>(`
        select
          (select sum(n_naeringer)::text from industry_margin_histogram(2023, 5)) i_botter,
          (select count(*)::text from industry_stats
             where year = 2023 and nace_level = 5 and region_level = 'land'
               and unit_type = 'foretak' and driftsmargin_pct is not null) i_utvalget`);
      expect(r.rows[0]!.i_botter).toBe(r.rows[0]!.i_utvalget);
    });

    it('legger bøttene på oppgitt bredde', async () => {
      const r = await db.query<{ bucket_from: string; bucket_to: string }>(
        `select bucket_from::text, bucket_to::text
         from industry_margin_histogram(2023, 5, 5) order by bucket_from limit 3`);
      for (const b of r.rows) {
        expect(Number(b.bucket_to) - Number(b.bucket_from)).toBe(5);
        expect(Number(b.bucket_from) % 5).toBe(0);
      }
    });
  });

  describe('kommune_aggregat', () => {
    it('skjuler tallene under terskelen, men beholder raden', async () => {
      // Under terskelen skal raden finnes med mangel_arsak satt. At en
      // kombinasjon finnes men er skjult er i seg selv informasjon om markedet —
      // det er noe annet enn at den ikke finnes.
      const r = await db.query<{ undertrykt: string; synlig: string }>(`
        select
          count(*) filter (where mangel_arsak = 'konfidensielt')::text undertrykt,
          count(*) filter (where mangel_arsak is null)::text synlig
        from kommune_aggregat()`);
      expect(Number(r.rows[0]!.undertrykt)).toBeGreaterThan(0);
      expect(Number(r.rows[0]!.synlig)).toBeGreaterThan(0);
    });

    it('lekker ingen tall i en undertrykt rad', async () => {
      // Selve poenget. Er dette tallet over 0, kan et enkeltselskaps resultat
      // regnes baklengs ut av et aggregat vi har merket som skjult.
      const r = await db.query<{ c: string }>(`
        select count(*)::text c from kommune_aggregat()
        where mangel_arsak = 'konfidensielt'
          and (omsetning_sum is not null or ansatte_sum is not null
               or driftsmargin_pct is not null)`);
      expect(Number(r.rows[0]!.c)).toBe(0);
    });

    it('bruker terskelen fra score_config, ikke et innbakt tall', async () => {
      const before = await db.query<{ c: string }>(
        `select count(*) filter (where mangel_arsak is null)::text c from kommune_aggregat()`);
      await db.exec(`update score_config set min_enheter_aggregat = 99`);
      const after = await db.query<{ c: string }>(
        `select count(*) filter (where mangel_arsak is null)::text c from kommune_aggregat()`);
      await db.exec(`update score_config set min_enheter_aggregat = 5`);
      expect(Number(after.rows[0]!.c)).toBeLessThan(Number(before.rows[0]!.c));
    });

    it('holder ENK utenfor, siden de ikke leverer årsregnskap', async () => {
      // Et snitt som teller ENK i nevneren men ikke i telleren er feil, ikke
      // bare upresist.
      const r = await db.query<{ i_aggregat: string; enk_finnes: string }>(`
        select
          (select coalesce(sum(n_selskaper), 0)::text from kommune_aggregat()) i_aggregat,
          (select count(*)::text from companies where inngar_i_regnskapssnitt) enk_finnes`);
      expect(r.rows[0]!.i_aggregat).toBe(r.rows[0]!.enk_finnes);
    });
  });

  it('er lesbare for anon uten utvidede rettigheter', async () => {
    // Funksjonene er bevisst IKKE security definer. Tabellene har allerede
    // grant select til anon, så funksjonen kan kjøre som den som kaller.
    await actAsAnon(db);
    try {
      const a = await db.query(`select * from industry_medians(2023, 5)`);
      const b = await db.query(`select * from industry_margin_histogram(2023, 5)`);
      const c = await db.query(`select * from kommune_aggregat()`);
      expect(a.rows.length).toBe(1);
      expect(b.rows.length).toBeGreaterThan(0);
      expect(c.rows.length).toBeGreaterThan(0);
    } finally {
      await endAct(db);
    }
  });

  it('er ingen av dem security definer', async () => {
    const r = await db.query<{ proname: string }>(`
      select proname from pg_proc
      where pronamespace = 'public'::regnamespace and prosecdef
      order by 1`);
    expect(r.rows.map((x) => x.proname)).toEqual([]);
  });
});

/**
 * Kurateringen fra migrasjon 0011.
 *
 * Importen henter ~1 600 næringer fra SSB. Skjermen skal vise de vi har gitt et
 * navn en bruker kjenner. Skillet må ligge i basen, ikke i frontend — ellers er
 * det ikke et redaksjonelt valg, bare en tilfeldighet i hvilken spørring som ble
 * skrevet sist.
 */
describe('kuratering', () => {
  let db2: PGlite;

  beforeAll(async () => {
    db2 = await freshDb();
    for (const f of readdirSync(INDB).filter((x) => x.endsWith('.sql')).sort()) {
      await db2.exec(readFileSync(join(INDB, f), 'utf8'));
    }
  }, 60_000);

  const en = async (sql: string): Promise<number> => {
    const r = await db2.query<{ c: string }>(sql);
    return Number(r.rows[0]!.c);
  };

  it('merker seed-næringene som kuratert', async () => {
    expect(await en(`select count(*) c from industries where kuratert`)).toBeGreaterThan(90);
    expect(await en(`select count(*) c from industries where not kuratert`)).toBe(0);
  });

  it('har ingen av de ni oppdiktede kodene igjen', async () => {
    // Kodene fantes ikke hos SSB og ville trukket null rader ved import.
    const oppdiktet = ['96.021', '96.022', '96.011', '43.910', '43.991',
      '43.999', '47.752', '93.191', '56.104'];
    const r = await db2.query<{ nace_code: string }>(
      `select nace_code from industries where nace_code = any($1)`, [oppdiktet]);
    expect(r.rows.map((x) => x.nace_code)).toEqual([]);
  });

  it('beholder våre egne navn gjennom omkodingen', async () => {
    // common_name er vårt lag. Ble det overskrevet av omkodingen, mistet vi
    // hele poenget med å ha to navnekolonner.
    const r = await db2.query<{ common_name: string }>(
      `select common_name from industries where nace_code = '96.020'`);
    expect(r.rows[0]?.common_name).toBe('Frisørsalong');
  });

  it('beholder statistikkradene til de omkodede næringene', async () => {
    // Radene ble oppdatert, ikke slettet og laget på nytt, så koblingen gjennom
    // id skal være intakt.
    expect(await en(`select count(*) c from industry_stats st
      join industries i on i.id = st.industry_id
      where i.nace_code in ('96.020','43.919','47.531')`)).toBeGreaterThan(0);
  });

  it('slettet Kaffebar, som ikke har noen egen kode', async () => {
    expect(await en(`select count(*) c from industries where common_name = 'Kaffebar'`)).toBe(0);
    // Og statistikkradene fulgte med, framfor å bli foreldreløse.
    expect(await en(`select count(*) c from industry_stats st
      where not exists (select 1 from industries i where i.id = st.industry_id)`)).toBe(0);
  });
});
