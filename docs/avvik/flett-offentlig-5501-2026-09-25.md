# Fletting av offentlig ledelse inn i Tromsø-datasettet (5501)

Flettet 25.09.2026. Inn: `offentlig-5501.json` med rapport (182 lederroller
hentet 25.09.2026 fra organenes egne sider og data.stortinget.no, alle
`oppgitt`), `src/data/tromso.json` (grunnlag og Brreg-import) og
`docs/avvik/brreg-5501-2026-09-25.md`. Ut: `src/data/tromso.json`, en ny
avviksrapport fra importøren og denne rapporten. Hver konflikt og hvordan den
er løst, står under. Personer som kan være den samme, står samlet til slutt,
til menneskelig vurdering.

## Kort

| | Før | Etter |
|---|---:|---:|
| Organer | 335 | 344 |
| Personer | 878 | 960 |
| Roller | 1 045 | 1 180 |
| Relasjoner | 130 | 138 |
| Hendelser | 23 | 24 |
| Hull | 83 | 71 |
| Kilder | 37 | 78 |

- **Roller fra staging (182):** 23 fantes allerede og er slått sammen med
  grunnlagets rad (regel 2). 157 er lagt til. 2 er ikke lagt til: én er
  utenfor avgrensningen (regel 7), og én er holdt tilbake av personvernhensyn
  (se «Anni Skogmann» under).
- **Nye organer (10):** Miljø-, idrett-, kultur- og
  samfunnsutviklingsutvalget, fire hovedutvalg i Troms fylkeskommune, Nord
  statsadvokatembete, Nord-Troms jordskifterett (erstatter «Hålogaland
  jordskifterett»), Kystverket, Hæren og Nærings- og fiskeridepartementet.
  Helse Nord IKT fantes fra før som importørens organ og er gjort til en
  grunnlagsrad (se regel 1).
- **Personer:** 82 nye. 21 staging-personer hadde samme nøkkel som en person
  importøren allerede hadde lagt inn. Staging-personen `tom-robert-elvebu` er
  lagt på den eksisterende nøkkelen `tom-robert-lilletun-elvebu`.
- **Kilder:** 41 av 43 staging-kilder er lagt til. `politiet-no-troms-organisering-og-ledelse`
  og `unn-no-styret` er med selv om radene deres var verifisert mot Brreg fra
  før: merknadene «Også oppført på politiet.no» og «Også oppført på unn.no»
  viser til dem, slik de seks sidene registeret bekreftet ved ny kjøring, også
  står. Utelatt er `tromsfylke-no-kontrollutvalget` og
  `tromsfylke-no-partier-og-representanter`, som bare ligger bak to hull.

## Regel 1: plassering, og hva en ny kjøring av importøren gjør

**Hvordan importøren kjenner sine egne rader.** En rad er importørens når
belegget er `verifisert` fra `enhetsregisteret`, `brreg-roller` eller
`regnskapsregisteret`, og merknaden ikke begynner med «Bekrefter grunnlaget»
(`scripts/brreg/importer.ts`, `erEid`/`erGenerert`). Alt annet er grunnlag, og
det endres bare når registeret bekrefter det. Alle radene som er lagt til, er
`oppgitt` fra offisielle sider eller fra data.stortinget.no. De er ikke
`verifisert`: pipelinen har ikke hentet dem. Hver rad står sist i grunnlagets
del av sin liste, foran importørens rader.

**Ny kjøring, simulert.** `kjor()` fra `scripts/brreg.ts` er kjørt på det
flettede datasettet mot en kopi av mellomlageret
(`node_modules/.cache/maktkart-brreg/`, hentet 2026-09-25). Det ekte
mellomlageret er ikke rørt. Resultatet er tatt inn som det flettede
datasettet. En ny kjøring på resultatet gir byte-lik `tromso.json` og byte-lik
avviksrapport. Datasettet står altså stille under importøren. Ingen rad som er
lagt til, blir slettet eller doblet.

Kjøringen gjorde to ting med datasettet:

1. **8 bekreftelser.** Registeret bekreftet 8 av de nye radene. De er nå
   `verifisert` med «Bekrefter grunnlaget (<siden>, per 2026-09-25)». Det
   gjelder toppleder i Fiskeridirektoratet, Mattilsynet, Arbeidstilsynet,
   Statens vegvesen, Havforskningsinstituttet, Helse Nord RHF og Helse Nord
   IKT, og styreleder i Helse Nord RHF. Importørens egne 8 rader for de samme
   personene (7 daglig leder og 1 styreleder) er borte, fordi de ellers ville
   vært dobbelt.
2. **14 registerroller holdt tilbake.** 12 personer fra staging har samme
   navn som en registerperson, men uten et felles organ. Importøren holder
   rollene til en slik navnebror tilbake til et menneske har avgjort saken
   (`docs/brreg-import.md`, «Et navn alene slår aldri sammen to personer»).
   Før flettingen sto registerrollene på samme nøkkel som staging-personen.
   Det var en sammenslåing på navn som importøren ikke godtar, og den ville
   blitt opphevet ved neste kjøring. Personene og kommandoene står i avsnitt
   C under.

