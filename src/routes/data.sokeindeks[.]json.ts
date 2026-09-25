// /data/sokeindeks.json: det søket leter i, over alle kommunene. Den statiske
// eksporten har ingen server å søke på, så søket (src/components/region/sok.tsx)
// henter denne fila og søker i nettleseren med `sokI` (src/lib/data/sok.ts), med
// de samme reglene som datalaget og basen.
//
// Fila finnes bare i eksporten. Med server svarer ruten 404: der søker
// serverfunksjonen, som aldri gir mer enn noen treff per spørring, og det er
// ingen grunn til å dele ut alle rollene i én fil. Eksporten er et
// øyeblikksbilde av JSON-filene. En sperring etter en innsigelse står i basen,
// ikke i filene, så eksporten må bygges på nytt og sjekkes etter en sperring.

import { createFileRoute } from "@tanstack/react-router";

import { STATISK } from "@/lib/statisk";

export const Route = createFileRoute("/data/sokeindeks.json")({
  server: {
    handlers: {
      GET: async () => {
        if (!STATISK) return new Response("Ikke funnet", { status: 404 });
        const [{ lokal }, { tilSiden }] = await Promise.all([
          import("@/lib/data/datasett"),
          import("@/lib/nyttelast"),
        ]);
        return Response.json(tilSiden(await lokal.sokegrunnlag()), {
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
