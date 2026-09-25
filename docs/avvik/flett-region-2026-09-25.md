# Fletting av folkevalgte, kommuneledelse og regionale organer i alle 80 kommuner

Flettet 25.09.2026. Inn: seks staging-filer, alle kontrollert av en uavhengig verifikator (`valgte-55-56`, `valgte-18`, `kommuneledelse-55-56`, `kommuneledelse-18`, `finnmark-regionalt` og `nordland-regionalt`, med rapportene sine), de 80 datasettene fra Brreg-importen og regionregisteret. Ut: de 80 datasettene i `src/data/`, dekningsregisteret `src/data/region/dekning.json`, Kartverkets navneform for Porsanger i `src/data/region/nord-norge.json`, to `koblinger` i `scripts/brreg.config.json`, importørens avviksrapporter og denne rapporten.

Flettingen er kjørt som skript mot git HEAD, og så er importøren kjørt på resultatet fra mellomlageret (`npm run brreg -- <alle 80>`). Det er importørens resultat som står i repoet. En ny kjøring gir byte-like filer (se «Kontroll»).

## Kort

| | Før | Etter |
|---|---:|---:|
| Organer | 1 656 | 2 190 |
| Personer | 3 669 | 5 431 |
| Roller | 4 748 | 6 934 |
| – verifisert | 4 575 | 6 321 |
| – oppgitt | 168 | 605 |
| – må verifiseres | 5 | 8 |
| Relasjoner | 519 | 1 055 |
| Hull | 74 | 346 |
| Hendelser | 24 | 26 |
| Beslutningskjeder | 2 | 161 |
| Kilder | 79 | 422 |

Tallene er over hele samlingen, med hver rad én gang (et organ som står i flere filer, telles én gang).

- **Hver kommune** har nå kommunen som grunnlagsrad med orgnr, administrasjonen, kommunestyret med medlemmene fra valgoppgjøret 2023, formannskapet og de faste utvalgene med ledere, ordfører og varaordfører der kommunens sider oppgir dem, og kommunedirektøren. Kommunedirektøren er bekreftet mot registerets daglige leder der kommunens side navngir henne; ellers står registerets daglige leder på kommunen.
- **Regionale organer** står i hver kommune de har myndighet over, etter dekningsregisteret (se «Dekning»). Importøren kopierer raden inn ved hver kjøring; rollene står bare hos eieren.
- **Beslutningskjeder** for reguleringsplan og budsjett i alle 79 kommuner utenom Tromsø, bygget etter lovens steg. Lovdata svarte ikke, så lovhjemmelen mangler og står som hull i hver kommune (se «Lovdata»).
- **Karlsøy og Sametinget** har én nøkkel hver. Det var de to tilfellene av samme enhet under to nøkler.
- **Porsanger** heter «Porsanger - Porsáŋgu - Porsanki», Kartverkets form.

## Per fylke

| Fylke | Kommuner | Organer | Roller | Verifisert | Oppgitt | Må verifiseres | Kommunestyreseter | Mandater | Ordfører oppgitt | Kommunedirektør bekreftet | Bare registerets daglige leder |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Nordland | 41 | 1 530 | 3 321 | 3 097 | 221 | 3 | 839 | 839 | 41 | 37 | 4 |
| Troms | 21 | 975 | 2 464 | 2 172 | 287 | 5 | 433 | 435 | 21 | 19 | 2 |
| Finnmark | 18 | 598 | 1 149 | 1 052 | 97 | 0 | 342 | 342 | 17 | 12 | 6 |

Organer og roller er summen av radene i kommunenes filer: et regionalt organ som står i 20 kommuner, telles 20 ganger, og rollene telles der de står (hos eieren). Kommunestyreseter er rollene fra valgoppgjøret, også de som er merket motsagt. Tromsø har dagens sammensetning fra tromso.digdem.no, ikke valgoppgjøret.

## Per kommune

Organer og roller er radene i kommunens egen fil. Seter er medlemmer fra valgoppgjøret (motsagt i parentes); mandater er fra valgresultat.no. Regionale er organene i dekningsregisteret som dekker kommunen. Kjede: planorganet i reguleringsplankjeden («–» = ikke kartlagt).

