# Maktkart / innflytelse.no – Researchgrunnlag, PRD og teknisk spesifikasjon (Troms/Tromsø først)

Maktkart kan bygges lovlig og skalerbart hvis det bygges på offentlige primærkilder (Brønnøysundregistrene, Aksjonærregisteret, eInnsyn, kommunale møteportaler, Doffin, Stortinget) med et institusjon-først-design der personer bare vises gjennom offentlige roller – ikke ved å scrape Proff/Purehelp, som i praksis er videresalg av de samme primærdataene med databasevern og avtalevilkår som juridisk risiko. Troms-kartet endrer seg raskt: statsforvalter, kommunedirektør i Tromsø, fylkesordfører (fungerende) og flere selskapsledere har byttet siden 2024, så historikk/versjonering må være kjernen i datamodellen, ikke et tillegg.

## TL;DR

- **Bygg på primærkilder, ikke scraping:** Enhetsregisteret/Rolle-API (NLOD, sanntidssøk, daglige filer, endrings-endepunkt), Regnskapsregisterets åpne nøkkeltall, Aksjonærregisteret (årlig CSV per 31.12), eInnsyn-API og Doffin dekker 80–90 % av behovet (estimat); Proff/Forvalt bør eventuelt lisensieres via deres betalte API, ikke skrapes.
- **Troms/Tromsø-kartet er i endring og må versjoneres:** Tromsø styres etter formannskapsmodellen (siden 1.7.2016) med 43 kommunestyremedlemmer, ordfører Gunnar Wilhelmsen (Ap) og kommunedirektør Ellen Beate Lundberg; Troms fylkeskommune har fungerende fylkesordfører Benjamin Furuly (H) til midten av januar 2027; statsforvalter er Runar Sjåstad fra august 2025 – og byrådsdebatten i Tromsø foran valget 2027 kan endre hele strukturen.
- **Differensiering = «usynlig makt» + forklarbar score:** den unike verdien er å koble vedtaksmyndighet (reguleringsplaner vedtas av kommunestyret, forberedes i kommune- og byutviklingsutvalget og administrasjonen), eierskap, styrenettverk og anskaffelser i én graf med transparent, kildebelagt innflytelsesscore – noe Proff, Purehelp og Kapital ikke gjør.

## Key Findings

| # | Funn | Status |
|---|---|---|
| 1 | Brønnøysundregistrenes åpne data er under NLOD; søketjenesten gir sanntidsdata, nedlastbare filer oppdateres hver 24. time | Fakta (brreg.no) |
| 2 | Enhetsregister-API har maks dybde (page×size) 10 000 → bruk totalfiler + `/oppdateringer/enheter` for inkrementell synk | Fakta (brreg OpenAPI) |
| 3 | Roller med fødselsnummer krever Maskinporten; åpne roller (navn, fødselsdato) er tilgjengelige per orgnr | Fakta (brreg API-dok) |
| 4 | Regnskapsregisterets åpne API gir kun nøkkeltall fra siste innsendte årsregnskap; fullstendige tre år er forbeholdt offentlig myndighet | Fakta (data.norge.no) |
| 5 | Aksjonærregisteret: aksjeeiere per 31.12, CSV, åpner i mai (inntektsår 2025 åpnet 18.5.2026), inneholder personopplysninger | Fakta (Skatteetaten) |
| 6 | Tromsø kommune har vært formannskapsmodell siden 2016; byrådsmodell diskuteres på nytt etter underskudd – ifølge NRK Troms og Finnmark «brukte [kommunen] 66 millioner kroner for mye 2025» (regnskapet godkjent i kommunestyret 24.6.2026), og i 2024 var merforbruket 205,1 mill. ifølge Tromsø kommune, mens NRK oppgir et underskudd (negativt driftsresultat) på 271 mill. for 2024 | Fakta (NRK / tromso.kommune.no) |
| 7 | Reguleringsplaner og kommuneplaner vedtas av kommunestyret selv; kommune- og byutviklingsutvalget behandler planer til offentlig ettersyn og reguleringsplaner | Fakta (tromso.kommune.no) |
| 8 | Proff oppgir at Tromsø kommune inngår i konsern med 18 selskaper og 9 datterselskaper | Sekundærkilde – verifiser mot Enhetsregisteret |
| 9 | Troms Kraft AS eies 60 % av Troms Holding AS og 40 % av Tromsø kommune; NRK (4.5.2026): styret «foreslår et utbytte på 175 millioner kroner … Av dette går 105 millioner til Troms Holding og 70 millioner til Tromsø kommune» | Fakta (NRK, Purehelp) |
| 10 | Makt- og demokratiutredningen: «Direktørene er den mektigste gruppen i norsk næringsliv» (NOU 2003: 19) – men posisjonsmetoden fanger dårlig opp store eiere → scoren må vekte eierskap separat | Fakta (NOU/NOST 2023) |

## Details

### DEL 1 – Kartlegging av organer

Merknad: «Per» angir datoen informasjonen er verifisert mot. Felter merket **[verifiser]** må hentes fra Enhetsregisteret/organets egen side ved seeding. Org.nr er kun oppgitt der det er bekreftet.

#### 1.1 Statlige etater og virksomheter i Troms/Tromsø

