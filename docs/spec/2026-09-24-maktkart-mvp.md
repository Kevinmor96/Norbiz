# Maktkart — MVP (2026-09-24)

Maktkart svarer på ett spørsmål, stilt slik folk faktisk stiller det:
**hvem bestemmer her?** Siden viser organene, rollene og pengene i en kommune,
og hvordan de henger sammen. Hver påstand har kilde og dato.

Vi starter med Tromsø, men bygger det som én mal som skal fungere for alle
kommuner i landet. Grunnlaget er `docs/research/2026-09-24-maktkart-researchgrunnlag.md`.
Der står også den juridiske vurderingen, og den er en del av designet.

Repoet het Norbiz og bar Bransjesjekk. Maktkart overtok 2026-09-24, og
Bransjesjekk ligger i `arkiv/bransjesjekk/`. Brreg-lærdommene derfra gjelder
fortsatt, og de er løftet inn i `CLAUDE.md`.

---

## 1. Hvem siden er for

Den offentlige kommunesiden er gratis, og den har to jobber. Den er produktdemoen,
og den skal hentes opp i søk («hvem bestemmer i Tromsø», «ordfører Tromsø»,
«hvem eier Troms Kraft»). De som betaler, kommer inn herfra:

| Segment | Hva de trenger | Betalingsvilje (estimat fra grunnlaget) |
|---|---|---|
| PR, samfunnskontakt, lobbyister | Hvem forbereder og hvem vedtar, og når de byttes ut | Høy, 20–60 k kr/år |
| Eiendomsutviklere, meglere | Planprosessen og hvem som sitter i den | Høy |
| B2B-selgere mot offentlig sektor | Beslutningstakere og innkjøpsmakt | Middels–høy |
| Journalister og redaksjoner | Koblinger, historikk og kilder | Middels |
| Næringsforeninger, NHO, LO | Oversikt over regionen | Middels |

Tallene er antakelser fra grunnlaget og ikke målt betalingsvilje. Det første
salgsbeviset skal være at noen melder seg på ventelisten til Pro fra en side
som viser ekte data. Priser (490 kr/mnd Pro, 2 900 kr/mnd Team, fra 60 k kr/år
Enterprise) er hypoteser vi tester, ikke vedtatt prising.

## 2. Sidekart

| Rute | Innhold | Modus |
|---|---|---|
| `/` | Døra: «Hvem bestemmer i din kommune?», kommunevelger, Tromsø-teaser, hva Pro gir | Overtale |
| `/kommune/$slug` | **Produktet.** Den rullende kommunesiden, se §3 | Overtale og vise |
| `/organ/$key` | Organprofil: myndighet, roller nå og før, eierskap, nøkkeltall, hendelser, kilder | Operere |
| `/metode` | Kilder, verifiseringsgrader, personvern, «Er dette deg?» | Forklare |
| `/pro` | Hva Pro skal gi, prishypotese og venteliste | Overtale |

## 3. Kommunesiden — den selgende datasiden

Siden leses ovenfra og ned som en fortelling. Hver seksjon er likevel et
selvstendig svar som kan lenkes til direkte med `#anker`, og som deles på egen
hånd. Rekkefølgen er valgt fordi hver seksjon svarer på spørsmålet den forrige
reiste.

1. **Topp.** Kommunen, spørsmålet og tre til fire tall som bare denne kommunen
   har (Tromsø: 43 i kommunestyret, eierandeler i N selskaper, 70 mill. i utbytte
   fra Troms Kraft i 2026). Under dem står en stripe med de siste endringene og et
   søkefelt i kommunens organer og roller.
2. **Beslutningskjeden** — «Hvem bestemmer en reguleringsplan?» Kjeden vises steg
   for steg mens leseren ruller: administrasjonen forbereder, utvalget innstiller,
   kommunestyret vedtar og Statsforvalteren behandler klager. Hvert steg viser
   organet, myndighetstypen og hvem som leder. Prosessene er valgbare
   (reguleringsplan, budsjett). Dette er differensieringen, altså den forberedende
   makten ingen andre viser.
