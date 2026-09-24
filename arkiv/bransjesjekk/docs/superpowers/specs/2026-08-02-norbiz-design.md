# Bransjeindeks — design

Dato: 2026-08-02
Status: godkjent, klar for implementasjonsplan

Et beslutningsverktøy for den som vurderer å starte, kjøpe eller investere i en
bedrift i Norge. Brukeren skal kunne svare på ett spørsmål: hvor lønnsomt er det
egentlig å drive denne typen virksomhet, her?

Målgrupper i prioritert rekkefølge: rådgivere, banker og næringsmeglere;
investorer og oppkjøpere; gründere.

## 0. Posisjonering

Problemet er ikke mangel på data. Problemet er at dataene finnes overalt og
svarer på feil spørsmål.

Proff og Purehelp har regnskapstall per selskap. Brønnøysund har registeret.
SSB har statistikken. Fire kilder, fire innganger, fire formater — og alle
svarer på «hvordan går det med *dette selskapet*?» Ingen av dem svarer på «er
denne *typen* virksomhet verdt å drive, her?» Den sammenstillingen må brukeren
gjøre selv, hver gang, for hånd.

**Bransjeindeks er sammenstillingslaget, ikke en femte kilde.** Vi konkurrerer ikke på
å ha mer data. Vi konkurrerer på at dataene allerede er koblet, kategorisert,
scoret og forklart når brukeren kommer.

Tre ting skiller produktet, og de må alle tre fram på forsiden:

**Bransje, ikke bedrift.** De andre svarer per organisasjonsnummer. Vi svarer
per næring og region. Det er det spørsmålet en rådgiver, en bank eller en
oppkjøper faktisk stiller først.

**Sammenstilt, ikke rådata.** SSBs strukturstatistikk, foretaksdemografi,
konkursstatistikk, folketall og Brønnøysunds regnskapstall i samme tabell, med
en beregnet score på toppen. Brukeren slipper å gjøre koblingen.

**Vi sier hva vi ikke vet.** Hvert tall bærer sin opprinnelse — målt, beregnet
eller anslått — og hvert hull har en årsak. Ingen av aggregatorene forteller
deg at et tall er undertrykt av konfidensialitetshensyn framfor bare å mangle.
For en rådgiver som setter tallet inn i et kundenotat, er det forskjellen på
brukbart og ubrukelig.

Det siste punktet er den egentlige vollgraven. Det er lett å kopiere en
datakilde og vanskelig å kopiere disiplinen i å innrømme usikkerhet.

---

## 1. Grunnregelen

Dette er et shell-first-bygg. All data i første versjon er syntetisk, men
**databaseskjemaet er endelig**. Når ekte data importeres, endres kun innholdet
i tabellene — ikke én linje frontend.

Verktøyet skal samle mye god, strukturert informasjon på ett sted. Ikke alt det
en kjøper eller rådgiver trenger å vite finnes i offentlig statistikk. Der
statistikken tier, skal verktøyet likevel svare — med anslag basert på
bransjeerfaring, tydelig merket som nettopp det.

Regelen er derfor ikke «bare målte tall». Den er **at et tall aldri skal kunne
forveksles med noe det ikke er**. Tre nivåer, med hver sin merking:

| Nivå | Hva det er | `data_quality` |
|---|---|---|
| Målt | Publisert av SSB eller Brreg | `ssb`, `brreg` |
| Utledet | Regnet ut fra målte tall | `beregnet` |
| Anslått | AI-vurdering der ingen kilde finnes | `ai_anslag` |

Et anslag er et fullverdig svar, ikke en nødløsning. Men det skal aldri stå
umerket ved siden av et målt tall, og aldri i samme kolonne.

Konsekvenser som gjelder overalt:

- Hver rad bærer `source`, `data_quality` og `coverage`.
- Manglende data er NULL og vises som «ikke publisert» — aldri 0. Et hull kan
  fylles med et anslag, men da som `ai_anslag`, ikke som en stille utfylling.
- Frontend hardkoder aldri tall. Alt hentes fra Supabase via TanStack Query.

---

## 2. Beslutninger

Beslutningene tatt under brainstorming, med begrunnelsen bevart så de kan
omgjøres bevisst senere.

### 2.1 Granularitet: lagre kun det SSB faktisk publiserer

SSB gir ikke næringstall på 5-siffer NACE per fylke:

| Kilde | NACE-nivå | Enhet | Periode |
|---|---|---|---|
| Nasjonalt (tabell 12910) | 2, 3, 4, 5 | foretak og virksomheter | 2017–2023 |
| Etter fylke (tabell 12936) | 2, 3 | virksomheter | 2017–2023 |

Modellen lagrer derfor det som finnes, ikke det vi skulle ønske fantes.
Nasjonale rader på nivå 2–5, regionale rader på nivå 2–3. Ingen rad
fabrikkeres for å fylle rutenettet.

UI-en degraderer ærlig: velger brukeren en femsifret næring sammen med et
fylke, vises nasjonale og regionale tall side om side, hver med sin egen
`<DataBadge />` og granularitet påført.

Forkastet: å fordele nasjonale 5-siffertall utover fylker etter 3-sifferandel.
Det ville gitt en enhetlig modell, men tallene forutsetter at næringsmiksen
innad i et 3-siffer er lik i alle fylker, og det er den ikke.

### 2.2 Arbeidsdeling: delt ved Supabase-grensen

Lovable-connectoren kan ikke motta kode. Den tilbyr `send_message`,
`read_file`, `list_files` og `get_diff` — lesing og naturlig språk. Det finnes
ingen skriv-fil-API.

```
dette repoet          Supabase (eid av bruker)      Lovable
──────────────────────────────────────────────────────────────
migrasjoner   ─apply─▶  tabeller       ◀──lesing──   React-app
seed-generator          seed-data                    (bygget av
score-view              views                         Lovables
edge functions ─deploy▶ functions                     agent)
spec + invarianter ──────────────────────────────▶  send_message
```

Alt varig bygges her og kjøres mot brukerens egen Supabase. Lovable bygger kun
frontend mot samme base. Skjemaet — den endelige delen — eies av brukeren.

Forkastet: å bygge hele appen her og synke via GitHub. Krever manuell
oppsett i Lovable-dashboardet, og Lovables agent kan skrive over strukturen
ved senere endringer.

### 2.3 `omsetning_median` utgår

SSBs strukturstatistikk publiserer totaler og gjennomsnitt, ikke medianer.
Feltet kan ikke fylles fra noen tilgjengelig kilde.
`omsetning_per_enhet` beholdes — det er total delt på antall, som er utledbart.

### 2.4 `score_kapitalbehov` deles i to

Det opprinnelige problemet: delscoren skulle bygge på median egenkapital fra
Brreg, men det åpne API-et gir kun siste innsendte regnskapsår, så det finnes
ingen tidsserie å score mot.

Beslutning 2.5 løser dette ved å splitte spørsmålet, fordi det egentlig var to:

**Kapitalintensitet i drift** blir delscoren. Den beregnes fra
`bruttoinvestering_total` per sysselsatt i strukturstatistikken — en ekte
tidsserie, målt, og dermed gyldig input til `score_total`.

**Etableringskapital** — hva det faktisk koster å komme i gang — blir en rad i
`industry_estimates`. Det er det gründeren spør om, det finnes ikke i noen
kilde, og det er nettopp den typen spørsmål anslagslaget er til for. Vises som
spenn med konfidens ved siden av scoren, ikke inni den.

Brreg-egenkapital brukes ikke til scoring. Den forblir tilgjengelig per
selskap i `companies`.

### 2.5 AI-anslag som eget nivå, ikke som utvisking av grensen

Lagt til etter første gjennomlesning. Det opprinnelige utkastet tillot kun
målte felter og forbød eksplisitt «typisk etableringskapital» og «median lønn
til eier». Det er reversert: verktøyet skal svare også der statistikken tier,
med anslag basert på bransjeerfaring.

