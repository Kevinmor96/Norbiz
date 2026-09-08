# Bransjesjekk — faste regler

Svarer på ett spørsmål, stilt slik folk faktisk stiller det: **hva tjener de
som driver med dette — og kan jeg gjøre det alene?** Målgruppe i prioritert
rekkefølge: den som vurderer å starte for seg selv, og den nysgjerrige — det er
de som starter trafikken de første årene; deretter investorer og oppkjøpere;
rådgivere og banker sist. Produktet heter **Bransjesjekk** og bor på
`bransjesjekk.no`; det het Bransjeindeks fram til 2026-08-05.

## Posisjonering

Problemet er ikke mangel på data. Tallene finnes allerede hos Proff, Purehelp,
Brønnøysund og SSB — fire kilder som alle svarer på «hvordan går det med dette
selskapet?» Dette produktet svarer på noe annet: **«hva tjener de som driver med
dette, og kan jeg gjøre det alene?»**

Rammen ble snudd 2026-09-08. Den gamle — «er denne typen virksomhet verdt å
drive, her?» — er presis og møter folk feil sted: den forutsetter at leseren
allerede har en forretningsidé og allerede vet hva bransjen heter. Samme data,
snudd mot leseren. All ny copy stiller det nye spørsmålet.

Vi er sammenstillingslaget, ikke en femte kilde. Tre ting skiller produktet, og
de skal merkes i hele UI-et, ikke bare på forsiden:

1. **Bransje, ikke bedrift** — svaret er per næring og region.
2. **Sammenstilt, ikke rådata** — flere kilder i samme tabell, med score.
3. **Vi sier hva vi ikke vet** — hvert tall bærer sin opprinnelse.

Det tredje er det viktigste. Det er lett å kopiere en datakilde og vanskelig å
kopiere disiplinen i å innrømme usikkerhet, så aldri skjul et hull eller pynt
på et anslag for at siden skal se mer komplett ut.

## Datakilde

All data leses fra Supabase via TanStack Query. Aldri hardkodede tall, aldri
live API-kall til SSB eller Brreg fra frontend.

Statistikken er ekte: `industry_stats` er SSBs strukturstatistikk 2017–2024,
`industry_demography` er foretaksdemografi 2017–2025, `companies` og `brands`
kommer fra Enhetsregisteret og Regnskapsregisteret. `industry_wages` og
`region_population` er fortsatt seed-data, og `industry_estimates`/`ai_insights`
er anslag.

## Kategorilaget er inngangen, ikke NACE-kodene

Brukeren møter aldri en næringskode. Forsiden er bygget på 40 kuraterte
kategorier i ni verdener — «Restaurant & kafé», «Dagligvare», «Frisør» — og
NACE-kodene ligger bak som implementasjonsdetalj. Filtermenyen over kodeverket
er flyttet til `/avansert`, som er en fremtidig premium-flate.

Fire funksjoner gjør regningen i basen. Frontend aggregerer ikke:

| Funksjon | Gir |
|---|---|
| `kategori_oversikt()` | ett kort per kategori: nøkkeltall, farge, ikon, `serie` for sparkline |
| `topp_selskaper(slug, fylke, metrikk, antall)` | rangerte selskaper, valgfritt per fylke. Bærer `kommune_navn`, `merke` og `segment` |
| `kategori_rangering(metrikk, retning, antall)` | «høyest/lavest margin i Norge», «størst vekst» |
| `brand_liste(kategori, segment)` | de kuraterte kjedene med tall; begge argumenter kan være null |

To ting funksjonene sier om tallene, som UI-et må videreformidle:

- **`eierlonn_i_resultat`** er sann der snittbedriften har under 450 000 kr
  lønnskostnad per sysselsatt. Da tar eieren ikke ut lønn, og arbeidsvederlaget
  ligger i driftsresultatet. Fysioterapi viser 56 % margin og Tannlege 29 % av
  den grunnen — ikke fordi de er ti ganger mer lønnsomme enn Dagligvare på
  3,5 %. Marginen skal merkes der flagget er sant, ellers villeder en
  toppliste.
