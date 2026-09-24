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
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
      // Forsiden lenker ikke til kommunesiden ennå. Fjernes når den gjør det.
      { path: "/kommune/tromso" },
    ],
  },
});