| Nr | Kommune | Organer | Roller | Verif. | Oppgitt | Må verif. | Seter | Mandater | Ordfører | Kommunedirektør | Regionale | Plan i kjeden |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|
| 1804 | Bodø | 181 | 616 | 585 | 31 | 0 | 39 | 39 | Odd Emil Ingebrigtsen | Kjell Hugvik | 8 | Plan- og miljøutvalget |
| 1806 | Narvik | 79 | 192 | 185 | 7 | 0 | 31 | 31 | Rune Edvardsen | Lars Norman Andersen | 8 | Hovedutvalg for plan og utvikling |
| 1811 | Bindal | 22 | 42 | 37 | 5 | 0 | 17 | 17 | Frode Næsvold | Knut Toresen | 8 | Formannskapet |
| 1812 | Sømna | 28 | 46 | 41 | 5 | 0 | 17 | 17 | Gunder Strømberg | Ben Andre Graven | 8 | Formannskapet |
| 1813 | Brønnøy | 40 | 64 | 58 | 6 | 0 | 23 | 23 | Siv Therese Aglen | Frank Grønbeck Nilsen | 8 | Plan- og næringsutvalget |
| 1815 | Vega | 22 | 38 | 34 | 4 | 0 | 15 | 15 | Jon Albert Johansen Floa | registerets daglige leder | 8 | Formannskapet |
| 1816 | Vevelstad | 17 | 19 | 14 | 5 | 0 | 13 | 13 | Bjørg Ireen Fønnebø | Morten A. Karlsen (konstituert), Renate Mathisen | 8 | Formannskapet |
| 1818 | Herøy | 28 | 58 | 54 | 4 | 0 | 19 | 19 | Elbjørg Larsen | Henrik Skovly | 8 | Formannskapet |
| 1820 | Alstahaug | 40 | 86 | 79 | 7 | 0 | 27 | 27 | Peter-Arne Talseth | Rachel Elise Berg | 8 | Planutvalget |
| 1822 | Leirfjord | 22 | 30 | 25 | 5 | 0 | 19 | 19 | Sten Rino Bonsaksen | Peter Andre Haaland | 8 | Plan- og næringsutvalg |
| 1824 | Vefsn | 54 | 167 | 161 | 6 | 0 | 29 | 29 | Rune Krutå | Trine Fåkvam | 8 | Formannskapet |
| 1825 | Grane | 19 | 31 | 27 | 4 | 0 | 17 | 17 | Raymond Fagerli | Børge Steinmo Johnsen | 8 | Formannskapet |
| 1826 | Hattfjelldal | 21 | 31 | 27 | 4 | 0 | 15 | 15 | Sølvi Andersen | Asbjørn Engum | 9 | Plan- og ressursutvalg |
| 1827 | Dønna | 22 | 34 | 30 | 4 | 0 | 17 | 17 | John Erik Skjellnes Johansen | Tor Henning Jørgensen | 8 | Formannskapet |
| 1828 | Nesna | 29 | 53 | 47 | 6 | 0 | 17 | 17 | Hanne Davidsen | Odd Steinar Åfar Viseth | 8 | Formannskapet |
| 1832 | Hemnes | 33 | 49 | 42 | 7 | 0 | 23 | 23 | Paul Magnor Asphaug | Cathrine Theting | 8 | Formannskapet |
| 1833 | Rana | 85 | 276 | 268 | 8 | 0 | 37 | 37 | Geir Morten Waage | registerets daglige leder | 8 | Utvalg for miljø, plan og ressurs |
| 1834 | Lurøy | 28 | 68 | 63 | 5 | 0 | 19 | 19 | Håkon Lund | Stian Kyrre Skjærvik | 8 | Formannskapet |
| 1835 | Træna | 27 | 40 | 37 | 3 | 0 | 11 | 11 | Trond Vegard Sletten | Torild Fogelberg Hansen | 8 | Formannskapet |
| 1836 | Rødøy | 24 | 33 | 28 | 5 | 0 | 17 | 17 | Inger Monsen | Harald Einar Erichsen | 8 | Formannskapet |
| 1837 | Meløy | 39 | 55 | 50 | 5 | 0 | 23 | 23 | Grethe Anita Andersen | Marianne Stranden | 8 | Utvalg for plan og kommunalteknikk |
| 1838 | Gildeskål | 33 | 49 | 42 | 6 | 1 | 17 | 17 | Bjørn Magne Pedersen | Geir Mikkelsen | 8 | Plan og eiendomsutvalget |
| 1839 | Beiarn | 23 | 29 | 25 | 4 | 0 | 15 | 15 | André Kristoffersen | Ole Petter Nybakk | 8 | Plan- og driftsutvalget |
| 1840 | Saltdal | 35 | 72 | 66 | 6 | 0 | 21 | 21 | Runar Jensen | Stein Ole Bauer-Rørvik | 8 | Formannskapet |
| 1841 | Fauske | 40 | 78 | 73 | 5 | 0 | 27 | 27 | Marlen Rendall Berg | Tom Erik Holteng | 8 | Plan-, utvikling og klimautvalget |
| 1845 | Sørfold | 32 | 38 | 33 | 3 | 2 | 17 | 17 | Kolbjørn Mathisen | Torill Mørkhagen | 8 | Plan- og ressursutvalget |
| 1848 | Steigen | 30 | 35 | 30 | 5 | 0 | 17 | 17 | Aase Refsnes | Connie Pettersen | 8 | Plan-og ressursutvalg |
| 1851 | Lødingen | 25 | 43 | 40 | 3 | 0 | 17 | 17 | Hugo André Bongard Jacobsen | Trude Vollheim | 8 | Formannskapet |
| 1853 | Evenes | 28 | 27 | 25 | 2 | 0 | 17 | 17 | Terje Ingve Bartholsen | Elisabet Norlund | 8 | – |
| 1856 | Røst | 22 | 29 | 25 | 4 | 0 | 11 | 11 | Elisabeth Kristin Mikalsen | Cesilie Janette Borge | 8 | Formannskapet |
| 1857 | Værøy | 27 | 29 | 27 | 2 | 0 | 13 | 13 | Susan Berg Kristiansen | registerets daglige leder | 8 | Formannskapet |
| 1859 | Flakstad | 27 | 48 | 45 | 3 | 0 | 11 | 11 | Einar Benjamin Benjaminsen | Per Øivind Sundell | 8 | Formannskapet |
| 1860 | Vestvågøy | 57 | 161 | 155 | 6 | 0 | 33 | 33 | Jonny Finstad | registerets daglige leder | 8 | Formannskapet |
| 1865 | Vågan | 53 | 147 | 140 | 7 | 0 | 29 | 29 | Vidar Thom Benjaminsen | Tommy Stensvik | 8 | Hovedutvalg for miljø, plan og næring |
| 1866 | Hadsel | 41 | 84 | 78 | 6 | 0 | 25 | 25 | Kjell-Børge Freiberg | Øyvind Korsberg (konstituert) | 8 | Formannskapet |
| 1867 | Bø | 29 | 44 | 39 | 5 | 0 | 19 | 19 | Sture Ivar Pedersen | Kine Anette Johnsen | 8 | Formannskapet |
| 1868 | Øksnes | 31 | 76 | 74 | 2 | 0 | 21 | 21 | Elisabeth Sørdahl | Vegar Hoel | 8 | Formannskapet |
| 1870 | Sortland | 49 | 125 | 122 | 3 | 0 | 27 | 27 | Grete Ellingsen | Leif Åsmund Hovden (konstituert) | 8 | Formannskapet |
| 1871 | Andøy | 29 | 65 | 63 | 2 | 0 | 23 | 23 | Kjell Are Johansen | Sveinung Ellingsen | 8 | Formannskapet |
| 1874 | Moskenes | 27 | 42 | 38 | 4 | 0 | 17 | 17 | Hanna Mathilde Sverdrup | Ketil Finstad-Steira | 8 | Formannskapet |
| 1875 | Hamarøy | 32 | 72 | 65 | 7 | 0 | 17 | 17 | Britt Kristoffersen Løksa | Odd Børge Pedersen | 9 | Formannskapet |
| 5501 | Tromsø | 347 | 1214 | 1040 | 169 | 5 | 41 | 43 | Gunnar Wilhelmsen | Ellen Beate Lundberg | 6 | (Tromsøs egen) |
| 5503 | Harstad | 96 | 243 | 233 | 10 | 0 | 35 | 35 | Else Marie Stenhaug | Lasse Hagerupsen | 8 | Utvalg for plan og næring |
| 5510 | Kvæfjord | 30 | 36 | 30 | 6 | 0 | 23 | 23 | Birger Holand | Per Bjørn Holm-Varsi | 8 | Formannskapet |
| 5512 | Tjeldsund | 28 | 68 | 62 | 6 | 0 | 17 | 17 | Robin Ridderseth | Bjørn Tore Sørensen | 9 | Planutvalget |
| 5514 | Ibestad | 23 | 55 | 50 | 5 | 0 | 17 | 17 | Jim Kristiansen | Hildegunn Thode Hansen | 8 | Formannskapet |
| 5516 | Gratangen | 28 | 61 | 54 | 7 | 0 | 15 | 15 | Anita Karlsen | Thomas Richard Schjelderup | 8 | Formannskapet |
| 5518 | Lavangen | 26 | 48 | 44 | 4 | 0 | 15 | 15 | Hege Beate Myrseth Rollmoen | Karin Eriksen | 9 | Planutvalget |
| 5520 | Bardu | 26 | 51 | 46 | 5 | 0 | 19 | 19 | Toralf Heimdal | Vegard Johansen | 7 | Utvalg for plan, levekår og utmark |
| 5522 | Salangen | 33 | 52 | 44 | 8 | 0 | 19 | 19 | Mathias André Jenssen (fungerende), Simon Løvhaug (permisjon) | Bente Johnsen Karlsen | 8 | Formannskapet |
| 5524 | Målselv | 26 | 59 | 53 | 6 | 0 | 23 | 23 | Martin Nymo | registerets daglige leder | 6 | Plan-, miljø- og næringsutvalget |
| 5526 | Sørreisa | 25 | 54 | 46 | 8 | 0 | 19 | 19 | Jan-Eirik Nordahl | registerets daglige leder | 6 | Plan- og miljøutvalget |
| 5528 | Dyrøy | 20 | 31 | 27 | 4 | 0 | 15 | 15 | Marit Alvig Espenes | Tore Uthaug (konstituert) | 7 | Formannskapet |
| 5530 | Senja | 56 | 146 | 143 | 3 | 0 | 31 | 31 | Geir Inge Sivertsen | Stine Jakobsson Strømsø | 6 | Formannskapet |
| 5532 | Balsfjord | 26 | 57 | 52 | 5 | 0 | 19 | 19 | Laila Monica Johannessen | Sten Tore Svennes | 6 | Formannskapet |
| 5534 | Karlsøy | 30 | 33 | 28 | 5 | 0 | 17 | 17 | Mona Benjaminsen | Lars Steinar Laingen | 6 | Plan- og driftsutvalget |
| 5536 | Lyngen | 23 | 59 | 52 | 7 | 0 | 19 | 19 | Eirik Larsen | Frode Karlsen | 6 | Formannskapet |
| 5538 | Storfjord | 28 | 37 | 32 | 5 | 0 | 17 | 17 | Geir-Johnny Varvik | Maria Figenschau | 6 | Miljø-, plan- og driftsstyret |
| 5540 | Kåfjord | 27 | 39 | 31 | 8 | 0 | 17 | 17 | Bernt Eirik Isaksen Lyngstad | Gunn Andersen | 7 | Formannskapet |
| 5542 | Skjervøy | 26 | 53 | 48 | 5 | 0 | 19 | 19 | Ørjan Albrigtsen | Grete Synnøve Jacobsen | 6 | Formannskapet |
| 5544 | Nordreisa | 28 | 39 | 33 | 6 | 0 | 21 | 21 | Hilde Anita Nyvoll | Siri Ytterstad | 6 | Formannskapet |
| 5546 | Kvænangen | 23 | 29 | 24 | 5 | 0 | 15 | 15 | Kai Petter Johansen | Stian Lindgård | 7 | Utvalg for plan, utvikling og teknisk |
| 5601 | Alta | 82 | 236 | 231 | 5 | 0 | 35 | 35 | Jan Martin Rishaug (fungerende), Monica Nielsen (permisjon) | registerets daglige leder | 10 | Formannskapet |
| 5603 | Hammerfest | 60 | 129 | 126 | 3 | 0 | 29 | 29 | Terje Rogde | Elisabeth Paulsen | 10 | Formannskapet |
| 5605 | Sør-Varanger | 40 | 86 | 84 | 2 | 0 | 25 | 25 | Magnus Mæland | Nina Cecilie Bordi Øvergaard | 10 | – |
| 5607 | Vadsø | 28 | 124 | 109 | 15 | 0 | 21 | 21 | **ikke oppgitt** | registerets daglige leder | 10 | – |
| 5610 | Karasjok | 32 | 36 | 23 | 13 | 0 | 19 | 19 | Kjell Olav Johansen Guttorm | Rune Sverre Fjellheim | 11 | Hovedutvalg for miljø, plan og samfunnsutvikling |
| 5612 | Kautokeino | 25 | 42 | 40 | 2 | 0 | 19 | 19 | Anders S. Buljo | registerets daglige leder | 11 | – |
| 5614 | Loppa | 25 | 34 | 30 | 4 | 0 | 15 | 15 | Cato Robert Kristiansen | registerets daglige leder | 10 | Formannskapet |
| 5616 | Hasvik | 27 | 32 | 26 | 6 | 0 | 15 | 15 | Lars Adler Hustad | Laila Helen Opdal Korsvoll | 10 | Formannskapet |
| 5618 | Måsøy | 31 | 45 | 38 | 7 | 0 | 15 | 15 | Ingrid Majala | Fredrik Schevik Johnson | 10 | Formannskapet |
| 5620 | Nordkapp | 35 | 64 | 58 | 6 | 0 | 19 | 19 | Jan Morten Hansen | Inger Lise Høvik | 10 | Planutvalget |
| 5622 | Porsanger | 31 | 60 | 53 | 7 | 0 | 19 | 19 | Jo Inge Hesjevik | Linn Carina Utsi | 11 | Formannskapet |
| 5624 | Lebesby | 25 | 27 | 24 | 3 | 0 | 17 | 17 | Kristin Johnsen | Harald Larssen | 10 | Formannskapet |
| 5626 | Gamvik | 24 | 29 | 27 | 2 | 0 | 13 | 13 | Ragnhild Vassvik | registerets daglige leder | 10 | – |
| 5628 | Tana | 35 | 44 | 37 | 7 | 0 | 19 | 19 | Jon Erland Balto | Jørgen Holten Jørgensen | 11 | Formannskapet |
| 5630 | Berlevåg | 24 | 31 | 28 | 3 | 0 | 13 | 13 | Rolf Øystein Laupstad | Sten Albert Reisænen | 10 | Formannskapet |
| 5632 | Båtsfjord | 27 | 41 | 40 | 1 | 0 | 15 | 15 | Øyvind Hauken | Helen Johanne Andersen | 10 | – |
| 5634 | Vardø | 29 | 59 | 52 | 7 | 0 | 19 | 19 | Tor-Erik Labahå | Hallgeir Sørnes | 10 | Utvalg for teknisk, næring og plan |
| 5636 | Nesseby | 18 | 30 | 26 | 4 | 0 | 15 | 15 | Berit Ranveig Nilssen | registerets daglige leder | 11 | Formannskapet |

## Hvor radene står, og hvorfor

**Eierskap.** Rollene til et organ står i ett datasett, eierens, valgt etter importørens regel (`fordelEierskap` i `scripts/brreg/importer.ts`): der organet er grunnlag, og blant flere grunnlag kommunen med lavest nummer; ellers kommunen organet ligger i. Nye regionale organer er lagt som grunnlag i kommunen de ligger i. Organer Tromsøs grunnlag allerede førte (Statsforvalteren i Troms og Finnmark, Helse Nord RHF, Sametinget, Finnmark fylkeskommune), eies fortsatt av Tromsø: importøren gir dem dit, og en rolle bekreftet mot registeret i én fil og skrevet av eieren i en annen ville stått to ganger. Derfor står også administrasjonen i Finnmark fylkeskommune og Sametinget (med fylkeskommunedirektøren og direktøren) i tromso.json, mens de folkevalgte organene står der organet ligger: fylkestinget og fylkesutvalget i Vadsø, sametingsrådet og plenumsledelsen i Karasjok.

En grunnlagsrad i en Nordland-fil som viser til et organ Tromsø eier, ville flyttet eierskapet til Nordland (lavere kommunenummer). Derfor er Helse Nords eierrelasjoner til Nordlandssykehuset og Helgelandssykehuset og lagmannsrettens relasjoner til tingrettene ikke tatt med.