**Kall utenfor mellomlageret (7).** Fem nye organer uten orgnr slås opp på navn
i Enhetsregisteret: Nord statsadvokatembete, Nord-Troms jordskifterett,
Kystverket, Hæren og Nærings- og fiskeridepartementet. Simuleringen svarte
«ingen treff». En ekte kjøring med nett slår dem opp. Et treff kobler organet
til registeret og kan bekrefte eller legge til registerroller, men kan ikke
slette våre rader. De to andre kallene er regnskap som Brreg svarte med feil
på ved første henting, og som ikke ble lagret.

**Helse Nord IKT.** Staging-organet `helse-nord-ikt` hadde samme nøkkel som
importørens organ, Helse Nord IKT HF (918177833). En grunnlagsrolle på et
organ importøren eier, blir hengende hvis organet faller ut av utvalget.
`tests/brreg-import.test.ts` avdekket det, og kjøringen stoppet. Organraden er
derfor gjort til en grunnlagsrad, slik `docs/brreg-import.md` beskriver det
(«bytt belegget, så blir den en grunnlagsrad»). Beskrivelsen er fra
helse-nord.no. Orgnr, kommunenummer og stiftelsesdato er fra
Enhetsregisteret. Med orgnr er organet alltid med i importen.

**Endringer i importøren**, med tester i `tests/brreg-import.test.ts`:

- En grunnlagsrad merket `motsagt` står som motsagt. Rapporten sier «Merket
  motsagt i datasettet». Bekrefter registeret raden senere, tas merket bort.
- Toppleder, sorenskriver, lagmann og embetsleder i statlige
  forvaltningsorganer (organisasjonsform ORGL eller STAT) regnes ikke lenger som
  motsagt når registerets daglig leder er en annen person. I foretak (AS, KF,
  IKS, HF og RHF), kommuner og fylkeskommuner er topplederen registerets daglig
  leder etter loven, og der er en annen daglig leder fortsatt et avvik. Det samme gjelder
  et styreverv i et organ uten styre i registeret. De meldes under en ny
  overskrift, «Roller registeret ikke fører (ikke avvik)», og telles ikke som
  avvik.

Endringene trengs ikke for å beskytte radene som er lagt til. De trengs for
regel 8: avviksrapporten er generert og ville ellers kalt disse radene
motsigelser igjen ved neste kjøring.

## Regel 2: roller som fantes fra før (23)

Grunnlagets rad er beholdt. Radene som ikke var verifisert, har fått den
offisielle siden som kilde, `per` 2026-09-25 og merknaden «Bekreftet av
<domene> 25.09.2026. Opprinnelig fra researchgrunnlaget.», med grunnlagets
merknad etter. **Fem rader var allerede verifisert mot Brreg.** Der står
registerbelegget, fordi det er høyere enn en offisiell side. Merknaden har
fått en setning om siden.

| Rolle | Løsning |
|---|---|
| tromso-kommunestyre / gunnar-wilhelmsen / ordfører | **Datoene var ulike.** Ordførersiden sier «ordfører siden 16. oktober 2019», mens grunnlaget hadde 11.10.2023, datoen for gjenvalget. `fra` er satt til 2019-10-16, og merknaden forklarer hvorfor. Kilde: tromso-kommune-no-ordforer. |
| tromso-kommunestyre / sigrid-hammer / varaordfører | Kilde: ordførersiden. Siden oppgir ingen startdato, og merknaden sier at 11.10.2023 er fra grunnlaget. Navnet er rettet, se regel 4. |
| tromso-formannskap / gunnar-wilhelmsen / leder | Kilde: tromso.digdem.no (utvalgsportalen). |
| tromso-kommune-administrasjonen / ellen-beate-lundberg / kommunedirektør | Allerede verifisert. Merknaden har fått «Også oppført på tromso.kommune.no 25.09.2026». |
| troms-fylkesting / benjamin-nordberg-furuly / fylkesordfører (fungerende) | Kilde: fylkesordførersiden. Samme status og samme `til_forventet` (2027-01). |
| troms-fylkesting / eirik-losnegaard-mevik / fylkesvaraordfører | Kilde: fylkesordførersiden. |
| troms-fylkeskommune-administrasjonen / camilla-bjorn / fylkeskommunedirektør | Allerede verifisert. Siden er nevnt i merknaden. |
| statsforvalteren-troms-og-finnmark / runar-sjastad / statsforvalter | Kilde: «Vår statsforvalter». Samme `fra` (2025-08). |
| statsforvalteren-troms-og-finnmark / katrine-storeheier / ass. statsforvalter | Kilde: organisasjonskartet. Kartet oppgir ingen dato, og merknaden sier at 2025-04 er fra grunnlaget. |
| troms-politidistrikt / astrid-elisabeth-nilsen / politimester | Allerede verifisert. politiet.no er nevnt i merknaden. |
| unn / david-johansen / adm. dir. | Allerede verifisert. Tittelen er nå den offisielle, «Administrerende direktør». |
| unn / einar-bugge / viseadm. dir. | Kilde: unn.no. Belegget går fra `maa_verifiseres` til `oppgitt`, og tittelen er nå «Viseadministrerende direktør». |
| unn / anders-mohn-frafjord / styreleder | Allerede verifisert. Merknaden sier at styret er oppnevnt for 2026–28. Grunnlagets «per 2024, [verifiser]» er dermed løst. |
| uit / dag-rune-olsen / rektor | Kilde: uit.no. Merknaden sier at `fra` 2021 er fra grunnlaget, som ikke oppgir kilde. |
| uit / rikke-gurgens-gjaerum, jorgen-berge, jorgen-fossland | Kilde: uit.no. Titlene er nå de offisielle: «Prorektor for utdanning (rektors stedfortreder)» og «Prorektor for forskning og utvikling». |
| stortinget-troms-valgkrets / 6 representanter | Kilde: data.stortinget.no. **Cecilie Myrseth** har nå status `permisjon`: hun står ikke blant dagens representanter og er næringsminister ifølge regjeringslisten. Staging-rapporten sa at datasettet hadde `til: 2029`. Det stemmer ikke: datasettet hadde allerede `til_forventet: 2029`, så ingenting er endret der. |

