# Maktkart

Svarer på ett spørsmål, stilt slik folk faktisk stiller det: **hvem bestemmer
her?** Organene, rollene og pengene i en kommune, og hvordan de henger sammen,
med kilde og dato på hver påstand. Tromsø først, bygget som én mal for alle
kommuner i landet.

Repoet heter `Norbiz` av historiske grunner. Det bar Bransjesjekk fram til
2026-09-24, da Maktkart overtok. Bransjesjekk ligger urørt i `arkiv/bransjesjekk/`
med egen `CLAUDE.md`. Ikke endre noe der. Brreg-lærdommene derfra er løftet inn
nedenfor, fordi de gjelder like mye her.

«Maktkart» er arbeidsnavn. Navn og domene er ikke bestemt (se spec §8).

## Hvor ting står

| Hva | Hvor |
|---|---|
| Produkt- og designkrav, hva vi bevisst ikke bygger, Lovable-vurdering | `docs/spec/2026-09-24-maktkart-mvp.md` |
| Researchgrunnlaget, den eneste faktakilden i MVP | `docs/research/2026-09-24-maktkart-researchgrunnlag.md` |
| Designsystem | `DESIGN.md` |
| Datakontrakten (typer) | `src/data/types.ts` |
| Kanonisk datasett per kommune | `src/data/<kommune>.json` |
| Lese-API: typer, lokal implementasjon | `src/lib/data/` |
| Skjema, RLS, RPC-er | `supabase/migrations/` |
| Seed-generator (JSON → SQL, deterministisk) | `scripts/seed-build.ts` → `supabase/seed/seed.sql` |
| Tester (PGlite, ingen databaseserver) | `tests/` |
| Delte komponenter (kildemerke, tegnforklaring, kartblad) | `src/components/maktkart/` |
| Kommunesidens seksjoner | `src/components/kommune/` |
| Terreng per kommune (byggesteg) | `scripts/terreng.ts` → `src/data/terreng/` |
| De tre designretningene og dommernes vurderinger | `docs/design/` |
| Flytting til Lovable, og prosjektkunnskapen dit | `docs/lovable-overforing.md`, `lovable/knowledge.md` |
| Bransjesjekk, arkivert | `arkiv/bransjesjekk/` |

**Les spec-en før du endrer datamodellen eller en seksjon på kommunesiden.**
Flere krav der har en begrunnelse som ikke er åpenbar fra koden.

## Kommandoer

```bash
npm run dev           # utviklingsserver
npm run build         # produksjonsbygg (Lovables standard, Cloudflare-mål)
npm run build:node    # produksjonsbygg for lokal kjøring, så: HOST=127.0.0.1 PORT=3000 npm start
npm run build:statisk # forhåndsrendret statisk eksport til .output/public
npm run typecheck     # tsc --noEmit, skal gå rent
npm test              # PGlite-tester: skjema, personvern, kontrakt, datasett, mal
npm run seed:build    # regenererer supabase/seed/seed.sql fra src/data/*.json (byte-identisk)
npm run terreng       # henter høydedata og skriver src/data/terreng/<kommunenr>.json
npm run brreg -- 5501 # virksomheter, roller og regnskap fra Brreg (krever MAKTKART_PERSON_SALT)
npm run sjekk:graf    # determinisme og etikettkollisjoner i nettverksoppsettet
npm run data:indeks   # regenererer src/lib/data/indeks.json etter endringer i datasettene
```

`npm run preview` virker ikke med Lovables konfigurasjon. Bruk `build:node` og
`start`.

## Arkitektur

Appen har samme stack som Lovable genererer: TanStack Start (SSR), React 19,
Vite, Tailwind 4, shadcn/ui og Supabase, speilet fra Lovables eget oppsett
(`@lovable.dev/vite-tanstack-config`). Den skal kunne flyttes til Lovable som en
kopi, ikke en omskriving.

**Datasettet er én kilde.** `src/data/<kommune>.json` leses av UI-et via
`src/lib/data/lokal.ts` og blir til seed-SQL via `scripts/seed-build.ts`.
Supabase-RPC-ene returnerer de samme formene som `lokal.ts`. Det håndheves av
`tests/kontrakt.test.ts`, som laster seed-en i PGlite, kaller hver RPC og
sammenligner med `lokal.ts`. Byttet til Supabase er derfor bare et bytte av
implementasjon i `src/lib/data/index.ts`.