| Organ | Eier (datasett) |
|---|---|
| Alta Havn KF (`alta-havn-kf`) | alta |
| Båtsfjord Havn KF (`batsfjord-havn-kf`) | batsfjord |
| Berlevåg Havn KF (`berlevag-havn-kf`) | berlevag |
| Bodø Havn KF (`bodo-havn`) | bodo |
| Digitaliserings- og forvaltningsdepartementet (`digitaliserings-og-forvaltningsdepartementet`) | bodo |
| Finnmark fylkeskommune (`finnmark-fylkeskommune`) | tromso |
| Administrasjonen i Finnmark fylkeskommune (`finnmark-fylkeskommune-administrasjonen`) | tromso |
| Fylkestinget i Finnmark - Finnmárku - Finmarkku (`finnmark-fylkesting`) | vadso |
| Fylkesutvalget i Finnmark - Finnmárku - Finmarkku (`finnmark-fylkesutvalg`) | vadso |
| Finnmark jordskifterett (`finnmark-jordskifterett`) | vadso |
| Finnmark politidistrikt (`finnmark-politidistrikt`) | sor-varanger |
| Finnmarkseiendommen - Finnmárkkuopmodat (`finnmarkseiendommen`) | porsanger |
| Finnmarkskommisjonen (`finnmarkskommisjonen`) | tana |
| Finnmarkssykehuset HF (`finnmarkssykehuset`) | hammerfest |
| Hålogaland lagmannsrett (`halogaland-lagmannsrett`) | tromso |
| Hammerfest Havn KF (`hammerfest-havn-kf`) | hammerfest |
| Helgeland Havn IKS (`helgeland-havn`) | alstahaug |
| Helgeland jordskifterett (`helgeland-jordskifterett`) | vefsn |
| Helgeland tingrett (`helgeland-tingrett`) | rana |
| Helgelandssykehuset HF (`helgelandssykehuset`) | alstahaug |
| Helse Nord RHF (`helse-nord-rhf`) | tromso |
| Sis- ja Nuorta-Finnmárkku diggegoddi - Indre og Østre Finnmark tingrett (`indre-og-ostre-finnmark-tingrett`) | vadso |
| Kirkenes Havn Sør-Varanger Kommunalt Foretak (`kirkenes-havn-kf`) | sor-varanger |
| Lofoten og Vesterålen jordskifterett (`lofoten-og-vesteralen-jordskifterett`) | sortland |
| Måsøy Næring og Havn KF (`masoy-naering-og-havn-kf`) | masoy |
| Midtre Hålogaland tingrett (`midtre-halogaland-tingrett`) | harstad |
| Mo i Rana Havn KF (`mo-i-rana-havn`) | rana |
| Narvik Havn KF (`narvik-havn`) | narvik |
| Nord-Troms jordskifterett (`nord-troms-jordskifterett`) | tromso |
| Nord-Troms og Senja tingrett (`nord-troms-og-senja-tingrett`) | tromso |
| Nord universitet (`nord-universitet`) | bodo |
| Nordkapp Havn KF (`nordkapp-havn-kf`) | nordkapp |
| Nordkappregionen Havn IKS (`nordkappregionen-havn-iks`) | nordkapp |
| Nordland fylkeskommune (`nordland-fylkeskommune`) | bodo |
| Kontrollutvalget i Nordland fylkeskommune (`nordland-fylkeskommune-kontrollutvalg`) | bodo |
| Fylkesrådet i Nordland (`nordland-fylkesrad`) | bodo |
| Fylkestinget i Nordland - Nordlánnda (`nordland-fylkesting`) | bodo |
| Komité for finans og organisasjon i fylkestinget i Nordland (`nordland-komite-finans-og-organisasjon`) | bodo |
| Komité for næring i fylkestinget i Nordland (`nordland-komite-naering`) | bodo |
| Komité for samferdsel i fylkestinget i Nordland (`nordland-komite-samferdsel`) | bodo |
| Komité for samfunn, kultur og miljø i fylkestinget i Nordland (`nordland-komite-samfunn-kultur-og-miljo`) | bodo |
| Komité for utdanning og kompetanse i fylkestinget i Nordland (`nordland-komite-utdanning-og-kompetanse`) | bodo |
| Nordland politidistrikt (`nordland-politidistrikt`) | bodo |
| Nordlandssykehuset HF (`nordlandssykehuset`) | bodo |
| Ofoten og Sør-Troms jordskifterett (`ofoten-og-sor-troms-jordskifterett`) | harstad |
| Remiks Miljøpark AS (`remiks-miljopark`) | tromso |
| Salten jordskifterett (`salten-jordskifterett`) | bodo |
| Salten og Lofoten tingrett (`salten-og-lofoten-tingrett`) | bodo |
| Sametinget (`sametinget`) | tromso |
| Sametingets administrasjon (`sametinget-administrasjonen`) | tromso |
| Sametingets plenumsledelse (`sametinget-plenumsledelsen`) | karasjok |
| Sametingsrådet (`sametingsradet`) | karasjok |
| Statsforvalteren i Nordland (`statsforvalteren-nordland`) | bodo |
| Statsforvalteren i Troms og Finnmark (`statsforvalteren-troms-og-finnmark`) | tromso |
| Stortinget, Finnmark valgkrets (`stortinget-finnmark-valgkrets`) | vadso |
| Stortinget, Nordland valgkrets (`stortinget-nordland-valgkrets`) | bodo |
| Stortinget, Troms valgkrets (`stortinget-troms-valgkrets`) | tromso |
| Troms fylkeskommune (`troms-fylkeskommune`) | tromso |
| Fylkestinget i Troms (`troms-fylkesting`) | tromso |
| Troms politidistrikt (`troms-politidistrikt`) | tromso |
| Trøndelag politidistrikt (`trondelag-politidistrikt`) | bindal |
| Universitetssykehuset Nord-Norge HF (`unn`) | tromso |
| Utmarksdomstolen for Finnmark (`utmarksdomstolen-for-finnmark`) | tromso |
| Vadsø Havn KF (`vadso-havn-kf`) | vadso |
| Vågan Havnevesen KF (`vagan-havnevesen`) | vagan |
| Vardø Havn KF (`vardo-havn-kf`) | vardo |
| Vestre Finnmark tingrett (`vestre-finnmark-tingrett`) | alta |

**Grunnlag, ikke importørens rader.** Alt som er lagt til, har et belegg importøren ikke regner som sitt eget: kommunene og administrasjonene med registerinnhold har `enhetsregisteret`/`oppgitt`; valgoppgjøret har Valgdirektoratet og valgresultat.no; eierkommunen for kommunale foretak og Helse Nords eierskap til Finnmarkssykehuset har den nye kilden `brreg-eierroller`. Staging-rader fra registeret som også en offisiell side oppgir, er lagt inn med siden som kilde (`oppgitt`), og importøren har bekreftet dem ved kjøringen: de står nå med «Bekrefter grunnlaget». Rene registerrader (en daglig leder ingen side navngir) er ikke lagt inn; dem skriver importøren selv hos eieren (9 rader).

**Kopier.** Importøren har fått én ny regel: organene i `src/data/region/dekning.json` kopieres inn i kommunene på lista ved hver kjøring, med kjeden av overordnede, fra datasettet der organet er grunnlag. Uten den ville en kopi uten orgnr (fylkestinget, stortingsbenken) falt bort ved neste kjøring. Endringen står i `scripts/brreg/importer.ts` og `scripts/brreg.ts`, typen i `src/data/region/types.ts`.

## Dekning

Regelen står som data med belegg i `src/data/region/dekning.json`. Hvert regionalt organ står i hver kommune på lista.

| Organ | Kommuner | Kilde for dekningen |
|---|---:|---|
| Finnmark fylkeskommune | 18 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Fylkestinget i Finnmark - Finnmárku - Finmarkku | 18 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Finnmark jordskifterett | 18 | Finnmark jordskifterett: Vår rettskrets (oppgitt) |
| Finnmark politidistrikt | 18 | Politiet: Finnmark politidistrikt (oppgitt) |
| Finnmarkssykehuset HF | 18 | Finnmarkssykehuset: Foretaksledelsen (oppgitt) |
| Helgeland jordskifterett | 17 | Helgeland jordskifterett: Vår rettskrets (oppgitt) |
| Helgeland tingrett | 17 | Helgeland tingrett: Rettssteder og kommuner (Mo i Rana, Brønnøysund, Sandnessjøen) (oppgitt) |
| Helse Nord RHF | 80 | Helse Nord RHF: Om oss (oppgitt) |
| Sis- ja Nuorta-Finnmárkku diggegoddi - Indre og Østre Finnmark tingrett | 11 | Indre og Østre Finnmark tingrett: Om tingretten (oppgitt) |
| Lofoten og Vesterålen jordskifterett | 10 | Lofoten og Vesterålen jordskifterett: Vår rettskrets (oppgitt) |
| Midtre Hålogaland tingrett | 15 | Midtre Hålogaland tingrett: Vår rettskrets (oppgitt) |
| Nordland fylkeskommune | 41 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Fylkestinget i Nordland - Nordlánnda | 41 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Nordland politidistrikt | 41 | Nordland politidistrikt: Politistasjoner og dekningsområde (oppgitt) |
| Ofoten og Sør-Troms jordskifterett | 11 | Ofoten og Sør-Troms jordskifterett: Vår rettskrets (oppgitt) |
| Salten jordskifterett | 12 | Salten jordskifterett: Vår rettskrets (oppgitt) |
| Salten og Lofoten tingrett | 16 | Salten og Lofoten tingrett: Vår rettskrets (oppgitt) |
| Sametinget | 10 | Kartverket kommuneinfo (API) (verifisert) |
| Statsforvalteren i Nordland | 41 | Statsforvalteren i Nordland: Om Statsforvalteren (oppgitt) |
| Statsforvalteren i Troms og Finnmark | 39 | Statsforvalteren (statsforvalteren.no) (oppgitt) |
| Stortinget, Finnmark valgkrets | 18 | Stortingets data (data.stortinget.no) (oppgitt) |
| Stortinget, Nordland valgkrets | 41 | Stortingets data (data.stortinget.no) (oppgitt) |
| Stortinget, Troms valgkrets | 21 | Stortingets data (data.stortinget.no) (oppgitt) |
| Troms fylkeskommune | 21 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Fylkestinget i Troms | 21 | SSB Klass 131: Standard for kommuneinndeling (verifisert) |
| Troms politidistrikt | 20 | Troms politidistrikt: Om oss (oppgitt) |
| Trøndelag politidistrikt | 1 | Nordland politidistrikt: Politistasjoner og dekningsområde (oppgitt) |
| Utmarksdomstolen for Finnmark | 18 | Utmarksdomstolen for Finnmark: Saksbehandling (oppgitt) |
| Vestre Finnmark tingrett | 8 | Vestre Finnmark tingrett: Om Vestre Finnmark tingrett (oppgitt) |

**Ikke dokumentert, derfor bare hos eieren og med et hull:** Nord-Troms og Senja tingrett, Nord-Troms jordskifterett og Hålogaland lagmannsrett (Tromsø), UNN (Tromsø), Nordlandssykehuset (Bodø) og Helgelandssykehuset (Alstahaug). Rettskretsene og opptaksområdene står på organenes egne sider, men er ikke hentet i uttrekkene. Til de er hentet, har 12 kommuner i Troms ingen tingrett og 11 ingen jordskifterett i datasettet.

## Karlsøy, og samme enhet under to nøkler

Før flettingen sto to enheter under to nøkler (skannet over alle 80 filer: samme orgnr med ulike nøkler, og grunnlagsorganer uten orgnr med samme navn som en importørrad):

| Enhet | Før | Nå |
|---|---|---|
| Karlsøy kommune (940330408) | `karlsoy-kommune` i Tromsøs grunnlag (navnekoblet, med daglig leder) og `karlsoy-kommune-940330408` i karlsoy.json | `karlsoy-kommune` med orgnr, i karlsoy.json. `koblinger` for 5534 binder nøkkelen. Eierrelasjonen «Karlsøy resten» i Remiks Miljøpark er flyttet fra Tromsø til Karlsøy, med en kopi av Remiks-raden, så Tromsø ikke lenger har en egen rad for kommunen og ikke fører rollene. Kommunedirektøren (Lars Steinar Laingen) er bekreftet mot registeret i Karlsøy, og nøkkelen er `lars-steinar-laingen` (staging hadde suffiks bare fordi Tromsø hadde nøkkelen). |
| Sametinget (974760347) | `sametinget` i Tromsøs grunnlag (uten orgnr, ikke koblet) og importørens `samediggi-sametinget` i karasjok.json | `sametinget` med orgnr; `koblinger` for 5501 binder nøkkelen. Organet står også i Karasjok (over sametingsrådet) og i de ti kommunene i det samiske forvaltningsområdet. Registerrollene føres av Tromsø etter importørens regel. |

