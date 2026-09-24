# Designsystem — Maktkart

**Retning: kartografisk.** Kommunen er et kartblad. Siden låner grammatikken fra
topografiske kart, sjøkart og offentlige registre: tegnforklaring, kartramme,
målestokk, administrative grenselinjer og en orienteringsløype. Navnet er
Maktkart, og siden er et kart.

Valget ble tatt 2026-09-24 blant tre fullt bygde retninger. Prototypene ligger i
`docs/design/retninger/`, og dommernes vurderinger ligger i `docs/design/dommere/`.

| Retning | Informasjon og ærlighet | Håndverk | Kommersiell | Snitt |
|---|---|---|---|---|
| A redaksjonell | **7,95** | 7,85 | 6,45 | 7,42 |
| B polarnatt | 7,05 | 6,85 | 7,15 | 7,02 |
| **C kartografisk** | 7,30 | **8,05** | **7,45** | **7,60** |

C vant fordi den er den eneste retningen som kjennes igjen som et maktkart. Hver
kommune kan få sitt eget kartblad fra åpne høydedata. Det gir én unik forside
og ett delingsbilde per kommune, uten designarbeid per kommune. A var klarest og mest
ærlig, men kunne vært hvilken som helst nyhetsforklaring. B så mest ut som et
produkt man betaler for, men var et vanlig mørkt dashbord.

Dette dokumentet er C, med de beste grepene fra A og B podet inn og dommernes
blokkerende funn rettet. Der dokumentet og prototypen C sier forskjellige ting,
gjelder dokumentet.

Modus: kommunesiden og forsiden er **Overtale**, med data som bevis.
Organprofilen og metodesiden er **Operere**: skanbarhet slår uttrykk.

---

## 1. Farge

Kjølig kartpapir, aldri krem. Svartplaten er blåsvart. Hver farge har én jobb.

| Token | Lys («kartpapir») | Mørk («nattkart») | Jobb |
|---|---|---|---|
| `--papir` | `#EFF3F2` | `#0D161C` | Bakgrunn |
| `--flate` | `#F8FAF9` | `#13212A` | Skuff, kort, popover |
| `--flate-2` | `#E5EBEA` | `#172833` | Nivåbånd, dempet flate |
| `--trykk` | `#15202A` | `#E2EAEC` | Tekst, kartramme, merket «oppgitt» |
| `--dempet` | `#4E5C66` | `#94A4AD` | Sekundærtekst |
| `--linje` | `#C3CDCF` | `#2A3B45` | Grenselinjer |
| `--linje-sterk` | `#8C9AA1` | `#50626C` | Kartramme, akser |
| `--kote` | `#A36F3E` | `#9A7350` | Koter og merket «må verifiseres» |
| `--kote-tekst` | `#7F5327` | `#C79E74` | Tekst om det som må verifiseres |
| `--vann` | `#2B6A99` | `#6BAAD6` | Hav, penger, eierskap og merket «verifisert» |
| `--vann-lys` | `#D2E3EC` | `#16303F` | Havflate, stolpebakgrunn |
| `--signal` | `#D5421A` | `#FF6A3D` | Løypa, forberedende makt, fokus. Aldri flater. |
| `--signal-tekst` | `#B23512` | `#FF7E57` | Tekst i signalfarge |

Tre regler gjelder:

- **Signal betyr beslutningskjede.** Løypa, forberedende makt (`innstilling`) og
  fokusringen bruker signalfargen. Den brukes aldri som dekor.
- **Vann betyr penger.** Eierandeler, utbytte og nøkkeltall bruker vann. Bruk
  den ikke på organer, fordi leseren da tror et organ er et beløp.
- **Kote betyr uetterprøvd.** Terrengbrunt er fargen på det som må verifiseres,
  og på kotene. Terrenget er bakgrunn, og det uetterprøvde skal lese som
  bakgrunn til det er etterprøvd.

Tokenene skal defineres på bare `:root`. Mørke verdier legges under
`@media (prefers-color-scheme: dark)` bak `:root:not([data-theme="light"])`, og
igjen under `:root[data-theme="dark"]`. `color-scheme` følger temaet. I Tailwind
mappes tokenene til `@theme inline`, så komponenter aldri skriver hex.

## 2. Typografi

**Én familie: Archivo med variabel bredde (62–125 %), selvhostet via
`@fontsource-variable/archivo`.** Siden gjør ingen forespørsler til Google eller
andre tredjeparter. Det følger av personvernprofilen, ikke av smak.

