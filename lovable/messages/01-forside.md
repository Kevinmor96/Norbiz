Bygg forsiden. Offentlig, ingen innlogging.

Forsiden har én jobb utover å være pen: den må gjøre klart innen første skjerm
hvorfor dette finnes når tallene allerede ligger hos Proff, Purehelp,
Brønnøysund og SSB.

Hero med overskriften «Finn ut hva som faktisk lønner seg å drive i Norge».

Underteksten skal gjøre posisjoneringsarbeidet, ikke bare oppgi dekning. Poenget
er at tallene finnes allerede — spredt over fire kilder, per selskap, uten
sammenheng — og at dette er stedet de er satt sammen til ett svar på
bransjenivå. Formuler det med egne ord, kort, maks to setninger.

Dekningstallene står som belegg under, ikke som hovedbudskap: antall næringer,
antall regioner og årsspennet, alle hentet fra databasen med `count` og
`min`/`max` — aldri hardkodet.

Én stor søkeboks med autocomplete mot `industries`, som søker i `common_name`
og `search_terms`. Under den fire eksempel-chips: Frisørsalong, Treningssenter,
Restaurant, Regnskapsfører.

Deretter et bånd med tre korte kolonner, ingen illustrasjoner:

1. **Bransje, ikke bedrift.** De andre svarer per organisasjonsnummer. Her er
   svaret per næring og region — det spørsmålet en rådgiver, en bank eller en
   oppkjøper stiller først.
2. **Sammenstilt, ikke rådata.** Strukturstatistikk, foretaksdemografi,
   konkurstall, folketall og regnskapstall i samme tabell, med en beregnet
   score på toppen.
3. **Vi sier hva vi ikke vet.** Hvert tall bærer sin opprinnelse — målt,
   beregnet eller anslått — og hvert hull har en årsak. Et tall som er skjult
   av konfidensialitetshensyn er noe annet enn et tall som mangler.

Under det en kompakt tabell med de ti næringene som har høyest `score_total`
nasjonalt, fra `industry_scores`. Hver rad lenker til næringssiden.

Den tabellen er beviset på påstandene i båndet over, så den skal ligge nær nok
å kunne leses i samme blikk — ikke nedenfor en stor luftig seksjon.