Etter flettingen finner det samme søket ingen.

## Lovdata og beslutningskjedene

`https://api.lovdata.no/v1/publicData/list` svarte HTTP 405 («Request stopped by Varnish IPS») ved det ene forsøket 25.09.2026 kl. 20.09 UTC. Det er Lovdatas egen brannmur, ikke proxyen. Sperren er ikke omgått, og ingen paragraf er skrevet etter hukommelsen.

Kjedene har derfor strukturen, ikke hjemmelen:

- **Reguleringsplan:** administrasjonen forbereder; planutvalget (eller formannskapet) behandler forslaget; kommunestyret vedtar; statsforvalteren er klageinstans.
- **Budsjett:** administrasjonen forbereder; formannskapet innstiller; kommunestyret vedtar. Ingen klage- eller overprøvingssteg er lagt inn; løypa viser da en åpen post etter vedtaket.
- Hvert steg har kilden `lovdata-gjeldende-lover`, grad `maa_verifiseres`, og merknaden begynner med «Hjemmel: ikke hentet fra Lovdata.». Et skript kan bytte den setningen mot paragrafen (plan- og bygningsloven og kommuneloven) og sette graden til `oppgitt`, uten å endre strukturen.
- Hver kommune har et hull på kommuneorganet: «Lovhjemmelen for stegene i beslutningskjedene er ikke hentet: reguleringsplan (steg 1–4) og budsjett (steg 1–3).»
- Planorganet er et eget planutvalg i 26 kommuner og formannskapet i 47. I 6 kommuner (Båtsfjord, Evenes, Gamvik, Kautokeino, Sør-Varanger, Vadsø) identifiserer kommuneledelsen verken formannskap eller planutvalg, og steget står som «Ikke kartlagt» på kommuneorganet, i begge kjedene.
- Tromsø beholder sine to kjeder fra kommunens egne sider. Tana har i tillegg Finnmark-kjeden «Hvem avgjør hvem som eier grunnen i Finnmark?» fra staging.

## Personer som kan være den samme, til menneskelig vurdering

Ingen personer er slått sammen på navn i flettingen. Nøkler er delt bare der staging allerede delte dem.

**A. Samme nøkkel i staging, på flere nivåer** (kommunestyre, fylkesting, Storting). Valgte-verifikatorene sammenlignet fødselsdatoen i Valgdirektoratets og Stortingets filer i minnet; alle stemmer. Er to av dem ulike personer, skill nøklene.

- `anniken-nylund-aasjord` Anniken Nylund Aasjord: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Vågan
- `arne-ivar-mikalsen` Arne Ivar Mikalsen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Hadsel
- `arne-reidar-myrseth` Arne Reidar Myrseth: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Hammerfest - Hámmerfeasta
- `ashild-charlotte-pettersen` Åshild Charlotte Pettersen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Leirfjord
- `beate-bo-nilsen` Beate Bø Nilsen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Sortland - Suortá
- `bengt-rune-strifeldt` Bengt Rune Strifeldt: Kommunestyret i Alta, Stortinget
- `bjorn-larsen` Bjørn Larsen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Vefsn, Stortinget
- `cato-robert-kristiansen` Cato Robert Kristiansen: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Loppa
- `dagfinn-henrik-olsen` Dagfinn Henrik Olsen: Kommunestyret i Lødingen, Stortinget
- `eivind-holst` Eivind Holst: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Vågan
- `elin-mathisen` Elin Mathisen: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Sør-Varanger
- `frode-elias-lindal` Frode Elias Lindal: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Alta
- `geir-inge-sivertsen` Geir Inge Sivertsen: Fylkestinget i Troms, Kommunestyret i Senja
- `grete-ellingsen` Grete Ellingsen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Sortland - Suortá
- `grethe-anita-andersen` Grethe Anita Andersen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Meløy
- `hakon-andreas-moller` Håkon Andreas Møller: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Bodø
- `heidi-anita-lindkvist-holmgren` Heidi Anita Lindkvist Holmgren: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Nordkapp
- `hilde-grande` Hilde Grande: Kommunestyret i Vestvågøy, Stortinget
- `ida-garseth-hov` Ida Gårseth Hov: Fylkestinget i Troms, Tromsø kommunestyre
- `jan-olav-opdal` Jan Olav Opdal: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Narvik
- `joakim-sennesvik` Joakim Sennesvik: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Bodø
- `john-roald-karlsen` John Roald Karlsen: Fylkestinget i Troms, Kommunestyret i Nordreisa - Ráisa - Raisi
- `kari-anne-bokestad-andreassen` Kari Anne Bøkestad Andreassen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Vevelstad
- `kassandra-eleni-bredrup-petsa` Kassandra Eleni Bredrup Petsa: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Fauske - Fuossko
- `kristian-august-eilertsen` Kristian August Eilertsen: Fylkestinget i Troms, Kommunestyret i Harstad - Hárstták, Stortinget
- `kurt-pasvikbamsen-wikan` Kurt Pasvikbamsen Wikan: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Sør-Varanger
- `marta-hofsoy` Marta Hofsøy: Fylkestinget i Troms, Tromsø kommunestyre
- `marthe-johanna-kjolas` Marthe Johanna Kjølås: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Sør-Varanger
- `monica-nielsen` Monica Nielsen: Kommunestyret i Alta, Stortinget
- `nathaniel-holan-larsen` Nathaniel Holan Larsen: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Narvik
- `nils-einar-samuelsen` Nils Einar Samuelsen: Fylkestinget i Troms, Kommunestyret i Lyngen - Ivgu - Yykeä
- `odd-eilert-persen` Odd Eilert Persen: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Alta
- `odd-erling-mikalsen` Odd Erling Mikalsen: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Alta
- `odd-langvatn` Odd Langvatn: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Vefsn
- `sigurd-kvammen-rafaelsen` Sigurd Kvammen Rafaelsen: Kommunestyret i Lebesby, Stortinget
- `tom-are-nylund` Tom Are Nylund: Fylkestinget i Troms, Kommunestyret i Senja
- `tom-einar-karlsen` Tom Einar Karlsen: Fylkestinget i Troms, Kommunestyret i Harstad - Hárstták
- `toralf-heimdal` Toralf Heimdal: Fylkestinget i Troms, Kommunestyret i Bardu
- `trine-noodt` Trine Noodt: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Alta
- `truls-olufsen-mehus` Truls Olufsen-Mehus: Fylkestinget i Finnmark - Finnmárku - Finmarkku, Kommunestyret i Hammerfest - Hámmerfeasta
- `vegard-johan-lind-jaeger` Vegard Johan Lind-Jæger: Fylkestinget i Nordland - Nordlánnda, Kommunestyret i Narvik
- `vidar-langeland` Vidar Langeland: Fylkestinget i Troms, Kommunestyret i Skjervøy

(42 personer.) I tillegg har kommuneledelsen gitt ordførere, varaordførere og utvalgsledere valgoppgjørets nøkkel når fornavn og etternavn stemmer og det bare er én kandidat i samme kommunestyre (Troms og Finnmark: 18 med ulik navneform, i `koblinger` i staging; Nordland: 128).

**B. Ulike nøkler, sannsynlig samme person** (fra staging-rapportene og flettingen):

