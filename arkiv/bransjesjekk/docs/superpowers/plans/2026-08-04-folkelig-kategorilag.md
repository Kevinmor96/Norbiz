# Folkelig kategorilag og topplister — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygge det kuraterte kategorilaget (30 folkelige kategorier, kjedeliste, topplistefunksjoner), ekte demografi-import og målrettet Brreg-henting, og legge om Lovable-forsiden — per spec `docs/superpowers/specs/2026-08-04-folkelig-kategorilag-design.md`.

**Architecture:** Kategoriene er data i basen (categories/category_members/brands, migrasjon 0014), topplistene er SQL-funksjoner (0015) etter samme mønster som `kommune_aggregat`. Kuratert innhold ligger i én håndskrevet SQL-fil (`supabase/seed/kategorier.sql`) som kjøres etter seed.sql — generatoren røres ikke, for kategoriene har ingen syntetisk støy. Imports er edge functions med skiveprotokoll, drevet fra basen via `extensions.http`.

**Tech Stack:** Postgres (PGlite 18.3 i test, Supabase live), vitest, Deno edge functions, PostgREST-upsert, Lovable for frontend.

**Miljøfakta du trenger:**
- Tester: `npm test` (alle) eller `npx vitest run tests/<fil> -v`. Ingen Docker/Postgres-server — `tests/helpers/db.ts` sin `freshDb()` bygger PGlite med alle migrasjoner i filnavnrekkefølge. `actAsAnon(db)`/`endAct(db)` finnes for RLS-tester (se `tests/aggregates.test.ts`).
- Livebasen nås KUN via Supabase-MCP-verktøyene (`execute_sql`, `apply_migration`, `deploy_edge_function`). Edge functions trigges fra basen: `select content::text from extensions.http(('GET','https://jcpuhhrqhgrnihiacosy.supabase.co/functions/v1/<navn>?<params>', ARRAY[extensions.http_header('Authorization','Bearer <anon-nøkkel>')]::extensions.http_header[], NULL, NULL)::extensions.http_request);` — sett `select extensions.http_set_curlopt('CURLOPT_TIMEOUT','150');` i samme kall, ellers ryker 5-sekundersgrensen. Anon-nøkkelen hentes med `get_publishable_keys`.
- `industry_demography` har naturlig nøkkel `(industry_id, region_id, year)` (migrasjon 0003:69).
- Commit-footer: to linjer, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` og `Claude-Session: https://claude.ai/code/session_01H6TQr4BzjS97SgSWurfFwL`.

---

## Task 1: Migrasjon 0014 — kategoritabellene

**Files:**
- Create: `supabase/migrations/0014_kategorier.sql`
- Create: `tests/categories.test.ts` (påbegynnes her, utvides i task 3–4)

- [ ] **Step 1: Skriv feilende skjematest**

Opprett `tests/categories.test.ts`:

```ts
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
});
```

Merk: sjekk først hvordan `tests/aggregates.test.ts` importerer `actAsAnon`/`endAct` — bruk samme import. Hvis `kategorier.sql` ikke finnes ennå, lag en tom fil med bare `-- fylles i task 3` slik at testen kompilerer.

- [ ] **Step 2: Kjør testen, se den feile**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: FAIL med `relation "categories" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

Opprett `supabase/migrations/0014_kategorier.sql`:

```sql
-- Det folkelige kategorilaget. Kategoriene er redaksjonen vår — «hva folk
-- faktisk vurderer å starte» — og bor i basen slik at Lovable bare leser,
-- og slik at premium-gating av filteret kan håndheves her senere.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  navn        text not null,
  verden      text not null,
  beskrivelse text not null default '',
  farge       text not null default '#1B2A41',
  ikon        text not null default 'store',
  sortering   int  not null default 0
);

-- Én kategori samler flere koder, i to kildespråk: kilde='ssb' er
-- SN2007-koder for statistikk (12910/12937), kilde='brreg' er
-- SN2025-prefikser for selskapsmatching. Ingen FK til industries: Brreg-
-- prefikser som 41.0 finnes ikke i SN2007-kodeverket. En test håndhever at
-- ssb-kodene finnes, og at koder i samme kategori og kilde aldri overlapper
-- hierarkisk — ellers dobbelteller summene.
create table category_members (
  category_id uuid not null references categories (id) on delete cascade,
  nace_code   text not null,
  kilde       text not null check (kilde in ('ssb', 'brreg')),
  primary key (category_id, nace_code, kilde)
);

-- Kuratert kjedeliste. org_nr er hovedselskapet og kan mangle til det
-- målrettede Brreg-oppslaget har kjørt; merknad sier hva org_nr faktisk er
-- (morselskap, driftsselskap), for kjedens tall er hovedselskapets regnskap
-- og skal aldri utgis for å være hele kjeden.
create table brands (
  id          uuid primary key default gen_random_uuid(),
  navn        text not null unique,
  category_id uuid not null references categories (id) on delete cascade,
  org_nr      text,
  merknad     text not null default ''
);

create index brands_category_id_idx on brands (category_id);

alter table categories enable row level security;
alter table category_members enable row level security;
alter table brands enable row level security;

create policy categories_read on categories for select using (true);
create policy category_members_read on category_members for select using (true);
create policy brands_read on brands for select using (true);

grant select on categories, category_members, brands to anon, authenticated;
```

- [ ] **Step 4: Kjør testen, se den passere**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: PASS.

- [ ] **Step 5: Kjør hele suiten og commit**

Kjør: `npm test` — alt grønt (107 + 1 ny).

```bash
git add supabase/migrations/0014_kategorier.sql tests/categories.test.ts
git commit -m "Migrasjon 0014: categories, category_members og brands"
```

---

## Task 2: Rett Gullsmed-koden og utvid det kuraterte kodesettet

Kategoriene trenger koder seed-en ikke har (bakeri, hotell, camping, reise,
elektronikk, kiosk, optiker). De legges i seed-treet så PGlite-testene får
næringsrader og mock-statistikk å regne på.

**Files:**
- Modify: `seed/industries.ts`
- Modify: `tests/seed.test.ts` (bare hvis en literal ryker — se step 4)

- [ ] **Step 1: Grunning — sjekk kodene mot livebasen**

Kjør mot livebasen (`execute_sql`, prosjekt `jcpuhhrqhgrnihiacosy`):

```sql
select nace_code, name from industries
where nace_code in ('10.711','47.241','47.112','47.410','47.420','47.430',
  '47.591','47.599','55.101','55.102','55.201','55.202','55.300',
  '79.110','79.120','49.392','47.772','47.782')