**Datasettene lastes per kommune, på serveren.** Med 80 kommuner kan ikke en
side laste alle filene. `src/lib/data/indeks.json` sier hvilke filer hvert svar
trenger, fordi samlingen er en union: rollene i et organ kan stå i en annen
kommunes fil. `tests/lat.test.ts` beviser at svaret over de filene er likt
svaret over alle, og at den innsjekkede indeksen er oppdatert. Kjør derfor
`npm run data:indeks` etter hver endring i `src/data/`, som `seed:build`.
Nettleseren får aldri datalaget. HTML-en har en lett nyttelast
(`src/lib/lettside.ts`), og resten hentes etter visning via serverfunksjoner i
`src/lib/data/hent.ts`. I den statiske eksporten er det filer under `/data/`.
Terrenget serveres som SVG fra `/kart/terreng/<kommunenr>.svg`.

## Invarianter som ikke skal brytes

**Institusjon først.** En person finnes bare gjennom en rolle i en organisasjon.
`Person` har bare `key` og `navn` i datasettet. Siden har ingen personbilder,
ingen personprofiler og ingen topplister over mennesker. I nettverksgrafen er
organet noden og personen kanten.

**Personvernet håndheves i basen.** Det gjøres med RLS og kolonnerettigheter på
basistabellene, ikke med views som filtrerer. Et view hjelper ikke når
basistabellen er åpen. Filteret er da en anbefaling, ikke en regel. Ingen
funksjon er `security definer`, og alle views kjører med `security_invoker`.
Testene håndhever det.

**Hver påstand har belegg.** Belegget er en kilde og en verifiseringsgrad:
`verifisert`, `oppgitt` eller `maa_verifiseres`. Et tall uten kilde vises ikke.
Gradene skiller seg i form, ikke bare i farge. Kildemerket er produktets signatur.

**Ingenting er `verifisert` før pipelinen har hentet det.** `verifisert` betyr
at et skript har hentet påstanden fra et register (Brreg, Regnskapsregisteret,
SSB, Valgdirektoratet, data.stortinget.no), og at raden har hentedato i `per`.
Tekst lest av en nettside er `oppgitt`, også når det er organets egen side.
Forhåndsversjonsmerket regnes fra gradene i datasettet. Det sier aldri
«ikke etterprøvd» om noe som er etterprøvd, eller omvendt. Tall fra Proff eller
Purehelp er alltid `maa_verifiseres`: grunnlaget sier selv at de skal sjekkes
mot Regnskapsregisteret.

**Registeret vinner over grunnlaget på registrerte roller.** Når Brreg sier
noe annet enn researchgrunnlaget om daglig leder, styreleder, nestleder eller
styremedlem, gjelder Brreg. Grunnlagets påstand merkes som motsagt og beholdes i
historikken. Den slettes aldri stille. Avvikene listes i `docs/avvik/`. Roller
som ikke registreres i Brreg, som statsforvalter og ordfører, er ikke
motsigelser selv om Brregs «daglig leder» er en annen person.

**Ingen ferskhetspåstander.** «LIVE», «sanntid» og «oppdateres daglig» brukes
ikke før pipelinen faktisk gjør det. Skriv «sammenstilt 24.09.2026».

**Ingen sammensatt maktscore på den offentlige siden.** Scoren i grunnlaget har
sju vektede ledd, og minst tre av dem mangler data for Tromsø. En score på
delvise data er et tall leseren tror på uten grunn. Vi viser myndighetsprofil,
eierskap og beslutningskjeder, som er fakta.

**Et tall har år.** Et nøkkeltall uten regnskapsår tas ikke inn. Det føres i
`hull`. Morselskap og konsern merkes der kilden skiller dem.

**Planlagt er ikke skjedd.** Valget i 2027, byrådsdebatten og «fungerende til
januar 2027» er hendelser med egen type og egen stil.

**Malen vet ikke at den handler om Tromsø.** Ingen komponent hardkoder kommunen.
Tomme og manglende tilstander er designet, fordi neste kommune har færre data.

