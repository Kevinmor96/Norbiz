Bygg næringssiden på `/bransje/[slug]`.

Følg den visuelle retningen i prosjektkunnskapen. Siden er et oppslag: mørk
grunn, og innholdet i store lyse kort som hver leses for seg.

**Men dette er rådgiverflaten, ikke en poengtavle.** Rett under headeren, før
KPI-rutenettet, skal det stå en kort «dette bør du vite»-stripe med det som kan
svekke konklusjonen: hvor mange celler som er undertrykt, hvilke anslag som har
lav konfidens, og om delscorene er uenige — altså om spredningen mellom dem er
stor. En rådgiver som skal si noe til en kunde trenger forbeholdene først.

Ved Business Score skal peer-gruppen og dekningsgraden stå: «rangert mot N
andre femsifrede næringer, 2023» og «bygget på N av 6 delscorer». Vis også de
to svakeste delscorene der, uten klikk.

Header med navn, NACE-kode, regionvelger (Norge pluss fylkene som gjaldt i
valgt år) og Business Score som progresjonsring.

KPI-rutenett: omsetning per enhet, driftsresultat, driftsmargin, lønnsandel,
sysselsatte per enhet, verdiskaping per sysselsatt, antall enheter, 5-års
overlevelse.

Er valgt næring femsifret og valgt region ikke Norge, finnes det ingen regional
rad. Vis da nasjonale og regionale tall side om side med granularitet påført
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

Nederst en tabell med utvalgte foretak fra `companies`: navn, kommune, ansatte,
omsetning, driftsresultat, regnskapsår. Merk tydelig at ENK mangler
regnskapstall.
