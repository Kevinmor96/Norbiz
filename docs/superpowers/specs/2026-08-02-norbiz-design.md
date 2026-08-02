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
**databaseskjemaet er endelig**.

Hver kolonne skal tilsvare et felt som faktisk finnes i SSBs statistikkbank
eller Brønnøysundregistrenes åpne API. Ingen oppfunne felter. Når ekte data
importeres, endres kun innholdet i tabellene — ikke én linje frontend.

Tre konsekvenser som gjelder overalt:

- Hver statistikkrad bærer `source`, `data_quality` og `coverage`.
- Manglende data er NULL og vises som «ikke publisert». Aldri 0, aldri utfylt
  med et estimat med mindre raden er merket `beregnet`.
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

### 2.4 `score_kapitalbehov` som øyeblikksbilde — ANTAKELSE

Det åpne Regnskapsregister-API-et gir kun siste innsendte regnskapsår.
Delscoren beregnes derfor én gang fra siste tilgjengelige år og holdes konstant
over årene, tydelig merket som øyeblikksbilde med eget årstall.

Dette er den ene beslutningen brukeren ikke eksplisitt bekreftet. Alternativene
var å bytte kilde til bruttoinvestering per sysselsatt fra strukturstatistikken
(ekte tidsserie, men måler kapitalintensitet i drift heller enn
etableringskostnad), eller å fjerne delscoren og bygge `score_total` på fem.
Endringen er liten og isolert til scoremodellen.

---

## 3. Datamodell

### Enums

```
data_quality : mock | ssb | brreg | beregnet
region_level : land | fylke | kommune
unit_type    : foretak | virksomhet
coverage     : alle | as_only
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
| Kapitalbehov | invers av median `egenkapital` — øyeblikksbilde, se 2.4 |
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

### Delt komponent

`<DataBadge quality={...} source={...} year={...} coverage={...} />` brukes på
hvert eneste KPI-kort og hver graf. `coverage` er lagt til så AS-avgrensningen
er synlig der tallet står.

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

Hver function har en kommentarblokk øverst med kilde, endepunkt og hvilke
kolonner den fyller. Import er idempotent: upsert på nøkkelen.

Ingen live API-kall i brukerflyten. All data leses fra egne tabeller.

---

## 9. Overlevering til Lovable

1. Opprett Supabase-prosjekt for Norbiz. Brukeren har i dag kun
   `ScripturePath`.
2. Kjør migrasjoner og seed mot den basen herfra.
3. Opprett Lovable-prosjekt, koblet til samme Supabase — ikke Lovable Cloud.
4. `set_project_knowledge` med invariantene: DataBadge på hvert tall, ingen
   hardkodede verdier, NULL rendres som «ikke publisert», TanStack Query mot
   basen, aldri sammenligne `as_only` med `alle` uten merking.
5. Én `send_message` per side, i rekkefølge, med skjemaet som kontrakt.

---

## 10. Ikke gjør

- Ikke legg inn KPI-er som «median lønn til eier» eller «typisk
  etableringskapital» — de finnes ikke i noen tilgjengelig kilde.
- Ikke bland enkeltpersonforetak og aksjeselskaper i samme snitt uten å merke
  det. `coverage` finnes for dette.
- Ikke hardkod tall i komponenter.
- Ikke bygg innlogging bak alt — næringssidene er offentlige.
- Ikke lag flere sider enn de seks.
- Ikke fyll NULL med 0.

---

## 11. Åpne punkter

| Punkt | Håndtering |
|---|---|
| Har den regionale SSB-tabellen `driftsresultat`? | Verifiseres først i `import-ssb`. Begge felter nullable, så designet tåler begge utfall. |
| Publiseres 2017–2023 på datidens fylkesinndeling eller tilbakeskrevet til dagens 15? | Modellen antar det strengeste tilfellet. Verifiseres i `import-ssb`. |
| Finnes `arsverk_per_enhet` i strukturstatistikken? | Usikkert — `sysselsatte` er sikker, årsverk ikke. Nullable; droppes hvis den ikke finnes. |
| `score_kapitalbehov` som øyeblikksbilde | Antakelse, ikke bekreftet. Se 2.4. |
| Folketall per region og år | Fjerde SSB-kilde, kreves av konkurransescoren. |
| `data.ssb.no` er blokkert i utviklingscontaineren | Påvirker ikke edge functions, som kjører på Supabase. Betyr at API-formen ikke kan valideres lokalt. |
