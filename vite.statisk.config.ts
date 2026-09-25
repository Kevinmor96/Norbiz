// Statisk eksport: samme oppsett som vite.config.ts, men sidene forhåndsrendres
// til HTML-filer i .output/public som kan legges ut som rene filer.
//
//   npm run build:statisk   ->  .output/public
//
// vite.config.ts er Lovable-malen og holdes lik den. Denne filen er bare for oss.
//
// Nitro-målet må stå på standarden (cloudflare-module). Forhåndsrenderingen i
// @lovable.dev/vite-tanstack-config kaller fetch() på nitros serverinngang, og
// node-server-målet eksporterer ingen fetch, det starter en lytter. Da feiler
// hver side med 500 og bygget henger.
import { readdirSync, readFileSync } from "node:fs";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Hver kommune og hvert organ får en fil, også organene ingen side lenker til
// uten JavaScript (de sammenfoldede båndene i organkartet viser bare de første).
// Da har hver adresse i /sitemap.xml en fil. Lista leses fra datasettene på
// samme måte som datalaget gjør det: ett datasett per fil i src/data/, og
// sluggen er filnavnet (src/lib/data/lokal.ts).
const datasett = readdirSync("src/data").filter((f) => f.endsWith(".json"));
const datasider = datasett.flatMap((fil) => {
  const d = JSON.parse(readFileSync(`src/data/${fil}`, "utf8")) as {
    organisasjoner?: { key: string }[];
  };
  return [
    { path: `/kommune/${fil.replace(/\.json$/, "")}` },
    ...(d.organisasjoner ?? []).map((o) => ({ path: `/organ/${o.key}` })),
  ];
});

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    prerender: {
      enabled: true,
      // Følger lenkene fra sidene under, så nye kommune- og organsider kommer med
      // av seg selv når forsiden lenker til dem.
      crawlLinks: true,
      failOnError: true,
    },
    pages: [
      { path: "/" },
      { path: "/metode" },
      { path: "/pro" },
      ...datasider,
      // Serverrutene, som filer. Innholdet følger VITE_NETTSTED_URL ved bygging.
      { path: "/sitemap.xml" },
      { path: "/robots.txt" },
    ],
  },
});
