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

## Delte komponenter

- `<DataBadge quality source year coverage konfidens />` — på hvert KPI-kort og
  hver graf.
- `<InsightCard />` — én rad fra `ai_insights`, ankret ved KPI-en i
  `knyttet_til`, sortert på `alvorlighet`. Klikk utvider `referanser`.
- `<Footnotes />` — nederst på hver side, generert fra radene siden faktisk
  viste. Ikke en håndskrevet tekst.

## Design

Mørk bakgrunn nær sort, kortflater et hakk lysere. Én aksentfarge for positivt,
én for negativt, ellers gråtoner — maks tre farger samtidig. Store, luftige
KPI-kort der tallet er hovedelementet. `font-variant-numeric: tabular-nums`
overalt hvor tall stables. Avrundede hjørner og tynne kantlinjer, ikke
slagskygger. Gradienter kun i hero, glassmorphism kun på sticky header.
Animasjoner under 200 ms. Skeleton-states på alle kort og grafer. Dark mode
som standard. Fullt responsivt: KPI-kort stables på mobil, tabeller blir kort.

## Ikke gjør

- Ikke hardkod tall i komponenter.
- Ikke fyll NULL med 0.
- Ikke bygg innlogging foran næringssidene — de er offentlige.
- Ikke lag flere sider enn de seks.
- Ikke vis anslag i samme visuelle form som målte tall.