- **`ar`** er året kategoriens tall gjelder, og det er ikke alltid samme år for
  alle. Kategorier der en medlemskode mangler tallet får forrige komplette år,
  fordi en sum over ulike kodesett ikke er sammenlignbar. Årstallet skal
  derfor stå ved tallet, ikke i en global «tall for 2024»-overskrift.

Tre ting mer, alle om at et tall skal forklares framfor å skjules:

- **`kommune_navn`, ikke `kommune_code`.** Et firesifret kommunenummer på
  skjermen leses som et postnummer. Navnet kommer fra `kommuner` (SSBs
  klassifikasjon 131, 2024-årgangen, den Brreg registrerer adresser mot), så
  frontend skal ikke bære en egen navneliste — en delvis liste er nettopp
  grunnen til at feilen bare viste seg av og til.
- **`merke` og `segment`.** `merke` er kjedenavnet der selskapet er en kjent
  kjede: «REITAN CONVENIENCE NORWAY AS» sier ingenting, «Narvesen» sier alt.
  Vis merket ved siden av det formelle navnet, ikke i stedet for — det formelle
  navnet er det som står i regnskapet. `segment='luksus'` forklarer hvorfor
  Louis Vuitton Norge AS står i skobutikk-listen: Brreg har selskapet på 47.720,
  og det er kildens registrering. Filtreres raden bort, redigerer vi
  Enhetsregisteret; merkes den, er den en opplysning.
- **Selskapslistene når bare bedrifter med minst fem ansatte.** Brregs
  `fraAntallAnsatte` svarer HTTP 400 under 5. I frisør, fysioterapi, hudpleie og
  gatekjøkken — der snittbedriften har 1–2 ansatte — viser listen derfor de
  *største* i bransjen, ikke et utvalg av den. Bransjetallene over listen dekker
  hele bransjen; det er bare listen som er toppen, og forskjellen må stå der.

Luksusstripa er merking av aktører, ikke en bransje. SSB har ingen luksuskode,
så det finnes ingen omsetningsvekst, ingen etableringstall og ingen marginserie
for «luksus» — bare de ni selskapenes egne tall. Et kort som ser ut som de andre
kategorikortene ville lovet statistikk som ikke finnes.

Kjedelistens tall er **hovedselskapets regnskap**, aldri hele kjedens. Flere
kjedekontorer er registrert som franchisegivere (NACE 77.400), så REMA 1000s
tall er franchisegiverens, ikke butikkenes. `merknad` sier hvilket selskap det
gjelder, og den skal være tilgjengelig for leseren.

## Tre nivåer av sannhet

Hver rad bærer `data_quality`:

| Verdi | Betydning | Visuell behandling |
|---|---|---|
| `ssb`, `brreg` | målt og publisert | nøytral kildeangivelse |
| `beregnet` | utledet fra målte tall | nøytral, med «beregnet» |
| `mock` | demodata | grå «Demo-data»-badge |
| `ai_anslag` | AI-vurdering | tydelig annen form, med konfidens |

Et anslag skal aldri kunne forveksles med et målt tall. Forskjellen må synes i
periferisynet, ikke bare i badge-teksten.

## NULL er aldri 0

Mangler et tall, vis «ikke publisert» — aldri 0, aldri en tom celle.

Kolonnen `merknader` er en jsonb som kartlegger felt til årsak. Er verdien
`konfidensielt`, skriv «skjult av hensyn til konfidensialitet» i stedet for
«ikke publisert». For en rådgiver er det ikke et hull — det betyr at næringen
har for få aktører i regionen til at tallet kan oppgis, og det er i seg selv
informasjon om markedet.

## To granulariteter samtidig

SSB publiserer nasjonale næringstall på NACE 2–5, men regionale kun på 2–3.

Velger brukeren en femsifret næring sammen med et fylke, finnes det ingen
regional rad. Vis nasjonale og regionale tall side om side, hver med sin egen
granularitet påført. Ikke skjul forskjellen, og ikke fyll den ut.

