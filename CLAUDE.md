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
| Skjema | `supabase/migrations/0001`–`0009` |
| Seed-generator | `seed/` — deterministisk, skriver `supabase/seed/seed.sql` |
| Seed for miljø uten psql | `supabase/seed/indb/` — se README-en der |
| Edge functions | `supabase/functions/` — **dokumenterte stubber, ikke implementert** |
| Frontend-overlevering | `lovable/knowledge.md` + `lovable/messages/` |

**Les spec-en før du endrer datamodellen.** Beslutningene i seksjon 2 har
begrunnelser som ikke er åpenbare fra skjemaet alene, og flere av dem er tatt
etter at det motsatte ble prøvd og forkastet.

## Kommandoer

```bash
npm test              # 90 tester mot PGlite, ingen databaseserver nødvendig
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

**Lønnsspennet er målt, ikke gjettet.** `industry_wages` bærer 1. og 9. desil
fra SSBs statistikkmål-dimensjon. Anslagslaget er for der kilden tier — her tier
den ikke, så spennet skal ikke merkes som anslag. Radene med `yrke_kode` er et
unntak: koblingen NACE-til-yrke er vår, ikke SSBs, og de er `beregnet`.

**Støy i seed må såes på naturlige nøkler.** `_noise('...' || st.id)` ser
harmløst ut, men `id` er `gen_random_uuid()`, så seed-en slutter å være
deterministisk. Det traff demografien, og siden demografien mater
risikodelscoren flyttet hele `industry_scores` seg mellom kjøringer mens
statistikken var byte-identisk.

**Folketall har én kilde.** `REGION_POPULATION` i `seed/config.ts` former både
de regionale cellestørrelsene og `region_population`. To kilder her betyr at
konkurransedelscoren — enheter per innbygger — regnes mot et annet folketall enn
det som bestemte hvor mange enheter det ble.

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

Datalaget: ferdig, 90 tester grønne.

**Supabase-prosjektet `jcpuhhrqhgrnihiacosy` lever**, med alle ni migrasjoner
applikert og demo-seed lastet: 102 næringer, 44 regioner, 4 943 statistikkrader,
5 795 lønnsrader, 4 893 scorer, 300 selskaper. Skjemaet der er verifisert
identisk med PGlite, og scoringsviewet gir samme tall på begge.

Frontend bygges i Lovable-prosjektet `5bab9b75-aa19-4f9b-b7db-1472ffd79523` mot
den basen.

Ikke gjort: **all data er syntetisk.** Ingen rad påstår `ssb` eller `brreg` —
alt er `mock`, `beregnet` eller `ai_anslag`. Edge-funksjonene som skulle hentet
det ekte er fortsatt stubber.

### Nettverket i utviklingsmiljøet

Containeren har **ingen rute til Supabase-basen**: HTTPS til `supabase.co` gir
403 på CONNECT fra proxyen, og utgående 5432 timer ut mot både direkte host og
begge poolerne — direktetilkobling er IPv6-only. Eneste vei inn er
Supabase-MCP-serveren, som kjører utenfor containeren.

Derfor finnes `supabase/seed/indb/`: `seed.sql` er for stor for en
verktøyparameter, så basen bygger datasettet selv fra fem små filer.

Når du sammenligner data mellom to baser: `string_agg(x order by x)` sorterer
etter kollasjon, så identiske data gir ulik sum. Bruk `order by x collate "C"`.

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
