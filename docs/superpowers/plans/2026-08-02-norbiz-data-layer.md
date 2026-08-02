# Norbiz datalag — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg det endelige Supabase-skjemaet for Business Insight Norway, med
syntetisk seed som har samme form som ekte data, et scoring-view, og
overleveringsartefaktene Lovable trenger for å bygge frontend mot basen.

**Architecture:** SQL-migrasjoner er sannheten. En deterministisk
TypeScript-generator produserer `seed.sql` som ren tekst, slik at seed-en er
diffbar og reproduserbar i stedet for å være en engangskjøring mot en base.
Alt testes mot PGlite — Postgres kompilert til WASM — så testene kjører uten
databaseserver. Edge functions legges inn som dokumenterte stubber; de fylles
når API-formene er verifisert.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, Vitest, `@electric-sql/pglite`,
`psql` for å applisere seed.

**Scope:** Kun datalaget. Frontend bygges av Lovables agent mot denne basen og
får sin egen plan.

**Spec:** `docs/superpowers/specs/2026-08-02-norbiz-design.md`

---

## Filstruktur

| Fil | Ansvar |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | verktøykjede |
| `supabase/migrations/0001_enums.sql` | de fem enumene |
| `supabase/migrations/0002_reference.sql` | `industries`, `regions`, `region_population` |
| `supabase/migrations/0003_statistics.sql` | `industry_stats`, `industry_demography` |
| `supabase/migrations/0004_companies.sql` | `companies` |
| `supabase/migrations/0005_ai.sql` | `industry_estimates`, `ai_insights`, `ai_reports` |
| `supabase/migrations/0006_scoring.sql` | `score_weights`, `score_config`, scoring-view, `industry_scores` |
| `supabase/migrations/0007_rls.sql` | `favorites`, RLS, offentlig lesetilgang |
| `tests/helpers/db.ts` | PGlite-instans med migrasjoner applisert |
| `tests/schema.test.ts` | constraints og enums |
| `tests/scoring.test.ts` | scoring-viewet |
| `tests/seed.test.ts` | generatorens invarianter |
| `seed/rng.ts` | deterministisk PRNG |
| `seed/config.ts` | 60 NACE-koder, bransjeprofiler, fylkesårganger |
| `seed/industries.ts` | hierarkiet |
| `seed/regions.ts` | årganger og folketall |
| `seed/stats.ts` | `industry_stats` og `industry_demography` |
| `seed/companies.ts` | `companies` |
| `seed/ai.ts` | `industry_estimates` og `ai_insights` |
| `seed/emit.ts` | rader → SQL-tekst |
| `seed/index.ts` | CLI, skriver `supabase/seed/seed.sql` |
| `supabase/functions/*/index.ts` | fire dokumenterte stubber |
| `lovable/knowledge.md`, `lovable/messages/*.md` | overlevering |

Migrasjonene er delt etter hva som endres sammen, ikke etter teknisk lag. En
endring i statistikkmodellen treffer `0003`, ikke sju filer.

---

## Task 1: Verktøykjede og PGlite-testhjelper

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `tests/helpers/db.ts`
- Create: `supabase/migrations/0001_enums.sql`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Opprett package.json**

```json
{
  "name": "norbiz-data",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "seed:build": "tsx seed/index.ts",
    "seed:apply": "psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f supabase/seed/seed.sql"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.5.4",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Opprett tsconfig.json og vitest.config.ts**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["seed/**/*.ts", "tests/**/*.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Opprett .gitignore**

```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 4: Installer avhengigheter**

Run: `npm install`
Expected: `added N packages`, ingen feil.

- [ ] **Step 5: Skriv testhjelperen**

`tests/helpers/db.ts`:

```ts
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/** Fersk in-memory Postgres med alle migrasjoner applisert i filnavnrekkefølge. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migrasjon ${file} feilet: ${(err as Error).message}`);
    }
  }
  return db;
}

/** Kjører SQL og returnerer true hvis den feilet med forventet constraint-navn. */
export async function rejects(db: PGlite, sql: string, constraint: string): Promise<boolean> {
  try {
    await db.exec(sql);
    return false;
  } catch (err) {
    return (err as Error).message.includes(constraint);
  }
}
```

- [ ] **Step 6: Skriv den feilende testen for enums**

`tests/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/db.js';

