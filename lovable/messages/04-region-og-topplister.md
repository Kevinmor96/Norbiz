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
befolkningsutvikling i regionen, og om næringen krymper nasjonalt. Ikke gi den
mest plass, og ikke gjør den til overskriften.

Husk at regionale tall kun finnes på NACE 2–3, og at de gjelder virksomheter,
ikke foretak. Vis hvilken fylkesårgang som er i bruk for valgt år.

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
regnskapsår, så hver rad får et årstempel i stedet. Ikke regn ut en vekst av ett
målepunkt, og ikke lån næringens vekst.

Skriv i UI-et at enkeltpersonforetak er utelatt fordi de ikke leverer
årsregnskap — ikke bare i en fotnote. Feltet `inngar_i_regnskapssnitt` avgjør
hvem som er med.

### 3. Kommuner

Aggregert fra `companies`, siden strukturstatistikken stopper på fylke. Antall
selskaper, samlet omsetning, ansatte og margin. Også årstempel, ikke vekstpille,
og samme AS-avgrensning gjelder — si det.

## Filterrad over alle tre

Søk, region, kategori, minimum antall enheter, og størrelsesintervall.
Minimumsterskelen leses fra `score_config.min_enheter`. Uten den dominerer
mikronæringer med tre foretak hele lista, så den skal ha en synlig
standardverdi framfor å ligge skjult.

Til slutt `<Footnotes />` på begge sider.