## Foretak og virksomhet er ikke det samme

`unit_type` skiller dem. En frisørkjede er ett foretak og ti virksomheter.
Regionale rader finnes kun for `virksomhet`. Bland dem aldri i samme sum.

## AS-avgrensningen

`coverage = 'as_only'` betyr at raden kun dekker aksjeselskaper, fordi ENK ikke
leverer årsregnskap. En slik rad skal aldri sammenlignes ufiltrert med en rad
merket `alle`. Si det i UI-et der tallet står.

## Fylkesårganger

Norge hadde 19 fylker til 2019, 11 fra 2020, 15 fra 2024. `regions` har
`valid_from_year` og `valid_to_year`. Kartet må laste GeoJSON som matcher
årgangen for valgt år. Vis hvilken årgang som er i bruk.

## Visuell retning

Referanse: proven-saas.com. Prinsipper og oppbygging, ikke kloning — egen
palett, norsk språk, og et provenienslag referansen ikke har.

**Skallet.** Mørk grunn nær sort med blåtone. Store lyse kort som ligger på den
mørke grunnen, radius rundt 22 px, romslig innvendig luft. Alterneringen er
signaturen: hver seksjon skal lese som sitt eget oppslag, ikke som en rad i et
uendelig dashbord.

**Typografi.** Geometrisk sans, tunge vekter og stram sporing i overskrifter.
`font-variant-numeric: tabular-nums` overalt hvor tall stables. Pille-knapper,
fullt avrundet. Avrundede hjørner og tynne kantlinjer — ingen slagskygger.

**Håndverk.** Animasjoner under 200 ms. Skeleton-states på alle kort og grafer.
Fullt responsivt: rangerte rader kollapser til to linjer på mobil, kort stables.

**Fire datamønstre som skal gjenbrukes:**

1. **Rangert rad** — plassnummer, navn med metalinje under, ett stort tall, og
   en delta-pille til høyre. Hovedgrepet i alle topplister.
2. **Score som femdelt fargestripe** — `score_total` vist som fem segmenter fra
   rødt til grønt. Diskret framfor kontinuerlig, fordi en stripe leses i
   periferisynet mens et tosifret tall må leses.
3. **Delta-pille** — pil og prosent, grønn opp og rød ned. Se regelen under.
4. **Sparkline med merket endepunkt** — fylt areal, siste punkt markert og
   verdien skrevet ut.

Dessuten: kategorichips med snittall, minibarer for delscorer, og en filterrad
med søk og nedtrekk over hver toppliste.

## Vekstpillen har en hard regel

Delta-pillen vises **bare** der det finnes en tidsserie:

| Enhet | Visning |
|---|---|
| Næring | delta-pille, reell endring 2017–2023 |
| Fylke | delta-pille, reell endring |
| Selskap | **årstempel, ingen delta** |
| Kommune | **årstempel, ingen delta** |

Brønnøysunds åpne API gir bare siste innsendte regnskapsår per selskap. Et
selskapskort eller en kommunerad skal derfor aldri ha en vekstpille. Ikke lån
næringens vekst og la den se ut som selskapets.

## Scoren bærer sin egen proveniens

Dette er den viktigste regelen på siden, og den er lett å glemme fordi alt
annet handler om cellene.

`score_total` er en **persentilrangering innenfor en peer-gruppe**, ikke et mål
på lønnsomhet. Der scoren vises:

- Skriv peer-gruppen ved tallet: «rangert mot N andre femsifrede næringer, 2023».
- Vis hvor mange av seks delscorer som hadde data. Fire av seks er en svakere
  påstand enn seks av seks, og det hører på tallet.
- Vis de to **svakeste** delscorene uten klikk. Det er «hvorfor ikke høyere»,
  og de fleste klikker ikke.
- Kopier-funksjon og delekort må ta med metodelinjen. Tallet forlater appen og
  havner i kundenotater — da må forbeholdet reise med.

Et umerket «#1» ved siden av omhyggelig merkede celler er verre enn ingen
merking, fordi cellene låner troverdighet til overskriften.

