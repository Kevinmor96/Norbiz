Bygg næringssiden på `/bransje/[slug]`. Bruk `industries.slug` som nøkkel.

Følg den visuelle retningen i prosjektkunnskapen. Siden er et oppslag: mørk
grunn, og innholdet i store lyse kort som hver leses for seg.

**Men dette er rådgiverflaten, ikke en poengtavle.** Rett under headeren, før
KPI-rutenettet, skal det stå en kort «dette bør du vite»-stripe med det som kan
svekke konklusjonen: hvor mange celler som er undertrykt, hvilke anslag som har
lav konfidens, og om delscorene er uenige — altså om spredningen mellom dem er
stor. En rådgiver som skal si noe til en kunde trenger forbeholdene først.

**Viktig om hvordan den skal degradere.** Forbeholdene er ujevnt fordelt i basen:

| | |
|---|---|
| Næringer med undertrykte celler | **12 av 65** |
| Næringer med anslag | 65 av 65 (alle) |
| Anslag med lav konfidens | 50 av 195 |
| Næringer med AI-innsikt | **bare 10 av 65** |

For de fleste næringene har stripen altså lite eller ingenting å melde. Da skal
den si det rolig — «ingen undertrykte celler for denne næringen» er informasjon,
ikke tomhet. Ikke skjul stripen, og ikke finn på et forbehold for å fylle den.

Ved Business Score skal peer-gruppen og dekningsgraden stå: «rangert mot N
andre femsifrede næringer, 2023» og «bygget på N av 6 delscorer». Vis også de
to svakeste delscorene der, uten klikk.

Header med navn, NACE-kode, regionvelger (Norge pluss fylkene som gjaldt i
valgt år) og Business Score som progresjonsring.

KPI-rutenett: omsetning per enhet, driftsresultat, driftsmargin, lønnsandel,
sysselsatte per enhet, verdiskaping per sysselsatt, antall enheter, 5-års
overlevelse.

Er valgt næring femsifret og valgt region ikke Norge, finnes det **ingen**
regional rad — det er en garanti fra databasen, ikke et tilfeldig hull. Vis da nasjonale og regionale tall side om side med granularitet påført
hver verdi.

Grafer: omsetning og margin over tid med to akser, antall enheter og
nyetableringer over tid, konkurser per år.

Fylkeskart farget etter valgt måltall. Bruk en enkel GeoJSON som matcher
årgangen for valgt år — ikke en tredjeparts karttjeneste.

Vis de seks delscorene som minibarer med tall, og `score_total` som femdelt
fargestripe ved siden av progresjonsringen.

Klikk på en delscore åpner et panel som viser `forklaring`-jsonb: råtallet,
persentilen og vekten per delscore, med kilde. Ingen svarte bokser.

Seksjon for anslag fra `industry_estimates`: vis som spenn med konfidens, i
tydelig annen visuell form enn de målte KPI-ene.

Seksjon for innsikt fra `ai_insights`, sortert på alvorlighet, ankret ved
KPI-ene de gjelder.

`ai_insights` dekker bare ti av 65 næringer. De øvrige 55 skal ikke få en tom
seksjon uten forklaring, og de skal absolutt ikke få en generert tekst som later
som den er en vurdering. Skriv rett ut at det ikke foreligger noen AI-vurdering
for denne næringen ennå — samme regel som for NULL i en celle: si hva du ikke har.

Nederst en tabell med utvalgte foretak fra `companies`: navn, kommune, ansatte,
omsetning, driftsresultat, regnskapsår.

Merk tydelig i UI-et — ikke bare i en fotnote — at enkeltpersonforetak mangler
regnskapstall fordi de ikke leverer årsregnskap. `inngar_i_regnskapssnitt`
avgjør hvem som er med. Ingen vekstpille på en selskapsrad: Brreg gir bare siste
innsendte år, så raden får et årstempel.

## Lønn — ett tall med spenn

Fra `industry_wages`: median med 1.–9. desil. **Målte desiler, ikke anslag** —
ikke merk det som anslag.

Lønnsserien går 2015–2025 mot statistikkens 2017–2023, så sett eget årstempel på
lønnstallet. Ikke la de to seriene se ut som samme periode.

Har næringen en rad med `yrke_kode` satt (48 slike rader finnes), vis
yrkeslønnen ved siden av næringssnittet — men merk at koblingen NACE-til-yrke er
vår vurdering, ikke SSBs. De radene er `data_quality = 'beregnet'`.