Grensen mellom målt og anslått består likevel, som en tredje verdi i
`data_quality` og en egen tabell. Begrunnelsen er målgruppen: rådgivere,
banker og næringsmeglere setter disse tallene inn i beslutninger for andre.
Et anslag de kan se er et anslag, er nyttig. Et anslag de tror er statistikk,
er en hefte.

Praktisk følge: anslag vises fritt, i egen visuell form, med konfidens og
begrunnelse — men de går ikke inn i `score_total`, og de deler aldri kolonne
med et målt tall.

### 2.6 Navn: Bransjeindeks

Arbeidsnavnene var «Norbiz» og «Business Insight Norway». Begge jobbet mot
posisjoneringen i seksjon 0.

«Biz» signaliserer katalog og oppslagsverk — presis det produktet ikke er — så
navnet plasserte oss som en Proff-konkurrent i stedet for som laget over.
«Business Insight Norway» var dessuten et engelsk navn på et norsk produkt til
norske banker, med kategoriens mest utslitte ord i midten.

**Bransjeindeks** sier hva produktet er. Scoringen *er* en indeks over næringer,
så navnet er ærlig om kjernemekanismen framfor å love noe vagt. Det er tørt, men
tørt er en styrke overfor rådgivere og banker — de kjøper troverdighet.

Repoet heter fortsatt `Norbiz`. Det er repoets navn, ikke produktets, og å døpe
om det ville brutt PR- og branch-referanser uten å gi noe tilbake.

### 2.7 proven-saas.com som retningsgivende referanse

Det opprinnelige utkastet sa «ikke kopier noe eksisterende design». Det er
justert: proven-saas.com er nå retningsgivende for design, frontend og
oppbygging.

Grunnen er at referansen løser nettopp det vanskelige — den gjør statistikk
*lystbetont å skumme*. Rangerte lister med plassnummer, ett stort tall og en
delta-pille inviterer til å bore ned, der en tabell inviterer til å lukke fanen.

Grensen består likevel: **prinsipper og oppbygging, ikke kloning.** Egen palett,
egen typografi, norsk språk, og et provenienslag referansen ikke har. Der
referansen selger ferskhet, selger vi etterprøvbarhet.

### 2.8 Vekst vises bare der dataene bærer det

Delta-pillen er referansens mest engasjerende element, og den kan ikke brukes
overalt.

| Enhet | Tidsserie | Visning |
|---|---|---|
| Næring | 2017–2023 | delta-pille med reell endring |
| Fylke | 2017–2023 | delta-pille med reell endring |
| Selskap | kun siste år | **årstempel**, ingen delta |
| Kommune | aggregert fra selskaper | **årstempel**, ingen delta |

Årsaken er Brønnøysunds åpne API: det gir nøkkeltall fra sist innsendte
årsregnskap, ett år. Tre år finnes bare i den lukkede delen, som krever
offentlig myndighet.

Konsekvensen er en fast UI-regel: **et selskapskort eller en kommunerad skal
aldri ha en vekstpille.** Å beregne en av to målepunkter, eller å låne
næringens vekst og la den se ut som selskapets, ville vært å pynte — og det er
presis det seksjon 0 sier vi ikke gjør.

### 2.9 Selskaper og kommuner er støttevisninger, ikke hovedsvaret

Topplistene dekker tre enheter: næringer, selskaper og kommuner. Det myker opp
«bransje, ikke bedrift» fra seksjon 0, og det er verdt å være presis om
hierarkiet.

Næring er fortsatt hovedsvaret. Selskaps- og kommunelistene finnes fordi de
gir *belegg* — «hvem er de faktisk, og hvor ligger de» — ikke fordi vi
konkurrerer med Proff på oppslag per organisasjonsnummer. Rekkefølgen i
UI-et skal speile det: næringer først, alltid.

### 2.10 Scoren skal bære sin egen proveniens

Funnet i en adversarisk gjennomgang, og det er den mest alvorlige feilen i
designet så langt.

Proveniensdisiplinen var lagt på **inputene**: hver celle bærer
`data_quality`, hvert hull en `mangel_arsak`. Men `score_total` og
plassnummeret sto umerket — og det er nettopp de tallene som blir tatt ut av
appen og limt inn i et kundenotat.

Det er ikke bare en glipp. Cellemerkingen *låner* troverdighet til
hovedtallet: jo mer etterrettelig detaljene ser ut, jo mer autoritet får en
umerket «#1». Og en persentilrangering vises med samme visuelle grammatikk som
alle poengtavler bruker for å si «best».

Fire krav følger:

**Kall den det den er.** Scoren er en persentilrangering innenfor en
peer-gruppe, ikke et mål på lønnsomhet. Peer-gruppen skal stå ved tallet —
«rangert mot 64 andre femsifrede næringer, 2023» — ikke i en metodedel.

**Scoren har sin egen dekningsgrad.** En `score_total` bygget på fire av seks
delscorer er en svakere påstand enn en bygget på seks. Antallet skal stå på
tallet. `industry_scores` bærer det allerede i `forklaring`; det må fram i UI-et.

**De to svakeste delscorene vises uten klikk.** Det er «hvorfor ikke høyere»,
og det virker uten interaksjon. Progressive disclosure forutsetter at noen
klikker, og de fleste gjør ikke det.

**Tallet må bære forbeholdet ut av appen.** Kopier-funksjon som tar med
metodelinjen, og delekort med samme tekst innbakt. Ellers reiser tallet uten
konteksten sin, og det er da skaden skjer.

### 2.11 Poengtavle og rådgiverflate er to ulike framinger

Spec-en hevdet både at tapsaversjon er kjøpsutløseren for rådgivere og banker,
og at rangerte lister er hovedgrensesnittet. De to peker motsatt vei: en
poengtavle med plassnummer og grønne piler er gevinstrammet
mulighetsjakt, ikke et risikoregister.

Konflikten løses ved å skille flatene bevisst i stedet for ved uhell:

**Forsiden og topplistene er anskaffelsesflaten.** Rangert, delbar, søkbar.
Optimalisert for at noen skal finne oss og bli nysgjerrige. Poengtavleformen er
riktig her.

**Næringssiden er rådgiverflaten.** Den skal åpne med det som kan gå galt:
undertrykte celler, lavkonfidens-anslag, og uenighet mellom delscorene — før
mulighetene. En rådgiver som skal si noe til en kunde, trenger forbeholdene
først.

Samme data, to rekkefølger, og begrunnelsen skrevet ned så ingen «rydder» det
bort senere.

### 2.12 «Hullene i markedet» er den mest risikable visningen, ikke den mest verdifulle

Spec-en kalte lav foretakstetthet sammenlignet med landsgjennomsnittet for den
mest verdifulle visningen på regionsiden. Det er snudd.

Et hull i markedet betyr minst like ofte **at det ikke er etterspørsel der**
som at noe er uutnyttet. Hull finnes vanligvis av en grunn. Å presentere et
tvetydig fravær som knapp innsideinformasjon er oppskriften på at en rådgiver
anbefaler inngang i et marked som er tomt fordi det er dårlig — altså presis
den feilen målgruppen betaler for å unngå.

Visningen beholdes, men:

- Rammen endres fra «mulighet» til **«verdt å undersøke hvorfor»**.
- Den skal alltid vises sammen med etterspørselsindikatorene vi har:
  befolkningsutvikling i regionen, og om næringen krymper nasjonalt.
- Den er ikke overskriften på regionsiden lenger. Mest lønnsomme og raskest
  voksende kommer først, fordi de hviler på målte tall framfor på et fravær.

Lav tetthet bærer heller ingen `data_quality`-merking, siden det er et faktum
om antall og ikke et publisert tall. Det gjør den vanskeligere å kvalifisere
enn resten — nok en grunn til å dempe den.

### 2.13 Anslag for gründere, forbehold for rådgivere

