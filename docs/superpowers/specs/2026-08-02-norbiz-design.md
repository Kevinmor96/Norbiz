# Norbiz / Business Insight Norway — design

Dato: 2026-08-02
Status: godkjent, klar for implementasjonsplan

Et beslutningsverktøy for den som vurderer å starte, kjøpe eller investere i en
bedrift i Norge. Brukeren skal kunne svare på ett spørsmål: hvor lønnsomt er det
egentlig å drive denne typen virksomhet, her?

Ikke en bedriftsdatabase. Ikke et oppslagsverk for enkeltselskaper. Ikke en
konkurrent til Proff eller Purehelp.

Målgrupper i prioritert rekkefølge: rådgivere, banker og næringsmeglere;
investorer og oppkjøpere; gründere.

---

## 1. Grunnregelen

Dette er et shell-first-bygg. All data i første versjon er syntetisk, men
**databaseskjemaet er endelig**. Når ekte data importeres, endres kun innholdet
i tabellene — ikke én linje frontend.

Verktøyet skal samle mye god, strukturert informasjon på ett sted. Ikke alt det
en kjøper eller rådgiver trenger å vite finnes i offentlig statistikk. Der
statistikken tier, skal verktøyet likevel svare — med anslag basert på
bransjeerfaring, tydelig merket som nettopp det.

Regelen er derfor ikke «bare målte tall». Den er **at et tall aldri skal kunne
forveksles med noe det ikke er**. Tre nivåer, med hver sin merking:

| Nivå | Hva det er | `data_quality` |
|---|---|---|
| Målt | Publisert av SSB eller Brreg | `ssb`, `brreg` |
| Utledet | Regnet ut fra målte tall | `beregnet` |
| Anslått | AI-vurdering der ingen kilde finnes | `ai_anslag` |

Et anslag er et fullverdig svar, ikke en nødløsning. Men det skal aldri stå
umerket ved siden av et målt tall, og aldri i samme kolonne.

Konsekvenser som gjelder overalt:

- Hver rad bærer `source`, `data_quality` og `coverage`.
- Manglende data er NULL og vises som «ikke publisert» — aldri 0. Et hull kan
  fylles med et anslag, men da som `ai_anslag`, ikke som en stille utfylling.
- Frontend hardkoder aldri tall. Alt hentes fra Supabase via TanStack Query.

---

## 2. Beslutninger

Fire valg tatt under brainstorming, med begrunnelsen bevart så de kan
omgjøres bevisst senere.

### 2.1 Granularitet: lagre kun det SSB faktisk publiserer

SSB gir ikke næringstall på 5-siffer NACE per fylke:

| Kilde | NACE-nivå | Enhet | Periode |
|---|---|---|---|
| Nasjonalt (tabell 12910) | 2, 3, 4, 5 | foretak og virksomheter | 2017–2023 |
| Etter fylke (tabell 12936) | 2, 3 | virksomheter | 2017–2023 |

Modellen lagrer derfor det som finnes, ikke det vi skulle ønske fantes.
Nasjonale rader på nivå 2–5, regionale rader på nivå 2–3. Ingen rad
fabrikkeres for å fylle rutenettet.

UI-en degraderer ærlig: velger brukeren en femsifret næring sammen med et
fylke, vises nasjonale og regionale tall side om side, hver med sin egen
`<DataBadge />` og granularitet påført.

Forkastet: å fordele nasjonale 5-siffertall utover fylker etter 3-sifferandel.
Det ville gitt en enhetlig modell, men tallene forutsetter at næringsmiksen
innad i et 3-siffer er lik i alle fylker, og det er den ikke.

### 2.2 Arbeidsdeling: delt ved Supabase-grensen

Lovable-connectoren kan ikke motta kode. Den tilbyr `send_message`,
`read_file`, `list_files` og `get_diff` — lesing og naturlig språk. Det finnes
ingen skriv-fil-API.

```
dette repoet          Supabase (eid av bruker)      Lovable
──────────────────────────────────────────────────────────────
migrasjoner   ─apply─▶  tabeller       ◀──lesing──   React-app
seed-generator          seed-data                    (bygget av
score-view              views                         Lovables
edge functions ─deploy▶ functions                     agent)
spec + invarianter ──────────────────────────────▶  send_message
```

