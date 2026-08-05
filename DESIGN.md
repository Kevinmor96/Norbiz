# Designsystem — Bransjeindeks

Modus: **Operate.** Leseren er i en oppgave — «er denne typen virksomhet verdt å
drive, her?» — og skal komme ut med et svar. Skanbarhet, konsistens og presisjon
slår uttrykk. Merkevaren bor i detaljene, ikke i utsmykningen.

Forsiden er det ene unntaket: den er **Persuade**, og eier hero, nyhetsbrev og
luksusstripa. Alt annet — kategorisider, næringssider, topplister, dashbord,
fylkesprofiler — er Operate.

Dette er en **forsterkning**, ikke en ny visuell verden. Signaturen beholdes.

## 1. Signaturen som beholdes

Tre ting i dagens system er ekte designbeslutninger og skal ikke røres:

- **Lyst panel på mørk grunn.** `--panel`-tokenene. Vekslingen mellom mørk
  kontekst og lyst datapanel er det som gjør produktet gjenkjennelig, og den
  gjør samtidig en funksjonell jobb: tallene leses på det lyse feltet, rammen
  rundt er mørk. Behold.
- **Space Grotesk på tallene.** Store nøkkeltall i display-fonten. Se
  begrensningen i §3 — den gjelder bare figurene, aldri etiketter eller
  tabellceller.
- **Femdelt scorestripe, rød til grønn.** `--score-1` … `--score-5`. Semantisk,
  og derfor låst. Se §2.

## 2. Farge

### Verdiktrommet er opptatt

Scorestripa er **semantisk**: rødt betyr dårlig, grønt betyr bra. Den eier
hueområdet 25°–155° (rød 25, oransje 55, gul 90, grønn 145–155).

**Ingen kategorisk farge får bo i det området.** En omsetningsserie i grønt
leser som «bra», en i rødt som «dårlig», og det er en påstand vi ikke har gjort.
Kategoriske farger skal derfor ligge i 180°–330°. Dette er regelen som
graffargene brøt før: `--chart-1` var oransje (41°) og `--chart-4` gul (84°),
altså midt i verdiktrommet.

### Graffarger — erstatter shadcn-standardene

`--chart-1` til `--chart-5` var urørte shadcn-defaults. I et dataprodukt er
graffargene der identiteten faktisk bor, så de er designet nå:

| Token | Lys modus | Mørk modus | Rolle |
|---|---|---|---|
| `--chart-1` | `oklch(0.62 0.15 258)` | `oklch(0.70 0.13 258)` | Primærserie: omsetning |
| `--chart-2` | `oklch(0.74 0.12 195)` | `oklch(0.80 0.11 195)` | Sekundær: antall enheter |
| `--chart-3` | `oklch(0.54 0.17 295)` | `oklch(0.63 0.15 295)` | Tredje: sysselsatte |
| `--chart-4` | `oklch(0.68 0.14 330)` | `oklch(0.75 0.13 330)` | Fjerde: etableringer |
| `--chart-5` | `oklch(0.44 0.09 245)` | `oklch(0.55 0.08 245)` | Femte / referanselinje |

Lysheten er en **stige** — 0.44, 0.54, 0.62, 0.68, 0.74 — så seriene er
separerbare i gråtoner og for den som ikke skiller blått fra fiolett. Det er
ikke pynt: en linjegraf lest i utskrift eller med deuteranopi må fortsatt gi
fem forskjellige linjer.

### De ni verdensfargene skal harmoniseres

`categories.farge` bærer ni farger valgt ad hoc under kategoriarbeidet, uten
felles lyshet eller chroma, uten test mot mørk grunn. Fire av dem ligger dessuten
i verdiktrommet.

De skal normaliseres til **én lyshet og én chroma, bare hue varierer** — det er
det som gjør en fargekode til en identifikator framfor en dom:

| Verden | Fra | Til (lys) | Til (mørk) |
|---|---|---|---|
| Mat & drikke | `#E4572E` | `oklch(0.63 0.14 35)` | `oklch(0.72 0.13 35)` |
| Butikk | `#2E86AB` | `oklch(0.63 0.14 235)` | `oklch(0.72 0.13 235)` |
| Turisme & opplevelser | `#7B4B94` | `oklch(0.63 0.14 305)` | `oklch(0.72 0.13 305)` |
| Helse & velvære | `#C05299` | `oklch(0.63 0.14 340)` | `oklch(0.72 0.13 340)` |
| Bygg & håndverk | `#D08C1D` | `oklch(0.63 0.14 70)` | `oklch(0.72 0.13 70)` |
| Tjenester | `#3B7A57` | `oklch(0.63 0.14 160)` | `oklch(0.72 0.13 160)` |
| Bil & motor | `#4C6EF5` | `oklch(0.63 0.14 265)` | `oklch(0.72 0.13 265)` |
| Media & kommunikasjon | `#0FA3B1` | `oklch(0.63 0.14 195)` | `oklch(0.72 0.13 195)` |
| Eiendom | `#8C2F39` | `oklch(0.63 0.14 15)` | `oklch(0.72 0.13 15)` |

