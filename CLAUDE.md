# Bransjeindeks

Beslutningsverktøy for den som vurderer å starte, kjøpe eller investere i en
bedrift i Norge. Svarer på ett spørsmål: **er denne typen virksomhet verdt å
drive, her?**

Repoet heter `Norbiz` av historiske grunner. Produktet heter Bransjeindeks.

## Hvor ting står

| Hva | Hvor |
|---|---|
| Designbeslutninger med begrunnelse | `docs/superpowers/specs/2026-08-02-norbiz-design.md` |
| Implementasjonsplan, 15 tasks | `docs/superpowers/plans/2026-08-02-norbiz-data-layer.md` |
| Skjema | `supabase/migrations/0001`–`0007` |
| Seed-generator | `seed/` — deterministisk, skriver `supabase/seed/seed.sql` |
| Edge functions | `supabase/functions/` — **dokumenterte stubber, ikke implementert** |
| Frontend-overlevering | `lovable/knowledge.md` + `lovable/messages/` |

**Les spec-en før du endrer datamodellen.** Beslutningene i seksjon 2 har
begrunnelser som ikke er åpenbare fra skjemaet alene, og flere av dem er tatt
etter at det motsatte ble prøvd og forkastet.

## Kommandoer

```bash
npm test              # 57 tester mot PGlite, ingen databaseserver nødvendig
npx tsc --noEmit      # skal gå rent
npm run seed:build    # regenererer supabase/seed/seed.sql (deterministisk)
npm run seed:apply    # krever DATABASE_URL
```

## Arkitektur

Datalaget er ferdig og lever her. Frontend bygges av Lovables agent mot samme
Supabase-base — connectoren tar naturlig språk, ikke kode, så skjemaet i basen
er kontrakten mellom de to.

Testene kjører mot **PGlite**, Postgres kompilert til WASM. Det finnes ingen
Docker-daemon og ingen Postgres-server i utviklingsmiljøet. `tests/helpers/db.ts`
applikerer en Supabase-stub og alle migrasjonene i filnavnrekkefølge.

## Invarianter som ikke skal brytes

**Regionale rader finnes kun på NACE 2–3.** SSB publiserer ikke femsifrede
næringstall per fylke. Databasen håndhever det med
`industry_stats_regional_grain`. Ikke fjern constrainten for å få rutenettet
til å gå opp.

**NULL er fem forskjellige svar.** SSB bruker standardtegn: `.` ikke relevant,
`..` oppgave mangler, `:` kommer senere, `-` et *ekte* null. I tillegg
undertrykkes celler av konfidensialitetshensyn. Kolonnen `merknader` kartlegger
felt til `mangel_arsak`. Leser man tegnene som manglende data, forsvinner ekte
nulltall og undertrykte celler ser ut som hull.

**Anslag deler aldri kolonne med målte tall, og går aldri inn i
`score_total`.** `industry_estimates` er egen tabell nettopp fordi
`industry_stats` skal kunne reimporteres idempotent uten at importen stryker
anslagene.

**Foretak og virksomhet er ikke det samme.** `unit_type` skiller dem. En
frisørkjede er ett foretak og ti virksomheter. Regionale rader finnes kun for
`virksomhet`. Ikke summer på tvers.

**Vekstpiller bare der det finnes tidsserie.** Næringer og fylker har
2017–2023. Selskaper har ett regnskapsår fra Brreg, så de får årstempel. Ikke
lån næringens vekst og la den se ut som selskapets.

**Ingen ferskhetspåstander.** SSB publiserer årlig med ett til to års
etterslep. «LIVE», «sanntid» og «oppdatert daglig» er løgn her.

## Uverifisert med vilje

`data.ssb.no` er blokkert av nettverkspolicyen i utviklingsmiljøet, så tre
fakta står åpne og må avklares når `import-ssb` skrives:

1. Har den regionale tabellen (12936) `driftsresultat` og `bruttoinvestering`?
2. Er 2017–2023 publisert på datidens fylkesinndeling, eller tilbakeskrevet til
   dagens 15?
3. Finnes `arsverk` i det hele tatt?

Alle tre lander på nullable kolonner, så skjemaet holder uansett svar.
`GET /api/v2/tables/12936/metadata` er spesifisert som importens første kall.

## Status

Datalaget: ferdig, 57 tester grønne, merget til `main`.

Ikke gjort: **ingen Supabase-base er opprettet**, så ingenting er kjørt mot en
levende database. Edge-funksjonene er stubber. Frontend er ikke bygget.

## Graphify

`graphify-out/graph.json` er en kunnskapsgraf over koden, spørrbar via
graphify-MCP-serveren i `.mcp.json`.

Den dekker **bare kode**. Dokumentene i `docs/` og `lovable/` krever semantisk
ekstraksjon med en LLM-nøkkel, og det finnes ingen i dette miljøet — så
grafen kjenner strukturen, ikke begrunnelsene. Regenerer med:

```bash
graphify extract . --code-only     # uten nøkkel
graphify extract .                 # med ANTHROPIC_API_KEY, tar også docs
```
