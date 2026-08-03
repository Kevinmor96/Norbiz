# Bransjeindeks datalag — implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg det endelige Supabase-skjemaet for Bransjeindeks, med
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

> **Om tellinger:** PGlite returnerer `count(*)` som `number` når verdien er
> innenfor `Number.MAX_SAFE_INTEGER`, mens node-postgres returnerer `string`
> for samme `int8`-type. Testene pakker derfor tellinger i `Number(...)` og
> sammenligner med tall, slik at de er uavhengige av driverens int8-håndtering.

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
    "@types/node": "^22.10.2",
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

/**
 * Kjører SQL og returnerer true hvis den feilet med nøyaktig dette
 * constraint-navnet. Postgres legger navnet i et eget felt på feilen; å lete
 * i feilmeldingsteksten i stedet ville matchet omtrentlig, og navnene her
 * ligner hverandre nok til at det er verdt å være presis.
 */
export async function rejects(db: PGlite, sql: string, constraint: string): Promise<boolean> {
  try {
    await db.exec(sql);
    return false;
  } catch (err) {
    const e = err as { constraint?: string; message?: string };
    if (typeof e.constraint === 'string') return e.constraint === constraint;
    // Enkelte feiltyper bærer ikke feltet; da er teksten det eneste vi har.
    return (e.message ?? '').includes(constraint);
  }
}

let cached: Promise<PGlite> | null = null;

/**
 * Én migrert database per testfil. Vitest kjører hver fil i sin egen worker,
 * så modulnivå-memoisering gir isolasjon mellom filer og gjenbruk innenfor.
 *
 * PGlite.create() tar 2-5 sekunder. Med freshDb() i hver enkelt test ville
 * suiten brukt flere minutter bare på oppstart. Bruk denne når testen kun
 * trenger et rent skjema, og freshDb() når den trenger en urørt instans.
 */
export function sharedDb(): Promise<PGlite> {
  cached ??= freshDb();
  return cached;
}

/**
 * Tømmer data, beholder skjema og konfigurasjon.
 *
 * score_weights og score_config settes inn av migrasjonene og er
 * skjemastandarder, ikke testdata. Å tømme dem ville etterlatt scoringen uten
 * vekter for hver test etter den første.
 */
const CONFIG_TABLES = ['score_weights', 'score_config'];

export async function resetData(db: PGlite): Promise<void> {
  await db.exec(`
    do $$
    declare t text;
    begin
      for t in
        select tablename from pg_tables
        where schemaname = 'public'
          and tablename not in (${CONFIG_TABLES.map((n) => `'${n}'`).join(', ')})
      loop
        execute format('truncate table %I restart identity cascade', t);
      end loop;
    end $$;
  `);
}
```

- [ ] **Step 6: Skriv den feilende testen for enums**

`tests/schema.test.ts`:

```ts
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { sharedDb } from './helpers/db.js';

describe('enums', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await sharedDb();
  });

  it('definerer de seks enumene med riktige verdier', async () => {
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

Testene deler én databaseinstans per fil og nullstiller data mellom hver test.
`PGlite.create()` koster 2-5 sekunder, så en fersk instans per test ville gjort
suiten flere minutter treg; `resetData()` tømmer tabellene på millisekunder.

Utvid toppen av `tests/schema.test.ts` slik at scaffoldet er felles:

```ts
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rejects, resetData, sharedDb } from './helpers/db.js';

let db: PGlite;

beforeAll(async () => {
  db = await sharedDb();
});

beforeEach(async () => {
  await resetData(db);
});
```

Flytt `describe('enums', ...)` ut av sitt eget `beforeAll` og la den bruke den
felles `db`. Legg så til:

```ts
describe('industries', () => {
  it('håndhever nace_level 1-5 og selvrefererende hierarki', async () => {
    await db.exec(`
      insert into industries (nace_code, nace_level, name, common_name, slug)
      values ('96', 2, 'Annen personlig tjenesteyting', 'Personlig tjenesteyting', 'personlig-tjenesteyting');
    `);
    await db.exec(`
      insert into industries (nace_code, nace_level, parent_code, name, common_name, slug)
      values ('96.021', 5, '96', 'Frisering', 'Frisørsalong', 'frisorsalong');
    `);
    const n = await db.query<{ count: number }>(`select count(*) from industries`);
    expect(Number(n.rows[0]!.count)).toBe(2);

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
  });
});

describe('regions', () => {
  it('tillater samme kode i flere årganger, men ikke duplikat årgang', async () => {
    await db.exec(`
      insert into regions (code, name, level, valid_from_year, valid_to_year) values
        ('0', 'Norge', 'land', 2017, null),
        ('46', 'Vestland', 'fylke', 2020, 2023),
        ('46', 'Vestland', 'fylke', 2024, null);
    `);
    const n = await db.query<{ count: number }>(`select count(*) from regions`);
    expect(Number(n.rows[0]!.count)).toBe(3);

    const dup = await rejects(
      db,
      `insert into regions (code, name, level, valid_from_year)
       values ('46', 'Vestland', 'fylke', 2024)`,
      'regions_code_valid_from_year_key',
    );
    expect(dup).toBe(true);
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
async function seedRefs(db: PGlite) {
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
    await seedRefs(db);
    await db.exec(`
      insert into industry_stats
        (industry_id, region_id, year, unit_type, nace_level, region_level,
         n_enheter, omsetning_total, source, data_quality, coverage)
      values
        (${ID('industries', `nace_code='96.021'`)}, ${ID('regions', `code='0'`)},
         2023, 'foretak', 5, 'land', 3200, 6100000000, 'SSB:12910', 'ssb', 'alle');
    `);
    const n = await db.query<{ count: number }>(`select count(*) from industry_stats`);
    expect(Number(n.rows[0]!.count)).toBe(1);
  });

  it('avviser regionale rader på nivå 4 og 5', async () => {
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
  });

  it('tillater regionale rader på nivå 3', async () => {
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
  });

  it('avviser duplikat på (industry, region, year, unit_type)', async () => {
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
  });
});

describe('ai_insights', () => {
  it('krever ikke-tomme referanser og alvorlighet 1-5', async () => {
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
    const r = await db.query<{ count: number }>(
      `select count(*) from industry_scores_computed`,
    );
    expect(Number(r.rows[0]!.count)).toBe(0);
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

## Task 7: RLS og favoritter

Næringssidene er offentlige — ingen innlogging foran dataene. Kun `favorites`
er brukereid.

Migrasjonen bruker `auth.uid()`, som finnes på Supabase men ikke i PGlite.
Stubben hører derfor i testhjelperen, **ikke** i `supabase/migrations/`: en
`create schema auth` i en migrasjon ville kollidert med Supabases eget
auth-schema ved deploy.

**Files:**
- Create: `supabase/migrations/0007_rls.sql`
- Create: `tests/helpers/supabase-stub.sql`
- Modify: `tests/helpers/db.ts`
- Test: `tests/rls.test.ts`

- [ ] **Step 1: Legg inn Supabase-stubben for testmiljøet**

`tests/helpers/supabase-stub.sql`:

```sql
-- Simulerer den delen av Supabase-miljøet migrasjonene lener seg på.
-- Kjøres kun i tester. På ekte Supabase finnes alt dette fra før.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;

-- Ekte Supabase gir disse rollene tilgang til auth-schemaet. Uten dem virker
-- RLS-policyene likevel — policy-uttrykk evalueres med tabelleierens
-- rettigheter — men et direkte kall på auth.uid() fra en test som har byttet
-- rolle feiler med "permission denied for schema auth". Verifisert i PGlite.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
```

- [ ] **Step 2: Kjør stubben før migrasjonene i testhjelperen**

Erstatt `freshDb` i `tests/helpers/db.ts`:

```ts
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const STUB = join(process.cwd(), 'tests', 'helpers', 'supabase-stub.sql');

/** Fersk in-memory Postgres med Supabase-stub og alle migrasjoner applisert. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(await readFile(STUB, 'utf8'));
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

/**
 * Rollebytte er transaksjonsavgrenset. Grunnen er at Postgres ikke lar seg
 * nullstille i ett grep: `reset role` rører ikke `request.jwt.claim.sub`, og
 * `reset all` rører ikke `role`. En håndskrevet opprydding må derfor huske
 * begge, og hoppes uansett over hvis en assertion feiler først.
 *
 * `set local` inne i en transaksjon reverserer begge deler automatisk ved
 * rollback, og `endAct` i en `afterEach` kjører uansett om testen feilet.
 */
export async function actAs(db: PGlite, userId: string): Promise<void> {
  await db.exec(`
    begin;
    set local role authenticated;
    set local request.jwt.claim.sub = '${userId}';
  `);
}

export async function actAsAnon(db: PGlite): Promise<void> {
  await db.exec(`begin; set local role anon;`);
}

/** Avslutter rollebyttet. Skal kalles fra afterEach, ikke fra testen selv. */
export async function endAct(db: PGlite): Promise<void> {
  await db.exec(`rollback;`);
}
```

- [ ] **Step 3: Skriv de feilende testene**

`tests/rls.test.ts`:

```ts
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { actAs, actAsAnon, endAct, resetData, sharedDb } from './helpers/db.js';

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

describe('RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await sharedDb();
  });

  // Rullér tilbake rollebyttet uansett hvordan testen endte. En opprydding
  // på slutten av testen hoppes over når en assertion feiler først, og da
  // lekker rollen og auth.uid() inn i neste test i samme fil.
  afterEach(async () => {
    await endAct(db);
    await resetData(db);
  });

  it('lar en bruker kun se egne favoritter', async () => {
    await db.exec(`
      insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
      insert into industries (nace_code, nace_level, name, common_name, slug)
        values ('96', 2, 'x', 'x', 'pt');
      insert into regions (code, name, level, valid_from_year)
        values ('0', 'Norge', 'land', 2017);
      insert into favorites (user_id, industry_id, region_id) values
        ('${ALICE}', (select id from industries limit 1), (select id from regions limit 1)),
        ('${BOB}',   (select id from industries limit 1), (select id from regions limit 1));
    `);

    await actAs(db, ALICE);
    const mine = await db.query<{ count: number }>(`select count(*) from favorites`);
    expect(Number(mine.rows[0]!.count)).toBe(1);
  });

  it('gir anon lesetilgang til næringsdata uten innlogging', async () => {
    await db.exec(`
      insert into industries (nace_code, nace_level, name, common_name, slug)
        values ('96.021', 5, 'Frisering', 'Frisørsalong', 'frisorsalong');
    `);
    await actAsAnon(db);
    const r = await db.query<{ count: number }>(`select count(*) from industries`);
    expect(Number(r.rows[0]!.count)).toBe(1);
  });

  it('nekter anon tilgang til favoritter i det hele tatt', async () => {
    await actAsAnon(db);
    // Sterkere enn «tom via RLS»: anon har ingen GRANT på tabellen, så
    // spørringen avvises før RLS vurderes. Et lesbart-men-tomt resultat ville
    // vært svakere, siden det avhenger av at policyen er riktig skrevet.
    await expect(db.query(`select count(*) from favorites`)).rejects.toThrow(
      /permission denied for table favorites/,
    );
  });

  it('etterlater ingen brukerkontekst til neste test', async () => {
    // Vokter mot lekkasjen selve mønsteret finnes for å hindre.
    const r = await db.query<{ uid: string | null; who: string }>(
      `select auth.uid() as uid, current_user as who`,
    );
    expect(r.rows[0]!.uid).toBeNull();
    expect(r.rows[0]!.who).not.toBe('authenticated');
  });

  it('slår på RLS for alle offentlige tabeller', async () => {
    const r = await db.query<{ count: number }>(`
      select count(*) from pg_class
      where relrowsecurity and relnamespace = 'public'::regnamespace
    `);
    // Tolv offentlige tabeller pluss favorites.
    expect(Number(r.rows[0]!.count)).toBe(13);
  });
});
```

- [ ] **Step 4: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `relation "favorites" does not exist`.

- [ ] **Step 5: Skriv migrasjonen**

`supabase/migrations/0007_rls.sql`:

```sql
-- Næringssidene er offentlige. Alt statistisk innhold leses av anon.
create table favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  industry_id uuid not null references industries (id) on delete cascade,
  region_id   uuid not null references regions (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, industry_id, region_id)
);