En staging-rolle hadde samme organ, person og rolletype som en rad bare
importøren hadde: styreleder i Helse Nord RHF. Den er lagt til som
grunnlagsrad. Ved ny kjøring bekreftet registeret den, og importørens rad
forsvant. Det er én rad igjen.

## Regel 3: utdaterte organer i grunnlaget

| Organ | Løsning |
|---|---|
| Statsadvokatene i Troms og Finnmark | `status: nedlagt`. Relasjonen `erstattet_av` peker til det nye organet **Nord statsadvokatembete**, som har embetslederen fra riksadvokaten.no. Kilden for endringen er riksadvokaten.no. Grunnlagets belegg står, og merknaden forklarer endringen. `gyldig_til` er ikke satt, fordi oversikten ikke har noen dato. Et nytt hull sier at datoen mangler. Det gamle hullet («Førstestatsadvokaten er ikke navngitt») er fjernet. |
| Hålogaland jordskifterett | **Erstattet av Nord-Troms jordskifterett**, på samme plass og med samme segment. Navnet i grunnlaget var feil. Organet er ikke ført som nedlagt og har ingen historikk. Merknaden sier hva grunnlaget kalte retten. Hullet om lederen er fjernet, fordi lederen nå er navngitt. |
| Kystverket Troms og Finnmark | `status: nedlagt`. Relasjonen `erstattet_av` peker til det nye organet **Kystverket**. Kilden er Kystverkets organisasjonskart for 2026, som ikke har noen dato, så `gyldig_til` er ikke satt. Grunnlagets belegg står. Hullet om regiondirektøren er erstattet av et hull om at datoen mangler. |
| Mattilsynet, Fiskeridirektoratet og Skatteetaten | **Satt ikke til nedlagt.** I grunnlaget er disse organene selve etaten, koblet til etatens orgnr i Brreg. De er ikke regionkontorer. Det var bare beskrivelsen som viste til «region Nord». Etatene finnes, så `nedlagt` ville vært feil. Beskrivelsene er rettet, og merknaden peker til etatens side. Hullet «Regionlederen/Regiondirektøren er ikke navngitt» er erstattet av staging-hullet om at regionen ikke finnes. For **Mattilsynet** oppgir siden en dato, og det er lagt til en hendelse: 2025-05-01, «Mattilsynet legger ned de fem geografiske regionene», med kilde mattilsynet.no. For Fiskeridirektoratet og Skatteetaten oppgir sidene ingen dato. Der er det verken satt dato eller laget en hendelse. |

## Regel 4: navn og nøkler

- `sigrid-hammer` heter nå «Sigrid Bjørnhaug Hammer», slik tromso.kommune.no
  og tromso.digdem.no skriver det. Nøkkelen er uendret. Hendelsen om
  konstitueringen 11.10.2023 bruker også den fulle formen.
- `benjamin-nordberg-furuly` beholder navnet. Representantlisten skriver
  «Benjamin Nordberg Furuly», mens fylkesordførersiden skriver «Benjamin
  Furuly».
- `tom-robert-elvebu` (helsenordikt.no: «Tom Robert Elvebu») er lagt på den
  eksisterende nøkkelen `tom-robert-lilletun-elvebu`, med registerets fulle
  navn. Importøren kobler dem uansett, fordi de har samme organ og navnet
  passer. Registeret bekreftet rollen.
