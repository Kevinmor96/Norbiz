// /data/kommune/<slug>.json: hele kommunesiden som JSON. Den statiske
// eksporten har ingen server, så nettleseren henter kommunesiden herfra i
// stedet for fra serverfunksjonen (src/lib/data/hent.ts). Med server er ruten
// den samme dataen, og kan hurtiglagres.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/data/kommune/$fil")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(params.fil);
        const side = m ? await (await import("@/lib/kommuneside")).lastKommuneside(m[1]!) : null;
        if (!side) return Response.json({ feil: "Ikke funnet" }, { status: 404 });
        return Response.json(side, { headers: { "cache-control": "public, max-age=300" } });
      },
    },
  },
});