| Organ | Nivå/eierskap | Ansvar (relevant for næringsliv) | Nedslagsfelt | Nøkkelroller (navn der kjent) | Datakilde for roller |
|---|---|---|---|---|---|
| Statsforvalteren i Troms og Finnmark | Stat (KDD) | Tilsyn med kommuner, klageinstans for plan/bygg, miljø/landbruk/verneplaner, innsigelse i arealplaner | Troms + Finnmark | Statsforvalter Runar Sjåstad (fra aug. 2025, utnevnt for 6 år; tidl. stortingsrep. Ap); ass. statsforvalter Katrine Storeheier (tilsatt april 2025, kontorsted Tromsø) | statsforvalteren.no |
| Troms politidistrikt | Stat (Politidirektoratet) | Politi, påtale (felles påtaleenhet), forvaltningsoppgaver (våpen, utlending) | 20 kommuner; 5 geografiske driftsenheter, 10 tjenestesteder | Politimester Astrid Elisabeth Nilsen (ifølge regjeringen.no «åremålsutnevnt til politimester i Troms politidistrikt for en periode på seks år», konstituert siden november 2019; utnevnelsesdato **[verifiser]**); leder felles påtaleenhet Elin Norgård Strand; leder FEFE Anita Hermandsen; politistasjonssjef Tromsø Christian Vildgren (tiltrer 1. okt., år **[verifiser]**) | politiet.no, regjeringen.no |
| Statsadvokatene i Troms og Finnmark | Stat (Riksadvokaten) | Påtale i alvorlige saker | Troms/Finnmark | Førstestatsadvokat **[verifiser]** | riksadvokaten.no |
| Nord-Troms og Senja tingrett, Hålogaland lagmannsrett, Hålogaland jordskifterett (Tromsø-kontor) | Stat (Domstoladministrasjonen) | Tvister, konkurs, jordskifte (eiendomsgrenser – direkte relevant for eiendom) | Regionalt | Sorenskriver/lagmann/jordskifterettsleder **[verifiser]**; *kun ledere – ikke enkeltdommere i MVP* | domstol.no |
| NAV Troms og Finnmark / NAV Tromsø | Stat + kommune (partnerskap) | Arbeidsmarkedstiltak, lønnstilskudd, IA | Fylke/kommune | Fylkesdirektør, NAV-leder Tromsø **[verifiser]** | nav.no |
| Skatteetaten (region Nord), Tolletaten | Stat | Skatt, merverdiavgift, toll | Nasjonalt/regionalt | Regionledere **[verifiser]** | skatteetaten.no |
| Fiskeridirektoratet (region Nord) | Stat (NFD) | Kvoter, tillatelser, akvakulturtillatelser, kontroll | Kyst | Regiondirektør **[verifiser]** | fiskeridir.no |
| Mattilsynet (region Nord) | Stat | Tilsyn sjømat, oppdrett, næringsmidler | Region | Regiondirektør **[verifiser]** | mattilsynet.no |
| Kystverket Troms og Finnmark | Stat | Farleder, havnetillatelser, los | Kyst | Regiondirektør **[verifiser]** | kystverket.no |
| Statens vegvesen (divisjon/avdeling nord) | Stat | Riksveg, planlegging, trafikksikkerhet | Region | Avdelingsdirektør **[verifiser]** | vegvesen.no |
| Nye Veier | Statlig AS | Ikke aktiv i Troms per 2026 (antakelse) – lav prioritet | – | – | – |
| Avinor (Tromsø lufthavn Langnes) | Statlig AS | Lufthavn, arealer, kommersielle konsesjoner | Regionalt knutepunkt | Lufthavnsdirektør **[verifiser]** | avinor.no |
| Statsbygg (Nord) | Stat | Statlige bygg (UiT, domstoler) – stor byggherre | Region | Regiondirektør **[verifiser]** | statsbygg.no |
| Forsvaret (Hæren/Brigade Nord i Bardu/Målselv, FOH Reitan nær Bodø) | Stat | Arealbruk, innkjøp, arbeidsplasser | Indre Troms | Sjefer **[verifiser]**; *sikkerhetsgradert – kun offisielle toppledere* | forsvaret.no |
| Arbeidstilsynet, Husbanken, Sivilforsvaret, NVE (region Nord), Direktoratet for mineralforvaltning | Stat | Tilsyn, boligfinansiering, beredskap, konsesjon vassdrag/energi, mineralrett | Regionalt/nasjonalt | Regionledere **[verifiser]** | etatenes nettsider |
| Innovasjon Norge Arktis | Statlig særlovselskap (eid av NFD og fylkene) | Lån, tilskudd, garantier | Troms/Finnmark | Regiondirektør **[verifiser]** | innovasjonnorge.no |
| Havforskningsinstituttet (Tromsø), Norsk Polarinstitutt (HK Tromsø), Kartverket (Tromsø-kontor) | Stat | Kvoteråd, miljøforvaltning, eiendomsregister/matrikkel | Nasjonalt | Direktører **[verifiser]** | hi.no, npolar.no, kartverket.no |
| Sametinget | Samisk folkevalgt organ | Konsultasjonsrett i arealsaker, innsigelse | Samiske områder | Sametingspresident **[verifiser]** | sametinget.no |
| Stortinget – Troms valgkrets 2025–2029 | Nasjonal lovgivende | Lover, budsjett | Nasjonalt | Cecilie Myrseth (Ap), Per-Willy Amundsen (FrP), Nils-Ole Foshaug (Ap), Kristian August Eilertsen (FrP), Erlend Svardal Bøe (H), Hanne Beate Stenvaag (R) | data.stortinget.no |

#### 1.2 Helse, utdanning og forskning

| Organ | Eierskap | Rolle | Nøkkelroller |
|---|---|---|---|
| Universitetssykehuset Nord-Norge HF (UNN) | Helse Nord RHF | Sykehus Tromsø, Harstad, Narvik; stor arbeidsgiver/byggherre | Adm. dir. David Johansen (fra 6. mai 2024); viseadm. dir. Einar Bugge; styreleder Anders Mohn Frafjord (per 2024 – **[verifiser]**) |
| Helse Nord RHF | Staten (HOD) | Eier av helseforetakene | Adm. dir./styreleder **[verifiser]** |
| UiT Norges arktiske universitet | Stat (KD) | Utdanning/forskning; ca. 3 600 årsverk (SNL 2026) | Rektor Dag Rune Olsen (ansatt 2021); prorektor utdanning Rikke Gürgens Gjærum; prorektor forskning Jørgen Berge; administrasjonsdirektør Jørgen Fossland; universitetsstyret (møter i Elements) |
| Nofima, NILU, NINA, Akvaplan-niva, SINTEF-miljøer, Norut/NORCE | Statlig/stiftelse/AS | Anvendt forskning sjømat/miljø | Adm. dir. **[verifiser]** via Rolle-API |
| Arktisk råds sekretariat (Tromsø) | Mellomstatlig | Arktisk samarbeid | Direktør **[verifiser]** |

#### 1.3 Troms fylkeskommune (gjenopprettet 1.1.2024)

| Element | Innhold (per sept. 2026) |
|---|---|
| Styringsmodell | Formannskapsmodell (fylkesordfører leder fylkestinget og fylkesutvalget) – bekreftet på tromsfylke.no (sist endret 12.6.2026). **Merk konflikt:** ved konstitueringen i 2023 omtalte medier at Ap skulle «lede fylkesrådet» og Torbergsen omtales som «fylkesrådsleder»; dagens offisielle side sier formannskapsmodell. Datamodellen må kunne representere begge. |
| Fylkesordfører | Kristina Torbergsen (Ap), valgt 24./25. okt. 2023 – i permisjon |
| Fungerende fylkesordfører | Benjamin (Nordberg) Furuly (H), fram til midten av januar 2027 |
| Fylkesvaraordfører (nå) | Eirik Losnegaard Mevik (Ap) |
| Samarbeid 2023–2027 | H, Ap, KrF, V, MDG (plattform «Et kraftfullt Troms») |
| Administrasjon | Fylkeskommunedirektør Camilla Bjørn; fire etater + direktørens kontor + stab/støtte |
| Organer å modellere | Fylkestinget, fylkesutvalget, hovedutvalg/komiteer **[verifiser navn]**, kontrollutvalg, ungdommens fylkesråd, eldreråd, råd for personer med funksjonsnedsettelse |
| Eierskap | Troms Holding AS (eier 60 % av Troms Kraft; styreleder Kristina Torbergsen ifølge Proff), Svipper/kollektivtrafikk **[verifiser org.form]**, andel i Innovasjon Norge, Nordnorsk reiseliv/landsdelsselskaper (bl.a. selskap eid av Nordland, Troms og Finnmark fylkeskommuner), tannhelsetjenesten (etat, ikke selskap) |

#### 1.4 Tromsø kommune (org.nr 940 101 808)

**Politisk struktur (valgperiode 2023–2027):**

| Organ | Sammensetning/myndighet | Nøkkelroller |
|---|---|---|
| Kommunestyret | 43 medlemmer; 11 møter/år; vedtar selv kommuneplan, reguleringsplaner, budsjett, handlingsprogram, skatt/avgift, forskrifter | Ordfører Gunnar Wilhelmsen (Ap, gjenvalgt 11.10.2023); varaordfører Sigrid Hammer (SV) |
| Formannskapet | Nest øverste organ, møter annenhver uke; innstiller i økonomi; kan pålegge kommunedirektøren å fremme saker | Leder: ordfører |
| Hovedutvalg (4 stk., 11 medlemmer hver) | Helse- og velferdsutvalget; **Kommune- og byutviklingsutvalget** (planer til offentlig ettersyn, reguleringsplaner); oppvekst- og utdanningsutvalget; et fjerde utvalg for klima/miljø/næring/kultur/idrett/friluft (navn **[verifiser]**) | Ledere **[verifiser via innsyn.tromso.kommune.no]** |
| Klageutvalget | 5 faste medlemmer fra formannskapet; behandler klager på kommunale enkeltvedtak | **[verifiser]** |
| Kontrollutvalget | Tilsyn/revisjon; medlemmer kan ikke sitte i hovedutvalg | **[verifiser]** |
| Administrasjonsutvalget, arbeidsmiljøutvalget | Partssammensatte | – |
| Mangfolds- og integreringsutvalget | 9 medlemmer (3 politikere, 6 med flerkulturell bakgrunn) | – |
| Råd | Eldreråd, ungdomsråd, råd for personer med funksjonsnedsettelse, Tromsø studentutvalg; bydelsråd/utviklingslag (frittstående foreninger) | – |

