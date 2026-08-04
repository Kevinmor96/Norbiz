# Bransjeindeks

Beslutningsverktøy for den som vurderer å starte, kjøpe eller investere i en
bedrift i Norge. Svarer på ett spørsmål: **er denne typen virksomhet verdt å
drive, her?**

Repoet heter `Norbiz` av historiske grunner. Produktet heter Bransjeindeks.

## Hvor ting står

| Hva | Hvor |
|---|---|
| Designbeslutninger med begrunnelse | `docs/superpowers/specs/2026-08-02-norbiz-design.md` |
| Copy og posisjonering | `docs/superpowers/specs/2026-08-04-copy-og-posisjonering.md` |
| Folkelig kategorilag og topplister | `docs/superpowers/specs/2026-08-04-folkelig-kategorilag-design.md` |
| SSB- og Brreg-API verifisert | `docs/superpowers/specs/2026-08-04-ssb-api-verifisert.md` |
| Implementasjonsplan, 15 tasks | `docs/superpowers/plans/2026-08-02-norbiz-data-layer.md` |
| Skjema | `supabase/migrations/0001`–`0018` |
| Seed-generator | `seed/` — deterministisk, skriver `supabase/seed/seed.sql` |
| Kategorilaget (redaksjon, håndskrevet) | `supabase/seed/kategorier.sql` — kjøres etter seed.sql |
| Seed for miljø uten psql | `supabase/seed/indb/` — se README-en der |
| Edge functions | `supabase/functions/` — `import-ssb`, `import-brreg` og `import-demografi` er implementert og kjørt |
| Frontend-overlevering | `lovable/knowledge.md` + `lovable/messages/` |

**Les spec-en før du endrer datamodellen.** Beslutningene i seksjon 2 har
begrunnelser som ikke er åpenbare fra skjemaet alene, og flere av dem er tatt
etter at det motsatte ble prøvd og forkastet.

## Kommandoer

```bash
npm test              # 121 tester mot PGlite, ingen databaseserver nødvendig
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

**Aggregater hører i basen, ikke i frontend.** PostgREST avviser aggregater i
spørrestrengen, så `percentile_cont` og gruppering må gå gjennom funksjonene i
migrasjon 0010 (`industry_medians`, `industry_margin_histogram`,
`kommune_aggregat`) og 0015/0017 (`kategori_oversikt`, `topp_selskaper`,
`kategori_rangering`, `brand_liste`). Viktigst er `kommune_aggregat`: terskelen
`min_enheter_aggregat` er håndhevet der, fordi et filter som bare finnes i UI-et
ikke er en terskel — det er en anbefaling. Ingen av funksjonene er
`security definer`, alle views kjører med `security_invoker`, og tester
håndhever at det forblir slik.

**Folketall har én kilde.** `REGION_POPULATION` i `seed/config.ts` former både
de regionale cellestørrelsene og `region_population`. To kilder her betyr at
konkurransedelscoren — enheter per innbygger — regnes mot et annet folketall enn
det som bestemte hvor mange enheter det ble.

**Kategorimedlemmer overlapper aldri hierarkisk innen kategori og kilde.**
`kilde='ssb'` er SN2007-koder for statistikk, `kilde='brreg'` er
SN2025-prefikser for selskapsmatching — de to standardene er ikke samme
kodeverk, og companies bærer Brregs kode slik den kom. Både overlappsregelen
(56.1 sammen med 56.101 dobbelteller hele restaurantnæringen) og at
ssb-kodene faktisk finnes, håndheves av `tests/categories.test.ts`.

**En kategorisum er bare sammenlignbar over år hvis alle medlemskodene har
tallet.** 69.201 mangler omsetning for 2024; uten regelen i migrasjon 0016
falt Regnskap & revisjon fra 42,1 til 23,1 mrd og ble vist som −6 % vekst i
en næring som vokser. Samme mekanisme som undertrykte celler: et hull som ser
ut som et tall.

**Driftsmargin er ikke sammenlignbar mellom eierdrift og lønnsdrift.**
Fysioterapi har 56 % margin og 148 000 kr lønnskostnad per sysselsatt;
regnskap har 14 % og 820 000. Forskjellen er at eierens eget arbeid ikke er
lønnskostnad. Flagget `eierlonn_i_resultat` (migrasjon 0017) merker radene
der snittet er under 450 000 — omtrent én normal lønnskostnad — slik at en
marginliste ikke rangerer eierdrift øverst av en teknisk grunn. Tallet skal
merkes, ikke skjules.

**Brreg sorterer på ansatte, ikke omsetning.** `sort=antallAnsatte,desc` er
det eneste som gir de faktisk største selskapene; uten den leverer
Enhetsregisteret alfabetisk, og «topp 5 treningssenter» ble en A-liste.
Rangeringen i topplistene skjer på omsetning i basen — sorteringen bestemmer
bare hvem som blir hentet.

## Tidligere uverifisert — nå avklart mot kilden

De tre spørsmålene som sto åpne da skjemaet ble tegnet, er besvart (detaljer og
etterprøvbare spørringer i `docs/superpowers/specs/2026-08-04-ssb-api-verifisert.md`):

1. Regionaltabellen er **12937** (12936 har ingen regionsdimensjon), og den har
   kun Omsetning, Lønn, Bedrifter og Sysselsatte — driftsresultat og
   bruttoinvestering finnes ikke regionalt. Kolonnene er NULL der.
2. Region-dimensjonen bærer **alle fylkesårganger samtidig**; radene mapper til
   riktig vintage via `valid_from_year`/`valid_to_year`.
3. `Arsverk` finnes i 12910 (nasjonalt), ikke i 12937.

## Status

Datalaget: ferdig, 121 tester grønne, 18 migrasjoner.

**Supabase-prosjektet `jcpuhhrqhgrnihiacosy` har ekte data.** Tre importører er
deployet og kjørt 2026-08-04:

- `industry_stats`: 51 468 rader `data_quality='ssb'`, 2017–2024, nivå 2/3/5
  nasjonalt og nivå 2/3 per fylke. All mock-statistikk ble erstattet av
  upsertene.
- `industry_demography`: 9 500 rader `ssb` fra 08076 (nye foretak) og 07165
  (konkurser), per fylke og tosifret næring, 2017–2025. Mock-radene er
  slettet. Overlevelseskolonnene er null — 13701 har ingen næringsdimensjon.
- `companies`: 2 850 selskaper fra Brreg, 2 121 med regnskapstall. Hentet med
  `sort=antallAnsatte,desc` per kategoriprefiks, så topplistene viser de
  faktisk største. Mock-selskapene er slettet.
- `brands`: 40 kuraterte kjeder, 32 med org_nr og tall (Coop Extra 66,8 mrd,
  Elkjøp 13,9 mrd, IKEA 8,9 mrd, Scandic 6,7 mrd, SATS 1,6 mrd).
- `industry_scores`: 28 377 scorer, 26 770 med `score_total`.
- `industries`: 1 058 koder fra SSBs kodeliste; de 117 kuraterte beholder
  navn/slug fra seed (importen er insert-only, se headeren i import-ssb).
- `categories` / `category_members`: 30 folkelige kategorier i 6 verdener, 84
  medlemskoder. Alle 30 har tall i `kategori_oversikt()`.

Fortsatt syntetisk: `industry_wages` og `region_population` er seed-data
(`mock`/`beregnet`), og `industry_estimates`/`ai_insights` er `ai_anslag`.

Frontend bygges i Lovable-prosjektet `5bab9b75-aa19-4f9b-b7db-1472ffd79523` mot
den basen.

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