Archivo brukes som et kartografisk skriftsystem, der bredden bærer rollen:

| Rolle | Bredde | Vekt | Bruk |
|---|---|---|---|
| Tittel | 114 % | 780 | H1, spørsmålet |
| Seksjon | 105 % | 700 | H2 |
| Brødtekst | 100 % | 400 | Ingress, brødtekst |
| Etikett | 84–90 % | 500–600 | Graf, tette lister, kartblad-marg |
| Region | 100 %, versal, sperret 0,16em | 600 | STAT · FYLKE · KOMMUNE · SELSKAPER |
| Flyt | kursiv | 500 | Beløp som renner: utbytte. Vannnavn settes i kursiv på kart. |

Tabellsifre (`tabular-nums`) brukes overalt. Brødtekst holdes til 65 tegns linjelengde.
Ingressen har linjeavstand 1,5 og brødteksten 1,55. Dette er typografisk disiplin
fra A. Overskrifter får `text-wrap: balance`.

**Lange kommunenavn må tåle tittelen.** Testsettet er «Tromsø», «Gáivuotna-Kåfjord»,
«Nordre Follo» og «Sør-Aurdal». H1 bruker `clamp()` og `hyphens: manual`. Navn
med bindestrek brytes der bindestreken står. Kartrammen må aldri gå inn i
tittelen.

## 3. Kildemerket — signaturen

Hver påstand har et merke. Et trykk eller hover viser kildelappen: påstanden,
graden med forklaring, kilden med type, per-dato og merknad. På skrivebord er
lappen en Popover. På mobil er den en Drawer nedenfra.

| Grad | Form | Farge |
|---|---|---|
| `verifisert` | Fylt sirkel | `--vann` |
| `oppgitt` | Ring med senterpunkt, som et fastmerke | `--trykk` |
| `maa_verifiseres` | Åpen trekant, 1,5 px strek | `--kote` |

**Trekanten erstatter Cs stiplede ring.** Alle tre dommerne fant den stiplede
ringen for svak ved 12 px, og den er den vanligste graden. Trekanten fra A var
den eneste formen som holdt i gråtoner. Kravet er minst 3:1 kontrast mot
flaten i begge temaer. Kontrollen `scripts/kontrast` sjekker det.

Merket bindes til siste ord i påstanden med `white-space: nowrap` på ordet og
merket sammen. Et merke som står alene på en ny linje, mister påstanden sin.

**Stiplet strek betyr fortsatt «bygger på noe uetterprøvd»** når det gjelder
linjer: en kant i nettverket eller en eierlinje der minst én rolle eller andel
må verifiseres. Stiplet strek er aldri et merke.

**Tegnforklaringen er et filter.** Et trykk på en grad demper alle andre merker
på siden og viser «Viser må verifiseres: 143 merker. Vis alle». Tellingene
regnes fra datasettet, aldri fra komponenten.

**«Slik leser du merkene» står i første skjermbilde** med tellinger per grad.
Grepet er fra A. Leseren skal lære merket før første tall. Førsteinntrykket er et
skjermbilde eller en delt lenke, og da må forklaringen være med.

### Mangler er ikke det samme som uetterprøvd

- **Ikke kartlagt.** Datasettet navngir ingen leder. Vises som en stiplet
  brikke: «Leder ikke kartlagt». Ordlyden er fra B.
- **Må verifiseres.** Et navn eller tall finnes, men er ikke etterprøvd. Vises
  med trekantmerket.
- **Kildene er uenige.** Vises som et eget merke på organkortet (fra A). For
  styringsmodellen i Troms fylkeskommune vises begge kildene.

Teksten «[verifiser]» fra researchgrunnlaget skal aldri nå leseren. Skriv hva som
mangler og hvor det skal hentes: «Utvalgsleder ikke kartlagt. Hentes fra
innsyn.tromso.kommune.no.»

## 4. Forhåndsversjonen

Så lenge ingenting er `verifisert`, står dette synlig på hver side:

- **Skrivebord:** i topplinjen, som en hel setning med en stiplet trekant:
  «Forhåndsversjon. Tallene er fra researchgrunnlaget sammenstilt 24.09.2026 og
  ikke etterprøvd mot Brreg.»