order by nace_code collate "C";
```

Alle kodene skal finnes (hele SSB-kodeverket er importert). Bruk navnene
spørringen returnerer der de avviker fra tabellen i step 2. Mangler en kode
helt, ta den ut av kategorien — vis aldri en kode SSB ikke publiserer.

- [ ] **Step 2: Utvid TREE i seed/industries.ts**

Følg eksisterende format (`Top` = [tosiffer, navn, profil, grupper]). Endringer:

1. I 47-toppen, gruppe `47.7`: endre `['47.782','Butikkhandel med gull og sølv','Gullsmed']` til `['47.772','Butikkhandel med gull- og sølvvarer','Gullsmed']`, og legg til `['47.782','Butikkhandel med optiske artikler','Optiker']`.
2. I 47-toppen, ny gruppe `['47.2','Butikkhandel med mat og drikke i spesialforretninger',[['47.241','Butikkhandel med bakervarer og konditorvarer','Bakeriutsalg']]]` og ny gruppe `['47.4','Butikkhandel med IKT-utstyr',[['47.410','Butikkhandel med datamaskiner','Databutikk'],['47.420','Butikkhandel med telekommunikasjonsutstyr','Mobilbutikk'],['47.430','Butikkhandel med audio- og videoutstyr','Elektronikkbutikk']]]` og ny gruppe `['47.5','Butikkhandel med husholdningsvarer',[['47.591','Butikkhandel med møbler','Møbelbutikk']]]` — 47.531 Fargehandel ligger alt under 47.7 i treet; flytt den til 47.5 (det er der SSB har den) og behold navnet.
3. Nye topper (velg profil fra `ProfileName` i `seed/config.ts` — bruk nærmeste eksisterende; sjekk hvilke som finnes før du velger):
   - `['10','Næringsmiddelindustri', <profil>, [['10.7','Produksjon av bakervarer',[['10.711','Produksjon av brød og ferske konditorvarer','Bakeri']]]]]`
   - `['55','Overnattingsvirksomhet', <profil>, [['55.1','Hotellvirksomhet',[['55.101','Drift av hoteller med restaurant','Hotell'],['55.102','Drift av hoteller uten restaurant','Hotell garni']]],['55.2','Ferieboliger',[['55.202','Utleie av ferieleiligheter','Utleiehytter']]],['55.3','Campingplasser',[['55.300','Drift av campingplasser','Campingplass']]]]]`
   - `['79','Reisebyråer og reisearrangører', <profil>, [['79.1','Reisebyrå- og reisearrangørvirksomhet',[['79.110','Reisebyråvirksomhet','Reisebyrå'],['79.120','Reisearrangørvirksomhet','Turoperatør']]]]]`
   - `['49','Landtransport', <profil>, [['49.3','Annen landtransport med passasjerer',[['49.392','Turbiltransport','Turbilselskap']]]]]`
   - I 47-toppen, gruppe `47.1`: legg til `['47.112','Kioskhandel med bredt vareutvalg','Kiosk']`.

Bruk navnene fra step 1-spørringen der de avviker.

- [ ] **Step 3: Kjør suiten**

Kjør: `npm test`
`seed-load.test.ts` sammenligner mot `buildSeed()`-output og skal tåle
utvidelsen. Ryker en literal-telling i `tests/seed.test.ts` (f.eks. antall
kuraterte), oppdater literalen til det nye tallet — det er en bevisst
utvidelse av kurateringen.

- [ ] **Step 4: Commit**

```bash
git add seed/industries.ts tests/
git commit -m "Seed: rett Gullsmed til 47.772, ny Optiker på 47.782, kategorikodene inn i kurateringen"
```

---

## Task 3: kategorier.sql — kategoriene, medlemmene og kjedelisten

**Files:**
- Create: `supabase/seed/kategorier.sql` (erstatter tom placeholder fra task 1)
- Modify: `tests/categories.test.ts`

- [ ] **Step 1: Skriv de feilende innholdstestene**

Legg til i describe-blokken i `tests/categories.test.ts`:

```ts
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
```

- [ ] **Step 2: Kjør testene, se dem feile**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: FAIL (0 kategorier).

- [ ] **Step 3: Skriv kategorier.sql**

Opprett `supabase/seed/kategorier.sql`. Idempotent, kjøres etter seed.sql og
etter migrasjon 0014 (både i test, i indb-flyten og live):

```sql
-- Det kuraterte kategorilaget. Redaksjon, ikke generert: dette er
-- oppdelingen som er produktets konkurransefortrinn, og den vedlikeholdes
-- for hånd her. Kjøres ETTER seed.sql — seed-ens truncate av industries
-- kaskaderer til category_members.
begin;

truncate category_members, brands, categories restart identity cascade;

insert into categories (slug, navn, verden, beskrivelse, farge, ikon, sortering) values
  ('restaurant-kafe','Restaurant & kafé','Mat & drikke','6 000 foretak kjemper om gjestene — se hvem som faktisk tjener penger.','#E4572E','utensils',10),
  ('gatekjokken','Gatekjøkken','Mat & drikke','Lave terskler, tøff konkurranse: tallene bak hurtigmaten.','#E4572E','pizza',11),
  ('bar-pub','Bar & pub','Mat & drikke','Skjenkestedene: omsetning, marginer og hvor de tjener penger.','#E4572E','beer',12),
  ('catering-kantine','Catering & kantine','Mat & drikke','Mat i volum: catering og kantinedrift for bedriftsmarkedet.','#E4572E','chef-hat',13),
  ('bakeri-konditori','Bakeri & konditori','Mat & drikke','Fra produksjon til utsalg — hele bakerinæringens tall.','#E4572E','croissant',14),
  ('dagligvare','Dagligvare','Butikk','235 milliarder i omsetning. Slik ser Norges største detaljbransje ut.','#2E86AB','shopping-cart',20),
  ('kiosk','Kiosk','Butikk','Småhandelen som lever av impulskjøp — tall og trender.','#2E86AB','store',21),
  ('klesbutikk','Klesbutikk','Butikk','Motehandelen i tall: hvem vokser, hvem skvises av netthandel.','#2E86AB','shirt',22),
  ('skobutikk','Skobutikk','Butikk','Skohandelens marginer og utvikling år for år.','#2E86AB','footprints',23),
  ('sportsbutikk','Sportsbutikk','Butikk','Sportshandelen etter kjedekrigen — tallene bak.','#2E86AB','dumbbell',24),
  ('mobel-interior','Møbel & interiør','Butikk','Møbel- og interiørhandelen: store billetter, sykliske svingninger.','#2E86AB','armchair',25),
  ('elektronikkbutikk','Elektronikkbutikk','Butikk','Elektronikkhandelen: tynne marginer, store volumer.','#2E86AB','tv',26),
  ('gullsmed','Gullsmed','Butikk','Gull- og sølvhandelens nisje — få aktører, lojale kunder.','#2E86AB','gem',27),
  ('optiker','Optiker','Butikk','Optikerbransjen: fagretail med helsemarginer.','#2E86AB','glasses',28),
  ('blomster-hage','Blomster & hage','Butikk','Blomsterbutikker og hagesentre gjennom sesongene.','#2E86AB','flower',29),
  ('hotell-overnatting','Hotell & overnatting','Turisme & opplevelser','Hotellnæringen fylke for fylke — belegg, omsetning, ansatte.','#7B4B94','bed',30),
  ('camping-hytter','Camping & hytter','Turisme & opplevelser','Camping og utleiehytter: distriktenes turistnæring i tall.','#7B4B94','tent',31),
  ('opplevelser-aktiviteter','Opplevelser & aktiviteter','Turisme & opplevelser','Aktivitets- og opplevelsesselskapene som vokser med turismen.','#7B4B94','mountain',32),
  ('reisebyra-arrangor','Reisebyrå & arrangør','Turisme & opplevelser','Reisebyråer og turoperatører — bransjen som overlevde alt.','#7B4B94','plane',33),
  ('frisor','Frisør','Helse & velvære','10 000 salonger og 17 % margin — bedre butikk enn ryktet sier.','#C05299','scissors',40),
  ('hudpleie-velvare','Hudpleie & velvære','Helse & velvære','Skjønnhetspleien vokser år for år. Se tallene.','#C05299','sparkles',41),
  ('treningssenter','Treningssenter','Helse & velvære','Treningssentrene i tall: medlemsvekst, marginer, kjeder.','#C05299','activity',42),
  ('tannlege','Tannlege','Helse & velvære','Tannhelse er privat næring — og en av de mest lønnsomme.','#C05299','tooth',43),
  ('fysioterapi','Fysioterapi','Helse & velvære','Fysioterapeutene: små foretak, stabil etterspørsel.','#C05299','heart-pulse',44),
  ('byggefirma','Byggefirma','Bygg & håndverk','Byggenæringen: konjunkturenes frontlinje, tall for hele landet.','#D08C1D','hammer',50),
  ('elektriker','Elektriker','Bygg & håndverk','Elektrikerfagets tall: jevn etterspørsel, gode marginer.','#D08C1D','zap',51),
  ('rorlegger','Rørlegger','Bygg & håndverk','Rørleggerbransjen — håndverket alle trenger, i tall.','#D08C1D','wrench',52),
  ('maler-overflate','Maler & overflate','Bygg & håndverk','Maler- og overflatefagene: lav terskel, hard priskonkurranse.','#D08C1D','paint-roller',53),
  ('renhold','Renhold','Tjenester','Renholdsbransjen: milliardmarked med små og store aktører.','#3B7A57','spray-can',60),
  ('regnskap-revisjon','Regnskap & revisjon','Tjenester','Regnskapsførerne og revisorene som alle andre bransjer trenger.','#3B7A57','calculator',61);