alter table favorites enable row level security;

create policy favorites_select_own on favorites
  for select using (auth.uid() = user_id);
create policy favorites_insert_own on favorites
  for insert with check (auth.uid() = user_id);
create policy favorites_delete_own on favorites
  for delete using (auth.uid() = user_id);

-- Offentlig lesetilgang på alt som ikke er brukerdata.
do $$
declare t text;
begin
  foreach t in array array[
    'industries','regions','region_population','industry_stats',
    'industry_demography','companies','industry_estimates','ai_insights',
    'ai_reports','industry_scores','score_weights','score_config'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)',
                   t || '_public_read', t);
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, delete on favorites to authenticated;
```

- [ ] **Step 6: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 19 tester.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0007_rls.sql tests/rls.test.ts tests/helpers/
git commit -m "feat(db): add favorites with RLS and public read policies"
```

---

## Task 8: Deterministisk PRNG og seed-konfigurasjon

Seed-en må være reproduserbar. Samme frø gir samme `seed.sql`, så en diff
viser en faktisk endring i generatoren, ikke tilfeldig støy.

**Files:**
- Create: `seed/rng.ts`, `seed/config.ts`
- Test: `tests/seed.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

`tests/seed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeRng } from '../seed/rng.js';
import { PROFILES, REGION_VINTAGES, YEARS } from '../seed/config.js';

describe('rng', () => {
  it('gir samme sekvens for samme frø', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gir ulik sekvens for ulikt frø', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('holder seg innenfor range og jitter', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
      const j = r.jitter(0.1);
      expect(j).toBeGreaterThan(0.89);
      expect(j).toBeLessThan(1.11);
    }
  });
});

