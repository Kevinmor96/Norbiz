# Brreg-importen

`scripts/brreg.ts` utvider et kommunedatasett (`src/data/<kommune>.json`) med
enheter, roller og regnskap fra Brønnøysundregistrene. Den er første steg i
verifiseringspipelinen: det den henter, er `verifisert` med hentedatoen, og det
den ikke kan bekrefte i grunnlaget, legger den fram for et menneske.

```bash
MAKTKART_PERSON_SALT=… npm run brreg -- 5501              # henter og skriver
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --dry-run    # henter, viser tallene, skriver ingenting
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --terskel 50 # overstyrer kandidatterskelen
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 --oppfrisk   # tømmer mellomlageret og henter på nytt
MAKTKART_PERSON_SALT=… npm run brreg -- 5501 5503 5601    # flere kommuner i én kjøring
npm run seed:build                                        # etterpå: seed-en følger datasettene
```

Tromsø ble importert 25.09.2026: 238 organer i utvalget (169 kandidater og 69
som alltid er med), 220 nye organer, 836 nye personer, 996 roller, 63
relasjoner og 516 nøkkeltall. 23 roller og 3 nøkkeltall i grunnlaget ble
bekreftet; 7 roller og 2 nøkkeltall sier registeret noe annet om. Se
`docs/avvik/brreg-5501-2026-09-25.md`.

Samme dag ble ledere fra organenes egne sider flettet inn
(`docs/avvik/flett-offentlig-5501-2026-09-25.md`), og importen ble kjørt på
nytt mot mellomlageret. Da var 31 roller bekreftet, 5 grunnlagsroller motsagt
av registeret og merket `motsagt`, og 5 roller er roller registeret ikke fører.
Ingen nøkkeltall er motsagt lenger: grunnlagets «trolig konsern»-tall for
Remiks Miljøpark er merket som konserntall, og et konserntall sammenlignes
aldri med registerets selskapstall.

Uten `MAKTKART_PERSON_SALT` (minst 16 tegn) nekter skriptet å kjøre. Saltet
ligger utenfor repoet. Byttes det, får personene med hashsuffiks nye nøkler,
og mellomlageret må tømmes (`--oppfrisk`).

## Hva som hentes

Alt fra `data.brreg.no` med curl gjennom proxyen, høyst fem kall i sekundet og
nye forsøk med økende pause ved 429 og 5xx. Feltene er holdt mot det levende
API-et 25.09.2026.

| Hva | Kall | Regel |
|---|---|---|
| Enheter i kommunen | `enhetsregisteret/api/enheter?kommunenummer=…&fraAntallAnsatte=20` | Kandidater: forretningsadressen i kommunen og minst 20 ansatte, sjekket på nytt per rad. |
| Underenheter i kommunen | `enhetsregisteret/api/underenheter?kommunenummer=…&fraAntallAnsatte=20` | Kandidater: bare de med overordnet enhet **utenfor** kommunen (statens lokale kontorer, bankfilialer, kjeder). Lagres som eget organ med `overordnet` til forelderen, og forelderen tas med som eget organ. Tall summeres aldri på tvers av enhet og underenhet. |
| Alltid med | `enhetsregisteret/api/enheter/{orgnr}` | Hvert orgnr i grunnlaget, orgnr, `koblinger` og navn i `scripts/brreg.config.json`, og grunnlagets organer uten orgnr som har et eksakt navnetreff. Kopier av en annen kommunes grunnlagsrader telles ikke: de står der bare fordi et organ viste til dem sist, og utvalget skal ikke avhenge av forrige kjøring. |
| Regnskap | `regnskapsregisteret/regnskap/{orgnr}` (uten `/api/`) | Siste årsregnskap for kandidatene og de som alltid er med, for AS, ASA, SA, sparebanker, stiftelser, IKS, SF og SÆR. Hentes før utvalget, fordi omsetningen er ett av kriteriene. |
| Roller | `enhetsregisteret/api/enheter/{orgnr}/roller` | Daglig leder, styreleder, nestleder, styremedlem og varamedlem, bare for enhetene i utvalget. |