- Staging-personene med samme nøkkel og navn som en eksisterende person er
  gjenbrukt. Se avsnitt C og D under.

## Regel 5: styringsmodellen i Troms fylkeskommune

Hullet «Styringsmodellen er uavklart …» er fjernet. `troms-fylkeskommune` har
fått denne setningen i beskrivelsen: «Styres etter formannskapsmodellen:
fylkesordføreren leder fylkestinget og fylkesutvalget.» Merknaden i belegget
siterer fylkesordførersiden (tromsfylke.no/politikk/fylkesordforer/,
25.09.2026): «Troms fylkeskommune styres etter formannskapsmodellen, hvor
fylkesordføreren er den valgte lederen av fylkestinget.» Den sier også at
medieomtalen ved konstitueringen i 2023 omtalte et fylkesråd og en
fylkesrådsleder, mens fylkeskommunens egne sider har ingen av delene.

## Regel 6: partikoder

Hele datasettet bruker nå én ordning: Ap, H, FrP, SV, Sp, R, V, KrF og MDG, og
lokallistene slik kilden skriver dem (INP, ByLa, NBT). Sametinget har NSR.
Sju roller i Tromsø kommune hadde «Rødt» fra utvalgsportalen og har fått «R».
Grunnlaget og Stortinget brukte allerede R. Rødt er fortsatt nevnt ved navn i
én hendelsestekst om byrådsdebatten. Det er løpende tekst, ikke en partikode.

## Regel 7: avgrensning

- **Utelatt:** «Seksjonssjef, Transport nord» i Statens vegvesen (Ine Hilling),
  fordi det er en mellomleder. Personen er heller ikke lagt til.
- **Med:** UNNs 8 klinikkledere og 4 senterledere (`seksjonsleder`), fordi de
  sitter i ledergruppen til administrerende direktør.
- Staging hadde ikke med kommunikasjonsstab eller andre mellomledere.

## Regel 8: Brreg mot grunnlaget

**Motsagte registerroller (5).** Registeret har forrang for roller det selv
fører. Radene er merket `"motsagt": true`. Merknaden begynner med «Motsagt av
Brreg 25.09.2026:», og grunnlagets merknad står etter. `til` er ikke satt,
fordi vi ikke vet når rollen eventuelt sluttet. Rollene er ikke aktive, men
står i historikken.

| Rolle i grunnlaget | Registeret (25.09.2026) |
|---|---|
| macks-olbryggeri / Roger Karlsen / daglig leder («Adm. dir.», Godt Drikke) | En annen person er daglig leder, den samme som grunnlaget sier har gått av. Godt Drikke kan være foran registeret, eller han kan være adm. dir. uten å være registrert daglig leder. Hullet om skiftet står. |
| remiks-miljopark / Tone Marie Myklevoll / styreleder | En annen person er styreleder. Registeret har en Tone Marie Myklevoll som styreleder i Tromsøbolig KF. Hun er holdt tilbake som navnebror, se F. |
| sparebank-1-nord-norge / Kathrine Tveiterås / nestleder | Ingen nestleder er registrert. Hun står som styremedlem. |
| troms-kraft / Kathrine Tveiterås / nestleder | Ingen nestleder er registrert. Hun står som styremedlem. |
| tromso-havn-kf / Kjell-Are Vassmyr / styremedlem | Han står som styreleder, ikke som styremedlem. |

Datamodellen hadde ingen måte å føre en rolle som motsagt uten sluttdato.
Feltet er lagt til: `motsagt?: boolean` i `Rolleinnehav` og `motsagt:
boolean` i `Rolle`. `erAktiv` i `lokal.ts` og `intern.er_aktiv` i basen er
lagt til, og migrasjonen `0016_motsagt_rolle.sql` bytter ut RPC-ene som skiller
aktive roller fra tidligere. Seed-byggeren skriver kolonnen, og organsiden
skriver «motsagt av registeret» der det ellers ville stått en dato. Testene
står i `tests/datasett.test.ts` og `tests/mal.test.ts`, og
`tests/kontrakt.test.ts` holder basen og `lokal.ts` like.

**Ikke motsigelser (5).** Her står begge rollene. Avviksrapporten fører dem nå
under «Roller registeret ikke fører (ikke avvik)».

