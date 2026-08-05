# Designsystem — Bransjesjekk

Modus: **Operate.** Leseren er i en oppgave — «er denne typen virksomhet verdt å
drive, her?» — og skal komme ut med et svar. Skanbarhet, konsistens og presisjon
slår uttrykk. Merkevaren bor i detaljene, ikke i utsmykningen.

Forsiden er det ene unntaket: den er **Persuade**, og eier hero, nyhetsbrev og
luksusstripa. Alt annet — kategorisider, næringssider, topplister, dashbord,
fylkesprofiler — er Operate.

Dette er en **forsterkning**, ikke en ny visuell verden. Signaturen beholdes.

## Navnet: Bransjesjekk

Domenet er kjøpt: `bransjesjekk.no`. Navnebyttet er ikke kosmetikk — det er den
eneste delen av designsystemet som endrer *tonen*, og det peker samme vei som
målgruppen vi faktisk skal ha de første årene.

«Indeks» er et substantiv. Det beskriver en beholder, lover fullstendighet og
adresserer en analytiker. «Sjekk» er et **verb**. Det beskriver en handling,
lover ett svar, og adresserer et menneske med et konkret spørsmål. Fire
konsekvenser, og de er alle designbeslutninger:

**1. Produktet er et verb, så flaten må tilby verbet.** Dagens navigasjon heter
«Indeksen · Topplister · Dashbord · Favoritter» — fire substantiver som navngir
datamodellen vår. «Indeksen» er den svakeste lenkeetiketten i produktet: den
sier hva vi har, ikke hva du får. Handlingen «sjekk en bransje» skal være det
første som er mulig å gjøre. Se §10.

**2. En sjekk er entall.** Man sjekker én ting. Kategorisiden er derfor
produktet, og forsiden er døra — ikke katalogen. Ni verdener ganget med 40
kategorier på forsiden er en katalog.

**3. En sjekk ender i en dom, og det hever kravet til Tier 1.** «Indeks» lovte
bare en plassering i en liste. «Sjekk» lover et svar. De to herotallene skal
derfor følges av **én setning på vanlig norsk, satt sammen av målte felt** — ikke
en AI-vurdering, ikke en anbefaling:

```
9,3 % driftsmargin · ned 1,2 pp fra 2023
1,4 ansatte per bedrift — dette er en bransje du driver selv.
```

Andre linje er `eierlonn_i_resultat` og `ansatte per foretak` skrevet ut som
språk. Den er sann fordi den bare gjentar tall som står på siden.

**4. «Sjekk» må aldri bli vår handling.** Skriv aldri «Bransjesjekk har sjekket
5 805 selskaper». Vi har *sammenstilt* dem, vi har ikke revidert dem. Ordet skal
forbli brukerens handling — den samme disiplinen som forbudet mot «LIVE», og av
samme grunn: en påstand om arbeid vi ikke har gjort.

Tonen blir lettere i verbene og skal bli **strengere i substantivene**. «Sjekk
bransjen før du satser» er riktig register. «Er frisør en pengemaskin?» er det
ikke — troverdigheten vår ligger i kildelinja, og den tåler ikke at overskriften
selger.

«Indeks» beholdes som *vanlig substantiv* der det er teknisk presist:
`score_total` er en indeks, og skal kunne kalles det. Det er produktnavnet som
byttes, ikke ordet.

### Ordmerket

`Bransje` i vekt 500, `sjekk` i vekt 700 — samme størrelse, samme farge, ingen
aksentfarge, sporing −0,02em. Trykket lander på verbet, som er det produktet
gjør. Space Grotesk, og dette er det **eneste** stedet display-fonten bærer et
ord istedenfor et tall (se §3).

**Ingen avkrysningsmerke.** Det åpenbare merket for en «sjekk» er en grønn ✓, og
grønt er opptatt: scorestripa har bestemt at grønt betyr bra. En grønn hake ved
siden av en score på 31 av 100 er en selvmotsigelse leseren kjenner før hun
leser. I tillegg sier en hake «verifisert» — påstanden vi nettopp forbød.

