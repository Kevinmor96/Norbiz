# SSBs API — verifisert mot kilden

Dato: 2026-08-04
Status: **verifisert.** Alle tall og navn her er hentet fra
`data.ssb.no` og kan etterprøves med spørringene nederst.

Erstatter seksjon 8b i `2026-08-02-norbiz-design.md`, som var skrevet uten
tilgang til API-et. Fire av antakelsene der var feil, og de er rettet under.

## Hvordan det ble mulig å sjekke

`data.ssb.no` er ikke nåbar fra utviklingscontaineren — `curl` gir `status=000`.
Men Postgres-utvidelsen `http` er tilgjengelig i Supabase-prosjektet, og
databasen har utgående nett. Alle oppslag under er gjort som

```sql
create extension if not exists http with schema extensions;
select (extensions.http_get('https://data.ssb.no/api/pxwebapi/v2/config')).content;
```

Det er verdt å merke seg som teknikk: når containeren er innelukket, kan
databasen brukes som utgående klient.

## Fire rettelser

| Antakelse i spec | Virkelighet |
|---|---|
| Base-URL `/api/v2/` | **`/api/pxwebapi/v2/`** — `/api/v2/` gir 404. `v2-beta` svarer identisk. |
| `maxDataCells` = 10 000 | **800 000.** Importen trenger langt færre kall enn planlagt. |
| Regionaltabellen er 12936 | **12937.** 12936 har ingen regionsdimensjon — den er delt på *sysselsettingsgruppe*. |
| Perioden er 2017–2023 | **2017–2024.** Ett år mer enn vi har modellert. |

API-versjon på verifiseringstidspunktet: `2.3.2`, appversjon `2.5.0+build.36`.
Standardformat `json-stat2`. `maxCallsPerTimeWindow` og `timeWindow` rapporteres
begge som `0`, altså ingen annonsert ratebegrensning — men vær likevel høflig.

## De tre åpne spørsmålene, besvart

**1. Har den regionale tabellen `driftsresultat` og `bruttoinvestering`?**

**Nei.** 12937 har nøyaktig fire måltall:

> Omsetning (mill. kr) · Lønn (mill. kr) · Antall bedrifter · Sysselsatte

Ingen driftsresultat, ingen bruttoinvestering, og heller ingen bearbeidingsverdi.
**Beslutning 2.1 holder**: `driftsmargin_pct` kan ikke regnes regionalt, og
constrainten som holder den NULL der er riktig — ikke en forenkling.

Til sammenligning har den nasjonale 12910 nitten måltall, blant dem *Brutto
driftsresultat*, *Bruttoinvesteringer*, *Bearbeidingsverdi* og *Produksjonsverdi*.

**2. Er 2017–2024 publisert på datidens fylkesinndeling, eller tilbakeskrevet?**

**Datidens.** Regionsdimensjonen i 12937 inneholder alle årgangene samtidig — 56
verdier: `0` (landet), de gamle fylkene `01`–`20`, 2020-årgangen `30 34 38 42 46`,
2024-årgangen `31 32 33 39 40 55 56`, landsdelene `L1`–`L7` og `L01`–`L09`, pluss
`88`/`99` for uoppgitt.

Modellen vår med `valid_from_year` og `valid_to_year` er altså riktig. Importen
må selv velge de kodene som gjaldt i året den henter — dimensjonen tilbyr alle,
og et kall på en kode utenfor sin årgang gir tomme celler.

**3. Finnes `arsverk`?**

**Ja** — «Årsverk» er et av de nitten måltallene i 12910. Men **bare nasjonalt**;
12937 har det ikke. Kolonnen `arsverk_per_enhet` blir derfor alltid NULL i
regionale rader, på samme måte som driftsmarginen.

## Granularitet, målt i kodelengder

SSB koder næring som `56` (2-siffer), `56.1` (3-siffer, 4 tegn), `56.10`
(4-siffer, 5 tegn) og `56.101` (5-siffer, 6 tegn). Antall verdier per lengde:

| Kodelengde | Nivå | 12910 nasjonalt | 12937 regionalt |
|---|---|---|---|
| 1 tegn | hovedområde (bokstav) | 16 | 16 |
| 2 tegn | 2-siffer | 76 | 76 |
| 4 tegn | 3-siffer | 237 | 237 |
| 5 tegn | 4-siffer | 545 | **—** |
| 6 tegn | 5-siffer | 744 | **—** |

**Dette er den direkte bekreftelsen på beslutning 2.1.** Nasjonalt går det til
5-siffer, regionalt stopper det på 3-siffer. Ikke fordi vi valgte det, men fordi
SSB ikke publiserer mer.

## Ni av våre næringskoder finnes ikke

Næringslista i `seed/industries.ts` ble skrevet uten tilgang til kodeverket, og
12 av 12 tosifrede og 25 av 25 tresifrede koder stemmer — men **9 av 65
femsifrede er oppdiktet.** Ved import ville de fått null rader og stått som tomme
næringssider.

| Vår kode | Vårt navn | Finnes hos SSB |
|---|---|---|
| `96.021` | Frisørsalong | nei — `96.020` Frisering og annen skjønnhetspleie |
| `96.022` | Hudpleiesalong | nei — nærmest `96.040` Kroppspleie og fysisk velvære |
| `96.011` | Renseri | nei — `96.010` Vaskeri- og renserivirksomhet |
| `43.910` | Takentreprenør | nei — `43.919` Takarbeid ellers |
| `43.991` | Blikkenslager | nei — `43.911` Blikkenslagerarbeid |
| `43.999` | Stillasfirma | nei — `43.990` Annen spesialisert bygge- og anlegg |
| `47.752` | Fargehandel | nei — må slås opp, `47.75x` er kosmetikk |
| `93.191` | Idrettsklubb | nei — `93.190` Andre sportsaktiviteter |
| `56.104` | Kaffebar | nei — **ingen egen kode**, inngår i `56.101` |