**Aggregater hører i basen.** PostgREST avviser aggregater i spørrestrengen og
kapper ved 1 000 rader. En median eller sum regnet i klienten over en kappet
liste blir feil uten feilmelding. Dette skjedde i Bransjesjekk, der «siste år»
ble 2018. RPC-ene gjør aggregeringen.

**Seed-en er deterministisk.** ID-er avledes av naturlige nøkler (`key`), aldri
av `gen_random_uuid()`. En ikke-deterministisk ID flyttet i Bransjesjekk alle
avledede tall mellom kjøringer mens kildedataene var byte-identiske.

## Brreg — lærdommer fra Bransjesjekk

Maktkart henter fra de samme registrene. Disse ble lært på den harde måten:

- **`sort` bryter filteret i Enhetsregisterets søk.** Antallet i `page` er
  filtrert, men radene er det ikke. Filtrer og ranger heller i basen.
- **`fraAntallAnsatte` har et udokumentert gulv på 5.** Verdien `=4` gir HTTP 400,
  og feilen kommer som en tom liste.
- **Et kommunenummer er ikke en konstant.** 3801 og 1507 ble 3905 og 1508 i 2024.
  Troms fikk 55-numre da fylket ble gjenopprettet 1.1.2024. Brreg bruker 2100 for
  Svalbard, som ikke finnes i SSBs klassifikasjon 131.
- **SN2025 er ikke SN2007.** Brreg fører SN2025. Samme kode kan bety forskjellige
  ting: 47.762 er blomster i SN2007 og kjæledyr i SN2025. Les hva koden HETER,
  ikke bare hvor mange treff den gir.
- **Navn kan ha aksenter.** Selskapet heter `HERMÈS NORWAY AS`, og et navnesøk
  på «HERMES» finner det ikke. Navnematching på personer må tåle det samme.
- **Valuta.** Noen konsern fører regnskap i USD eller EUR. Tallene blandes aldri
  i en NOK-sum uten omregning, og omregningen merkes.
- **Enhet og underenhet er ikke det samme.** En kjede er ett foretak og mange
  virksomheter. Ikke summer på tvers.
- **Hent ved kilden.** Proff og Purehelp videreselger Brreg med databasevern og
  avtalevilkår. Vi henter fra registrene.

Importørene i `arkiv/bransjesjekk/supabase/functions/` (`import-brreg` og
`brreg-sonde`) kjører allerede mot Brreg fra Supabase. De er startpunktet for
Maktkarts verifiseringspipeline.

## Nettverket i utviklingsmiljøet

Nettverket styres av miljøets innstillinger. Fra 2026-09-25 er det åpnet for
Brreg, SSB, Geonorge, Valgdirektoratet, data.stortinget.no og offentlige
nettsider. Får du 403 fra proxyen, er verten sperret. Da skal du be brukeren
åpne den i miljøinnstillingene. Du skal aldri rute rundt sperren via en
mellomtjeneste som Jina Reader eller agent-reach. curl går gjennom proxyen.
Nodes `fetch` gjør det ikke, så skriptene bruker curl.

Headless Chromium stoler ikke på proxyens CA. Fonter selvhostes derfor via
`@fontsource`, noe et personvernprodukt uansett bør gjøre.

Brreg-importøren trenger `MAKTKART_PERSON_SALT`. Saltet brukes bare til å skille
navnebrødre, og det skal aldri committes. I skyøktene ligger det i
scratchpad-mappen. I produksjon hører det hjemme blant miljøets hemmeligheter.
Se `docs/brreg-import.md`.

Supabase-MCP-en i skyøktene ser per 2026-09-24 bare prosjektet «ScripturePath».
Bransjesjekk-basen (`jcpuhhrqhgrnihiacosy`) er ikke tilgjengelig derfra.
Maktkart skal ha sitt eget Supabase-prosjekt, fordi personopplysninger gir en
annen personvernprofil enn bransjetall.

## Oppsett i nye økter

`.claude/hooks/session-start.sh` kjører `npm install` og gjenoppretter
agent-skillene fra `skills-lock.json` når `CLAUDE_CODE_REMOTE=true`.
Designskillene ligger da i `.agents/skills/`: impeccable, design-taste-frontend,
emil-design-eng og de andre.