Usikkerhetsforskningen skiller mellom **kvantifisert** usikkerhet — et spenn,
et konfidensintervall — som i liten grad skader tillit, og **verbal** hedging,
som gjør det. Anslagene våre er allerede spenn med konfidens, og det er den
riktige formen.

Men merkingen `ai_anslag` leses ikke som et konfidensintervall. Den leses som
et kildesignal: «dette er ikke observert». Det er en annen psykologisk gjenstand,
og forskningen om formidlet prognoseusikkerhet dekker den ikke.

Dessuten er avveiningen ulik per målgruppe. En rådgiver som skal videreformidle
et tall, bruker *sin egen* tillit — så forbeholdet hjelper. En gründer som
vurderer å starte, kan bli handlingslammet av det samme forbeholdet, og
gründere er vekstkilen i enhver bunn-opp-modell selv om de er tredje prioritet.

Praktisk følge: anslag skrives som spenn med begrunnelse, aldri som verbal
hedging uten tall. Ordlyden skal si hva vi *vet* før den sier hva vi ikke vet —
«300 000–800 000 kr, basert på investeringsnivå i næringen» framfor «usikkert,
anslagsvis 300 000–800 000 kr».

### 2.14 Attribusjon er et lisenskrav, ikke høflighet

Markedsresearch avdekket et etterlevelseshull. Lisensene er sjenerøse, men de
har vilkår vi ikke har oppfylt noe sted.

**SSB: CC BY 4.0.** Fri kommersiell bruk og avledede produkter tillatt.
Attribusjon påkrevd.

**Brreg Enhetsregisteret: NLOD.** Kommersiell bruk, endring og kombinasjon med
andre datasett eksplisitt tillatt. To vilkår: oppgi kilden og merk at data er
endret, og ikke framstill dataene villedende eller antyd at Brreg står bak
bruken.

Ingen av lisensene forbyr avledede indekser. Men attribusjonen må stå, og
`<Footnotes />` er stedet: kildeangivelse med lisensnavn, generert fra radene
siden faktisk viste. Formuleringen for Brreg skal si at data er bearbeidet, slik
at ingen leser scoren som Brregs vurdering.

Dette er billig å gjøre riktig nå og pinlig å bli tatt på senere.

### 2.15 Brreg-historikk kan ikke etterfylles — snapshot fra dag én

Det åpne Regnskapsregisteret gir kun siste innsendte år. De tre siste årene
pluss konsernregnskap er forbeholdt offentlig myndighet.

Konsekvensen er skarpere enn «vi mangler tidsserie»: **historikk vi ikke fanger
nå, kan vi ikke hente senere.** Hvert år som går uten at snapshotet lagres, er
et år som er tapt permanent.

Derfor får `companies` en historikktabell fra starten — `companies_snapshot`
med samme nøkkeltall pluss `hentet_dato` — og `import-brreg` skriver til den
ved hver kjøring i stedet for å overskrive. Etter tre kjøringer har vi det de
andre må kjøpe seg til, og etter fem har vi noe ingen gratis konkurrent har.

Dette er den ene investeringen med rentes rente i hele prosjektet, og den
koster nesten ingenting å starte.

### 2.16 Dataene er ikke vollgraven

Tre sider bruker allerede de samme kildene: **Firmadatabasen.no** publiserer
bransjeoversikter gratis som lead-gen for Managrs betalte SaaS,
**Faktaportalen.no** normaliserer SSB, NAV og Brreg, og **Firmabasen.no** selger
abonnement på konkursrisiko oppå samme data.

Ingen av dem gjør en scoret, regionalt sammenlignet lønnsomhetsindeks. Men
premisset «ingen har gjort dette» må leses som «ingen har *pakket og scoret*
dette» — ikke som at feltet er tomt.

Det betyr at inntaket kan kopieres av hvem som helst. Differensieringen må
komme fra tre andre steder:

**Metodikken** — scoren, peer-gruppene, vektingen. Den er vår.
**Rammen** — «er dette verdt å drive, her» framfor «hvordan går det med dette
selskapet».
**Proveniensdisiplinen** — se seksjon 0. Det er lett å kopiere en datakilde og
vanskelig å kopiere viljen til å innrømme usikkerhet.

Og en advarsel: en gratis nær-substitutt som finansieres av noe annet, kan
investere mer i innhold enn et betalt dataprodukt kan. Distribusjonen må være
en bevisst plan, ikke en antakelse.

### 2.17 Reidentifisering er en beslutning, ikke en bieffekt

SSB undertrykker celler bygget på under tre enheter, pluss sekundær
undertrykking for å hindre baklengsregning. Det er derfor `mangel_arsak`
finnes.

Men det åpner en felle: bygger vi regionale tall **nedenfra** fra
enkeltselskapenes regnskap i stedet for fra SSBs ferdig undertrykte tabeller,
omgår vi SSBs regel — og overtar dermed vurderingen selv.

Snitt av tre til fem selskaper i én NACE-kode i en liten kommune gjør
enkeltselskapers resultat rimelig lett å regne baklengs. Hvert underliggende
regnskap er offentlig, så det er ikke ulovlig. Men det er ikke derfor det er
greit.

**Regelen: aggregater bygget nedenfra fra `companies` skal ha samme
minimumsterskel som SSB bruker.** Under terskelen vises `mangel_arsak =
'konfidensielt'` — vår egen undertrykking, av samme grunn som SSBs. Terskelen
lagres i `score_config` ved siden av `min_enheter`, så den kan justeres bevisst.

Det koster noen kommunerader. Alternativet er å tjene penger på å avsløre
enkeltbedrifters tall i småkommuner, og det er ikke et produkt jeg vil at dette
skal være.

### 2.18 Lønn hentes per næring, og spennet er ekte

Lønn er både en kostnadsdriver for eieren og en forventning for den ansatte, og
den mater `lonnsandel_pct` vi allerede har.

**Kildevalget er ikke opplagt.** SSB publiserer lønn både per yrke (STYRK-08,
tabell 11418) og per næring. Yrkestabellen er den mest presise for «hva tjener en
frisør», men SSB gir **ingen kartlegging fra NACE til yrke**. Bygger vi den selv,
er den vår vurdering, ikke statistikk.

Så: primærkilden er lønn **per næring**, fordi den ikke krever noe vi må finne
opp. Yrkesrader finnes i tillegg, med `yrke_kode` satt, for de næringene der ett
eller to yrker dominerer og tallet blir mer opplysende enn næringssnittet. De
radene merkes `beregnet`, ikke `ssb`, fordi koblingen er vår.

**Og spennet er målt, ikke gjettet.** `statistikkmål`-dimensjonen i SSBs
lønnstabeller inneholder gjennomsnitt, median *og desiler*. Fra–til oppgis derfor
som 1. og 9. desil.

Det er verdt å dvele ved: der `industry_estimates` må gi et anslag med konfidens,
kan lønn gi et ekte spenn fra statistikken. Regelen som følger av det er
generell — **finnes spennet i kilden, skal vi ikke anslå det.** Anslagslaget er
for der kilden tier, ikke et sted å ta snarveier.

Merk også at lønnsstatistikken går 2015–2025, altså både lenger og ferskere enn
strukturstatistikkens 2017–2023. Appen vil ha lønnstall for år den ikke har
marginer for. Årstempel per måltall håndterer det, men UI-et må ikke la de to
seriene se ut som samme periode.

### 2.19 Gratis til trafikken er der

Ingen betalingsmur, ingen planer, ingen rettighetsstyring. Ikke fordi det ikke
skal tjenes penger senere, men fordi rekkefølgen betyr noe.

Praktisk følge for skjemaet: **ikke bygg abonnementsplumbing nå.** Ingen
`plans`-tabell, ingen `entitlements`, ingen gating i RLS. `favorites` er den
eneste brukereide tabellen, og auth finnes bare for den.

Dette er også et argument for SEO-flaten. Et gratis produkt som rangerer på
«lønnsomhet frisørsalong» samler trafikk som senere kan konverteres. Et betalt
produkt uten trafikk har ingenting å konvertere.

