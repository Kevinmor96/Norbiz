# Maktkart — prosjektkunnskap for Lovable

Lim inn denne teksten som prosjektkunnskap i Lovable. Reglene er bindende for hele
appen og overstyrer Lovables standardvalg. Fullversjonene står i `CLAUDE.md`
og `DESIGN.md` i repoet.

## Hva appen er

Maktkart svarer på spørsmålet **hvem bestemmer i kommunen?** Den viser organene,
rollene og pengene i en kommune, og hvordan de henger sammen. Hver påstand har
kilde og dato. Tromsø er først ute, og siden er én mal for alle kommuner.

## Data

- **Basen er ferdig.** Ikke aktiver Lovable Cloud. Ikke opprett, endre eller
  slett tabeller, og ikke kjør migrasjoner. Skjemaet ligger i `supabase/migrations/`
  i repoet og endres bare der.
- **All lesing går gjennom RPC-ene** i `src/lib/data/`. Metodene er kommuner,
  kommune_oversikt, beslutningskjede, organkart, organ_profil, eierskap,
  nettverk, endringer, organer_for_segment og hull. Ikke les tabellene direkte,
  og ikke regn summer, medianer eller tellinger i klienten. PostgREST kapper ved
  1 000 rader, og tallet blir feil uten at noen merker det.
- **Personvernet håndheves i basen** med RLS. Ikke lag filtre i UI-et som skal
  «skjule» personer. De er allerede skjult der de skal være det.

## Reglene som ikke skal brytes

1. **Institusjon først.** En person vises bare gjennom en rolle i et organ. Appen
   har ingen personbilder, ingen avatarer, ingen personprofilsider og ingen
   topplister over mennesker. I nettverket er organet noden og personen kanten.
2. **Hver påstand har kildemerke.** Bruk komponenten `Kildemerke`, eller
   `Pastand` og `MedMerke`, på hvert tall, navn og hver dato fra data. Ikke lag
   et nytt merke.
3. **Tre grader, tre former.** Fylt sirkel er verifisert, ring med prikk er
   oppgitt, og åpen trekant er må verifiseres. Ikke skill dem bare med farge.
4. **Forhåndsversjonen står synlig** til basen har verifiserte rader. Den står i
   topplinjen på skrivebord og i bunnlinjen på mobil.
5. **Ingen ferskhetspåstander.** Ordene «LIVE», «sanntid», «oppdatert daglig» og
   «i dag» skal ikke brukes. Skriv «sammenstilt {dato}».
6. **Et tall har år.** Morselskap og konsern merkes der kilden skiller dem.
   Planlagte hendelser er ikke skjedd, og de har egen stil.
7. **Ingen sammensatt maktscore** og ingen rangering av organer etter en score.
8. **Malen vet ikke at den handler om Tromsø.** All tekst om kommunen, personer,
   organer og tall kommer fra data. Tomme tilstander er designet.
9. **Fritekst fra data går gjennom `lesbar()`**, slik at «[verifiser]» aldri når
   leseren.

## Design

- **Retningen er kartografisk.** Kommunen er et kartblad. Tokenene står i
  `src/styles.css`, og du skriver aldri hex i komponenter.
- **Én font:** Archivo med variabel bredde, selvhostet. Ikke legg til Google
  Fonts eller andre tredjepartsressurser.
- **Radius 0 overalt.**
- **Fargene har én jobb hver:**
  - signal betyr beslutningskjede og fokus, aldri flater
  - vann betyr penger og eierskap
  - kote betyr uetterprøvd
- **Bevegelse har en jobb** og kjøres én gang. Alt er synlig i ro.
  `prefers-reduced-motion` gir statiske tilstander.
- **Mobil først, 390 px.** Kjeden, nettverket og tidslinjen har egne mobilformer.

## Tekst

- Norsk bokmål, kort og direkte.
- Skriv fra leserens side: «Hvem bestemmer en reguleringsplan?»
- Aldri «Maktkart har sjekket». Vi har sammenstilt, ikke revidert.
- Skjemaer har ærlige kvitteringer. Er skjemaet ikke koblet til basen, står det at
  noe ikke lagres.