- `anni-beate-skogman` ↔ `anni-skogman`: Sannsynlig samme person: «Anni Beate Skogman» i valgregisteret og «Anni Skogman» i tromso.json har samme fornavn, etternavn, parti og organ (tromso-kommunestyre). tromso.json har den nåværende sammensetningen fra tromso.digdem.no, som bruker den korte navneformen. Må bekreftes før nøklene slås sammen.
- `barbara-karin-vogele` ↔ `barbara-vogele`: Sannsynlig samme person: «Barbara Karin Vögele» i valgregisteret og «Barbara Vögele» i tromso.json har samme fornavn, etternavn, parti og organ (tromso-kommunestyre). tromso.json har den nåværende sammensetningen fra tromso.digdem.no, som bruker den korte navneformen. Må bekreftes før nøklene slås sammen.
- `irene-vanja-dahl` ↔ `irene-dahl`: Sannsynlig samme person: «Irene Vanja Dahl» i valgregisteret og «Irene Dahl» i tromso.json har samme fornavn, etternavn, parti og organ (tromso-kommunestyre). tromso.json har den nåværende sammensetningen fra tromso.digdem.no, som bruker den korte navneformen. Må bekreftes før nøklene slås sammen.
- `pal-julius-austrem-skogholt` ↔ `pal-julius-skogholt`: Sannsynlig samme person: «Pål Julius Austrem Skogholt» i valgregisteret og «Pål Julius Skogholt» i tromso.json har samme fornavn, etternavn, parti og organ (tromso-kommunestyre). tromso.json har den nåværende sammensetningen fra tromso.digdem.no, som bruker den korte navneformen. Må bekreftes før nøklene slås sammen.
- `andreas-nilsen-salangen` ↔ `andreas-nilsen`: Mulig samme person: samme navn som andreas-nilsen i tromso.json (Varamedlem i drytech), men vervet her (kommunestyret i Salangen) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `anita-karlsen-gratangen` ↔ `anita-karlsen`: Mulig samme person: samme navn som anita-karlsen i tromso.json (Varamedlem i nordkraft), men vervet her (kommunestyret i Gratangen) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `anita-romsdal-kivijervi-alta` ↔ `anita-romsdal-kivijervi`: Mulig samme person: samme navn som anita-romsdal-kivijervi i tromso.json (Varamedlem i aurora-kino), men vervet her (kommunestyret i Alta) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `frank-harry-pettersen-karlsoy` ↔ `frank-harry-pettersen`: Mulig samme person: samme navn som frank-harry-pettersen i tromso.json (Styremedlem i joh-h-pettersen), men vervet her (kommunestyret i Karlsøy) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `jan-martin-rishaug-alta` ↔ `jan-martin-rishaug`: Mulig samme person: samme navn som jan-martin-rishaug i tromso.json (Styremedlem i aurora-kino), men vervet her (kommunestyret i Alta) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `jan-roger-eriksen-batsfjord` ↔ `jan-roger-eriksen`: Mulig samme person: samme navn som jan-roger-eriksen i tromso.json (Styremedlem i coop-nord), men vervet her (kommunestyret i Båtsfjord) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `knut-andreas-sletten-tjeldsund` ↔ `knut-andreas-sletten`: Mulig samme person: samme navn som knut-andreas-sletten i tromso.json (Varamedlem i nordkraft), men vervet her (kommunestyret i Tjeldsund) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `line-miriam-haugan-senja` ↔ `line-miriam-haugan`: Mulig samme person: samme navn som line-miriam-haugan i tromso.json (Styremedlem i fagskolen-i-nord), men vervet her (kommunestyret i Senja) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `mona-benjaminsen-karlsoy` ↔ `mona-benjaminsen`: Mulig samme person: samme navn som mona-benjaminsen i tromso.json (Varamedlem i troms-kraft), men vervet her (kommunestyret i Karlsøy) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `monica-mathiassen-harstad` ↔ `monica-mathiassen`: Mulig samme person: samme navn som monica-mathiassen i tromso.json (Styremedlem i teknisk-bureau, Styremedlem i tuil-tromsdalen-fotball, Varamedlem (valgt av de ansatte) i drytech), men vervet her (kommunestyret i Harstad) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `tom-vegar-kiil-nordreisa` ↔ `tom-vegar-kiil`: Mulig samme person: samme navn som tom-vegar-kiil i tromso.json (Styremedlem i norges-rafisklag), men vervet her (kommunestyret i Nordreisa) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `aina-nilsen` ↔ `aina-johanne-nilsen`: Sannsynlig samme person: «Aina Nilsen» i fylkestingslisten og «Aina Johanne Nilsen» i kommunestyrelisten for Hadsel har samme fornavn, etternavn og parti (Sp), og fødselsdatoen i Valgdirektoratets filer er lik (sammenlignet i minnet, ikke lagret). Nøklene er ikke slått sammen fordi staging/nordland-regionalt.json bruker aina-nilsen for fylkesrådets nestleder. Må bekreftes før nøklene slås sammen.
- `anita-sollie` ↔ `anita-lill-sollie`: Sannsynlig samme person: «Anita Sollie» i fylkestingslisten og «Anita Lill Sollie» i kommunestyrelisten for Rana har samme fornavn, etternavn og parti (H), og fødselsdatoen i Valgdirektoratets filer er lik (sammenlignet i minnet, ikke lagret). Nøklene er ikke slått sammen fordi staging/kommuneledelse-18.json bruker anita-lill-sollie for varaordføreren i Rana. Må bekreftes før nøklene slås sammen.
- `borre-johan-johannessen-luroy` ↔ `borre-johan-johannessen`: Mulig samme person: samme navn som borre-johan-johannessen i tromso.json (Varamedlem i norges-rafisklag), men vervet her (kommunestyret i Lurøy) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `morten-stover-bodo` ↔ `morten-stover`: Mulig samme person: samme navn som morten-stover i tromso.json (Styremedlem i sykehusapotek-nord), men vervet her (kommunestyret i Bodø) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `richard-dagsvik` ↔ `richard-andre-dagsvik`: Sannsynlig samme person: «Richard Dagsvik» i fylkestingslisten og «Richard André Dagsvik» i kommunestyrelisten for Leirfjord har samme fornavn, etternavn og parti (FrP), og fødselsdatoen i Valgdirektoratets filer er lik (sammenlignet i minnet, ikke lagret). Nøklene er ikke slått sammen fordi staging/nordland-regionalt.json bruker richard-dagsvik for fylkesråden for samferdsel. Må bekreftes før nøklene slås sammen.
- `rune-ostergren` ↔ `rune-ernst-ostergren`: Sannsynlig samme person: «Rune Østergren» i fylkestingslisten og «Rune Ernst Østergren» i kommunestyrelisten for Narvik har samme fornavn, etternavn og parti (FrP), og fødselsdatoen i Valgdirektoratets filer er lik (sammenlignet i minnet, ikke lagret). Nøklene er ikke slått sammen fordi staging/kommuneledelse-18.json bruker rune-ernst-ostergren for varaordføreren i Narvik. Må bekreftes før nøklene slås sammen.
- `stine-ytterstad-lodingen` ↔ `stine-ytterstad`: Mulig samme person: samme navn som stine-ytterstad i tromso.json (Styremedlem i norges-sjomatrad), men vervet her (kommunestyret i Lødingen) ligger utenfor organene tromso.json dekker. Fikk suffiks inntil det er bekreftet.
- `karin-eriksen-lavangen` ↔ `karin-eriksen`: «Karin Eriksen» har samme navn som et kommunestyremedlem i kvaefjord i valgte-55-56.json. Ikke slått sammen; kan være samme person.
- `laila-helen-opdal-korsvoll-hasvik` ↔ `laila-helen-opdal-korsvoll`: «Laila Helen Opdal Korsvoll» har samme navn som et kommunestyremedlem i bardu i valgte-55-56.json. Ikke slått sammen; kan være samme person.
- `runar-jensen` (ordfører i Saltdal, kommunens side) ↔ `runar-lovdal-jensen` (kommunestyret i Saltdal, valgoppgjøret): samme kommunestyre, fornavn og etternavn. Kommuneledelsen koblet dem ikke, og de er holdt adskilt. Merknaden på ordførerrollen sier at møteportalen skriver et mellomnavn.
- `jan-martin-rishaug-alta` (fungerende ordfører og kommunestyremedlem i Alta) ↔ `jan-martin-rishaug` (Tromsø: styremedlem i Aurora Kino; styreleder i Alta Havn KF): Finnmark-verifikatoren bekreftet at det er samme person (fødselsdato i minnet). Ikke slått sammen her, fordi staging ikke delte nøkkelen.

**C. Navnebrødre holdt tilbake av importøren.** En registerperson med samme navn som en grunnlagsperson i samme fil, uten felles organ, tas ikke inn før et menneske har avgjort det (`docs/brreg-import.md`). Med kommunestyrene i filene er det blitt mange: lokalpolitikere med styreverv. Er det samme person, legg linjen i `samme_person` for kommunen i `scripts/brreg.config.json` og kjør importøren; er det en annen, legg nøkkelen i `ulik_person`.

143 registerpersoner, før flettingen 16.