Alt varig bygges her og kjøres mot brukerens egen Supabase. Lovable bygger kun
frontend mot samme base. Skjemaet — den endelige delen — eies av brukeren.

Forkastet: å bygge hele appen her og synke via GitHub. Krever manuell
oppsett i Lovable-dashboardet, og Lovables agent kan skrive over strukturen
ved senere endringer.

### 2.3 `omsetning_median` utgår

SSBs strukturstatistikk publiserer totaler og gjennomsnitt, ikke medianer.
Feltet kan ikke fylles fra noen tilgjengelig kilde.
`omsetning_per_enhet` beholdes — det er total delt på antall, som er utledbart.

### 2.4 `score_kapitalbehov` deles i to

Det opprinnelige problemet: delscoren skulle bygge på median egenkapital fra
Brreg, men det åpne API-et gir kun siste innsendte regnskapsår, så det finnes
ingen tidsserie å score mot.

Beslutning 2.5 løser dette ved å splitte spørsmålet, fordi det egentlig var to:

**Kapitalintensitet i drift** blir delscoren. Den beregnes fra
`bruttoinvestering_total` per sysselsatt i strukturstatistikken — en ekte
tidsserie, målt, og dermed gyldig input til `score_total`.

**Etableringskapital** — hva det faktisk koster å komme i gang — blir en rad i
`industry_estimates`. Det er det gründeren spør om, det finnes ikke i noen
kilde, og det er nettopp den typen spørsmål anslagslaget er til for. Vises som
spenn med konfidens ved siden av scoren, ikke inni den.

Brreg-egenkapital brukes ikke til scoring. Den forblir tilgjengelig per
selskap i `companies`.

### 2.5 AI-anslag som eget nivå, ikke som utvisking av grensen

Lagt til etter første gjennomlesning. Det opprinnelige utkastet tillot kun
målte felter og forbød eksplisitt «typisk etableringskapital» og «median lønn
til eier». Det er reversert: verktøyet skal svare også der statistikken tier,
med anslag basert på bransjeerfaring.

Grensen mellom målt og anslått består likevel, som en tredje verdi i
`data_quality` og en egen tabell. Begrunnelsen er målgruppen: rådgivere,
banker og næringsmeglere setter disse tallene inn i beslutninger for andre.
Et anslag de kan se er et anslag, er nyttig. Et anslag de tror er statistikk,
er en hefte.

Praktisk følge: anslag vises fritt, i egen visuell form, med konfidens og
begrunnelse — men de går ikke inn i `score_total`, og de deler aldri kolonne
med et målt tall.

---

## 3. Datamodell

### Enums

```
data_quality : mock | ssb | brreg | beregnet | ai_anslag
region_level : land | fylke | kommune
unit_type    : foretak | virksomhet
coverage     : alle | as_only
konfidens    : lav | middels | høy
```

`coverage` er nytt og bærer ENK-forbeholdet på raden i stedet for i en
UI-tekst. Enkeltpersonforetak leverer ikke årsregnskap og mangler derfor i
regnskapstall. En rad med `coverage = 'as_only'` skal aldri sammenlignes
ufiltrert med en rad merket `alle`.

`data_quality` beskriver radens opphav, ikke hvert enkelt felt. En SSB-rad
der `omsetning_per_enhet` er regnet ut som total delt på antall er fortsatt
`ssb`. `beregnet` er forbeholdt rader som i sin helhet er utledet fra andre
rader, slik `industry_scores` er.

### `industries`

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| nace_code | text unique | SN2007, f.eks. `96.021` |
| nace_level | int | 1–5 |
| parent_code | text fk → industries.nace_code | hierarki |
| name | text | offisiell næringsbetegnelse |
| common_name | text | folkelig navn, f.eks. «Frisørsalong» |
| slug | text unique | |
| description | text | |
| search_terms | text[] | synonymer for søk |

Hierarkiet må være komplett. Regionale rader finnes bare på nivå 2–3, så hvert
femsifrede kodepunkt trenger sine 3- og 2-siffer-forfedre i tabellen for at
regionvisningen skal ha noe å slå opp.

### `regions`

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| code | text | SSB regionkode |
| name | text | |
| level | region_level | |
| parent_code | text | |
| valid_from_year | int | |
| valid_to_year | int null | NULL = fortsatt gyldig |