**Kandidatterskelen** er 20 ansatte. Den settes med `fraAntallAnsatte`, aldri
med `sort`, fordi `sort` bryter filteret i Enhetsregisterets søk. Brreg svarer
HTTP 400 under 5, og feilen kommer som en tom liste, så konfigurasjonen avviser
lavere verdier. Søket stopper med en feil før det passerer Brregs dybdegrense
på 10 000 treff.

## Utvalget

Av kandidatene kommer de med som oppfyller **minst ett** av disse
(`felles.utvalg` i `scripts/brreg.config.json`, kan overstyres per kommune):

| Grunn i merknaden | Regel |
|---|---|
| `ansatte>=50` | Minst 50 ansatte. |
| `omsetning>=100000000:2025` | Siste omsetning minst 100 mill. kr, med regnskapsåret. Bare kroner, selskapstallet før konserntallet. Bare enheter: en underenhet har ikke eget regnskap, og forelderens tall legges aldri på et lokalt kontor. |
| `topp10-ansatte` | Blant kommunens ti største kandidater etter ansatte, likhet brutt på orgnr. Slik får en liten kommune med sine største arbeidsgivere. |
| `kommunen` | Kommunens egen enhet (organisasjonsform KOMM). |
| `alltid-med` | Står på alltid-med-lista (se over). Vinner over regelen. |
| `overordnet` | Forelder til en underenhet i utvalget, uansett størrelse. |
| `styreplass` | Enhet som har en styreplass i et organ i utvalget. |

Grunnene står maskinlesbart først i belegg-merknaden på hvert importert organ:
`Utvalg: ansatte>=50, topp10-ansatte.` Metodesiden kan dermed si regelen, og en
leser kan se hvorfor et selskap er på kartet. Grunnlagets egne organer får
ingen slik merknad; de er med fordi grunnlaget har dem.

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

## Flere kommuner

`npm run brreg -- 5501 5503 …` henter alle kommunene først, med ett felles
mellomlager og én hentedato, og importerer dem så én og én. Hver kommune får
sin egen fil, `src/data/<slug>.json`.

- **Nye kommuner.** Har kommunen ikke noe datasett, lages det, med slug og
  navn fra `src/data/region/nord-norge.json` (offisielt navn med alle
  språkformene) og fylkesnavn derfra eller fra `felles.fylker`. Det nye
  datasettet har kommunens enhet fra Brreg og kommunestyret, som alle kommuner
  har etter kommuneloven § 5-1 (kilde `kommuneloven`, `oppgitt`). Medlemmer og
  ordfører er ikke hentet, og merknaden sier det.
- **Felles organer.** Et organ kan stå i flere kommuner (en statlig forelder,
  en styreeier, et organ på en annen kommunes alltid-med-liste), og `samle.ts`
  krever at raden er lik i alle. Et importert organ får den kanoniske raden
  (med sine grunner) fra kommunen det ligger i, og den skrives inn i de andre
  filene. Et grunnlagsorgan står med grunnlagets rad, kopiert likt (se under).
- **Hvem som fører rollene.** Roller, regnskap, valutahull og styreplasser for
  et organ føres i nøyaktig ett datasett, eierens. Eieren velges én gang for
  hele kjøringen (`fordelEierskap` i `scripts/brreg/importer.ts`), blant
  kommunene som har organet i utvalget sitt. Første regel som treffer:
  1. Kommunen i kjøringen der organet er **grunnlag**. Den avstemmer
     grunnlagets roller mot registeret. Skrev en annen kommune registerets
     rader, sto samme rolle to steder (Helse Nord RHFs styreleder sto både
     bekreftet i Tromsø og importert i Bodø).
  2. Et datasett **utenfor kjøringen** der organet er grunnlag. Ingen i
     kjøringen skriver da noe for organet.
  3. Kommunen organet **ligger i**, når den er med og organet er i utvalget der.
  4. Et datasett utenfor kjøringen som allerede **fører radene**, beholder dem.
  5. Kommunen med **lavest kommunenummer** som har organet i utvalget.

  Eieren tar bort importerte rader for organet i alle de andre datasettene,
  også under en annen nøkkel med samme orgnr, og ingen andre skriver dem.
  Regelen avhenger ikke av rekkefølgen kommunene importeres i, og en kommune
  kjørt alene gir de samme rollene for et organ som en kjøring med flere.
  Tester: «eierskap på tvers av kommuner» i `tests/brreg-import.test.ts`.

  Den første kjøringen for 80 kommuner (25.09.2026) ga organet til kommunen det
  ligger i når den hadde et datasett, også når organet ikke var i utvalget
  der. Nordkraft AS (Narvik) er på Tromsøs liste, men ikke i Narviks utvalg,
  og sto uten roller. Grunnlagsorganer koblet på navn i Tromsø (Helse Nord RHF,
  Finnmark fylkeskommune, Statsforvalteren i Troms og Finnmark, Karlsøy
  kommune) fikk en egen rad og rollene i kommunen de ligger i. 41 roller var
  borte fra Tromsøs organer, og elleve enheter sto med to rader.
