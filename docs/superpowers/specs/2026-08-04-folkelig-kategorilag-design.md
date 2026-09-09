# Folkelig kategorilag og topplister

Godkjent av Kevin 2026-08-04, med to presiseringer som er innarbeidet: mange
gode kategorier (ikke et minimum), og komplett tallbilde — økonomi,
etableringer, vekst og ansatte — for alt som vises. Etableringer krever ekte
demografi-import; dagens `industry_demography` er mock og skal ikke på
forsiden.

## 1. Problemet og markedsvurderingen

Dagens forside er et filter over SSB-begreper. Den som vurderer å starte
kafé møter «56.101 Drift av restauranter og kafeer» og en tom side som venter
på valg. Det er baklengs: informasjonen må komme først, valget etterpå.

Hva som faktisk trigger klikk og nysgjerrighet hos målgruppen (folk som
vurderer å starte, kjøpe eller investere):

- **Konkrete navn slår kategorier.** «SATS omsatte for X» klikkes; «93.130
  Treningssentre» gjør det ikke. Derfor kjedelisten og selskapstopplistene.
- **Rangering trigger.** «Topp 5», «høyest margin», «lavest margin» er
  formater folk kjenner fra sport og børs. Hver liste er en klikkflate, og
  hver rad i lista er en ny.
- **Kontrast trigger.** «Frisører har 17,6 % margin — restauranter 4,3 %» er
  en historie i én linje. Forsiden skal vise slike par, regnet fra ekte tall.
- **Nærhet trigger.** «Topp 10 i Troms» angår leseren på en måte
  Norgestoppen ikke gjør. Fylkesvelgeren står derfor høyt på siden.
- **Tall må se levende ut** uten å lyve om ferskhet: sparklines 2019–2024,
  retningsfarger (grønn opp, rød ned), årstall alltid synlig. Aldri «LIVE»
  eller «oppdatert daglig» — SSB publiserer årlig med etterslep, og
  copy-spec-en forbyr ferskhetspåstander.

Konkurransefortrinnet er selve oppdelingen: alle konkurrenter (Proff, Purehelp,
regnskapstall-sidene) er organisert etter enten NACE eller enkeltselskap.
Ingen tilbyr det redaksjonelle laget «hva folk faktisk vurderer å starte»,
med SSB-totaler og Brreg-selskaper koblet i samme visning.

## 2. Oppdelingen

30 kategorier i 6 verdener. Prinsipp: hver kategori er noe man kan si høyt
på en fest («jeg vurderer å åpne kafé»), aldri et SSB-begrep. Én kategori
samler gjerne flere NACE-koder; medlemskoder i samme kategori får aldri
overlappe hierarkisk (aldri både 56.1 og 56.101), ellers dobbelteller
summene. En test håndhever det.

| Verden | Kategorier |
|---|---|
| Mat & drikke | Restaurant & kafé · Gatekjøkken · Bar & pub · Catering & kantine · Bakeri & konditori |
| Butikk | Dagligvare · Kiosk · Klesbutikk · Skobutikk · Sportsbutikk · Møbel & interiør · Elektronikkbutikk · Gullsmed · Optiker · Blomster & hage |
| Turisme & opplevelser | Hotell & overnatting · Camping & hytter · Opplevelser & aktiviteter · Reisebyrå & arrangør |
| Helse & velvære | Frisør · Hudpleie & velvære · Treningssenter · Tannlege · Fysioterapi |
| Bygg & håndverk | Byggefirma · Elektriker · Rørlegger · Maler & overflate |
| Tjenester | Renhold · Regnskap & revisjon |

Kodetilordningen skjer i seed-en (kuratert, versjonert), med disse avklarte
punktene:

- **Gullsmed → 47.772** (gull- og sølvvarer) og **Optiker → 47.782** (optiske
  artikler). Seed-en hadde Gullsmed på 47.782 — det er SSBs optikerkode.
  Rettes som del av dette arbeidet.
- **«Turistbutikk» utelates.** SSB har ingen kode for det; nærmeste er
  «butikkhandel ikke nevnt annet sted». Å vise den som turistbutikk ville
  vært tall som ikke betyr det brukeren tror.
- Bakeri & konditori kombinerer produksjon (10.71x) og utsalg (47.24x) — de
  overlapper ikke, så summen er ren.
- Opplevelser & aktiviteter samler fornøyelses-/fritidskodene (93.2x) og
  turbiltransport; Reisebyrå & arrangør er 79-kodene alene.

Kategoriene er data, ikke kode: å legge til kategori nummer 31 er en
seed-endring, ingen migrasjon og ingen frontend-endring.

## 3. Tallene per kategori — komplett bilde

Hvert kategorikort og hver kategoriside viser, alt regnet i basen fra
`data_quality='ssb'`-rader:

| Tall | Kilde | Merknad |
|---|---|---|
| Antall bedrifter | 12910 `Enheter` (foretak) | |
| Omsetning totalt og per bedrift | 12910 `Oms` | |
| Driftsmargin | 12910 | finnes kun nasjonalt — regionale kort viser den ikke |
| Ansatte/sysselsatte, per bedrift | 12910/12937 | |
| Vekst | beregnet av tidsserien 2019–2024 | CAGR + siste års endring, alltid med årstall |
| Sparkline | tidsserien | 5–6 punkter |
| Etableringer, konkurser | **ny import**, se §5 | vises ikke før den er ekte |
| Lønnsnivå | `industry_wages` | fortsatt seed-basert; merkes `beregnet` til ekte import finnes |

Regionale kategoritall har en ærlig begrensning: SSB publiserer fylkestall
bare på NACE 2–3, mens flere kategorier er femsifrede (Dagligvare 47.111).
Kategorisiden løser det todelt: fylkestall vises der kategorien er ren på
tresifret nivå (Hotell = 55.1, Reisebyrå = 79.1), og ellers viser
regionsvisningen selskapene i fylket (Brreg har kommune per selskap) uten å
late som SSB-fylkestall finnes. Ingen tall «skaleres ned» fra nasjonalt.

## 4. Datamodell

Migrasjon 0014, samme stil som resten av skjemaet:

- `categories`: slug (pk-kandidat, unik), navn, verden, beskrivelse (én
  selgende setning), farge, ikon, sortering.
- `category_members`: category_id → nace_code (FK til industries), unik per
  par. Testen håndhever null hierarkisk overlapp innen kategori.
- `brands`: navn, category_id, org_nr (FK-løs — selskapet kan mangle til
  målrettet henting har kjørt), kommentarfelt for hva org_nr faktisk er
  (morselskap, driftsselskap). ~30 kuraterte kjeder i seed: REMA 1000, SATS,
  Espresso House, Cutters, Power, XXL, Princess, Nille osv. Kjedens tall er
  hovedselskapets regnskap og merkes som det — aldri som «hele kjeden».

Migrasjon 0015, topplistefunksjoner (samme mønster som `kommune_aggregat`:
ikke security definer, terskler i basen, PostgREST-kallbare):

- `kategori_oversikt()` — ett kort per kategori: nøkkeltall siste år +
  tidsserie som jsonb for sparkline.
- `topp_selskaper(kategori_slug, fylke_code default null, metrikk default
  'omsetning', antall default 10)` — fra `companies` der
  `inngar_i_regnskapssnitt`, med navn, kommune, omsetning, margin, ansatte,
  regnskapsår. Fylke avledes av kommune_code-prefiks.
- `kategori_rangering(metrikk, retning)` — «høyest/lavest margin i Norge»,
  «størst vekst» på tvers av kategoriene.
- `brand_liste(kategori_slug default null)` — kjedene med tilkoblede tall.

Views som eventuelt trengs får `security_invoker = true`; testen fra 0012
håndhever det.

## 5. Ekte demografi — etableringer og konkurser

Brukeren har eksplisitt bedt om etableringer i tallbildet, og dagens
`industry_demography` er mock. Kildene er **08076** (nye foretak, region ×
næring, kvartal) og **07165** (åpnede konkurser, samme oppdeling). Ny edge
function `import-demografi` etter samme skiveprotokoll som import-ssb
(samme MANGEL-mapping, samme PostgREST-upsert) fyller
`industry_demography` med `data_quality='ssb'` og erstatter mock-radene.

**13701 kan ikke brukes.** Tabellen har ingen næringsdimensjon, bare region
og alder, så den kan ikke fylle `overlevelse_*_pct` per næring.
Kolonnene forblir null i ssb-radene, og UI-et viser dem ikke. Et
overlevelsestall lånt fra næringslivet som helhet ville sett ut som
kategoriens eget.

Metadata-verifiseringen (gjort før koden ble skrevet) avdekket tre ting som
endret importen:

- **Organisasjonsform er en egen dimensjon** med totalkoden `99` = «I alt» i
  samme liste som delene. Uten å velge den eksplisitt dobbelteller en
  summering.
- **Næringsdimensjonen er bare tosifret.** Demografi finnes ikke per
  tresifret næring; radene får `nace_level = 2`, og en kategori som samler
  femsifrede koder får dermed etableringstall fra næringen over. UI-et må si
  hvilket nivå tallet gjelder.
- **Tabellene er kvartalsvise.** Importen summerer til år og hopper over år
  uten alle fire kvartaler — et trekvart år utgitt som helt ser ut som en
  kollaps i etableringstakten.

Rekkefølgeregel: kortene viser etableringer/konkurser først når raden bak
er `ssb`. Er importen ikke kjørt for en kategori, utelates feltet — mock
skal aldri på forsiden.

## 5b. To feller i kategorisummene, funnet mot ekte tall

Begge ble oppdaget da de 30 kategoriene traff SSB-tallene, og begge er
håndtert i basen (migrasjon 0016 og 0017) fordi de ellers ville produsert
selvsikre, gale påstander på forsiden.

**En kategorisum er bare sammenlignbar over år hvis alle medlemskodene har
tallet.** 69.201 mangler omsetning for 2024, så Regnskap & revisjon falt
fra 42,1 til 23,1 mrd og ville blitt vist som −6 % årlig vekst i en næring
som vokser. `kategori_oversikt()` bruker nå bare år der alle kodene har
både rad og omsetning, og sparkline-serien filtreres likt.