| Rolle | Registerets daglig leder | Hvorfor det ikke er en motsigelse |
|---|---|---|
| Statsforvalter (Runar Sjåstad) | Toril Feldt | «Statsforvalter» er ikke en rolle i Enhetsregisteret. Toril Feldt er assisterende statsforvalter, og organisasjonskartet har henne nå med den rollen. |
| Rektor, UiT (Dag Rune Olsen) | Jørgen Fossland og Odd Arne Paulsen | Rektor er ikke en registerrolle. Fossland er administrasjonsdirektør. |
| Styreleder, UiT (Marianne Elisabeth Johnsen) | Ingen styreleder er registrert | UiT har ikke styret sitt i registeret. Dette avviket kom med flettingen. |
| Sorenskriver, Nord-Troms og Senja tingrett (Unni Sandbukt) | En annen person | Sorenskriver er ikke en registerrolle. Registerets daglig leder er trolig domstolens administrasjonssjef. Begge står som `dommer_leder`. |
| Førstelagmann, Hålogaland lagmannsrett (Monica Hansen Nylund) | En annen person | Samme forklaring. Domstol.no oppgir henne som «Domstolleder». |

Avviksrapporten fra første kjøring kalte statsforvalteren og rektoren
motsigelser. Den er generert på nytt med den endrede importøren og kaller dem
ikke det lenger.

**Nøkkeltall.** Grunnlaget oppgir omsetning (375,9 mill. kr) og egenkapital
(208,6 mill. kr) for Remiks Miljøpark i 2025 og kaller dem «trolig konsern».
Registeret har bare morselskapets eget regnskap (88,4 og 173,1 mill. kr). Det
er to ulike mål, ikke en motsigelse. Grunnlagets tall er merket `konsern:
true`, og merknaden sier at grunnlaget ikke er sikkert, at registerets tall
måler noe annet, og at konserntallet må sjekkes mot Regnskapsregisteret. Et
konserntall sammenlignes aldri med et selskapstall, så rapporten har ikke
lenger noen nøkkeltallsavvik. Registerets rader er fortsatt merket
«Morselskapets eget regnskap, ikke konsern».

## Hull

- **Fjernet, fordi de er løst (16):**
  - Tromsø: det fjerde hovedutvalget, medlemmene i tre hovedutvalg
  - Troms fylkeskommune: styringsmodellen og navnene på hovedutvalgene (sidene har ingen komiteer i tillegg)
  - Statsadvokatene: førstestatsadvokaten
  - Domstolene: sorenskriver, lagmann og jordskifterettsleder
  - Statlige etater: avdelingsdirektør i Vegvesenet, regionleder i Arbeidstilsynet, direktør i HI og Kartverket (for Kartverket er et mer presist hull lagt til, se under)
  - Sametingspresidenten
  - Adm. dir. og styreleder i Helse Nord RHF
- **Erstattet av et mer presist hull (12):**
  - Tromsø: klageutvalget (konflikten mellom kommunens egne kilder) og kontrollutvalget (bare lederen er tatt med; kommunens egen side er utdatert)
  - Nav Troms og Finnmark og Nav Tromsø
  - Skatteetaten, Fiskeridirektoratet og Mattilsynet (regionen finnes ikke)
  - Kystverket Troms og Finnmark (datoen mangler)
  - Avinor, Statsbygg, Forsvaret (sjefen for Brigade Nord) og Innovasjon Norge Arktis
- **Lagt til (4):**
  - Statsadvokatene i Troms og Finnmark: datoen mangler
  - Fylkestinget: Kristina Torbergsen står bare som «I permisjon» (lenket til personen)
  - Kontrollutvalget i Troms fylkeskommune: lederen er holdt tilbake (lenket til `anni-skogman`, så en innsigelse fra henne også fjerner hullet)
  - Kartverket: bare fylkeskartsjefen for Troms og Finnmark er tatt med, ikke Kartverkets øverste leder
- **Staging-hull som ikke er lagt til (4):**
  - `statsadvokatene-troms-og-finnmark` og `kystverket-troms-og-finnmark`: dekkes nå av status, relasjon og hull om datoen
  - `halogaland-jordskifterett`: organet er erstattet
  - `norsk-polarinstitutt`: hullet lenket Camilla Brekke. Registeret har henne allerede som daglig leder (`verifisert`). Et hull som lenker henne, gjør henne til en person i grunnlaget. Da ville importøren holdt registerrollen hennes tilbake som navnebror, og en verifisert rolle ville forsvunnet. Grunnlagets hull «Direktøren er ikke navngitt» er skrevet om uten navn: registeret har to daglige ledere for instituttet, og instituttets egen side kunne ikke sjekkes.

## Konflikter mellom kildene, samlet

