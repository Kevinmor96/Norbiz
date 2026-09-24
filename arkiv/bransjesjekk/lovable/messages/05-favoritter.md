Siste side. Bygg favoritter og innstillinger.

## Auth

Supabase auth med magic link. Dette er den **eneste** grunnen til at innlogging
finnes i appen.

Ikke legg innlogging foran noe annet. Forsiden, dashboardet, næringssidene,
regionsidene og topplistene er og blir offentlige — de leses av `anon`, som har
lesetilgang på alle statistikk-tabellene.

## Favoritter

Fra `favorites`: `user_id`, `industry_id`, `region_id`, `created_at`.

Tabellen har RLS med en policy som binder rader til `auth.uid()`, så en bruker ser
kun sine egne rader — du trenger ikke filtrere på `user_id` i spørringen, men send
det med i `insert`.

Legg til og fjern favoritt fra næringssiden. En favoritt er alltid en næring
**og** en region — begge kolonnene er `not null`, fordi «Frisørsalong i Oslo» og
«Frisørsalong nasjonalt» er to forskjellige spørsmål.

Favorittlista skal vise samme rangerte rad som resten av appen, med score og
forbehold. Ikke lag en egen fattigere visning her.

## Innstillinger

Bytte mellom mørk og lys modus, og valg av standardregion. Standardregionen
lagres lokalt — ikke lag en ny tabell for den.

## Så er vi ferdige med sidene

Seks sider: forside, dashboard, næringsside, regionside, topplister, favoritter.
Ikke lag flere.

Og ingen betalingsmur, ingen planer, ingen premium-teasere noe sted. Produktet er
gratis inntil trafikken er der.

## Til slutt: en gjennomgang

Når favorittene er på plass, gå gjennom alle seks sidene og sjekk disse fem
tingene. Rapporter hva du fant, og fiks det du finner:

1. **Står det noen score eller noe plassnummer uten peer-gruppe og
   dekningsgrad?** Et umerket «#1» ved siden av omhyggelig merkede celler er
   verre enn ingen merking, fordi cellene låner troverdighet til overskriften.
2. **Finnes det en vekstpille på et selskap eller en kommune noe sted?** Det skal
   ikke være mulig — de har ett målepunkt.
3. **Er noen NULL vist som 0, eller som en tom celle?** Det skal stå «ikke
   publisert», eller «skjult av konfidensialitetshensyn» der `merknader` sier
   `konfidensielt`.
4. **Ser et anslag ut som et målt tall noe sted?** Forskjellen skal synes i
   periferisynet, ikke bare i badge-teksten.
5. **Står ordet «LIVE», «sanntid» eller «oppdatert» noe sted?** Kildene
   publiserer årlig med etterslep. Alt skal være årstempel.

Punkt 1 og 4 er de som er lettest å miste under bygging, og de er de to
viktigste.