Unik på `(code, valid_from_year)`.

Fylkesinndelingen har endret seg to ganger i perioden: 19 fylker til og med
2019, 11 fra 2020, 15 fra 2024. Uten årgangsfelt blir en tidsserie per fylke
stille feil. Kartet må laste GeoJSON som matcher valgt årgang.

Strukturstatistikken slutter i 2023, som er før 15-fylkesreformen. Om SSB
publiserer den på datidens inndeling eller tilbakeskriver til dagens, er ikke
verifisert — begge deler forekommer i statistikkbanken. Modellen og seed-en
antar det strengeste tilfellet, altså at hvert år bærer sin egen årgang, fordi
en frontend som takler årganger også takler en tilbakeskrevet serie. Motsatt
vei holder ikke.

Live-tellinger fra Enhetsregisteret kan uansett vises på dagens 15 fylker.
Appen må være eksplisitt om hvilken årgang som vises.

### `industry_stats`

Kjernetabellen. Én rad per næring × region × år × enhetstype.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id | uuid fk | |
| region_id | uuid fk | |
| year | int | |
| unit_type | unit_type | |
| nace_level | int | denormalisert fra industries |
| region_level | region_level | denormalisert fra regions |
| n_enheter | int | |
| omsetning_total | bigint | NOK |
| omsetning_per_enhet | bigint | |
| driftsresultat_total | bigint null | |
| driftsmargin_pct | numeric null | |
| lonnskostnad_total | bigint | |
| lonnsandel_pct | numeric | |
| sysselsatte_total | int | |
| sysselsatte_per_enhet | numeric | |
| arsverk_per_enhet | numeric | |
| bearbeidingsverdi_total | bigint | |
| verdiskaping_per_sysselsatt | bigint | |
| bruttoinvestering_total | bigint | |
| source | text | f.eks. `SSB:12910` |
| data_quality | data_quality | |
| coverage | coverage | |

Unik på `(industry_id, region_id, year, unit_type)`.

Constraint: `CHECK (region_level = 'land' OR nace_level <= 3)`. Databasen
håndhever granularitetsregelen i stedet for å stole på at importen oppfører
seg. `nace_level` og `region_level` er derfor bevisst denormalisert — de
brukes også som peer-gruppe i scoringen.

`n_foretak` fra det opprinnelige utkastet er omdøpt til `n_enheter`, siden
`unit_type` nå avgjør hva som telles. En frisørkjede er ett foretak og ti
virksomheter; å skjule det i ett feltnavn ville gjort konkurransetetthet feil.

**Åpent punkt som må verifiseres først i `import-ssb`:** standardvariablene i
strukturstatistikken er omsetning, produksjonsverdi, bearbeidingsverdi,
bruttoinvesteringer, lønnskostnader og sysselsatte. `driftsresultat` ser ikke
ut til å inngå. Det bor sannsynligvis i statistikken «Regnskap for
ikke-finansielle aksjeselskaper», som dekker kun AS. Hvis det stemmer, kommer
`driftsresultat_total` og `driftsmargin_pct` fra et eget importløp med
`coverage = 'as_only'`, mens resten av raden er `alle`. Designet tåler begge
utfall fordi begge felter er nullable.

### `industry_demography`

Samme granularitetsregler som `industry_stats`.

| kolonne | type |
|---|---|
| industry_id, region_id, year | fk / int |
| nace_level, region_level | int / region_level |
| nyetableringer | int |
| nedleggelser | int |
| konkurser | int |
| overlevelse_1ar_pct, overlevelse_3ar_pct, overlevelse_5ar_pct | numeric null |
| source, data_quality, coverage | text / enum / enum |

Unik på `(industry_id, region_id, year)`.

Overlevelsestallene kommer fra foretaksdemografi; konkurser er en egen SSB-
statistikk. To kilder inn i én tabell, skilt på `source`.

### `companies`

Kun siste tilgjengelige regnskapsår — det er alt det åpne Brreg-API-et gir.

| kolonne | type |
|---|---|
| org_nr | text unique |
| navn | text |
| nace_code, kommune_code | text |
| organisasjonsform | text |
| ansatte | int |
| omsetning, driftsresultat, egenkapital | bigint null |
| regnskapsar | int null |
| inngar_i_regnskapssnitt | boolean |
| source, data_quality | text / enum |