| # | Konflikt | Løsning |
|---:|---|---|
| 1 | Navnet på Tromsøs fjerde hovedutvalg var merket [verifiser] | Nytt organ med navnet fra kommunens side. Hullet er fjernet. |
| 2 | Kommunen sier at klageutvalget har fem faste medlemmer fra formannskapet, mens portalen viser at bare to av dem sitter fast der | Bare lederen er tatt med. Konflikten står i hullet. |
| 3 | Navnet på varaordføreren | «Sigrid Bjørnhaug Hammer». Nøkkelen står. |
| 4 | Ordfører siden 2019 eller 2023 | Kommunens dato, 2019-10-16. |
| 5 | Styringsmodellen i fylkeskommunen | Formannskapsmodell (regel 5). |
| 6 | Navnene på fylkeskommunens hovedutvalg | Fire nye organer med ledere. |
| 7 | Én eller to assisterende statsforvaltere | To. Toril Feldt er lagt til. |
| 8 | Statsadvokatembetet | Nedlagt. `erstattet_av` peker til Nord statsadvokatembete. |
| 9 | Hålogaland jordskifterett | Feil navn. Erstattet av Nord-Troms jordskifterett. |
| 10 | Region Nord i Skatteetaten, Fiskeridirektoratet og Mattilsynet, og Kystverket Troms og Finnmark | Regel 3, over. |
| 11 | Arbeidstilsynets «region» | Rollen har tittelen «Avdelingsdirektør, avdeling tilsyn nord». |
| 12 | Myrseth på Stortinget | Status `permisjon`. Hun er ført som næringsminister i NFD. |
| 13 | Styreleder i UNN «per 2024, [verifiser]» | Bekreftet av unn.no for 2026–28. |
| 14 | Staging-organet `helse-nord-ikt` hadde samme nøkkel som importørens organ | Organet er gjort til grunnlagsrad (regel 1). |
| 15 | Sorenskriver og førstelagmann på domstol.no er ikke registerets daglig leder | Ikke en motsigelse. Begge står (regel 8). |
| 16 | Styreleder i UiT finnes ikke i registeret | Ikke en motsigelse. UiT har ikke styret sitt i registeret. |
| 17 | Registeret har Tone Marie Myklevoll som styreleder i Tromsøbolig KF, mens grunnlaget har henne i Remiks Miljøpark | Grunnlagets rolle er motsagt. Registerpersonen er holdt tilbake (F). |
| 18 | Hærens sjef: forsvaret.no oppgir to ulike personer | Organisasjonskartet oppdatert 24.09.2026 gjelder. Fungerende sjef er ført som `fungerende` (vurdert i staging). |
| 19 | Fylkets side for kultur og helse og representantlisten oppgir ulike nestledere | Nestledere er ikke samlet inn. Ingen rad er påvirket. |
| 20 | Grunnlagets «trolig konsern» mot registerets selskapstall for Remiks Miljøpark | To ulike mål, merket (regel 8). |

## Mulig samme person: til menneskelig vurdering

**A. Samme nøkkel etter regel 4** (likt navn og parti i kommunen og i
fylket). Er det to personer, skill nøklene.

- `ida-garseth-hov`: Tromsø kommunestyre og helse- og velferdsutvalget (FrP), og fylkesutvalget (FrP)
- `vanja-terentieff`: Tromsøs miljøutvalg (H) og fylkesutvalget (H)

**B. Kortform og fullform på fylkets sider**, slått sammen i staging fordi
rollen binder dem. Nøkkelen har fullformen.

- «Magnar Nilssen» = `magnar-andreas-nilssen` (Ap)
- «Håkon Vahl» = `hakon-ronning-vahl` (H)
- «John Karlsen» = `john-roald-karlsen` (FrP)
- «Lars Eirik Grotdal» = `lars-eirik-dahlberg-grotdal` (SV)

**C. Navnebrødre i registeret, holdt tilbake av importøren (12 personer, 14
roller).** Personen fra den offisielle siden har samme navn som en person med
roller i registeret, men de deler ikke organ. Er det samme person, legg linjen
i `kommuner.5501.samme_person` i `scripts/brreg.config.json` og kjør
`npm run brreg -- 5501`. Er det en annen person, legg nøkkelen i `ulik_person`.

| Linje til `samme_person` | Rollen fra siden | Registerrollene som er holdt tilbake | Vurdering |
|---|---|---|---|
| `"borre-krudta-7cd743": "borre-krudta"` | Etatssjef kompetanse, fylkeskommunen | daglig leder i Troms Fylkeskommune Kompetanse | Trolig samme: samme etat |
| `"per-ove-uglehus-1ce10c": "per-ove-uglehus"` | Etatssjef, Tannhelsetjenesten i Troms | daglig leder i Troms Fylkeskommune Tannhelse | Trolig samme: samme etat (organene er trolig dubletter, se oppfølging) |
| `"hakon-ronning-vahl-517717": "hakon-ronning-vahl"` | leder av hovedutvalg (H), fylket | varamedlem i Troms Holding | Trolig samme: fylkets holdingselskap |
| `"irene-vanja-dahl-2753ab": "irene-vanja-dahl"` | fylkesutvalget (V) | varamedlem i Troms Holding | Trolig samme |
| `"john-roald-karlsen-e9471e": "john-roald-karlsen"` | fylkesutvalget (FrP) | styremedlem i Troms Holding | Trolig samme |
| `"magnar-andreas-nilssen-90b431": "magnar-andreas-nilssen"` | fylkesutvalget og leder av hovedutvalg (Ap) | styremedlem i Fagskolen i Nord og Tromsø Havn KF | Trolig samme |
| `"brage-larsen-sollund-f43b3d": "brage-larsen-sollund"` | kommunestyret (Ap) | styreleder i Ressurs Tromsø | Mulig |
| `"maja-sandvik-lockert-646c1a": "maja-sandvik-lockert"` | kommunestyret (SV) | styremedlem i Aurora Kino | Mulig |
| `"matias-hogne-kjerstad-f565fc": "matias-hogne-kjerstad"` | kommunestyret (SV) | varamedlem i Aurora Kino | Mulig |
| `"sebastian-hansen-henriksen-0e3234": "sebastian-hansen-henriksen"` | kommunestyret (H) | styremedlem i Tromsøbadet KF og varamedlem i Hålogaland Teater | Mulig |
| `"sigurd-salberg-pedersen-abffe5": "sigurd-salberg-pedersen"` | kommunestyret (MDG) | styremedlem i Remiks Husholdning | Mulig |
| `"marianne-elisabeth-johnsen-c35441": "marianne-elisabeth-johnsen"` | styreleder, UiT | styremedlem i Grøtsund Industripark | Mulig |