3. **Organkartet** — hvem sitter hvor. Nivåene er stat, fylke, kommune og
   selskaper. Hvert organ får et kort med leder og myndighet. Folkevalgte organer
   og administrasjon står hver for seg.
4. **Pengene** — hva kommunen eier. Eierandeler, egenkapital og omsetning, og
   utbyttet fra Troms Kraft som flyt (175 mill.: 105 til Troms Holding og 70 til
   kommunen).
5. **Nettverket** — de som sitter flere steder. En liten graf over personer med
   minst to aktive roller i datasettet, og en liste som alternativ til grafen.
   Grafen er institusjonsgraf: noden er organet, og personen er en kant mellom
   organer.
6. **Endringene** — tidslinje over rollebytter og strukturendringer, som
   kommunedirektørbyttet, fylkesdelingen i 2024 og ny statsforvalter. Planlagte
   hendelser (valget i 2027 og byrådsdebatten) har egen stil. De har ikke skjedd.
7. **Din bransje** — velg segment (eiendom og bygg, sjømat, reiseliv, energi,
   finans) og se hvilke organer som påvirker det, og med hvilken myndighet.
8. **Neste kommune** — Tromsø er først. Leseren stemmer fram neste kommune.
   Ventelisten er også et signal om etterspørsel.
9. **Metode og Pro** — hvordan tallene er hentet, hva prikkene betyr, og hva Pro
   skal gi (varsler, full graf, historikk og eksport). Pro vises som venteliste,
   ikke som noe som finnes.

## 4. Designprinsipper

Disse er krav. Hvordan de skal se ut, bestemmer designretningen.

1. **Institusjon først.** Personer vises bare gjennom en rolle. Siden har ingen
   personbilder, ingen personprofiler i MVP og ingen topplister over mennesker.
   En person i nettverket er en kant mellom to organer.
2. **Hver påstand kan spores.** Kilde, dato og verifiseringsgrad skal kunne nås
   med høyst én interaksjon, altså et hover eller et trykk. De tre gradene
   (`verifisert`, `oppgitt`, `maa_verifiseres`) skal se forskjellige ut, og ikke
   bare med farge. Dette kildemerket er produktets signatur. Det er det Proff og
   Purehelp ikke har.
3. **Ærlig forhåndsversjon.** Så lenge ingenting er `verifisert`, står det tydelig
   og vedvarende at tallene kommer fra researchgrunnlaget og ikke er etterprøvd
   mot Brreg. Det skal stå rolig, uten alarm.
4. **Ingen ferskhetspåstander.** Ord som «LIVE», «sanntid» og «oppdateres daglig»
   skal ikke brukes før pipelinen gjør det. Skriv «sammenstilt 24.09.2026».
5. **Ingen sammensatt maktscore på den offentlige siden.** Scoren i grunnlaget
   (§3.4) har sju vektede ledd. For Tromsø mangler minst tre av dem målte data
   (arealmakt, anskaffelser og eierposisjon vektet med egenkapital). En score på
   delvise data er et tall leseren tror på uten grunn. Det er den samme fellen som
   etableringskapitalen i Bransjesjekk. Vi viser derfor myndighetsprofil,
   eierskap og kjeder, som er fakta. Scoren kan komme i Pro når leddene har data.
6. **Bevegelse har en jobb.** Beslutningskjeden bygges mens leseren ruller, grafen
   legger seg og tallene settes når de kommer i bildet. Alt skal likevel være
   synlig i ro. Ingenting venter på opacity 0 til en observer slår inn, fordi
   førsteinntrykket er et skjermbilde, en delt lenke eller en søkemotor.
   `prefers-reduced-motion` respekteres fullt ut.
7. **Malen skalerer.** Ingen komponent vet at den handler om Tromsø. Alt drives av
   datasettet, og tomme og manglende tilstander er designet. Neste kommune har
   færre data, og da skal siden si det i stedet for å se ødelagt ut.
