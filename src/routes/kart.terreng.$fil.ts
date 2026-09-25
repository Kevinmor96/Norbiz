// /kart/terreng/<kommunenr>.svg: stiene i kartbladets terreng, én fil per
// kommune (src/lib/terreng.ts). Kartbladet og løypekartet tegner dem med
// <use href>. I den statiske eksporten er dette en fil (vite.statisk.config.ts).
//
// Innholdet endres bare med terrengfila, og adressen i siden har et avtrykk av
// den i spørrestrengen. Derfor kan fila huskes lenge.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kart/terreng/$fil")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const m = /^(\d{4})\.svg$/.exec(params.fil);
        const { terrengSvg } = await import("@/lib/terreng-fil");
        const svg = m ? await terrengSvg(m[1]!) : null;
        if (!svg) return new Response("Ikke funnet", { status: 404 });
        return new Response(svg, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
