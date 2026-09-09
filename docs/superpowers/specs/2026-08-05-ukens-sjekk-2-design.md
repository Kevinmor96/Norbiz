# Ukens sjekk 2.0 — hero-eksemplet som innsalg

Dato: 2026-08-05. Status: til gjennomlesning.

## Hva som bygges, og hvorfor

«Ukens sjekk»-panelet på forsiden er produktets viktigste innsalg: det første
ferdige svaret en besøkende ser. Dagens versjon (to tall og en tekstlinje) er
for tynn til å bære den jobben. Panelet bygges om til en **minirapport**: graf
over årene, lønn, margin, omsetning og de tre største aktørene — imponerende,
selvforklarende og ærlig på samme tid.

Forutsetningen er at lønn blir ekte. `industry_wages` er den siste
mock-flaten i basen, og et demo-stempel midt i innsalget er uaktuelt. Derfor
har designet to deler som henger sammen: **A) lønnsimporten**, **B) panelet**.

## Del A — ekte lønn fra SSB-tabell 11419

Verifisert mot API-et 2026-08-05 (`data.ssb.no/api/v0/no/table/11419`):

- Tittel: «Månedslønn, etter statistikkmål, yrke, sektor, næring (SN2007) …»
- `MaaleMetode`: Gjennomsnitt, **Median**, Nedre kvartil, Øvre kvartil,
  Antall arbeidsforhold, Antall heltidsekvivalenter.
- `Yrke` og `Sektor` har `elimination: true` — «Alle yrker» og «Sum alle
  sektorer» kan hentes per næring.
- Næringsdimensjonen er **SSBs lønnsgrupper**, ikke frie NACE-koder:
  «Restaurantvirksomhet», «Detaljhandel, unntatt med motorvogner» osv. Kodene
  bak gruppene leses av tabellmetadataene i implementasjonen; mapping til våre
  kategorier går via NACE-prefiks, og **gruppens navn følger med ut** slik at
  UI-et kan si hvilken flate lønnen gjelder.

Konsekvenser:

1. **Kvartiler, ikke desiler.** Skjemaet fra migrasjon 0009 har
   `manedslonn_desil1/desil9` — antakelsen om desiler holder ikke mot kilden.
   Migrasjon bytter til `manedslonn_kvartil_nedre/kvartil_ovre` (mock-data er
   det eneste som går tapt), og invarianten «Lønnsspennet er målt» i CLAUDE.md
   oppdateres fra desil til kvartil. Spennet er fortsatt målt — det er bare
   smalere enn planlagt.
2. **Ny edge function `import-lonn`**, samme mønster som `import-ssb`:
   idempotent upsert på naturlig nøkkel, `data_quality='ssb'`,
   standardtegnene (`.` `..` `:` `-`) håndteres som i resten av importene.
   Nasjonalt nivå, alle år tabellen har.
3. **Ny DB-funksjon `kategori_lonn(slug)`** returnerer median, snitt,
   kvartilspenn, år og *lønnsgruppens navn* for kategoriens nærmeste
   NACE-match. Aggregatet bor i basen, ikke i frontend (PostgREST-invarianten).
4. Når importen er kjørt: `generate-insights` og `generate-artikkel` kan få
   lønn i nyttelasten (egen oppfølging, ikke del av dette designet).

## Del B — panelet

Fortsatt: hele panelet er én lenke til kategorisiden, `bg-panel`, ekte tall
hentet live, deterministisk ukesrotasjon (uendret mekanikk).

Layout (desktop; mobil stabler i samme rekkefølge):

```
UKENS SJEKK · Helse & velvære
Hva tjener en frisørsalong i Norge?

┌────────────────────────────┬──────────────────────────────┐
│ 16,9 %        +3,5 %       │  Omsetning 2017–2024         │
│ driftsmargin  vekst siste år│  [arealgraf, 8 punkter,     │
│                            │   endepunkt markert,         │
│ 33 400 kr     1,3 mill. kr │   første/siste år + verdi]   │
│ median måneds-  omsetning   │                              │
│ lønn (snitt     per foretak │                              │
│ 35 100 kr)     (snitt)     │                              │
└────────────────────────────┴──────────────────────────────┘
Størst i Norge · Regnskapsregisteret
1  NIKITA GRUPPEN NORGE AS   462,9 mill. kr   7,7 %   2024
2  CUTTERS AS                346,3 mill. kr   2,7 %   2024
3  TANGO DRIFT AS            177,3 mill. kr   9,2 %   2025

SSB strukturstatistikk · 2024 · foretak    Se hele sjekken →
```

Beslutninger med begrunnelse:

- **Fire nøkkeltall, ikke flere:** driftsmargin, vekst siste år, median
  månedslønn (med snitt som undertall), snittomsetning per foretak.
  Tallbudsjett-regelen gjelder også her — panelet skal friste, kategorisiden
  skal mette.
- **Lønn vises som median med snitt i undertall.** Median er det ærligste
  ett-tallet for «hva tjener folk», og 11419 måler begge. Lønnsgruppens navn
  står i kildelinjen når den er bredere enn kategorien.
- **Median omsetning finnes ikke.** SSB publiserer summer (som gir snitt),
  ikke fordeling per foretak. En «median» fra vårt eget selskapsutvalg ville
  arvet femansatte-gulvet hos Brreg og målt de største, ikke midten. Panelet
  sier «snitt» eksplisitt på omsetningstallet i stedet for å servere en
  median som lyver. (Ønsket om snitt + median innfris der kilden faktisk
  måler begge: lønnen.)
- **Grafen viser hele serien 2017–2024** (8 år — «siste 5» er et gulv, ikke
  et tak), arealgraf med markert endepunkt, årstall og kroneverdi i endene.
  Større enn sparkline: dette er panelets visuelle anker.
- **Topp 3 med rangnummer, omsetning, margin og regnskapsår** — merke-chip
  der kjedelista kjenner selskapet (Cutters vises som Cutters).
- **Eierlønn-regelen gjelder:** i kategorier med `eierlonn_i_resultat` får
  marginen info-merket, som ellers i produktet.
- Alle «ikke publisert»-regler som ellers; panelet velger bare kategorier som
  har margin, serie og lønn, så innsalget aldri viser hull.

## Testing

- Migrasjonen og `kategori_lonn` testes i PGlite som resten (kvartilrekkefølge-
  constraint, NACE-prefiksmatch, at mock-lønn aldri returneres når ssb-rader
  finnes).
- `import-lonn` tørrkjøres mot 11419 og stikkprøves mot statistikkbanken før
  skarp kjøring — samme rutine som de andre importene.
- Panelet verifiseres i Lovable-preview mot kjente frisørtall.

## Rekkefølge

1. Migrasjon (kvartilkolonner) + `kategori_lonn` + tester.
2. `import-lonn`, tørrkjøring, skarp kjøring, stikkprøve.
3. Lovable-brief for panelet (sendes først når lønnen er ekte i basen).
4. CLAUDE.md- og knowledge-oppdatering (lønn ikke lenger mock).
