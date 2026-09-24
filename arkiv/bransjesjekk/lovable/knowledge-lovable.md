# Bransjesjekk — faste regler

Svarer på ett spørsmål, stilt slik folk faktisk stiller det: **hva tjener de som
driver med dette — og kan jeg gjøre det alene?** Målgruppe i prioritert
rekkefølge: **den som vurderer å starte for seg selv, og den nysgjerrige** — de
starter trafikken; deretter investorer og oppkjøpere; rådgivere og banker sist.

Alt innhold på **norsk bokmål**. Produktet heter **Bransjesjekk** og bor på
`bransjesjekk.no`. Det het Bransjeindeks fram til 2026-08-05 — ingen flate skal
lenger vise det gamle navnet.

## Posisjonering

Tallene finnes hos Proff, Purehelp, Brønnøysund og SSB — alle svarer på «hvordan
går det med dette selskapet?» Vi svarer på noe annet: **«hva tjener de som
driver med dette, og kan jeg gjøre det alene?»**

Rammen ble snudd 2026-09-08. Den gamle — «er denne typen virksomhet verdt å
drive, her?» — møter folk feil sted: den forutsetter at leseren allerede har en
forretningsidé og vet hva bransjen heter. Samme data, snudd mot leseren. All ny
copy stiller det nye spørsmålet, og rammen er **«starte for deg selv»**, aldri
«side hustle»: vi ser registrerte foretak med regnskap, ikke småjobber.

Vi er sammenstillingslaget, ikke en femte kilde: **bransje, ikke bedrift**;
**sammenstilt, ikke rådata**; og viktigst — **vi sier hva vi ikke vet**, hvert
tall bærer sin opprinnelse. Det siste veier mest: en datakilde er lett å kopiere,
disiplinen i å innrømme usikkerhet er ikke. Aldri skjul et hull eller pynt på et
anslag for at siden skal se mer komplett ut.

«Sjekk» er brukerens handling, aldri vår: skriv aldri «Bransjesjekk har sjekket
N selskaper» — vi har sammenstilt, ikke revidert.

## Datakilde — les dette først

All data leses fra et **eksternt Supabase-prosjekt** som allerede er ferdig
migrert og fylt. Ikke aktiver Lovable Cloud, ikke opprett tabeller, ikke kjør
migrasjoner, ikke skriv til basen — skjemaet er kontrakten.

```
VITE_SUPABASE_URL=https://jcpuhhrqhgrnihiacosy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_S8Q8z1l1iOf5ERSKZALT2g_WLc64Mdx
```

Les via TanStack Query. Aldri hardkodede tall, aldri live API-kall til SSB eller
Brreg fra frontend. PostgREST kapper ved 1 000 rader — bruk `hentAlle` for alt
som kan overstige det.

## TO KODEVERK SOM DELER TALLFORMAT, IKKE BETYDNING

`category_members` har to kildespråk, og de skal ALDRI blandes:

- `kilde='ssb'` er **SN2007**-koder — mot industry_stats, industry_demography,
  industry_wages, industries og alt annet SSB.
- `kilde='brreg'` er **SN2025**-prefikser — KUN mot `companies`.

Samme siffer betyr ulike bransjer: 47.762 er blomster i SN2007 og kjæledyr i
SN2025. Et SSB-oppslag som får med brreg-koder henter tall for HELT ANDRE
næringer — feilen har truffet produksjon én gang (bilforhandler viste hele
detaljhandelens konkurstall). Hver spørring mot category_members skal ha
eksplisitt `kilde`.

## Solo-laget — den nye inngangen

**`solo_oversikt()`** gir alle kategoriene rangert fra færrest ansatte per
foretak og oppover, med margin, driftsresultat per foretak, median månedslønn og
vekst. Datagrunnlag for `/alene`.

`soloklasse` er en **merking av et målt tall**, ikke et nytt tall — samme
konstruksjon som `eierlonn_i_resultat`. Skriv den om, vis aldri rå verdi:
`alene` (< 1,5) → «Typisk én person»; `to` (1,5–2,9) → «Deg og én til»; `lag`
(3–9,9) → «Et lite lag»; `bedrift` (≥ 10) → «En bedrift». Tallet står ved siden
av merkingen. «0,9 ansatte per foretak» er statistikk; «det typiske
fysioterapiforetaket er én person» er et svar — skriv det andre, vis det første.