`inngar_i_regnskapssnitt` er avledet: sant når organisasjonsformen leverer
årsregnskap og `regnskapsar` finnes. Gjør ENK-avgrensningen etterprøvbar i
basen i stedet for å være en påstand i en UI-tekst.

### `industry_estimates`

Der statistikken tier. Egen tabell, ikke kolonner i `industry_stats`, av to
grunner: `industry_stats` skal forbli idempotent importerbar fra SSB uten at
en import stryker anslag, og anslag har sin egen livssyklus — modell,
promptversjon, konfidens, gyldighetsdato.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id | uuid fk | |
| region_id | uuid fk null | NULL = gjelder nasjonalt |
| metrikk | text | f.eks. `etableringskapital`, `sesongvariasjon` |
| verdi_num | numeric null | når anslaget er et tall |
| verdi_tekst | text null | når anslaget er kvalitativt |
| enhet | text null | `NOK`, `pct`, `mnd` |
| intervall_lav, intervall_hoy | numeric null | anslag oppgis helst som spenn |
| konfidens | konfidens | |
| begrunnelse | text | hvorfor dette anslaget |
| basert_pa | jsonb | hvilke faktiske rader anslaget hviler på |
| model, prompt_version | text | |
| generated_at | timestamptz | |
| source | text | `ai:<modell>` |
| data_quality | data_quality | alltid `ai_anslag` |

Unik på `(industry_id, region_id, metrikk)`.

Anslag oppgis som **spenn med konfidens**, ikke som ett tall, når metrikken
tåler det. «Etableringskapital 300 000–800 000, middels konfidens» er et
ærlig svar. «Etableringskapital 512 000» er det ikke.

`basert_pa` er det som skiller et anslag fra en gjetning: den skal peke på de
faktiske radene modellen fikk se. Samme prinsipp som `forklaring` i
scoringen — ingen svarte bokser.

Metrikkene er en åpen liste, ikke kolonner, nettopp fordi de vil vokse.
Startsettet: etableringskapital, typisk tid til lønnsomhet, sesongvariasjon,
kundekonsentrasjon, reguleringsbyrde, digitaliseringsgrad.

### `ai_insights`

Innsikt knyttet til tall, ikke bare en rapporttekst. Én rad per observasjon,
slik at innsikten kan vises ved siden av KPI-en den handler om, i stedet for
som en vegg av tekst nederst på siden.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id, region_id | fk | |
| year | int null | |
| type | text | `risiko`, `mulighet`, `avvik`, `sammenligning`, `kontekst` |
| tittel | text | én setning |
| body | text | |
| alvorlighet | int 1–5 | styrer rekkefølge og visuell vekt |
| referanser | jsonb | hvilke rader og felter påstanden bygger på |
| knyttet_til | text null | KPI-nøkkel, så innsikten kan ankres i UI-et |
| model, prompt_version, generated_at | text / text / timestamptz |
| data_quality | data_quality | `ai_anslag` |

`referanser` er obligatorisk. En innsikt som ikke kan peke på tallene den
bygger på, skal ikke lagres.

`ai_reports` beholdes for den lange, sammenhengende rapporten.
`ai_insights` er det korte, forankrede laget som ligger i selve dashbordet.

### `score_weights` og `score_config`

`score_weights`: én rad per delscore med vekt. Vektene skal kunne justeres
uten kodeendring.

`score_config`: enradstabell med `min_enheter` — terskelen en næring må over
for å scores i det hele tatt. Uten den styrer mikronæringer topplistene.

### `industry_scores`

| kolonne | type |
|---|---|
| industry_id, region_id, year | fk / int |
| nace_level, region_level, unit_type | peer-gruppe |
| score_lonnsomhet, score_vekst, score_risiko | int 0–100 null |
| score_konkurranse, score_kapitalbehov, score_etterspørsel | int 0–100 null |
| score_total | int 0–100 |
| forklaring | jsonb |

### `ai_reports`

`industry_id`, `region_id`, `body`, `generated_at`, `model`, `prompt_version`.

### `favorites`