**Driftsmargin måler ikke det samme i eierdrevne og lønnsdrevne næringer.**
Fysioterapi har 56 % margin og 148 000 kr lønnskostnad per sysselsatt;
regnskap har 14 % og 820 000. Forskjellen er at eierens eget arbeid ikke er
lønnskostnad. En «høyest margin»-liste ville rangert eierdrift øverst av en
teknisk grunn. Tallet skjules ikke, det merkes: `lonn_per_sysselsatt` og
`eierlonn_i_resultat` følger både oversikten og rangeringen, så UI-et kan si
det rett ut.

Første forsøk brukte lønn per sysselsatt alene, og det traff 18 av 30
kategorier. Feilen var å behandle to fenomen som ett: ulønnet eierarbeid og
deltid ser like ut i tallet. Dagligvare har 374 000 kr per sysselsatt, men
23 ansatte per butikk — der er stillingene små, ikke eieren ulønnet. Flagget
krever nå under tre ansatte per bedrift i tillegg, og står igjen med fem
kategorier: Fysioterapi (0,9 ansatte), Hudpleie (1,1), Frisør (1,8), Camping
(2,1) og Tannlege (2,3). Det er nettopp de fem som ellers topper
marginlisten uten å være mer lønnsomme.

## 6. Målrettet Brreg-henting

Dagens utvalg er de ~50 første per næring i Brregs rekkefølge — alfabetisk,
ikke størst. To utvidelser i `import-brreg`:

- `?stor=1`: bruker `fraAntallAnsatte`-filteret (verifisert parameter) til å
  hente enheter med flest ansatte per kategorikode, slik at
  `topp_selskaper` faktisk viser de største.
- `?brands=1`: slår opp org-numrene i `brands` direkte
  (enhetsregisteret/{orgnr} + regnskap) så kjedelisten alltid har tall.

Samme skiveprotokoll, samme idempotente upsert.

## 7. Forsiden og det visuelle

Brukeren møter aldri filtermenyen. Siden bygges ovenfra:

1. **Hero:** ett spørsmål («Hva vurderer du å starte?») + søk som matcher
   kategorinavn og `search_terms`. Under: tre kontrastkort med margin-par
   regnet fra ekte tall (à la «Frisører: 17,6 % · Restauranter: 4,3 %») som
   umiddelbart beviser at siden har substans.
2. **Verdener med kategorikort:** 6 seksjoner, kort med navn, ikon, antall
   bedrifter, margin, sparkline og retningsfarge. Kortet er hele
   klikkflaten.
3. **Topplistemoduler:** «Topp 5 treningssentre i Norge», «Høyest margin i
   Norge», «Lavest margin i Norge», og en fylkesvelger som bytter alle
   listene til fylket («Topp 10 i Troms»). Lister viser rangnummer stort,
   selskapsnavn, tall, og mini-graf der tidsserie finnes (selskaper har ett
   regnskapsår — de får årstempel, ikke lånt graf, jf. invarianten).
4. **Kjedestripe:** «Kjenner du igjen disse?» — brands med logo-plass, tall
   og kategorilenke.

Visuelt språk (styrer Lovable-meldingene): proft og tallbårent — tenk
børs/sport, ikke brosjyre. Store tall i tabular-lining, sparklines overalt,
konsekvent retningsfarge, rangeringsnumre som typografisk element. Farge per
verden (fra `categories.farge`) så kategorisidene arver identitet. Ingen
stockfoto. Årstall ved hvert tall.

Detaljfilteret (dagens NACE-utforsker) flyttes til «Avansert» og markeres
som fremtidig premium; gaten håndheves ikke i v1, men grensen tegnes i
UI-et nå. Premium-kandidater per roadmap-spec-en: avansert filter, fulle
lister (gratis viser topp 5, premium resten), eksport.

## 8. Testing

PGlite-tester i samme stil som resten:

- Kategorimedlemmer: ingen hierarkisk overlapp innen kategori, alle koder
  finnes i `industries`, Gullsmed=47.772 og Optiker=47.782 eksplisitt.
- Alle 30 kategorier har minst én medlemskode med SSB-statistikk.
- Toppliste-funksjonene: kjørbare som anon, respekterer
  `inngar_i_regnskapssnitt`, fylkesfilteret treffer via kommuneprefiks.
- Ingen security definer-funksjoner, ingen eier-views (eksisterende tester
  dekker nye objekter automatisk).
- Demografi-importens mapper: kvartal-til-år-summering og MANGEL-tegn.

## 9. Rekkefølge

1. Migrasjon 0014 + 0015, seed for kategorier/brands, tester (rent datalag,
   PGlite-verifiserbart her).
2. Demografi-import: verifiser 08076/07165-dimensjonene, skriv og kjør
   `import-demografi`.
3. Utvid `import-brreg` (`stor`, `brands`), kjør målrettet henting.
4. Lovable-omleggingen av forsiden og kategorisidene mot de nye funksjonene.
5. Premium-grensen tegnes i UI (uten gating).