**`hva_ma_du_omsette(slug, mal_mnd)`** inverterer bransjens målte driftsmargin.
Tre regler, alle påkrevd:

1. **Vis `nodvendig_omsetning_mnd` alltid sammen med `typisk_omsetning_mnd`.**
   «Du må omsette for 58 997 kr i måneden» alene er skummelt; «— et typisk
   frisørforetak omsetter for 110 195» gjør det brukbart. `andel_av_typisk_pct`
   sier hvor krevende det er.
2. **`eierlonn_i_resultat` MÅ vises som forbehold.** `true`: eieren gjør arbeidet
   ulønnet, og målbeløpet ligger nær det hun lever av. `false`/`null`:
   driftsresultatet er regnet ETTER at lønn er betalt, så målbeløpet er det
   foretaket sitter igjen med *i tillegg til* lønna. To ulike ting.
3. **Tom respons er et gyldig svar.** Ingen rad der marginen ikke er positiv
   (Blomster & hage, −0,61 % i 2024). Skriv «vi kan ikke regne dette for
   [kategori] — bransjen gikk med underskudd i [år]». Ikke fall tilbake på et
   estimat, og ikke skjul modulen uten forklaring.

Beløpet er aldri en inntektsprognose. Etterspørselen er leserens vurdering,
marginen er vår måling.

## Tre nivåer av sannhet

`data_quality`: `ssb`/`brreg` = målt (nøytral kildeangivelse), `beregnet` =
utledet (nøytral, med «beregnet»), `ai_anslag` = AI-vurdering (tydelig annen
form, med konfidens). Et anslag skal aldri kunne forveksles med et målt tall —
forskjellen må synes i periferisynet, ikke bare i badge-teksten.

Siden 2026-08-05 er **ingenting i basen mock**: statistikk, demografi, lønn
(ssb:11419) og folketall (ssb:07459) er målt; selskaper er brreg;
`ai_insights`/`articles` er `ai_anslag`. Ingen demo-badges skal vises.

## NULL er aldri 0

Mangler et tall, vis «ikke publisert» — aldri 0, aldri en tom celle.
`merknader` kartlegger felt til årsak; ved `konfidensielt`, skriv «skjult av
hensyn til konfidensialitet». For leseren er det ikke et hull: næringen har for
få aktører i regionen til at tallet kan oppgis, og det sier noe om markedet.

## To granulariteter samtidig

Nasjonale næringstall finnes på NACE 2–5, regionale kun på 2–3. Foretaksdemografi
kun på NACE 2, og vises BARE når kategoriens ssb-koder ligger i én divisjon. Vis
aldri finere granularitet enn kilden har.

## Foretak og virksomhet er ikke det samme

`unit_type` skiller dem. En frisørkjede er ett foretak og ti virksomheter.
Regionale rader finnes kun for `virksomhet`; bland dem aldri i samme sum.
Etiketten «bedrifter» hører til virksomhetstallet.

## AS-avgrensningen

`coverage = 'as_only'` dekker kun aksjeselskaper, fordi ENK ikke leverer
årsregnskap. Sammenlign aldri en slik rad ufiltrert med `alle`.

## Fylkesårganger

19 fylker til 2019, 11 fra 2020, 15 fra 2024. `regions` har `valid_from_year`/
`valid_to_year`. Kartet laster GeoJSON for årgangen, og viser hvilken.

## Lønn

`kategori_lonn(i_slug)` gir nyeste målte lønn (SSB 11419): median, gjennomsnitt,
nedre/øvre KVARTIL (ikke desiler), per heltidsekvivalent. Kilden måler per
lønnsgruppe — `gruppe_navn` skal alltid vises når gruppen er bredere enn
kategorien. Ingen rad = utelat seksjonen helt.

## Visuell retning