Premiumfunksjoner er eksplisitt utenfor scope. Når de kommer, er det en egen
beslutning med egen begrunnelse.

Tenkingen rundt hva premium *kan* bli er samlet i
`2026-08-03-premium-roadmap.md` — utforsking, ikke mandat. Kort oppsummert peker
den mot at den sterkeste kandidaten er en tilpasset oppstartsanalyse som gjør
scoren handlingsrettet, at dokumentpakker er verdt noe kun fordi de fylles med
ekte bransjetall, og at branding-funksjoner bør droppes fordi de ikke har noen
kobling til fortrinnet vårt og svekker troverdigheten overfor primærmålgruppen.

Den peker også på en gaffel som må velges bevisst: premiumideene retter seg mot
gründere, som er tredje prioritet. Rådgivere og banker ville betalt for noe annet.

### 2.20 Informasjonsbudsjett per side

Et krav som er lett å skrive og vanskelig å holde: **kort, oversiktlig og
verdifullt — uten å bli overveldende.**

Det står i direkte spenning med resten av spec-en, som stadig legger til felter.
Uten en regel vinner «mer data er bedre» hver gang, og produktet ender som et
regneark med farger.

Regelen: **hver seksjon har et tallbudsjett, og nye tall må fortrenge gamle.**

- KPI-rutenett: maks åtte tall. Skal noe inn, må noe ut.
- Rangert liste: ett hovedtall, ett støttetall, én pille. Ikke fire kolonner
  med tall.
- Næringskort: maks tre tall over folden. Resten under.
- Lønn vises som **ett** tall med spenn — median med 1.–9. desil — ikke
  gjennomsnitt *og* median *og* desiler som tre separate felter.

Det som fortrenges, forsvinner ikke fra basen. Det flyttes ned på siden, eller
til et panel. Databasen skal være rik; skjermen skal være rolig.

### 2.21 Firmadatabasen: hva de gjør bra, og hvor vi faktisk slår dem

Nærmeste gratis substitutt. Vurdert fra deres egne sider, siden domenet er
blokkert for direkte henting herfra.

**Hva de har:**

- Kun Brreg — Enhetsregisteret og Regnskapsregisteret, **oppdatert daglig**.
- 1 150 000 selskaper, altså hele registeret. Vi har 300 i seed.
- Omsetning og antall selskaper per bransje. Handel størst med 2 168,6 mrd.
- **20 bransjer og 117 underkategorier** — en *kuratert* NACE-gruppering, ikke
  rå koder.
- SN2025 som standard.
- Gratis, som lead-gen for Managrs betalte SaaS.

**Den ene tingen vi bør ta etter:** den kuraterte grupperingen. «96.021
Frisering og annen skjønnhetspleie» er ikke slik en bruker tenker. Vi har
`common_name` allerede, men de tolv gruppene våre bærer fortsatt SSBs
næringsnavn. Et brukervennlig toppnivå på 15–20 grupper med folkelige navn er
billig å legge til og hever hele opplevelsen.

**Hva de mangler, og som er hele grunnlaget vårt:**

De har ikke SSB. Det betyr ingen driftsmargin per region, ingen bearbeidingsverdi,
ingen sysselsetting utover det Brreg oppgir, ingen bruttoinvestering — og
avgjørende: **ingen tidsserie**, fordi Brreg bare gir siste år. De kan ikke vise
utvikling over tid uten å ha samlet snapshots selv, og det er nettopp derfor
beslutning 2.15 finnes.

De har heller ingen foretaksdemografi, altså ingen overlevelsesrater eller
konkurstetthet. Ingen score. Ingen proveniensmerking.

**Vi slår dem ikke på ferskhet eller dekning, og bør ikke prøve.** Daglige
Brreg-oppdateringer over 1,15 millioner selskaper er deres styrke. Vår er
analyselaget: margin over tid, per region, med overlevelse og en forklart score.

**Å bli billigere er trivielt** — de er gratis, og vi er gratis, se 2.19. Det
reelle spørsmålet er ikke pris men om analyselaget er verdt å bytte for. Det
avgjøres av om scoren faktisk hjelper noen ta en beslutning, ikke av hvor mange
tall vi rekker å vise.

**Åpent punkt: SN2007 mot SN2025.** Vi bygger på SN2007, som er det
strukturstatistikken bruker. Firmadatabasen oppgir SN2025. Er det en ny revisjon
SSB har tatt i bruk for nyere publiseringer, trenger `industries` et
standardversjonsfelt og en kartlegging. Må verifiseres.

---

## 3. Datamodell

### Enums

```
data_quality : mock | ssb | brreg | beregnet | ai_anslag
region_level : land | fylke | kommune
unit_type    : foretak | virksomhet
coverage     : alle | as_only
konfidens    : lav | middels | høy
mangel_arsak : ikke_publisert | konfidensielt | ikke_relevant | kommer_senere | brudd
```

`coverage` er nytt og bærer ENK-forbeholdet på raden i stedet for i en
UI-tekst. Enkeltpersonforetak leverer ikke årsregnskap og mangler derfor i
regnskapstall. En rad med `coverage = 'as_only'` skal aldri sammenlignes
ufiltrert med en rad merket `alle`.

`data_quality` beskriver radens opphav, ikke hvert enkelt felt. En SSB-rad
der `omsetning_per_enhet` er regnet ut som total delt på antall er fortsatt
`ssb`. `beregnet` er forbeholdt rader som i sin helhet er utledet fra andre
rader, slik `industry_scores` er.

`mangel_arsak` finnes fordi NULL ikke er ett svar, men fem. SSB bruker
standardtegn i tabellene: `.` for at tallet ikke kan forekomme, `..` for
manglende oppgave, `:` for at det kommer senere, og undertrykking av hensyn
til konfidensialitet. På 5-siffer NACE krysset med region vil mange celler
være undertrykt nettopp fordi det er få foretak igjen i cella.

Forskjellen er ikke akademisk. «Ikke publisert» og «skjult fordi det er for
få aktører til å oppgi tallet uten å røpe enkeltbedrifter» er to helt ulike
beskjeder til en rådgiver — den andre er i seg selv informasjon om markedet.
Derfor bærer statistikktabellene en `merknader jsonb` som kartlegger felt til
årsak, for eksempel `{"driftsmargin_pct": "konfidensielt"}`. En kolonne per
felt ville blåst opp skjemaet; ett jsonb-felt dekker alle.

### `industries`

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| nace_code | text unique | SN2007, f.eks. `96.021` |
| nace_level | int | 1–5 |
| parent_code | text fk → industries.nace_code | hierarki |
| name | text | offisiell næringsbetegnelse |
| common_name | text | folkelig navn, f.eks. «Frisørsalong» |
| slug | text unique | |
| description | text | |
| search_terms | text[] | synonymer for søk |

Hierarkiet må være komplett. Regionale rader finnes bare på nivå 2–3, så hvert
femsifrede kodepunkt trenger sine 3- og 2-siffer-forfedre i tabellen for at
regionvisningen skal ha noe å slå opp.

### `regions`

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| code | text | SSB regionkode |
| name | text | |
| level | region_level | |
| parent_code | text | |
| valid_from_year | int | |
| valid_to_year | int null | NULL = fortsatt gyldig |

Unik på `(code, valid_from_year)`.

Fylkesinndelingen har endret seg to ganger i perioden: 19 fylker til og med
2019, 11 fra 2020, 15 fra 2024. Uten årgangsfelt blir en tidsserie per fylke
stille feil. Kartet må laste GeoJSON som matcher valgt årgang.

Strukturstatistikken slutter i 2023, som er før 15-fylkesreformen. Om SSB
publiserer den på datidens inndeling eller tilbakeskriver til dagens, er ikke
verifisert — begge deler forekommer i statistikkbanken. Modellen og seed-en
antar det strengeste tilfellet, altså at hvert år bærer sin egen årgang, fordi
en frontend som takler årganger også takler en tilbakeskrevet serie. Motsatt
vei holder ikke.

