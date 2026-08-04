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
| Edge functions | `supabase/functions/` — `import-ssb`, `import-brreg`, `import-demografi` og `brreg-sonde` er implementert og kjørt |
| Frontend-overlevering | `lovable/knowledge.md` + `lovable/messages/` |

**Les spec-en før du endrer datamodellen.** Beslutningene i seksjon 2 har
begrunnelser som ikke er åpenbare fra skjemaet alene, og flere av dem er tatt
etter at det motsatte ble prøvd og forkastet.

## Kommandoer

```bash
npm test              # 133 tester mot PGlite, ingen databaseserver nødvendig
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
lønnskostnad. Flagget `eierlonn_i_resultat` merker det, slik at en marginliste
ikke rangerer eierdrift øverst av en teknisk grunn. Tallet skal merkes, ikke
skjules.

Flagget krever **begge** forhold: under 450 000 kr per sysselsatt *og* under
tre ansatte per bedrift (migrasjon 0020). Lønn per sysselsatt alene fanget 18
av 30 kategorier, fordi lav lønn per hode har to helt ulike årsaker — ulønnet
eierarbeid, og deltid. Dagligvare har 374 000 kr per sysselsatt, men 23 ansatte
per butikk: der er stillingene små, eieren er ikke arbeidskraften. Påstanden
«eieren tar ikke ut lønn» var dermed usann for dagligvare, klesbutikk,
skobutikk, restaurant, bakeri og sportsbutikk — og den sto på forsiden. Med
begge vilkårene står fem kategorier igjen, og alle har 0,9–2,3 ansatte.

**`sort` bryter næringsfilteret hos Brreg. Bruk `fraAntallAnsatte`.**
`sort=antallAnsatte,desc` ser ut som det riktige verktøyet og ga tilsynelatende
perfekte lister — 93.13 ga SATS Norway først — men `47.11` med sortering
returnerer «HELSE MØRE OG ROMSDAL HF» som treff nummer én. Antallet i `page` er
riktig filtrert; radene er ikke. Feilen er usynlig i de kategoriene der den
største aktøren tilfeldigvis er riktig, og den ble bare oppdaget fordi fire
nye kategorier plutselig sto uten selskaper. `fraAntallAnsatte` respekterer
filteret; terskelen — ikke sorteringen — er det som gjør listene store nok.
Rangeringen skjer på omsetning i basen uansett.

**SN2025 har oppløst divisjon 45.** Hele «45» gir 0 treff hos Brreg. Bilsalg er
47.81, verksted 95.31, deler 47.82, motorsykkel 47.83/95.32 — mens SSB fortsatt
har 45.112/45.200/45.320/45.40x. Det er det største spranget mellom de to
standardene i kodesettet vårt, og hadde vi gjettet prefikset ut fra SSB-koden,
ville alle fire bil-topplistene vært tomme uten en eneste feilmelding.

**`fraAntallAnsatte` har gulv på 5, og det gir en skjevhet som må stå i UI-et.**
`fraAntallAnsatte=4` svarer HTTP 400 fra Brreg, `=5` svarer 200. Grensa er
udokumentert og feilen kommer som en tom liste, ikke som en melding. I næringer
der snittbedriften har 1–2 ansatte — frisør, fysioterapi, hudpleie — kan
selskapslistene derfor bare nå den øvre halen. Det er ikke et utvalg av
bransjen, det er de største i den.

**Kandidater til kjedelista finnes bedre i basen enn i gjetting.** Hermès har en
norsk enhet, men navnesøket «HERMES» ga bare et forsikringsselskap og et
reisebyrå: selskapet heter `HERMÈS NORWAY AS`, med aksent. Det dukket opp av seg
selv i skobutikk-topplisten da selskapsutvalget ble utvidet. Søk i `companies`
etter navn vi allerede har hentet, framfor å gjette skrivemåten.

**Et kommunenummer er ikke en konstant.** Seed-lista bar 3801 og 1507, som hører
til årgangen 2020–2023; fra 2024 er de 3905 Tønsberg og 1508 Ålesund.
`kommuner`-tabellen er 2024-årgangen fordi det er den Brreg registrerer
adresser mot. Brreg bruker i tillegg 2100 for Svalbard, som ikke finnes i SSBs
klassifikasjon 131 — raden er lagt inn manuelt med `source='manuell:brreg-avvik'`.

**Luksus er en merking av aktøren, ikke en bransje.** SSB har ingen luksuskode,
så en luksuskategori med margin og vekst måtte lånt tallene fra klesbutikk og
gullsmed eller diktet dem. `brands.segment` bærer merkingen, og
`topp_selskaper` returnerer `merke` og `segment` slik at Louis Vuitton kan stå
i skobutikk-topplisten med en forklaring i stedet for å bli filtrert bort —
selskapet ER registrert på 47.720 hos Brreg, og å fjerne det ville vært å
redigere Enhetsregisteret. Samme kobling gjør at «REITAN CONVENIENCE NORWAY AS»
kan vises som «Narvesen».

**Foretak er ikke bedrifter, og etiketten må si hvilket tall det er.**
Skobutikk har 205 foretak og 565 virksomheter. I SSBs terminologi ER en bedrift
virksomheten, så et foretakstall under etiketten «bedrifter» leses som feil av
alle som kjenner bransjen. `kategori_oversikt` returnerer derfor `n_foretak` og
`n_virksomheter` hver for seg (migrasjon 0023), og avviket er størst i nettopp
de kategoriene der folk har best magefølelse: butikk og servering.

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

Datalaget: ferdig, 133 tester grønne, 26 migrasjoner.

**Supabase-prosjektet `jcpuhhrqhgrnihiacosy` har ekte data.** Tre importører er
deployet og kjørt 2026-08-04:

- `industry_stats`: 51 468 rader `data_quality='ssb'`, 2017–2024, nivå 2/3/5
  nasjonalt og nivå 2/3 per fylke. All mock-statistikk ble erstattet av
  upsertene.
- `industry_demography`: 9 500 rader `ssb` fra 08076 (nye foretak) og 07165
  (konkurser), per fylke og tosifret næring, 2017–2025. Mock-radene er
  slettet. Overlevelseskolonnene er null — 13701 har ingen næringsdimensjon.
- `companies`: 5 805 selskaper fra Brreg, 4 946 med regnskapstall, fordelt på
  309 av 358 kommuner. Hentet med `fraAntallAnsatte` per kategoriprefiks i flere
  passeringer med synkende terskel (150 → 40 → 8 → 5), og `?hopp=1` sørger for
  at budsjettet går til nye selskaper framfor å lese de gamle om igjen. Hver
  kategori har minst 32 selskaper med tall. Mock-selskapene er slettet.
- `brands`: 49 kuraterte kjeder, 40 med org_nr og tall (Coop Extra 66,8 mrd,
  Elkjøp 13,9 mrd, IKEA 8,9 mrd, Scandic 6,7 mrd, SATS 1,6 mrd), pluss ni
  merket `segment='luksus'` (Urmaker Bjerke 743 mill., Hermès 332 mill. med
  20,6 % margin, Louis Vuitton 330 mill. med 25,3 %).
- `industry_scores`: 28 377 scorer, 26 770 med `score_total`.
- `industries`: 1 058 koder fra SSBs kodeliste; de 117 kuraterte beholder
  navn/slug fra seed (importen er insert-only, se headeren i import-ssb).
- `categories` / `category_members`: 40 folkelige kategorier i 9 verdener, 108
  medlemskoder. Alle 40 har tall i `kategori_oversikt()`, og alle har en
  selskapsliste.
- `kommuner`: 358 rader fra SSBs klassifikasjon 131 (2024-årgangen) pluss
  Svalbard og Jan Mayen manuelt. Ingen selskaper står med ukjent kommunekode.

**`probe-brreg` er utdatert og bør slettes fra Supabase-dashbordet.** Den ble
deployet ad hoc under kategoriarbeidet, uten fil i repoet — og ble derfor
duplisert som `brreg-sonde`, som gjør det samme men er sporbar her. To sonder
med samme jobb betyr at neste person retter feil i den ene.

**`generate-insights` er implementert og deployet (v1), men venter på nøkkel.**
Uten `ANTHROPIC_API_KEY` som function secret svarer den 500 med
`{"feil":"mangler ANTHROPIC_API_KEY"}` — verifisert. `industry_estimates` og
`ai_insights` inneholder derfor fortsatt seed-generert `ai_anslag`, ikke
modellsvar.

**Forankring håndheves to steder, og bare det andre er verdt noe.** Databasens
check-constraint krever at `referanser` og `basert_pa` er ikke-tomme — men en
modell kan fylle dem med noe som *ser ut som* en referanse. Derfor validerer
`generate-insights` hver referanse mot nyttelasten den faktisk sendte:
næringskoden må være næringens egen, årstallene må være år vi sendte,
feltnavnene må være felt vi sendte. Rader som viser til noe modellen ikke fikk,
forkastes og telles i `forkastet` i svaret. En prompt som begynner å hallusinere
blir da et tall i loggen, ikke feil tekst i UI-et.

**Lønnstall går ikke inn i prompten.** `industry_wages` er fortsatt `mock`, og
en innsikt forankret i mock-tall er en oppdiktet påstand med kildehenvisning —
verre enn ingen innsikt. Bare `data_quality='ssb'` sendes inn.

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