## To framinger, to flater

Forsiden og topplistene er **anskaffelsesflaten**: rangert, delbar, nysgjerrig.
Poengtavleformen hører her.

Næringssiden er **rådgiverflaten**. Den åpner med det som kan gå galt —
undertrykte celler, lavkonfidens-anslag, uenighet mellom delscorene — før
mulighetene. En rådgiver som skal si noe til en kunde trenger forbeholdene
først. Ikke gjør næringssiden til en poengtavle.

## Ingen «LIVE»-merkelapp

Referansen skriver «oppdatert hver time». SSB publiserer årlig med ett til to
års etterslep. Behold elementet på samme plass i layouten, men snu innholdet:
et årstempel i stedet for et ferskhetsløfte.

## Attribusjon er påkrevd

Lisensvilkår, ikke høflighet. SSB-data er CC BY 4.0, Brreg-data er NLOD. Begge
tillater kommersiell bruk og avledede produkter, men krever kildeangivelse — og
NLOD krever i tillegg at det står at data er bearbeidet, og at ingenting antyder
at Brreg står bak vår vurdering.

`<Footnotes />` bærer dette, generert fra radene siden faktisk viste.

## Vår egen undertrykking

Aggregater vi bygger nedenfra fra `companies` — for eksempel kommunetall — skal
ha samme minimumsterskel som SSB bruker. Under `score_config.min_enheter_aggregat`
vises `mangel_arsak = 'konfidensielt'`, ikke tallet.

Grunnen: snitt av tre selskaper i én næring i en liten kommune er lett å regne
baklengs til enkeltbedrifters resultat. Hvert regnskap er offentlig, så det er
lovlig — men det er ikke derfor det er greit.

## Delte komponenter

- `<DataBadge quality source year coverage konfidens />` — på hvert KPI-kort og
  hver graf.
- `<InsightCard />` — én rad fra `ai_insights`, ankret ved KPI-en i
  `knyttet_til`, sortert på `alvorlighet`. Klikk utvider `referanser`.
- `<Footnotes />` — nederst på hver side, generert fra radene siden faktisk
  viste. Ikke en håndskrevet tekst.

## Informasjonsbudsjett

Kravet er kort, oversiktlig og verdifullt — uten å bli overveldende. Det står i
spenning med at basen er rik, så det trengs en regel: **hver seksjon har et
tallbudsjett, og nye tall må fortrenge gamle.**

- KPI-rutenett: maks åtte tall.
- Rangert rad: ett hovedtall, ett støttetall, én pille. Ikke fire tallkolonner.
- Næringskort: maks tre tall over folden.
- Lønn: **ett** tall med spenn — median med 1.–9. desil. Ikke gjennomsnitt og
  median og desiler som tre felter.

Det som fortrenges flyttes ned på siden eller inn i et panel. Databasen skal
være rik; skjermen skal være rolig.

## Lønn

Fra `industry_wages`. Vis median med spenn fra 1. til 9. desil — det er **målte
tall fra SSB**, ikke et anslag, så det skal ikke merkes som anslag.

Generell regel: finnes spennet i kilden, skal vi ikke gjette det. Anslagslaget
er for der kilden tier.

Lønnsstatistikken går lenger og er ferskere enn strukturstatistikken (2015–2025
mot 2017–2023). Ikke la de to seriene se ut som samme periode — årstempel per
måltall.

## Ingen betalingsmur

Produktet er gratis inntil trafikken er der. Ingen planer, ingen
rettighetsstyring, ingen premium-teasere. `favorites` er den eneste brukereide
tabellen, og auth finnes bare for den.

## Solo-laget: to funksjoner som bærer den nye inngangen

**`solo_oversikt()`** — alle kategoriene rangert fra færrest ansatte per foretak
og oppover, med margin, driftsresultat per foretak, median månedslønn og vekst.
Dette er datagrunnlaget for `/alene`.