| Kommune | Registerpersonen | Grunnlagets person | Navn |
|---|---|---|---|
| Bodø | `bente-haukas-19eabf` | `bente-haukas` | Bente Haukås |
| Bodø | `kristin-schjenken-andersen-16aa03` | `kristin-schjenken-andersen` | Kristin Schjenken Andersen |
| Bodø | `levi-garseth-nesbakk-79f06f` | `levi-garseth-nesbakk` | Levi Gårseth-Nesbakk |
| Bodø | `morten-stover-53003c` | `morten-stover-bodo` | Morten Støver |
| Bodø | `ole-henrik-hjartoy-ef1e42` | `ole-henrik-hjartoy` | Ole-Henrik Hjartøy |
| Bodø | `selma-sorensen-bodogaard-3794d2` | `selma-sorensen-bodogaard` | Selma Sørensen Bodøgaard |
| Bodø | `stian-hiis-bergh-c58d0d` | `stian-hiis-bergh` | Stian Hiis Bergh |
| Bodø | `synne-hoyforsslett-bjorbaek-33ed6c` | `synne-hoyforsslett-bjorbaek` | Synne Høyforsslett Bjørbæk |
| Bodø | `synnove-pettersen-323c4d` | `synnove-pettersen` | Synnøve Pettersen |
| Brønnøy | `audhild-bang-rande-fe24fb` | `audhild-bang-rande` | Audhild Bang Rande |
| Vega | `kim-roger-fredriksen-5392b7` | `kim-roger-fredriksen` | Kim Roger Fredriksen |
| Alstahaug | `arnt-sverre-jakobsen-79c30e` | `arnt-sverre-jakobsen` | Arnt Sverre Jakobsen |
| Leirfjord | `sten-rino-bonsaksen-e5846c` | `sten-rino-bonsaksen` | Sten Rino Bonsaksen |
| Grane | `rahim-delal-904140` | `rahim-delal` | Rahim Delal |
| Hemnes | `vidar-lenningsvik-b77e4e` | `vidar-lenningsvik` | Vidar Lenningsvik |
| Rana | `carina-hoff-johansen-f81307` | `carina-hoff-johansen` | Carina Hoff-Johansen |
| Rana | `hilde-lillerodvann-d7cf43` | `hilde-lillerodvann` | Hilde Lillerødvann |
| Rana | `joachim-hjartoy-0869ea` | `joachim-hjartoy` | Joachim Hjartøy |
| Rana | `johan-petter-johansen-rossvoll-1e6859` | `johan-petter-johansen-rossvoll` | Johan Petter Johansen Røssvoll |
| Rana | `johnny-ronesen-056cf6` | `johnny-ronesen` | Johnny Ronesen |
| Rana | `line-merethe-lund-c98e6f` | `line-merethe-lund` | Line Merethe Lund |
| Rana | `tor-arne-strom-d91e6f` | `tor-arne-strom` | Tor Arne Strøm |
| Lurøy | `alf-goran-knutsen-cfa82b` | `alf-goran-knutsen` | Alf Gøran Knutsen |
| Lurøy | `julie-anne-olvik-9d07e7` | `julie-anne-olvik` | Julie-Anne Olvik |
| Gildeskål | `silje-nordgard-7aab73` | `silje-nordgard` | Silje Nordgård |
| Saltdal | `sara-isaksen-lundbakk-383e3d` | `sara-isaksen-lundbakk` | Sara Isaksen Lundbakk |
| Fauske | `gisela-hansen-gulstad-961cdb` | `gisela-hansen-gulstad` | Gisela Hansen Gulstad |
| Fauske | `per-kristen-lokas-cc353b` | `per-kristen-lokas` | Per Kristen Løkås |
| Fauske | `truls-martin-aanstad-d0cfc7` | `truls-martin-aanstad` | Truls Martin Aanstad |
| Steigen | `maren-sivertsen-00e2da` | `maren-sivertsen` | Maren Sivertsen |
| Lødingen | `bjorn-harald-moen-351345` | `bjorn-harald-moen` | Bjørn Harald Moen |
| Lødingen | `stine-ytterstad-a32f5f` | `stine-ytterstad-lodingen` | Stine Ytterstad |
| Evenes | `jan-inge-yttervik-e27362` | `jan-inge-yttervik` | Jan Inge Yttervik |
| Røst | `geir-borre-johansen-3403e0` | `geir-borre-johansen` | Geir Børre Johansen |
| Vestvågøy | `anne-sissel-sand-955c13` | `anne-sissel-sand` | Anne Sissel Sand |
| Vestvågøy | `freddy-henningsen-289390` | `freddy-henningsen` | Freddy Henningsen |
| Vestvågøy | `kenneth-grav-04b8d7` | `kenneth-grav` | Kenneth Grav |
| Vågan | `ann-jorunn-olsen-1522d6` | `ann-jorunn-olsen` | Ann Jorunn Olsen |
| Vågan | `camilla-rostad-5c58cd` | `camilla-rostad` | Camilla Rostad |
| Vågan | `frank-gudmund-johnsen-1206e9` | `frank-gudmund-johnsen` | Frank Gudmund Johnsen |
| Vågan | `kjell-einar-kristiansen-ba2a21` | `kjell-einar-kristiansen` | Kjell Einar Kristiansen |
| Øksnes | `lena-beate-steffensen-olsen-1d93d2` | `lena-beate-steffensen-olsen` | Lena Beate Steffensen Olsen |
| Øksnes | `tommy-steffensen-946e8b` | `tommy-steffensen` | Tommy Steffensen |
| Sortland | `fred-frivag-9dbc92` | `fred-frivag` | Fred Frivåg |
| Sortland | `roar-wessel-olsen-0bfd49` | `roar-wessel-olsen` | Roar Wessel-Olsen |
| Hamarøy | `linda-jessen-83bfc1` | `linda-jessen` | Linda Jessen |
| Tromsø | `anders-torresen-e07a5d` | `anders-torresen` | Anders Tørresen |
| Tromsø | `bjarne-lauritz-lokse-rohde-85ac7f` | `bjarne-lauritz-lokse-rohde` | Bjarne Lauritz Løkse Rohde |
| Tromsø | `bjorn-lasse-haug-578ad7` | `bjorn-lasse-haug` | Bjørn Lasse Haug |
| Tromsø | `borre-krudta-7cd743` | `borre-krudta` | Børre Krudtå |
| Tromsø | `brage-larsen-sollund-f43b3d` | `brage-larsen-sollund` | Brage Larsen Sollund |
| Tromsø | `eirik-losnegaard-mevik-43c8e3` | `eirik-losnegaard-mevik` | Eirik Losnegaard Mevik |
| Tromsø | `erlend-svardal-boe-b4113c` | `erlend-svardal-boe` | Erlend Svardal Bøe |
| Tromsø | `hakon-ronning-vahl-517717` | `hakon-ronning-vahl` | Håkon Rønning Vahl |
| Tromsø | `irene-lange-nordahl-f17f8b` | `irene-lange-nordahl` | Irene Lange Nordahl |
| Tromsø | `irene-vanja-dahl-2753ab` | `irene-vanja-dahl` | Irene Vanja Dahl |
| Tromsø | `jens-ingvald-olsen-9ea8ef` | `jens-ingvald-olsen` | Jens-Ingvald Olsen |
| Tromsø | `john-roald-karlsen-e9471e` | `john-roald-karlsen` | John Roald Karlsen |
| Tromsø | `katrine-boel-gregussen-210ac9` | `katrine-boel-gregussen` | Katrine Boel Gregussen |
| Tromsø | `magnar-andreas-nilssen-90b431` | `magnar-andreas-nilssen` | Magnar Andreas Nilssen |
| Tromsø | `maja-sandvik-lockert-646c1a` | `maja-sandvik-lockert` | Maja Sandvik Lockert |
| Tromsø | `mari-martinsen-siljebraten-a83fc0` | `mari-martinsen-siljebraten` | Mari Martinsen Siljebråten |
| Tromsø | `marianne-elisabeth-johnsen-c35441` | `marianne-elisabeth-johnsen` | Marianne Elisabeth Johnsen |
| Tromsø | `matias-hogne-kjerstad-f565fc` | `matias-hogne-kjerstad` | Matias Hogne Kjerstad |
| Tromsø | `per-ove-uglehus-1ce10c` | `per-ove-uglehus` | Per Ove Uglehus |
| Tromsø | `sebastian-hansen-henriksen-0e3234` | `sebastian-hansen-henriksen` | Sebastian Hansen Henriksen |
| Tromsø | `sigurd-salberg-pedersen-abffe5` | `sigurd-salberg-pedersen` | Sigurd Salberg Pedersen |
| Tromsø | `stig-tore-johnsen-d8642a` | `stig-tore-johnsen` | Stig Tore Johnsen |
| Tromsø | `tone-marie-myklevoll-b5047a` | `tone-marie-myklevoll` | Tone Marie Myklevoll |
| Harstad | `andreas-skaftnes-7cb064` | `andreas-skaftnes` | Andreas Skaftnes |
| Harstad | `else-marie-stenhaug-8085d1` | `else-marie-stenhaug` | Else Marie Stenhaug |
| Harstad | `even-aronsen-74ecf8` | `even-aronsen` | Even Aronsen |
| Harstad | `hanne-erica-thode-5b4295` | `hanne-erica-thode` | Hanne Erica Thode |
| Harstad | `kjetil-bjorkelund-0069d1` | `kjetil-bjorkelund` | Kjetil Bjørkelund |
| Harstad | `kristian-august-eilertsen-dc460e` | `kristian-august-eilertsen` | Kristian August Eilertsen |
| Harstad | `marie-modal-193184` | `marie-modal` | Marie Modal |
| Harstad | `nina-margrethe-dons-hansen-c2ef46` | `nina-margrethe-dons-hansen` | Nina Margrethe Dons-Hansen |
| Harstad | `rune-stenstrom-daf57a` | `rune-stenstrom` | Rune Stenstrøm |
| Tjeldsund | `bard-markus-hansen-353987` | `bard-markus-hansen` | Bård Markus Hansen |
| Ibestad | `hugo-henning-salomonsen-c9b8bf` | `hugo-henning-salomonsen` | Hugo Henning Salomonsen |
| Lavangen | `hakon-nygard-294168` | `hakon-nygard` | Håkon Nygård |
| Bardu | `toralf-heimdal-98b9c7` | `toralf-heimdal` | Toralf Heimdal |
| Målselv | `erlend-fossbakk-lian-7581cb` | `erlend-fossbakk-lian` | Erlend Fossbakk Lian |
| Målselv | `eskil-dahl-olaussen-323da4` | `eskil-dahl-olaussen` | Eskil Dahl Olaussen |
| Målselv | `henrik-stangnes-227711` | `henrik-stangnes` | Henrik Stangnes |
| Målselv | `linn-merete-andreassen-7e5276` | `linn-merete-andreassen` | Linn Merete Andreassen |
| Målselv | `martin-nymo-650820` | `martin-nymo` | Martin Nymo |
| Sørreisa | `tor-magne-haldorsen-65c51b` | `tor-magne-haldorsen` | Tor Magne Haldorsen |
| Dyrøy | `borre-ertzaas-3a3d24` | `borre-ertzaas` | Børre Ertzaas |
| Dyrøy | `rakel-jensen-31ce06` | `rakel-jensen` | Rakel Jensen |
| Senja | `roy-alapnes-1ec85e` | `roy-alapnes` | Roy Alapnes |
| Senja | `tom-rune-eliseussen-c62d2f` | `tom-rune-eliseussen` | Tom Rune Eliseussen |
| Balsfjord | `jan-nysted-efb94c` | `jan-nysted` | Jan Nysted |
| Lyngen | `irene-morso-gronvoll-8cda10` | `irene-morso-gronvoll` | Irene Morso Grønvoll |
| Kåfjord | `einar-eriksen-4b91fc` | `einar-eriksen` | Einar Eriksen |
| Kåfjord | `liv-vigdis-solvang-7049aa` | `liv-vigdis-solvang` | Liv Vigdis Solvang |
| Kvænangen | `aud-tove-haaland-tommerbukt-16532b` | `aud-tove-haaland-tommerbukt` | Aud Tove Haaland Tømmerbukt |
| Kvænangen | `valter-hermod-johan-olsen-7ad8d8` | `valter-hermod-johan-olsen` | Valter Hermod Johan Olsen |
| Alta | `anita-hakegard-pedersen-ba093d` | `anita-hakegard-pedersen` | Anita Håkegård Pedersen |
| Alta | `odd-eilert-persen-46928b` | `odd-eilert-persen` | Odd Eilert Persen |
| Alta | `ole-steinar-ostlyngen-1e5c3d` | `ole-steinar-ostlyngen` | Ole Steinar Østlyngen |
| Alta | `tor-erland-nilsen-fe7a59` | `tor-erland-nilsen` | Tor Erland Nilsen |
| Hammerfest | `heidi-marie-mauno-sletten-cba821` | `heidi-marie-mauno-sletten` | Heidi Marie Mauno Sletten |
| Hammerfest | `jan-tore-kvalnes-1bb888` | `jan-tore-kvalnes` | Jan Tore Kvalnes |
| Hammerfest | `kjetil-kvamme-3803b7` | `kjetil-kvamme` | Kjetil Kvamme |
| Hammerfest | `kurt-alfred-methi-6bc610` | `kurt-alfred-methi` | Kurt Alfred Methi |
| Hammerfest | `silje-merethe-holmgren-8e96c5` | `silje-merethe-holmgren` | Silje Merethe Holmgren |
| Hammerfest | `tarjei-jensen-bech-09175a` | `tarjei-jensen-bech` | Tarjei Jensen Bech |
| Sør-Varanger | `elin-mathisen-ed4a4b` | `elin-mathisen` | Elin Mathisen |
| Sør-Varanger | `ingvild-wartiainen-d3b5d3` | `ingvild-wartiainen` | Ingvild Wartiainen |
| Sør-Varanger | `jorun-norstebo-48c55b` | `jorun-norstebo` | Jorun Nørstebø |
| Sør-Varanger | `marius-mollersen-91dbcd` | `marius-mollersen` | Marius Møllersen |
| Sør-Varanger | `nina-danielsen-85345d` | `nina-danielsen` | Nina Danielsen |
| Vadsø | `bjorg-jorun-tapio-4a3fa8` | `bjorg-jorun-tapio` | Bjørg Jorun Tapio |
| Vadsø | `magnus-jakola-skansen-1ae59f` | `magnus-jakola-skansen` | Magnus Jakola Skansen |
| Vadsø | `suzanne-pedersen-holmgren-e1f004` | `suzanne-pedersen-holmgren` | Suzanne Pedersen Holmgren |
| Vadsø | `wenche-pedersen-daeb8e` | `wenche-pedersen-vadso` | Wenche Pedersen |
| Kautokeino | `nils-arne-haetta-7a5d8e` | `nils-arne-haetta` | Nils Arne Hætta |
| Loppa | `maria-sotkajaervi-e06ab7` | `maria-sotkajaervi` | Maria Sotkajærvi |
| Måsøy | `age-flaten-791a58` | `age-flaten` | Åge Flaten |
| Måsøy | `bjorg-mette-giaever-bfeb4f` | `bjorg-mette-giaever` | Bjørg Mette Giæver |
| Måsøy | `borre-stabell-62f9f3` | `borre-stabell` | Børre Stabell |
| Måsøy | `erlend-amund-hesten-160616` | `erlend-amund-hesten` | Erlend Amund Hesten |
| Måsøy | `gro-anita-mikkelsen-5cde9e` | `gro-anita-mikkelsen` | Gro-Anita Mikkelsen |
| Måsøy | `ingrid-majala-4f4e45` | `ingrid-majala` | Ingrid Majala |
| Nordkapp | `daniel-ness-myhre-e042d6` | `daniel-ness-myhre` | Daniel Ness Myhre |
| Nordkapp | `johnny-hans-ole-ingebrigtsen-f2e18d` | `johnny-hans-ole-ingebrigtsen` | Johnny Hans Ole Ingebrigtsen |
| Nordkapp | `lars-helge-jensen-46ecb5` | `lars-helge-jensen` | Lars Helge Jensen |
| Nordkapp | `tarald-nikolaisen-cd334a` | `tarald-nikolaisen` | Tarald Nikolaisen |
| Lebesby | `jan-olav-evensen-0462fe` | `jan-olav-evensen` | Jan-Olav Evensen |
| Tana | `siv-anita-biti-helander-d852b4` | `siv-anita-biti-helander` | Siv Anita Biti-Helander |
| Berlevåg | `anne-grethe-arntzen-johnsen-92c61a` | `anne-grethe-arntzen-johnsen` | Anne Grethe Arntzen Johnsen |
| Berlevåg | `arne-dag-pedersen-6bc70f` | `arne-dag-pedersen` | Arne Dag Pedersen |
| Båtsfjord | `anders-hollingsaeter-smasund-7419a6` | `anders-hollingsaeter-smasund` | Anders Hollingsæter Småsund |
| Båtsfjord | `jan-roger-eriksen-1e10dd` | `jan-roger-eriksen-batsfjord` | Jan Roger Eriksen |
| Vardø | `anita-braekkan-remme-083b9e` | `anita-braekkan-remme` | Anita Brækkan Remme |
| Vardø | `frode-robertsen-a46be4` | `frode-robertsen` | Frode Robertsen |
| Vardø | `morten-wilhelmsen-83fbe8` | `morten-wilhelmsen` | Morten Wilhelmsen |
| Vardø | `nicklas-kofoed-malin-517505` | `nicklas-kofoed-malin` | Nicklas Kofoed Malin |
| Vardø | `orjan-ingebrigt-jensen-48300b` | `orjan-ingebrigt-jensen` | Ørjan Ingebrigt Jensen |
| Vardø | `remi-morten-strand-de8991` | `remi-morten-strand` | Remi Morten Strand |
| Vardø | `tor-emil-sivertsen-e8aa8f` | `tor-emil-sivertsen` | Tor Emil Sivertsen |
| Nesseby | `martin-velky-e0cb5f` | `martin-velky` | Martin Velky |