8. **Mobil først.** 390 px er hovedbredden. Kjeden, grafen og tidslinjen har egne
   mobilformer, ikke nedskalerte skrivebordsformer.
9. **Tall har år.** Hvert tall står med regnskapsår eller dato. Morselskap og
   konsern merkes der grunnlaget skiller dem.

## 5. Det vi bevisst ikke bygger

- **Personscore og topplister over personer.** Grunnlaget sier det, og
  omdømmerisikoen er størst nettopp her.
- **Skattelister.** EMD-dommen om nettpublisering (2023, omtalt av Rett24) og
  loggkravet hos Skatteetaten gjør dem uaktuelle.
- **Skraping av Proff og Purehelp.** Databasevern (åndsverkloven § 24) og
  avtalevilkår står i veien. Nesten alt de har, finnes i Brreg, som vi henter
  ved kilden.
- **Personbilder, enkeltdommere, lavere politinivå og aksjonærer under
  terskelen.**
- **Fødselsdato.** Brreg gir den, og den brukes bare til å skille navnebrødre i
  pipelinen. Den vises ikke og lagres som hash.

## 6. Data i MVP

`src/data/tromso.json` (typer i `src/data/types.ts`) er sammenstilt fra
grunnlaget. Datasettet er ikke etterprøvd. Utviklingsmiljøet får 403 mot
`data.brreg.no`, så ingen rad er `verifisert`. Det første pipelinesteget er en
edge function i Supabase som henter Enhetsregisteret, roller og nøkkeltall for
hvert orgnr i datasettet. Den skriver `verifisert` med tidsstempel, og der Brreg
sier noe annet enn grunnlaget, legger den avviket i en kø. Importørene i
`arkiv/bransjesjekk/supabase/functions/` er startpunktet. De kjører allerede
mot Brreg fra Supabase.

Supabase-skjemaet i `supabase/migrations/` er kontrakten mellom siden og basen.
Personvernreglene håndheves der, med RLS og kolonnerettigheter på basistabellene.
Et view som filtrerer mens basistabellen er åpen, beskytter ingenting. Filteret
er da bare en anbefaling.

## 7. Lovable

**Anbefaling:** Bygg siden her nå, som avtalt, og på nøyaktig samme stack som
Lovable genererer. Stacken er TanStack Start med SSR, React 19, Vite, Tailwind 4,
shadcn/ui og Supabase. Den er bekreftet fra `package.json` i Bransjesjekk-prosjektet
i Lovable (`@lovable.dev/vite-tanstack-config`). Flyttingen blir da en kopi, ikke
en omskriving.

- **SEO er ikke lenger et argument mot Lovable.** Ifølge Lovable bruker nye apper
  TanStack Start med SSR fra 13.05.2026. Kilden er søkeresultater, fordi siden
  ikke kunne leses i sin helhet herfra. For en side som skal rangere per kommune,
  var dette den store innvendingen.
- **Lovable er svakt der Maktkart er tyngst.** Datapipelinen (innhenting,
  navnematching og versjonering) og personvernreglene hører hjemme i repoet og i
  Supabase, ikke i en agent som tar naturlig språk. Det er det samme skillet som
  fungerte for Bransjesjekk.
- **Åpent:** om Lovable kan kobles til dette eksisterende repoet, eller om det må
  lage sitt eget og få `src/` kopiert inn. Det sjekkes når vi flytter.

## 8. Åpne spørsmål

- **Navn og domene.** «Maktkart» er arbeidsnavnet. Grunnlaget nevner
  innflytelse.no. Ingen av domenene er sjekket.
- **Juridisk før lansering.** DPIA, interesseavveining (LIA), personvernerklæring
  og innsigelsesflyt. Terskelen for å vise aksjonærer skal vurderes av en advokat.
- **Troms fylkeskommunes styringsmodell.** Grunnlaget har en konflikt mellom
  formannskapsmodell og fylkesråd. Modellen må kunne vise begge.