Trengs et merke i favicon, nav og delekort, er det **scorestripa selv**: fem
segmenter, som fungerer i én farge og leses som fem hakk ved 16 px. Den sier
måling, ikke godkjenning, og er allerede produktets mest gjenkjennelige objekt.
Dagens `favicon.ico` er Lovable-standarden og skal byttes.

## 1. Signaturen som beholdes

Tre ting i dagens system er ekte designbeslutninger og skal ikke røres:

- **Lyst panel på mørk grunn.** `--panel`-tokenene. Vekslingen mellom mørk
  kontekst og lyst datapanel er det som gjør produktet gjenkjennelig, og den
  gjør samtidig en funksjonell jobb: tallene leses på det lyse feltet, rammen
  rundt er mørk. Behold.
- **Space Grotesk på tallene.** Store nøkkeltall i display-fonten. Se
  begrensningen i §3 — den gjelder bare figurene, aldri etiketter eller
  tabellceller.
- **Femdelt scorestripe, rød til grønn.** `--score-1` … `--score-5`. Semantisk,
  og derfor låst. Se §2.

## 2. Farge

### Verdiktrommet er opptatt

Scorestripa er **semantisk**: rødt betyr dårlig, grønt betyr bra. Den eier
hueområdet 25°–155° (rød 25, oransje 55, gul 90, grønn 145–155).

**Ingen kategorisk farge får bo i det området.** En omsetningsserie i grønt
leser som «bra», en i rødt som «dårlig», og det er en påstand vi ikke har gjort.
Kategoriske farger skal derfor ligge i 180°–330°. Dette er regelen som
graffargene brøt før: `--chart-1` var oransje (41°) og `--chart-4` gul (84°),
altså midt i verdiktrommet.

### Graffarger — erstatter shadcn-standardene

`--chart-1` til `--chart-5` var urørte shadcn-defaults. I et dataprodukt er
graffargene der identiteten faktisk bor, så de er designet nå:

| Token | Lys modus | Mørk modus | Rolle |
|---|---|---|---|
| `--chart-1` | `oklch(0.62 0.15 258)` | `oklch(0.70 0.13 258)` | Primærserie: omsetning |
| `--chart-2` | `oklch(0.74 0.12 195)` | `oklch(0.80 0.11 195)` | Sekundær: antall enheter |
| `--chart-3` | `oklch(0.54 0.17 295)` | `oklch(0.63 0.15 295)` | Tredje: sysselsatte |
| `--chart-4` | `oklch(0.68 0.14 330)` | `oklch(0.75 0.13 330)` | Fjerde: etableringer |
| `--chart-5` | `oklch(0.44 0.09 245)` | `oklch(0.55 0.08 245)` | Femte / referanselinje |

Lysheten er en **stige** — 0.44, 0.54, 0.62, 0.68, 0.74 — så seriene er
separerbare i gråtoner og for den som ikke skiller blått fra fiolett. Det er
ikke pynt: en linjegraf lest i utskrift eller med deuteranopi må fortsatt gi
fem forskjellige linjer.

### De ni verdensfargene skal harmoniseres

`categories.farge` bærer ni farger valgt ad hoc under kategoriarbeidet, uten
felles lyshet eller chroma, uten test mot mørk grunn. Fire av dem ligger dessuten
i verdiktrommet.

De skal normaliseres til **én lyshet og én chroma, bare hue varierer** — det er
det som gjør en fargekode til en identifikator framfor en dom:

| Verden | Fra | Til (lys) | Til (mørk) |
|---|---|---|---|
| Mat & drikke | `#E4572E` | `oklch(0.63 0.14 35)` | `oklch(0.72 0.13 35)` |
| Butikk | `#2E86AB` | `oklch(0.63 0.14 235)` | `oklch(0.72 0.13 235)` |
| Turisme & opplevelser | `#7B4B94` | `oklch(0.63 0.14 305)` | `oklch(0.72 0.13 305)` |
| Helse & velvære | `#C05299` | `oklch(0.63 0.14 340)` | `oklch(0.72 0.13 340)` |
| Bygg & håndverk | `#D08C1D` | `oklch(0.63 0.14 70)` | `oklch(0.72 0.13 70)` |
| Tjenester | `#3B7A57` | `oklch(0.63 0.14 160)` | `oklch(0.72 0.13 160)` |
| Bil & motor | `#4C6EF5` | `oklch(0.63 0.14 265)` | `oklch(0.72 0.13 265)` |
| Media & kommunikasjon | `#0FA3B1` | `oklch(0.63 0.14 195)` | `oklch(0.72 0.13 195)` |
| Eiendom | `#8C2F39` | `oklch(0.63 0.14 15)` | `oklch(0.72 0.13 15)` |

Verdensfargen er en **identifikator, ikke en flate.** Den får opptre som: en
4 px kantstripe, en ikonfarge, en liten prikk foran verdensnavnet. Den skal
aldri fylle et kort — ni mettede kortflater i et rutenett er dekorasjon, og
Operate-modus har ikke råd til det.

Unntaket er at verden-hue får farge grafen på en side som handler om nettopp den
verdenen. Da er fargen informasjon.

### Semantiske tilstander

`--opp` og `--ned` beholdes for endring. I tillegg trengs standardiserte
tilstander som mangler i dag: `hover`, `focus-visible`, `active`, `disabled`,
`selected`, `loading`, `error`. Ingen komponent skal shippes med halvparten.

## 3. Typografi

Én familie bærer grensesnittet. Space Grotesk er **kun** for figurer.

**Bannlyst:** display-font på etiketter, knapper, tabellceller, menyer og
brødtekst. En KPI på 44 px i Space Grotesk er et redaksjonelt grep; «ANSATTE PER
FORETAK» i samme font er støy.

**Ett unntak:** ordmerket. Det er et bilde, ikke tekst i grensesnittet, og har
sin egen regel i §Navnet.

Fast rem-skala, forhold 1.2, ingen `clamp()` i produktflatene:

| Token | rem | px | Bruk |
|---|---|---|---|
| `--text-micro` | 0.6875 | 11 | Kildelinje, årstempel |
| `--text-label` | 0.75 | 12 | KPI-etiketter, versaler, tracking +0.06em |
| `--text-sm` | 0.8125 | 13 | Tabellceller, sekundærtekst |
| `--text-body` | 0.875 | 14 | Brødtekst i paneler |
| `--text-lg` | 1 | 16 | Innsiktstekst, ingress i panel |
| `--figure-sm` | 1.25 | 20 | Tier 3-tall |
| `--figure` | 1.5 | 24 | Tabellens hovedtall |
| `--figure-lg` | 2 | 32 | Tier 2-tall |
| `--figure-hero` | 2.75 | 44 | Tier 1-tall |
| `--title` | 3.5 | 56 | Sidetittel |

Alle tall bruker `font-variant-numeric: tabular-nums`. En kolonne med tall som
hopper i bredden er uleselig, og det er hele produktet vårt.

## 4. Hierarki etter beslutningsverdi

Kategorisidene har åtte KPI-kort i identisk format. Det er den dyreste feilen i
Operate-modus: siden sier ikke hva som betyr noe. Åtte like kort er åtte
likestilte påstander, og for spørsmålet «er dette verdt å drive?» er de ikke
likestilte.

**Tier 1 — Svaret.** To tall, `--figure-hero`, øverst, med luft rundt.

- Driftsmargin
- Vekst siste år

Dette er de to som svarer på spørsmålet. Bærer `eierlonn_i_resultat`-merkingen
inline når flagget er sant — ikke som et ikon man må holde over, men som en
setning under tallet: «Eierens arbeid ligger i driftsresultatet.»

