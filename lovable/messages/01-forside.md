Bygg forsiden. Offentlig, ingen innlogging.

Følg den visuelle retningen i prosjektkunnskapen: mørk grunn, store lyse kort,
rangerte rader, score som femdelt stripe.

## Hero — mørk

Over overskriften to små pille-merker som navngir kildene: «SSB
strukturstatistikk og foretaksdemografi» og «Brønnøysund regnskapstall». De gjør
troverdighetsarbeidet før brukeren har lest en setning.

Overskrift: «Finn ut hva som faktisk lønner seg å drive i Norge».

Undertekst, maks to setninger med egne ord: tallene finnes allerede — spredt
over fire kilder, per selskap, uten sammenheng — og her er de satt sammen til
ett svar på bransjenivå.

Hvit pille-knapp: «Se indeksen».

Under den en linje med dekning, hentet fra databasen med `count`, `min` og
`max` — aldri hardkodet: antall næringer, antall kategorier, antall fylker og
årsspennet. Deretter tre små tellekort: antall statistikkrader, antall
selskaper, og «6 delscorer per næring».

## Topp 20 — lyst kort

Det viktigste på siden. Et stort lyst kort med overskriften «De mest lønnsomme
bransjene i Norge», og en kort forklaring på at rangeringen er samlet score, ikke
margin alene.

Over lista en filterrad: søkefelt, og nedtrekk for region, kategori og minimum
antall foretak. Filtrene skal fungere.

Så tjue rangerte rader fra `industry_scores`, hver med:
plassnummer · næringsnavn med NACE-kode og antall foretak under · femdelt
fargestripe for `score_total` · driftsmargin som hovedtall · vekstpille med
omsetningsendring over tre år.

Hver rad lenker til næringssiden.

## Kategorier — mørk seksjon

Chips i rutenett, én per hovednæring, med snittmargin som stort tall og antall
næringer og foretak som undertekst. Sortert på margin.

Spennet fra rådgivning til servering er nær åtte ganger, og det er selve
spørsmålet en kjøper stiller — så det skal være synlig, ikke gjemt bak et filter.
Klikk filtrerer topplista over.

## Differensiatorene — mørk seksjon nederst

Tre korte kolonner, ingen illustrasjoner: bransje ikke bedrift, sammenstilt ikke
rådata, og at vi sier hva vi ikke vet. Siste punkt skal nevne at et tall som er
skjult av konfidensialitetshensyn er noe annet enn et tall som mangler.

Til slutt `<Footnotes />`.