Live-tellinger fra Enhetsregisteret kan uansett vises på dagens 15 fylker.
Appen må være eksplisitt om hvilken årgang som vises.

### `industry_stats`

Kjernetabellen. Én rad per næring × region × år × enhetstype.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id | uuid fk | |
| region_id | uuid fk | |
| year | int | |
| unit_type | unit_type | |
| nace_level | int | denormalisert fra industries |
| region_level | region_level | denormalisert fra regions |
| n_enheter | int | |
| omsetning_total | bigint | NOK |
| omsetning_per_enhet | bigint | |
| driftsresultat_total | bigint null | |
| driftsmargin_pct | numeric null | |
| lonnskostnad_total | bigint | |
| lonnsandel_pct | numeric | |
| sysselsatte_total | int | |
| sysselsatte_per_enhet | numeric | |
| arsverk_per_enhet | numeric | |
| bearbeidingsverdi_total | bigint | |
| verdiskaping_per_sysselsatt | bigint | |
| bruttoinvestering_total | bigint | |
| merknader | jsonb | felt → `mangel_arsak`, f.eks. `{"driftsmargin_pct":"konfidensielt"}` |
| source | text | f.eks. `SSB:12910` |
| data_quality | data_quality | |
| coverage | coverage | |

Unik på `(industry_id, region_id, year, unit_type)`.

Constraint: `CHECK (region_level = 'land' OR nace_level <= 3)`. Databasen
håndhever granularitetsregelen i stedet for å stole på at importen oppfører
seg. `nace_level` og `region_level` er derfor bevisst denormalisert — de
brukes også som peer-gruppe i scoringen.

`n_foretak` fra det opprinnelige utkastet er omdøpt til `n_enheter`, siden
`unit_type` nå avgjør hva som telles. En frisørkjede er ett foretak og ti
virksomheter; å skjule det i ett feltnavn ville gjort konkurransetetthet feil.

**Åpent punkt som må verifiseres først i `import-ssb`:** standardvariablene i
strukturstatistikken er omsetning, produksjonsverdi, bearbeidingsverdi,
bruttoinvesteringer, lønnskostnader og sysselsatte. `driftsresultat` ser ikke
ut til å inngå. Det bor sannsynligvis i statistikken «Regnskap for
ikke-finansielle aksjeselskaper», som dekker kun AS. Hvis det stemmer, kommer
`driftsresultat_total` og `driftsmargin_pct` fra et eget importløp med
`coverage = 'as_only'`, mens resten av raden er `alle`. Designet tåler begge
utfall fordi begge felter er nullable.

### `industry_demography`

Samme granularitetsregler som `industry_stats`.

| kolonne | type |
|---|---|
| industry_id, region_id, year | fk / int |
| nace_level, region_level | int / region_level |
| nyetableringer | int |
| nedleggelser | int |
| konkurser | int |
| overlevelse_1ar_pct, overlevelse_3ar_pct, overlevelse_5ar_pct | numeric null |
| merknader | jsonb |
| source, data_quality, coverage | text / enum / enum |

Unik på `(industry_id, region_id, year)`.

Overlevelsestallene kommer fra foretaksdemografi; konkurser er en egen SSB-
statistikk. To kilder inn i én tabell, skilt på `source`.

### `companies`

Kun siste tilgjengelige regnskapsår — det er alt det åpne Brreg-API-et gir.

| kolonne | type |
|---|---|
| org_nr | text unique |
| navn | text |
| nace_code, kommune_code | text |
| organisasjonsform | text |
| ansatte | int |
| omsetning, driftsresultat, egenkapital | bigint null |
| regnskapsar | int null |
| inngar_i_regnskapssnitt | boolean |
| source, data_quality | text / enum |

`inngar_i_regnskapssnitt` er avledet: sant når organisasjonsformen leverer
årsregnskap og `regnskapsar` finnes. Gjør ENK-avgrensningen etterprøvbar i
basen i stedet for å være en påstand i en UI-tekst.

### `industry_estimates`

Der statistikken tier. Egen tabell, ikke kolonner i `industry_stats`, av to
grunner: `industry_stats` skal forbli idempotent importerbar fra SSB uten at
en import stryker anslag, og anslag har sin egen livssyklus — modell,
promptversjon, konfidens, gyldighetsdato.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id | uuid fk | |
| region_id | uuid fk null | NULL = gjelder nasjonalt |
| metrikk | text | f.eks. `etableringskapital`, `sesongvariasjon` |
| verdi_num | numeric null | når anslaget er et tall |
| verdi_tekst | text null | når anslaget er kvalitativt |
| enhet | text null | `NOK`, `pct`, `mnd` |
| intervall_lav, intervall_hoy | numeric null | anslag oppgis helst som spenn |
| konfidens | konfidens | |
| begrunnelse | text | hvorfor dette anslaget |
| basert_pa | jsonb | hvilke faktiske rader anslaget hviler på |
| model, prompt_version | text | |
| generated_at | timestamptz | |
| source | text | `ai:<modell>` |
| data_quality | data_quality | alltid `ai_anslag` |

Unik på `(industry_id, region_id, metrikk)`.

Anslag oppgis som **spenn med konfidens**, ikke som ett tall, når metrikken
tåler det. «Etableringskapital 300 000–800 000, middels konfidens» er et
ærlig svar. «Etableringskapital 512 000» er det ikke.

`basert_pa` er det som skiller et anslag fra en gjetning: den skal peke på de
faktiske radene modellen fikk se. Samme prinsipp som `forklaring` i
scoringen — ingen svarte bokser.

Metrikkene er en åpen liste, ikke kolonner, nettopp fordi de vil vokse.
Startsettet: etableringskapital, typisk tid til lønnsomhet, sesongvariasjon,
kundekonsentrasjon, reguleringsbyrde, digitaliseringsgrad.

### `ai_insights`

Innsikt knyttet til tall, ikke bare en rapporttekst. Én rad per observasjon,
slik at innsikten kan vises ved siden av KPI-en den handler om, i stedet for
som en vegg av tekst nederst på siden.

| kolonne | type | merknad |
|---|---|---|
| id | uuid pk | |
| industry_id, region_id | fk | |
| year | int null | |
| type | text | `risiko`, `mulighet`, `avvik`, `sammenligning`, `kontekst` |
| tittel | text | én setning |
| body | text | |
| alvorlighet | int 1–5 | styrer rekkefølge og visuell vekt |
| referanser | jsonb | hvilke rader og felter påstanden bygger på |
| knyttet_til | text null | KPI-nøkkel, så innsikten kan ankres i UI-et |
| model, prompt_version, generated_at | text / text / timestamptz |
| data_quality | data_quality | `ai_anslag` |

`referanser` er obligatorisk. En innsikt som ikke kan peke på tallene den
bygger på, skal ikke lagres.

`ai_reports` beholdes for den lange, sammenhengende rapporten.
`ai_insights` er det korte, forankrede laget som ligger i selve dashbordet.

### `score_weights` og `score_config`

`score_weights`: én rad per delscore med vekt. Vektene skal kunne justeres
uten kodeendring.

`score_config`: enradstabell med `min_enheter` — terskelen en næring må over
for å scores i det hele tatt. Uten den styrer mikronæringer topplistene.

### `industry_scores`

| kolonne | type |
|---|---|
| industry_id, region_id, year | fk / int |
| nace_level, region_level, unit_type | peer-gruppe |
| score_lonnsomhet, score_vekst, score_risiko | int 0–100 null |
| score_konkurranse, score_kapitalbehov, score_etterspørsel | int 0–100 null |
| score_total | int 0–100 |
| forklaring | jsonb |

### `ai_reports`

`industry_id`, `region_id`, `body`, `generated_at`, `model`, `prompt_version`.

### `favorites`

