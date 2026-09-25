# Pivot: fra bransjeindeks til «hva tjener de som gjør dette?»

Dato: 2026-09-08. Status: besluttet, under bygging.

## Diagnosen

Siden svarer i dag på **«er denne typen virksomhet verdt å drive, her?»** Det er
et presist spørsmål, og det er feil spørsmål å møte folk med. Det forutsetter at
leseren allerede har en forretningsidé, allerede vet hva bransjen heter, og
allerede vet at hun vil vite noe om den. Det er noen tusen mennesker i året.

Spørsmålet folk faktisk har stilt seg — de fleste av oss, flere ganger — er
**«hva tjener egentlig de som driver med dette?»**

Det er ikke et annet datasett. Det er det samme datasettet, snudd mot leseren.

## Hva dataene faktisk beskriver — og hvorfor det passer

Dette er poenget hele pivoten hviler på: databasen beskriver allerede
enkeltpersonene, vi har bare aldri sagt det.

| Kategori | Virksomheter | Ansatte per foretak | Driftsresultat per foretak |
|---|---|---|---|
| Fysioterapi | 5 224 | 0,9 | 663 861 kr |
| Hudpleie & velvære | 1 932 | 1,1 | 147 134 kr |
| Frisør | 10 993 | 1,8 | 224 138 kr |
| Camping & hytter | 2 196 | 2,1 | 481 346 kr |
| Tannlege | 4 671 | 2,3 | 1 263 680 kr |

Alle tall målt (SSB 12910/12937 og Brreg, 2024). Et foretak med 0,9 ansatte er
ikke en bedrift i dagligtale — det er én person. Vi har 5 224 av dem i
fysioterapi alene. Databasen er, uten at forsiden har sagt det med ett ord, en
kartlegging av folk som har startet for seg selv og hva de sitter igjen med.

## Ærlig avgrensning: «starte for deg selv», ikke «side hustle»

Utgangspunktet var en sidegesjeft-radar. Den rammen over-lover mot våre data, og
avgrensningen gjør produktet bedre, ikke smalere:

Vi ser **registrerte foretak med regnskap**. Vi ser ikke småjobber, gig-arbeid
eller inntekt under registreringsgrensa. Noen som tar 6 000 kr i året på
strøjobber finnes ikke i noe tall vi har.

Så rammen er **«starte for deg selv»** — og det er nettopp det spørsmålet en som
vurderer en sidegesjeft trenger svar på før hun satser: *hva sitter de igjen med,
de som allerede har gjort dette på ordentlig?*

## De tre spørsmålene, i rekkefølge etter dragning

### 1. «Hva sitter de igjen med?»
Driftsresultat per foretak. Målt. Ofte nøkternt nok til å være troverdig —
147 134 kr i hudpleie er et tall ingen markedsføringsavdeling ville funnet på.

### 2. «Kan jeg gjøre det alene?»
Ansatte per foretak. Tallet ligger allerede i `kategori_oversikt()` og har aldri
stått på forsiden. Det er den mest leservendte kolonnen vi eier.

### 3. «Hva må jeg omsette for å tjene X?»
Målinntekt delt på bransjens målte driftsmargin. Frisørbransjen har 16,95 %
margin: for 10 000 kr i månedlig driftsresultat må du fakturere ca. 59 000 kr i
måneden.

**Dette er det ærlige svaret på det forslaget kalte «Hva kan jeg tjene?».** Det
bærer det samme løftet — *hva kan dette bli for meg* — men det kan ikke lyve,
fordi det aldri påstår at noen kommer til å kjøpe. Det oppgir regnestykket og lar
leseren selv vurdere om hun klarer å selge så mye. Etterspørselen er leserens
vurdering; marginen er vår måling.

## Hva som bevisst ikke bygges

Tre ting fra det opprinnelige forslaget står igjen som avvist, og begrunnelsen
hører i repoet så neste runde ikke tar dem opp på nytt:

**Ingen opportunity index.** `Etterspørsel × Pris × Frekvens ÷ Konkurranse ×
Oppstartskostnad` har fem ledd uten fasit og ett svar med to gjeldende siffer.
Det er `industry_estimates` om igjen — etableringskapital ga riktig tall for
restaurant og fem ganger for lavt for frisør, og systemet kunne ikke se hvilket
som var hvilket. Punkt 3 over gir samme følelse med etterprøvbar aritmetikk.

**Ingen skraping av etterspørsel.** Småjobb-plattformer og FINN har annonsene
sine som selve produktet; Facebook-grupper er lukket; Google Trends er relative
indekser uten volum og kan ikke ganges med en pris. Vi henter Brreg ved kilden
framfor å skrape videreselgere — den regelen gjelder også her.

**Ingen skattekalkulator.** Grensa mellom hobby og næringsvirksomhet er en
skjønnsvurdering med etterberegning og tilleggsskatt i den andre enden, og
`/vilkar` sier at vi ikke gir økonomisk eller juridisk rådgivning. Vi gjengir
Skatteetatens terskler som fakta med kilde og lenker dit. Vi regner ikke for
leseren.

## Det som bygges

### Datalag — migrasjon 0036

**`solo_oversikt()`** rangerer alle kategoriene på ansatte per foretak, med lønn,
margin, driftsresultat per foretak og vekst. Rangering og utledning hører i basen
av samme grunn som resten: PostgREST avviser aggregater, og en terskel som bare
finnes i UI-et er en anbefaling, ikke en terskel.

`soloklasse` er en **merking av et målt tall**, ikke et nytt tall — samme
konstruksjon som `eierlonn_i_resultat`:

| Klasse | Ansatte per foretak | Leservendt |
|---|---|---|
| `alene` | < 1,5 | «Typisk én person» |
| `to` | 1,5–2,9 | «Deg og én til» |
| `lag` | 3–9,9 | «Et lite lag» |
| `bedrift` | ≥ 10 | «En bedrift» |

**`hva_ma_du_omsette(i_slug, i_mal_mnd)`** inverterer marginen. To regler bærer
ærligheten:

1. **Ikke-positiv margin gir ingen rad.** Blomster & hage har −0,61 %
   driftsmargin i 2024. Å invertere den gir et negativt omsetningskrav, altså
   tull med to desimaler. Funksjonen tier, slik `kategori_lonn` tier der kilden
   tier.
2. **`eierlonn_i_resultat` følger raden ut, og UI-et må vise den.** Der
   flagget er usant er driftsresultatet regnet *etter* at lønn er betalt — da
   er målbeløpet ikke det du tar ut, men det foretaket sitter igjen med i
   tillegg til lønna di. Samme skille mellom eierdrift og lønnsdrift som
   allerede er en invariant, og med det etablerte navnet: ett faktum skal ikke
   ha to kolonnenavn.

Funksjonen returnerer også kategoriens målte omsetning per foretak, slik at
regnestykket kan settes ved siden av virkeligheten: *«du må omsette for 59 000 kr
i måneden — et typisk frisørforetak omsetter for 110 000.»* Den sammenligningen
er det som gjør tallet nyttig i stedet for skummelt.

### Frontend

- **Forsiden** åpner på spørsmålet, ikke på et filter: «Hva tjener de som driver
  med dette?» med søk og noen store, lesbare inngangskort.
- **`/alene`** — «Bransjer du kan drive alene», bygget på `solo_oversikt()`.
  Dette er den nye landingssiden for den nysgjerrige.
- **Regnestykket** som modul på hver kategoriside: skriv inn hva du vil tjene,
  få nødvendig omsetning ved siden av hva et typisk foretak faktisk omsetter.
- **Copy:** hvert tall får en setning. «0,9 ansatte per foretak» er statistikk;
  «det typiske fysioterapiforetaket er én person» er et svar.

### Det som ikke endres

Domenet, kategorilaget, importørene, forankringsdisiplinen, alle invariantene.
Pivoten er en inngangsport og en ramme rundt målte tall — ikke et nytt datasett
og ikke en ny sannhetsstandard. Vollgraven er fortsatt at vi sier hva vi ikke
vet, og punkt 3 er bygget nettopp for å beholde den under et løfte som frister.