`user_id`, `industry_id`, `region_id`. RLS: bruker ser kun egne rader.

---

## 4. Business Score

Implementeres som **Postgres-view**, ikke edge function. Beregningen er ren SQL
over tabeller som allerede finnes, og et view kan ikke komme ut av synk med
dataene slik en cachet funksjon kan.

Hver delscore normaliseres som persentilrangering 0–100 innenfor peer-gruppen
`(region_id, year, nace_level, unit_type)`. `nace_level` i gruppen er
nødvendig — ellers rangeres 96.021 mot aggregatet 96.0, og alle femsifrede
næringer havner i midten.

| Delscore | Beregnes fra |
|---|---|
| Lønnsomhet | `driftsmargin_pct` |
| Vekst | endring i `omsetning_total` over siste tre år |
| Risiko | invers av `konkurser / n_enheter` og `overlevelse_5ar_pct` |
| Konkurranse | `n_enheter` per 10 000 innbyggere i regionen |
| Kapitalbehov | `bruttoinvestering_total` per sysselsatt, se 2.4 |
| Etterspørsel | endring i `n_enheter` og `sysselsatte_total` |

Delscorer er nullable. Mangler `driftsmargin_pct` regionalt, er
`score_lonnsomhet` NULL der — ikke 0. `score_total` er vektet snitt over de
delscorene som finnes, med vektene renormalisert, og raden bærer hvilke som
inngikk.

`forklaring` skal inneholde råtallet, persentilen og kildereferansen per
delscore — nok til å rekonstruere resultatet uten å kjøre spørringen på nytt.
Klikk på en delscore åpner et panel som viser nøyaktig dette. Ingen svarte
bokser.

Konkurransescoren trenger folketall per region og år. Det er en egen SSB-kilde
og må inn i importen, med sin egen tabell `region_population`
(`region_id`, `year`, `innbyggere`, `source`, `data_quality`).

### Anslag går ikke inn i score_total

`industry_scores` beregnes utelukkende fra målte og utledede tall. Rader fra
`industry_estimates` inngår ikke.

Grunnen er hvem verktøyet er for. En rådgiver som sammenligner to næringer på
score må vite at forskjellen ligger i tallene, ikke i hvor selvsikker modellen
var den dagen anslaget ble generert. Blandes anslag inn, blir scoren
usammenlignbar på tvers av næringer — noen ville hvile på SSB-tall, andre på
en språkmodell, uten at rangeringen viser forskjellen.

Anslag vises ved siden av scoren, aldri inni den. Mangler en delscore
datagrunnlag, er den NULL og `score_total` renormaliseres over de som finnes.
Det er et ærligere svar enn å fylle hullet.

---

## 5. Seed-data

Det viktigste kravet: seed-dataene må ha **samme form som ekte data**, ikke
bare plausible verdier.

- nasjonale rader på nivå 2–5, regionale kun på 2–3
- `driftsresultat_total` og `driftsmargin_pct` NULL i regionale rader
- år 2017–2023, ikke ti år
- hierarkiet komplett: 60 femsifrede næringer pluss alle deres 3- og
  2-siffer-forfedre
- `regions` inneholder alle tre årgangene — 19, 11 og 15 fylker — pluss Norge
- regionale statistikkrader legges på den årgangen som gjaldt i året: 19 fylker
  for 2017–2019, 11 for 2020–2023. 15-fylkesårgangen får ingen statistikkrader,
  siden serien slutter før 2024, men finnes i `regions` fordi
  Enhetsregisterdata er live og hører hjemme der
- 300 rader i `companies`, plassert på dagens kommuner
- `industry_estimates` for de 60 femsifrede næringene, med spenn og varierende
  konfidens — ikke alle på «høy», ellers får frontend aldri testet hvordan lav
  konfidens ser ut
- `ai_insights` for de ti vanligste næringene, med utfylt `referanser` og
  `knyttet_til`, og med minst én av hver `type`, så alle varianter av
  `<InsightCard />` er dekket

En seed som er penere enn virkeligheten er verre enn ingen seed: da bygger
Lovables agent en frontend mot en form ekte data aldri vil ha, og
shell-first-premisset ryker i det første importen kjører.