describe('enums', () => {
  it('definerer de fem enumene med riktige verdier', async () => {
    const db = await freshDb();
    const res = await db.query<{ typname: string; labels: string[] }>(`
      select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      group by t.typname
      order by t.typname
    `);
    const byName = Object.fromEntries(res.rows.map((r) => [r.typname, r.labels]));

    expect(byName['data_quality']).toEqual(['mock', 'ssb', 'brreg', 'beregnet', 'ai_anslag']);
    expect(byName['region_level']).toEqual(['land', 'fylke', 'kommune']);
    expect(byName['unit_type']).toEqual(['foretak', 'virksomhet']);
    expect(byName['coverage']).toEqual(['alle', 'as_only']);
    expect(byName['konfidens']).toEqual(['lav', 'middels', 'hoy']);
    await db.close();
  });
});
```

- [ ] **Step 7: Kjør testen og bekreft at den feiler**

Run: `npm test`
Expected: FAIL. `freshDb` finner ingen migrasjonsmappe, eller `byName['data_quality']` er `undefined`.

- [ ] **Step 8: Skriv enum-migrasjonen**

`supabase/migrations/0001_enums.sql`:

```sql
-- Provenienshierarkiet. Se spec seksjon 1: målt, utledet, anslått.
create type data_quality as enum ('mock', 'ssb', 'brreg', 'beregnet', 'ai_anslag');

create type region_level as enum ('land', 'fylke', 'kommune');

-- SSB publiserer nasjonalt for både foretak og virksomheter, regionalt kun for
-- virksomheter. En frisørkjede er ett foretak og ti virksomheter.
create type unit_type as enum ('foretak', 'virksomhet');

-- ENK leverer ikke årsregnskap. En as_only-rad skal aldri sammenlignes
-- ufiltrert med en alle-rad.
create type coverage as enum ('alle', 'as_only');

-- Kun meningsfull for data_quality = 'ai_anslag'.
create type konfidens as enum ('lav', 'middels', 'hoy');
```

- [ ] **Step 9: Kjør testen og bekreft at den passerer**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore tests supabase
git commit -m "feat(db): add enum types and PGlite test harness"
```

---

## Task 2: Referansetabeller — industries, regions, region_population

**Files:**
- Create: `supabase/migrations/0002_reference.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Skriv de feilende testene**

Legg til i `tests/schema.test.ts`:

```ts
describe('industries', () => {
  it('håndhever nace_level 1-5 og selvrefererende hierarki', async () => {
    const db = await freshDb();
    await db.exec(`
      insert into industries (nace_code, nace_level, name, common_name, slug)
      values ('96', 2, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'personlig-tjenesteyting');
    `);
    await db.exec(`
      insert into industries (nace_code, nace_level, parent_code, name, common_name, slug)
      values ('96.021', 5, '96', 'Frisering', 'Frisørsalong', 'frisorsalong');
    `);
    const n = await db.query<{ count: string }>(`select count(*) from industries`);
    expect(n.rows[0]!.count).toBe('2');

    const badLevel = await rejects(
      db,
      `insert into industries (nace_code, nace_level, name, common_name, slug)
       values ('99', 7, 'x', 'x', 'x')`,
      'industries_nace_level_check',
    );
    expect(badLevel).toBe(true);

    const badParent = await rejects(
      db,
      `insert into industries (nace_code, nace_level, parent_code, name, common_name, slug)
       values ('55.101', 5, 'finnes-ikke', 'x', 'x', 'x')`,
      'industries_parent_code_fkey',
    );
    expect(badParent).toBe(true);
    await db.close();
  });
});

