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
| `supabase/migrations/0001_enums.sql` | de seks enumene |
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
  it('definerer de seks enumene med riktige verdier', async () => {
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
    expect(byName['mangel_arsak']).toEqual([
      'ikke_publisert', 'konfidensielt', 'ikke_relevant', 'kommer_senere', 'brudd',
    ]);
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

-- NULL er fem forskjellige svar. SSB bruker standardtegn: '.' ikke relevant,
-- '..' oppgave mangler, ':' kommer senere, pluss undertrykking av hensyn til
-- konfidensialitet. Et undertrykt tall er ikke det samme som et upublisert.
create type mangel_arsak as enum
  ('ikke_publisert', 'konfidensielt', 'ikke_relevant', 'kommer_senere', 'brudd');
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

  -- Felt -> mangel_arsak, f.eks. {"driftsmargin_pct": "konfidensielt"}.
  merknader                   jsonb not null default '{}'::jsonb,

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

  merknader             jsonb not null default '{}'::jsonb,

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

## Task 6: Scoring — vekter, view og materialisert tabell

Den mest sammensatte SQL-en i skjemaet. Persentilrangering skjer innenfor
peer-gruppen `(region_id, year, nace_level, unit_type)` — uten `nace_level`
rangeres 96.021 mot aggregatet 96.0, og alle femsifrede næringer havner i
midten. Spec 4: anslag fra `industry_estimates` inngår aldri her.

**Files:**
- Create: `supabase/migrations/0006_scoring.sql`
- Test: `tests/scoring.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

`tests/scoring.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './helpers/db.js';

/** Fire næringer med kjente marginer, to årganger, folketall for alle år. */
async function seedScoring(db: PGlite) {
  await db.exec(`
    insert into industries (nace_code, nace_level, name, common_name, slug) values
      ('96.021', 5, 'Frisering',      'Frisørsalong',   'frisorsalong'),
      ('56.101', 5, 'Restaurant',     'Restaurant',     'restaurant'),
      ('69.201', 5, 'Regnskap',       'Regnskapsfører', 'regnskapsforer'),
      ('93.130', 5, 'Treningssenter', 'Treningssenter', 'treningssenter');
    insert into regions (code, name, level, valid_from_year)
      values ('0', 'Norge', 'land', 2017);
    insert into region_population (region_id, year, innbyggere, source, data_quality)
      select id, y, 5500000, 'SSB', 'ssb' from regions, generate_series(2020, 2023) y;
  `);

  const margins: Record<string, number> = {
    '96.021': 11.2, '56.101': 3.1, '69.201': 22.5, '93.130': 7.4,
  };
  for (const [code, margin] of Object.entries(margins)) {
    for (const [year, mult] of [[2020, 0.8], [2023, 1.0]] as const) {
      await db.exec(`
        insert into industry_stats
          (industry_id, region_id, year, unit_type, nace_level, region_level,
           n_enheter, omsetning_total, driftsresultat_total, driftsmargin_pct,
           sysselsatte_total, bruttoinvestering_total, source, data_quality, coverage)
        values
          ((select id from industries where nace_code = '${code}'),
           (select id from regions where code = '0'),
           ${year}, 'foretak', 5, 'land',
           ${Math.round(500 * mult)}, ${Math.round(1e9 * mult)}, ${Math.round(1e8 * mult)},
           ${margin * mult}, ${Math.round(4000 * mult)}, ${Math.round(5e7 * mult)},
           'SSB:12910', 'ssb', 'alle');
      `);
    }
  }

  // Demografi kun for to av fire, så risiko blir NULL for de andre to.
  for (const [code, konkurser, overlevelse] of [
    ['96.021', 12, 61], ['56.101', 40, 38],
  ] as const) {
    await db.exec(`
      insert into industry_demography
        (industry_id, region_id, year, nace_level, region_level,
         konkurser, overlevelse_5ar_pct, source, data_quality, coverage)
      values
        ((select id from industries where nace_code = '${code}'),
         (select id from regions where code = '0'),
         2023, 5, 'land', ${konkurser}, ${overlevelse}, 'SSB', 'ssb', 'alle');
    `);
  }
}

describe('industry_scores_computed', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb();
    await seedScoring(db);
  });

  it('rangerer lønnsomhet etter driftsmargin', async () => {
    const r = await db.query<{ common_name: string; score_lonnsomhet: number }>(`
      select i.common_name, s.score_lonnsomhet
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023
      order by s.score_lonnsomhet desc
    `);
    expect(r.rows.map((x) => x.common_name)).toEqual([
      'Regnskapsfører', 'Frisørsalong', 'Treningssenter', 'Restaurant',
    ]);
    // Midtrangert persentil: fire distinkte verdier gir 13 / 38 / 63 / 88.
    expect(r.rows.map((x) => x.score_lonnsomhet)).toEqual([88, 63, 38, 13]);
  });

  it('gir uavgjort midtpunktet, ikke bunnen', async () => {
    // Alle fire vokste like mye, så alle skal ha 50.
    const r = await db.query<{ score_vekst: number }>(
      `select score_vekst from industry_scores_computed where year = 2023`,
    );
    expect(r.rows.every((x) => x.score_vekst === 50)).toBe(true);
  });

  it('lar delscorer uten datagrunnlag være NULL og renormaliserer totalen', async () => {
    const r = await db.query<{ score_risiko: number | null; score_total: number }>(`
      select s.score_risiko, s.score_total
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023 and i.nace_code = '69.201'
    `);
    expect(r.rows[0]!.score_risiko).toBeNull();
    // Totalen finnes likevel, regnet over de delscorene som har data.
    expect(r.rows[0]!.score_total).toBeGreaterThan(0);
  });

  it('legger råtall, persentil og vekt i forklaring', async () => {
    const r = await db.query<{ fl: { raw: string; pct: number; vekt: string } }>(`
      select forklaring->'lonnsomhet' as fl
      from industry_scores_computed s
      join industries i on i.id = s.industry_id
      where s.year = 2023 and i.nace_code = '69.201'
    `);
    expect(Number(r.rows[0]!.fl.raw)).toBe(22.5);
    expect(r.rows[0]!.fl.pct).toBe(88);
  });

  it('utelater næringer under min_enheter', async () => {
    await db.exec(`update score_config set min_enheter = 100000`);
    const r = await db.query<{ count: string }>(
      `select count(*) from industry_scores_computed`,
    );
    expect(r.rows[0]!.count).toBe('0');
    await db.exec(`update score_config set min_enheter = 20`);
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `relation "industry_scores_computed" does not exist`.

- [ ] **Step 3: Skriv migrasjonen**

`supabase/migrations/0006_scoring.sql`:

```sql
create table score_weights (
  delscore text primary key,
  vekt     numeric not null check (vekt > 0)
);

insert into score_weights (delscore, vekt) values
  ('lonnsomhet', 1.0), ('vekst', 1.0), ('risiko', 1.0),
  ('konkurranse', 0.8), ('kapitalbehov', 0.6), ('ettersporsel', 1.0);

create table score_config (
  id          boolean primary key default true check (id),
  min_enheter int not null default 20
);
insert into score_config (id, min_enheter) values (true, 20);

create view score_raw as
select
  s.industry_id, s.region_id, s.year, s.nace_level, s.region_level, s.unit_type,
  s.n_enheter,
  s.driftsmargin_pct as lonnsomhet_raw,
  case when prev.omsetning_total > 0
       then (s.omsetning_total - prev.omsetning_total)::numeric / prev.omsetning_total
  end as vekst_raw,
  case when d.overlevelse_5ar_pct is not null or d.konkurser is not null
       then coalesce(d.overlevelse_5ar_pct, 0)
          - coalesce(d.konkurser::numeric / nullif(s.n_enheter, 0) * 100, 0)
  end as risiko_raw,
  case when pop.innbyggere > 0
       then -(s.n_enheter * 10000.0 / pop.innbyggere)
  end as konkurranse_raw,
  case when s.sysselsatte_total > 0
       then -(s.bruttoinvestering_total::numeric / s.sysselsatte_total)
  end as kapitalbehov_raw,
  (
    select avg(x) from (values
      (case when prev.n_enheter > 0
            then (s.n_enheter - prev.n_enheter)::numeric / prev.n_enheter end),
      (case when prev.sysselsatte_total > 0
            then (s.sysselsatte_total - prev.sysselsatte_total)::numeric / prev.sysselsatte_total end)
    ) as t(x)
  ) as ettersporsel_raw
from industry_stats s
left join industry_stats prev
  on prev.industry_id = s.industry_id and prev.region_id = s.region_id
 and prev.unit_type = s.unit_type and prev.year = s.year - 3
left join industry_demography d
  on d.industry_id = s.industry_id and d.region_id = s.region_id and d.year = s.year
left join region_population pop
  on pop.region_id = s.region_id and pop.year = s.year
cross join score_config cfg
where s.n_enheter >= cfg.min_enheter;

-- Langt format: én rad per delscore. Persentilberegningen skrives da én gang
-- i stedet for seks ganger.
create view score_long as
select
  r.industry_id, r.region_id, r.year, r.nace_level, r.region_level, r.unit_type,
  v.delscore, v.raw
from score_raw r
cross join lateral (values
  ('lonnsomhet',   r.lonnsomhet_raw),
  ('vekst',        r.vekst_raw),
  ('risiko',       r.risiko_raw),
  ('konkurranse',  r.konkurranse_raw),
  ('kapitalbehov', r.kapitalbehov_raw),
  ('ettersporsel', r.ettersporsel_raw)
) as v(delscore, raw);

-- Persentilrangering innenfor peer-gruppen. count(raw) teller kun ikke-NULL,
-- så rader uten datagrunnlag blåser ikke opp nevneren.
create view score_long_pct as
select
  industry_id, region_id, year, nace_level, region_level, unit_type,
  delscore, raw,
  -- Midtrangert persentil: andelen under, pluss halve andelen som ligger likt.
  -- Ren rank() ville gitt alle uavgjorte bunnplassen i stedet for midten.
  case when raw is null then null
       else round(100.0 * ((rank() over wo - 1) + 0.5 * count(raw) over weq)
                  / nullif(count(raw) over wp, 0))::int
  end as pct
from score_long
window
  wo  as (partition by region_id, year, nace_level, unit_type, delscore order by raw),
  wp  as (partition by region_id, year, nace_level, unit_type, delscore),
  weq as (partition by region_id, year, nace_level, unit_type, delscore, raw);

create view industry_scores_computed as
select
  p.industry_id, p.region_id, p.year, p.nace_level, p.region_level, p.unit_type,
  max(p.pct) filter (where p.delscore = 'lonnsomhet')   as score_lonnsomhet,
  max(p.pct) filter (where p.delscore = 'vekst')        as score_vekst,
  max(p.pct) filter (where p.delscore = 'risiko')       as score_risiko,
  max(p.pct) filter (where p.delscore = 'konkurranse')  as score_konkurranse,
  max(p.pct) filter (where p.delscore = 'kapitalbehov') as score_kapitalbehov,
  max(p.pct) filter (where p.delscore = 'ettersporsel') as score_ettersporsel,
  -- Vektet snitt over de delscorene som finnes, med vektene renormalisert.
  round(sum(p.pct * w.vekt) / nullif(sum(w.vekt) filter (where p.pct is not null), 0))::int
    as score_total,
  jsonb_object_agg(
    p.delscore,
    jsonb_build_object('raw', p.raw, 'pct', p.pct, 'vekt', w.vekt)
  ) as forklaring
from score_long_pct p
join score_weights w on w.delscore = p.delscore
group by 1, 2, 3, 4, 5, 6;

-- Materialisert kopi, fylt av compute-scores. Frontend leser denne, ikke viewet.
create table industry_scores (
  industry_id        uuid not null references industries (id) on delete cascade,
  region_id          uuid not null references regions (id) on delete cascade,
  year               int  not null,
  nace_level         int  not null,
  region_level       region_level not null,
  unit_type          unit_type not null,
  score_lonnsomhet   int check (score_lonnsomhet between 0 and 100),
  score_vekst        int check (score_vekst between 0 and 100),
  score_risiko       int check (score_risiko between 0 and 100),
  score_konkurranse  int check (score_konkurranse between 0 and 100),
  score_kapitalbehov int check (score_kapitalbehov between 0 and 100),
  score_ettersporsel int check (score_ettersporsel between 0 and 100),
  score_total        int check (score_total between 0 and 100),
  forklaring         jsonb not null,
  computed_at        timestamptz not null default now(),
  primary key (industry_id, region_id, year, unit_type)
);

create index industry_scores_rank_idx
  on industry_scores (region_id, year, score_total desc);
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 15 tester.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_scoring.sql tests/scoring.test.ts
git commit -m "feat(db): add scoring view with mid-rank percentiles and weight renormalisation"
```

---

Planen fortsetter med Task 7 (RLS), Task 8-13 (seed-generatoren),
Task 14 (edge function-stubber) og Task 15 (Lovable-overlevering).