**D. Ulik skrivemåte, holdt adskilt** (regel 4). Er det samme person, slå
sammen nøklene i datasettet eller bruk `samme_person`.

- `irene-dahl` «Irene Dahl» (V, kommunestyret) og `irene-vanja-dahl` «Irene Vanja Dahl» (V, fylkesutvalget)
- `pal-julius-skogholt` (SV, kommunestyret, formannskapet, leder av oppvekstutvalget) og `pal-julius-austrem-skogholt` (registeret: styreleder i Remiks Miljøpark, vara i ProTromsø)
- `anne-hjortdahl` (etatssjef samfunn, næring og kultur) og `anne-merete-hjortdahl` (registeret: daglig leder i fylkeskommunens etat for samfunn, næring og kultur)
- `bjorn-kavli` (etatssjef samferdsel) og `bjorn-henrik-kavli` (registeret: daglig leder i fylkeskommunens samferdselsetat)
- `barbara-vogele` (MDG, kommunestyret, formannskapet) og `barbara-karin-vogele` (registeret: styremedlem i Tromsø Brann og redning KF, vara i Tromsø Havn KF)
- `kristian-wilsgard` (FrP, kommunestyret) og `kristian-paulsen-wilsgard` (registeret: vara i Tromsø Brann og redning KF)
- **«Anni Skogmann» holdt tilbake.** Fylkets kontrollutvalgsside oppgir «Anni Skogmann» (FrP) som leder, mens Tromsø kommunestyre har `anni-skogman` «Anni Skogman» (FrP). Fylkets representantliste skriver «Anni Beate Skogman». Med to poster ville det ene navnet stått inni det andre. Sperres «Anni Skogman», står navnet fortsatt synlig i «Anni Skogmann», og det stopper `tests/personvern.test.ts`. Rollen er derfor ikke lagt inn, og et hull på `troms-fylkeskommune-kontrollutvalg` sier hvorfor. Er det samme person, legg rollen på `anni-skogman` og nevn fylkets skrivemåte i merknaden. Er det en annen, må testens navnesjekk skille hele navn før rollen kan legges inn.

**E. Koblet av importøren gjennom felles organ.** Dette er ikke et
menneskelig valg, men det står her for å gi et fullt bilde.

- «Tom Robert Elvebu» (helsenordikt.no) = `tom-robert-lilletun-elvebu` (registeret)
- Toril Feldt, Frank Bakke-Jensen, Ingunn Midttun Godal, Ingvill Kvernmo, Ingrid Dahl Hovland, Nils Gunnar Kvamstø, Marit Lind og Gunnar Alskog: samme organ og navn i siden og i registeret

**F. Holdt tilbake fra før** (første kjøring, uendret):

- `eirik-losnegaard-mevik-43c8e3`
- `erlend-svardal-boe-b4113c`
- `stig-tore-johnsen-d8642a`
- `tone-marie-myklevoll-b5047a`: registeret har henne som styreleder i Tromsøbolig KF

## Filer som er endret