describe('regions', () => {
  it('tillater samme kode i flere årganger, men ikke duplikat årgang', async () => {
    const db = await freshDb();
    await db.exec(`
      insert into regions (code, name, level, valid_from_year, valid_to_year) values
        ('0', 'Norge', 'land', 2017, null),
        ('46', 'Vestland', 'fylke', 2020, 2023),
        ('46', 'Vestland', 'fylke', 2024, null);
    `);
    const n = await db.query<{ count: string }>(`select count(*) from regions`);
    expect(n.rows[0]!.count).toBe('3');

    const dup = await rejects(
      db,
      `insert into regions (code, name, level, valid_from_year)
       values ('46', 'Vestland', 'fylke', 2024)`,
      'regions_code_valid_from_year_key',
    );
    expect(dup).toBe(true);
    await db.close();
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `relation "industries" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

`supabase/migrations/0002_reference.sql`:

```sql
-- Hierarkiet må være komplett: hvert femsifret kodepunkt trenger sine 3- og
-- 2-siffer-forfedre, fordi regionale rader kun finnes på nivå 2-3.
create table industries (
  id           uuid primary key default gen_random_uuid(),
  nace_code    text not null unique,
  nace_level   int  not null check (nace_level between 1 and 5),
  parent_code  text references industries (nace_code),
  name         text not null,
  common_name  text not null,
  slug         text not null unique,
  description  text,
  search_terms text[] not null default '{}'
);

create index industries_parent_code_idx on industries (parent_code);
create index industries_nace_level_idx on industries (nace_level);
create index industries_search_terms_idx on industries using gin (search_terms);

-- Fylkesinndelingen endret seg i 2020 (19 -> 11) og 2024 (11 -> 15). Uten
-- årgangsfelt blir en tidsserie per fylke stille feil.
create table regions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  level           region_level not null,
  parent_code     text,
  valid_from_year int not null,
  valid_to_year   int,
  unique (code, valid_from_year),
  constraint regions_valid_range check (valid_to_year is null or valid_to_year >= valid_from_year)
);

create index regions_level_idx on regions (level);

-- Konkurransescoren trenger folketall per region og år.
create table region_population (
  region_id    uuid not null references regions (id) on delete cascade,
  year         int  not null,
  innbyggere   int  not null check (innbyggere >= 0),
  source       text not null,
  data_quality data_quality not null,
  primary key (region_id, year)
);
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 3 tester.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_reference.sql tests/schema.test.ts
git commit -m "feat(db): add industries, regions with vintages, and region_population"
```

---

## Task 3: Statistikktabellene og granularitetsregelen

Dette er den viktigste constrainten i hele skjemaet. Se spec 2.1: SSB
publiserer regionale næringstall kun på 2- og 3-siffer NACE.

**Files:**
- Create: `supabase/migrations/0003_statistics.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

Legg til i `tests/schema.test.ts`:

```ts
async function seedRefs(db: Awaited<ReturnType<typeof freshDb>>) {
  await db.exec(`
    insert into industries (nace_code, nace_level, name, common_name, slug) values
      ('96',    2, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'pt'),
      ('96.0',  3, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'pt3'),
      ('96.021',5, 'Frisering', 'Frisørsalong', 'frisorsalong');
    insert into regions (code, name, level, valid_from_year) values
      ('0',  'Norge', 'land',  2017),
      ('03', 'Oslo',  'fylke', 2020);
  `);
}

const ID = (t: string, w: string) => `(select id from ${t} where ${w})`;

describe('industry_stats', () => {
  it('tillater nasjonale rader på nivå 5', async () => {
    const db = await freshDb();
    await seedRefs(db);
    await db.exec(`
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'foretak', 5, 'land', 3200, 6100000000, 'SSB:12910', 'ssb', 'alle');
    `);
    const n = await db.query<{ count: string }>(`select count(*) from industry_stats`);
    expect(n.rows[0]!.count).toBe('1');
    await db.close();
  });

  it('avviser regionale rader på nivå 4 og 5', async () => {
    const db = await freshDb();
    await seedRefs(db);
    const blocked = await rejects(
      db,
      `insert into industry_stats
         (industry_id, region_id, year, unit_type, nace_level, region_level,
          n_enheter, omsetning_total, source, data_quality, coverage)
       values
         (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='03'`)},
          2023, 'virksomhet', 5, 'fylke', 410, 780000000, 'SSB:12936', 'ssb', 'alle')`,
      'industry_stats_regional_grain',
    );
    expect(blocked).toBe(true);
    await db.close();
  });

  it('tillater regionale rader på nivå 3', async () => {
    const db = await freshDb();
    await seedRefs(db);
    await db.exec(`
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, driftsresultat_total, driftsmargin_pct,
         source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='03'`)},
         2023, 'virksomhet', 3, 'fylke', 410, 780000000, null, null,
         'SSB:12936', 'ssb', 'alle');
    `);
    const r = await db.query<{ driftsmargin_pct: number | null }>(
      `select driftsmargin_pct from industry_stats`,
    );
    expect(r.rows[0]!.driftsmargin_pct).toBeNull();
    await db.close();
  });

  it('avviser duplikat på (industry, region, year, unit_type)', async () => {
    const db = await freshDb();
    await seedRefs(db);
    const ins = `
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'foretak', 5, 'land', 3200, 6100000000, 'SSB:12910', 'ssb', 'alle')`;
    await db.exec(ins);
    const dup = await rejects(db, ins, 'industry_stats_natural_key');
    expect(dup).toBe(true);
    await db.close();
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `relation "industry_stats" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

