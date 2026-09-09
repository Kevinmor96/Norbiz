Bygg regionsiden på `/region/[code]` og topplistesiden.

## Regionsiden

For valgt fylke, i denne rekkefølgen: mest lønnsomme næringer, raskest voksende,
høyest konkurstetthet, og til sist næringer med lavest foretakstetthet
sammenlignet med landsgjennomsnittet.

Rekkefølgen er bevisst. De tre første hviler på målte tall. Den siste er et
*fravær*, og et fravær er tvetydig: lav tetthet betyr minst like ofte at det
ikke er etterspørsel der som at noe er uutnyttet. Hull finnes vanligvis av en
grunn.

Så den visningen skal rammes som **«verdt å undersøke hvorfor»**, ikke som en
mulighet, og alltid stå sammen med det vi har av etterspørselsindikatorer:
befolkningsutvikling i regionen (`region_population` har 2017–2023), og om
næringen krymper nasjonalt. Ikke gi den
mest plass, og ikke gjør den til overskriften.

**To ting som følger av datamodellen her, og som er lette å bryte:**

Regionale tall finnes kun på NACE 2–3. En regionside kan altså ikke vise en
femsifret næring i det hele tatt — den må vise 2- og 3-sifrede.

Regionale rader gjelder **virksomheter**, ikke foretak, og de har **ingen
driftsmargin** — den er NULL regionalt. «Mest lønnsomme næringer» i et fylke kan
derfor ikke rangeres på `driftsmargin_pct`. Bruk `score_lonnsomhet` fra
`industry_scores` for den regionen, eller si tydelig at marginen er det nasjonale
tallet mens tettheten er den regionale. Ikke lån den nasjonale marginen og la den
se regional ut.

Vis hvilken fylkesårgang som er i bruk for valgt år: 17 fylker 2017–2019, 11 fra
2020.

## Topplistene

Sidens tyngdepunkt. Tre enheter i faner, i denne rekkefølgen — næring er
hovedsvaret, selskaper og kommuner er belegg:

### 1. Næringer

Topp 20 på samlet score som standard, med egne lister for beste margin, høyest
vekst, best overlevelse og lavest konkurransetetthet. Rangert rad med
fargestripe, hovedtall og vekstpille.

### 2. Selskaper

Rangert på omsetning, med driftsresultat, margin, kommune, NACE-kode og antall
ansatte.

**Ingen vekstpille her.** Brønnøysunds åpne API gir bare siste innsendte
regnskapsår, så hver rad får et årstempel i stedet. Alle 300 selskapene i basen
har `regnskapsar = 2023` — ett målepunkt. Ikke regn ut en vekst av det, og ikke
lån næringens vekst.

Skriv i UI-et at enkeltpersonforetak er utelatt fordi de ikke leverer
årsregnskap — ikke bare i en fotnote. Feltet `inngar_i_regnskapssnitt` avgjør
hvem som er med.

### 3. Kommuner

Aggregert fra `companies`, siden strukturstatistikken stopper på fylke. Antall
selskaper, samlet omsetning, ansatte og margin. Også årstempel, ikke vekstpille,
og samme AS-avgrensning gjelder — si det.

**Vår egen undertrykking gjelder her.** Dette er det ene stedet vi bygger
aggregater nedenfra, og da må vi bruke samme minimumsterskel som kilden: under
`score_config.min_enheter_aggregat` (5) skal det stå «skjult av
konfidensialitetshensyn», ikke tallet. Grunnen er konkret — snitt av tre
selskaper i én næring i én liten kommune er lett å regne baklengs til hva hver
enkelt tjente.

Basen har 300 selskaper spredt over 10 kommuner, så mange
kommune-og-næring-kombinasjoner vil ligge under terskelen. Det er meningen at du
skal treffe den.

## Filterrad over alle tre

Søk, region, kategori, minimum antall enheter, og størrelsesintervall.
Minimumsterskelen leses fra `score_config.min_enheter` (20), ikke hardkodet. Uten
den dominerer mikronæringer hele lista, så den skal ha en **synlig
standardverdi** framfor å ligge skjult — brukeren skal se at et filter er aktivt.

Til slutt `<Footnotes />` på begge sider.