Konsistenskrav: summen av regionene skal tilsvare landstallet på samme
NACE-nivå, marginer skal ligge i realistiske intervaller per bransjetype
(servering lavt, rådgivning høyt), og tidsserier skal ha realistisk støy —
ikke rette linjer.

Alle seed-rader: `data_quality = 'mock'`, `source = 'seed'`.

---

## 6. Sider

Seks sider. Ikke flere.

**Forside (offentlig).** Hero: «Finn ut hva som faktisk lønner seg å drive i
Norge», med undertekst om dekning. Én søkeboks med autocomplete mot
`industries` på `common_name` og `search_terms`. Fire eksempel-chips
(Frisørsalong, Treningssenter, Restaurant, Regnskapsfører). Under: kompakt
tabell med de ti næringene med høyest score nasjonalt.

**Dashboard.** KPI-rad: antall næringer dekket, antall enheter i
datagrunnlaget, median driftsmargin på tvers, median omsetning per enhet,
median antall sysselsatte. Alle med `<DataBadge />`. To grafer:
marginfordeling på tvers (histogram) og topp/bunn ti på margin (horisontalt
stolpediagram).

**Næringsside `/bransje/[slug]`.** Header med navn, NACE-kode, regionvelger og
Business Score som progresjonsring. KPI-rutenett. Grafer: omsetning og margin
over tid (linje, to akser), antall enheter og nyetableringer over tid,
konkurser per år. Fylkeskart farget etter valgt måltall, enkel GeoJSON — ikke
tredjeparts karttjeneste. Nederst: tabell med utvalgte foretak fra `companies`.

Tillegg fra beslutning 2.1: når valgt næring er femsifret og valgt region ikke
er Norge, vises nasjonale og regionale tall side om side med granularitet
påført hver verdi.

**Regionside `/region/[code]`.** Mest lønnsomme næringer, raskest voksende,
høyest konkurstetthet, og næringer med lavest foretakstetthet sammenlignet med
landsgjennomsnittet. Det siste er «hullene i markedet» og den mest verdifulle
visningen på siden.

**Topplister.** Filtrerbare tabeller: beste margin, høyest vekst, best
overlevelse, lavest konkurransetetthet, høyest samlet score. Filtre for region,
minimum antall enheter og størrelsesintervall.

**Favoritter og innstillinger.** Supabase auth med magic link.

**AI-analyse** ligger som seksjon på næringssiden, ikke som egen side. Det
opprinnelige utkastet listet sju overskrifter, men slo samtidig fast at det
skal være seks sider. AI-analysen er den ene som ikke fungerer frittstående —
den handler alltid om en valgt næring og region — så den foldes inn der. En edge
function henter tallene fra basen først og sender dem inn i prompten, slik at
teksten er forankret i faktiske rader. Lagres i `ai_reports` og caches. I
demoversjon: forhåndsgenerert tekst for de ti vanligste næringene.

### Delte komponenter

`<DataBadge quality={...} source={...} year={...} coverage={...} konfidens={...} />`
på hvert eneste KPI-kort og hver graf. `coverage` gjør AS-avgrensningen synlig
der tallet står; `konfidens` vises kun for `ai_anslag`.

Merkingen må være visuelt forskjellig, ikke bare tekstlig. Grå «Demo-data» for
`mock`, nøytral kildeangivelse for `ssb` og `brreg`, og en tydelig annen form
for `ai_anslag` — brukeren skal se forskjellen i periferisynet, uten å lese
badgen.

`<InsightCard />` rendrer én rad fra `ai_insights`, ankret ved KPI-en i
`knyttet_til`, sortert på `alvorlighet`. Klikk utvider `referanser` slik at
tallene bak påstanden vises.

`<Footnotes />` nederst på hver side. Samler kildene som faktisk er brukt på
den siden, med årstall, og bærer forbeholdet: at statistikk publiseres med
etterslep, at siste tilgjengelige år kan være to–tre år gammelt, at anslag er
anslag, og at ENK mangler i regnskapstall. Footnotene genereres fra radene
siden faktisk viste — ikke en håndskrevet tekst som råtner når kildene endres.

---

## 7. Design

Moderne, dempet SaaS-estetikk. Ikke kopier et eksisterende design — bruk
prinsippene:

- Mørk bakgrunn, nær sort men ikke rent sort. Kortflater et hakk lysere.
- Én aksentfarge for positive verdier, én for negative. Ellers gråtoner. Maks
  tre farger på skjermen samtidig.
- Store, luftige KPI-kort. Tallet er hovedelementet, etiketten sekundær.
- `font-variant-numeric: tabular-nums` overalt hvor tall stables.
- Avrundede hjørner, tynne kantlinjer heller enn slagskygger.
- Gradienter kun i hero. Glassmorphism kun på sticky header.
- Animasjoner under 200 ms.
- Skeleton-states på alle kort og grafer.
- Fullt responsivt. Mobil: KPI-kort stables, tabeller blir kort.
- Dark mode som standard, lys modus tilgjengelig.

Stack: React + TypeScript, TailwindCSS + shadcn/ui, Supabase, TanStack Query,
Recharts, Framer Motion sparsomt.

---

## 8. Forberedt for ekte data

`supabase/functions/` med tre dokumenterte edge functions:

- **`import-ssb`** — henter fra SSBs statistikkbank og skriver til
  `industry_stats`, `industry_demography` og `region_population`. Merk: SSB
  lanserte PxWebApi v2 høsten 2025 (GET-basert); v1 lever videre i en
  overgangsperiode. Velg v2.
- **`import-brreg`** — henter fra Enhetsregisteret og det åpne
  Regnskapsregisteret, skriver til `companies`. Det åpne API-et gir nøkkeltall
  fra sist innsendte årsregnskap per orgnr; tre år finnes bare i den lukkede
  delen, som krever offentlig myndighet.
- **`compute-scores`** — materialiserer `industry_scores` fra scoring-viewet.
- **`generate-insights`** — henter tallene for en næring og region fra basen,
  sender dem inn i prompten, og skriver strukturerte rader til `ai_insights`
  og `industry_estimates`. Aldri fritekst uten `referanser` eller `basert_pa`.
  Kjøres i batch, ikke i brukerflyten, og caches på
  `(industry_id, region_id, prompt_version)`.

Hver function har en kommentarblokk øverst med kilde, endepunkt og hvilke
kolonner den fyller. Import er idempotent: upsert på nøkkelen.

Ingen live API-kall i brukerflyten. All data leses fra egne tabeller.

---

## 8b. PxWebApi v2 — verifisert kontrakt

Lest ut av referanseimplementasjonen, `PxTools/PxWebApi`, ikke fra hukommelse.
SSB kjører denne koden, så endepunktene og uttrykkssyntaksen under er
autoritative. Kun SSBs egne konfigurasjonsverdier kan avvike.

### Endepunkter

| Metode | Sti | Bruk |
|---|---|---|
| GET | `/api/v2/tables?query=&pageNumber=&pageSize=` | søk og bla i tabeller |
| GET | `/api/v2/tables/{id}` | tabellens metadata i kortform |
| GET | `/api/v2/tables/{id}/metadata?lang=&defaultSelection=` | variabler og verdikoder |
| GET | `/api/v2/tables/{id}/data?valuecodes[VAR]=…` | uttrekk via query-parametre |
| POST | `/api/v2/tables/{id}/data` | uttrekk via JSON-body |

Både GET og POST finnes. Det opprinnelige utkastet forutsatte POST; det
stemmer fortsatt, men GET er ofte enklere og cachbart.

POST-body (`VariablesSelection`):

```json
{
  "selection": [
    { "variableCode": "NACE2007", "valueCodes": ["96.021"], "codelist": null },
    { "variableCode": "Tid", "valueCodes": ["FROM(2017)"] }
  ],
  "placement": { "stub": ["NACE2007"], "heading": ["Tid"] }
}
```

### Uttrykkssyntaks i `valueCodes`

Dette er den viktigste oppdagelsen for importen. Verdikoder er ikke bare
literaler:

| Uttrykk | Betydning |
|---|---|
| `*`, `?` | jokertegn |
| `TOP(n)`, `TOP(n,offset)` | de n første, med valgfritt hopp |
| `BOTTOM(n)`, `BOTTOM(n,offset)` | de n siste |
| `RANGE(a,b)` | fra a til b |
| `FROM(a)`, `TO(a)` | åpent i én ende |