`supabase/migrations/0003_statistics.sql`:

```sql
-- nace_level og region_level er bevisst denormalisert fra industries/regions.
-- Uten dem kan ikke granularitetsregelen uttrykkes deklarativt, og
-- scoring-viewet må joine for å finne peer-gruppen.
create table industry_stats (
  id                          uuid primary key default gen_random_uuid(),
  industry_id                 uuid not null references industries (id) on delete cascade,
  region_id                   uuid not null references regions (id) on delete cascade,
  year                        int  not null,
  unit_type                   unit_type not null,
  nace_level                  int  not null check (nace_level between 1 and 5),
  region_level                region_level not null,

  n_enheter                   int,
  omsetning_total             bigint,
  omsetning_per_enhet         bigint,
  driftsresultat_total        bigint,
  driftsmargin_pct            numeric(6, 2),
  lonnskostnad_total          bigint,
  lonnsandel_pct              numeric(6, 2),
  sysselsatte_total           int,
  sysselsatte_per_enhet       numeric(10, 2),
  arsverk_per_enhet           numeric(10, 2),
  bearbeidingsverdi_total     bigint,
  verdiskaping_per_sysselsatt bigint,
  bruttoinvestering_total     bigint,

  source                      text not null,
  data_quality                data_quality not null,
  coverage                    coverage not null,

  constraint industry_stats_natural_key unique (industry_id, region_id, year, unit_type),

  -- Spec 2.1: SSB gir regionale næringstall kun på 2- og 3-siffer.
  constraint industry_stats_regional_grain
    check (region_level = 'land' or nace_level <= 3)
);

create index industry_stats_lookup_idx
  on industry_stats (industry_id, region_id, year);
create index industry_stats_peer_idx
  on industry_stats (region_id, year, nace_level, unit_type);

-- Overlevelsestall fra foretaksdemografi, konkurser fra egen SSB-statistikk.
-- To kilder inn i én tabell, skilt på source.
create table industry_demography (
  id                    uuid primary key default gen_random_uuid(),
  industry_id           uuid not null references industries (id) on delete cascade,
  region_id             uuid not null references regions (id) on delete cascade,
  year                  int  not null,
  nace_level            int  not null check (nace_level between 1 and 5),
  region_level          region_level not null,

  nyetableringer        int,
  nedleggelser          int,
  konkurser             int,
  overlevelse_1ar_pct   numeric(5, 2),
  overlevelse_3ar_pct   numeric(5, 2),
  overlevelse_5ar_pct   numeric(5, 2),

  source                text not null,
  data_quality          data_quality not null,
  coverage              coverage not null,

  constraint industry_demography_natural_key unique (industry_id, region_id, year),
  constraint industry_demography_regional_grain
    check (region_level = 'land' or nace_level <= 3)
);

create index industry_demography_lookup_idx
  on industry_demography (industry_id, region_id, year);
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 7 tester.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_statistics.sql tests/schema.test.ts
git commit -m "feat(db): add industry_stats and industry_demography with granularity constraint"
```

---

## Task 4: companies

**Files:**
- Create: `supabase/migrations/0004_companies.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

```ts
describe('companies', () => {
  it('utleder inngar_i_regnskapssnitt fra organisasjonsform og regnskapsar', async () => {
    const db = await freshDb();
    await db.exec(`
      insert into companies (org_nr, navn, nace_code, kommune_code, organisasjonsform,
                             ansatte, omsetning, driftsresultat, egenkapital, regnskapsar,
                             source, data_quality)
      values
        ('811234567', 'Salong AS',  '96.021', '0301', 'AS',  6, 5200000, 410000, 900000, 2023, 'brreg', 'brreg'),
        ('922345678', 'Salong ENK', '96.021', '0301', 'ENK', 1, null,    null,   null,   null, 'brreg', 'brreg');
    `);
    const r = await db.query<{ org_nr: string; inngar: boolean }>(
      `select org_nr, inngar_i_regnskapssnitt as inngar from companies order by org_nr`,
    );
    expect(r.rows[0]!.inngar).toBe(true);
    expect(r.rows[1]!.inngar).toBe(false);
    await db.close();
  });
});
```

- [ ] **Step 2: Kjør og bekreft at den feiler**

Run: `npm test`
Expected: FAIL med `relation "companies" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