**Administrasjon:**

| Rolle | Innehaver | Historikk (eksempel på versjonering) |
|---|---|---|
| Kommunedirektør | Ellen Beate Lundberg (tidl. kommunedirektør i Fauske) | Stig Tore Johnsen fratrådte 30.9.2025 → Mari Enoksen Hult fungerende/konstituert → Lundberg. Forgjenger før Johnsen: Britt Elin Stenveg |
| Byutvikling/plan, byggesak, eiendom, næring | Seksjons-/avdelingsledere **[verifiser via kommunens ansattsøk]** | Dette er «usynlig makt»-laget – se Del 3 |

**Styringsmodell-risiko:** Byrådsmodell (2011–2016) ble avviklet 1.7.2016. Nordlys (redaksjonelt) og FrP har tatt til orde for å gjeninnføre byråd etter valget 2027; Sp og Rødt er skeptiske. Dette er *debatt*, ikke vedtak – men systemet må kunne modellere en overgang (nye organer «Byrådet», «Byråd for X», avvikling av formannskap og kommunedirektør).

**Kommunale foretak og selskaper (per 2025/2026):**

| Enhet | Org.nr | Eierandel | Sektor | Nøkkeltall | Ledelse |
|---|---|---|---|---|---|
| Tromsø Havn KF | Del av kommunen (KF) | 100 % | Havn/eiendom | Regnskap i havnestyret, ikke Brreg | Havnedirektør Jørn-Even Hanssen; styremedlem bl.a. Kjell-Are Vassmyr |
| TG Næringseiendom AS | [verifiser] | Havnens utleieselskap | Eiendom | – | Styreleder Kjell-Are Vassmyr; daglig leder Jørn-Even Hanssen (per 2023-omtale) |
| Tromsøbolig KF | KF | 100 % | Kommunale boliger (etablert 2022) | – | [verifiser] |
| Tromsøbadet KF / Tromsøbadet AS | [verifiser] | 100 % | Bad | – | [verifiser] |
| Tromsø Brann og redning KF | KF | 100 % | Brann | – | [verifiser] |
| Troms Kraft AS | 979 468 792 | 40 % (60 % Troms Holding) | Energi | Morselskap 2025: egenkapital 2 426 mill.; konsern årsresultat 2025: 202 mill.; utbytte 175 mill. (105 mill. til Troms Holding, 70 mill. til Tromsø kommune – NRK 4.5.2026) | Konsernsjef Erling Andreas Dalberg; styreleder Åslaug Haga (valgt av bedriftsforsamlingen 14.5.2025 ifølge Troms Kraft; etterfulgte Inge K. Hansen), nestleder Kathrine Tveiterås |
| Remiks Miljøpark AS | 894 462 132 | 99,99 % (Karlsøy resten) | Avfall | 2025: omsetning 375,9 mill., egenkapital 208,6 mill. (trolig konsern) | Daglig leder Britt Hege Mathisen Limo; styreleder Tone Marie Myklevoll (sekundær) |
| Remiks Husholdning AS / Remiks Næring AS | 994 900 579 / 994 900 811 | Datter | Avfall (selvkost / marked) | – | – |
| Tromsø Parkering AS | 912 994 481 | 100 % | Parkering | 2024: omsetning 77,8 mill., egenkapital 71,7 mill. | Daglig leder Jørn Ove Olsen |
| Grøtsund Industripark AS | 934 106 709 | 50 % (øvrige: Tromsø Havn, fylkeskommunen, Troms Kraft, ProTromsø – andeler uverifisert) | Maritim næringspark | Stiftet 28.6.2024; egenkapital ca. −0,5 mill. | Styreleder Kjell-Are Vassmyr |
| Arnestedet Eiendom AS / Arnestedet Næringseiendom AS | [verifiser] | 100 % | Eiendom | Egenkapital 320,8 / 112,0 mill. | – |
| Ressurs Tromsø AS | [verifiser] | 55,38 % | Arbeidsinkludering | – | – |
| Aurora Kino AS | [verifiser] | 64,4 % | Kino | Omsetning 54,0 mill. | – |
| Visit Tromsø-Region AS | [verifiser] | 16,67 % | Reiseliv/destinasjon | Omsetning 22,7 mill. | – |
| ProTromsø AS, Alfheim Stadion II AS, Fjuel AS (16,59 %), Fjuel Tromsø AS (51 % Troms Kraft/49 % Tromsø Havn) | [verifiser] | Varierende | Næringsutvikling/idrett/drivstoff | – | – |

Kilde for eierandeler i tabellen: Purehelp sin oversikt over Tromsø kommunes eierskap (bygger på Brreg/Aksjonærregisteret) og kommunens eierskapsmelding 2024; tall uten år er trolig 2025 og **må verifiseres mot Regnskapsregisteret**. IKS/samarbeid som skal kartlegges: kontrollutvalgssekretariat/revisjon (IKS), interkommunalt vann/avløp, legevakt, krisesenter, arkiv – **[verifiser via Enhetsregisteret, organisasjonsform = IKS, kommunenummer 5501]**.

#### 1.5 Andre kommuner i Troms og regionråd

Troms valgkrets består av 21 kommuner: Balsfjord, Bardu, Dyrøy, Gratangen, Harstad, Ibestad, Gáivuotna-Kåfjord, Karlsøy, Kvæfjord, Kvænangen, Lavangen, Lyngen, Målselv, Nordreisa, Salangen, Senja, Skjervøy, Sørreisa, Storfjord, Tjeldsund, Tromsø. Generisk struktur per kommune: kommunestyre → formannskap → hovedutvalg/plan-utvalg → kontrollutvalg → klagenemnd → lovpålagte råd → kommunedirektør → sektorledere → KF/AS/IKS. Regionråd (f.eks. Tromsø-regionen, Nord-Troms, Midt-Troms, Sør-Troms) modelleres som `samarbeid` med medlemskommuner og gyldighetsperiode **[verifiser dagens sammensetning]**.

#### 1.6 Nasjonale klage-, tilsyns- og interesseorganer

| Type | Organer | Myndighetstype |
|---|---|---|
| Klage/tilsyn | KOFA, Konkurransetilsynet, Sivilombudet, Forbrukertilsynet, Finanstilsynet, Datatilsynet, Kommunal- og distriktsdepartementet (lovtolkning plan- og bygningsloven) | klagebehandling, tilsyn |
| Arbeidsliv | KS (Troms), NHO Arktis, LO Troms, Virke, Finans Norge, Sparebankforeningen (styreleder Jan-Frode Janson, gjenvalgt 27.4.2026) | rådgivning/lobby |
| Næring | Næringsforeningen i Tromsøregionen (Stig Tore Johnsen – tidl. kommunedirektør – valgt til verv i foreningen; rolle **[verifiser]**), Norges Fiskarlag, Sjømat Norge, Norsk Industri, NHO Reiseliv, Nordnorsk Reiseliv | lobby |
| Eiendom/bolig | Huseiernes Landsforbund, Eiendom Norge, Norsk Eiendom, boligbyggelag (f.eks. Tromsø Boligbyggelag **[verifiser]**) | lobby |