-- Medlemskoder. kilde='ssb' er SN2007 (statistikk), kilde='brreg' er
-- SN2025-prefikser (selskapsmatching). Prefiksene verifiseres mot Brreg i
-- utrullingstasken — et prefiks uten treff byttes der, ikke her.
insert into category_members (category_id, nace_code, kilde)
select c.id, m.kode, m.kilde from (values
  ('restaurant-kafe','56.101','ssb'), ('restaurant-kafe','56.11','brreg'),
  ('gatekjokken','56.102','ssb'), ('gatekjokken','56.12','brreg'),
  ('bar-pub','56.301','ssb'), ('bar-pub','56.309','ssb'), ('bar-pub','56.30','brreg'),
  ('catering-kantine','56.210','ssb'), ('catering-kantine','56.290','ssb'),
  ('catering-kantine','56.21','brreg'), ('catering-kantine','56.29','brreg'),
  ('bakeri-konditori','10.711','ssb'), ('bakeri-konditori','47.241','ssb'),
  ('bakeri-konditori','10.71','brreg'), ('bakeri-konditori','47.24','brreg'),
  ('dagligvare','47.111','ssb'), ('dagligvare','47.11','brreg'),
  ('kiosk','47.112','ssb'), ('kiosk','47.12','brreg'),
  ('klesbutikk','47.710','ssb'), ('klesbutikk','47.71','brreg'),
  ('skobutikk','47.721','ssb'), ('skobutikk','47.72','brreg'),
  ('sportsbutikk','47.641','ssb'), ('sportsbutikk','47.64','brreg'),
  ('mobel-interior','47.591','ssb'), ('mobel-interior','47.531','ssb'),
  ('mobel-interior','47.59','brreg'), ('mobel-interior','47.53','brreg'),
  ('elektronikkbutikk','47.410','ssb'), ('elektronikkbutikk','47.420','ssb'),
  ('elektronikkbutikk','47.430','ssb'), ('elektronikkbutikk','47.4','brreg'),
  ('gullsmed','47.772','ssb'), ('gullsmed','47.77','brreg'),
  ('optiker','47.782','ssb'), ('optiker','47.78','brreg'),
  ('blomster-hage','47.761','ssb'), ('blomster-hage','47.762','ssb'),
  ('blomster-hage','47.76','brreg'),
  ('hotell-overnatting','55.101','ssb'), ('hotell-overnatting','55.102','ssb'),
  ('hotell-overnatting','55.1','brreg'),
  ('camping-hytter','55.202','ssb'), ('camping-hytter','55.300','ssb'),
  ('camping-hytter','55.2','brreg'), ('camping-hytter','55.3','brreg'),
  ('opplevelser-aktiviteter','93.210','ssb'), ('opplevelser-aktiviteter','93.291','ssb'),
  ('opplevelser-aktiviteter','93.292','ssb'), ('opplevelser-aktiviteter','93.299','ssb'),
  ('opplevelser-aktiviteter','49.392','ssb'),
  ('opplevelser-aktiviteter','93.2','brreg'), ('opplevelser-aktiviteter','49.39','brreg'),
  ('reisebyra-arrangor','79.110','ssb'), ('reisebyra-arrangor','79.120','ssb'),
  ('reisebyra-arrangor','79','brreg'),
  ('frisor','96.020','ssb'), ('frisor','96.21','brreg'),
  ('hudpleie-velvare','96.040','ssb'), ('hudpleie-velvare','96.22','brreg'),
  ('treningssenter','93.130','ssb'), ('treningssenter','93.13','brreg'),
  ('tannlege','86.230','ssb'), ('tannlege','86.23','brreg'),
  ('fysioterapi','86.901','ssb'), ('fysioterapi','86.91','brreg'),
  ('byggefirma','41.200','ssb'), ('byggefirma','41.0','brreg'),
  ('elektriker','43.210','ssb'), ('elektriker','43.21','brreg'),
  ('rorlegger','43.221','ssb'), ('rorlegger','43.222','ssb'), ('rorlegger','43.22','brreg'),
  ('maler-overflate','43.341','ssb'), ('maler-overflate','43.390','ssb'),
  ('maler-overflate','43.3','brreg'),
  ('renhold','81.210','ssb'), ('renhold','81.291','ssb'), ('renhold','81.299','ssb'),
  ('renhold','81.2','brreg'),
  ('regnskap-revisjon','69.201','ssb'), ('regnskap-revisjon','69.202','ssb'),
  ('regnskap-revisjon','69.2','brreg')
) as m(slug, kode, kilde)
join categories c on c.slug = m.slug;

