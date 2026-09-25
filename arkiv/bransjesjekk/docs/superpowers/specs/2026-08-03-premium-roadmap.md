# Premium — vurdering og retning

Dato: 2026-08-03
Status: **utforsking, ikke besluttet.** Ingenting her skal bygges nå.
Hovedspec: `2026-08-02-norbiz-design.md`, beslutning 2.19 (gratis til trafikken
er der).

Dette dokumentet finnes for at tenkingen ikke skal gå tapt, og for at
beslutningene skal kunne tas bevisst senere. Rangeringen under er min vurdering,
ikke et mandat.

---

## Den strategiske gaffelen som må ses først

Alle premiumideene i denne runden retter seg mot **gründere** — den *tredje*
prioriterte målgruppen i hovedspec-en.

Primærmålgruppen, rådgivere og banker og næringsmeglere, ville betalt for noe
helt annet: bulkuttrekk, sammenligning av mange næringer samtidig, kunderapport
med eget merke, og varsling når en nærings score endrer seg.

Det er to produkter med ulik prispsykologi:

| | Gründer | Rådgiver |
|---|---|---|
| Kjøpsøyeblikk | én milepæl, én gang | løpende arbeid |
| Modell | betal per bruk | abonnement |
| Volum | mange, lave beløp | få, høye beløp |
| Anskaffelse | SEO og organisk | salg og relasjon |

Instinktet om å skille dem er riktig. Men velger vi gründerpremium først, står
primærmålgruppen umonetisert, og produktets tyngdepunkt flytter seg mot gründere.
Det kan godt være riktig — de er mange flere og billigere å nå — men det ville
snu posisjoneringen vi nettopp skjerpet i seksjon 0.

**Det bør være en beslutning, ikke en glidning.**

---

## Enkelhet er differensiatoren, og premium truer den

Utgangspunktet var at vår versjon skal vinne på design og enkelhet. Hver
premiumfunksjon legger til kompleksitet, så de to målene står i spenning.

Løsningen er *hvor* premium bor, ikke *om*:

**Én dør, ikke hundre låser.** Referansen vår sprer «Unlock 15 275+ SaaS» utover
hele opplevelsen. Det er presis det som ikke skal kopieres hvis enkelhet er
fortrinnet. Premium skal ligge bak én eksplisitt inngang — «Lag din analyse» —
mens gratisproduktet forblir helt og uavkortet.

Et gratisprodukt fullt av hengelåser føles fattigere enn et som er lite men
komplett.

---

## Idé 1: Tilpasset analyse før oppstart — **klart sterkest**

Brukeren oppgir egenkapital, antatt husleie, antall ansatte, næring og område.
Ut kommer oppstartskostnader, lønnskostnader og driftskostnader.

**Hvorfor denne er best:** den gjør scoren *handlingsrettet*. I dag sier
produktet «denne næringen ligger på persentil 80». Analysen sier «med 500 000 i
egenkapital og tre ansatte i Bergen ser ditt første driftsår slik ut». Det er et
annet og mye mer verdifullt svar.

Og inputene er nøyaktig det dataene våre *ikke* kan vite. Det gjør den til et
ekte komplement framfor et påheng.

**Datagrunnlaget finnes allerede:** `industry_wages` gir lønn med ekte desiler,
`lonnsandel_pct` gir hva lønn utgjør av omsetning i næringen,
`bruttoinvestering_total` per sysselsatt gir kapitalintensitet, og
`industry_estimates` gir etableringskapital som spenn.

**Kravet som følger av seksjon 1:** hvert tall i analysen skal vise om det kom
fra brukerens input, fra målt statistikk, eller fra anslag. En kostnadsoppstilling
der de tre er blandet umerket er presis den feilen hele proveniensarkitekturen
finnes for å hindre. Radene skal være merket, og summen skal si hvor mye av seg
selv som er anslått.

---

## Idé 2: Startpakke med dokumenter — **god, men verdien ligger ikke der man tror**

Budsjetter, prognoser, handlingsplan, SWOT, konkurranseanalyse.

**Markedet er trangt.** Innovasjon Norge, Altinn, hver regnskapsfører og et
dusin malbutikker tilbyr forretningsplanmaler. AI-generert SWOT er
råvare — enhver chatbot gjør det gratis.

**Så verdien er ikke dokumentet. Den er tallene inni det.** En forretningsplan
med reelle norske bransjetall for margin, lønn, overlevelsesrate og
konkurransetetthet i *den valgte kommunen* er noe ingen mal kan gi. En blank mal
og en utfylt mal er ikke samme produkt.

Positioneringen må derfor være «din plan, fylt med faktiske tall for din bransje
og ditt område» — ikke «vi lager forretningsplanen din».