#### 1.7 Private selskaper (største i Tromsø/Troms, offentlige regnskap)

| Selskap | Org.nr | Segment | Nøkkeltall (år) | Ledelse | Eier |
|---|---|---|---|---|---|
| SpareBank 1 Nord-Norge | 952 706 365 | Finans | Resultat før skatt 1 986 mill. etter Q2 2026 | Konsernsjef Hanne Karoline Kræmer (fra 1.1.2024; også styreleder SpareBank 1-alliansen/SpareBank 1 Gruppen AS); styreleder Eirik Frantzen (fra 2022, konsernsjef Nordkraft AS); nestleder Kathrine Tveiterås (Norges sjømatråd) | Egenkapitalbeviseiere + Sparebankstiftelsen |
| Norges Råfisklag SA | 938 469 148 | Sjømat (førstehåndsomsetning) | Omsetning 16 082 mill. (2024); omsatt verdi 2025 rekord 19,07 mrd. | Adm. dir. Charles André Aas; styreleder Rolf Guttorm Kristoffersen (per mai 2025) | Fiskere (samvirke) |
| Consto AS / Consto Holding AS | 995 754 606 / 917 807 299 | Bygg/anlegg | Omsetning 8 720 mill. (2024) | [verifiser] | [verifiser] |
| Lerøy Aurora AS | 985 940 460 | Havbruk | Omsetning 3 683 mill., driftsresultat 435,9 mill. (2025) | Daglig leder Kurt-Einar Karlsen | Lerøy Seafood Group ASA |
| Torghatten Nord AS | 993 205 117 | Transport (ferje/hurtigbåt) | Omsetning 2 288 mill. (2024) | [verifiser] | Torghatten-konsernet (uverifisert) |
| Nergård-konsernet (Nergård AS 965 618 910) | – | Hvitfisk/fiskeri | Nergård Seafood AS: 2 192 mill. (2025); Nergård Havfiske AS: 883 mill. (2024) | Daglig leder Havfiske: Kenneth Holmøy | Mulig Samherji-eierskap (uverifisert) |
| Macks Ølbryggeri AS | 975 967 093 | Næringsmiddel | Omsetning 524 mill. (2024) | Harald Bredrup har ifølge Godt Drikke trådt ut som adm. dir. og «overlater nå roret til Roger Karlsen»; Bredrup fortsetter som daglig leder i morselskapet Ludwig Mack AS (nåværende adm. dir. **[verifiser i Brreg]**) | Ludwig Mack AS (familie) |
| Troms Kraft AS | 979 468 792 | Energi | Se 1.4 | Se 1.4 | Offentlig |

Ikke ferdig kartlagt (må hentes i seed-jobb fra Regnskapsregisteret filtrert på kommunenummer 5501 og NACE): hotell/reiseliv (Scandic/Thon/Radisson-driftsselskaper, Hurtigruten-relaterte), eiendomsselskaper, holdingselskaper med høy egenkapital, Lufttransport AS, SpareBank 1 Gruppen/ODIN (HK-status i Tromsø må sjekkes).

### DEL 2 – Datakilder og juridisk rammeverk

#### 2.1 Primærkilder

| Kilde | Data | Format/tilgang | Frekvens | Lisens | Auto-oppdatering |
|---|---|---|---|---|---|
| Enhetsregisteret (data.brreg.no/enhetsregisteret/api) | Enheter, underenheter, org.form, NACE, ansatte, adresser, overordnet enhet, konkurs/sletting | REST/JSON, totalfiler JSON/CSV/Excel; `/oppdateringer/enheter` | Søk sanntid; filer hver 24. time | NLOD | **Ja** – primær ryggrad |
| Rolle-API (Enhets- og Foretaksregisteret) | Daglig leder, styre, revisor, regnskapsfører, signatur/prokura | REST per orgnr; fnr-variant via Maskinporten | Sanntid | NLOD (åpen del) | **Ja**, men én forespørsel per orgnr → kø + throttling |
| Struktur i offentlig sektor (brreg) | Statlig sektor-hierarki | Excel-nedlasting | Periodisk | NLOD | Ja (organstruktur stat) |
| Partiregisteret | Registrerte partier | CSV | Ved endring | NLOD | Ja |
| Regnskapsregisteret (data.brreg.no/regnskapsregisteret/regnskap) | Nøkkeltall siste årsregnskap (åpen del) | REST/JSON | Daglig import | NLOD | **Ja**; historikk må du bygge selv ved å lagre hvert år |
| Aksjonærregisteret (Skatteetaten) | Aksjeeiere per 31.12 (navn, fødselsår, postnr, antall aksjer) | Bestilt CSV, lenke gyldig 1 uke | Årlig (mai) | Offentlig, men personopplysninger → GDPR | Halvautomatisk (årlig jobb) |
| Stortingets data (data.stortinget.no) | Representanter, komiteer, saker, voteringer | REST XML/JSON | Løpende | Åpne data | Ja |
| eInnsyn (api.einnsyn.no) | Journalposter, saksmapper, møtemapper for stat/kommuner som publiserer | REST (ny API, `X-EIN-API-KEY`, ID-prefiks som `jp_`, `sm_`, «expandable fields») | Løpende | Offentlig (offentleglova) | Ja, for tilsluttede organer |
| Kommunale innsynsportaler (f.eks. innsyn.tromso.kommune.no – møtekalender, utvalgsmedlemmer `sru?commission_id=`) | Utvalg, medlemmer, saker, protokoller | HTML (Acos/Elements/Tieto) – varierende | Løpende | Offentlig informasjon | Adaptere per leverandør (skraping av *offentlige organers* egne sider er lav risiko, men respekter robots/last) |
| Doffin | Kunngjøringer, tildelinger (eForms) | Offentlig API v2 (lesing), Notices API (kun innsending), DFØ-CSV (CC BY 4.0), TED XML | Løpende; 10 310 konkurransekunngjøringer i 2025, 41 % under EØS-terskel | NLOD/CC BY | Ja – kobling oppdragsgiver ↔ leverandør |
| Lovdata | Lover/forskrifter (hjemmel for myndighet) | Åpne datasett (gjeldende lover/forskrifter) | Løpende | NLOD for åpne datasett | Ja – kobles til `ansvarsomraade` |
| SSB API (PxWebApi) | Befolkning, KOSTRA, næring per kommune | JSON-stat | Periodisk | CC BY 4.0 | Ja |
| valgresultat.no / Valgdirektoratet | Valgresultater, mandater | API/filer | Per valg | Åpne data | Ja (2023, 2025, 2027) |
| data.norge.no | Katalog over datasett/API | Metadata | – | – | Oppdagelse |
| Wikidata | Personer/organer med Q-ID | SPARQL | Løpende | CC0 | Kun berikelse, ikke sannhetskilde |
| regjeringen.no, statsforvalteren.no, domstol.no, NTB/Mynewsdesk-pressemeldinger | Utnevnelser, ledere | HTML/RSS | Løpende | Ulike | Hendelsesdeteksjon (varsler, ikke automatisk skriving) |

**Rate limits:** Brreg dokumenterer maks dybde 10 000 treff per søk; eksplisitte kallgrenser er ikke publisert i kildene funnet – planlegg med ≤ 5 forespørsler/sek og eksponentiell backoff (antakelse).

#### 2.2 Proff, Purehelp, Forvalt – ærlig vurdering av scraping