`soloklasse` er en **merking av et målt tall**, ikke et nytt tall — samme
konstruksjon som `eierlonn_i_resultat`. Fire verdier, og de skal skrives om til
folkelig språk i UI-et, aldri vises rå:

| Verdi | Ansatte per foretak | Skriv |
|---|---|---|
| `alene` | < 1,5 | «Typisk én person» |
| `to` | 1,5–2,9 | «Deg og én til» |
| `lag` | 3–9,9 | «Et lite lag» |
| `bedrift` | ≥ 10 | «En bedrift» |

Tallet skal alltid stå ved siden av merkingen. «0,9 ansatte per foretak» er
statistikk; «det typiske fysioterapiforetaket er én person» er et svar — skriv
det andre, vis det første.

**`hva_ma_du_omsette(slug, mal_mnd)`** — regnestykket. Målinntekt invertert
gjennom bransjens målte driftsmargin.

Tre regler, alle påkrevd i UI-et:

1. **Vis alltid `nodvendig_omsetning_mnd` sammen med `typisk_omsetning_mnd`.**
   «Du må omsette for 58 997 kr i måneden» alene er skummelt. «— et typisk
   frisørforetak omsetter for 110 195» er det som gjør det brukbart.
   `andel_av_typisk_pct` er tallet som sier hvor krevende det er.
2. **`eierlonn_i_resultat` MÅ vises som forbehold.** Er den `true`, gjør eieren
   arbeidet ulønnet og målbeløpet ligger nær det hun lever av. Er den `false`
   eller `null`, er driftsresultatet regnet *etter* at lønn er betalt — da er
   målbeløpet det foretaket sitter igjen med *i tillegg til* lønna. To helt
   ulike ting under samme tall.
3. **Tom respons er et gyldig svar.** Funksjonen returnerer ingen rad der
   marginen ikke er positiv (Blomster & hage, −0,61 % i 2024) eller målbeløpet
   ikke er positivt. Skriv «vi kan ikke regne dette for [kategori] — bransjen
   gikk med underskudd i [år]». Ikke fall tilbake på et estimat, og ikke skjul
   modulen uten forklaring.

Beløpet er aldri en inntektsprognose. Etterspørselen er leserens vurdering;
marginen er vår måling. Det er hele forskjellen på dette og et tall vi ville
måttet finne på.

## Ikke gjør

- Ikke hardkod tall i komponenter.
- Ikke fyll NULL med 0.
- Ikke sett en vekstpille på et selskap eller en kommune.
- Ikke vis score eller plassnummer uten peer-gruppe og dekningsgrad.
- Ikke kall lav foretakstetthet en «mulighet» — den skal ramme som «verdt å
  undersøke hvorfor», og alltid stå sammen med etterspørselstall.
- Ikke skriv «LIVE», «sanntid» eller «oppdatert daglig» noe sted.
- Ikke vis anslag i samme visuelle form som målte tall.
- Ikke bygg innlogging foran næringssidene — de er offentlige.
- Ikke lag nye sider uten at de er bestilt.
- Ikke merk lønnsspennet som anslag — det er målte kvartiler (ikke desiler).
- Ikke bygg betalingsmur, planer eller premium-teasere.
- Ikke sprenge tallbudsjettet fordi et felt finnes i basen.
- Ikke bygg en mulighets- eller potensialindeks, uansett hvor godt den ser ut i
  en skisse. Fem ledd uten fasit og ett svar med to gjeldende siffer er nøyaktig
  den feilen `industry_estimates` ble tømt for.
- Ikke lov et inntektsbeløp. `hva_ma_du_omsette` sier hva du må omsette, aldri
  hva du kommer til å tjene.
- Ikke regn skatt for leseren, og ikke plasser noen på riktig side av grensa
  mellom hobby og næringsvirksomhet. Gjengi Skatteetatens terskler som fakta med
  kilde, og lenk dit.
- Ikke skriv «side hustle» eller «sidegesjeft» om dataene. Vi ser registrerte
  foretak med regnskap, ikke småjobber eller gig-arbeid. Rammen er «starte for
  deg selv».