`FROM(2017)` henter hele tidsserien uten å liste årstallene, og `*` henter
alle verdier på en variabel. Det gjør `import-ssb` vesentlig enklere enn om
hver kode måtte enumereres.

### Cellegrense — importen må deles opp

Referansekonfigurasjonen setter `MaxDataCells: 10000`. Et uttrekk som
overskrider grensen avvises; det trunkeres ikke.

Det betyr at et naivt uttrekk — alle næringer × alle regioner × alle år × alle
måltall — vil feile. `import-ssb` må dele opp langs en dimensjon, mest
naturlig én NACE-gruppe per kall, og skrive resultatet inkrementelt.
Idempotent upsert på nøkkelen gjør at en avbrutt import kan kjøres om igjen
uten å duplisere.

SSB kan ha satt en annen grense enn 10 000. Importen skal derfor lese
`/api/v2/config` ved oppstart og dimensjonere batchene etter den faktiske
verdien i stedet for å anta.

### Fortsatt uverifisert

Kontrakten over er sikker. Hvilke *variabler* de enkelte tabellene tilbyr —
altså om 12936 har `driftsresultat`, om årgangene er tilbakeskrevet, om
`arsverk` finnes — avgjøres av tabellene, ikke av API-et. Det svares først av
et `GET /api/v2/tables/12936/metadata`, som må være første kall importen gjør.

---

## 9. Overlevering til Lovable

1. Opprett Supabase-prosjekt for Norbiz. Brukeren har i dag kun
   `ScripturePath`.
2. Kjør migrasjoner og seed mot den basen herfra.
3. Opprett Lovable-prosjekt, koblet til samme Supabase — ikke Lovable Cloud.
4. `set_project_knowledge` med invariantene: DataBadge på hvert tall, ingen
   hardkodede verdier, NULL rendres som «ikke publisert», TanStack Query mot
   basen, aldri sammenligne `as_only` med `alle` uten merking, `ai_anslag` i
   visuelt annen form enn målte tall, og `<Footnotes />` generert fra radene
   siden faktisk viste.
5. Én `send_message` per side, i rekkefølge, med skjemaet som kontrakt.

---

## 10. Ikke gjør

- Ikke plasser anslag i `industry_stats`. De hører hjemme i
  `industry_estimates`, med egen merking. Et anslag som deler kolonne med et
  SSB-tall er umulig å skille fra det senere.
- Ikke la anslag inngå i `score_total`. Se 4.
- Ikke lagre en innsikt uten `referanser`, eller et anslag uten `basert_pa`.
- Ikke oppgi et anslag som ett presist tall når metrikken tåler et spenn.
- Ikke bland enkeltpersonforetak og aksjeselskaper i samme snitt uten å merke
  det. `coverage` finnes for dette.
- Ikke hardkod tall i komponenter.
- Ikke bygg innlogging bak alt — næringssidene er offentlige.
- Ikke lag flere sider enn de seks.
- Ikke fyll NULL med 0.

Merk: «median lønn til eier» og «typisk etableringskapital» sto tidligere på
denne lista fordi de ikke finnes i noen kilde. De er nå tillatt — som rader i
`industry_estimates` med konfidens og begrunnelse, aldri som kolonner i
statistikktabellene.

---

## 11. Åpne punkter

| Punkt | Håndtering |
|---|---|
| Har den regionale SSB-tabellen `driftsresultat`? | Verifiseres først i `import-ssb`. Begge felter nullable, så designet tåler begge utfall. |
| Publiseres 2017–2023 på datidens fylkesinndeling eller tilbakeskrevet til dagens 15? | Modellen antar det strengeste tilfellet. Verifiseres i `import-ssb`. |
| Finnes `arsverk_per_enhet` i strukturstatistikken? | Usikkert — `sysselsatte` er sikker, årsverk ikke. Nullable; droppes hvis den ikke finnes. |
| Finnes `bruttoinvestering` i den regionale SSB-tabellen? | Kreves nå av `score_kapitalbehov`. Nullable; delscoren blir NULL regionalt hvis ikke. |
| Folketall per region og år | Fjerde SSB-kilde, kreves av konkurransescoren. |
| `data.ssb.no` er blokkert i utviklingscontaineren | Påvirker ikke edge functions, som kjører på Supabase. Betyr at API-formen ikke kan valideres lokalt. |