| Tjeneste | Tilbyr | Kommersiell tilgang | Vurdering |
|---|---|---|---|
| Proff.no / Proff Forvalt | Regnskap, roller, eiere, konsernstruktur, kreditt, «Tromsø kommune konsern 18 selskaper» | Forvalt Pluss/Premium/XL; Proff Premium API («regnskap, roller, eiere og kredittrating … daglige oppdateringer») – pris på forespørsel | **Ikke scrape.** Lisensier API om du trenger konsernstruktur/kreditt raskt |
| Purehelp.no | Regnskap, roller, eierskap | Abonnement | Samme vurdering |
| Kapital/DN/Nordlys | Topplister, journalistikk | Abonnement | Kun manuell kildehenvisning |

**Juridisk:** (1) *Databasevern* – åndsverkloven § 24 gir tilvirkeren av en database med vesentlig investering enerett til uttrekk/gjenbruk av hele eller vesentlige deler; systematisk scraping av Proff treffer dette. (2) *Avtalevilkår* – bruk forutsetter aksept av vilkår som normalt forbyr automatisert innhenting; brudd gir erstatnings-/utestengelsesrisiko. (3) *GDPR* – du blir selvstendig behandlingsansvarlig for personopplysningene uansett kilde. (4) *Forretningsrisiko* – et produkt bygget på konkurrentens data kan stenges over natten. **Anbefaling:** Nesten alt Proff har, finnes i primærkilder (Brreg, Regnskapsregisteret, Aksjonærregisteret). Bygg selv; lisensier Proff API kun for kreditt/konsernstruktur hvis tiden er kritisk.

#### 2.3 Personvern – rammeverk og designprinsipper

| Tema | Regel/praksis | Konsekvens for Maktkart |
|---|---|---|
| Behandlingsgrunnlag | GDPR art. 6(1)(f) berettiget interesse; krever interesseavveining dokumentert | Skriv LIA (legitimate interest assessment) før lansering |
| Offentlige roller vs. private | Personer i offentlige verv/lederroller har svakere vern for rolleinformasjon; privatpersoner (f.eks. små aksjonærer) sterkt vern | Vis kun personer *via rolle*; aksjonærer < terskel (f.eks. < 10 % og ikke styre/ledelse) vises ikke med navn |
| Journalistisk unntak | Personopplysningsloven § 3 / GDPR art. 85 – gjelder journalistiske formål | En kommersiell B2B-database er neppe journalistikk; ikke bygg på unntaket |
| Skattelister | Offentliggjøres kun hos Skatteetaten; søk logges; EMD storkammer felte Ungarn for nettpublisering av skatteopplysninger (2023, omtalt av Rett24) | **Ikke importer eller gjør skattelister søkbare** |
| Særlige kategorier | Politisk oppfatning (art. 9) – partitilhørighet for folkevalgte er åpenbart offentliggjort av den registrerte (art. 9(2)(e)) | Kun partitilhørighet for folkevalgte; aldri utledet for andre |
| Informasjonsplikt | Art. 14 – når data hentes fra andre kilder | Offentlig personvernerklæring + e-post til personer med profil (skalert), «Er dette deg?»-lenke |
| Protest/retting | Art. 16, 21 | Innebygget korrigerings- og innsigelsesflyt med SLA (f.eks. 72 t svar) |
| Profilering/score | Art. 22 gjelder ikke direkte (ingen rettsvirkning), men DPIA (art. 35) anbefales ved systematisk kartlegging | Score på *organ og rolle*, ikke på person som «rangering av mennesker» |
| Sikkerhet | Dommere, politi, påtale, Forsvaret, barnevern | Kun ledere; ingen bilder, adresser eller nettverksgraf for disse rolletypene |
| Bilder | Personbilder krever grunnlag; pressebilder har opphavsrett | Ingen personbilder i MVP; kun organlogoer der lisens tillater |

**Designprinsipper:** institusjon først · kun rolle-data · hver påstand har `kilde_id` og `hentet_tid` · «sist verifisert»-stempel · retting/innsigelse i UI · dataminimering (fødselsår, ikke fødselsdato) · sletterutine for roller avsluttet > 10 år (vurder) · ingen skattelister · ingen private adresser.

### DEL 3 – Taksonomi og innflytelsesrangering

#### 3.1 Hierarki

```
nivaa: stat | fylke | kommune | interkommunal | samisk | privat | interesse | mellomstatlig
organtype: departement | direktorat | etat | statsforvalter | domstol | tilsyn | nemnd |
           folkevalgt_organ | utvalg | raad | administrasjon | KF | FKF | AS | ASA | IKS | SA |
           stiftelse | HF | RHF | forening | samarbeid(§17/§19 kommuneloven) | regionraad
rolletype: politisk_leder | folkevalgt | utvalgsleder | utvalgsmedlem | toppleder | seksjonsleder |
           fagleder_plan | fagleder_byggesak | styreleder | nestleder | styremedlem | varamedlem |
           daglig_leder | dommer_leder | paatale_leder | revisor | eier | tillitsvalgt
```

#### 3.2 Myndighetstyper (flervalgs per organ/rolle)

`vedtak` · `regelverk` · `tilsyn` · `konsesjon` · `klage` · `finansiering` · `innkjop` · `eierskap` · `planmyndighet` · `innstilling` (forberedende makt) · `raadgivning` · `lobby`

#### 3.3 Næringssegmenter og mapping (utdrag)

| Organ | Segmenter (primær → sekundær) | Myndighetstyper |
|---|---|---|
| Tromsø kommunestyre | eiendom/bygg, reiseliv, alle | vedtak, planmyndighet, eierskap, finansiering |
| Kommune- og byutviklingsutvalget | eiendom/bygg, reiseliv (hotell), handel | innstilling, planmyndighet |
| Byplan-/byggesaksledelse (adm.) | eiendom/bygg | innstilling, vedtak (delegert) |
| Statsforvalteren T&F | eiendom/bygg, havbruk, energi, landbruk | klage, tilsyn, innsigelse |
| Fiskeridirektoratet | sjømat/fiskeri/havbruk | konsesjon, tilsyn |
| Tromsø Havn KF | transport, reiseliv (cruise), eiendom | eierskap, konsesjon, innkjøp |
| SpareBank 1 Nord-Norge | finans → alle | finansiering |
| Troms Kraft | energi | eierskap, innkjøp |
| UNN / UiT | helse, utdanning/forskning, bygg | innkjøp, finansiering |

#### 3.4 Innflytelsesscore (forklarbar, 0–100)

Forskningsgrunnlag: Makt- og demokratiutredningen (NOU 2003: 19) definerer makt som evnen til å nå mål direkte eller indirekte via institusjoner; posisjonsmetoden (eliter = toppposisjoner) er utgangspunktet, men nyere kritikk (Norsk sosiologisk tidsskrift 2023) viser at den undervurderer store eiere – derfor egen eierskapskomponent. Trond Løyning, «Nettverket styrer? En kvalitativ analyse av betydningen av overlappende styreverv» (maktutredningens rapportserie nr. 28), og Engelstad m.fl., *Eliter i endring* (2022), støtter nettverkskomponenten. En ny maktutredning er foreslått i Stortinget (representantforslag 2025–2026).

**Organscore** `S_org = Σ w_i · x_i` (x normalisert 0–1 med log-skala på kroner):

| Komponent | Vekt | Mål |
|---|---|---|
| Myndighetstype | 0,25 | Maks av typevekter: vedtak/planmyndighet 1,0; konsesjon/klage 0,9; tilsyn 0,8; finansiering 0,7; innkjøp 0,6; eierskap 0,6; innstilling 0,5; lobby 0,3 |
| Økonomisk vekt | 0,20 | log(budsjett/omsetning/utlån/forvaltet kapital) |
| Arealmakt | 0,15 | Vedtak/innstilling i plan/byggesak (antall saker × areal/verdi fra møteprotokoller) |
| Geografisk rekkevidde | 0,10 | kommune 0,3 · region 0,6 · nasjonal 1,0 |
| Ansatte | 0,05 | log(ansatte) |
| Anskaffelser | 0,10 | Doffin-volum som oppdragsgiver |
| Eierposisjon | 0,15 | Eide andeler vektet med selskapenes egenkapital |

