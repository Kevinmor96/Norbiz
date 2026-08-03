# Bransjeindeks — faste regler

Beslutningsverktøy for den som vurderer å starte, kjøpe eller investere i en
bedrift i Norge. Målgruppe i prioritert rekkefølge: rådgivere, banker og
næringsmeglere; investorer og oppkjøpere; gründere.

## Posisjonering

Problemet er ikke mangel på data. Tallene finnes allerede hos Proff, Purehelp,
Brønnøysund og SSB — fire kilder som alle svarer på «hvordan går det med dette
selskapet?» Dette produktet svarer på noe annet: «er denne typen virksomhet
verdt å drive, her?»

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

## Delte komponenter

- `<DataBadge quality source year coverage konfidens />` — på hvert KPI-kort og
  hver graf.
- `<InsightCard />` — én rad fra `ai_insights`, ankret ved KPI-en i
  `knyttet_til`, sortert på `alvorlighet`. Klikk utvider `referanser`.
- `<Footnotes />` — nederst på hver side, generert fra radene siden faktisk
  viste. Ikke en håndskrevet tekst.

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
- Ikke lag flere sider enn de seks.