`56.104` er den mest opplysende: kafé har ingen egen femsifret kode, den ligger i
«Drift av restauranter og kafeer». Næringen skulle ikke eksistert som egen rad.

**Løsningen er ikke å rette de ni for hånd.** Den er å la `import-ssb` upserte
`industries` fra SSBs egen kodeliste, slik at `nace_code` og `name` per definisjon
ikke kan avvike fra kilden. Vårt eget `common_name` («Frisørsalong») blir da et
lag vi eier oppå SSBs navn — som er hele poenget med å ha to navnekolonner.

## Tabeller vi ikke visste om

Søk i kodelista avdekket at demografien finnes regionalt, i egne tabeller:

| Tabell | Innhold | Dimensjoner | Periode |
|---|---|---|---|
| **07164** | Åpnede konkurser | region, næring, org.form, sysselsettingsgruppe | 2006K1–2026K2 |
| **07165** | Åpnede konkurser, enklere | region, næring, org.form | 2006K1–2026K2 |
| **08076** | Nye foretak | region, næring, org.form | 2008K1–2026K1 |
| **13701** | Nyetablerte, overlevelse | region (kommune), alder, overlevelse | 2002–2023 |
| **14150** | Foretak etter størrelse | region, næring, org.form, størrelse | 2008–2023 |

Konkurstabellene er kvartalsvise og må aggregeres til år. At de finnes på både
fylke og kommune er bedre enn vi antok — `industry_demography` kan fylles
regionalt, ikke bare nasjonalt.

## SN2007 mot SN2025

SN2025 finnes i nye tabeller (14721, 14731, 14830), men strukturstatistikken vi
bruker ligger fortsatt på SN2007 for hele perioden 2017–2024. Vi blir på SN2007
til de historiske seriene flyttes, og kolonnenavnet `nace_code` er
standard-agnostisk, så et bytte treffer importen og ikke skjemaet.

## Spørringene, til etterprøving

```sql
-- Grensene
select (extensions.http_get(
  'https://data.ssb.no/api/pxwebapi/v2/config')).content::jsonb;

-- Måltall og dimensjoner i en tabell
select d.key, d.value->>'label'
from (select (extensions.http_get(
        'https://data.ssb.no/api/pxwebapi/v2/tables/12937/metadata'
      )).content::jsonb j) m, jsonb_each(m.j->'dimension') d;

-- Finn tabeller
select (extensions.http_get(
  'https://data.ssb.no/api/pxwebapi/v2/tables?query=omsetning%20n%C3%A6ring%20region'
)).content::jsonb;
```

---

## Brønnøysundregistrene, også verifisert

`http`-utvidelsen kommer ikke fram til Brreg — TLS-handshaket feiler med
`SSL_ERROR_SYSCALL`. Verifiseringen ble derfor gjort ved å deploye en midlertidig
edge function og kalle den *fra databasen*:

```sql
select (extensions.http((
  'GET', 'https://<ref>.supabase.co/functions/v1/<sonde>',
  array[extensions.http_header('Authorization', 'Bearer <anon-nokkel>')],
  null, null)::extensions.http_request)).content;
```

Det er samtidig mekanismen importørene skal trigges med, siden containeren ikke
når `functions/v1` direkte.

### Endepunktene

| | |
|---|---|
| Enhetsregisteret | `data.brreg.no/enhetsregisteret/api/enheter` |
| Regnskapsregisteret | `data.brreg.no/regnskapsregisteret/regnskap/{orgnr}` |

**Regnskapsstien har ikke `/api/` i seg.** Med `/api/` svarer Brreg `200` med en
HTML-side — ingen feil å fange, bare søppel som ville blitt parset som data.

### Tre funn som ville gitt gale tall

**Valuta er ikke alltid NOK.** Equinor rapporterer i USD, og regnskapet har et
`valuta`-felt. Et USD-beløp lagret i en kolonne alle leser som kroner er galt med
en faktor ti, og ser ikke galt ut. Importen tar bare NOK og teller resten som
utelatt.

**Enhetsregisteret bruker en annen næringsstandard enn SSB.** Målt:

| Kode | Treff hos Brreg |
|---|---|
| `56.101` | **0** |
| `56.110` | 11 962 |
| `96.020` | **0** |
| `96.021` | **0** |
| `69.201` | 778 |

Equinor står med `06.100 Utvinning av råolje`. SSBs 12910 er på SN2007. De to
kildene er altså ikke på samme revisjon, og en direkte kobling på femsifret kode
ville tapt rader i stillhet. Importen lagrer Brregs egen kode som den er, og
henter på **tresifret** nivå der standardene stemmer bedre — `56.1` traff 12 298
der `56.101` traff null.

Dette er et åpent punkt som fortjener en beslutning: skal `companies` kobles til
`industries` gjennom en egen SN2007↔SN2025-mapping, eller skal koblingen forbli
grov? En mapping ville vært vår, ikke kildens, og måtte merkes `beregnet`.

**Konsernregnskap må skilles fra selskapsregnskap.** `regnskapstype` er
`SELSKAP` eller `KONSERN`. Tar man det første elementet i lista, kan et
morselskap få konserntall og se mange ganger større ut enn virksomheten det
driver i Norge.