**Rollescore** `S_rolle = S_org × rollevekt × (1 + 0,2·sentralitet)` der rollevekt: toppleder/politisk leder 1,0; styreleder 0,8; utvalgsleder 0,7; fagleder plan/byggesak 0,6; styremedlem 0,5; medlem folkevalgt organ 0,4; vara 0,1. Sentralitet = normalisert eigenvector/betweenness i det bipartite nettverket person–styre (kun aktive roller).

**Personaggregat** (vises kun som «samlet rolleportefølje», ikke topp-liste over mennesker i MVP): `S_person = 1 − Π(1 − S_rolle_k)`.

**Forklarbarhet:** hver score vises med komponentbidrag, kilder og dato; brukeren kan justere vekter (Pro-funksjon). Scoren er et *estimat* og merkes slik.

### DEL 4 – PRD

| Punkt | Innhold |
|---|---|
| Problem | Makt i en region er spredt over hundrevis av organer, selskaper og utvalg; informasjonen ligger i 15+ kilder, endrer seg ofte, og den «usynlige» administrative/planmakten er nesten umulig å se |
| Målgrupper og betalingsvilje (estimat) | PR/samfunnskontakt og lobbyister (høy – 20–60 k kr/år); journalister/redaksjoner (middels – redaksjonslisens); næringsforeninger/NHO/LO (middels); eiendomsutviklere/meglere (høy – plan/byggesaksinnsikt); B2B-selgere mot offentlig sektor (middels-høy – Doffin + beslutningstakere); konsulenter/revisorer (middels); investorer (middels) |
| Konkurrenter | Proff Forvalt (selskapsdata/kreditt, ikke offentlig sektor/utvalg); Purehelp; Kapital/DN topplister; Altinget (politikk, nasjonalt); Maktbasen og lignende (nasjonalt, tynn på lokalnivå); Anbudsregisteret/Varsly (anskaffelser) |
| Unik verdi | Én graf for offentlig + privat + interesse på lokalt nivå; historikk; forklarbar score; «hvem bestemmer X»; kobling plan-/byggesak ↔ utvalg ↔ selskaper |
| Kjernefunksjoner | Søk (organ, rolle, person, sak); organprofil; rolleprofil; maktkart/nettverksgraf; tidslinje/endringslogg; varsler (rollebytte, ny styreleder, ny reguleringsplan, ny Doffin-tildeling); «Hvem bestemmer X i Tromsø?» (spørsmål → beslutningskjede: saksbehandlende enhet → utvalg → kommunestyre → klageinstans Statsforvalteren); eksport (CSV/API) |
| MVP-omfang | Tromsø kommune + Troms fylkeskommune + ~60 statlige enheter + alle kommunale/fylkeskommunale selskaper + topp 200 private selskaper i Troms etter omsetning + 21 kommuners politiske toppstruktur; 3 måneder |
| Ikke i MVP | Personbilder, enkeltdommere, lavere politinivå, aksjonærer under terskel, skattedata, nasjonal dekning |
| Prismodell | Gratis: organprofiler og begrenset søk · Pro 490 kr/mnd: graf, historikk, varsler · Team 2 900 kr/mnd (5 brukere): eksport, vektjustering · Enterprise/API: fra 60 k kr/år · Redaksjon/frivillig: rabatt (alle priser er forslag) |
| Suksessmål | Datakvalitet: ≥ 98 % av aktive roller med kilde < 90 dager; ≤ 48 t fra Brreg-endring til synlig; 150 betalende kontoer etter 12 mnd; < 1 % personer med innsigelse; korrigering behandlet < 72 t |
| Risikoer | Juridisk (GDPR-klage, databasevern) → primærkilder + DPIA; datakvalitet (navnelikhet) → entity resolution + manuell kuratering; omdømme («overvåking») → institusjon-først, åpen metodikk; kildeendring (kommunale portaler) → adapter-lag + overvåking; strukturendringer (byråd 2027, regionreform) → temporal modell |

### DEL 5 – Teknisk spesifikasjon for Claude Code

#### 5.1 Stack

| Lag | Valg |
|---|---|
| DB | Postgres 16 (Supabase) + `pg_trgm`, `unaccent`, `btree_gist` (tidsintervaller), `pgvector` (valgfritt for navnematch) |
| Graf | Postgres-kanttabell + rekursive CTE; eksport til Apache AGE eller Neo4j kun hvis nødvendig |
| Backend | TypeScript (Next.js route handlers) eller Python FastAPI for ingestion |
| Jobbkjøring | Supabase cron / pg_cron + worker (Node/Python) med kø (pgmq) |
| Søk | Postgres FTS (norsk konfig) + trigram; senere Meilisearch/Typesense |
| Frontend | Next.js + Tailwind; nettverk: Sigma.js/Graphology (store grafer) eller Cytoscape.js |
| Auth/betaling | Supabase Auth + Stripe |
| Observability | Sentry, kildehelse-dashboard |

#### 5.2 SQL-skjema (Postgres)