-- Kjedelisten. org_nr fylles av det målrettede Brreg-oppslaget (task 6);
-- null her betyr «ennå ikke slått opp», og brand_liste() viser da navnet
-- uten tall. Tall som vises er hovedselskapets regnskap — merknaden sier
-- hvilket selskap det er.
insert into brands (navn, category_id, org_nr, merknad)
select b.navn, c.id, null, b.merknad from (values
  ('REMA 1000','dagligvare','Hovedkontoret Rema 1000 Norge AS'),
  ('KIWI','dagligvare','Kiwi Norge AS, del av NorgesGruppen'),
  ('Coop Extra','dagligvare','Coop Norge SA — samvirke, ett samlet regnskap'),
  ('Bunnpris','dagligvare','I.K. Lykke AS'),
  ('Narvesen','kiosk','Reitan Convenience Norway AS'),
  ('7-Eleven','kiosk','Reitan Convenience Norway AS'),
  ('Dressmann','klesbutikk','Varner-gruppen'),
  ('Cubus','klesbutikk','Varner-gruppen'),
  ('H&M Norge','klesbutikk','H & M Hennes & Mauritz AS'),
  ('Eurosko','skobutikk','Euro Sko Norge AS'),
  ('XXL','sportsbutikk','XXL Sport & Villmark AS'),
  ('Sport 1','sportsbutikk','Sport 1 Gruppen AS'),
  ('IKEA','mobel-interior','IKEA AS'),
  ('Skeidar','mobel-interior','Skeidar Living Group AS'),
  ('Elkjøp','elektronikkbutikk','Elkjøp Norge AS'),
  ('Power','elektronikkbutikk','Power Norge AS'),
  ('Bjørklund','gullsmed','Bjørklund Norge AS'),
  ('Gullfunn','gullsmed','Gullfunn-kjeden'),
  ('Specsavers','optiker','Specsavers Norway AS'),
  ('Brilleland','optiker','Brilleland AS'),
  ('Plantasjen','blomster-hage','Plantasjen Norge AS'),
  ('Mester Grønn','blomster-hage','Mester Grønn AS'),
  ('Scandic','hotell-overnatting','Scandic Hotels AS (norsk driftsselskap)'),
  ('Thon Hotels','hotell-overnatting','Thon Hotels AS'),
  ('Strawberry','hotell-overnatting','Strawberry Hotels-driftsselskapet'),
  ('McDonald''s','gatekjokken','McDonald''s Norge AS'),
  ('Burger King','gatekjokken','King Food AS'),
  ('Peppes Pizza','restaurant-kafe','Peppes Pizza AS'),
  ('Egon','restaurant-kafe','Norrein AS'),
  ('Espresso House','restaurant-kafe','Espresso House Norway AS'),
  ('SATS','treningssenter','SATS Norway AS'),
  ('Evo Fitness','treningssenter','Evo Fitness AS'),
  ('Fresh Fitness','treningssenter','Fresh Fitness AS'),
  ('Cutters','frisor','Cutters AS'),
  ('Nikita','frisor','Raise Gruppen AS'),
  ('Colosseum Tannlege','tannlege','Colosseum Dental Norway AS'),
  ('Oris Dental','tannlege','Oris Dental-driftsselskapet'),
  ('Azets','regnskap-revisjon','Azets Insight AS'),
  ('View Group','regnskap-revisjon','View Group-driftsselskapet'),
  ('Insider','renhold','Insider Facility Solutions AS')
) as b(navn, slug, merknad)
join categories c on c.slug = b.slug;

commit;
```

- [ ] **Step 4: Kjør testene, se dem passere**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: PASS på alle. Ryker overlappstesten, er det en reell
redaksjonsfeil i medlemslisten — fjern den bredeste koden.

- [ ] **Step 5: Oppdater indb-README og commit**

Legg til én linje i `supabase/seed/indb/README.md` om at
`supabase/seed/kategorier.sql` kjøres til slutt (den er liten nok for ett
`execute_sql`-kall).

```bash
git add supabase/seed/kategorier.sql supabase/seed/indb/README.md tests/categories.test.ts
git commit -m "Kategorilaget: 30 kategorier, medlemskoder i to kildespråk, kjedeliste"
```

---

## Task 4: Migrasjon 0015 — topplistefunksjonene

**Files:**
- Create: `supabase/migrations/0015_topplister.sql`
- Modify: `tests/categories.test.ts`

- [ ] **Step 1: Skriv feilende funksjonstester**

Legg til i `tests/categories.test.ts`:

```ts
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
```

- [ ] **Step 2: Kjør, se dem feile**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: FAIL med `function kategori_oversikt() does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

Opprett `supabase/migrations/0015_topplister.sql`:

