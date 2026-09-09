# Seed som databasen genererer selv

`../seed.sql` er den kanoniske demo-seed-en: 1,7 MB, deterministisk, kjøres med
`psql`. Denne mappen er en **alternativ vei inn i basen** for miljøer der psql
ikke er et alternativ.

## Hvorfor den finnes

Utviklingsmiljøet har ingen nettverksrute til Supabase-basen: HTTPS til
`supabase.co` blokkeres av proxyen, og utgående 5432 timer ut mot både direkte
host og pooler (direktetilkobling er IPv6-only). Den eneste veien inn er
Supabase-MCP-serveren, som kjører utenfor containeren — og 1,7 MB SQL får ikke
plass i en verktøyparameter.

Løsningen er å ikke sende dataene, men **oppskriften**: fem filer på til sammen
35 KB som lar basen bygge datasettet selv.

## Hva den garanterer, og hva den ikke garanterer

Samme **form** som `seed.sql`, ikke samme bytes. Radantallene er ikke like, og
det er ikke meningen at de skal være det. Formkravene som holder i begge:

| Krav | Hvor det håndheves |
|---|---|
| Nasjonale rader på NACE 2–5, regionale kun 2–3 | `industry_stats_regional_grain` |
| `driftsmargin_pct` NULL i regionale rader | del 02 |
| Undertrykte celler med `merknader` | del 02, små næringer i små fylker |
| Fylkesårganger 17 / 11 / 15 | del 01 |
| ENK uten regnskapstall | `inngar_i_regnskapssnitt`, del 03 |
| Anslag som spenn, aldri ett tall | del 03 |
| Alt merket `mock`, `ai_anslag` eller `beregnet` | alle deler |

Ingen rad påstår `data_quality = 'ssb'` eller `'brreg'`. Ingenting her er hentet
fra en kilde.

## Rekkefølge og forutsetninger

Delene må kjøres i nummerrekkefølge. Del 01 lager tre byggetabeller — `_src`,
`_reg`, `_band` — og funksjonen `_noise`. Del 05 rydder dem bort igjen.

Byggetabellene er **vanlige tabeller, ikke temp**. Sendes delene som separate
kall kan hvert kall landet på en ny tilkobling, og en temp-tabell ville da vært
borte i del 02. De har ingen `grant`, så `anon` ser dem ikke mens de finnes.

```bash
for f in supabase/seed/indb/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Til slutt kjøres `../kategorier.sql` — det kuraterte kategorilaget. Den er
håndskrevet og liten nok for ett `execute_sql`-kall, så den trenger ingen
oppskrift-variant. Den må kjøres etter delene over: seed-ens `truncate
industries cascade` tømmer `category_members`.

## Determinisme

`_noise(k)` er `hashtext(k) % 1000000 / 1000000`. Nøkkelen må bygges av
**naturlige nøkler** — næringskode, fylkeskode, årgang, år. Såes støyen på
`id`-kolonner i stedet, som er `gen_random_uuid()`, gir hver kjøring nye tall.
Det var en reell feil her: demografien var sådd på `industry_stats.id`, og siden
demografien mater risikodelscoren flyttet hele `industry_scores` seg mellom
kjøringer selv om statistikken var identisk.

Verifisert mot PGlite (PG 18.3) og mot live Postgres 17: identiske md5-summer
for statistikk, demografi, selskaper, score og lønn. `hashtext` gir samme tall i
begge.

Én felle ved slik verifisering: `string_agg(x order by x)` sorterer etter
kollasjon, så to baser med ulik `lc_collate` gir ulik sum av identiske data.
Bruk `order by x collate "C"`.

## Lønn

Del 05 fyller `industry_wages`, som **ikke finnes i `seed.sql`**. Serien går
2015–2025, mot strukturstatistikkens 2017–2023. To ting følger av det:

- Det finnes lønnstall for år uten noe annet tall i basen. De to seriene skal
  ikke framstilles som samme periode.
- Lønn er den eneste serien som treffer fylkesårgangen fra 2024, så det er den
  eneste flaten der kartet skal laste 15 fylker.