- **Mobil:** i en fast bunnlinje, med knapp til tegnforklaringen og lenke til
  Pro-ventelisten. Bunnlinjen legger `env(safe-area-inset-bottom)` til
  polstringen sin.

Følgende ord brukes ikke: «LIVE», «sanntid», «oppdatert daglig», «i dag».
Nå-linjen heter «Sammenstilt 24.09.2026».

## 5. Kommunesiden, seksjon for seksjon

Rekkefølgen og kravene står i spec §3. Her står formen.

### 5.1 Topp: kartbladet

- **Venstre:** tittel, ingress, søk og «Slik leser du merkene».
- **Høyre:** kartramme med gradert kant, nordpil og kotene til kommunen.
- **Kartbladets marg:** nøkkeltallene står i en randkolonne langs kartet, som
  randopplysningene på et kartblad. De står ikke på terrenget. Siktekorsene fra
  prototypen er fjernet, fordi de leste som stedfesting. Tallene er
  datamoduler fra B, regnet fra datasettet:
  - halvsirkel med seter (`antall_medlemmer` i kommunestyret)
  - «N aksjeselskaper med oppgitt kommunal eierandel»
  - utbyttedeling som delstolpe: «70 av 175 mill. kr, foreslått». Ordet
    «foreslått» står i hovedetiketten, ikke bare i metalinjen.
  - «N rollebytter siden 1.1.2024», som små merker på en akse som slutter ved
    «Sammenstilt»
- **Under kartet:** kommunenummer, org.nr. og fylke. Registerkoordinatene står
  der et kart ville hatt lengde og bredde.
- **Siste endringer:** en stripe med de siste 4–5 hendelsene.

Kotene trykkes ved lasting: kystlinjen først, så nivå for nivå opp, på ≤ 1,1 s.

**Terrenget er et byggesteg.** `scripts/terreng.ts` henter åpne høydedata for
kommunens utsnitt og skriver ferdige konturstier til
`src/data/terreng/<kommunenr>.json`. Komponenten tegner SVG på serveren og
trenger ikke JavaScript for å vise kartet. **Reservevarianten** er en kartramme
med rutenett og kommunenavn, uten falskt terreng. Den brukes når en kommune
ikke har terrengfil.

### 5.2 Beslutningskjeden: orienteringsløypa

- **Skrivebord:** løypa tegnes over et dempet terreng til venstre, og teksten
  går stegvis til høyre.
  - Løypesymbolene er startrekant, poster i ring og dobbel ring ved vedtaket.
  - Klage er en stiplet etappe, fordi den bare skjer hvis noen klager.
  - Etappene tegnes i signalfarge mens leseren ruller.
- **Forberedende makt markeres** som en sone i signaltint rundt stegene med
  `myndighet = innstilling`, med etiketten «Forberedende makt». Grepet er fra A.
- **Setningen fra B** regnes fra datasettet: «2 av 4 steg har ingen navngitt
  leder i datasettet, og det er stegene der saken skrives. Det er dette laget
  Maktkart skal fylle.» Bare tallene i setningen varierer.
- **Mobil:** et loddrett spor med klebrig framdrift, «Steg 2 av 4:
  Kommune- og byutviklingsutvalget · innstilling» (fra B).
- Prosessvelgeren er en ToggleGroup. Et steg uten data vises som posten
  «Ikke kartlagt».
- Undertekst på kartet: «Løypa følger saken. Terrenget er pynt, ikke plassering.»
- **Starttrekanten i løypa er ikke kildemerket.** Den er stor, står i signalfarge
  og finnes bare på løypekartet. Kildemerkets trekant er liten, står i kote og
  står alltid inline etter en påstand. Tegnforklaringen viser begge.

### 5.3 Organkartet: nivåbånd

- Fire bånd: STAT, FYLKE, KOMMUNE og SELSKAPER. Mellom dem går en administrativ
  grenselinje med strek-prikk.
- Kommunebåndet har to kolonner: folkevalgte organer og administrasjon.
- Et organkort viser navn, myndighet som små etiketter, leder med kildemerke
  eller «Leder ikke kartlagt», og sensitiv-markering der det gjelder.
- Kortet åpner organskuffen (Sheet på skrivebord, Drawer på mobil). Skuffen viser
  myndighet, roller nå og før, eierskap begge veier, nøkkeltall med år og
  morselskap eller konsern, hendelser og kilder.
- **Mobil:** båndene kan foldes sammen. Hvert bånd viser antall og de tre
  viktigste organene til leseren åpner det.