```sql
-- Topplistefunksjonene bak forsiden. Samme regler som migrasjon 0010:
-- aggregering hører i basen (PostgREST avviser aggregater i spørrestrengen),
-- ingen funksjon er security definer, og terskler håndheves her.
--
-- Merk at funksjonene IKKE filtrerer på data_quality: statistikktabellen
-- inneholder én kvalitet per miljø (mock i test, ssb live), og
-- anslagstabellen er uansett en annen tabell. Å filtrere her ville gjort
-- PGlite-testene tomme uten å beskytte mot noe reelt.

-- Ett kort per kategori: siste års nøkkeltall + hele tidsserien for
-- sparkline. Kategorier uten statistikk kommer med (null-tall) — forsiden
-- avgjør selv om den viser kortet grått eller utelater det.
create function kategori_oversikt()
returns table (
  slug text, navn text, verden text, beskrivelse text, farge text,
  ikon text, sortering int,
  ar int, n_bedrifter bigint, omsetning_total bigint, omsetning_per_bedrift bigint,
  driftsmargin_pct numeric, sysselsatte bigint, ansatte_per_bedrift numeric,
  vekst_cagr_pct numeric, vekst_1ar_pct numeric, serie jsonb
)
language sql stable as $$
  with tall as (
    select c.id cid, s.year,
      sum(s.n_enheter)::bigint n,
      sum(s.omsetning_total)::bigint oms,
      sum(s.driftsresultat_total)::bigint dr,
      sum(s.sysselsatte_total)::bigint sys
    from categories c
    join category_members m on m.category_id = c.id and m.kilde = 'ssb'
    join industries i on i.nace_code = m.nace_code
    join industry_stats s on s.industry_id = i.id
      and s.region_level = 'land' and s.unit_type = 'foretak'
    group by c.id, s.year
  ),
  siste as (
    select distinct on (cid) cid, year, n, oms, dr, sys
    from tall where oms is not null
    order by cid, year desc
  ),
  basis as (
    -- Eldste år innenfor femårsvinduet bak siste år: CAGR-grunnlaget.
    select distinct on (t.cid) t.cid, t.year, t.oms
    from tall t join siste si on si.cid = t.cid
    where t.oms is not null and t.year >= si.year - 5 and t.year < si.year
    order by t.cid, t.year asc
  ),
  serie as (
    select cid, jsonb_agg(jsonb_build_object(
      'ar', year, 'omsetning', oms, 'bedrifter', n) order by year) j
    from tall group by cid
  )
  select c.slug, c.navn, c.verden, c.beskrivelse, c.farge, c.ikon, c.sortering,
    si.year, si.n, si.oms,
    case when si.n > 0 then si.oms / si.n end,
    case when si.oms > 0 and si.dr is not null
      then round(100.0 * si.dr / si.oms, 2) end,
    si.sys,
    case when si.n > 0 and si.sys is not null
      then round(si.sys::numeric / si.n, 1) end,
    case when b.oms > 0 and si.year > b.year
      then round((power(si.oms::numeric / b.oms, 1.0 / (si.year - b.year)) - 1) * 100, 1) end,
    aar1.vekst,
    se.j
  from categories c
  left join siste si on si.cid = c.id
  left join basis b on b.cid = c.id
  left join serie se on se.cid = c.id
  left join lateral (
    select case when f.oms > 0 then round(100.0 * (si.oms - f.oms) / f.oms, 1) end vekst
    from tall f where f.cid = c.id and f.year = si.year - 1
  ) aar1 on true
  order by c.sortering, c.slug
$$;

-- Største selskaper i en kategori, valgfritt avgrenset til fylke.
-- Matcher companies mot kategoriens brreg-prefikser (SN2025) — companies
-- bærer Brregs egen kode, jf. import-brreg. Bare selskaper i
-- regnskapssnittet: ENK og selskaper uten tall skal ikke rangeres.
create function topp_selskaper(
  kategori_slug text,
  fylke text default null,
  metrikk text default 'omsetning',
  antall int default 10
)
returns table (
  rang bigint, navn text, org_nr text, kommune_code text,
  omsetning bigint, driftsresultat bigint, driftsmargin_pct numeric,
  ansatte int, regnskapsar int
)
language sql stable as $$
  with kandidater as (
    select c.navn, c.org_nr, c.kommune_code, c.omsetning, c.driftsresultat,
      case when c.omsetning > 0
        then round(100.0 * c.driftsresultat / c.omsetning, 1) end margin,
      c.ansatte, c.regnskapsar
    from companies c
    where c.inngar_i_regnskapssnitt
      and (fylke is null or left(c.kommune_code, 2) = fylke)
      and exists (
        select 1 from categories k
        join category_members m on m.category_id = k.id and m.kilde = 'brreg'
        where k.slug = kategori_slug and c.nace_code like m.nace_code || '%')
  )
  select row_number() over (order by
      case when metrikk = 'omsetning' then omsetning end desc nulls last,
      case when metrikk = 'ansatte' then ansatte end desc nulls last,
      case when metrikk = 'margin' then margin end desc nulls last,
      org_nr),
    navn, org_nr, kommune_code, omsetning, driftsresultat, margin,
    ansatte, regnskapsar
  from kandidater
  order by 1
  limit antall
$$;

-- «Høyest margin i Norge», «størst vekst» osv. — rangerer kategoriene selv.
create function kategori_rangering(
  metrikk text default 'driftsmargin',
  retning text default 'desc',
  antall int default 10
)
returns table (rang bigint, slug text, navn text, verden text, farge text,
  verdi numeric, ar int)
language sql stable as $$
  with v as (
    select o.slug, o.navn, o.verden, o.farge, o.ar,
      case metrikk
        when 'driftsmargin' then o.driftsmargin_pct
        when 'omsetning' then o.omsetning_total::numeric
        when 'vekst' then o.vekst_cagr_pct
        when 'bedrifter' then o.n_bedrifter::numeric
        when 'ansatte_per_bedrift' then o.ansatte_per_bedrift
      end verdi
    from kategori_oversikt() o
  )
  select row_number() over (order by
      case when retning = 'asc' then verdi end asc nulls last,
      case when retning = 'desc' then verdi end desc nulls last,
      slug),
    slug, navn, verden, farge, verdi, ar
  from v
  where verdi is not null
  order by 1
  limit antall
$$;

-- Kjedelisten med tilkoblede tall. Selskap mangler til brand-oppslaget har
-- kjørt — da vises navnet uten tall, som er ærligere enn å gjette.
create function brand_liste(i_kategori text default null)
returns table (navn text, kategori text, kategori_slug text, kategori_farge text,
  org_nr text, merknad text, omsetning bigint, driftsmargin_pct numeric,
  ansatte int, regnskapsar int)
language sql stable as $$
  select b.navn, k.navn, k.slug, k.farge, b.org_nr, b.merknad,
    c.omsetning,
    case when c.omsetning > 0
      then round(100.0 * c.driftsresultat / c.omsetning, 1) end,
    c.ansatte, c.regnskapsar
  from brands b
  join categories k on k.id = b.category_id
  left join companies c on c.org_nr = b.org_nr
  where i_kategori is null or k.slug = i_kategori
  order by k.sortering, b.navn
$$;
```

- [ ] **Step 4: Kjør testene, se dem passere**

Kjør: `npx vitest run tests/categories.test.ts -v`
Forventet: PASS. Feiler restaurant-testen på tall, sjekk at task 2 faktisk
la kategorikodene inn i seed-treet (statistikkgeneratoren følger treet).

- [ ] **Step 5: Full suite og commit**

Kjør: `npm test` — alt grønt. Testen «er ingen av dem security definer» og
view-invoker-testen dekker de nye funksjonene automatisk.

```bash
git add supabase/migrations/0015_topplister.sql tests/categories.test.ts
git commit -m "Migrasjon 0015: kategori_oversikt, topp_selskaper, kategori_rangering, brand_liste"
```

---

## Task 5: import-demografi — ekte etableringer og konkurser

Dagens `industry_demography` er mock. Kildene (verifisert i
`2026-08-04-ssb-api-verifisert.md`): **08076** nye foretak og **07165**
åpnede konkurser, begge kvartalsvise med region × næring. 13701
(overlevelse) har INGEN næringsdimensjon og kan ikke fylle tabellen per
næring — overlevelseskolonnene forblir null i ssb-rader, og spec-en
oppdateres om det (task 8).

**Files:**
- Create: `supabase/functions/import-demografi/index.ts`

- [ ] **Step 1: Verifiser dimensjonene mot metadata**

Kjør fra livebasen (databasen når data.ssb.no; containeren gjør det ikke):

```sql
select extensions.http_set_curlopt('CURLOPT_TIMEOUT', '150');
select content::text from extensions.http((
  'GET', 'https://data.ssb.no/api/pxwebapi/v2/tables/08076/metadata?lang=no',
  ARRAY[]::extensions.http_header[], NULL, NULL)::extensions.http_request);
```

Gjenta for 07165. Noter: eksakt navn på nærings-, region-, tids- og
måltalldimensjonen, kodeformatet i næringsdimensjonen (SN2007? hvilke
nivåer?), og regionskodene (fylker? kommuner?). Koden under antar
dimensjonene kan hete noe annet enn i 12910 — den finner dem ved prefiks.
Stemmer ikke antakelsene med metadataene, juster koden FØR deploy.

- [ ] **Step 2: Skriv edge-funksjonen**

Opprett `supabase/functions/import-demografi/index.ts`:

```ts
/**
 * import-demografi — nyetableringer (08076) og åpnede konkurser (07165) fra
 * SSB, per fylke × næring. Fyller industry_demography med
 * data_quality='ssb' og erstatter mock-radene via upsert på den naturlige
 * nøkkelen (industry_id, region_id, year).
 *
 * Tabellene er KVARTALSVISE ("2023K1"); importen summerer til år og hopper
 * over år der siste kvartal mangler — et halvt år utgitt som helt ville
 * sett ut som kollaps i etableringstakten.
 *
 * 13701 (overlevelse) har ingen næringsdimensjon og kan ikke brukes her;
 * overlevelseskolonnene forblir null. Skiveprotokoll som i import-ssb:
 * ?felt=nyetableringer|konkurser, ?fra, ?antall, ?dry=1.
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

const naceNiva = (k: string): number | null => {
  if (!/^\d/.test(k)) return null;
  const s = k.replace('.', '').length;
  return s >= 2 && s <= 5 ? s : null;
};
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
      if (!r.ok) throw new Error(`les ${sti}: ${r.status}`);
      return r.json() as Promise<Record<string, unknown>[]>;
    };

    const logg: string[] = [];
    const meta = await hent(`${BASE}/tables/${kilde.tabell}/metadata?lang=no`)
      .then((r) => r.json()) as Js;

    // Dimensjonsnavn varierer mellom tabeller; finn dem ved mønster.
    const dimNavn = Object.keys(meta.dimension);
    const dNace = dimNavn.find((d) => d.toUpperCase().startsWith('NACE'));
    const dRegion = dimNavn.find((d) => d === 'Region');
    const dTid = dimNavn.find((d) => d === 'Tid');
    const dInnhold = dimNavn.find((d) => d === 'ContentsCode');
    if (!dNace || !dRegion || !dTid || !dInnhold)
      return svar({ feil: `fant ikke dimensjoner`, dimNavn });

    const alleNace = Object.keys(meta.dimension[dNace]!.category.index)
      .filter((k) => { const n = naceNiva(k); return n === 2 || n === 3; });
    const skive = alleNace.slice(fra, fra + antall);
    logg.push(`${kilde.tabell}: ${alleNace.length} naeringer, tar ${skive.length} fra ${fra}`);
    if (skive.length === 0) return svar({ ferdig: true, logg });

    const kvartaler = Object.keys(meta.dimension[dTid]!.category.index)
      .filter((t) => /^20(1[7-9]|2\d)K\d$/.test(t));
    const maal = Object.keys(meta.dimension[dInnhold]!.category.index);

    const url = `${BASE}/tables/${kilde.tabell}/data?lang=no&outputFormat=json-stat2` +
      `&valueCodes[${dNace}]=${encodeURIComponent(skive.join(','))}` +
      `&valueCodes[${dTid}]=${encodeURIComponent(kvartaler.join(','))}` +
      `&valueCodes[${dRegion}]=*` +
      `&valueCodes[${dInnhold}]=${encodeURIComponent(maal[0]!)}`;
    const j = await hent(url).then((r) => r.json()) as Js;
    logg.push(`${j.value.length} celler`);

    // Summer kvartal -> år. Bare hele år: manglende K4 betyr at året ikke
    // er ferdig publisert, og et 3/4-år ville sett ut som fall.
    const acc = new Map<string, { nace: string; region: string; aar: number;
      sum: number; kvartaler: number; merk: Record<string,string> }>();
    for (const c of celler(j)) {
      const nace = c.koder[dNace]!;
      const nl = naceNiva(nace); if (nl === null) continue;
      const region = c.koder[dRegion]!;
      if (!/^\d{2}$/.test(region)) continue;
      const aar = Number(c.koder[dTid]!.slice(0, 4));
      const key = `${nace}|${region}|${aar}`;
      let a = acc.get(key);
      if (!a) { a = { nace, region, aar, sum: 0, kvartaler: 0, merk: {} }; acc.set(key, a); }
      if (c.verdi !== null) { a.sum += c.verdi; a.kvartaler += 1; }
      else if (c.symbol && MANGEL[c.symbol]) a.merk[kilde.kolonne] = MANGEL[c.symbol]!;
    }

    const iid = new Map<string, { id: string; niva: number }>();
    for (const r of await les('industries?select=id,nace_code,nace_level&nace_level=lte.3&limit=2000'))
      iid.set(r['nace_code'] as string, { id: r['id'] as string, niva: r['nace_level'] as number });
    const regs = await les('regions?select=id,code,valid_from_year,valid_to_year&limit=500');
    const rid = (kode: string, y: number) => {
      for (const r of regs) {
        if (r['code'] !== kode) continue;
        const f = r['valid_from_year'] as number, t = (r['valid_to_year'] as number|null) ?? 9999;
        if (f <= y && y <= t) return r['id'] as string;
      }
      return null;
    };

    let hoppet = 0;
    const rows = [...acc.values()].flatMap((a) => {
      const i = iid.get(a.nace); if (!i) { hoppet++; return []; }
      const g = rid(a.region, a.aar); if (!g) { hoppet++; return []; }
      if (a.kvartaler < 4) return []; // ufullstendig år
      return [{
        industry_id: i.id, region_id: g, year: a.aar,
        nace_level: i.niva, region_level: 'fylke',
        [kilde.kolonne]: a.sum,
        merknader: a.merk, source: `ssb:${kilde.tabell}`,
        data_quality: 'ssb', coverage: 'alle',
      }];
    });
    logg.push(`${rows.length} rader klare (${hoppet} hoppet)`);

    if (dry) return svar({ dry: true, logg, neste_fra: fra + antall, eksempel: rows.slice(0, 2) });

    for (let i = 0; i < rows.length; i += 500) {
      const r = await fetch(`${SB}/rest/v1/industry_demography?on_conflict=industry_id,region_id,year`, {
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
```

VIKTIG-sjekk mot step 1-notatene før deploy: dimensjonsnavn, kodeformat i
næringsdimensjonen (er kodene «41» eller «F»-bokstavkoder? — filteret
`naceNiva` slipper bare siffer-koder gjennom), regionskoder, og om
ContentsCode har flere måltall (koden tar det første — velg riktig
eksplisitt hvis metadataene viser flere).

Merk også: en upsert av konkurser over en rad som alt har nyetableringer
skal IKKE nulle nyetableringene. PostgREST merge-duplicates oppdaterer bare
kolonnene som sendes — konkurs-raden sender ikke `nyetableringer`, så
feltene flettes. Verifiser i step 4.

- [ ] **Step 3: Deploy og dry-run**

Deploy med `deploy_edge_function` (name `import-demografi`, verify_jwt
true). Dry-run fra basen:

```sql
-- samme http-mønster som i miljøfakta; url:
-- .../functions/v1/import-demografi?felt=nyetableringer&dry=1&fra=0&antall=5
```

Forventet: logg med celletall og 1–2 eksempelrader med fylkes-region og
nace_level 2/3. Feiler dimensjonssjekken, returneres `dimNavn` — juster og
redeploy.

- [ ] **Step 4: Kjør reelt, begge felt, verifiser fletting**

Kjør nyetableringer i skiver (`fra` drives av `neste_fra` til
`flere=false`), deretter konkurser. Verifiser:

```sql
select count(*) filter (where data_quality='ssb') ssb,
  count(*) filter (where data_quality='ssb' and nyetableringer is not null) med_nye,
  count(*) filter (where data_quality='ssb' and konkurser is not null) med_konk,
  count(*) filter (where data_quality='ssb' and nyetableringer is not null
                   and konkurser is not null) begge
from industry_demography;
```

Forventet: `begge` > 0 (flettingen virker). Slett så mock-radene som IKKE
ble erstattet av upsert — men BARE hvis scoringsviewet tåler det: kjør
`select count(*) from industry_scores_computed` før og etter. Mock-demografi
skal uansett ikke være del av produktet lenger:

```sql
delete from industry_demography where data_quality = 'mock';
```

Regn så om scorene (samme insert som sist):

