Nå kobler vi på databasen. Les prosjektkunnskapen først — den er den bindende
kontrakten for hele appen, og reglene der overstyrer eventuelle standardvalg.

Døp om prosjektet til **Bransjeindeks**.

## 1. Supabase-klient mot eksternt prosjekt

Ikke aktiver Lovable Cloud. Ikke opprett noen database. Ikke kjør migrasjoner.
Basen er ferdig migrert og fylt med data, og skjemaet skal ikke endres.

```
VITE_SUPABASE_URL=https://jcpuhhrqhgrnihiacosy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key fra Supabase>
```

Legg dem i `.env`, og lag `src/integrations/supabase/client.ts` med en
`createClient<Database>`-instans.

## 2. Typer — ikke skriv dem for hånd

PostgREST publiserer hele skjemaet som et OpenAPI-dokument:

```
GET https://jcpuhhrqhgrnihiacosy.supabase.co/rest/v1/?apikey=<publishable key>
```

Bruk det som kilde til typene, så blir de faktiske og ikke gjettede. Verifiser
mot basen etterpå med en `select` mot et par tabeller.

> **Det som faktisk skjedde:** OpenAPI-roten svarte ikke på den nye
> publishable-nøkkelen. Agenten løste det ved å hente tre rader fra hver av de
> 15 tabellene og 4 viewene og utlede typene derfra. Verdt å vite neste gang —
> radprøving er den fungerende veien, ikke skjemadokumentet.

Skjemaet, så du vet hva du skal finne:

**Kjernedata**
- `industries` — 102 rader. `nace_code`, `nace_level` (2, 3 eller 5),
  `parent_code` (selvreferanse), `name`, `common_name`, `slug`, `search_terms`.
  `common_name` er det brukervennlige navnet («Frisørsalong»), `name` er SSBs
  offisielle. Bruk `common_name` i UI.
- `regions` — 44 rader. `code`, `name`, `level`, `valid_from_year`,
  `valid_to_year`. Samme fylkeskode finnes i flere årganger med ulik `id` —
  filtrer alltid på år.
- `region_population` — `region_id`, `year`, `innbyggere`.

**Statistikk**
- `industry_stats` — 4 943 rader, 2017–2023.
- `industry_demography` — 4 229 rader. Nyetableringer, nedleggelser, konkurser,
  overlevelse etter 1, 3 og 5 år.
- `industry_wages` — 5 795 rader, 2015–2025. `manedslonn_median`,
  `manedslonn_desil1`, `manedslonn_desil9`, `yrke_kode`. `yrke_kode is null`
  betyr hele næringen. `region_id` og `region_level` er nullbare.

**Score**
- `industry_scores` — 4 893 rader. Seks delscorer, `score_total`, og
  `forklaring` (jsonb med råtall, persentil og vekt per delscore). Alt er
  persentiler 0–100 innenfor peer-gruppen
  `(region_id, year, nace_level, unit_type)`.
- `score_weights` og `score_config` — `min_enheter` (20) og
  `min_enheter_aggregat` (5). Les dem fra basen, ikke hardkod.
- Views: `industry_scores_computed`, `score_raw`, `score_long`,
  `score_long_pct`. Frontend leser `industry_scores`, ikke viewene.

**Selskaper og AI**
- `companies` — 300 rader, med den genererte `inngar_i_regnskapssnitt`. ENK har
  `omsetning is null` og `false`.
- `industry_estimates` — 195 rader. `etableringskapital`,
  `tid_til_lonnsomhet`, `sesongvariasjon`, hver som spenn med konfidens.
- `ai_insights` — 50 rader, fem typer, `alvorlighet` 1–5.
- `companies_snapshot` og `ai_reports` — tomme. Ignorer dem.
- `favorites` — brukereid, RLS. Kommer i siste melding.

Alle lesetabeller har RLS med offentlig lesetilgang. `favorites` krever
innlogging.

## 3. Oppsett

TanStack Query, shadcn/ui og Recharts. Mørk modus som standard, lys modus
tilgjengelig.

Lag de tre delte komponentene som er beskrevet i prosjektkunnskapen —
`DataBadge`, `InsightCard` og `Footnotes`. Bygg dem først, alle sidene bruker
dem.

Merk: all data i basen har i dag `data_quality = 'mock'` (eller `beregnet` /
`ai_anslag` for lønnskoblinger og anslag). `DataBadge` skal derfor faktisk vise
«Demo-data» over hele appen nå. Det er riktig og skal ikke skjules — badgen er
poenget.

## 4. Ikke bygg sider ennå

Bare klient, typer og de tre komponentene. Sidene kommer i egne meldinger.
