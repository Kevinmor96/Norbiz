# Brreg-importen

`scripts/brreg.ts` utvider et kommunedatasett (`src/data/<kommune>.json`) med
enheter, roller og regnskap fra Brønnøysundregistrene. Den er første steg i
verifiseringspipelinen: det den henter, er `verifisert` med hentedatoen, og det
den ikke kan bekrefte i grunnlaget, legger den fram for et menneske.

```bash
MAKTKART_PERSON_SALT=… npm run brreg -- 5501              # henter og skriver
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --dry-run    # henter, viser tallene, skriver ingenting
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --terskel 50 # overstyrer terskelen
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --oppfrisk   # tømmer mellomlageret og henter på nytt
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 1804         # flere kommuner samme dag
npm run seed:build                                        # etterpå: seed-en følger datasettet
```

Uten `MAKTKART_PERSON_SALT` (minst 16 tegn) nekter skriptet å kjøre. Saltet
ligger utenfor repoet. Byttes det, får personene med hashsuffiks nye nøkler,
og mellomlageret må tømmes (`--oppfrisk`).

## Hva som hentes

Alt fra `data.brreg.no` med curl gjennom proxyen, høyst fem kall i sekundet og
nye forsøk med økende pause ved 429 og 5xx. Feltene er holdt mot det levende
API-et 25.09.2026.

| Hva | Kall | Regel |
|---|---|---|
| Enheter i kommunen | `enhetsregisteret/api/enheter?kommunenummer=…&fraAntallAnsatte=N` | Forretningsadressen i kommunen og minst N ansatte, sjekket på nytt per rad. |
| Underenheter i kommunen | `enhetsregisteret/api/underenheter?kommunenummer=…&fraAntallAnsatte=N` | Bare de med overordnet enhet **utenfor** kommunen: statens lokale kontorer, bankfilialer, kjeder. Lagres som eget organ med `overordnet` til forelderen, og forelderen hentes som eget organ. Tall summeres aldri på tvers av enhet og underenhet. |
| Alltid med | `enhetsregisteret/api/enheter/{orgnr}` | Hvert orgnr i grunnlaget, orgnr og navn i `scripts/brreg.config.json`, og grunnlagets organer uten orgnr som har et eksakt navnetreff. |
| Roller | `enhetsregisteret/api/enheter/{orgnr}/roller` | Daglig leder, styreleder, nestleder, styremedlem og varamedlem, for enhetene i kommunen og de som alltid er med. |
| Regnskap | `regnskapsregisteret/regnskap/{orgnr}` (uten `/api/`) | Siste årsregnskap for AS, ASA, SA, sparebanker, stiftelser, IKS, SF og SÆR. |

**Terskelen** er 20 ansatte for Tromsø (`scripts/brreg.config.json`). Den
settes med `fraAntallAnsatte`, aldri med `sort`, fordi `sort` bryter
filteret i Enhetsregisterets søk. Brreg svarer HTTP 400 under 5, og feilen
kommer som en tom liste, så konfigurasjonen avviser lavere verdier. Søket
stopper med en feil før det passerer Brregs dybdegrense på 10 000 treff.

**Enkeltpersonforetak, boligsameier og borettslag** tas ikke inn
(`src/data/brreg/orgform.json`, `hoppes_over`). Et ENK bærer innehaverens
navn, og roller og regnskap hentes ikke for dem.

## Hvor resultatet havner, og hvorfor

Importen **utvider datasettet på stedet**. En egen generert fil ved siden av
går ikke med `samle.ts`: den nekter to datasett med samme kommunenummer, og en
enhet som står i to filer, må være lik i begge. En egen fil måtte derfor fått
en egen flettregel, og datasettet ville ikke lenger vært én kilde.

Radene skilles på belegget:

- **Importørens rader** har `verifisering: "verifisert"` fra en av kildene
  `enhetsregisteret`, `brreg-roller` eller `regnskapsregisteret`, uten
  «Bekrefter grunnlaget» først i merknaden. De bygges på nytt ved hver kjøring,
  står sist i hver liste og er sortert på naturlig nøkkel.
- **Grunnlagets rader** er alt annet. De står i samme rekkefølge og røres
  bare når registeret bekrefter dem (se under). Skal du rette en importert
  rad for hånd, bytt belegget, så blir den en grunnlagsrad.
- **Historikk.** Regnskapsregisteret gir bare siste år. Tall for år registeret
  ikke lenger viser, blir stående så lenge organet er med.