```sql
begin;
truncate industry_scores;
insert into industry_scores (industry_id, region_id, year, nace_level, region_level,
  unit_type, score_lonnsomhet, score_vekst, score_risiko, score_konkurranse,
  score_kapitalbehov, score_ettersporsel, score_total, forklaring)
select industry_id, region_id, year, nace_level, region_level, unit_type,
  score_lonnsomhet, score_vekst, score_risiko, score_konkurranse,
  score_kapitalbehov, score_ettersporsel, score_total, forklaring
from industry_scores_computed;
commit;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/import-demografi/index.ts
git commit -m "import-demografi: ekte nyetableringer (08076) og konkurser (07165)"
```

---

## Task 6: Målrettet Brreg-henting — de store selskapene og kjedene

**Files:**
- Modify: `supabase/functions/import-brreg/index.ts`

- [ ] **Step 1: Verifiser brreg-prefiksene og finn kjede-orgnr**

Probe-funksjonen `probe-brreg` er deployet (tar `?koder=`). Kjør den for
alle brreg-prefiksene i kategorier.sql (`56.11,56.12,...`) og noter prefiks
med 0 treff — bytt dem i kategorier.sql til nærmeste prefiks med treff
(SN2025-strukturen avviker fra SN2007 flere steder). Deretter kjede-orgnr:
Enhetsregisteret støtter navnesøk:

```
https://data.brreg.no/enhetsregisteret/api/enheter?navn=<navn>&size=5
```

Utvid probe-brreg midlertidig med en `?navn=`-modus som returnerer
organisasjonsnummer + navn + næringskode for topptreffene, kjør den for
hver av de ~40 brand-navnene, og velg riktig selskap (driftsselskapet, ikke
holdingselskapet — sjekk næringskoden). Skriv resultatet som en
`update brands set org_nr='...' where navn='...';`-bolk nederst i
`supabase/seed/kategorier.sql` (én linje per brand, med SQL-kommentar der
valget ikke var opplagt).

- [ ] **Step 2: Utvid import-brreg**

I `supabase/functions/import-brreg/index.ts`, legg til to moduser i
handleren (etter parametrene, før dagens kategorikode-løkke). Begge
gjenbruker `hent`, `regnskap`, `les`, `upsert`, `svar` og radbyggingen —
trekk radbyggingen (løkka «for (const e of enheter)») ut i en lokal
funksjon `byggRader(enheter)` først, så de tre modusene deler den:

```ts
    // ?brands=1 — slå opp kjedeselskapene direkte på orgnr.
    if (u.searchParams.get('brands') === '1') {
      const brands = await les('brands?select=navn,org_nr&org_nr=not.is.null');
      const enheter: Record<string, unknown>[] = [];
      for (const b of brands) {
        const r = await hent(`${ENHETER}/${b['org_nr']}`);
        if (!r.ok) { tell(`brand_${r.status}`); continue; }
        enheter.push(await r.json());
      }
      logg.push(`${enheter.length} kjedeselskaper fra Enhetsregisteret`);
      const { rader, snap } = await byggRader(enheter);
      if (dry) return svar({ dry: true, logg, eksempel: rader.slice(0, 3) });
      await upsert('companies', 'org_nr', rader);
      await upsert('companies_snapshot', 'org_nr,regnskapsar,hentet_dato', snap);
      return svar({ ok: true, logg });
    }

    // ?stor=1 — de største per kategoriprefiks, via ansattefilteret.
    // Brreg kan ikke sortere på omsetning; fraAntallAnsatte=50 gir de store.
    if (u.searchParams.get('stor') === '1') {
      const medlemmer = await les(
        `categories?select=slug,category_members(nace_code,kilde)`);
      const prefikser = [...new Set(medlemmer.flatMap((k) =>
        ((k['category_members'] ?? []) as Record<string, string>[])
          .filter((m) => m['kilde'] === 'brreg').map((m) => m['nace_code']!)))]
        .sort().slice(fra, fra + antall);
      logg.push(`tar ${prefikser.length} prefikser fra ${fra}`);
      if (prefikser.length === 0) return svar({ ferdig: true, logg });
      const enheter: Record<string, unknown>[] = [];
      const sett = new Set<string>();
      for (const p of prefikser) {
        const r = await hent(`${ENHETER}?naeringskode=${encodeURIComponent(p)}&fraAntallAnsatte=50&size=${per}`);
        if (!r.ok) { tell(`enhetsregister_${r.status}`); continue; }
        const b = ((await r.json())?._embedded?.enheter ?? []) as Record<string, unknown>[];
        for (const e of b) {
          const o = String(e['organisasjonsnummer']);
          if (!sett.has(o)) { sett.add(o); enheter.push(e); }
        }
      }
      logg.push(`${enheter.length} store enheter`);
      const { rader, snap } = await byggRader(enheter);
      if (dry) return svar({ dry: true, logg, eksempel: rader.slice(0, 3) });
      for (let i = 0; i < rader.length; i += 500) await upsert('companies', 'org_nr', rader.slice(i, i + 500));
      for (let i = 0; i < snap.length; i += 500) await upsert('companies_snapshot', 'org_nr,regnskapsar,hentet_dato', snap.slice(i, i + 500));
      return svar({ ok: true, logg, neste_fra: fra + antall, flere: true });
    }
```

`byggRader` er dagens løkkekropp uendret, returnerer `{ rader, snap }`.
Oppdater fil-headeren med de to nye modusene.

- [ ] **Step 3: Deploy, dry-run, kjør**

Deploy som `import-brreg` (v3). Dry-run `?stor=1&dry=1&fra=0&antall=3&per=10`
— forventer store, gjenkjennelige selskapsnavn i eksemplene. Kjør deretter
alle prefiks-skiver (`antall=3`, `per=25`), så `?brands=1`. Verifiser:

```sql
select navn, omsetning/1e6 oms_mnok, ansatte from companies
where data_quality='brreg' order by omsetning desc nulls last limit 15;
select count(*) from brand_liste(null) where omsetning is not null;
```

Forventet: gjenkjennelige navn på topp (milliardomsetninger), og de fleste
brands med tall.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/import-brreg/index.ts supabase/seed/kategorier.sql
git commit -m "import-brreg: målrettet henting av store selskaper og kjedeselskapene"
```

---

## Task 7: Utrulling av kategorilaget til livebasen

Ingen nye filer — dette er ren drift, i denne rekkefølgen (0014 må inn før
task 6 kan kjøre `?stor=1` live; kjør derfor gjerne task 7 step 1–3 rett
etter task 4):

- [ ] **Step 1: Migrasjoner live**

`apply_migration` med innholdet i 0014 (navn `kategorier`) og 0015 (navn
`topplister`).

- [ ] **Step 2: Kuratert-flagg og Gullsmed-retting live**

```sql
update industries set common_name='Gullsmed', name='Butikkhandel med gull- og sølvvarer',
  slug='gullsmed', search_terms=ARRAY['gullsmed','butikkhandel'] where nace_code='47.772';
update industries set common_name='Optiker', name='Butikkhandel med optiske artikler',
  slug='optiker', search_terms=ARRAY['optiker','butikkhandel'] where nace_code='47.782';
update industries set kuratert = true where nace_code in (
  select nace_code from category_members where kilde = 'ssb');