describe('config', () => {
  it('dekker 2017-2023, ikke ti år', () => {
    expect(YEARS).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023]);
  });

  it('har tre fylkesårganger med 17, 11 og 15 fylker', () => {
    expect(REGION_VINTAGES.map((v) => v.codes.length)).toEqual([17, 11, 15]);
    expect(REGION_VINTAGES[2]!.to).toBeNull();
  });

  it('gir servering lavere marginbånd enn rådgivning', () => {
    expect(PROFILES.servering.margin[1]).toBeLessThan(PROFILES.radgivning.margin[0]);
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/rng.js'`.

- [ ] **Step 3: Skriv `seed/rng.ts`**

```ts
/** Deterministisk PRNG (mulberry32). Samme frø gir samme seed hver kjøring. */
export interface Rng {
  next(): number;
  range(lo: number, hi: number): number;
  jitter(pct: number): number;
  pick<T>(arr: T[]): T;
  chance(p: number): boolean;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Uniformt tall i [lo, hi). */
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    /** Multiplikativ støy rundt 1, f.eks. jitter(0.06) -> 0.94..1.06 */
    jitter: (pct: number) => 1 + (next() * 2 - 1) * pct,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)]!,
    /** true med sannsynlighet p */
    chance: (p: number) => next() < p,
  };
}
```

- [ ] **Step 4: Skriv `seed/config.ts`**

```ts
export const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023] as const;

export type ProfileName =
  | 'servering' | 'varehandel' | 'bygg' | 'tjenesteyting' | 'radgivning' | 'helse';

export interface Profile {
  margin: [number, number];
  lonnsandel: [number, number];
  invest: [number, number];
  konkursrate: [number, number];
  overlevelse5: [number, number];
}

export interface Vintage { from: number; to: number | null; codes: [string, string][] }

/** Fylkesårganger. Statistikkrader legges på den som gjaldt i året. */
export const REGION_VINTAGES: Vintage[] = [
  { from: 2017, to: 2019, codes: [
    ['01','Østfold'],['02','Akershus'],['03','Oslo'],['04','Hedmark'],['05','Oppland'],
    ['06','Buskerud'],['07','Vestfold'],['08','Telemark'],['09','Aust-Agder'],['10','Vest-Agder'],
    ['11','Rogaland'],['12','Hordaland'],['14','Sogn og Fjordane'],['15','Møre og Romsdal'],
    ['18','Nordland'],['50','Trøndelag'],['54','Troms og Finnmark'] ] },
  { from: 2020, to: 2023, codes: [
    ['03','Oslo'],['11','Rogaland'],['15','Møre og Romsdal'],['18','Nordland'],
    ['30','Viken'],['34','Innlandet'],['38','Vestfold og Telemark'],['42','Agder'],
    ['46','Vestland'],['50','Trøndelag'],['54','Troms og Finnmark'] ] },
  { from: 2024, to: null, codes: [
    ['03','Oslo'],['11','Rogaland'],['15','Møre og Romsdal'],['18','Nordland'],
    ['31','Østfold'],['32','Akershus'],['33','Buskerud'],['34','Innlandet'],
    ['39','Vestfold'],['40','Telemark'],['42','Agder'],['46','Vestland'],
    ['50','Trøndelag'],['55','Troms'],['56','Finnmark'] ] },
];

/** Bransjeprofiler: marginbånd, lønnsandel, kapitalintensitet, konkursrate. */
export const PROFILES: Record<ProfileName, Profile> = {
  servering:    { margin: [1.5, 6.0],  lonnsandel: [32, 42], invest: [18000, 45000],  konkursrate: [0.045, 0.085], overlevelse5: [28, 42] },
  varehandel:   { margin: [2.5, 7.5],  lonnsandel: [14, 22], invest: [12000, 38000],  konkursrate: [0.025, 0.050], overlevelse5: [38, 52] },
  bygg:         { margin: [4.0, 9.5],  lonnsandel: [26, 36], invest: [22000, 60000],  konkursrate: [0.035, 0.070], overlevelse5: [33, 48] },
  tjenesteyting:{ margin: [8.0, 16.0], lonnsandel: [38, 52], invest: [8000, 25000],   konkursrate: [0.015, 0.035], overlevelse5: [48, 64] },
  radgivning:   { margin: [14.0, 26.0],lonnsandel: [42, 58], invest: [6000, 20000],   konkursrate: [0.010, 0.025], overlevelse5: [55, 72] },
  helse:        { margin: [6.0, 14.0], lonnsandel: [44, 60], invest: [15000, 42000],  konkursrate: [0.008, 0.020], overlevelse5: [60, 78] },
};
```

- [ ] **Step 5: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 25 tester.

- [ ] **Step 6: Commit**

```bash
git add seed/rng.ts seed/config.ts tests/seed.test.ts
git commit -m "feat(seed): add deterministic rng and seed configuration"
```

---

## Task 9: Næringshierarkiet

65 femsifrede næringer med komplette 3- og 2-siffer-forfedre. Hierarkiet må
være komplett fordi regionale rader kun finnes på nivå 2–3 — uten forfedrene
har regionvisningen ingenting å slå opp.

**Files:**
- Create: `seed/industries.ts`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

```ts
import { buildIndustries } from '../seed/industries.js';

describe('industries', () => {
  const rows = buildIndustries();

  it('har minst 60 femsifrede næringer', () => {
    expect(rows.filter((r) => r.nace_level === 5).length).toBeGreaterThanOrEqual(60);
  });

  it('har unike koder og slugs', () => {
    expect(new Set(rows.map((r) => r.nace_code)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });

  it('har komplett hierarki uten foreldreløse noder', () => {
    const codes = new Set(rows.map((r) => r.nace_code));
    const orphans = rows.filter((r) => r.parent_code !== null && !codes.has(r.parent_code));
    expect(orphans).toEqual([]);
  });

  it('gir hvert 5-siffer en 3-siffer-forelder som selv har en 2-siffer-forelder', () => {
    const byCode = new Map(rows.map((r) => [r.nace_code, r]));
    for (const leaf of rows.filter((r) => r.nace_level === 5)) {
      const parent = byCode.get(leaf.parent_code!);
      expect(parent?.nace_level).toBe(3);
      expect(byCode.get(parent!.parent_code!)?.nace_level).toBe(2);
    }
  });

  it('dekker alle seks bransjeprofilene', () => {
    expect(new Set(rows.map((r) => r.profile)).size).toBe(6);
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/industries.js'`.

- [ ] **Step 3: Skriv `seed/industries.ts`**

Legg til typene øverst, resten er som under:

```ts
import type { ProfileName } from './config.js';

export interface IndustryRow {
  nace_code: string;
  nace_level: number;
  parent_code: string | null;
  name: string;
  common_name: string;
  slug: string;
  profile: ProfileName;
  search_terms: string[];
}

type Leaf = [string, string, string];
type Group = [string, string, Leaf[]];
type Top = [string, string, ProfileName, Group[]];

/** 12 toppnæringer -> 3-siffer -> 60 femsifrede blader. */
export const TREE: Top[] = [
  ['56', 'Serveringsvirksomhet', 'servering', [
    ['56.1', 'Restauranter', [['56.101','Drift av restauranter og kafeer','Restaurant'],
                              ['56.102','Drift av gatekjøkken','Gatekjøkken'],
                              ['56.104','Drift av kaffebarer','Kaffebar']]],
    ['56.3', 'Drikkestedvirksomhet', [['56.301','Drift av puber','Pub'],
                                      ['56.309','Drikkesteder ellers','Bar']]],
    ['56.2', 'Cateringvirksomhet', [['56.210','Cateringvirksomhet','Cateringfirma'],
                                    ['56.290','Kantiner drevet som selvstendig virksomhet','Kantinedrift']]]]],
  ['47', 'Detaljhandel', 'varehandel', [
    ['47.1', 'Butikkhandel med bredt vareutvalg', [['47.111','Dagligvareforretning','Dagligvarebutikk'],
                                                    ['47.190','Butikkhandel ellers','Varehus']]],
    ['47.7', 'Annen butikkhandel', [['47.710','Butikkhandel med klær','Klesbutikk'],
                                    ['47.721','Butikkhandel med skotøy','Skobutikk'],
                                    ['47.762','Butikkhandel med blomster','Blomsterbutikk'],
                                    ['47.782','Butikkhandel med gull og sølv','Gullsmed'],
                                    ['47.752','Butikkhandel med tapeter og gulvbelegg','Fargehandel'],
                                    ['47.641','Butikkhandel med sportsutstyr','Sportsbutikk'],
                                    ['47.761','Butikkhandel med blomster og planter','Hagesenter']]],
    ['47.3', 'Detaljhandel med drivstoff', [['47.300','Detaljhandel med drivstoff','Bensinstasjon']]]]],
  ['41', 'Oppføring av bygninger', 'bygg', [
    ['41.1', 'Utvikling av byggeprosjekter', [['41.101','Boligbyggelag','Boligbyggelag'],
                                              ['41.109','Utvikling av byggeprosjekter ellers','Boligutvikler']]],
    ['41.2', 'Oppføring av bygninger', [['41.200','Oppføring av bygninger','Byggefirma']]]]],
  ['43', 'Spesialisert bygge- og anleggsvirksomhet', 'bygg', [
    ['43.2', 'Elektrisk installasjon og VVS', [['43.210','Elektrisk installasjonsarbeid','Elektriker'],
                                               ['43.221','Rørleggerarbeid','Rørlegger'],
                                               ['43.222','Ventilasjonsarbeid','Ventilasjonsfirma']]],
    ['43.3', 'Ferdiggjøring av bygninger', [['43.310','Stukkatørarbeid og pussing','Murer'],
                                            ['43.320','Snekkerarbeid','Snekker'],
                                            ['43.341','Malerarbeid','Maler'],
                                            ['43.390','Ferdiggjøring ellers','Byggtapetserer']]],
    ['43.1', 'Riving og grunnarbeid', [['43.110','Riving av bygninger','Rivingsfirma'],
                                       ['43.120','Grunnarbeid','Grunnentreprenør'],
                                       ['43.130','Prøveboring','Borefirma']]],
    ['43.9', 'Annen spesialisert bygge- og anleggsvirksomhet', [
        ['43.910','Takarbeid','Takentreprenør'],
        ['43.991','Blikkenslagerarbeid','Blikkenslager'],
        ['43.999','Bygge- og anleggsvirksomhet ellers','Stillasfirma']]]]],
  ['96', 'Annen personlig tjenesteyting', 'tjenesteyting', [
    ['96.0', 'Annen personlig tjenesteyting', [['96.021','Frisering og annen skjønnhetspleie','Frisørsalong'],
                                               ['96.022','Skjønnhetspleie','Hudpleiesalong'],
                                               ['96.011','Vaskeri- og renserivirksomhet','Renseri'],
                                               ['96.090','Personlig tjenesteyting ellers','Tatoveringsstudio']]]]],
  ['93', 'Sport og fritid', 'tjenesteyting', [
    ['93.1', 'Sports- og idrettsaktiviteter', [['93.130','Treningssentre','Treningssenter'],
                                               ['93.110','Drift av idrettsanlegg','Idrettsanlegg'],
                                               ['93.191','Idrettslag og -klubber','Idrettsklubb'],
                                               ['93.120','Idrettslag og -klubber for enkeltidretter','Fotballklubb']]],
    ['93.2', 'Fornøyelse og fritid', [['93.210','Drift av fornøyelsesetablissementer','Fornøyelsespark'],
                                      ['93.291','Drift av treningsstudio for dans','Dansestudio'],
                                      ['93.299','Fritidsvirksomhet ellers','Aktivitetssenter']]]]],
  ['69', 'Juridisk og regnskapsmessig tjenesteyting', 'radgivning', [
    ['69.1', 'Juridisk tjenesteyting', [['69.100','Juridisk tjenesteyting','Advokatfirma']]],
    ['69.2', 'Regnskap og revisjon', [['69.201','Regnskap og bokføring','Regnskapsfører'],
                                      ['69.202','Revisjon','Revisor']]]]],
  ['70', 'Hovedkontortjenester og administrativ rådgivning', 'radgivning', [
    ['70.2', 'Administrativ rådgivning', [['70.220','Bedriftsrådgivning','Bedriftsrådgiver'],
                                          ['70.210','PR og kommunikasjon','PR-byrå']]],
    ['70.1', 'Hovedkontortjenester', [['70.100','Hovedkontortjenester','Hovedkontor']]]]],
  ['62', 'Tjenester tilknyttet informasjonsteknologi', 'radgivning', [
    ['62.0', 'IT-tjenester', [['62.010','Programmeringstjenester','Programvarehus'],
                              ['62.020','Konsulentvirksomhet tilknyttet IT','IT-konsulent'],
                              ['62.030','Forvaltning og drift av IT-systemer','IT-drift']]]]],
  ['86', 'Helsetjenester', 'helse', [
    ['86.2', 'Lege- og tannlegetjenester', [['86.211','Allmenn legetjeneste','Legekontor'],
                                            ['86.230','Tannhelsetjenester','Tannlege']]],
    ['86.9', 'Andre helsetjenester', [['86.901','Fysioterapitjeneste','Fysioterapeut'],
                                      ['86.907','Kiropraktortjeneste','Kiropraktor'],
                                      ['86.905','Psykologtjeneste','Psykolog'],
                                      ['86.909','Helsetjenester ellers','Naprapat']]]]],
  ['88', 'Omsorg uten botilbud', 'helse', [
    ['88.9', 'Barnehager og annet sosialt arbeid', [['88.911','Barnehager','Barnehage'],
                                                    ['88.993','Dagsentre for eldre','Dagsenter']]]]],
  ['81', 'Tjenester tilknyttet eiendomsdrift', 'tjenesteyting', [
    ['81.2', 'Rengjøringsvirksomhet', [['81.210','Rengjøring av bygninger','Renholdsbyrå'],
                                       ['81.291','Skadedyrkontroll','Skadedyrfirma'],
                                       ['81.299','Rengjøringsvirksomhet ellers','Vinduspussfirma']]],
    ['81.3', 'Beplantning av hager', [['81.300','Beplantning av hager og parkanlegg','Anleggsgartner']]]]],
];

const slugify = (s: string): string => s.toLowerCase()
  .replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function buildIndustries(): IndustryRow[] {
  const out: IndustryRow[] = [];
  for (const [c2, n2, profile, kids3] of TREE) {
    out.push({ nace_code: c2, nace_level: 2, parent_code: null, name: n2,
               common_name: n2, slug: slugify(n2), profile, search_terms: [] });
    for (const [c3, n3, leaves] of kids3) {
      out.push({ nace_code: c3, nace_level: 3, parent_code: c2, name: n3,
                 common_name: n3, slug: slugify(c3 + '-' + n3), profile, search_terms: [] });
      for (const [c5, n5, common] of leaves) {
        out.push({ nace_code: c5, nace_level: 5, parent_code: c3, name: n5,
                   common_name: common, slug: slugify(common), profile,
                   search_terms: [common.toLowerCase(), n5.toLowerCase().split(' ')[0]] });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 30 tester. Treet gir 12 toppnæringer, 25 grupper og 65 blader.

- [ ] **Step 5: Commit**

```bash
git add seed/industries.ts tests/seed.test.ts
git commit -m "feat(seed): add industry hierarchy with 65 five-digit codes"
```

---

## Task 10: Regionårganger og folketall

Fylkesinndelingen endret seg i 2020 og 2024. Statistikkrader legges på den
årgangen som gjaldt i året; 15-fylkesårgangen finnes i `regions` men får
ingen statistikkrader, siden serien slutter i 2023.

**Files:**
- Create: `seed/regions.ts`, `seed/types.ts`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

```ts
import { buildRegions, regionsByYear } from '../seed/regions.js';

describe('regions', () => {
  it('lager Norge pluss alle tre fylkesårgangene', () => {
    const rows = buildRegions();
    expect(rows.filter((r) => r.level === 'land')).toHaveLength(1);
    expect(rows.filter((r) => r.level === 'fylke')).toHaveLength(17 + 11 + 15);
  });

  it('velger riktig årgang per år', () => {
    const byYear = regionsByYear();
    expect(byYear[2019]!).toHaveLength(17);
    expect(byYear[2020]!).toHaveLength(11);
    expect(byYear[2023]!).toHaveLength(11);
    // 2024-årgangen er utenfor dataperioden og skal ikke ha statistikkår.
    expect(byYear[2024]).toBeUndefined();
  });

  it('lar Oslo beholde koden 03 gjennom alle årganger', () => {
    const oslo = buildRegions().filter((r) => r.code === '03');
    expect(oslo).toHaveLength(3);
    expect(new Set(oslo.map((r) => r.valid_from_year))).toEqual(new Set([2017, 2020, 2024]));
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/regions.js'`.

- [ ] **Step 3: Skriv `seed/types.ts`**

```ts
export interface RegionRow {
  code: string;
  name: string;
  level: 'land' | 'fylke' | 'kommune';
  parent_code: string | null;
  valid_from_year: number;
  valid_to_year: number | null;
}

export interface RegionRef { code: string; name: string; vintage: number }

export interface StatRow {
  nace_code: string;
  nace_level: number;
  region_code: string;
  region_level: 'land' | 'fylke';
  year: number;
  unit_type: 'foretak' | 'virksomhet';
  n_enheter: number;
  omsetning_total: number;
  omsetning_per_enhet: number;
  driftsresultat_total: number | null;
  driftsmargin_pct: number | null;
  lonnskostnad_total: number;
  lonnsandel_pct: number | null;
  sysselsatte_total: number;
  sysselsatte_per_enhet: number | null;
  arsverk_per_enhet: number | null;
  bearbeidingsverdi_total: number | null;
  verdiskaping_per_sysselsatt: number | null;
  bruttoinvestering_total: number;
  merknader: Record<string, string>;
  source: string;
  data_quality: 'mock';
  coverage: 'alle';
}

export interface DemographyRow {
  nace_code: string;
  nace_level: number;
  region_code: string;
  region_level: 'land' | 'fylke';
  year: number;
  nyetableringer: number;
  nedleggelser: number;
  konkurser: number;
  overlevelse_1ar_pct: number | null;
  overlevelse_3ar_pct: number | null;
  overlevelse_5ar_pct: number | null;
  merknader: Record<string, string>;
  source: string;
  data_quality: 'mock';
  coverage: 'alle';
}
```

- [ ] **Step 4: Skriv `seed/regions.ts`**

```ts
import { REGION_VINTAGES, YEARS } from './config.js';
import type { RegionRef, RegionRow } from './types.js';

/** Norge pluss alle tre fylkesårgangene. */
export function buildRegions(): RegionRow[] {
  const rows: RegionRow[] = [{
    code: '0', name: 'Norge', level: 'land',
    parent_code: null, valid_from_year: 2017, valid_to_year: null,
  }];
  for (const v of REGION_VINTAGES) {
    for (const [code, name] of v.codes) {
      rows.push({
        code, name, level: 'fylke', parent_code: '0',
        valid_from_year: v.from, valid_to_year: v.to,
      });
    }
  }
  return rows;
}

/** Hvilke fylker som gjaldt i hvert statistikkår. */
export function regionsByYear(): Record<number, RegionRef[]> {
  const out: Record<number, RegionRef[]> = {};
  for (const y of YEARS) {
    const v = REGION_VINTAGES.find((x) => y >= x.from && (x.to === null || y <= x.to));
    if (!v) continue;
    out[y] = v.codes.map(([code, name]) => ({ code, name, vintage: v.from }));
  }
  return out;
}
```

- [ ] **Step 5: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 33 tester.

- [ ] **Step 6: Commit**

```bash
git add seed/regions.ts seed/types.ts tests/seed.test.ts
git commit -m "feat(seed): add region vintages and per-year resolution"
```

---

## Task 11: Statistikk og demografi

Kjernen i generatoren. Genereringen er **top-down**: nasjonale totaler lages
på 2-siffer, splittes til 3-siffer, så til 5-siffer, og 3-sifferet splittes
utover fylkene. Konsistens blir dermed en egenskap ved konstruksjonen i
stedet for noe som må sjekkes i etterkant.

To ting seed-en må ha for å ligne ekte data:

**Skjeve fylkesvekter.** Ekte fordeling har Oslo mangedobbelt av Finnmark. Med
jevne vekter blir alle celler store, og da oppstår aldri undertrykking.

**Undertrykte celler.** Små celler får `bearbeidingsverdi_total = NULL` med
`merknader.bearbeidingsverdi_total = 'konfidensielt'`. Uten dem får frontend
aldri testet hvordan et konfidensielt hull ser ut, som er forskjellig fra et
upublisert hull.

**Files:**
- Create: `seed/stats.ts`
- Modify: `tests/seed.test.ts`

- [ ] **Step 1: Skriv den feilende testen**

```ts
import { buildStats } from '../seed/stats.js';
import { regionsByYear } from '../seed/regions.js';

describe('stats', () => {
  const built = buildStats(makeRng(20260802), buildIndustries(), regionsByYear());

  it('lager ingen regionale rader over 3-siffer', () => {
    const bad = built.rows.filter((r) => r.region_level !== 'land' && r.nace_level > 3);
    expect(bad).toEqual([]);
  });

  it('lar driftsmargin være NULL i alle regionale rader', () => {
    const bad = built.rows.filter(
      (r) => r.region_level !== 'land' && r.driftsmargin_pct !== null,
    );
    expect(bad).toEqual([]);
  });

  it('lager både foretak og virksomhet nasjonalt, kun virksomhet regionalt', () => {
    const regionalUnits = new Set(
      built.rows.filter((r) => r.region_level === 'fylke').map((r) => r.unit_type),
    );
    expect([...regionalUnits]).toEqual(['virksomhet']);
  });

  it('følger fylkesårgangene', () => {
    const fylker = (y: number) => new Set(
      built.rows.filter((r) => r.year === y && r.region_level === 'fylke')
        .map((r) => r.region_code),
    ).size;
    expect(fylker(2019)).toBe(17);
    expect(fylker(2023)).toBe(11);
  });

  it('produserer undertrykte celler med merknad', () => {
    const suppressed = built.rows.filter(
      (r) => r.merknader['bearbeidingsverdi_total'] === 'konfidensielt',
    );
    expect(suppressed.length).toBeGreaterThan(0);
    for (const r of suppressed) expect(r.bearbeidingsverdi_total).toBeNull();
  });

  it('holder marginene innenfor bransjeprofilen', () => {
    const radgivning = built.rows.filter(
      (r) => r.nace_code === '69.201' && r.driftsmargin_pct !== null,
    );
    const servering = built.rows.filter(
      (r) => r.nace_code === '56.101' && r.driftsmargin_pct !== null,
    );
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(radgivning.map((r) => r.driftsmargin_pct!)))
      .toBeGreaterThan(avg(servering.map((r) => r.driftsmargin_pct!)));
  });

  it('lager tidsserier med støy, ikke rette linjer', () => {
    const serie = built.rows
      .filter((r) => r.nace_code === '96.021' && r.region_level === 'land' && r.unit_type === 'foretak')
      .sort((a, b) => a.year - b.year)
      .map((r) => r.omsetning_total);
    const diffs = serie.slice(1).map((v, i) => v - serie[i]!);
    expect(new Set(diffs).size).toBeGreaterThan(1);
  });

  it('er deterministisk', () => {
    const again = buildStats(makeRng(20260802), buildIndustries(), regionsByYear());
    expect(again.rows[500]).toEqual(built.rows[500]);
  });
});
```

- [ ] **Step 2: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/stats.js'`.

- [ ] **Step 3: Skriv `seed/stats.ts`**

```ts
import { PROFILES, YEARS } from './config.js';
import type { Profile } from './config.js';
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { StatRow, DemographyRow, RegionRef } from './types.js';

/**
 * Top-down generering. Nasjonale totaler lages på 2-siffer, splittes til
 * 3-siffer, så til 5-siffer. Regionale rader splitter 3-sifferet utover
 * fylkene. Konsistens er dermed en egenskap ved konstruksjonen, ikke noe
 * som må sjekkes i etterkant.
 */
export function buildStats(
  rng: Rng,
  industries: IndustryRow[],
  regionsByYear: Record<number, RegionRef[]>,
): { rows: StatRow[]; demography: DemographyRow[] } {
  const rows: StatRow[] = [];
  const demography: DemographyRow[] = [];
  const level2 = industries.filter((i) => i.nace_level === 2);

  for (const top of level2) {
    const profile = PROFILES[top.profile];
    const base = rng.range(4_000, 30_000);            // enheter i 2017
    const baseTurnoverPerUnit = rng.range(1.4e6, 9e6);
    const drift = rng.range(-0.01, 0.055);            // årlig trend

    for (const year of YEARS) {
      const t = year - YEARS[0]!;
      const growth = Math.pow(1 + drift, t) * rng.jitter(0.035);
      const units2 = Math.round(base * growth);
      const turnover2 = Math.round(units2 * baseTurnoverPerUnit * rng.jitter(0.05));
      const margin2 = clamp(lerp(profile.margin, rng.next()) * rng.jitter(0.12), -8, 40);

      // 2-siffer nasjonalt, begge enhetstyper
      for (const unit of ['foretak', 'virksomhet']) {
        const mult = unit === 'virksomhet' ? 1.18 : 1.0;
        rows.push(mkRow(top, 'land', '0', year, unit,
          Math.round(units2 * mult), Math.round(turnover2), margin2, profile, rng));
      }

      // 3-siffer: splitt 2-sifferet
      const kids3 = industries.filter((i) => i.parent_code === top.nace_code);
      const shares3 = normalise(kids3.map(() => rng.range(0.5, 1.5)));
      kids3.forEach((kid, ix) => {
        const u3 = Math.max(25, Math.round(units2 * shares3[ix]!));
        const tv3 = Math.round(turnover2 * shares3[ix]!);
        const m3 = clamp(margin2 * rng.jitter(0.22), -8, 40);

        for (const unit of ['foretak', 'virksomhet']) {
          const mult = unit === 'virksomhet' ? 1.18 : 1.0;
          rows.push(mkRow(kid, 'land', '0', year, unit,
            Math.round(u3 * mult), tv3, m3, profile, rng));
        }
        demography.push(mkDemo(kid, '0', 'land', year, u3, profile, rng));

        // regionalt: kun 3-siffer, kun virksomhet, kun driftsdata uten resultat.
        // Vektene er skjeve med vilje: ekte fylkesfordeling har Oslo mangedobbelt
        // av Finnmark, og det er i de små cellene undertrykking faktisk skjer.
        const regions = regionsByYear[year];
        const sharesR = normalise(regions.map((r) => regionWeight(r.code) * rng.jitter(0.25)));
        regions.forEach((r, ri) => {
          const uR = Math.round(u3 * 1.18 * sharesR[ri]!);
          if (uR < 5) return;
          rows.push(mkRow(kid, 'fylke', r.code, year, 'virksomhet',
            uR, Math.round(tv3 * sharesR[ri]!), null, profile, rng));
          demography.push(mkDemo(kid, r.code, 'fylke', year, uR, profile, rng));
        });

        // 5-siffer: splitt 3-sifferet, kun nasjonalt
        const kids5 = industries.filter((i) => i.parent_code === kid.nace_code);
        const shares5 = normalise(kids5.map(() => rng.range(0.6, 1.6)));
        kids5.forEach((leaf, li) => {
          const u5 = Math.max(12, Math.round(u3 * shares5[li]!));
          const tv5 = Math.round(tv3 * shares5[li]!);
          const m5 = clamp(m3 * rng.jitter(0.3), -8, 40);
          for (const unit of ['foretak', 'virksomhet']) {
            const mult = unit === 'virksomhet' ? 1.18 : 1.0;
            rows.push(mkRow(leaf, 'land', '0', year, unit,
              Math.round(u5 * mult), tv5, m5, profile, rng));
          }
          demography.push(mkDemo(leaf, '0', 'land', year, u5, profile, rng));
        });
      });
    }
  }
  return { rows, demography };
}

function mkRow(
  ind: IndustryRow, regionLevel: 'land' | 'fylke', regionCode: string, year: number,
  unit: 'foretak' | 'virksomhet', units: number, turnover: number,
  margin: number | null, profile: Profile, rng: Rng,
): StatRow {
  const regional = regionLevel !== 'land';
  // Regionalt publiserer SSB ikke driftsresultat -> NULL, ikke 0.
  const driftsresultat = regional || margin === null
    ? null : Math.round(turnover * (margin / 100));
  const lonnsandel = lerp(profile.lonnsandel, rng.next()) * rng.jitter(0.08);
  const sysselsatte = Math.round(units * rng.range(1.8, 7.5));
  const merknader: Record<string, string> = {};
  // Undertrykking treffer små celler. Seed-en må inneholde dem, ellers
  // får frontend aldri testet hvordan konfidensielle hull ser ut.
  let bearbeidingsverdi = Math.round(turnover * rng.range(0.28, 0.55));
  if (units < 40 && rng.chance(0.45)) {
    bearbeidingsverdi = null;
    merknader.bearbeidingsverdi_total = 'konfidensielt';
  }
  return {
    nace_code: ind.nace_code, nace_level: ind.nace_level,
    region_code: regionCode, region_level: regionLevel, year, unit_type: unit,
    n_enheter: units,
    omsetning_total: turnover,
    omsetning_per_enhet: Math.round(turnover / units),
    driftsresultat_total: driftsresultat,
    driftsmargin_pct: regional ? null : round2(margin),
    lonnskostnad_total: Math.round(turnover * (lonnsandel / 100)),
    lonnsandel_pct: round2(lonnsandel),
    sysselsatte_total: sysselsatte,
    sysselsatte_per_enhet: round2(sysselsatte / units),
    arsverk_per_enhet: round2((sysselsatte / units) * rng.range(0.78, 0.94)),
    bearbeidingsverdi_total: bearbeidingsverdi,
    verdiskaping_per_sysselsatt: bearbeidingsverdi ? Math.round(bearbeidingsverdi / sysselsatte) : null,
    bruttoinvestering_total: Math.round(sysselsatte * lerp(profile.invest, rng.next())),
    merknader,
    source: regional ? 'seed:12936' : 'seed:12910',
    data_quality: 'mock',
    coverage: 'alle',
  };
}

function mkDemo(
  ind: IndustryRow, regionCode: string, regionLevel: 'land' | 'fylke', year: number,
  units: number, profile: Profile, rng: Rng,
): DemographyRow {
  const konkursrate = lerp(profile.konkursrate, rng.next()) * rng.jitter(0.25);
  return {
    nace_code: ind.nace_code, nace_level: ind.nace_level,
    region_code: regionCode, region_level: regionLevel, year,
    nyetableringer: Math.round(units * rng.range(0.06, 0.16)),
    nedleggelser: Math.round(units * rng.range(0.04, 0.12)),
    konkurser: Math.round(units * konkursrate),
    overlevelse_1ar_pct: round2(clamp(lerp(profile.overlevelse5, rng.next()) + rng.range(28, 40), 0, 100)),
    overlevelse_3ar_pct: round2(clamp(lerp(profile.overlevelse5, rng.next()) + rng.range(10, 20), 0, 100)),
    overlevelse_5ar_pct: round2(lerp(profile.overlevelse5, rng.next()) * rng.jitter(0.08)),
    merknader: {},
    source: 'seed:foretaksdemografi', data_quality: 'mock', coverage: 'alle',
  };
}

const lerp = ([lo, hi]: [number, number], t: number): number => lo + (hi - lo) * t;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number | null): number | null => v === null ? null : Math.round(v * 100) / 100;
function normalise(xs: number[]): number[] {
  const s = xs.reduce((a, b) => a + b, 0);
  return xs.map((x) => x / s);
}

/**
 * Grov befolkningsvekt per fylkeskode, på tvers av alle tre årgangene.
 * Trenger ikke være presis — den skal bare gi realistisk skjevhet, så
 * små fylker får små celler og dermed undertrykking.
 */
const REGION_WEIGHTS: Record<string, number> = {
  '03': 7.0, '30': 6.2, '46': 3.2, '11': 2.4, '50': 2.1, '34': 1.6, '38': 1.6,
  '42': 1.4, '15': 1.4, '18': 0.9, '54': 0.7, '02': 3.0, '01': 1.4, '12': 2.2,
  '31': 1.1, '32': 3.0, '33': 1.4, '39': 1.0, '40': 0.8, '55': 0.5, '56': 0.2,
  '04': 0.7, '05': 0.7, '06': 1.2, '07': 0.9, '08': 0.7, '09': 0.4, '10': 0.7,
  '14': 0.4,
};
const regionWeight = (code: string): number => REGION_WEIGHTS[code] ?? 1.0;
```

- [ ] **Step 4: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 41 tester. Generatoren gir omtrent 3800 statistikkrader og
3000 demografirader, med rundt 38 undertrykte celler.

- [ ] **Step 5: Commit**

```bash
git add seed/stats.ts tests/seed.test.ts
git commit -m "feat(seed): generate statistics top-down with skewed regional weights"
```

---

## Task 12: Selskaper, anslag og innsikt

Tre generatorer som fyller ut resten av seed-en. Felles krav: anslag oppgis som
**spenn med konfidens**, aldri som ett tall, og hver innsikt bærer
`referanser` som peker på radene påstanden bygger på.

Konfidensen skal variere. Er alt satt til `hoy`, får frontend aldri testet
hvordan et lavkonfidens-anslag ser ut ved siden av et sikkert tall.

**Files:**
- Create: `seed/companies.ts`, `seed/ai.ts`
- Modify: `seed/types.ts`, `tests/seed.test.ts`

- [ ] **Step 1: Utvid `seed/types.ts`**

```ts
export interface CompanyRow {
  org_nr: string;
  navn: string;
  nace_code: string;
  kommune_code: string;
  organisasjonsform: string;
  ansatte: number;
  omsetning: number | null;
  driftsresultat: number | null;
  egenkapital: number | null;
  regnskapsar: number | null;
}

export interface EstimateRow {
  industry_nace: string;
  region_code: string | null;
  metrikk: string;
  intervall_lav: number;
  intervall_hoy: number;
  enhet: string;
  konfidens: 'lav' | 'middels' | 'hoy';
  begrunnelse: string;
  basert_pa: unknown[];
  model: string;
  prompt_version: string;
  source: string;
  data_quality: 'ai_anslag';
}

export interface InsightRow {
  industry_nace: string;
  region_code: string;
  year: number;
  type: 'risiko' | 'mulighet' | 'avvik' | 'sammenligning' | 'kontekst';
  tittel: string;
  body: string;
  alvorlighet: number;
  referanser: unknown[];
  knyttet_til: string;
  model: string;
  prompt_version: string;
  data_quality: 'ai_anslag';
}

export interface PopulationRow {
  region_code: string; vintage: number; year: number; innbyggere: number;
}

export interface SeedBundle {
  industries: import('./industries.js').IndustryRow[];
  regions: RegionRow[];
  rows: StatRow[];
  demography: DemographyRow[];
  population: PopulationRow[];
  companies: CompanyRow[];
  estimates: EstimateRow[];
  insights: InsightRow[];
}
```

- [ ] **Step 2: Skriv de feilende testene**

```ts
import { buildCompanies } from '../seed/companies.js';
import { buildEstimates, buildInsights } from '../seed/ai.js';

describe('companies', () => {
  const rows = buildCompanies(makeRng(1), buildIndustries(), ['0301', '1103', '4601']);

  it('lager 300 selskaper med unike organisasjonsnummer', () => {
    expect(rows).toHaveLength(300);
    expect(new Set(rows.map((r) => r.org_nr)).size).toBe(300);
  });

  it('lar ENK stå uten regnskapstall', () => {
    const enk = rows.filter((r) => r.organisasjonsform === 'ENK');
    expect(enk.length).toBeGreaterThan(0);
    for (const r of enk) {
      expect(r.regnskapsar).toBeNull();
      expect(r.omsetning).toBeNull();
    }
  });

  it('gir AS regnskapstall for siste år', () => {
    for (const r of rows.filter((x) => x.organisasjonsform === 'AS')) {
      expect(r.regnskapsar).toBe(2023);
      expect(r.omsetning).not.toBeNull();
    }
  });
});

describe('estimates', () => {
  const rows = buildEstimates(makeRng(2), buildIndustries());

  it('oppgir alltid et spenn, aldri ett tall', () => {
    for (const r of rows) {
      expect(r.intervall_hoy).toBeGreaterThanOrEqual(r.intervall_lav);
    }
  });

  it('varierer konfidensen', () => {
    expect(new Set(rows.map((r) => r.konfidens)).size).toBe(3);
  });

  it('har ikke-tom basert_pa og begrunnelse på hver rad', () => {
    for (const r of rows) {
      expect(r.basert_pa.length).toBeGreaterThan(0);
      expect(r.begrunnelse.length).toBeGreaterThan(10);
    }
  });

  it('gir rådgivning lavere etableringskapital enn servering', () => {
    const forCode = (c: string) =>
      rows.find((r) => r.industry_nace === c && r.metrikk === 'etableringskapital')!;
    expect(forCode('69.201').intervall_hoy).toBeLessThan(forCode('56.101').intervall_hoy);
  });
});

describe('insights', () => {
  it('dekker alle fem innsiktstypene og har alltid referanser', () => {
    const industries = buildIndustries();
    const built = buildStats(makeRng(3), industries, regionsByYear());
    const byNace = new Map<string, typeof built.rows>();
    for (const r of built.rows) {
      if (!byNace.has(r.nace_code)) byNace.set(r.nace_code, []);
      byNace.get(r.nace_code)!.push(r);
    }
    const rows = buildInsights(makeRng(4), industries, byNace);

    expect(new Set(rows.map((r) => r.type)).size).toBe(5);
    for (const r of rows) {
      expect(r.referanser.length).toBeGreaterThan(0);
      expect(r.alvorlighet).toBeGreaterThanOrEqual(1);
      expect(r.alvorlighet).toBeLessThanOrEqual(5);
    }
  });
});
```

- [ ] **Step 3: Kjør og bekreft at de feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/companies.js'`.

- [ ] **Step 4: Skriv `seed/companies.ts`**

```ts
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { CompanyRow } from './types.js';

const FORMS: [string, number][] = [['AS', 0.62], ['ENK', 0.28], ['NUF', 0.05], ['ASA', 0.02], ['SA', 0.03]];
const PREFIX = ['Nord','Vest','Sør','Øst','Fjell','Vik','Berg','Lund','Haug','Strand','Dal','Elv'];
const SUFFIX = ['gruppen','partner','service','senter','kompaniet','verksted','huset','byrået'];

/** 300 selskaper, kun siste regnskapsår. ENK mangler regnskapstall. */
export function buildCompanies(
  rng: Rng, industries: IndustryRow[], kommuner: string[], count = 300,
): CompanyRow[] {
  const leaves = industries.filter((i) => i.nace_level === 5);
  const out: CompanyRow[] = [];
  const seen = new Set<number>();
  while (out.length < count) {
    const ind = rng.pick(leaves);
    const form = pickWeighted(rng, FORMS);
    const orgNr = 800000000 + Math.floor(rng.next() * 199999999);
    if (seen.has(orgNr)) continue;
    seen.add(orgNr);
    const filesAccounts = ['AS', 'ASA', 'NUF', 'SA'].includes(form);
    const ansatte = Math.max(0, Math.round(rng.range(0, 45) ** 0.8));
    const omsetning = filesAccounts ? Math.round(rng.range(4e5, 9e7)) : null;
    out.push({
      org_nr: String(orgNr),
      navn: `${rng.pick(PREFIX)} ${ind.common_name.toLowerCase()} ${rng.pick(SUFFIX)} ${form}`
        .replace(/\s+/g, ' '),
      nace_code: ind.nace_code,
      kommune_code: rng.pick(kommuner),
      organisasjonsform: form,
      ansatte,
      omsetning,
      // ENK leverer ikke årsregnskap, så tallene mangler - de er ikke null.
      driftsresultat: omsetning === null ? null : Math.round(omsetning * rng.range(-0.08, 0.22)),
      egenkapital: omsetning === null ? null : Math.round(omsetning * rng.range(0.05, 0.45)),
      regnskapsar: filesAccounts ? 2023 : null,
    });
  }
  return out;
}

function pickWeighted(rng: Rng, pairs: [string, number][]): string {
  const t = rng.next();
  let acc = 0;
  for (const [v, w] of pairs) { acc += w; if (t <= acc) return v; }
  return pairs[pairs.length - 1]![0];
}
```

- [ ] **Step 5: Skriv `seed/ai.ts`**

```ts
import type { ProfileName } from './config.js';
import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { EstimateRow, InsightRow, StatRow } from './types.js';

type Band = Record<ProfileName, [number, number]>;
interface Metric { metrikk: string; enhet: string; band: Band; begrunnelse: string }

const METRICS: Metric[] = [
  { metrikk: 'etableringskapital', enhet: 'NOK',
    band: { servering: [400000,1400000], varehandel: [350000,1200000], bygg: [250000,900000],
            tjenesteyting: [150000,600000], radgivning: [50000,250000], helse: [300000,1500000] },
    begrunnelse: 'Utstyr, lokaler og drift fram til positiv kontantstrøm.' },
  { metrikk: 'tid_til_lonnsomhet', enhet: 'mnd',
    band: { servering: [12,30], varehandel: [10,24], bygg: [6,18],
            tjenesteyting: [6,15], radgivning: [3,10], helse: [9,20] },
    begrunnelse: 'Typisk tid før driften bærer seg, gitt marginbåndet i næringen.' },
  { metrikk: 'sesongvariasjon', enhet: 'pct',
    band: { servering: [25,55], varehandel: [15,40], bygg: [20,45],
            tjenesteyting: [8,22], radgivning: [5,15], helse: [4,12] },
    begrunnelse: 'Spredning mellom sterkeste og svakeste kvartal.' },
];

/** Anslag oppgis som spenn med konfidens, aldri som ett presist tall. */
export function buildEstimates(rng: Rng, industries: IndustryRow[]): EstimateRow[] {
  const out: EstimateRow[] = [];
  for (const ind of industries.filter((i) => i.nace_level === 5)) {
    for (const m of METRICS) {
      const [lo, hi] = m.band[ind.profile];
      const low = Math.round(lo * rng.jitter(0.15));
      const high = Math.round(hi * rng.jitter(0.15));
      // Konfidensen varierer med vilje, ellers får frontend aldri testet
      // hvordan et lavkonfidens-anslag ser ut ved siden av et høykonfidens.
      const konfidens = rng.pick(['lav', 'middels', 'middels', 'hoy'] as const);
      out.push({
        industry_nace: ind.nace_code, region_code: null, metrikk: m.metrikk,
        intervall_lav: Math.min(low, high), intervall_hoy: Math.max(low, high),
        enhet: m.enhet, konfidens, begrunnelse: m.begrunnelse,
        basert_pa: [{ table: 'industry_stats', nace_code: ind.nace_code, year: 2023,
                      felt: ['driftsmargin_pct','bruttoinvestering_total'] }],
        model: 'seed', prompt_version: 'v0', source: 'seed:ai', data_quality: 'ai_anslag',
      });
    }
  }
  return out;
}

const TYPES = ['risiko', 'mulighet', 'avvik', 'sammenligning', 'kontekst'] as const;
type InsightType = (typeof TYPES)[number];

/** Innsikt forankret i KPI-en den handler om, med obligatoriske referanser. */
export function buildInsights(
  rng: Rng, industries: IndustryRow[], statsByNace: Map<string, StatRow[]>,
): InsightRow[] {
  const out: InsightRow[] = [];
  const leaves = industries.filter((i) => i.nace_level === 5).slice(0, 10);
  for (const ind of leaves) {
    const series = (statsByNace.get(ind.nace_code) ?? [])
      .filter((r) => r.region_level === 'land' && r.unit_type === 'foretak')
      .sort((a, b) => a.year - b.year);
    if (series.length < 2) continue;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    const marginDelta = (last.driftsmargin_pct ?? 0) - (first.driftsmargin_pct ?? 0);
    const unitDelta = last.n_enheter - first.n_enheter;

    // Én av hver type, så alle varianter av InsightCard er dekket i seed.
    for (const type of TYPES) {
      out.push({
        industry_nace: ind.nace_code, region_code: '0', year: last.year, type,
        tittel: titleFor(type, ind, marginDelta, unitDelta),
        body: bodyFor(type, ind, marginDelta, unitDelta, first, last),
        alvorlighet: 1 + Math.floor(rng.next() * 5),
        referanser: [{ table: 'industry_stats', nace_code: ind.nace_code,
                       years: [first.year, last.year], felt: ['driftsmargin_pct','n_enheter'] }],
        knyttet_til: type === 'avvik' ? 'driftsmargin' : type === 'konkurranse' ? 'n_enheter' : 'driftsmargin',
        model: 'seed', prompt_version: 'v0', data_quality: 'ai_anslag',
      });
    }
  }
  return out;
}

const pct = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
function titleFor(type: InsightType, ind: IndustryRow, dm: number, du: number): string {
  switch (type) {
    case 'risiko': return `Marginpress i ${ind.common_name.toLowerCase()}`;
    case 'mulighet': return `Rom for konsolidering i ${ind.common_name.toLowerCase()}`;
    case 'avvik': return dm < 0 ? 'Marginen faller mens antall foretak øker'
                                : 'Marginen stiger raskere enn foretaksveksten';
    case 'sammenligning': return `${ind.common_name} mot resten av næringsgruppen`;
    default: return `Slik leses tallene for ${ind.common_name.toLowerCase()}`;
  }
}
function bodyFor(
  type: InsightType, ind: IndustryRow, dm: number, du: number,
  first: StatRow, last: StatRow,
): string {
  const base = `Fra ${first.year} til ${last.year} endret driftsmarginen seg ${pct(dm)} prosentpoeng, `
    + `mens antall foretak endret seg med ${du > 0 ? '+' : ''}${du}.`;
  switch (type) {
    case 'risiko': return `${base} Fallende margin kombinert med flere aktører tyder på priskonkurranse.`;
    case 'mulighet': return `${base} Et fragmentert marked med synkende margin er ofte modent for oppkjøp.`;
    case 'avvik': return `${base} Retningene peker hver sin vei, som er verdt å undersøke nærmere.`;
    case 'sammenligning': return `${base} Sammenlignet med søsternæringene i samme 3-siffer ligger dette i midtsjiktet.`;
    default: return `${base} Tallene gjelder foretak nasjonalt; regionale tall finnes kun på 3-siffer.`;
  }
}
```

- [ ] **Step 6: Kjør og bekreft at de passerer**

Run: `npm test`
Expected: PASS, 49 tester. Generatoren gir 300 selskaper, 195 anslag og
50 innsikter.

- [ ] **Step 7: Commit**

```bash
git add seed/companies.ts seed/ai.ts seed/types.ts tests/seed.test.ts
git commit -m "feat(seed): add companies, estimates as ranges, and anchored insights"
```

---

## Task 13: Deterministiske id-er, SQL-emit og full lastetest

Siste ledd. Generatoren skriver `supabase/seed/seed.sql` som ren tekst, som
committes. Da er seed-en diffbar: en endring i filen viser en faktisk endring
i generatoren, ikke tilfeldig støy.

Id-ene utledes deterministisk fra naturlige nøkler, så SQL-en kan skrive
eksplisitte UUID-er og referere dem direkte i stedet for å slå opp underveis.

**Files:**
- Create: `seed/ids.ts`, `seed/emit.ts`, `seed/index.ts`
- Test: `tests/seed-load.test.ts`

- [ ] **Step 1: Skriv den feilende lastetesten**

`tests/seed-load.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './helpers/db.js';
import { buildSeed } from '../seed/index.js';
import { emitSeed } from '../seed/emit.js';

describe('seed.sql', () => {
  let db: PGlite;
  let sql: string;

  beforeAll(async () => {
    sql = emitSeed(buildSeed());
    db = await freshDb();
    await db.exec(sql);
  });

  it('er deterministisk', () => {
    expect(emitSeed(buildSeed())).toBe(sql);
  });

  it('laster uten å bryte noen constraint', async () => {
    const counts = await db.query<{ t: string; c: number }>(`
      select 'industries' t, count(*)::text c from industries
      union all select 'regions', count(*)::text from regions
      union all select 'industry_stats', count(*)::text from industry_stats
      union all select 'companies', count(*)::text from companies
      union all select 'industry_estimates', count(*)::text from industry_estimates
      union all select 'ai_insights', count(*)::text from ai_insights
    `);
    const by = Object.fromEntries(counts.rows.map((r) => [r.t, Number(r.c)]));
    expect(by['industries']).toBe(102);
    expect(by['regions']).toBe(44);
    expect(by['industry_stats']).toBe(3803);
    expect(by['companies']).toBe(300);
    expect(by['industry_estimates']).toBe(195);
    expect(by['ai_insights']).toBe(50);
  });

  it('respekterer granularitetsregelen', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from industry_stats where region_level <> 'land' and nace_level > 3`,
    );
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it('bevarer undertrykte celler som merknad', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from industry_stats where merknader <> '{}'::jsonb`,
    );
    expect(Number(r.rows[0]!.c)).toBeGreaterThan(0);
  });

  it('holder ENK utenfor regnskapssnittet', async () => {
    const r = await db.query<{ c: number }>(
      `select count(*) c from companies
       where organisasjonsform = 'ENK' and inngar_i_regnskapssnitt`,
    );
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it('gir scoring-viewet noe å regne på', async () => {
    const r = await db.query<{ c: number }>(`select count(*) c from industry_scores_computed`);
    expect(Number(r.rows[0]!.c)).toBeGreaterThan(3000);
  });

  it('er idempotent — ny kjøring gir samme radtall', async () => {
    await db.exec(sql);
    const r = await db.query<{ c: number }>(`select count(*) c from industry_stats`);
    expect(Number(r.rows[0]!.c)).toBe(3803);
  });
});
```

- [ ] **Step 2: Kjør og bekreft at den feiler**

Run: `npm test`
Expected: FAIL med `Cannot find module '../seed/index.js'`.

- [ ] **Step 3: Skriv `seed/ids.ts`**

```ts
import { createHash } from 'node:crypto';

/** Fast namespace for Bransjeindeks-seed. Vilkårlig, men må aldri endres. */
const NS = '6f9b1f2c-3a4d-5e6f-8a9b-0c1d2e3f4a5b';

/**
 * Deterministisk UUID v5 fra en naturlig nøkkel. Gjør at seed.sql kan skrive
 * eksplisitte id-er og referere dem direkte, uten oppslag under innlasting.
 */
export function uuid5(name: string): string {
  const nsBytes = Buffer.from(NS.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export const industryId = (naceCode: string): string => uuid5(`industry:${naceCode}`);
export const regionId = (code: string, validFrom: number): string => uuid5(`region:${code}:${validFrom}`);
```

- [ ] **Step 4: Skriv `seed/emit.ts`**

```ts
import { industryId, regionId } from './ids.js';
import type { SeedBundle } from './types.js';

type Val = string | number | null | undefined | boolean;

const q = (v: Val): string => v === null || v === undefined ? 'NULL'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? (v ? 'true' : 'false')
  : `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs: string[]): string => xs.length ? `ARRAY[${xs.map(q).join(',')}]` : `'{}'::text[]`;
const jb = (o: unknown): string => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

/** Deler lange INSERT-er i bolker så ingen enkeltsetning blir urimelig stor. */
function insertMany(
  table: string, cols: string[], rows: (string | number)[][], batch = 500,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    out.push(`insert into ${table} (${cols.join(', ')}) values\n  ` +
      chunk.map((r) => `(${r.join(', ')})`).join(',\n  ') + ';');
  }
  return out;
}

export function emitSeed(a: SeedBundle): string {
  const parts = [
    '-- Generert av seed/index.ts. Ikke rediger for hånd.',
    '-- Deterministisk: samme frø gir identisk fil.',
    'begin;',
    '',
    '-- Idempotent: en ny kjøring erstatter hele seed-settet.',
    'truncate ai_insights, industry_estimates, ai_reports, industry_scores,',
    '         industry_demography, industry_stats, region_population,',
    '         companies, industries, regions restart identity cascade;',
    '',
  ];

  const regFor = (code: string, year: number): string => {
    const r = a.regions.find((x) => x.code === code
      && x.valid_from_year <= year && (x.valid_to_year === null || x.valid_to_year >= year));
    return regionId(r!.code, r!.valid_from_year);
  };

  // Hierarkiet må inn nivå for nivå, ellers feiler selvreferansen på parent_code.
  for (const lvl of [2, 3, 5]) {
    parts.push(...insertMany('industries',
      ['id','nace_code','nace_level','parent_code','name','common_name','slug','search_terms'],
      a.industries.filter((i) => i.nace_level === lvl).map((i) => [
        q(industryId(i.nace_code)), q(i.nace_code), i.nace_level, q(i.parent_code),
        q(i.name), q(i.common_name), q(i.slug), arr(i.search_terms),
      ])));
  }

  parts.push(...insertMany('regions',
    ['id','code','name','level','parent_code','valid_from_year','valid_to_year'],
    a.regions.map((r) => [
      q(regionId(r.code, r.valid_from_year)), q(r.code), q(r.name), q(r.level),
      q(r.parent_code), r.valid_from_year, q(r.valid_to_year),
    ])));

  parts.push(...insertMany('region_population',
    ['region_id','year','innbyggere','source','data_quality'],
    a.population.map((p) => [
      q(regionId(p.region_code, p.vintage)), p.year, p.innbyggere, q('seed:folketall'), q('mock'),
    ])));

  parts.push(...insertMany('industry_stats',
    ['industry_id','region_id','year','unit_type','nace_level','region_level','n_enheter',
     'omsetning_total','omsetning_per_enhet','driftsresultat_total','driftsmargin_pct',
     'lonnskostnad_total','lonnsandel_pct','sysselsatte_total','sysselsatte_per_enhet',
     'arsverk_per_enhet','bearbeidingsverdi_total','verdiskaping_per_sysselsatt',
     'bruttoinvestering_total','merknader','source','data_quality','coverage'],
    a.rows.map((r) => [
      q(industryId(r.nace_code)), q(regFor(r.region_code, r.year)), r.year, q(r.unit_type),
      r.nace_level, q(r.region_level), q(r.n_enheter), q(r.omsetning_total),
      q(r.omsetning_per_enhet), q(r.driftsresultat_total), q(r.driftsmargin_pct),
      q(r.lonnskostnad_total), q(r.lonnsandel_pct), q(r.sysselsatte_total),
      q(r.sysselsatte_per_enhet), q(r.arsverk_per_enhet), q(r.bearbeidingsverdi_total),
      q(r.verdiskaping_per_sysselsatt), q(r.bruttoinvestering_total), jb(r.merknader),
      q(r.source), q('mock'), q('alle'),
    ])));

  parts.push(...insertMany('industry_demography',
    ['industry_id','region_id','year','nace_level','region_level','nyetableringer','nedleggelser',
     'konkurser','overlevelse_1ar_pct','overlevelse_3ar_pct','overlevelse_5ar_pct',
     'merknader','source','data_quality','coverage'],
    a.demography.map((d) => [
      q(industryId(d.nace_code)), q(regFor(d.region_code, d.year)), d.year, d.nace_level,
      q(d.region_level), q(d.nyetableringer), q(d.nedleggelser), q(d.konkurser),
      q(d.overlevelse_1ar_pct), q(d.overlevelse_3ar_pct), q(d.overlevelse_5ar_pct),
      jb(d.merknader), q(d.source), q('mock'), q('alle'),
    ])));

  parts.push(...insertMany('companies',
    ['org_nr','navn','nace_code','kommune_code','organisasjonsform','ansatte','omsetning',
     'driftsresultat','egenkapital','regnskapsar','source','data_quality'],
    a.companies.map((c) => [
      q(c.org_nr), q(c.navn), q(c.nace_code), q(c.kommune_code), q(c.organisasjonsform),
      q(c.ansatte), q(c.omsetning), q(c.driftsresultat), q(c.egenkapital), q(c.regnskapsar),
      q('seed:brreg'), q('mock'),
    ])));

  parts.push(...insertMany('industry_estimates',
    ['industry_id','region_id','metrikk','intervall_lav','intervall_hoy','enhet','konfidens',
     'begrunnelse','basert_pa','model','prompt_version','source','data_quality'],
    a.estimates.map((e) => [
      q(industryId(e.industry_nace)), 'NULL', q(e.metrikk), e.intervall_lav, e.intervall_hoy,
      q(e.enhet), q(e.konfidens), q(e.begrunnelse), jb(e.basert_pa), q(e.model),
      q(e.prompt_version), q(e.source), q('ai_anslag'),
    ])));

  parts.push(...insertMany('ai_insights',
    ['industry_id','region_id','year','type','tittel','body','alvorlighet','referanser',
     'knyttet_til','model','prompt_version','data_quality'],
    a.insights.map((i) => [
      q(industryId(i.industry_nace)), q(regFor(i.region_code, i.year)), i.year, q(i.type),
      q(i.tittel), q(i.body), i.alvorlighet, jb(i.referanser), q(i.knyttet_til),
      q(i.model), q(i.prompt_version), q('ai_anslag'),
    ])));

  parts.push('', 'commit;', '');
  return parts.join('\n');
}
```

- [ ] **Step 5: Skriv `seed/index.ts`**

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { makeRng } from './rng.js';
import { YEARS } from './config.js';
import { buildIndustries } from './industries.js';
import { buildRegions, regionsByYear } from './regions.js';
import { buildStats } from './stats.js';
import { buildCompanies } from './companies.js';
import { buildEstimates, buildInsights } from './ai.js';
import { emitSeed } from './emit.js';
import type { PopulationRow, SeedBundle, StatRow } from './types.js';

const SEED = 20260802;
const KOMMUNER = ['0301','1103','4601','5001','3201','1806','1108','3801','4204','1507'];

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
};

export function buildSeed(seed = SEED): SeedBundle {
  const rng = makeRng(seed);
  const industries = buildIndustries();
  const regions = buildRegions();
  const { rows, demography } = buildStats(rng, industries, regionsByYear());

  const population: PopulationRow[] = [];
  for (const r of regions) {
    for (const y of YEARS) {
      if (r.valid_from_year > y) continue;
      if (r.valid_to_year !== null && r.valid_to_year < y) continue;
      const base = r.level === 'land' ? 5_300_000 : 60_000 + (Math.abs(hash(r.code)) % 640_000);
      population.push({
        region_code: r.code, vintage: r.valid_from_year, year: y,
        innbyggere: Math.round(base * (1 + (y - 2017) * 0.006)),
      });
    }
  }

  const companies = buildCompanies(rng, industries, KOMMUNER);

  const byNace = new Map<string, StatRow[]>();
  for (const r of rows) {
    if (!byNace.has(r.nace_code)) byNace.set(r.nace_code, []);
    byNace.get(r.nace_code)!.push(r);
  }

  return {
    industries, regions, rows, demography, population, companies,
    estimates: buildEstimates(rng, industries),
    insights: buildInsights(rng, industries, byNace),
  };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const target = join(process.cwd(), 'supabase', 'seed', 'seed.sql');
  mkdirSync(dirname(target), { recursive: true });
  const sql = emitSeed(buildSeed());
  writeFileSync(target, sql);
  console.log(`Skrev ${target} (${(sql.length / 1024 / 1024).toFixed(1)} MB)`);
}
```

- [ ] **Step 6: Kjør og bekreft at testene passerer**

Run: `npm test`
Expected: PASS, 56 tester.

- [ ] **Step 7: Generer seed.sql og commit den**

Run: `npm run seed:build`
Expected: `Skrev .../supabase/seed/seed.sql (1.7 MB)`

```bash
git add seed/ids.ts seed/emit.ts seed/index.ts supabase/seed/seed.sql tests/seed-load.test.ts
git commit -m "feat(seed): emit deterministic seed.sql and verify it loads"
```

---

## Task 14: Edge function-stubber

Fire funksjoner, dokumentert men ikke implementert. De fylles når API-formene
er verifisert mot ekte endepunkter — noe som ikke kan gjøres fra
utviklingscontaineren, der `data.ssb.no` er blokkert av nettverkspolicyen.

Hver stub skal ha en kommentarblokk med kilde, endepunkt og hvilke kolonner
den fyller, og kaste en tydelig feil hvis den kalles.

**Files:**
- Create: `supabase/functions/import-ssb/index.ts`
- Create: `supabase/functions/import-brreg/index.ts`
- Create: `supabase/functions/compute-scores/index.ts`
- Create: `supabase/functions/generate-insights/index.ts`

- [ ] **Step 1: Skriv `supabase/functions/import-ssb/index.ts`**

```ts
/**
 * import-ssb — henter fra SSBs statistikkbank (PxWebApi v2).
 *
 * Kilde:      https://data.ssb.no/api/pxwebapi/v2-beta
 * Tabeller:   12910 (nasjonalt, NACE 2-5), 12936 (fylke, NACE 2-3),
 *             foretaksdemografi, konkurser, folketall
 * Fyller:     industry_stats, industry_demography, region_population
 *
 * FØRSTE KALL SKAL VÆRE metadata. GET /api/v2/tables/{id}/metadata avgjør
 * hvilke variabler tabellen faktisk tilbyr. Tre ting er uverifisert og må
 * sjekkes der før noe skrives:
 *   1. Har 12936 driftsresultat og bruttoinvestering?
 *   2. Er 2017-2023 publisert på datidens fylkesinndeling eller tilbakeskrevet
 *      til dagens 15? SSB publiserer en egen liste over tilbakeskrevne serier.
 *   3. Finnes arsverk i det hele tatt?
 * Alle tre lander på nullable kolonner, så skjemaet holder uansett svar.
 *
 * CELLEGRENSE. MaxDataCells er 10000 i referansekonfigurasjonen, og for store
 * uttrekk avvises — de trunkeres ikke. Les GET /api/v2/config ved oppstart og
 * dimensjoner batchene etter den faktiske verdien. Del langs NACE-gruppe.
 *
 * UTTRYKKSSYNTAKS. valueCodes er ikke bare literaler: `*` og `?` er jokertegn,
 * og TOP(n) / BOTTOM(n) / RANGE(a,b) / FROM(a) / TO(a) finnes. FROM(2017)
 * henter hele tidsserien uten å liste årstall.
 *
 * STANDARDTEGN. SSB fyller ikke tomme celler med tomhet. '.' betyr ikke
 * relevant, '..' oppgave mangler, ':' kommer senere, '-' er et EKTE NULL som
 * skal lagres som 0. I tillegg undertrykkes celler av konfidensialitetshensyn.
 * Oversett til NULL pluss en mangel_arsak i merknader. Leser man tegnene som
 * manglende data, forsvinner ekte nulltall og undertrykte celler ser ut som
 * datahull — den letteste feilen å gjøre her og den vanskeligste å oppdage.
 *
 * RATE LIMITING. SSB svarer 429 ved hyppige kall og kan blokkere IP-er ved
 * publisering klokka 08.00. Respekter Retry-After, bruk eksponentiell backoff,
 * og planlegg jobben utenfor morgenvinduet.
 *
 * IDEMPOTENS. Upsert på (industry_id, region_id, year, unit_type). En avbrutt
 * import skal kunne kjøres om igjen uten å duplisere.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error(
    'import-ssb er ikke implementert. Verifiser tabellmetadata og cellegrense først — se kommentarblokken.',
  );
}
```

- [ ] **Step 2: Skriv `supabase/functions/import-brreg/index.ts`**

```ts
/**
 * import-brreg — henter fra Brønnøysundregistrenes åpne API-er.
 *
 * Kilder:
 *   Enhetsregisteret:     https://data.brreg.no/enhetsregisteret/api/enheter
 *   Regnskapsregisteret:  https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
 * Fyller: companies
 *
 * DEKNING. Den åpne delen av Regnskapsregisteret gir nøkkeltall fra SIST
 * INNSENDTE årsregnskap — ett år, ikke tre. Tre år finnes bare i den lukkede
 * delen, som krever offentlig myndighet. Derfor har companies kun regnskapsar,
 * ikke en tidsserie.
 *
 * ENK. Enkeltpersonforetak leverer ikke årsregnskap. De skal fortsatt inn i
 * tabellen — de finnes i Enhetsregisteret og teller i foretakstetthet — men med
 * omsetning, driftsresultat, egenkapital og regnskapsar som NULL. Kolonnen
 * inngar_i_regnskapssnitt er generert og faller automatisk til false.
 *
 * ARBEIDSDELING. Enhetsregisteret støtter bulk og filtrering på naeringskode;
 * Regnskapsregisteret er oppslag per orgnr. Enumerer først fra
 * Enhetsregisteret, hent så regnskap kun for organisasjonsformer som leverer.
 *
 * IDEMPOTENS. Upsert på org_nr.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('import-brreg er ikke implementert — se kommentarblokken.');
}
```

- [ ] **Step 3: Skriv `supabase/functions/compute-scores/index.ts`**

```ts
/**
 * compute-scores — materialiserer industry_scores fra scoring-viewet.
 *
 * Kilde:  viewet industry_scores_computed (migrasjon 0006)
 * Fyller: industry_scores
 *
 * Selve beregningen ligger i SQL, ikke her. Et view kan ikke komme ut av synk
 * med dataene slik en cachet funksjon kan; denne funksjonen kopierer bare
 * resultatet til en tabell frontend kan lese raskt.
 *
 * Anslag fra industry_estimates inngår ALDRI. Se spec seksjon 4: blandes de
 * inn, blir scoren usammenlignbar på tvers av næringer — noen ville hvile på
 * SSB-tall, andre på en språkmodell, uten at rangeringen viser forskjellen.
 *
 * Kjøres etter hver import-ssb. Hele tabellen bygges om; det er noen tusen
 * rader, så inkrementell oppdatering er ikke verdt kompleksiteten.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('compute-scores er ikke implementert — se kommentarblokken.');
}
```

- [ ] **Step 4: Skriv `supabase/functions/generate-insights/index.ts`**

```ts
/**
 * generate-insights — produserer anslag og innsikt forankret i tallene.
 *
 * Fyller: industry_estimates, ai_insights
 *
 * REKKEFØLGEN ER POENGET. Hent tallene fra basen FØRST, send dem inn i
 * prompten, og skriv resultatet tilbake. En modell som svarer uten å ha sett
 * radene produserer tekst som høres riktig ut og ikke er det.
 *
 * OBLIGATORISK FORANKRING. Hver rad i ai_insights må ha ikke-tom referanser,
 * hver rad i industry_estimates ikke-tom basert_pa. Databasen håndhever det
 * med en check-constraint, så en uforankret påstand feiler ved skriving i
 * stedet for å havne i UI-et.
 *
 * ANSLAG ER SPENN. Oppgi intervall_lav og intervall_hoy med konfidens, ikke
 * ett presist tall. «Etableringskapital 300 000-800 000, middels konfidens» er
 * et ærlig svar; «512 000» er det ikke.
 *
 * BATCH, IKKE BRUKERFLYT. Kjøres planlagt og caches på
 * (industry_id, region_id, prompt_version). Ingen live modellkall når en
 * bruker åpner en side.
 */
export default async function handler(_req: Request): Promise<Response> {
  throw new Error('generate-insights er ikke implementert — se kommentarblokken.');
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions
git commit -m "docs(functions): add documented edge function stubs"
```

---

## Task 15: Overlevering til Lovable

Siste task. Produserer artefaktene som driver frontend-byggingen. Ingen kode
overføres — connectoren tar naturlig språk, og skjemaet i basen er kontrakten.

**Files:**
- Create: `lovable/knowledge.md`
- Create: `lovable/messages/00-oppsett.md` … `05-favoritter.md`

Innholdet ligger i repoet, ikke gjengitt her. Det var opprinnelig innebygd i
denne planen, men filene og planen drev fra hverandre to ganger — først da
posisjoneringen ble skrevet om, så da den visuelle retningen ble lagt til. En
plan som gjengir en fil den ikke eier, blir feil så snart filen endres. Les
filene direkte.

- [ ] **Step 1: `lovable/knowledge.md`**

Settes med `set_project_knowledge` og gjelder hver melding etterpå. Maks 10 000
tegn; ligger i dag rundt 6 000.

Dekker: posisjoneringen og de tre differensiatorene, de tre provenience-nivåene
og hvordan de merkes visuelt, at NULL aldri er 0, `merknader` og forskjellen på
undertrykt og upublisert, de to granularitetene, foretak mot virksomhet,
AS-avgrensningen, fylkesårgangene, den visuelle retningen med de fire
datamønstrene, regelen om at vekstpillen bare finnes der det er tidsserie, og
forbudet mot ferskhetspåstander.

- [ ] **Step 2: `lovable/messages/*.md`**

Én melding per side, sendt i rekkefølge med `send_message`. Hver beskriver hva
som skal bygges, ikke hvordan — skjemaet er kontrakten.

| Fil | Dekker |
|---|---|
| `00-oppsett.md` | Supabase-kobling, stack, de tre delte komponentene, genererte typer |
| `01-forside.md` | hero, topp 20 med filterrad, kategorichips, differensiatorene |
| `02-dashboard.md` | KPI-rad og to fordelingsgrafer |
| `03-naeringsside.md` | KPI-rutenett, dobbel granularitet, grafer, kart, score-nedbryting, anslag, innsikt, foretakstabell |
| `04-region-og-topplister.md` | hullene i markedet, og topplister for næringer, selskaper og kommuner |
| `05-favoritter.md` | auth med magic link, favoritter under RLS, innstillinger |

- [ ] **Step 3: Commit**

```bash
git add lovable
git commit -m "docs(lovable): add project knowledge and per-page handoff messages"
```

---

## Etter planen

Rekkefølgen for å ta dette i bruk:

1. Opprett et Supabase-prosjekt for Bransjeindeks. Kontoen har i dag kun
   `ScripturePath`.
2. Kjør migrasjonene 0001–0007 mot den basen.
3. `npm run seed:build && npm run seed:apply`
4. Deploy de fire edge function-stubbene så rutene finnes.
5. Opprett Lovable-prosjektet koblet til samme Supabase.
6. `set_project_knowledge` med `lovable/knowledge.md`.
7. Send meldingene i `lovable/messages/` i rekkefølge, én om gangen, og se på
   resultatet mellom hver.

Frontend får sin egen plan når det finnes en base å bygge mot.