**D. Samme navn, ulike nøkler i ulike filer.** Her er registerpersonen tatt inn med hashsuffiks fordi grunnlagspersonen står i en annen fil. Ingen er slått sammen.

109 navn:

Andre Møller (`andre-moller`, `andre-moller-a5784e`); Andreas Nilsen (`andreas-nilsen`, `andreas-nilsen-salangen`); Andrine Solli (`andrine-solli`, `andrine-solli-84e7e4`); Anette Morrison (`anette-morrison`, `anette-morrison-b6df2e`); Anita Helén Løvhaug (`anita-helen-lovhaug`, `anita-helen-lovhaug-1ea18f`); Anita Karlsen (`anita-karlsen`, `anita-karlsen-gratangen`); Anita Romsdal Kivijervi (`anita-romsdal-kivijervi`, `anita-romsdal-kivijervi-alta`); Anneli Anfeltmo (`anneli-anfeltmo`, `anneli-anfeltmo-9cc2e3`); Audhild Bang Rande (`audhild-bang-rande`, `audhild-bang-rande-fe24fb`); Beathe Hoel (`beathe-hoel`, `beathe-hoel-a7f8e1`); Benjamin Nordberg Furuly (`benjamin-nordberg-furuly`, `benjamin-nordberg-furuly-f22a89`); Bjørn Johansen (`bjorn-johansen`, `bjorn-johansen-81aeaf`); Bjørn Pedersen (`bjorn-pedersen-lebesby`, `bjorn-pedersen-vadso`); Bjørnar Pedersen (`bjornar-pedersen`, `bjornar-pedersen-0fb1ae`); Børre Johan Johannessen (`borre-johan-johannessen`, `borre-johan-johannessen-luroy`); Christine Bertheussen Killie (`christine-bertheussen-killie`, `christine-bertheussen-killie-49aa4c`); Dag Rune Olsen (`dag-rune-olsen`, `dag-rune-olsen-62dd56`); Dag Sigurd Tor Brustind (`dag-sigurd-tor-brustind`, `dag-sigurd-tor-brustind-14f8a0`); Egil Arne Wiik (`egil-arne-wiik`, `egil-arne-wiik-08d551`); Einar Johnsen Meisfjord (`einar-johnsen-meisfjord`, `einar-johnsen-meisfjord-fe3c5c`); Eirik Johansen (`eirik-johansen`, `eirik-johansen-60bd7a`); Else Marie Stenhaug (`else-marie-stenhaug`, `else-marie-stenhaug-8085d1`); Erling Bratsberg (`erling-bratsberg`, `erling-bratsberg-e58c57`); Eskil Dahl Olaussen (`eskil-dahl-olaussen`, `eskil-dahl-olaussen-323da4`); Espen Storholm (`espen-storholm`, `espen-storholm-df12ed`); Frank Harry Pettersen (`frank-harry-pettersen`, `frank-harry-pettersen-karlsoy`); Frank Kristiansen (`frank-kristiansen`, `frank-kristiansen-489a76`); Fransisca Kappfjell Herbst (`fransisca-kappfjell-herbst`, `fransisca-kappfjell-herbst-13c070`); Fred Willy Persen (`fred-willy-persen`, `fred-willy-persen-bc8104`); Frode Hansen (`frode-hansen`, `frode-hansen-91256f`); Geir Mikkelsen (`geir-mikkelsen`, `geir-mikkelsen-177ee7`); Gisle Erik Hansen (`gisle-erik-hansen`, `gisle-erik-hansen-43883d`); Gjermund Olsen (`gjermund-olsen`, `gjermund-olsen-6623c8`); Guro Kvaal Brandshaug (`guro-kvaal-brandshaug`, `guro-kvaal-brandshaug-cb53c1`); Gyrd Harstad (`gyrd-harstad`, `gyrd-harstad-ef6acf`); Hanne Marit Braathen (`hanne-marit-braathen`, `hanne-marit-braathen-927ab8`); Harald Gunnar Sunde (`harald-gunnar-sunde`, `harald-gunnar-sunde-0a94ed`); Hege Christin Bjørkmann (`hege-christin-bjorkmann`, `hege-christin-bjorkmann-a3b7b6`); Heidi Johnsen (`heidi-johnsen`, `heidi-johnsen-850da5`); Heli Marjaana Korhonen (`heli-marjaana-korhonen`, `heli-marjaana-korhonen-0a8972`); Hilde Furuseth Johansen (`hilde-furuseth-johansen`, `hilde-furuseth-johansen-32bbb0`); Ingvild Wartiainen (`ingvild-wartiainen`, `ingvild-wartiainen-d3b5d3`); Jan Martin Rishaug (`jan-martin-rishaug`, `jan-martin-rishaug-alta`); Jan Roger Eriksen (`jan-roger-eriksen`, `jan-roger-eriksen-batsfjord`); Jarle Petter Vang (`jarle-petter-vang`, `jarle-petter-vang-7e4ebb`); Kari Anne Bøkestad Andreassen (`kari-anne-bokestad-andreassen`, `kari-anne-bokestad-andreassen-e459a2`); Karin Eriksen (`karin-eriksen`, `karin-eriksen-lavangen`); Kenneth Grav (`kenneth-grav`, `kenneth-grav-04b8d7`); Kine Mari Hanssen Bertheussen (`kine-mari-hanssen-bertheussen`, `kine-mari-hanssen-bertheussen-4fcb44`); Kine Susann Waade Edvardsen (`kine-susann-waade-edvardsen`, `kine-susann-waade-edvardsen-0bcc83`); Kjell Are Johansen (`kjell-are-johansen`, `kjell-are-johansen-4ece96`); Kjersti Delp (`kjersti-delp`, `kjersti-delp-d365c8`); Knut Andreas Sletten (`knut-andreas-sletten`, `knut-andreas-sletten-tjeldsund`); Kristian Sivertsen (`kristian-sivertsen`, `kristian-sivertsen-b06754`); Laila Helen Opdal Korsvoll (`laila-helen-opdal-korsvoll`, `laila-helen-opdal-korsvoll-hasvik`); Lars Adler Hustad (`lars-adler-hustad`, `lars-adler-hustad-14a4bc`); Lars Eriksen (`lars-eriksen`, `lars-eriksen-7898ba`); Lars Gunder Rask (`lars-gunder-rask`, `lars-gunder-rask-ca3c7f`); Leif Magne Johansen (`leif-magne-johansen`, `leif-magne-johansen-b4ef9a`); Lena Amalie Hamnes (`lena-amalie-hamnes`, `lena-amalie-hamnes-8c24b3`); Lena Holmen (`lena-holmen`, `lena-holmen-37b5d9`); Line Miriam Haugan (`line-miriam-haugan`, `line-miriam-haugan-senja`); Liv-Marit Haraldsvik Reitan (`liv-marit-haraldsvik-reitan`, `liv-marit-haraldsvik-reitan-1689be`); Magnar Jon Solbakk (`magnar-jon-solbakk`, `magnar-jon-solbakk-c4d7b9`); Malin Tverseth (`malin-tverseth`, `malin-tverseth-4b0ac6`); Marit Wisthus (`marit-wisthus`, `marit-wisthus-0b985e`); Mette Varem (`mette-varem`, `mette-varem-491ee7`); Mona Benjaminsen (`mona-benjaminsen`, `mona-benjaminsen-karlsoy`); Mona Christine Henneman (`mona-christine-henneman`, `mona-christine-henneman-b7e613`); Monica Mathiassen (`monica-mathiassen`, `monica-mathiassen-harstad`); Morten Støver (`morten-stover`, `morten-stover-bodo`); Nina Danielsen (`nina-danielsen`, `nina-danielsen-85345d`); Oddgeir Kroken (`oddgeir-kroken`, `oddgeir-kroken-2404fe`); Per Asle Pedersen (`per-asle-pedersen`, `per-asle-pedersen-5b62ad`); Petter Karlsen (`petter-karlsen`, `petter-karlsen-c2d7ed`); Raimo Petter Sørensen (`raimo-petter-sorensen`, `raimo-petter-sorensen-596726`); Randi Elisabeth Gregersen (`randi-elisabeth-gregersen`, `randi-elisabeth-gregersen-69e5e2`); Raymond Abelsen (`raymond-abelsen`, `raymond-abelsen-0c32ae`); Raymond Robertsen (`raymond-robertsen`, `raymond-robertsen-5c8794`); Robert Nesje (`robert-nesje`, `robert-nesje-b2bb7d`); Robin Johansen (`robin-johansen`, `robin-johansen-61910c`); Roger Karlsen (`roger-karlsen`, `roger-karlsen-55909d`); Roger Øksheim (`roger-oksheim`, `roger-oksheim-2de58c`); Ronald Jacobsen (`ronald-jacobsen`, `ronald-jacobsen-5a08ff`); Ronny Berg (`ronny-berg`, `ronny-berg-19f0bc`); Ruben Bjerkmo (`ruben-bjerkmo`, `ruben-bjerkmo-eb748d`); Rune Edvardsen (`rune-edvardsen-narvik`, `rune-edvardsen-sorfold`); Siv Anita Johnsen Brekke (`siv-anita-johnsen-brekke`, `siv-anita-johnsen-brekke-d7e989`); Staal Nilsen (`staal-nilsen`, `staal-nilsen-f96c99`); Steen Audvin Linde (`steen-audvin-linde`, `steen-audvin-linde-d359f6`); Steffen Jakobsen (`steffen-jakobsen`, `steffen-jakobsen-0bd3cf`); Steinar Hansen (`steinar-hansen-oksnes`, `steinar-hansen-rost`); Steinar Karlstrøm (`steinar-karlstrom`, `steinar-karlstrom-4856d0`); Sten Ole Eliassen (`sten-ole-eliassen`, `sten-ole-eliassen-784d95`); Stian Hiis Bergh (`stian-hiis-bergh`, `stian-hiis-bergh-c58d0d`); Stig Olsen (`stig-olsen`, `stig-olsen-f500d9`); Stine Ytterstad (`stine-ytterstad`, `stine-ytterstad-lodingen`); Sølvi Gunn Jensen (`solvi-gunn-jensen`, `solvi-gunn-jensen-4114b7`); Terje Bertheussen (`terje-bertheussen`, `terje-bertheussen-07f6ee`); Tom Erik Forså (`tom-erik-forsa`, `tom-erik-forsa-70595c`); Tom Vegar Kiil (`tom-vegar-kiil`, `tom-vegar-kiil-nordreisa`); Tommy Bech (`tommy-bech`, `tommy-bech-19f60c`); Torbjørn Grimstad (`torbjorn-grimstad`, `torbjorn-grimstad-632e6e`); Trude Jægtvik (`trude-jaegtvik`, `trude-jaegtvik-6ee83f`); Turid Strand (`turid-strand`, `turid-strand-405eeb`); Vegard Mathisen (`vegard-mathisen`, `vegard-mathisen-ade914`); Wibeke Aasjord Juul (`wibeke-aasjord-juul`, `wibeke-aasjord-juul-4f1f89`); Ylva Signhild Sneve (`ylva-signhild-sneve`, `ylva-signhild-sneve-a5456b`); Øistein Nilsen (`oistein-nilsen`, `oistein-nilsen-6bc310`)