```

(Siste update kjøres ETTER step 3 — den trenger category_members.)

- [ ] **Step 3: Kategoriseed live**

Kjør hele `supabase/seed/kategorier.sql` via `execute_sql` (fila er liten
nok for ett kall), inkludert brand-orgnr-oppdateringene fra task 6.

- [ ] **Step 4: Verifiser med ekte tall**

```sql
select slug, ar, n_bedrifter, omsetning_total/1e9 oms_mrd, driftsmargin_pct,
  vekst_cagr_pct from kategori_oversikt() order by sortering;
select * from kategori_rangering('driftsmargin','desc',5);
select rang, navn, omsetning/1e6 oms_mnok from topp_selskaper('treningssenter', null, 'omsetning', 5);
```

Forventet: alle 30 kategorier med tall (ar=2024 eller 2023), margintoppen
ser rimelig ut (tannlege/frisør høyt, dagligvare/elektronikk lavt), og
treningssentertoppen har gjenkjennelige navn. Kategorier uten tall her er
en kodefeil i medlemslisten — finn dem med:

```sql
select slug from kategori_oversikt() where ar is null;
```

- [ ] **Step 5: Sikkerhets- og ytelsessjekk**

`get_advisors` security + performance. Forventet: ingen nye ERROR-funn
(RLS er på de nye tabellene; funksjonene er ikke security definer).

---

## Task 8: Spec-justering, CLAUDE.md og dokumentasjon

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-folkelig-kategorilag-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rett spec-ens §5 om 13701**

Erstatt setningen som lover overlevelse fra 13701 med: «13701 har ingen
næringsdimensjon og kan derfor ikke fylle tabellen per næring;
overlevelseskolonnene forblir null i ssb-radene, og UI-et viser dem ikke.»

- [ ] **Step 2: Oppdater CLAUDE.md**

I tabellen «Hvor ting står»: legg til rad for kategorilaget
(`supabase/seed/kategorier.sql` + migrasjon 0014/0015). I «Invarianter»:
nytt punkt — «Kategorimedlemmer overlapper aldri hierarkisk innen kategori
og kilde; kilde='ssb' er SN2007 for statistikk, kilde='brreg' er
SN2025-prefikser for selskapsmatching. Testen i tests/categories.test.ts
håndhever begge.» I «Status»: demografi er nå ekte (08076/07165),
overlevelse fortsatt null; companies utvidet med store selskaper og
kjedeselskaper; 15 migrasjoner.

- [ ] **Step 3: Full QA og commit**

Kjør: `npm test && npx tsc --noEmit` — alt grønt.

```bash
git add -A
git commit -m "Kategorilag utrullet: spec-justering og CLAUDE.md-status"
git push -u origin claude/ruflo-repo-setup-5e2xew
```

---

## Task 9: Lovable-omleggingen

**Files:** ingen i repoet — `mcp__Lovable__send_message` mot prosjekt
`5bab9b75-aa19-4f9b-b7db-1472ffd79523`, deretter verifikasjon.

- [ ] **Step 1: Send omleggingsmeldingen**

Send (norsk, som de andre Lovable-meldingene) — hovedinnhold:

> Forsiden legges helt om. Filtermenyen skal IKKE lenger være inngangen —
> den flyttes til en egen rute /avansert med en diskret lenke i footeren,
> merket «Avansert». Ny forside, ovenfra og ned:
>
> 1. Hero: overskriften «Hva vurderer du å starte?» med søkefelt som
>    matcher kategorinavn (RPC `kategori_oversikt`, filtrer klientside).
>    Under: tre kontrastkort med høyeste/laveste driftsmargin fra
>    `kategori_rangering('driftsmargin','desc',1)` og (…,'asc',1) pluss
>    størst vekst (`'vekst','desc',1`).
> 2. Seks «verdener» med kategorikort: kall `kategori_oversikt()` én gang,
>    grupper på `verden`. Hvert kort: ikon (lucide-navnet i `ikon`), navn,
>    antall bedrifter, driftsmargin, og sparkline av `serie`
>    (omsetning per år). Kortfargen er `farge`. Kort uten tall (ar null)
>    utelates. Klikk går til kategoriside /kategori/<slug>.
> 3. Topplister: «Høyest margin i Norge» og «Lavest margin i Norge»
>    (`kategori_rangering`), «Topp 5 treningssentre i Norge»
>    (`topp_selskaper('treningssenter', null, 'omsetning', 5)`), og en
>    fylkesvelger (regions-tabellen, level='fylke', gjeldende årgang) som
>    bytter selskapslistene til fylket. Rangnummer stort til venstre,
>    selskapsnavn, omsetning i mill. kr, margin med retningsfarge,
>    ansatte, og regnskapsår i grå tekst — selskaper har ETT regnskapsår,
>    aldri en tidsserie-graf.
> 4. Kjedestripe: `brand_liste(null)` — «Kjenner du igjen disse?» med navn,
>    kategori-chip i kategorifargen, omsetning og margin der tall finnes,
>    merknaden som tooltip («tall = hovedselskapets regnskap»).
>
> Kategorisiden /kategori/<slug>: nøkkeltall + sparklineserie fra
> `kategori_oversikt`, «Største aktører» fra `topp_selskaper(slug)`,
> kjeder i kategorien fra `brand_liste(slug)`, og etableringer/konkurser
> fra industry_demography KUN der data_quality='ssb' (vis feltet ikke i
> det hele tatt ellers).
>
> Visuelt: tallbårent og proft — børs/sport, ikke brosjyre. Tabular-lining
> på alle tall, sparklines, grønn/rød retningsfarge, årstall ved hvert
> tall. Ingen «LIVE», «sanntid» eller «oppdatert daglig» noe sted —
> kildelinjen er «Kilde: SSB strukturstatistikk 2017–2024 · Brreg».

- [ ] **Step 2: Verifiser**

Følg opp med `get_diff`/`list_messages`, sjekk at RPC-kallene bruker
funksjonsnavnene riktig (PostgREST: `POST /rest/v1/rpc/kategori_oversikt`),
og at forsiden ikke lenger starter i filteret. Iterér med korte meldinger
til det stemmer.

---

## Selvgjennomgang (kjørt under skrivingen)

- **Spec-dekning:** §2 oppdelingen → task 2–3; §3 tallbildet → task 4
  (oversikt/vekst/serie) og task 5 (etableringer); §4 datamodell → task 1,
  3, 4; §5 demografi → task 5 (med 13701-korreksjon i task 8); §6 målrettet
  henting → task 6; §7 forside/premium → task 9 (avansert-ruten er
  premium-grensen, gating håndheves ikke i v1 — som spec-en sier); §8
  testing → task 1, 3, 4; §9 rekkefølge → tasklistens orden.
- **Typekonsistens:** `kategori_oversikt()`-kolonnene (`slug, …, ar,
  n_bedrifter, omsetning_total, …, serie`) matcher bruken i
  `kategori_rangering` og testene; `topp_selskaper` returnerer
  `driftsmargin_pct` som testene og Lovable-meldingen bruker.
- **Kjente usikkerheter, håndtert eksplisitt:** SN2025-prefiksene (task 6
  step 1 verifiserer og bytter), 08076/07165-dimensjonene (task 5 step 1),
  seed-treets profilnavn (task 2 step 2 sjekker config.ts), navnene på
  nye SSB-koder (task 2 step 1 grunner mot livebasen).