**Tier 2 — Skalaen.** Tre kort, `--figure-lg`, ett nivå ned.

- Antall virksomheter, med foretakstallet som underlinje
- Omsetning per foretak
- Ansatte per foretak

**Tier 3 — Underlaget.** Tett tallrad, `--figure-sm`, som en definisjonsliste
og ikke som kort.

- Sysselsatte
- Lønnsandel
- Vekst, årlig snitt (CAGR — se §6)
- Investering per foretak

Rekkefølgen er fast på alle kategorisider. Konsistens fra skjerm til skjerm er
en dyd i Operate; den som har sett én kategoriside skal kunne lese den neste
uten å orientere seg på nytt.

## 5. Kildemerking som designet lag

Produktets hele forskjell er ærlighet om kildene. I dag er det små grå badger.
Det er for lite for noe som er selve differensieringen.

Hvert tallområde får en **kildelinje** med fast grammatikk:

```
KILDE · ÅRSTALL · ENHET
SSB strukturstatistikk · 2024 · foretak, hele landet
```

Fire tilstander, med reell visuell forskjell — ikke fire nyanser av grått:

| Tilstand | Behandling |
|---|---|
| `ssb` / `brreg` — målt | Nøytral kildelinje, ingen ramme. Standardtilfellet skal ikke rope. |
| `beregnet` — utledet | Kildelinje med «beregnet av Bransjesjekk» og hvilke felt som ligger til grunn. |
| `ai_anslag` — vurdering | Tydelig annen form: egen ramme, «AI-vurdering», alvorlighet synlig, og `Grunnlag` utvidbart til de faktiske radene. Aldri samme form som et målt tall. |
| `mock` — demodata | Skal ikke stå ved siden av ekte tall uten merking. I dag gjelder det bare lønnsserien. |

**Forbeholdene er innhold, ikke fotnoter.** De to som finnes —
femansatte-gulvet hos Brreg og at Eiendomsutvikler deler selskapsliste med
Byggefirma — skal stå over listen de gjelder, i lesbar størrelse, i en form som
ikke ser ut som en feilmelding. Et forbehold som er designet bort er en
usannhet.

## 6. Sammenstillinger som lyver, og hvordan de rettes

Fire funn fra revisjonen er designproblemer og løses her.

**Ett selskap, flere merker — én rad.** 7-Eleven og Narvesen viste identiske
tall fordi de ER samme selskap (Reitan Convenience Norway AS). Cubus og
Dressmann likeså (Varner AS). Radmodellen antok ett merke = ett selskap.

Ny modell: **én rad per selskap**, med merkene som chips inne i raden.

```
REITAN CONVENIENCE NORWAY AS        738 mill. kr
Narvesen · 7-Eleven                     −31,0 %
Oslo · 300 ansatte · regnskapsår 2025
```

To rader med samme tall forsvinner, og raden blir sannere enn før.

**Franchisegiver er ikke butikkdrift.** Coop Extra viser 66,8 mrd fordi org_nr
peker på Coop Norge SA, samvirkets engrosregnskap, mens KIWI peker på et
kjedekontor. Rader som ikke er sammenlignbare skal ikke stå i samme visuelle
kolonne. Merk selskapsrollen i raden — `franchisegiver`, `kjedekontor`,
`driftsselskap`, `engros` — og sorter aldri på tvers av roller uten at rollen er
synlig. Merknaden finnes i `brands.merknad`; den skal leses, ikke ligge i en
hover.

**CAGR har ikke ett årstall.** «STØRST VEKST (CAGR) · +22,5 % · 2024» er
misvisende. En flerårig vekstrate skal stemples med perioden: «2019–2024», aldri
med ett år. Samme for topplistenes vekstkolonne, der «+462,5 %» er treårs total
presentert ved siden av forsidens årlige CAGR.