Nivåsymbolene fra prototypen (▲◆■□) utgår. Trekanten er nå «må verifiseres»,
og fire symbolsystemer gjorde siden til et GIS-verktøy. Nivåene bæres av båndene
og den sperrede versalen.

### 5.4 Pengene

- **Eierandeler** vises som stolper. Hver rad har selskap, andel, siste
  nøkkeltall med år og morselskap eller konsern, og **et eget kildemerke per
  tall**.
- **Kommunale foretak (KF) er ikke eierandeler.** Et KF er en del av kommunen.
  KF-ene står i en egen gruppe, «Kommunale foretak, del av kommunen».
- **Utbyttet vises som elv:** Troms Kraft deler seg i Troms Holding og kommunen,
  og bredden er proporsjonal med beløpet. Strømmen tegnes én gang når den kommer
  i bildet og ligger så stille. Uendelig bevegelse ved lesestoff er uro.
- Kommunens eget regnskap står hver for seg. Merforbruket (205,1 mill. kr i 2024)
  og NRKs underskuddstall (271 mill. kr i 2024) er to ulike mål og sammenlignes
  ikke.

### 5.5 Nettverket

- Grafen er en institusjonsgraf. Noden er organet og personen er kanten. Kanten
  har et **navneskilt med kildemerke** (fra A og B), og under grafen står
  «N av M koblinger bygger på minst én rolle som må verifiseres».
- **Utvalgsregelen står under grafen:** «Ordføreren leder både kommunestyret og
  formannskapet. Det følger av styringsmodellen og vises ikke som kobling.
  Tidligere roller teller ikke.»
- **Eierskap er et eget lag** som slås på og av med bryteren «Vis eierskap», og
  det er av som standard.
- **Oppsettet regnes, det plasseres ikke for hånd.** Koordinatene kommer fra en
  deterministisk layoutfunksjon som får samme resultat for samme data. Nodene får
  startposisjon fra en hash av `key`, og simuleringen kjører et fast antall
  iterasjoner. Ingen kant krysser en etikett. En testfunksjon sjekker
  etikettkollisjoner.
- **Mobil:** et buediagram fra A. Organene står på en linje og personene er buer,
  med listen som standardvisning.

### 5.6 Endringene

- En loddrett tidslinje med nå-linjen «Sammenstilt 24.09.2026».
- Kommende hendelser står over linjen med åpen strek og merket «Har ikke skjedd».
  Dette er B-grepet, og det er det tydeligste skillet mellom planlagt og skjedd.
- Udaterte hendelser har egen gruppe, «Uten dato».
- På skrivebord er hendelsene rader, ikke smale kolonner.
- Årstallene er klebrige og stables aldri oppå hverandre.

### 5.7 Din bransje

- En matrise der radene er organer og kolonnene er myndighet, filtrert på
  segment med ToggleGroup. På mobil blir den en liste.
- **Bare koblinger fra `org_segment`** (grunnlaget §3.3) vises. Designerens egne
  koblinger i prototypen utgår.

### 5.8 Neste kommune

- **Kartbladoversikt** over valgkretsen. Tromsø er fylt, og de andre er åpne
  ruter med navn.
- **«Slik ser en tom kommune ut»** viser hvordan malen oppfører seg når data
  mangler.
- **Stemmeskjemaet er ærlig.**
  - Uten Supabase-klient sier kvitteringen: «Forhåndsversjonen lagrer ikke
    stemmen ennå.»
  - Med klient skrives stemmen til `venteliste`.
  - Stemmetall vises aldri.

### 5.9 Metode og Pro

- **Tegnforklaringen i full form**, med tellinger per kildetype.
- **Verifiseringen i tre steg:** hent, sammenlign, avvik til kontroll (fra B).
- **Hullene:** «Hull i datasettet (N)» kan foldes ut.
- **Kildeliste** med lenker.
- **Pro vises som venteliste med en pristabell** merket «Prishypoteser vi tester,
  ikke vedtatt prising» (fra B). Tabellen har Pro 490 kr/mnd, Team 2 900 kr/mnd og
  Enterprise fra 60 000 kr/år. Kvitteringen er ærlig på samme måte som
  stemmeskjemaet.
- **«Venteliste for Pro»** står i toppmenyen på skrivebord og i bunnlinjen på
  mobil.

## 6. Layout

