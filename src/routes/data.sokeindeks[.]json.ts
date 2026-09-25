// /data/sokeindeks.json: det søket leter i, over alle kommunene. Den statiske
// eksporten har ingen server å søke på, så søket (src/components/region/sok.tsx)
// henter denne fila og søker i nettleseren med `sokI` (src/lib/data/sok.ts), med
// de samme reglene som datalaget og basen. Med server søker serverfunksjonen,
// og fila brukes ikke.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/data/sokeindeks.json")({
  server: {
    handlers: {
      GET: async () => {
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