**Luksusstripa lover mer enn tallene.** Min copy sier «marginene er poenget:
20–25 % mot 2–7 % i vanlig butikkhandel». Av ni aktører ligger to der; resten er
2,1–10,2 %. Skriv om til det tallene viser: at spennet er stort, og at de to
høyeste ligger på 20,6 % og 25,3 %. En påstand som ikke dekkes av kortene under
den er den samme feilen som feil næringskode, bare i copy.

## 7. Motion

150–250 ms. Tilstand, ikke koreografi.

Tillatt: tilstandsendring, fokusflytting, innlasting (skeleton, aldri spinner
midt i innhold), utvidelse av `Grunnlag` og forbehold.

Ikke tillatt: orkestrert innlasting av siden, tall som teller opp, grafer som
tegner seg selv ved scroll. Brukeren er i en beslutning, ikke i en presentasjon.
`prefers-reduced-motion` respekteres uten unntak.

## 8. Tomme og manglende tilstander

Et dataprodukt lever av at hull ser ut som hull og ikke som nuller.

- **Ingen tall:** «ikke publisert», med kildelinjen som forklarer hvorfor der vi
  vet det (`mangel_arsak`). Aldri 0, aldri tom streng, aldri en strek.
- **Tom seksjon:** fjernes fra DOM. «Ingen av de 0 anslagene har lav konfidens»
  er en tom seksjon som fikk stå.
- **Tomt panel som er forventet:** skal lære grensesnittet. En kategori uten
  selskapsliste skal si hvorfor — femansatte-gulvet — ikke bare være tom.
- **Falsy-fella:** `{tall && <X/>}` med tallet 0 rendrer «0». Bruk alltid
  eksplisitt sammenligning. Det står et løst «0» på næringssidene i dag av
  nettopp denne grunnen.

## 9. Ingen hardkodede tall i copy

Forsiden sa «1 058 næringskoder til **30** bransjer» da det var 40. Begge tall
var hardkodet i en JSX-streng.

Alle tall i copy hentes fra basen med `count: 'exact'`. Dette er ikke en
kodestandard, det er en designregel: et produkt som selger presisjon kan ikke ha
feil tall i sin egen ingress.

Regelen gjelder også `<head>`. Sidetittelen og `og:description` i `__root.tsx`
sier fortsatt «Tretti bransjer» — det er den samme hardkodingen som ble rettet i
heroen, ett lag lenger ut, og det er den versjonen som havner i Google og på
Facebook.

## 10. Forsiden er en dør, ikke et filter

Forsiden åpner i dag nær et filteroppsett med våre egne ord i, og det er den
dyreste feilen i hele produktet: den krever at leseren kan vokabularet vårt før
hun får se noe. «NACE-nivå», «foretak», «unit_type» og «coverage» er riktige ord
som hører i motoren, ikke i inngangen.

**Over folden, i denne rekkefølgen:**

1. Én linje som sier hva du får. Ikke hva vi har.
2. **Ett søkefelt: «Hva vil du sjekke?»** Fokus ved innlasting på desktop,
   ikke på mobil (der tar tastaturet folden).
3. Rett under: **ekte tall på ekte kategorier.** Fire til seks kort med
   driftsmargin, vekst og et navngitt selskap i hver. Ikke en kategorimeny med
   tomme kort — et tall over folden er hele forskjellen mellom et verktøy og en
   landingsside.

Søkefeltet slår mot **alle 40 kategoriene lokalt**, ikke mot basen per tastetrykk.
Førti rader er ingenting; hent dem én gang og filtrer i minnet. To krav:

- **Søkeordene ligger i basen.** `categories.sokeord` (migrasjon 0030) bærer det
  folk faktisk skriver: «kafe» og «pizzeria» skal treffe Restaurant & kafé,
  «gym» skal treffe Treningssenter, «vvs» skal treffe Rørlegger, «kebab» skal
  treffe Gatekjøkken. Uten dette laget må leseren gjette kategorinavnet vårt, og
  da er søkefeltet bare et filter med ett felt.
