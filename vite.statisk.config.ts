// Statisk eksport: samme oppsett som vite.config.ts, men sidene forhåndsrendres
// til HTML-filer i .output/public, og nitro bygger ingen server.
//
//   npm run build:statisk   ->  .output/public (kan legges ut som rene filer)
//
// vite.config.ts er Lovable-malen og holdes lik den. Denne filen er bare for oss.
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
  nitro: { preset: "node-server" },
});