Samme svar gir byte-like filer: ingen klokke utover hentedatoen, fast
rekkefølge, stabile nøkler. Svarene mellomlagres per URL under
`node_modules/.cache/maktkart-brreg/<kommunenr>/`, og hentedatoen i
`hentet.txt` er datoen for første henting. En ny kjøring bruker mellomlageret
og skriver de samme filene.

Nøkler: et organ som var med før, beholder nøkkelen sin (slått opp på orgnr),
og et organ som finnes i et annet kommunedatasett, får samme nøkkel der. Nye
organer får slug av navnet uten selskapsform, med orgnr bak ved kollisjon.

## Avstemming mot grunnlaget

**Organer.** Et Brreg-organ er grunnlagets organ når orgnr er likt, når
`koblinger` i konfigurasjonen sier det, eller når grunnlagets organ ikke har
orgnr og navnet er eksakt likt (foldet, uten selskapsform, bare ett treff).
Navnekoblinger meldes i rapporten så noen kan legge orgnr inn. Grunnlagets
organrad endres aldri: beskrivelse, myndighet og segmenter er vår vurdering,
ikke Brregs. Rapporten melder orgnr som ikke finnes, organer som er slettet,
konkurs eller under avvikling, ulikt navn på samme orgnr og mulige dubletter.

**Roller.** En rolle i grunnlaget er **bekreftet** når registeret har samme
rolletype i samme organ og navnet passer: fornavn og etternavn likt, og
grunnlagets mellomnavn finnes i registernavnet («Ellen Beate Lundberg» passer
«Ellen Beate Jensen Lundberg»). Daglig leder i kommunen i registeret kan
bekrefte toppleder i kommunens administrasjon i grunnlaget. En bekreftet rad
får `verifisert`, hentedatoen i `per`, kilden `brreg-roller` og en merknad som
begynner med «Bekrefter grunnlaget» og sier hva grunnlaget bygde på. Tittel,
status og datoer står.

Sier registeret noe annet, blir grunnlagets rad stående urørt. Registerets
rolle legges til ved siden av, og begge går til avviksrapporten. En rad som
ble bekreftet før, men som registeret ikke lenger viser, settes tilbake til
`maa_verifiseres` med en merknad, og meldes.

**Nøkkeltall.** Omsetning (sum driftsinntekter), driftsresultat, årsresultat
og egenkapital, med regnskapsår fra `regnskapsperiode.tilDato`. Et tall i
grunnlaget er bekreftet når år, type og konsern/selskap er like og
grunnlagets tall er registertallet avrundet: en halv enhet i grunnlagets siste
siffer, aldri mer enn en halv prosent. Da erstattes tallet med registertallet,
og det avrundede står i merknaden. Konsern og selskap holdes fra hverandre, og
morselskapets eget regnskap merkes. Regnskap i annen valuta enn kroner blir et
`hull`, aldri et kronebeløp. Et konserntall i grunnlaget sammenlignes aldri med
et selskapstall fra registeret.

**Avviksrapporten** skrives til `docs/avvik/brreg-<kommunenr>-<dato>.md`. Den
er generert og skrives på nytt ved neste kjøring; vurderingene hører hjemme i
datasettet eller i konfigurasjonen.

## Personer og personvern

- **Bare `key` og `navn`.** Ingenting annet om en person skrives, verken i
  datasettet, rapporten, loggen eller mellomlageret.
- **Fødselsdato brukes til én ting:** å skille navnebrødre. Hente-laget
  (`scripts/brreg/hent.ts`) regner HMAC-SHA256 av navn og fødselsdato med
  `MAKTKART_PERSON_SALT` og kaster datoen før svaret lagres eller leses videre.
  Hashen havner i personnøkkelen, seks tegn, **bare** når to personer ellers
  ville fått samme nøkkel (`ola-nordmann-3fa2c1`). Uten kollisjon: `ola-nordmann`.
- **Adresser** kastes i samme lag; bare kommunenummeret beholdes. Tidligere
  navn (som kan være en persons navn fra et ENK), telefon og e-post kastes også.
- **Et navn alene slår aldri sammen to personer.** En person fra registeret er
  grunnlagets person bare når de deler organ og navnet passer. Ellers blir hun
  en egen person, og rapporten melder «mulig samme person». Er det samme
  person, legg `"importert-nøkkel": "grunnlagets-nøkkel"` i `samme_person` i
  konfigurasjonen.
- **Navneregelen.** Nevner en tekst i grunnlaget et navn uten å lenke til
  personen, tas en navnebror fra registeret ikke inn, fordi en innsigelse da
  ikke ville nådd teksten. Et nytt organ som bærer en persons navn, tas ikke inn
  av samme grunn. Begge meldes.
