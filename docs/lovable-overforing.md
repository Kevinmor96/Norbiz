# Flytte Maktkart til Lovable

Siden er bygget i dette repoet først, på nøyaktig samme stack som Lovable
genererer:

- TanStack Start med SSR, React 19, Vite og Tailwind 4
- shadcn/ui og Supabase
- `@lovable.dev/vite-tanstack-config`

Stacken er speilet fra Bransjesjekk-prosjektet i Lovable
(`5bab9b75-aa19-4f9b-b7db-1472ffd79523`). Flyttingen er derfor en kopi, ikke en
omskriving. Dette dokumentet er rekkefølgen.

## Hva som flyttes og hva som blir her

| Del | Hvor den bor | Hvorfor |
|---|---|---|
| `src/`, `public/`, `components.json`, `vite.config.ts`, `styles.css` | Lovable | Frontend. Lovables agent kan jobbe videre med den. |
| `supabase/migrations/`, `supabase/seed/` | **Repoet** (Lovable leser basen, ikke filene) | Skjemaet er kontrakten. Personvernet håndheves i basen, og det skal ikke endres via naturlig språk. |
| `tests/` | **Repoet** | PGlite-testene beviser at RLS holder og at siden og basen sier det samme. |
| Verifiseringspipelinen (Brreg-importør) | **Repoet**, deployet som edge function | Innhenting, navnematching og versjonering er ikke en frontend-oppgave. |
| `src/data/*.json` | Begge, til Supabase er koblet | Når Supabase er koblet, leser siden fra basen, og JSON-filene er bare seed. |

## Rekkefølge

1. **Opprett et eget Supabase-prosjekt for Maktkart** i EU-region. Bruk ikke
   Bransjesjekk-basen, fordi personopplysninger gir en annen personvernprofil.
2. **Kjør migrasjonene** `0001`–`0016` i rekkefølge med `supabase db push`, eller
   med `apply_migration` via MCP. Kjør deretter `supabase/seed/seed.sql`.
   Kontroller i SQL-editoren at `select public.kommuner();` returnerer Tromsø.
3. **Bytt datakilde.** I `src/lib/data/index.ts` byttes `data = lokal` med
   `lagSupabaseDatalag(client)`. Kommentaren i fila viser linjen. Formene er
   like, og det håndheves av `tests/kontrakt.test.ts`.
4. **Sett miljøvariablene** `VITE_SUPABASE_URL` og `VITE_SUPABASE_PUBLISHABLE_KEY`.
   Ventelisten og innsigelsesskjemaet begynner da å lagre av seg selv. Uten
   klient sier kvitteringene at forhåndsversjonen ikke lagrer.
5. **Lovable-prosjektet.**
   - Nye Lovable-prosjekter bruker TanStack Start med SSR fra mai 2026. Det står
     i Lovables egen dokumentasjon, men vi har bare lest søkeresultater om det,
     ikke selve dokumentasjonen, fra dette miljøet.
   - Sjekk først om Lovable kan kobles til dette GitHub-repoet direkte.
   - Hvis ikke: opprett et nytt prosjekt, koble det til et nytt repo, og kopier
     inn `src/`, `public/`, `components.json`, `styles.css` og avhengighetene fra
     `package.json`. `vite.config.ts` beholdes som Lovable lager den.
   - **Ikke aktiver Lovable Cloud** og ikke la Lovable opprette tabeller. Basen er
     ferdig.
6. **Prosjektkunnskap.** Lim `lovable/knowledge.md` inn som prosjektkunnskap i
   Lovable. Den er den bindende kontrakten for Lovables agent. Den er kortere
   enn `CLAUDE.md` og `DESIGN.md`, men har de samme reglene.
7. **Domene.** Når navnet er bestemt, settes `VITE_NETTSTED_URL`, slik at
   kanoniske URL-er og og-tagger blir absolutte.

## Avvik fra Lovables standardoppsett

Grunnmuren er kopiert fra Bransjesjekk-prosjektet, med disse bevisste avvikene:

- **Fjernet:** `@lovable.dev/mcp-js` og `mcpPlugin`, Lovables feilrapportering,
  `AuthProvider`, samt Google Fonts-lenken. Fonten er selvhostet via
  `@fontsource-variable/archivo`, så siden ikke sender forespørsler til
  tredjeparter.
- **Temaleverandøren** støtter system, lys og mørk via `data-theme`. Et lite
  skript i `<head>` setter temaet før første maling.
- **Ekstra skript** i `package.json`: `typecheck`, `test`, `seed:build`,
  `terreng`, `build:node`, `build:statisk` og `start`. Ekstra filer er
  `vite.statisk.config.ts` og `vitest.config.ts`. Lovable trenger ingen av dem,
  og de kan ligge.
- **`npm run preview` virker ikke** med Lovables konfigurasjon i dette oppsettet.
  Bruk `build:node` og `start` lokalt.