Prioritet: bygg denne *etter* idé 1, og som eksport *fra* den. Ikke som eget
produkt.

---

## Idé 3: Brand kit og «Design min bedrift» — **anbefaler å droppe**

Navneforslag, design, farger, pitchdeck.

Fire grunner, og de peker samme vei:

**Ingen kobling til vollgraven.** Ingenting i SSBs strukturstatistikk hjelper å
lage en logo. Funksjonen ville stått helt utenfor det vi er gode på.

**Mest råvarepregede AI-kategorien som finnes.** Canva, Looka, Namelix og enhver
chatbot gjør dette, flere gratis. Vi ville konkurrert på deres hjemmebane med et
svakere tilbud.

**Den skader primærmålgruppen aktivt.** «Bransjeindeks» er troverdig for en bank
nettopp fordi den er tørr og faktabasert. Legger vi logogenerering ved siden av,
leses hele produktet som gründerleketøy. Det er dyrere enn det ser ut.

**Og pitchdeck til investorer er en tillitsrisiko.** Et deck vi genererer, med
tall som delvis er gjettet, som så legges foran en investor — samme problem som
idé 4 under.

**Den ene delen som er verdt å beholde:** *navnesjekk mot Enhetsregisteret*. Det
er ikke branding, det er et registeroppslag, og vi henter allerede
Enhetsregisteret. Kombinert med varemerkesøk hos Patentstyret er det en reell,
datafundert funksjon vi er uvanlig godt plassert for. Skill den fra
designideen — den hører hjemme i idé 1, som et steg i oppstartsanalysen.

---

## Idé 4: Lånedokument for mitt AS — **omarbeides før den bygges**

Dette er ideen med et reelt problem, og det er verdt å være presis om hva
problemet er.

Å generere et dokument som er **ment å leveres til en bank**, med tall som
delvis er anslag og «litt gjetting», skaper tre ting:

**Ansvarsspørsmål.** Blir et lån gitt eller avslått på tall vi genererte, hvem
svarer for dem? Vi vet ikke, og det er nok grunn til å ikke bygge det slik.

**Bankens egen aktsomhetsplikt.** Et dokument som *ser* autoritativt ut men
inneholder gjetting, gjør bankens jobb vanskeligere, ikke lettere.

**Og det bryter med hele grunnregelen.** Et lånedokument der målte og anslåtte
tall står blandet er den nøyaktige feilmodusen seksjon 0 finnes for å hindre.

**Den trygge og etter mitt syn bedre versjonen:** generer et
**forberedelsesdokument til gründeren**, ikke et innsendingsdokument til banken.

> «Dette kommer banken til å spørre om. Her er dine tall mot bransjenormen. Her
> er de tre svakeste punktene de vil grave i — din lønnsandel ligger 8
> prosentpoeng over bransjesnittet, og du har ikke tatt høyde for at
> overlevelsesraten etter fem år i denne næringen er 38 %.»

Det er ærligere, mer nyttig, og selger like godt. En gründer som går forberedt
inn i bankmøtet har fått noe reelt. En gründer som leverer et AI-generert
dokument har fått en risiko han ikke kjenner.

Samme resonnement gjelder pitchdeck til investorer i idé 3.

---

## Rangering

| Idé | Vurdering | Rekkefølge |
|---|---|---|
| Tilpasset analyse før oppstart | Sterkest. Gjør scoren handlingsrettet, og inputene er det dataene ikke kan vite. | 1 |
| Bankforberedelse (omarbeidet idé 4) | Sterk, og faller naturlig ut av idé 1. | 2 |
| Startpakke med dokumenter | God som eksport fra idé 1. Ikke som eget produkt. | 3 |
| Navnesjekk mot Enhetsregisteret | Liten, men vi er uvanlig godt plassert. Del av idé 1. | 4 |
| Brand kit og design | Anbefaler å droppe. Ingen kobling til fortrinnet, og skader troverdigheten. | — |
| Lånedokument til banken | Ikke i denne formen. Se over. | — |

---

## Hva som ikke skal bygges nå

Ingenting. Beslutning 2.19 står: gratis til trafikken er der, og ingen
abonnementsplumbing i skjemaet.

Det er verdt å merke at rekkefølgen også er teknisk riktig. Idé 1 hviler på
`industry_wages`, `industry_estimates` og `lonnsandel_pct` fylt med **ekte** data
fra SSB og Brreg. I dag er alt syntetisk seed. En oppstartsanalyse bygget på
mock-tall ville vært verdiløs uansett hvor god UX-en er.

Så: importen først, trafikken deretter, premium til sist. Ikke fordi premium er
uviktig, men fordi de to første er forutsetninger.