- **Grunnlag i en annen kommune.** Viser en kommune til et organ som er
  grunnlag i en annen (UNN som forelder til en avdeling i Harstad), kopieres
  grunnlagsraden, segmentene, kjeden av overordnede og kildene nøyaktig. Kopien
  hentes på nytt fra originalen ved hver kjøring. Det gjelder også grunnlag
  uten orgnr: en kommune i kjøringen som kobler sitt grunnlag på navn eller med
  `koblinger`, deler koblingen med de andre, så Helse Nord RHF heter
  `helse-nord-rhf` også i Bodø. `koblinger` for en kommune utenfor kjøringen
  gjelder alltid. Et grunnlagsorgan uten orgnr i en kommune utenfor kjøringen
  kobles på eksakt navn bare når det er bundet til registeret der fra før
  (roller eller tall fra Brreg), eller når kommunen har en kopi av raden fra
  en tidligere kjøring. Koblingen meldes i rapporten.
- **Kommunens egen enhet beholder nøkkelen.** En enhet kommunen har en egen
  rad for, og som eget grunnlag viser til (kommunens enhet under
  kommunestyret), blir ikke byttet ut med en annen kommunes grunnlagsrad.
  Grunnlaget avgjør likevel hvem som fører rollene. Karlsøy kommune står
  derfor som `karlsoy-kommune` i Tromsøs grunnlag, med daglig leder, og som
  `karlsoy-kommune-940330408` i Karlsøy, uten roller. Radene må slås sammen
  for hånd.
- **Samme person.** Grunnlagskoblingene fra alle kommunene i kjøringen samles
  først, så en person som er koblet til grunnlaget i én kommune, får samme
  nøkkel i de andre. Registerpersoner får samme nøkkel i alle kommunene i samme
  kjøring.
- Hele resultatet valideres med `samle.ts` før noe skrives.

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

**Motsagt.** Registeret har forrang for rollene det selv fører: daglig leder,
styreleder, nestleder, styremedlem og varamedlem. Når et menneske har vurdert
et avvik, merkes grunnlagets rad `"motsagt": true`, og merknaden begynner med
«Motsagt av Brreg <dato>:» og sier hva registeret har. Raden får ikke `til`:
vi vet ikke når rollen eventuelt sluttet, og hentedatoen ville vært en
oppdiktet sluttdato. En motsagt rolle er ikke aktiv (`erAktiv` i
`src/lib/data/lokal.ts`, `intern.er_aktiv` i basen), men står i historikken.
Importøren lar merket stå og sier det i rapporten; bekrefter registeret raden
senere, tar importøren merket bort.

**Roller registeret ikke fører.** I statlige forvaltningsorganer
(organisasjonsform ORGL eller STAT) er toppleder, sorenskriver, lagmann og
embetsleder ikke roller i Enhetsregisteret. Registerets daglig leder kan
bekrefte dem, men er daglig leder en annen (assisterende statsforvalter,
administrasjonsdirektøren ved UiT, en administrasjonssjef i en domstol), er
det ikke et avvik. I foretak (AS, ASA, KF, IKS, sparebanker, HF og RHF, som
er registrert som SÆR), kommuner og fylkeskommuner er topplederen registerets
daglig leder etter loven, så der er en annen daglig leder et avvik som alle
andre. Et styreverv i et organ som ikke har styret sitt i registeret, som et
statlig universitet, er heller ikke et avvik. Begge rollene står, og
rapporten melder dem under «Roller registeret ikke fører (ikke avvik)», uten å
telle dem som motsagt eller som avvik til menneskelig vurdering.

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
  grunnlagets person bare når de deler organ og navnet passer (samme rolle,
  en annen rolle, eller en rolle Brreg ikke fører, som administrasjonsdirektør).
