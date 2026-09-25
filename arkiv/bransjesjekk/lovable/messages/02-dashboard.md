Bygg dashboardet. Egen rute, lenket fra toppnavigasjonen.

## KPI-rad

Fem kort, hvert med `<DataBadge />`: antall næringer dekket, antall enheter i
datagrunnlaget, median driftsmargin på tvers, median omsetning per enhet, median
antall sysselsatte.

**Bruk kun nasjonale rader med `unit_type = 'foretak'` for marginene**, siden
regionale rader ikke har driftsmargin i det hele tatt — de er NULL der, ikke 0.
Tar du med regionale rader i en median, regner du på et utvalg som mangler halve
grunnlaget.

Medianen skal regnes i databasen med `percentile_cont`, ikke i JavaScript etter å
ha hentet 4 943 rader.

## To grafer

1. **Marginfordeling på tvers av næringer** som histogram. Ett år, nasjonalt,
   foretak, NACE-nivå 5. Bøtter på to prosentpoeng.
2. **Topp og bunn ti på margin** som horisontalt stolpediagram, med et tydelig
   skille mellom de to endene.

Begge med `<DataBadge />` og skeleton-state.

## Informasjonsbudsjettet gjelder

Maks åtte tall i KPI-rutenettet — fem er nok her. Ikke legg til en tredje graf
fordi et felt finnes i basen.

## Et forbehold som hører hjemme her

Dashboardet er den flaten der det er lettest å vise et snitt som ser mer solid ut
enn det er. Skriv ved medianene hvor mange næringer de er regnet over, og at
næringer med under `score_config.min_enheter` enheter ikke har score — det
gjelder 50 av 4 943 rader i denne basen. Hent tallet fra basen.

Til slutt `<Footnotes />`.