## Konflikter mellom kildene, og hvordan de er løst

| Konflikt | Kildene | Løsning |
|---|---|---|
| Statsforvalteren i Troms og Finnmark: overordnet departement | Grunnlaget: Kommunal- og distriktsdepartementet. Enhetsregisteret og statsforvalteren.no: Digitaliserings- og forvaltningsdepartementet (932384469). | Registeret er fulgt. Merknaden på organet sier hva grunnlaget hadde. Departementet står nå som organ over begge statsforvalterne. |
| Finnmark fylkeskommune | Grunnlagets rad var fra researchgrunnlaget (må verifiseres), uten orgnr. | Erstattet av stagingens rad fra ffk.no, med orgnr. `gyldig_fra` 2024-01-01 fra grunnlaget står. |
| Valgoppgjøret mot dagens kommunestyre | Valgoppgjøret 2023 er ikke dagens sammensetning: i de tre organene verifikatoren sjekket, hadde 17 % av setene endret seg. | Hvert kommunestyre har et hull om endringer etter valgoppgjøret, og merknaden på hver rolle sier at den gjelder valgoppgjøret. De 14 som organets egen oversikt ikke har, er merket motsagt (fylkestingene). |
| Kommunestyret i Tromsø | tromso.json har dagens sammensetning fra tromso.digdem.no; valgoppgjøret har 7 som ikke sitter lenger. | Tromsøs liste står. Valgoppgjøret for Tromsø er ikke lagt inn. |
| Stortingsrepresentanter i kommunestyrer | Sju i Troms og Finnmark og tre i Nordland står i kommunestyret etter valgoppgjøret 2023, men sitter på Stortinget. | Rollene står som valgoppgjøret viser dem; hullet på kommunestyret dekker det. |
| Parti på kommunens side mot valgoppgjøret | Leirfjord: ordføreren står som «Uavhengig» i møteportalen, valgt for Ap. Nesna: varaordføreren står som H, valgt for Sp. Fylkestingene: fire partibytter i Troms og Finnmark, én i Nordland. | Kildens parti står på rollen; merknaden sier hva den andre kilden har. |
| To kommunedirektører i Vevelstad | Kontaktsiden fører både kommunedirektør og konstituert kommunedirektør. | Begge står. Registeret bekrefter kommunedirektøren; den konstituerte er et avvik i importørens rapport. Navnene er tatt ut av hverandres merknader. |
| Vadsø | Registeret har to daglige ledere; kommunens side svarte ikke. | Den ene har samme navn som et kommunestyremedlem og er holdt tilbake som navnebror. Ordfører og kommunedirektør mangler. |
| Nordlandssykehuset og Nord universitet | Registerets daglige leder er en annen enn den konstituerte direktøren og den fungerende rektoren på egne sider. | Begge står; hull på organet. |
| Registerets daglige leder i domstoler | Finnmark-verifikatoren tok den bort når domstol.no ikke bekrefter at det er domstollederen; Nordland og Tromsø har den som `dommer_leder` «Daglig leder». | Importørens regel gjelder overalt: eieren fører registerets daglige leder som `dommer_leder` med tittelen «Daglig leder». Hull sier at domstollederen ikke er navngitt. |
| Nivå for kommunalt eide aksjeselskaper | Staging gir sektor 1520 nivået «kommune»; importøren gir alle AS «privat». | Ikke avgjort (produktbeslutning). Aksjeselskapene som bare fantes i staging (Hammerfest Energi, Varanger Kraft, Narvik Bulkterminal, Helgeland Kraft Strøm, Nordkraft Magasin, Siso Energi), er ikke lagt inn. |
| Navneform på samme person | peter-andre-haaland: «Peter Andrè Haaland» i staging, «Peter Andre Haaland» fra før; den første er beholdt; odd-borge-pedersen: «Odd-Børge Pedersen» i staging, «Odd Børge Pedersen» fra før; den første er beholdt; jan-olav-evensen: «Jan Olav Evensen» i staging, «Jan-Olav Evensen» fra før; den første er beholdt; jens-ingvald-olsen: «Jens Ingvald Olsen» i staging, «Jens-Ingvald Olsen» fra før; den første er beholdt | Registernavnet er beholdt på personen; kildens form står i merknaden. |
| Partifelt over 60 tegn (Nesseby) | Listen «Fellesliste for Tverrpolitisk Liste, Samefolkets Parti, SP og H» er 63 tegn; basen tar 60. | Forkortet til «Fellesliste Tverrpolitisk Liste, Samefolkets Parti, SP og H»; merknaden sier hva listen heter. |
| Partikoder | Staging skrev «Industri- og Næringspartiet». | INP, som i tromso.json. Stortingspartiene med kortform; lokale lister som kilden skriver dem. |
| Merknader som navnga en annen person | Vevelstad (to kommunedirektører), Saltdal (ordførerens fulle navn), Bindal (kommunedirektørens fulle navn), Rana og Vega (registerets daglige leder i hullet). | Navnet er tatt ut av teksten, og lenken fra hullet til registerpersonen er fjernet. Ellers ville registerrollen blitt holdt tilbake som navnebror. |

## Hull

- **Lovhjemmel** for alle stegene i kjedene i 79 kommuner (hull i hver kommune).
- **Kommunedirektøren er ikke navngitt** på kommunens side i 12 kommuner: Vega, Rana, Værøy, Vestvågøy, Målselv, Sørreisa, Alta, Vadsø, Kautokeino, Loppa, Gamvik, Nesseby. Registerets daglige leder står på kommunen.
- **Vadsø:** ordfører, varaordfører, kommunedirektør og politiske organer mangler; kommunens nettsted svarte ikke. Varaordføreren mangler også i Kvæfjord, Karlsøy, Nordreisa, Kautokeino, Gamvik, Båtsfjord, Sørfold og Værøy (hull i filene).
- **Dekning ikke dokumentert** (se «Dekning»): Troms-tingretten og -jordskifteretten, lagmannsretten, UNN, Nordlandssykehuset og Helgelandssykehuset.
- **Endringer i kommunestyrene og fylkestingene etter valgoppgjøret 2023** (hull på hvert organ).
- **Ikke flettet fra staging:** Stortingets komiteer og organet «stortinget» (rollene måtte stått i tre filer), Bjørnar Skjærans departementsrolle, deltakerkommunene i IKS (DTPR), Helse Nords eierrelasjoner i Nordland og lagmannsrettens relasjoner (eierskapet ville flyttet, se over), Avinor-lufthavnene, kontorstedene til Mattilsynet, Fiskeridirektoratet, Kystverket og Sametinget, Innovasjon Norge, Forsvarets operative hovedkvarter, UNN Narvik, de seks aksjeselskapene over, stagingens nøkkeltall (importøren henter regnskapet selv) og 15 hull om organer som ikke er flettet eller eies av Tromsø fra før.

## Filer som er endret

| Fil | Endring |
|---|---|
| `src/data/*.json` (80) | Flettingen, kjørt gjennom importøren. `meta.merknad` og `meta.grunnlag` i de 79 kommunene utenom Tromsø; tallene i Tromsøs merknad. |
| `src/data/region/dekning.json` | Nytt: dekningsregisteret. |
| `src/data/region/nord-norge.json` | Porsanger: Kartverkets navneform, med SSBs form i belegget. |
| `src/data/region/types.ts` | Typene for dekningsregisteret; navneregelen sier at Kartverket gjelder når formene skiller seg. |
| `scripts/brreg/importer.ts`, `scripts/brreg.ts` | Dekningen: organene kopieres inn i kommunene på lista ved hver kjøring. |
| `scripts/brreg.config.json` | `koblinger`: `sametinget` (5501) og `karlsoy-kommune` (5534). |
| `docs/avvik/brreg-*.md` | Generert på nytt av importøren. |
| `docs/brreg-import.md` | Dekningen, Karlsøy og Sametinget. |
| `src/lib/data/indeks.json`, `supabase/seed/seed.sql` | Bygget på nytt. |
| `tests/kontrakt.test.ts` | Søketesten har fått 90 sekunder. 45 søk over 80 kommuner med folkevalgte tar 35 sekunder i PGlite (23 før); grensen var 30. |
| `tests/personvern.test.ts` | Brreg-testen: fylkesoversikten viser nå ordførerne i alle kommunene i fylket, og tre har samme navn som en sperret registerperson i Tromsø (Mona Benjaminsen, Anita Karlsen, og Bente Johnsen inni Bente Johnsen Karlsen). Navnet til en person som ikke er sperret og som svaret viser med sin egen nøkkel, tas ut før navnesjekken. Nøkkelsjekken er uendret. |

## Kontroll

- `npm test`: 9 testfiler, 2 712 tester, alle grønne (133 s). Personverntestene brukte 47 og 41 sekunder av 120; søketesten 35 av 90.
- `npm run typecheck`: rent.
- `npm run seed:build` to ganger: byte-identisk, sha256 `530c6c34…fcf725c1`, 24 098 linjer.
- `npm run data:indeks` skrevet, og `--sjekk` sier at indeksen er oppdatert.
- Importøren kjørt på nytt fra hurtiglageret for alle 80 kommunene: 163 filer (80 datasett, to regionfiler, 80 avviksrapporter og konfigurasjonen) har samme sha256 før og etter. Ingen fil ble endret, og hurtiglageret fikk ingen nye oppslag.
- Personvern: ingen fødselsdatoer, aldre, adresser, telefonnumre, e-postadresser eller bilder i datasettene. Treffene i skanningen var URL-er, et etternavn og merknader om at fødselsdato bare ble sammenlignet i minnet.