`DESIGN.md`-briefen gjelder og er allerede implementert: mørk grunn, lyse
datapaneler, Space Grotesk kun på figurer og i ordmerket, femdelt scorestripe
som eier hue 25°–155° (kategoriske farger 180°–330°), `tabular-nums` på alle
tall. Gjenbrukte mønstre: rangert rad, scorestripe, delta-pille, sparkline,
arealgraf. Animasjoner 150–250 ms, `prefers-reduced-motion` respekteres.
Skeleton, aldri spinner.

## Vekstpillen har en hard regel

Vises **bare** der det finnes tidsserie: næring og fylke ja, selskap og kommune
**aldri** (årstempel). CAGR stemples med perioden («2019–2024»).

## Scoren bærer sin egen proveniens

`score_total` er en **persentilrangering i en peer-gruppe**, ikke et mål på
lønnsomhet. Skriv peer-gruppen ved tallet, vis hvor mange av seks delscorer som
hadde data, og de to svakeste uten klikk.

## Flatene

Forsiden og topplistene er **anskaffelsesflaten**. Forsiden er en dør: én linje,
ett søkefelt, «Ukens sjekk»-minirapporten, ekte kategorikort. Søket matcher
lokalt mot `categories.sokeord` + navn + verden med diakritisk folding begge
veier.

Kategorisiden er produktet: H1 er `categories.sporsmal` (håndskrevet, uendret),
svaret over folden, egen `head()` med canonical. Næringssiden er
**rådgiverflaten**: forbeholdene først, ikke poengtavle. `/blogg` leser
`articles` (kun publiserte), med kildeboks fra `kilder`-feltet.

## Ingen «LIVE»-merkelapp

Kildene publiserer årlig med ett til to års etterslep. Årstempel, ikke løfte.

## Attribusjon er påkrevd

SSB er CC BY 4.0, Brreg er NLOD. Begge krever kildeangivelse; NLOD krever i
tillegg at det står at data er bearbeidet. `<Footnotes />` bærer dette.

## Vår egen undertrykking

Aggregater bygget nedenfra fra `companies` har samme minimumsterskel som kilden
(`score_config.min_enheter_aggregat`). Under: «skjult av konfidensialitetshensyn».

## Komponenter og budsjett

`<DataBadge quality source year coverage konfidens />` på hvert KPI-kort og hver
graf, kildelinje `KILDE · ÅRSTALL · ENHET`. `<InsightCard />` for `ai_insights`.
`<Footnotes />` generert fra radene siden viste.

Hver seksjon har et tallbudsjett, og nye tall må fortrenge gamle: KPI-rutenett
maks åtte tall, rangert rad ett hovedtall og ett støttetall. Databasen skal være
rik; skjermen skal være rolig. Ingen betalingsmur — gratis inntil trafikken er
der; `favorites` er den eneste brukereide tabellen.

## Ikke gjør

- Ikke hardkod tall i copy — hent med `count: 'exact'`. Gjelder også `<head>`.
- Ikke fyll NULL med 0. `{tall && <X/>}` med 0 rendrer «0».
- Ikke bruk `category_members` uten `kilde`-filter.
- Ikke sett en vekstpille på et selskap eller en kommune.
- Ikke vis score uten peer-gruppe og dekningsgrad.
- Ikke skriv «LIVE», «sanntid» eller «oppdatert daglig».
- Ikke vis anslag i samme visuelle form som målte tall.
- Ikke bygg innlogging foran de offentlige sidene.
- Ikke merk lønnsspennet som desiler — det er kvartiler.
- Ikke bygg betalingsmur eller premium-teasere.
- Ikke opprett tabeller eller kjør migrasjoner — basen er ferdig.
- Ikke bruk grønn hake som merke — grønt er opptatt av scorestripa, og en hake
  påstår «verifisert».
- Ikke bygg en mulighets- eller potensialindeks, uansett hvor godt den ser ut i
  en skisse.
- Ikke lov et inntektsbeløp. Vi sier hva du må omsette, aldri hva du vil tjene.
- Ikke regn skatt for leseren, og ikke plasser noen på riktig side av grensa
  mellom hobby og næring. Gjengi Skatteetatens terskler med kilde og lenk dit.