| Fil | Endring |
|---|---|
| `src/data/tromso.json` | Flettingen, kjørt gjennom importøren mot mellomlageret. `meta.merknad` har tallene. |
| `docs/avvik/brreg-5501-2026-09-25.md` | Generert på nytt av importøren (simulert kjøring mot mellomlageret, se regel 1). |
| `src/data/types.ts`, `src/lib/data/kontrakt.ts`, `src/lib/data/lokal.ts` | `motsagt`, og `erAktiv` for aktive roller |
| `supabase/migrations/0016_motsagt_rolle.sql` | Kolonnen, `intern.er_aktiv` og RPC-ene som skiller aktive roller fra tidligere |
| `scripts/seed-build.ts`, `supabase/seed/seed.sql` | Kolonnen `motsagt`. Seed-en er bygget to ganger med samme sha256. |
| `scripts/brreg/importer.ts`, `scripts/brreg/rapport.ts` | Motsagt-merket, og kategorien «Roller registeret ikke fører» |
| `src/components/organ/tekst.ts` | «motsagt av registeret» i historikken |
| `tests/brreg-import.test.ts`, `tests/mal.test.ts`, `tests/datasett.test.ts`, `tests/helpers/fiktive.ts` | Tester for det over |
| `docs/brreg-import.md`, `docs/lovable-overforing.md` | Beskrivelse av motsagt og ikke-registerroller, og migrasjonene 0001–0016 |

`npm test` (142 tester), `npm run typecheck` og `npm run seed:build` går rent.
Seed-en er lik ved to kjøringer.

## Sluttall

| | Antall | Verifisert (register) | Oppgitt | Må verifiseres |
|---|---:|---:|---:|---:|
| Organer | 344 | 219 | 67 | 58 |
| Roller | 1 180 | 1 005 | 170 | 5 |
| Nøkkeltall | 534 | 519 | 5 | 10 |

- **Organer etter opphav:** 219 fra Enhetsregisteret, 11 fra organenes egne
  sider (10 nye og Helse Nord IKT) og 114 fra researchgrunnlaget. 4 er
  nedlagt.
- **Roller etter opphav:**
  - 974 importert fra Brreg
  - 31 fra grunnlaget eller en offisiell side, bekreftet av Brreg
  - 167 fra offisielle sider og data.stortinget.no (`oppgitt`)
  - 8 fortsatt bare fra researchgrunnlaget. 5 av dem er `motsagt`, og 3 er `oppgitt` (en fratrådt kommunedirektør, fylkesordføreren i permisjon og en tidligere styreleder i Troms Kraft).
- **Personer:** 960.
- **Andre tall:**
  - Relasjoner: 138 (8 nye)
  - Hendelser: 24 (1 ny)
  - Hull: 71
  - Kilder: 78

## Oppfølging (ikke gjort)

- **Organdubletter mellom grunnlaget og Brreg:** `tannhelsetjenesten-troms`
  og `troms-fylkeskommune-tannhelse` (974795140). Fylkets etatssjefer står
  dessuten som `seksjonsleder` i administrasjonen, mens registeret har dem som
  daglig leder i etatenes egne enheter (kompetanse, samferdsel, samfunn, næring
  og kultur, tannhelse). Kobles organene (`koblinger` eller orgnr i
  grunnlaget), kobler importøren personene selv.
- **Orgnr fra de offisielle sidene:** `troms-politidistrikt` 974769425 (samme
  som registerkoblingen på navn) og `nav-tromso` 994672789 (ikke det samme som
  kandidaten i avviksrapporten).
- **`antall_medlemmer`:** formannskapet 13, fylkesutvalget 9, fylkets
  kontrollutvalg 5 og fylkestinget 37.
- **Relasjonen `helse-nord-rhf` eier `helse-nord-ikt`**, ifølge helse-nord.no,
  uten andel.
- **Hendelsen «Cecilie Myrseth blir næringsminister»:** datoen står ikke i
  uttrekket.
- **En ekte kjøring med nett** (prøvd på en kopi av datasettet og
  mellomlageret 25.09.2026): de fem navneoppslagene gir treff. Kystdirektøren
  og jordskifterettslederen blir bekreftet, og Nærings- og
  fiskeridepartementet får registerets daglig leder. Hæren får registerets
  daglig leder, Lars Sivert Lervik, ved siden av fungerende sjef Trond Nilsen.
  Forsvarets organisasjonskart (oppdatert 24.09.2026) har Lervik som sjef for
  Etterretningstjenesten, så registeret henger trolig etter. Avgjør det før
  Hæren vises med to toppledere. Ingen av radene som er lagt til, slettes eller
  dobles.
- **To ledere i to sensitive domstoler.** Nord-Troms og Senja tingrett og
  Hålogaland lagmannsrett har nå både lederen fra domstol.no og registerets
  daglig leder (trolig administrasjonssjefen), begge som `dommer_leder`.
  Registerraden bygges på nytt ved hver kjøring, så et valg om å holde den ute
  hører hjemme i importørens konfigurasjon, ikke i datasettet.
- **Grunnlagshull som registeret har gjort utdaterte.** Sju hull sier at
  ledelsen eller administrerende direktør «ikke er navngitt», mens registeret
  nå har en verifisert daglig leder for organet: Tromsøbolig KF, Tromsø Brann
  og redning KF, Nofima, NINA, Akvaplan-niva, SINTEF og Torghatten Nord.
  Motsetningen kom med Brreg-importen, ikke med denne flettingen, og hullene er
  ikke endret.