Verdensfargen er en **identifikator, ikke en flate.** Den får opptre som: en
4 px kantstripe, en ikonfarge, en liten prikk foran verdensnavnet. Den skal
aldri fylle et kort — ni mettede kortflater i et rutenett er dekorasjon, og
Operate-modus har ikke råd til det.

Unntaket er at verden-hue får farge grafen på en side som handler om nettopp den
verdenen. Da er fargen informasjon.

### Semantiske tilstander

`--opp` og `--ned` beholdes for endring. I tillegg trengs standardiserte
tilstander som mangler i dag: `hover`, `focus-visible`, `active`, `disabled`,
`selected`, `loading`, `error`. Ingen komponent skal shippes med halvparten.

## 3. Typografi

Én familie bærer grensesnittet. Space Grotesk er **kun** for figurer.

**Bannlyst:** display-font på etiketter, knapper, tabellceller, menyer og
brødtekst. En KPI på 44 px i Space Grotesk er et redaksjonelt grep; «ANSATTE PER
FORETAK» i samme font er støy.

Fast rem-skala, forhold 1.2, ingen `clamp()` i produktflatene:

| Token | rem | px | Bruk |
|---|---|---|---|
| `--text-micro` | 0.6875 | 11 | Kildelinje, årstempel |
| `--text-label` | 0.75 | 12 | KPI-etiketter, versaler, tracking +0.06em |
| `--text-sm` | 0.8125 | 13 | Tabellceller, sekundærtekst |
| `--text-body` | 0.875 | 14 | Brødtekst i paneler |
| `--text-lg` | 1 | 16 | Innsiktstekst, ingress i panel |
| `--figure-sm` | 1.25 | 20 | Tier 3-tall |
| `--figure` | 1.5 | 24 | Tabellens hovedtall |
| `--figure-lg` | 2 | 32 | Tier 2-tall |
| `--figure-hero` | 2.75 | 44 | Tier 1-tall |
| `--title` | 3.5 | 56 | Sidetittel |

Alle tall bruker `font-variant-numeric: tabular-nums`. En kolonne med tall som
hopper i bredden er uleselig, og det er hele produktet vårt.

## 4. Hierarki etter beslutningsverdi

Kategorisidene har åtte KPI-kort i identisk format. Det er den dyreste feilen i
Operate-modus: siden sier ikke hva som betyr noe. Åtte like kort er åtte
likestilte påstander, og for spørsmålet «er dette verdt å drive?» er de ikke
likestilte.

**Tier 1 — Svaret.** To tall, `--figure-hero`, øverst, med luft rundt.

- Driftsmargin
- Vekst siste år

Dette er de to som svarer på spørsmålet. Bærer `eierlonn_i_resultat`-merkingen
inline når flagget er sant — ikke som et ikon man må holde over, men som en
setning under tallet: «Eierens arbeid ligger i driftsresultatet.»

**Tier 2 — Skalaen.** Tre kort, `--figure-lg`, ett nivå ned.

- Antall virksomheter, med foretakstallet som underlinje
- Omsetning per foretak
- Ansatte per foretak

**Tier 3 — Underlaget.** Tett tallrad, `--figure-sm`, som en definisjonsliste
og ikke som kort.

- Sysselsatte
- Lønnsandel
- Vekst, årlig snitt (CAGR — se §6)
- Investering per foretak

Rekkefølgen er fast på alle kategorisider. Konsistens fra skjerm til skjerm er
en dyd i Operate; den som har sett én kategoriside skal kunne lese den neste
uten å orientere seg på nytt.

## 5. Kildemerking som designet lag

Produktets hele forskjell er ærlighet om kildene. I dag er det små grå badger.
Det er for lite for noe som er selve differensieringen.

Hvert tallområde får en **kildelinje** med fast grammatikk:

```
KILDE · ÅRSTALL · ENHET
SSB strukturstatistikk · 2024 · foretak, hele landet
```

Fire tilstander, med reell visuell forskjell — ikke fire nyanser av grått:

| Tilstand | Behandling |
|---|---|
| `ssb` / `brreg` — målt | Nøytral kildelinje, ingen ramme. Standardtilfellet skal ikke rope. |
| `beregnet` — utledet | Kildelinje med «beregnet av Bransjeindeks» og hvilke felt som ligger til grunn. |
| `ai_anslag` — vurdering | Tydelig annen form: egen ramme, «AI-vurdering», alvorlighet synlig, og `Grunnlag` utvidbart til de faktiske radene. Aldri samme form som et målt tall. |
| `mock` — demodata | Skal ikke stå ved siden av ekte tall uten merking. I dag gjelder det bare lønnsserien. |

**Forbeholdene er innhold, ikke fotnoter.** De to som finnes —
femansatte-gulvet hos Brreg og at Eiendomsutvikler deler selskapsliste med
Byggefirma — skal stå over listen de gjelder, i lesbar størrelse, i en form som
ikke ser ut som en feilmelding. Et forbehold som er designet bort er en
usannhet.

## 6. Sammenstillinger som lyver, og hvordan de rettes

Fire funn fra revisjonen er designproblemer og løses her.

**Ett selskap, flere merker — én rad.** 7-Eleven og Narvesen viste identiske
tall fordi de ER samme selskap (Reitan Convenience Norway AS). Cubus og
Dressmann likeså (Varner AS). Radmodellen antok ett merke = ett selskap.

Ny modell: **én rad per selskap**, med merkene som chips inne i raden.

```
REITAN CONVENIENCE NORWAY AS        738 mill. kr
Narvesen · 7-Eleven                     −31,0 %
Oslo · 300 ansatte · regnskapsår 2025
```

To rader med samme tall forsvinner, og raden blir sannere enn før.

**Franchisegiver er ikke butikkdrift.** Coop Extra viser 66,8 mrd fordi org_nr
peker på Coop Norge SA, samvirkets engrosregnskap, mens KIWI peker på et
kjedekontor. Rader som ikke er sammenlignbare skal ikke stå i samme visuelle
kolonne. Merk selskapsrollen i raden — `franchisegiver`, `kjedekontor`,
`driftsselskap`, `engros` — og sorter aldri på tvers av roller uten at rollen er
synlig. Merknaden finnes i `brands.merknad`; den skal leses, ikke ligge i en
hover.

**CAGR har ikke ett årstall.** «STØRST VEKST (CAGR) · +22,5 % · 2024» er
misvisende. En flerårig vekstrate skal stemples med perioden: «2019–2024», aldri
med ett år. Samme for topplistenes vekstkolonne, der «+462,5 %» er treårs total
presentert ved siden av forsidens årlige CAGR.

**Luksusstripa lover mer enn tallene.** Min copy sier «marginene er poenget:
20–25 % mot 2–7 % i vanlig butikkhandel». Av ni aktører ligger to der; resten er
2,1–10,2 %. Skriv om til det tallene viser: at spennet er stort, og at de to
høyeste ligger på 20,6 % og 25,3 %. En påstand som ikke dekkes av kortene under
den er den samme feilen som feil næringskode, bare i copy.

## 7. Motion

150–250 ms. Tilstand, ikke koreografi.

Tillatt: tilstandsendring, fokusflytting, innlasting (skeleton, aldri spinner
midt i innhold), utvidelse av `Grunnlag` og forbehold.

Ikke tillatt: orkestrert innlasting av siden, tall som teller opp, grafer som
tegner seg selv ved scroll. Brukeren er i en beslutning, ikke i en presentasjon.
`prefers-reduced-motion` respekteres uten unntak.

## 8. Tomme og manglende tilstander

Et dataprodukt lever av at hull ser ut som hull og ikke som nuller.

- **Ingen tall:** «ikke publisert», med kildelinjen som forklarer hvorfor der vi
  vet det (`mangel_arsak`). Aldri 0, aldri tom streng, aldri en strek.
- **Tom seksjon:** fjernes fra DOM. «Ingen av de 0 anslagene har lav konfidens»
  er en tom seksjon som fikk stå.
- **Tomt panel som er forventet:** skal lære grensesnittet. En kategori uten
  selskapsliste skal si hvorfor — femansatte-gulvet — ikke bare være tom.
- **Falsy-fella:** `{tall && <X/>}` med tallet 0 rendrer «0». Bruk alltid
  eksplisitt sammenligning. Det står et løst «0» på næringssidene i dag av
  nettopp denne grunnen.

## 9. Ingen hardkodede tall i copy

Forsiden sa «1 058 næringskoder til **30** bransjer» da det var 40. Begge tall
var hardkodet i en JSX-streng.

Alle tall i copy hentes fra basen med `count: 'exact'`. Dette er ikke en
kodestandard, det er en designregel: et produkt som selger presisjon kan ikke ha
feil tall i sin egen ingress.