- **Matchingen folder diakritiske tegn i BEGGE retninger.** Den som skriver
  «frisor» skal treffe Frisør, og den som skriver «kafé» skal treffe et
  søkeord lagret som «kafe». NFD, strip kombinerende tegn, og i tillegg
  ø→o, æ→ae, å→a. Et søk som feiler på ø er ubrukelig i Norge.

**Filterraden flyttes ut av forsiden** til `/avansert`, som allerede finnes.
Navigasjonen slutter å navngi datamodellen: ordmerket er hjemlenken, så
«Indeksen» er redundant og forsvinner. Igjen står destinasjoner en leser kjenner
igjen — topplister, kart, avansert.

## 11. Kategorisiden er produktet

Førti kategorisider er førti innganger fra søk, og de bærer trafikken de første
årene. Domenevalget vant ikke den trafikken; det gjør H1-en.

**H1 er spørsmålet, ikke substantivet.** «Frisør» er en etikett. «Hva tjener en
frisørsalong i Norge?» er det folk skriver inn, og svaret skal stå i første
avsnitt og i Tier 1 — over folden, uten klikk. Kategorinavnet blir en overlinje
over H1, slik at brødsmulen fortsatt fungerer.

**Hver rute har sin egen `head()`.** I dag har bare `__root.tsx` metadata, så
alle 40 kategorisider, 15 fylkessider og topplistene deler én tittel og én
beskrivelse. For et produkt som lever av langhalen er det den enkeltfeilen som
koster mest:

```
<title>Hva tjener en frisørsalong? Driftsmargin, omsetning og vekst | Bransjesjekk</title>
<meta name="description" content="Frisør i Norge: 9,3 % driftsmargin, 1,4 ansatte per bedrift, 2 431 virksomheter. Tall fra SSB 2024 og Regnskapsregisteret.">
<link rel="canonical" href="https://bransjesjekk.no/kategori/frisor">
```

Tittel og beskrivelse bygges fra radene siden faktisk viste — samme regel som §9.
Er tallet ikke publisert, står det ikke i beskrivelsen.

`lang` settes til `nb`, ikke `no`. Kanonisk vert er `bransjesjekk.no`.

**404- og feilsidene er på engelsk.** «Page not found», «Something went wrong on
our end», «Go home» — på et norsk produkt med norsk domene. De skal oversettes,
og 404 skal gjøre en jobb: tilby søkefeltet fra §10 istedenfor bare en
hjemlenke.

Strukturerte data er aktuelt her, men bare det vi faktisk kan stå for:
`Dataset` med `license` og `creditText` for SSB (CC BY 4.0) og Brreg (NLOD).
Det er ærlig, og det dekker samtidig attribusjonsplikten. Ikke `Review`, ikke
`AggregateRating` — vi vurderer ikke bedrifter.

## 12. Navnebyttet, konkret

Tre navn er i omløp: repoet heter `Norbiz`, produktet het `Bransjeindeks`, og
Lovable-prosjektet viser fortsatt «Norsk Forretningskompass». Ett navn gjelder:
**Bransjesjekk**.

| Flate | Fra | Til |
|---|---|---|
| Ordmerke i toppnav | `Bransjeindeks` | `Bransje` 500 + `sjekk` 700 |
| `<title>` og OG/Twitter | «Bransjeindeks — hva lønner seg…», «Tretti bransjer» | Bransjesjekk, tall fra basen |
| `twitter:site` | `@Bransjeindeks` | fjernes til kontoen finnes |
| Kildelinje `beregnet` | «beregnet av Bransjeindeks» | «beregnet av Bransjesjekk» |
| Favicon | Lovable-standard | scorestripa, fem segmenter |
| Kanonisk vert | `*.lovable.app` | `bransjesjekk.no` |
| Lovable-prosjektnavn | Norsk Forretningskompass | Bransjesjekk |

Repoet får hete `Norbiz` videre — en git-remote er ikke en merkevareflate, og
å bytte den koster mer enn den gir. `CLAUDE.md` sier hvorfor.