- **Sensitive organer** (politi, påtale, domstoler, Forsvaret, barnevern;
  navnemønstre og næringskoder i konfigurasjonen): bare daglig leder, som
  `toppleder`, `dommer_leder` eller `paatale_leder`. De andre rollene kastes
  allerede i hente-laget.
- **Fratrådte, avregistrerte og døde** tas ikke inn. **Varamedlemmer** tas inn
  med status `vara`, så siden kan skjule dem som standard. Styremedlemmer valgt
  av de ansatte får «(valgt av de ansatte)» i tittelen.
- **Roller holdt av enheter**: styreplasser blir en relasjon `medlem_av` fra
  enheten til organet. Revisor, regnskapsfører og kontaktperson hentes ikke.

## Klassifisering

- **Nivå og organtype** fra organisasjonsformen, i `src/data/brreg/orgform.json`.
  Helseforetak er registrert som `SÆR` og skilles på navnet (HF, RHF).
  Underenheter arver fra forelderen. En form som verken er mappet eller hoppes
  over, tas ikke inn og meldes.
- **Segmenter** fra næringskoden, i `src/data/brreg/nace-segment.json`. Brreg
  fører SN2025, og tabellen mapper på **tittelen**, ikke bare koden: regelen
  gjelder bare når Brregs tittel på virksomhetens egen kode passer. 47.762 er
  kjæledyr i SN2025 og blomster i SN2007, og divisjon 45 finnes ikke lenger.
  Treffer prefikset uten at tittelen passer, får organet ikke segment, og
  rapporten melder koden. Tabellen er liten med vilje; en kode uten treff får
  ikke segment.

Begge tabellene ligger i `src/data/brreg/` og ikke i `src/data/`, fordi hver
`src/data/*.json` leses som et kommunedatasett.

## Hva importen ikke dekker

- **Regionale ledere i statlige etater.** Brreg har daglig leder for
  enheten (Statens vegvesen, Mattilsynet, NAV), ikke regiondirektøren i
  Tromsø. De må komme fra etatenes egne sider, som i grunnlaget.
- **Folkevalgte organer, utvalg og råd.** De er ikke rettssubjekter og har
  ingen roller i Brreg. Innsynsportalen og kommunens sider er kilden.
- **Eierskap og eierandeler.** Aksjonærregisteret er ikke åpent på samme måte.
  Deltakere i IKS og eierkommuner i KF står som roller hos Brreg, men uten
  andel, og tas ikke inn ennå.
- **Historikk for roller.** Rolle-API-et har ingen fra-dato per rolle og
  viser bare nåtid. En rolle som forsvinner, forsvinner fra importens rader
  (grunnlagets rader nedgraderes og meldes).
- **Regnskap før siste år.** Den åpne delen av Regnskapsregisteret gir bare
  siste innsendte årsregnskap. Serien bygges framover ved å kjøre importen
  hvert år; eldre tall blir stående.
- **Kommuner og fylkeskommuner** leverer ikke årsregnskap til
  Regnskapsregisteret.

## Kjente begrensninger

- **Felles organer på tvers av kommuner** (en statlig forelder, et nasjonalt
  selskap) må ha likt belegg i alle datasett, ellers stopper `samle.ts`.
  Kjør kommunene samme dag i én kommando.
- **Personnøkler på tvers av kommuner.** En person uten hashsuffiks i én
  kommune og med i en annen kan ikke kjennes igjen uten hashen. Basen har
  kolonnen `person.brreg_person_hash` for dette; pipelinen i Supabase bør
  skrive den.
- **Nøkkelskifte ved ny kollisjon.** Dukker det opp en navnebror senere, får
  begge hashsuffiks, og den første skifter nøkkel.

## Filer

| Fil | Hva |
|---|---|
| `scripts/brreg.ts` | Kommandolinjen og `kjor()`, som testene bruker |
| `scripts/brreg/hent.ts` | HTTP, mellomlager, vasking og normalisering til et øyeblikksbilde |
| `scripts/brreg/importer.ts` | Den rene avstemmingen: datasett + bilde → datasett + avvik |
| `scripts/brreg/rapport.ts` | Avviksrapporten og oppsummeringen |
| `scripts/brreg/konfig.ts`, `scripts/brreg.config.json` | Terskler, alltid-med, koblinger, sensitive mønstre |
| `src/data/brreg/nace-segment.json`, `src/data/brreg/orgform.json` | Tabellene |
| `tests/brreg-import.test.ts`, `tests/fixtures/brreg/` | Tester mot oppdiktede svar |