- **En navnebror holdes tilbake.** Har en person fra registeret samme navn som
  en person i grunnlaget uten felles organ, tas rollene hennes ikke inn før et
  menneske har avgjort det. To poster med samme navn ville gjort en innsigelse
  halv: sperres den ene, står navnet fortsatt i den andre. Rapporten melder
  henne. Er det samme person, legg `"importert-nøkkel": "grunnlagets-nøkkel"`
  i `samme_person`; er det en annen, legg nøkkelen i `ulik_person`.
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
- **Personnøkler på tvers av kjøringer.** Innen én kjøring får samme person
  samme nøkkel i alle kommunene. Kjøres kommunene hver for seg, kan en person
  uten hashsuffiks i én kommune ikke kjennes igjen i den neste, og hun får en
  egen nøkkel der (to poster, ingen konflikt). Kjør alle kommunene i én
  kommando. Basen har kolonnen `person.brreg_person_hash` for dette; pipelinen i
  Supabase bør skrive den.
- **Offentlig hierarki.** `overordnetEnhet` for enheter (UNN under Helse Nord)
  brukes ikke ennå, så den kanoniske raden for et felles organ er lik uansett
  hvilken kommune som skriver den. Bare underenheter får `overordnet`.
- **Grunnlagsorganer uten orgnr** kobles på navn i sin egen kommune, og de
  andre kjenner koblingen bare når kommunen er med i kjøringen eller organet
  er bundet til registeret der fra før. Kjøres en kommune alene før
  grunnlagets kommune er importert, lager den en egen rad for organet. Rollene
  står likevel bare ett sted, og raden forsvinner ved neste kjøring. Legg
  orgnr inn i grunnlaget (rapporten lister dem), så gjelder koblingen alltid.
- **Segment- og kildedefinisjoner ryddes ikke.** En definisjon importøren har
  lagt til, blir stående når organet som trengte den, er borte («reiseliv» i
  Kåfjord og Nordreisa etter rettingen av eierskapet), og rekkefølgen følger
  historikken. De kan ikke skilles fra grunnlagets egne.
- **Mislykkede svar mellomlagres ikke.** Bare 200, 404 og 410 lagres. Et
  regnskap Brreg svarte feil på (Sparebanken Narvik), spørres det etter på nytt
  ved hver kjøring.
- **Nøkkelskifte ved ny kollisjon.** Dukker det opp en navnebror senere, får
  begge hashsuffiks, og den første skifter nøkkel.

## Endringer utenfor importøren

Verifiserte rader i JSON krevde tre små endringer i datalaget:

- `tests/datasett.test.ts`: «ingenting er verifisert» er nå «verifisert bare fra
  en registerkilde, med hentedatoen som full dato i `per`».
- `scripts/seed-build.ts`: skriver `hentet` (hentedatoen kl. 00:00 UTC) for
  verifiserte rader, som basen krever, og lar en verifisert rad overskrives av
  en som er hentet samme dag eller senere.
- `src/lib/data/lokal.ts`: `hentet` i belegget er hentedatoen for verifiserte
  rader, i samme form som basen gir den.

Motsagte roller krevde det samme gjennom hele datalaget: feltet `motsagt` i
`Rolleinnehav` (`src/data/types.ts`) og `Rolle` (`kontrakt.ts`), `erAktiv` i
`lokal.ts`, kolonnen og `intern.er_aktiv` i
`supabase/migrations/0016_motsagt_rolle.sql` (som bytter ut RPC-ene som skiller
aktive roller fra tidligere), kolonnen i seed-byggeren og «motsagt av
registeret» i stedet for en dato på organsiden.

`tests/personvern.test.ts` sperrer grunnlagets personer én og én og Brreg-personene
samlet; én og én tok 355 sekunder med 881 personer.

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