`supabase/migrations/0004_companies.sql`:

```sql
-- Kun siste tilgjengelige regnskapsår. Det åpne Regnskapsregister-API-et gir
-- nøkkeltall fra sist innsendte årsregnskap; tre år finnes bare i den lukkede
-- delen, som krever offentlig myndighet.
create table companies (
  id                uuid primary key default gen_random_uuid(),
  org_nr            text not null unique,
  navn              text not null,
  nace_code         text,
  kommune_code      text,
  organisasjonsform text not null,
  ansatte           int,
  omsetning         bigint,
  driftsresultat    bigint,
  egenkapital       bigint,
  regnskapsar       int,

  -- Gjør ENK-avgrensningen etterprøvbar i basen i stedet for i en UI-tekst.
  inngar_i_regnskapssnitt boolean
    generated always as (
      organisasjonsform in ('AS', 'ASA', 'NUF', 'SA') and regnskapsar is not null
    ) stored,

  source            text not null,
  data_quality      data_quality not null
);

create index companies_nace_code_idx on companies (nace_code);
create index companies_kommune_code_idx on companies (kommune_code);
create index companies_regnskapssnitt_idx
  on companies (nace_code) where inngar_i_regnskapssnitt;
```

- [ ] **Step 4: Kjør og bekreft at den passerer**

Run: `npm test`
Expected: PASS, 8 tester.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_companies.sql tests/schema.test.ts
git commit -m "feat(db): add companies with generated inngar_i_regnskapssnitt"
```

---

## Task 5: Anslag og innsikt

**Files:**
- Create: `supabase/migrations/0005_ai.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Skriv de feilende testene**

