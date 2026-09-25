// /data/organ/<key>.json: organprofilen som JSON, til organskuffen og
// /organ/$key i den statiske eksporten, der serverfunksjonen ikke finnes
// (src/lib/data/hent.ts). Samme svar som serverfunksjonen.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/data/organ/$fil")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(params.fil);
        if (!m) return Response.json({ feil: "Ikke funnet" }, { status: 404 });
        const [{ data }, { tilSiden }] = await Promise.all([
          import("@/lib/data"),
          import("@/lib/nyttelast"),
        ]);
        const profil = await data.organ_profil(m[1]!);
        if (!profil) return Response.json({ feil: "Ikke funnet" }, { status: 404 });
        return Response.json(tilSiden(profil), {
          headers: { "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