```sql
create extension if not exists pg_trgm; create extension if not exists btree_gist;

create table kilde (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('brreg_enhet','brreg_rolle','regnskap','aksjonaer','einnsyn',
        'kommune_innsyn','doffin','stortinget','lovdata','ssb','valg','nettside','presse','manuell')),
  url text, lisens text, hentet_tid timestamptz not null default now(),
  innhold_hash text, raw jsonb
);

create table organisasjon (
  id uuid primary key default gen_random_uuid(),
  orgnr char(9) unique,                       -- null for utvalg/råd uten orgnr
  navn text not null, kortnavn text,
  nivaa text not null, organtype text not null,
  kommunenr char(4), fylkesnr char(2),
  geografisk_rekkevidde text check (geografisk_rekkevidde in ('kommune','region','fylke','nasjonal','internasjonal')),
  nace text[], ansatte int, nettside text,
  gyldig_fra date, gyldig_til date,           -- opprettet/nedlagt
  status text default 'aktiv', beskrivelse text,
  wikidata_qid text, oppdatert timestamptz default now()
);
create index on organisasjon using gin (navn gin_trgm_ops);

create table organisasjon_navn (             -- navnehistorikk
  org_id uuid references organisasjon, navn text, gyldig daterange, kilde_id uuid references kilde);

create table person (
  id uuid primary key default gen_random_uuid(),
  fullt_navn text not null, fornavn text, etternavn text,
  fodselsaar smallint,                        -- ikke full dato i UI
  brreg_person_hash text,                     -- hash av navn+fødselsdato fra Rolle-API, for match
  wikidata_qid text, stortinget_id text,
  sensitiv_rolle boolean default false,       -- dommer/politi/forsvar → begrenset visning
  innsigelse_status text default 'ingen',
  oppdatert timestamptz default now()
);
create index on person using gin (fullt_navn gin_trgm_ops);

create table rolle (                          -- stillingen/vervet, uavhengig av innehaver
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisasjon,
  rolletype text not null, tittel text not null,
  rollevekt numeric(3,2), er_lovpalagt boolean,
  gyldig daterange not null default daterange(current_date, null)
);

create table rolleinnehav (
  id uuid primary key default gen_random_uuid(),
  rolle_id uuid not null references rolle, person_id uuid not null references person,
  gyldig daterange not null,                  -- [fra, til)
  status text check (status in ('fast','fungerende','konstituert','permisjon','vara')),
  parti text,                                 -- kun folkevalgte
  kilde_id uuid references kilde, sist_verifisert date,
  exclude using gist (rolle_id with =, person_id with =, gyldig with &&)
);

create table relasjon (                       -- org↔org
  id uuid primary key default gen_random_uuid(),
  fra_org uuid references organisasjon, til_org uuid references organisasjon,
  type text check (type in ('eier','overordnet','medlem_av','sammenslatt_til','splittet_fra',
        'erstattet_av','samarbeid','finansierer','klageinstans_for','tilsyn_med','leverandor_til')),
  andel numeric(6,3), belop_nok bigint,
  gyldig daterange not null, kilde_id uuid references kilde
);

create table ansvarsomraade (id serial primary key, kode text unique, navn text, hjemmel_lovdata text);
create table org_ansvar (org_id uuid references organisasjon, ansvar_id int references ansvarsomraade,
  myndighetstype text, gyldig daterange, primary key (org_id, ansvar_id, myndighetstype));

create table naeringssegment (id serial primary key, kode text unique, navn text, nace_prefiks text[]);
create table org_segment (org_id uuid references organisasjon, segment_id int references naeringssegment,
  styrke numeric(3,2), begrunnelse text, primary key (org_id, segment_id));

create table noekkeltall (org_id uuid references organisasjon, aar smallint, type text, -- omsetning/egenkapital/budsjett/utlaan
  verdi_nok bigint, konsern boolean, kilde_id uuid references kilde, primary key (org_id, aar, type, konsern));

create table endringshendelse (
  id bigserial primary key, entitet text, entitet_id uuid,
  type text check (type in ('opprettet','endret','avsluttet','sammenslaatt','splittet','rollebytte','navnebytte')),
  foer jsonb, etter jsonb, oppdaget timestamptz default now(),
  kilde_id uuid references kilde, kurator_status text default 'auto'   -- auto|til_vurdering|godkjent|avvist
);

create table score (entitet text, entitet_id uuid, beregnet date, total numeric(5,2),
  komponenter jsonb, versjon text, primary key (entitet, entitet_id, beregnet));

create table innsigelse (id uuid primary key default gen_random_uuid(), person_id uuid references person,
  type text check (type in ('retting','protest','sletting')), tekst text, status text, mottatt timestamptz default now());
```

**Grafrelasjoner (logisk):** `(Person)-[INNEHAR {gyldig}]->(Rolle)-[I]->(Organisasjon)`; `(Org)-[EIER {andel}]->(Org)`; `(Org)-[OVERORDNET]->(Org)`; `(Org)-[ERSTATTET_AV|SAMMENSLATT_TIL|SPLITTET_FRA]->(Org)`; `(Org)-[KLAGEINSTANS_FOR]->(Org)`; `(Org)-[PAVIRKER {styrke}]->(Segment)`. Visning «per dato X»: filtrer alle kanter med `gyldig @> X`.

**Eksempel – fylkesdelingen 2024:** `Troms og Finnmark fylkeskommune` (gyldig 2020-01-01–2023-12-31) → `splittet_fra`-relasjoner til `Troms fylkeskommune` og `Finnmark fylkeskommune` (fra 2024-01-01); `Troms fylkeskommune` (1838–2019) → `sammenslatt_til` T&F. Samme mønster for politidistrikt, statsforvalterembeter og eventuell byrådsovergang.

#### 5.3 Ingestion-pipeline

| Kilde | Jobb | Frekvens | Endringsdeteksjon |
|---|---|---|---|
| Enhetsregisteret | Fullfil ved oppstart; deretter `/oppdateringer/enheter?dato=` | Hver time | Oppdateringsid + hash av relevante felt → `endringshendelse` |
| Rolle-API | Per orgnr i scope (kommune 5501 + fylke 55 + utvalgte) etter endringsvarsel, ellers ukentlig full sweep | Hendelsesstyrt + ukentlig | Diff på (rolle, person-hash) |
| Regnskapsregisteret | Per orgnr | Daglig i juni–sept., ellers månedlig | Nytt regnskapsår |
| Aksjonærregisteret | Bestill CSV i mai | Årlig | Diff mot fjoråret; lagre kun eiere over terskel + alle juridiske personer |
| Kommunale innsynsportaler | Adapter per leverandør (Acos, Elements, Tieto) – utvalg, medlemmer, møter, saker | Daglig | Hash av medlemsliste per utvalg |
| eInnsyn | API-søk på tilsluttede organer, nøkkelord (reguleringsplan, dispensasjon, konsesjon) | Daglig | Nye journalposter |
| Doffin | Public API, filter på oppdragsgivere i scope | Daglig | Nye kunngjøringer/tildelinger |
| Stortinget, valg | API | Ukentlig / per valg | Diff |
| Organnettsider (ledelsessider) | Hent + LLM-uttrekk av «rolle: navn» → **til_vurdering** | Ukentlig | Hash av side; aldri auto-publiser |
| Pressemeldinger (NTB, Mynewsdesk RSS) | Nøkkelord «ansatt som», «ny direktør», «konstituert» | Hver time | Lag kurator-oppgave |

**Entity resolution (personer):** 1) Brreg-rolle gir navn + fødselsdato → `brreg_person_hash` (sterkeste nøkkel; lagre hash, vis kun fødselsår). 2) Uten fødselsdato: blokkering på normalisert etternavn + fornavn-initial, deretter score = navnelikhet (Jaro-Winkler) + samme kommune + felles organisasjon + tidsoverlapp. 3) Terskel ≥ 0,92 auto-merge; 0,75–0,92 kurator-kø; < 0,75 ny person. 4) Alle merges reverserbare (`person_merge`-logg).

**Versjonering:** all tidsdimensjon i `daterange`; ingen sletting, bare lukking av intervall; `endringshendelse` er append-only; kilde per rad; «som per dato»-spørringer.

**Kuratering:** admin-UI med kø (`kurator_status`), side-ved-side kildevisning, fire-øyne-prinsipp for sensitive roller.

#### 5.4 API-endepunkter (REST, `/api/v1`)

```
GET  /organisasjoner?q=&nivaa=&type=&kommunenr=&segment=&dato=
GET  /organisasjoner/{id}                 # profil + ansvar + segmenter + nøkkeltall + score
GET  /organisasjoner/{id}/roller?dato=
GET  /organisasjoner/{id}/relasjoner?type=&dybde=2&dato=
GET  /organisasjoner/{id}/historikk
GET  /personer/{id}                        # kun rolleportefølje
GET  /graf?senter={id}&dybde=2&dato=&typer=eier,styre
GET  /hvem-bestemmer?tema=reguleringsplan&kommunenr=5501
GET  /endringer?siden=&kommunenr=&segment=
POST /varsler  {filter}                    # abonnement
POST /innsigelser {person_id,type,tekst}
GET  /kilder/{id}
```

#### 5.5 Seed-datasett (JSON-skjema + eksempler)