- 12 kolonner og maks bredde 1 360 px. Sidemarg er `clamp(16px, 3vw, 40px)`.
- **Rette hjørner overalt, radius 0.** shadcn-komponenter får `--radius: 0`.
  Rette hjørner er kartet: det er ark, ikke kort.
- **Tegnforklaringen i margen** (skrivebord, fra ≥ 1 200 px) er klebrig og
  **høydebevisst**.
  - Innholdsfortegnelsen er et eget felt over tegnforklaringen.
  - Ved lav høyde (≤ 900 px) foldes tegnforklaringen til gradene og filteret.
  - Alle ni seksjoner og aktiv markering skal synes ved 1 440 × 900.
- **Aktiv seksjon i menyen** følger rullingen, også tilbake til toppen.
- Ingen horisontal rulling ved 390, 768, 1 024 eller 1 440 px. Testsettet i
  `scripts/skjermbilder.mjs` sjekker det.

## 7. Bevegelse

Hver bevegelse har en jobb, og alt er lesbart i ro. Ingenting starter på
`opacity: 0` og venter på en observer.

| Bevegelse | Jobb | Varighet |
|---|---|---|
| Kotene trykkes | Kartet blir til, kommunen tar form | ≤ 1,1 s, én gang |
| Løypa tegnes | Saken går videre | Per etappe 400 ms, `--ease-ut` |
| Grafen legger seg | Koblingene finner plass | 600 ms, én gang |
| Elva tegnes | Pengene går én vei | 800 ms, én gang |
| Tall settes | Tallet er klart | 300 ms, fra synlig tilstand |
| Skuff | Detalj uten å forlate siden | 320 ms, `--ease-skuff` |

```css
--ease-ut:    cubic-bezier(0.23, 1, 0.32, 1);
--ease-skuff: cubic-bezier(0.32, 0.72, 0, 1);
```

Med `prefers-reduced-motion: reduce` er alt statisk. Tilstandsendringer skjer
fortsatt, men uten forflytning.

## 8. Komponenter

Komponentene bygges på shadcn/ui med radius 0 og kartografisk stil.

| Komponent | shadcn | Merknad |
|---|---|---|
| `Kildemerke` | Popover / Drawer | Én komponent, tre grader. Leser filteret fra kontekst. |
| `Tegnforklaring` | ToggleGroup | Filterkontekst: `KildefilterProvider` |
| `Kartblad` | – | SVG, terrengfil eller reservevariant |
| `Randmodul` | – | Halvsirkel, delstolpe, aksemerker |
| `Loype` | ToggleGroup | Prosessvelger |
| `Nivabaand` / `Organkort` | Collapsible | – |
| `Organskuff` | Sheet / Drawer | – |
| `Eierstolper` / `Utbytteelv` | – | SVG |
| `Nettverk` / `Buediagram` | Switch («Vis eierskap») | Layout fra `lib/graf/layout.ts` |
| `Tidslinje` | – | – |
| `Bransjematrise` | ToggleGroup | – |
| `Kartbladoversikt` | – | – |
| `Venteliste` | Input, Button | Ærlig kvittering |
| `Forhandsversjon` | – | Topplinje og bunnlinje |

## 9. Tekst

- **Skriv fra leserens side.** «Hvem bestemmer en reguleringsplan?», ikke
  «Prosessvisning».
- **Ingen tankestrek-innskudd** og ingen «ikke X, men Y». Skriv korte setninger.
- **Tall skrives på norsk:** «2 426 mill. kr», «70 mill. kr», «14. mai 2025».
- **Aldri «Maktkart har sjekket».** Vi har sammenstilt, ikke revidert.
- **Personer omtales med tittel og navn,** aldri med bilde, fødselsår eller
  adresse.

## 10. Åpent

- **Terrenglisens.** Terrengdataene kommer i dag fra Mapzen Terrain Tiles på AWS
  Open Data. Attribusjonskravene per kildedatasett må leses før lansering. Den
  riktige primærkilden er Kartverkets åpne høydemodell (DTM). Når pipelinen er på
  plass, skal terrenget hentes derfra.
- **Utsnitt per kommune.** Tromsø har et håndsatt utsnitt. Skaleringen trenger
  kommunegrensene fra Kartverket for å regne utsnittet selv.
- **Orienteringsløypa bør testes på ekte brukere.** Den kan leses som friluftsliv
  av noen som ikke kjenner metaforen.
