# Copy og posisjonering — hva vi låner, og hva vi ikke låner

Dato: 2026-08-04
Status: **retningsgivende for tekst.** Ingen kodeendringer følger av dette
dokumentet alene.

Hovedspec: `2026-08-02-norbiz-design.md`. Dette dokumentet handler bare om
språket utenpå produktet — hero, annonser, CTA-er — ikke om datamodellen.

---

## Utgangspunktet

Proven SaaS annonserer slik:

> **Stop guessing what SaaS to build.** Spy on 15,000 companies making $10K+ a
> month. See their revenue. Steal their ads. Launch what already works.
>
> FIND THE MOST PROFITABLE SAAS — *Revenue. Ads. Ideas.*
>
> **Build What's Already Profitable**

Det er god markedsføring, og verdt å ta fra. Men den er god på to nivåer som må
skilles: **håndverket** og **registeret**. Det første skal vi låne. Det andre
ville skadet oss, og det er verdt å skrive ned hvorfor — ellers blir det lånt
også, litt av gangen, fordi det virker.

---

## Fire grep som overføres

**1. Åpne med brukerens tilstand, ikke med kategorien.**
«Stop guessing» navngir følelsen leseren har før hen kjenner produktet. Vår
nåværende hero — «Finn ut hva som faktisk lønner seg å drive i Norge» — er en
beskrivelse av produktet. Det norske ekvivalentet er nærmere «Slutt å gjette».
Gjetting er presis den tilstanden en som vurderer å kjøpe en frisørsalong er i.

**2. Ett konkret tall gjør troverdighetsarbeidet.**
«15,000 companies making $10K+ a month» er sterkere enn et hvilket som helst
adjektiv. Vi har den samme typen aktiva — antall næringer, antall
statistikkrader, årsspenn — og forsiden henter dem allerede fra basen framfor å
hardkode dem.

**Men vi kan ikke bruke grepet ennå.** Alle tall i basen er `mock`. Et konkret
tall i en annonse er en påstand om dekning, og en slik påstand på demodata er
nettopp den løgnen hele proveniensarkitekturen finnes for å hindre. Grepet er
låst til etter at `import-ssb` og `import-brreg` er skrevet. Da blir det til
gjengjeld sterkt, fordi tallet er ekte og etterprøvbart.

**3. Verbtrioer med rytme.**
«Revenue. Ads. Ideas.» og «See their revenue. Steal their ads. Launch what
already works.» Tre korte ledd, hvert et verb leseren utfører.

Våre tre differensiatorer er allerede en trio, men de er formulert som
*begreper*: bransje ikke bedrift / sammenstilt ikke rådata / vi sier hva vi ikke
vet. Det er riktig innhold i feil form for en annonse. Samme tre poeng som
handlinger ligger nærmere: *Sammenlign bransjer. Se hva som mangler. Vit hva du
går inn i.*

**4. CTA-en sier utfallet, ikke funksjonen.**
«Build What's Already Profitable» — ikke «Search the database». Vår «Se
indeksen» er en funksjonsbeskrivelse. Utfallsvarianten er noe i retning av «Se
hva bransjen din faktisk tåler».

---

## Tre grep som ikke overføres, og hvorfor

**«Spy» og «Steal».** Energien i annonsen kommer av et snev av det
transgressive. Primærmålgruppen vår er rådgivere, banker og næringsmeglere.
Bransjeindeks er troverdig for en bank nettopp fordi den er tørr og
faktabasert — samme resonnement som fikk oss til å droppe brand kit-ideen i
premium-vurderingen. Legger vi «spioner på» i toppen av forsiden, leses hele
produktet som gründerleketøy, og det er dyrere enn det ser ut.

Det er ikke en smaksdom. Det er at de to registrene selger til to forskjellige
kjøpsøyeblikk, og vi har valgt det ene.

**«Launch what already works.»** Løftet er *sikkerhet*. Vårt produkt er bygget
på det motsatte: at vi sier hva vi ikke vet, at et anslag aldri ser ut som et
målt tall, at scoren bærer sin egen dekningsgrad. En annonse som lover visshet
og en næringsside som åpner med forbehold er to forskjellige produkter, og
brukeren merker spriket i det andre klikket.

Det ærlige motstykket er ikke «gjør det som funker», men **«vit hva du går inn
i»**. Det selger dårligere i ett sekund og bedre over et kundeforhold.

**Selskapsnivået.** De selger oppslag på enkeltselskaper. Vi svarer med vilje på
et annet spørsmål — bransje, ikke bedrift. Låner vi framingen deres, kollapser
posisjoneringen vår til det Proff og Purehelp allerede gjør, og da konkurrerer vi
på deres hjemmebane med et dårligere datagrunnlag.

---

## Regelen som følger

Når vi skriver salgstekst: **lån strukturen, ikke løftet.**

Struktur som er trygg å kopiere: tilstand først, ett konkret tall, tre korte
ledd, utfall i CTA-en.

Løfte som ikke er trygt å kopiere: visshet, snarveier, og alt som antyder at
tallene er ferskere eller sikrere enn de er.

Og den harde grensen, som allerede står i `lovable/knowledge.md`: ingen
ferskhetspåstand noe sted. «LIVE», «sanntid» og «oppdatert daglig» er løgn her,
også i en annonse — særlig i en annonse, siden den er det første leseren måler
oss på.
