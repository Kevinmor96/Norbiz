// /robots.txt. En rute og ikke en fil i public/, fordi linjen «Sitemap:»
// krever en absolutt adresse, og den finnes bare når VITE_NETTSTED_URL er satt
// (se src/lib/nettsted.ts). Uten domene står linjen ikke der.

import { createFileRoute } from "@tanstack/react-router";

import { harDomene, nettstedUrl } from "@/lib/nettsted";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const linjer = ["User-agent: *", "Allow: /"];
        if (harDomene) linjer.push("", `Sitemap: ${nettstedUrl("/sitemap.xml")}`);
        return new Response(`${linjer.join("\n")}\n`, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