```json
{
  "organisasjoner": [
    {"key":"tromso_kommune","orgnr":"940101808","navn":"Tromsø kommune","nivaa":"kommune",
     "organtype":"kommune","kommunenr":"5501","geografisk_rekkevidde":"kommune",
     "myndighet":["vedtak","planmyndighet","eierskap","innkjop","finansiering"],
     "segmenter":["eiendom_bygg","reiseliv","transport","helse","utdanning"],
     "kilde":"https://www.tromso.kommune.no/politikk/politisk-organisering/kommunestyret"},
    {"key":"tromso_kommunestyre","navn":"Tromsø kommunestyre","nivaa":"kommune","organtype":"folkevalgt_organ",
     "overordnet":"tromso_kommune","antall_medlemmer":43,"gyldig_fra":"2023-10-11"},
    {"key":"tromso_kbu","navn":"Kommune- og byutviklingsutvalget","organtype":"utvalg",
     "overordnet":"tromso_kommunestyre","antall_medlemmer":11,"myndighet":["innstilling","planmyndighet"],
     "segmenter":["eiendom_bygg","reiseliv","handel"]},
    {"key":"troms_fk","navn":"Troms fylkeskommune","nivaa":"fylke","organtype":"fylkeskommune",
     "gyldig_fra":"2024-01-01","splittet_fra":"troms_finnmark_fk"},
    {"key":"troms_finnmark_fk","navn":"Troms og Finnmark fylkeskommune","nivaa":"fylke",
     "gyldig_fra":"2020-01-01","gyldig_til":"2023-12-31","status":"nedlagt"},
    {"key":"sf_tf","navn":"Statsforvalteren i Troms og Finnmark","nivaa":"stat","organtype":"statsforvalter",
     "geografisk_rekkevidde":"region","myndighet":["klage","tilsyn","planmyndighet"]},
    {"key":"troms_kraft","orgnr":"979468792","navn":"Troms Kraft AS","nivaa":"privat","organtype":"AS",
     "segmenter":["energi"]},
    {"key":"snn","orgnr":"952706365","navn":"SpareBank 1 Nord-Norge","nivaa":"privat","organtype":"sparebank",
     "segmenter":["finans"],"myndighet":["finansiering"]},
    {"key":"remiks_miljopark","orgnr":"894462132","navn":"Remiks Miljøpark AS","organtype":"AS","segmenter":["avfall_miljo"]},
    {"key":"grotsund","orgnr":"934106709","navn":"Grøtsund Industripark AS","organtype":"AS",
     "gyldig_fra":"2024-06-28","segmenter":["eiendom_bygg","transport"]}
  ],
  "relasjoner": [
    {"fra":"tromso_kommune","til":"troms_kraft","type":"eier","andel":40.0},
    {"fra":"tromso_kommune","til":"remiks_miljopark","type":"eier","andel":99.99},
    {"fra":"tromso_kommune","til":"grotsund","type":"eier","andel":50.0},
    {"fra":"sf_tf","til":"tromso_kommune","type":"klageinstans_for"},
    {"fra":"troms_finnmark_fk","til":"troms_fk","type":"splittet_fra","gyldig_fra":"2024-01-01"}
  ],
  "rolleinnehav": [
    {"org":"tromso_kommune","rolle":"Ordfører","person":"Gunnar Wilhelmsen","parti":"Ap","fra":"2023-10-11","status":"fast"},
    {"org":"tromso_kommune","rolle":"Varaordfører","person":"Sigrid Hammer","parti":"SV","fra":"2023-10-11"},
    {"org":"tromso_kommune","rolle":"Kommunedirektør","person":"Stig Tore Johnsen","til":"2025-09-30"},
    {"org":"tromso_kommune","rolle":"Kommunedirektør","person":"Mari Enoksen Hult","fra":"2025-09-30","status":"konstituert","til":"[verifiser]"},
    {"org":"tromso_kommune","rolle":"Kommunedirektør","person":"Ellen Beate Lundberg","fra":"[verifiser]","status":"fast"},
    {"org":"troms_fk","rolle":"Fylkesordfører","person":"Kristina Torbergsen","parti":"Ap","fra":"2023-10-25","status":"permisjon"},
    {"org":"troms_fk","rolle":"Fylkesordfører","person":"Benjamin Nordberg Furuly","parti":"H","status":"fungerende","til_forventet":"2027-01-15"},
    {"org":"troms_fk","rolle":"Fylkeskommunedirektør","person":"Camilla Bjørn"},
    {"org":"sf_tf","rolle":"Statsforvalter","person":"Runar Sjåstad","fra":"2025-08-01","status":"fast"},
    {"org":"sf_tf","rolle":"Assisterende statsforvalter","person":"Katrine Storeheier","fra":"2025-04"},
    {"org":"snn","rolle":"Konsernsjef","person":"Hanne Karoline Kræmer","fra":"2024-01-01"},
    {"org":"snn","rolle":"Styreleder","person":"Eirik Frantzen","fra":"2022"},
    {"org":"troms_kraft","rolle":"Konsernsjef","person":"Erling Andreas Dalberg"},
    {"org":"remiks_miljopark","rolle":"Daglig leder","person":"Britt Hege Mathisen Limo"},
    {"org":"grotsund","rolle":"Styreleder","person":"Kjell-Are Vassmyr"}
  ]
}
```

CSV-varianter: `organisasjoner.csv`, `relasjoner.csv`, `rolleinnehav.csv`, `kilder.csv` med samme kolonner; `key` er stabil slug brukt for idempotent import.

## Recommendations

1. **Uke 1–2:** Sett opp skjemaet over, importer Enhetsregisterets totalfil og filtrer på kommunenummer i Troms (5501 m.fl.) + statlig struktur-fil; hent roller for alle offentlige enheter og selskaper eid av kommune/fylke.
2. **Uke 3–4:** Bygg adapter for innsyn.tromso.kommune.no (utvalgsmedlemmer via `commission_id`) og tilsvarende for fylkeskommunen; seed manuelt de ~40 nøkkelrollene i denne rapporten med kilde og «sist verifisert».
3. **Uke 5–8:** Regnskap + Doffin + eInnsyn; implementer score v0.1 med åpne vekter; kurator-UI.
4. **Juridisk før lansering:** DPIA + interesseavveining, personvernerklæring, innsigelsesflyt; få advokatvurdering av terskelen for aksjonærvisning. Ikke scrape Proff/Purehelp; kontakt Proff for API-pris hvis konsernstruktur trengs raskt.
5. **Bygg for 2027:** modeller byrådsscenario og kommunevalget 2027 som planlagte strukturendringer; varsling ved konstituering.

## Caveats

- **Utdateringsrisiko:** valg 2023 (kommune/fylke) og 2025 (Storting); fylkesdeling 1.1.2024; fungerende fylkesordfører til jan. 2027; kommunedirektørbyttet i Tromsø 2025–2026; Troms Kraft fikk ny styreleder (Åslaug Haga, 14.5.2025) og Macks Ølbryggeri har fått ny adm. dir. etter Harald Bredrup (Roger Karlsen ifølge Godt Drikke – verifiser i Brreg).
- **Sekundærkilder:** Selskapstall er i hovedsak hentet fra Purehelp/Proff-sammendrag (bygger på Brreg) og blander tidvis morselskap og konsern; alle må verifiseres mot Regnskapsregisteret før publisering. Tromsøs underskuddstall er nå hentet fra NRK og Tromsø kommune; merk at 205,1 mill. (2024) er merforbruk, mens 271 mill. er NRKs tall for underskuddet samme år.
- **Styringsmodell-konflikt i Troms fylkeskommune:** offisiell side sier formannskapsmodell; 2023-omtale nevner fylkesråd – verifiser gjeldende reglement.
- **Hull:** navn på domstolsledere, regiondirektører i statlige etater, utvalgsledere i Tromsø og flere selskapsledere er ikke verifisert i denne runden og er merket **[verifiser]**; politimesterens nøyaktige utnevnelsesdato gjenstår.
- **Score og betalingsvilje** er estimater/antakelser, ikke målte størrelser.
- **Juridiske vurderinger** er et faglig utgangspunkt, ikke juridisk rådgivning.