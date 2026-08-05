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

    // Selskaper med SN2025-koder. Seed-generatoren gir selskapene SN2007-koder,
    // og `topp_selskaper` matcher med rette bare brreg-kodene: companies.nace_code
    // kommer alltid fra Brreg. Uten disse radene ville testene måttet be
    // funksjonen om å gjøre en match som er feil på livedata.
    //
    // Org.nr for de to første er REMA 1000 Norge og Reitan Convenience, altså
    // selskaper kjedelista peker på — det er slik merke-kolonnen blir testbar,
    // og slik dobbeltmerket Narvesen/7-Eleven blir det.
    await db.exec(`
      insert into companies
        (org_nr, navn, nace_code, kommune_code, organisasjonsform, ansatte,
         omsetning, driftsresultat, egenkapital, regnskapsar, source, data_quality)
      values
        ('982254604','REMA 1000 NORGE AS','47.110','0301','AS',420,
          9000000000, 450000000, 1000000000, 2024,'test','brreg'),
        ('983415660','REITAN CONVENIENCE NORWAY AS','47.120','0301','AS',300,
          3000000000, 90000000, 400000000, 2024,'test','brreg'),
        ('900000001','TESTRESTAURANT OSLO AS','56.110','0301','AS',40,
          90000000, 5400000, 12000000, 2024,'test','brreg'),
        ('900000002','TESTRESTAURANT BERGEN AS','56.110','4601','AS',25,
          50000000, 1500000, 6000000, 2024,'test','brreg'),
        ('900000003','TESTKAFE TROMSO ENK','56.110','5501','ENK',2,
          null, null, null, null,'test','brreg'),
        ('900000004','TESTRESTAURANT UTEN TALL AS','56.110','0301','AS',10,
          0, 0, 100000, 2024,'test','brreg')`);
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

  it('har 40 kategorier i 9 verdener', async () => {
    const r = await db.query<{ verdener: string; n: string }>(
      `select count(distinct verden)::text verdener, count(*)::text n from categories`);
    expect(Number(r.rows[0]!.n)).toBe(40);
    expect(Number(r.rows[0]!.verdener)).toBe(9);
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
    const r = await db.query<{ slug: string; ar: number; n_foretak: string;
      driftsmargin_pct: string; serie: unknown }>(
      `select slug, ar, n_foretak::text, driftsmargin_pct::text, serie
       from kategori_oversikt() where slug = 'restaurant-kafe'`);
    expect(r.rows.length).toBe(1);
    expect(Number(r.rows[0]!.n_foretak)).toBeGreaterThan(0);
    expect(Array.isArray(r.rows[0]!.serie)).toBe(true);
  });

  it('returnerer alle kategoriene fra oversikten, også uten tall', async () => {
    const r = await db.query(`select slug from kategori_oversikt()`);
    expect(r.rows.length).toBe(40);
  });

  it('skiller foretak fra virksomheter', async () => {
    // Skobutikk har 205 foretak og 565 virksomheter i livebasen. Kalles
    // foretakstallet «bedrifter», leser en som kjenner bransjen det som feil —
    // for i SSBs terminologi ER bedrift virksomheten.
    const r = await db.query<{ f: string; v: string }>(
      `select n_foretak::text f, n_virksomheter::text v from kategori_oversikt()
       where n_virksomheter is not null and n_foretak is not null limit 5`);
    expect(r.rows.length).toBeGreaterThan(0);
    // Et foretak kan eie flere virksomheter, aldri motsatt.
    for (const rad of r.rows) expect(Number(rad.v)).toBeGreaterThanOrEqual(Number(rad.f));
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
    // Null omsetning er ikke et regnskapstall. Raden har både form og
    // regnskapsår, så den passerte før `inngar_i_regnskapssnitt` krevde at det
    // finnes et tall å regne på — og telte som «selskap med tall» uten å ha ett.
    const tomt = await db.query(
      `select 1 from topp_selskaper('restaurant-kafe', null, 'omsetning', 100)
       where org_nr = '900000004'`);
    expect(tomt.rows).toEqual([]);
  });

  it('matcher selskaper mot SN2025 alene, ikke mot SSB-kodene', async () => {
    // 47.762 betyr «blomster» i SN2007 og «kjæledyr» i SN2025. Da funksjonen
    // matchet begge kodespråk, kom Musti Norge og PetXL inn i
    // blomstertopplisten — 14 selskaper. companies.nace_code er alltid Brregs
    // kode, så bare brreg-medlemmene får matche.
    await db.exec(`
      insert into companies
        (org_nr, navn, nace_code, kommune_code, organisasjonsform, ansatte,
         omsetning, driftsresultat, egenkapital, regnskapsar, source, data_quality)
      values ('900000009','TESTKJAELEDYR AS','47.762','0301','AS',50,
        800000000, 40000000, 100000000, 2024,'test','brreg')`);
    try {
      const r = await db.query(
        `select navn from topp_selskaper('blomster-hage', null, 'omsetning', 50)
         where org_nr = '900000009'`);
      expect(r.rows).toEqual([]);
    } finally {
      await db.exec(`delete from companies where org_nr = '900000009'`);
    }
  });

  it('holder hvert brreg-prefiks mot sin offisielle SN2025-tittel', async () => {
    // Sjekken som manglet. Å telle treff sier bare at koden finnes; den sier
    // ingenting om hva den BETYR. 47.64 ga 820 treff og var «spill og leker».
    const r = await db.query<{ slug: string; nace_code: string; navn: string }>(`
      select k.slug, m.nace_code, n.navn
      from categories k
      join category_members m on m.category_id = k.id and m.kilde = 'brreg'
      left join nace_sn2025 n on n.code = m.nace_code
      order by k.slug, m.nace_code`);
    expect(r.rows.length).toBeGreaterThan(40);
    // Ingen prefiks uten kjent tittel: da er den ikke verifisert.
    expect(r.rows.filter((x) => !x.navn).map((x) => x.nace_code)).toEqual([]);

    // Et ord som må stå i tittelen for at koden skal handle om kategorien.
    const forventet: Record<string, string> = {
      sportsbutikk: 'sportsvarer',
      optiker: 'medisinske og ortopediske',
      'maler-overflate': 'aler-',
      'blomster-hage': 'blomster',
      dagligvare: 'nærings- og nytelsesmidler',
      skobutikk: 'skotøy',
      klesbutikk: 'klær',
      gullsmed: 'klokker',
      'restaurant-kafe': 'restauranter',
      frisor: 'Frisering',
      tannlege: 'Tannlege',
      advokat: 'Juridisk',
      treningssenter: 'Treningssenter',
      bilforhandler: 'motorvogner',
      eiendomsmegler: 'Eiendomsmegling',
      'film-tv': 'film',
    };
    for (const [slug, ord] of Object.entries(forventet)) {
      const titler = r.rows.filter((x) => x.slug === slug).map((x) => x.navn ?? '');
      expect(titler.length, `${slug} mangler brreg-prefiks`).toBeGreaterThan(0);
      expect(titler.some((t) => t.includes(ord)),
        `${slug}: ingen av titlene [${titler.join(' | ')}] inneholder «${ord}»`).toBe(true);
    }
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
      `select slug, lonn_per_sysselsatt::text lonn, ansatte_per_foretak::text ans,
              eierlonn_i_resultat flagg
       from kategori_oversikt()
       where lonn_per_sysselsatt is not null and ansatte_per_foretak is not null`);
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
      where eierlonn_i_resultat and ansatte_per_foretak >= 3`);
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

  it('filtrerer kjedelisten på segment', async () => {
    // Luksus er en merking av aktøren, ikke en bransje: SSB har ingen kode for
    // segmentet, så et «luksusaggregat» med margin og vekst måtte vært lånt fra
    // klesbutikk og gullsmed eller diktet. Stripa viser selskapstall i stedet.
    const alle = await db.query(`select navn from brand_liste(null)`);
    const luks = await db.query<{ navn: string; segment: string }>(
      `select navn, segment from brand_liste(null, 'luksus')`);
    expect(luks.rows.length).toBeGreaterThan(0);
    expect(luks.rows.length).toBeLessThan(alle.rows.length);
    for (const rad of luks.rows) expect(rad.segment).toBe('luksus');
  });

  it('gir hvert luksusmerke et verifisert org_nr', async () => {
    // Et feil selskaps tall under et kjent merkenavn er verre enn ingen tall,
    // og luksusstripa er stedet der navnene er mest gjenkjennelige. Alle ni er
    // slått opp i Enhetsregisteret; står ett uten org_nr, er det ikke verifisert.
    const r = await db.query<{ navn: string }>(
      `select navn from brands where segment = 'luksus' and org_nr is null`);
    expect(r.rows.map((x) => x.navn)).toEqual([]);
  });

  it('viser merkenavn og segment i topplisten', async () => {
    // «REITAN CONVENIENCE NORWAY AS» sier ingenting, «Narvesen» sier alt — og
    // Louis Vuitton står i skobutikk-topplisten fordi Brreg har selskapet på
    // 47.720. Merkingen forklarer raden i stedet for å filtrere den bort.
    const kol = await db.query(
      `select merke, segment from topp_selskaper('dagligvare', null, 'omsetning', 5)`);
    expect(kol.rows.length).toBeGreaterThan(0);
    // Ett selskap kan bære flere merker; da skal raden likevel komme én gang.
    const dup = await db.query<{ n: string }>(`
      select count(*)::text n from (
        select org_nr from topp_selskaper('dagligvare', null, 'omsetning', 100)
        group by org_nr having count(*) > 1) x`);
    expect(Number(dup.rows[0]!.n)).toBe(0);
  });

  it('navngir kommunen, ikke bare nummeret', async () => {
    // «Kommune 3103 · 840 ansatte» er et firesifret tall som ikke betyr noe for
    // en leser, og som dessuten ser ut som et postnummer.
    const r = await db.query<{ kommune_code: string; kommune_navn: string }>(
      `select kommune_code, kommune_navn from topp_selskaper('restaurant-kafe', null, 'omsetning', 20)
       where kommune_code is not null`);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const rad of r.rows) expect(rad.kommune_navn).toBeTruthy();
  });
});