```ts
describe('industry_estimates', () => {
  it('krever ai_anslag som data_quality og et ikke-tomt basert_pa', async () => {
    const db = await freshDb();
    await seedRefs(db);
    await db.exec(`
      insert into industry_estimates
        (industry_id, metrikk, intervall_lav, intervall_hoy, enhet, konfidens,
         begrunnelse, basert_pa, model, prompt_version, source, data_quality)
      values
        (${ID('industries', `nace_code='96.021'`)}, 'etableringskapital',
         300000, 800000, 'NOK', 'middels',
         'Utstyr, stolleie og tre måneders drift før positiv kontantstrøm.',
         '[{"table":"industry_stats","year":2023}]'::jsonb,
         'claude', 'v1', 'ai:claude', 'ai_anslag');
    `);

    const wrongQuality = await rejects(
      db,
      `insert into industry_estimates
         (industry_id, metrikk, verdi_num, konfidens, begrunnelse, basert_pa,
          model, prompt_version, source, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, 'x', 1, 'lav', 'y',
               '[{"a":1}]'::jsonb, 'm', 'v1', 's', 'ssb')`,
      'industry_estimates_must_be_estimate',
    );
    expect(wrongQuality).toBe(true);

    const emptyBasis = await rejects(
      db,
      `insert into industry_estimates
         (industry_id, metrikk, verdi_num, konfidens, begrunnelse, basert_pa,
          model, prompt_version, source, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, 'x', 1, 'lav', 'y',
               '[]'::jsonb, 'm', 'v1', 's', 'ai_anslag')`,
      'industry_estimates_basert_pa_nonempty',
    );
    expect(emptyBasis).toBe(true);
    await db.close();
  });
});

describe('ai_insights', () => {
  it('krever ikke-tomme referanser og alvorlighet 1-5', async () => {
    const db = await freshDb();
    await seedRefs(db);
    await db.exec(`
      insert into ai_insights
        (industry_id, region_id, year, type, tittel, body, alvorlighet,
         referanser, knyttet_til, model, prompt_version, data_quality)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'avvik', 'Marginen faller mens antall foretak øker',
         'Driftsmarginen har falt tre år på rad samtidig som antall foretak har økt.',
         4, '[{"table":"industry_stats","field":"driftsmargin_pct"}]'::jsonb,
         'driftsmargin', 'claude', 'v1', 'ai_anslag');
    `);

    const badSeverity = await rejects(
      db,
      `insert into ai_insights
         (industry_id, region_id, type, tittel, body, alvorlighet, referanser,
          model, prompt_version, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='0'`)},
               'risiko', 't', 'b', 9, '[{"a":1}]'::jsonb, 'm', 'v1', 'ai_anslag')`,
      'ai_insights_alvorlighet_check',
    );
    expect(badSeverity).toBe(true);

    const noRefs = await rejects(
      db,
      `insert into ai_insights
         (industry_id, region_id, type, tittel, body, alvorlighet, referanser,
          model, prompt_version, data_quality)
       values (${ID('industries', `nace_code='96.0'`)}, ${ID('regions', `code='0'`)},
               'risiko', 't', 'b', 3, '[]'::jsonb, 'm', 'v1', 'ai_anslag')`,
      'ai_insights_referanser_nonempty',
    );
    expect(noRefs).toBe(true);
    await db.close();
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `relation "industry_estimates" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

`supabase/migrations/0005_ai.sql`:

```sql
-- Egen tabell, ikke kolonner i industry_stats: den må kunne reimporteres fra
-- SSB idempotent uten at importen stryker anslagene.
create table industry_estimates (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid references regions (id) on delete cascade,
  metrikk        text not null,

  verdi_num      numeric,
  verdi_tekst    text,
  enhet          text,
  intervall_lav  numeric,
  intervall_hoy  numeric,

  konfidens      konfidens not null,
  begrunnelse    text not null,

  -- Det som skiller et anslag fra en gjetning: hvilke faktiske rader det hviler på.
  basert_pa      jsonb not null,

  model          text not null,
  prompt_version text not null,
  generated_at   timestamptz not null default now(),
  source         text not null,
  data_quality   data_quality not null,

  constraint industry_estimates_natural_key unique (industry_id, region_id, metrikk),
  constraint industry_estimates_must_be_estimate check (data_quality = 'ai_anslag'),
  constraint industry_estimates_basert_pa_nonempty check (jsonb_array_length(basert_pa) > 0),
  constraint industry_estimates_has_value
    check (verdi_num is not null or verdi_tekst is not null or intervall_lav is not null),
  constraint industry_estimates_interval_order
    check (intervall_lav is null or intervall_hoy is null or intervall_hoy >= intervall_lav)
);

create index industry_estimates_lookup_idx on industry_estimates (industry_id, metrikk);

-- Kort, forankret innsikt som vises ved siden av KPI-en den handler om.
create table ai_insights (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid not null references regions (id) on delete cascade,
  year           int,
  type           text not null
    check (type in ('risiko', 'mulighet', 'avvik', 'sammenligning', 'kontekst')),
  tittel         text not null,
  body           text not null,
  alvorlighet    int not null,
  referanser     jsonb not null,
  knyttet_til    text,

  model          text not null,
  prompt_version text not null,
  generated_at   timestamptz not null default now(),
  data_quality   data_quality not null,

  constraint ai_insights_alvorlighet_check check (alvorlighet between 1 and 5),
  constraint ai_insights_referanser_nonempty check (jsonb_array_length(referanser) > 0)
);

create index ai_insights_lookup_idx
  on ai_insights (industry_id, region_id, alvorlighet desc);

-- Den lange, sammenhengende rapporten. ai_insights er det korte laget.
create table ai_reports (
  id             uuid primary key default gen_random_uuid(),
  industry_id    uuid not null references industries (id) on delete cascade,
  region_id      uuid not null references regions (id) on delete cascade,
  body           text not null,
  generated_at   timestamptz not null default now(),
  model          text not null,
  prompt_version text not null,
  unique (industry_id, region_id, prompt_version)
);
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 10 tester.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_ai.sql tests/schema.test.ts
git commit -m "feat(db): add industry_estimates, ai_insights and ai_reports"
```

---

Planen fortsetter med Task 6 (scoring-view), Task 7 (RLS), Task 8-13
(seed-generatoren), Task 14 (edge function-stubber) og Task 15
(Lovable-overlevering).