`user_id`, `industry_id`, `region_id`. RLS: bruker ser kun egne rader.

---

## 4. Business Score

Implementeres som **Postgres-view**, ikke edge function. Beregningen er ren SQL
over tabeller som allerede finnes, og et view kan ikke komme ut av synk med
dataene slik en cachet funksjon kan.

Hver delscore normaliseres som persentilrangering 0–100 innenfor peer-gruppen
`(region_id, year, nace_level, unit_type)`. `nace_level` i gruppen er
nødvendig — ellers rangeres 96.021 mot aggregatet 96.0, og alle femsifrede
næringer havner i midten.

| Delscore | Beregnes fra |
|---|---|
| Lønnsomhet | `driftsmargin_pct` |
| Vekst | endring i `omsetning_total` over siste tre år |
| Risiko | invers av `konkurser / n_enheter` og `overlevelse_5ar_pct` |
| Konkurranse | `n_enheter` per 10 000 innbyggere i regionen |
| Kapitalbehov | `bruttoinvestering_total` per sysselsatt, se 2.4 |
| Etterspørsel | endring i `n_enheter` og `sysselsatte_total` |

Delscorer er nullable. Mangler `driftsmargin_pct` regionalt, er
`score_lonnsomhet` NULL der — ikke 0. `score_total` er vektet snitt over de
delscorene som finnes, med vektene renormalisert, og raden bærer hvilke som
inngikk.

`forklaring` skal inneholde råtallet, persentilen og kildereferansen per
delscore — nok til å rekonstruere resultatet uten å kjøre spørringen på nytt.
Klikk på en delscore åpner et panel som viser nøyaktig dette. Ingen svarte
bokser.

Konkurransescoren trenger folketall per region og år. Det er en egen SSB-kilde
og må inn i importen, med sin egen tabell `region_population`
(`region_id`, `year`, `innbyggere`, `source`, `data_quality`).

### Anslag går ikke inn i score_total

`industry_scores` beregnes utelukkende fra målte og utledede tall. Rader fra
`industry_estimates` inngår ikke.

Grunnen er hvem verktøyet er for. En rådgiver som sammenligner to næringer på
score må vite at forskjellen ligger i tallene, ikke i hvor selvsikker modellen
var den dagen anslaget ble generert. Blandes anslag inn, blir scoren
usammenlignbar på tvers av næringer — noen ville hvile på SSB-tall, andre på
en språkmodell, uten at rangeringen viser forskjellen.

Anslag vises ved siden av scoren, aldri inni den. Mangler en delscore
datagrunnlag, er den NULL og `score_total` renormaliseres over de som finnes.
Det er et ærligere svar enn å fylle hullet.

---

## 5. Seed-data

Det viktigste kravet: seed-dataene må ha **samme form som ekte data**, ikke
bare plausible verdier.

- nasjonale rader på nivå 2–5, regionale kun på 2–3
- `driftsresultat_total` og `driftsmargin_pct` NULL i regionale rader
- år 2017–2023, ikke ti år
- hierarkiet komplett: 60 femsifrede næringer pluss alle deres 3- og
  2-siffer-forfedre
- `regions` inneholder alle tre årgangene — 19, 11 og 15 fylker — pluss Norge
- regionale statistikkrader legges på den årgangen som gjaldt i året: 19 fylker
  for 2017–2019, 11 for 2020–2023. 15-fylkesårgangen får ingen statistikkrader,
  siden serien slutter før 2024, men finnes i `regions` fordi
  Enhetsregisterdata er live og hører hjemme der
- 300 rader i `companies`, plassert på dagens kommuner
- `industry_estimates` for de 60 femsifrede næringene, med spenn og varierende
  konfidens — ikke alle på «høy», ellers får frontend aldri testet hvordan lav
  konfidens ser ut
- `ai_insights` for de ti vanligste næringene, med utfylt `referanser` og
  `knyttet_til`, og med minst én av hver `type`, så alle varianter av
  `<InsightCard />` er dekket

En seed som er penere enn virkeligheten er verre enn ingen seed: da bygger
Lovables agent en frontend mot en form ekte data aldri vil ha, og
shell-first-premisset ryker i det første importen kjører.

Konsistenskrav: summen av regionene skal tilsvare landstallet på samme
NACE-nivå, marginer skal ligge i realistiske intervaller per bransjetype
(servering lavt, rådgivning høyt), og tidsserier skal ha realistisk støy —
ikke rette linjer.

Alle seed-rader: `data_quality = 'mock'`, `source = 'seed'`.

---

## 6. Sider

Seks sider. Ikke flere.

**Forside (offentlig).** Hero: «Finn ut hva som faktisk lønner seg å drive i
Norge».

Underteksten skal gjøre posisjoneringsarbeidet fra seksjon 0, ikke bare oppgi
dekning: at tallene allerede finnes hos Proff, Purehelp, Brønnøysund og SSB —
spredt over fire kilder, per selskap, uten sammenheng — og at dette er stedet
de er satt sammen til ett svar på bransjenivå. Dekningstallene (antall næringer,
regioner, år) hentes fra databasen og står som belegg, ikke som hovedbudskap.

Én søkeboks med autocomplete mot `industries` på `common_name` og
`search_terms`. Fire eksempel-chips (Frisørsalong, Treningssenter, Restaurant,
Regnskapsfører).

Deretter et bånd med de tre differensiatorene fra seksjon 0 — bransje ikke
bedrift, sammenstilt ikke rådata, og at vi sier hva vi ikke vet. Kort, tre
kolonner, ingen illustrasjoner.

Under det: kompakt tabell med de ti næringene med høyest score nasjonalt. Den
tabellen er beviset på påstanden over, så den skal stå nær nok å leses i samme
blikk.

**Dashboard.** KPI-rad: antall næringer dekket, antall enheter i
datagrunnlaget, median driftsmargin på tvers, median omsetning per enhet,
median antall sysselsatte. Alle med `<DataBadge />`. To grafer:
marginfordeling på tvers (histogram) og topp/bunn ti på margin (horisontalt
stolpediagram).

**Næringsside `/bransje/[slug]`.** Header med navn, NACE-kode, regionvelger og
Business Score som progresjonsring. KPI-rutenett. Grafer: omsetning og margin
over tid (linje, to akser), antall enheter og nyetableringer over tid,
konkurser per år. Fylkeskart farget etter valgt måltall, enkel GeoJSON — ikke
tredjeparts karttjeneste. Nederst: tabell med utvalgte foretak fra `companies`.

Tillegg fra beslutning 2.1: når valgt næring er femsifret og valgt region ikke
er Norge, vises nasjonale og regionale tall side om side med granularitet
påført hver verdi.

**Regionside `/region/[code]`.** Mest lønnsomme næringer, raskest voksende,
høyest konkurstetthet, og næringer med lavest foretakstetthet sammenlignet med
landsgjennomsnittet. Det siste er «hullene i markedet» og den mest verdifulle
visningen på siden.

**Topplister.** Sidens tyngdepunkt, og der referansens grep gjør mest nytte.
Tre enheter i faner, i denne rekkefølgen — næring er hovedsvaret, se 2.9:

*Næringer.* Topp 20 på samlet score, med fargestripe, margin og vekstpille.
Egne lister for beste margin, høyest vekst, best overlevelse og lavest
konkurransetetthet.

*Selskaper.* Rangert på omsetning, driftsresultat og margin, med kommune,
NACE-kode og antall ansatte. **Årstempel, ingen vekstpille** — se 2.8. ENK er
utelatt fra regnskapstall og det skal stå i UI-et, ikke bare i en fotnote.

*Kommuner.* Aggregert fra `companies`, siden strukturstatistikken stopper på
fylke. Antall selskaper, samlet omsetning, ansatte og margin. Også årstempel.

Over hver liste en filterrad: søk, region, kategori, minimum antall enheter, og
størrelsesintervall. Minimumsterskelen leses fra `score_config.min_enheter` —
uten den dominerer mikronæringer med tre foretak hele lista.

**Kategorier** vises som chips med snittmargin per hovednæring, sortert. Spennet
fra rådgivning til servering er nær åtte ganger i seed-dataene, og det er selve
spørsmålet en kjøper stiller — så det skal være synlig i første blikk framfor å
ligge bak et filtervalg.

**Favoritter og innstillinger.** Supabase auth med magic link.

**AI-analyse** ligger som seksjon på næringssiden, ikke som egen side. Det
opprinnelige utkastet listet sju overskrifter, men slo samtidig fast at det
skal være seks sider. AI-analysen er den ene som ikke fungerer frittstående —
den handler alltid om en valgt næring og region — så den foldes inn der. En edge
function henter tallene fra basen først og sender dem inn i prompten, slik at
teksten er forankret i faktiske rader. Lagres i `ai_reports` og caches. I
demoversjon: forhåndsgenerert tekst for de ti vanligste næringene.

### Delte komponenter

`<DataBadge quality={...} source={...} year={...} coverage={...} konfidens={...} />`
på hvert eneste KPI-kort og hver graf. `coverage` gjør AS-avgrensningen synlig
der tallet står; `konfidens` vises kun for `ai_anslag`.

Merkingen må være visuelt forskjellig, ikke bare tekstlig. Grå «Demo-data» for
`mock`, nøytral kildeangivelse for `ssb` og `brreg`, og en tydelig annen form
for `ai_anslag` — brukeren skal se forskjellen i periferisynet, uten å lese
badgen.

`<InsightCard />` rendrer én rad fra `ai_insights`, ankret ved KPI-en i
`knyttet_til`, sortert på `alvorlighet`. Klikk utvider `referanser` slik at
tallene bak påstanden vises.

`<Footnotes />` nederst på hver side. Samler kildene som faktisk er brukt på
den siden, med årstall, og bærer forbeholdet: at statistikk publiseres med
etterslep, at siste tilgjengelige år kan være to–tre år gammelt, at anslag er
anslag, og at ENK mangler i regnskapstall. Footnotene genereres fra radene
siden faktisk viste — ikke en håndskrevet tekst som råtner når kildene endres.

---

## 7. Design

Retningsgivende referanse: **proven-saas.com**. Se beslutning 2.7 for hvorfor,
og for hva som *ikke* skal overtas.

### Skallet

Mørk grunn nær sort med blåtone, og **store lyse kort som ligger på den mørke
grunnen**. Alterneringen er signaturen: hver seksjon leses som sitt eget
oppslag i stedet for som en rad i et uendelig dashbord. Kortradius rundt 22 px,
romslig innvendig luft.

- Aksent for positivt, en annen for negativt. Anslag har sin egen tredje
  fargefamilie — se seksjon 1.
- Geometrisk sans, tunge vekter og stram sporing i overskrifter. Tall med
  `font-variant-numeric: tabular-nums` overalt.
- Pille-knapper, fullt avrundet. Hvit pille på mørk grunn, mørk på lys.
- Ingen slagskygger. Tynne kantlinjer og flatefarge gjør jobben.
- Animasjoner under 200 ms. Skeleton-states på alle kort og grafer.
- Fullt responsivt. Mobil: rangerte rader kollapser til to linjer, kort stables.

### Datapresentasjonen — det som faktisk gjør referansen god

Fire mønstre skal gjenbrukes, i denne prioriteten:

**Rangert liste.** Plassnummer, navn med metalinje under, ett stort tall, og en
delta-pille. Dette er hovedgrepet og skal brukes til alle topplister.

**Score som femdelt fargestripe.** `score_total` (0–100) vises som fem
segmenter i rødt til grønt. Diskret framfor kontinuerlig, fordi en stripe
leses i periferisynet mens et tosifret tall må leses.

**Delta-pille.** Pill med pil og prosent, grønn opp og rød ned. Se beslutning
2.8 for når den *ikke* kan brukes.

**Sparkline med merket endepunkt.** Fylt areal, siste punkt markert og verdien
skrevet ut. Kategoriakse med første og siste år.

Dessuten: kategorichips med snittall, minibarer for delscorer, og en
filterrad med søk og nedtrekk over hver toppliste.

### Det som ikke overtas

Referansen skriver «LIVE» og «oppdatert hver time». Det kan vi ikke — SSB
publiserer årlig med ett til to års etterslep. Elementet beholdes på samme
plass i layouten, men innholdet snus: **et årstempel i stedet for et
ferskhetsløfte.** Det er et sterkere argument overfor en bank enn falsk
ferskhet ville vært.

Stack: React + TypeScript, TailwindCSS + shadcn/ui, Supabase, TanStack Query,
Recharts, Framer Motion sparsomt.

---

## 8. Forberedt for ekte data

`supabase/functions/` med tre dokumenterte edge functions:

- **`import-ssb`** — henter fra SSBs statistikkbank og skriver til
  `industry_stats`, `industry_demography` og `region_population`. Merk: SSB
  lanserte PxWebApi v2 høsten 2025 (GET-basert); v1 lever videre i en
  overgangsperiode. Velg v2.
- **`import-brreg`** — henter fra Enhetsregisteret og det åpne
  Regnskapsregisteret, skriver til `companies`. Det åpne API-et gir nøkkeltall
  fra sist innsendte årsregnskap per orgnr; tre år finnes bare i den lukkede
  delen, som krever offentlig myndighet.
- **`compute-scores`** — materialiserer `industry_scores` fra scoring-viewet.
- **`generate-insights`** — henter tallene for en næring og region fra basen,
  sender dem inn i prompten, og skriver strukturerte rader til `ai_insights`
  og `industry_estimates`. Aldri fritekst uten `referanser` eller `basert_pa`.
  Kjøres i batch, ikke i brukerflyten, og caches på
  `(industry_id, region_id, prompt_version)`.

Hver function har en kommentarblokk øverst med kilde, endepunkt og hvilke
kolonner den fyller. Import er idempotent: upsert på nøkkelen.

Ingen live API-kall i brukerflyten. All data leses fra egne tabeller.

---

## 8b. PxWebApi v2 — verifisert kontrakt

Lest ut av referanseimplementasjonen, `PxTools/PxWebApi`, ikke fra hukommelse.
SSB kjører denne koden, så endepunktene og uttrykkssyntaksen under er
autoritative. Kun SSBs egne konfigurasjonsverdier kan avvike.

### Endepunkter

| Metode | Sti | Bruk |
|---|---|---|
| GET | `/api/v2/tables?query=&pageNumber=&pageSize=` | søk og bla i tabeller |
| GET | `/api/v2/tables/{id}` | tabellens metadata i kortform |
| GET | `/api/v2/tables/{id}/metadata?lang=&defaultSelection=` | variabler og verdikoder |
| GET | `/api/v2/tables/{id}/data?valuecodes[VAR]=…` | uttrekk via query-parametre |
| POST | `/api/v2/tables/{id}/data` | uttrekk via JSON-body |

Både GET og POST finnes. Det opprinnelige utkastet forutsatte POST; det
stemmer fortsatt, men GET er ofte enklere og cachbart.

POST-body (`VariablesSelection`):

```json
{
  "selection": [
    { "variableCode": "NACE2007", "valueCodes": ["96.021"], "codelist": null },
    { "variableCode": "Tid", "valueCodes": ["FROM(2017)"] }
  ],
  "placement": { "stub": ["NACE2007"], "heading": ["Tid"] }
}
```

### Uttrykkssyntaks i `valueCodes`

Dette er den viktigste oppdagelsen for importen. Verdikoder er ikke bare
literaler:

| Uttrykk | Betydning |
|---|---|
| `*`, `?` | jokertegn |
| `TOP(n)`, `TOP(n,offset)` | de n første, med valgfritt hopp |
| `BOTTOM(n)`, `BOTTOM(n,offset)` | de n siste |
| `RANGE(a,b)` | fra a til b |
| `FROM(a)`, `TO(a)` | åpent i én ende |

`FROM(2017)` henter hele tidsserien uten å liste årstallene, og `*` henter
alle verdier på en variabel. Det gjør `import-ssb` vesentlig enklere enn om
hver kode måtte enumereres.

### Cellegrense — importen må deles opp

Referansekonfigurasjonen setter `MaxDataCells: 10000`. Et uttrekk som
overskrider grensen avvises; det trunkeres ikke.

Det betyr at et naivt uttrekk — alle næringer × alle regioner × alle år × alle
måltall — vil feile. `import-ssb` må dele opp langs en dimensjon, mest
naturlig én NACE-gruppe per kall, og skrive resultatet inkrementelt.
Idempotent upsert på nøkkelen gjør at en avbrutt import kan kjøres om igjen
uten å duplisere.

SSB kan ha satt en annen grense enn 10 000. Importen skal derfor lese
`/api/v2/config` ved oppstart og dimensjonere batchene etter den faktiske
verdien i stedet for å anta.

### Standardtegn — NULL er fem forskjellige svar

SSB fyller ikke tomme celler med tomhet. De bruker standardtegn: `.` for at
tallet ikke kan forekomme, `..` for manglende oppgave, `:` for at det
publiseres senere, `-` for ekte null, `0` for mindre enn en halv enhet, `*`
for foreløpige tall, og egne markører for brudd i tidsserien. I tillegg
undertrykkes celler av hensyn til konfidensialitet.

Importen må oversette disse til `NULL` **pluss** en `mangel_arsak` i
`merknader`. Et tall som er skjult fordi næringen har for få aktører i fylket
er ikke det samme som et tall SSB ennå ikke har publisert, og en `-` er ikke
et hull i det hele tatt — det er et ekte null som skal vises som 0.

Dette er den enkeltfeilen som ville vært lettest å gjøre og vanskeligst å
oppdage senere: leser man standardtegnene som manglende data, blir ekte
nulltall borte, og undertrykte celler ser ut som datahull.

### Rate limiting

SSB advarer eksplisitt mot for hyppige kall og svarer med `429`. Ved
publisering klokka 08.00 risikerer storforbrukere å få IP-en blokkert.

`import-ssb` skal derfor kjøre med respekt for `Retry-After`, eksponentiell
backoff på `429`, og planlegges utenfor publiseringsvinduet om morgenen.
Importen er uansett en batch-jobb som kjøres sjelden, ikke noe som treffes fra
brukerflyten.

### Tabellsøk

`/api/v2/tables?query=` bruker Lucene-syntaks: fraser i hermetegn, `title:`
for å begrense til tabelltittel, `AND`/`OR`/`NOT`, `*` og `?` som jokertegn,
og `~n` som nærhetsoperator. Nyttig for å finne riktige tabell-ID-er
programmatisk i stedet for å hardkode dem — men ID-ene bør uansett festes i
konfigurasjon når de først er funnet, så importen ikke bytter kilde av seg
selv.

### Fortsatt uverifisert

Kontrakten over er sikker. Hvilke *variabler* de enkelte tabellene tilbyr —
altså om 12936 har `driftsresultat` og `bruttoinvestering`, om `arsverk`
finnes — avgjøres av tabellene, ikke av API-et. Det svares av et
`GET /api/v2/tables/12936/metadata`, som må være første kall importen gjør.

Fylkesårgangene har derimot fått et delvis svar: SSB publiserer en egen
oversikt over «tabeller som bruker ny regioninndeling også for årene før
2024», altså tilbakeskrevne serier. Noen tabeller er tilbakeskrevet, andre
ikke. Importen må slå opp den aktuelle tabellen der før den avgjør hvilken
årgang radene hører til. Modellens strengeste antakelse — at hvert år bærer
sin egen årgang — står ved lag inntil dette er sjekket per tabell, siden den
takler begge utfall.

---

## 9. Overlevering til Lovable

1. Opprett Supabase-prosjekt for Bransjeindeks. Brukeren har i dag kun
   `ScripturePath`.
2. Kjør migrasjoner og seed mot den basen herfra.
3. Opprett Lovable-prosjekt, koblet til samme Supabase — ikke Lovable Cloud.
4. `set_project_knowledge` med invariantene: DataBadge på hvert tall, ingen
   hardkodede verdier, NULL rendres som «ikke publisert», TanStack Query mot
   basen, aldri sammenligne `as_only` med `alle` uten merking, `ai_anslag` i
   visuelt annen form enn målte tall, og `<Footnotes />` generert fra radene
   siden faktisk viste.
5. Én `send_message` per side, i rekkefølge, med skjemaet som kontrakt.

---

## 10. Ikke gjør

- Ikke plasser anslag i `industry_stats`. De hører hjemme i
  `industry_estimates`, med egen merking. Et anslag som deler kolonne med et
  SSB-tall er umulig å skille fra det senere.
- Ikke la anslag inngå i `score_total`. Se 4.
- Ikke lagre en innsikt uten `referanser`, eller et anslag uten `basert_pa`.
- Ikke oppgi et anslag som ett presist tall når metrikken tåler et spenn.
- Ikke bland enkeltpersonforetak og aksjeselskaper i samme snitt uten å merke
  det. `coverage` finnes for dette.
- Ikke hardkod tall i komponenter.
- Ikke bygg innlogging bak alt — næringssidene er offentlige.
- Ikke lag flere sider enn de seks.
- Ikke fyll NULL med 0.

Merk: «median lønn til eier» og «typisk etableringskapital» sto tidligere på
denne lista fordi de ikke finnes i noen kilde. De er nå tillatt — som rader i
`industry_estimates` med konfidens og begrunnelse, aldri som kolonner i
statistikktabellene.

---

## 11. Åpne punkter

| Punkt | Håndtering |
|---|---|
| **SN2007 eller SN2025?** | Vi bygger på SN2007. Firmadatabasen oppgir SN2025. Er det en revisjon SSB har tatt i bruk, trenger `industries` et versjonsfelt og en kartlegging mellom standardene. Verifiser mot SSBs klassifikasjonsside. |
| **Finnes lønn per næring, med desiler, per fylke?** | Beslutning 2.18 forutsetter gjennomsnitt, median og desiler per næring. Yrkestabellen 11418 har `statistikkmål`; det må bekreftes at næringstabellene har det samme, og hvilken regional granularitet de har. |
| **Har tabell 08143 driftsmargin per kommune og fylke?** | **Høyest prioritet.** Markedsresearch tyder på at SSB publiserer driftsmargin brutt ned på bransje, kommune og fylke for ikke-finansielle aksjeselskaper. Stemmer det, er 2.1 for pessimistisk og kommunetall trenger ikke bygges nedenfra. Kilden er søketreff, ikke tabellen selv — ssb.no var blokkert. Verifiser med `GET /api/v2/tables/08143/metadata` før noe annet. Merk at dekningen i så fall er `as_only`. |
| Har den regionale SSB-tabellen `driftsresultat`? | Verifiseres først i `import-ssb`. Begge felter nullable, så designet tåler begge utfall. |
| Publiseres 2017–2023 på datidens fylkesinndeling eller tilbakeskrevet til dagens 15? | Modellen antar det strengeste tilfellet. Verifiseres i `import-ssb`. |
| Finnes `arsverk_per_enhet` i strukturstatistikken? | Usikkert — `sysselsatte` er sikker, årsverk ikke. Nullable; droppes hvis den ikke finnes. |
| Finnes `bruttoinvestering` i den regionale SSB-tabellen? | Kreves nå av `score_kapitalbehov`. Nullable; delscoren blir NULL regionalt hvis ikke. |
| Folketall per region og år | Fjerde SSB-kilde, kreves av konkurransescoren. |
| `data.ssb.no` er blokkert i utviklingscontaineren | Påvirker ikke edge functions, som kjører på Supabase. Betyr at API-formen ikke kan valideres lokalt. |
