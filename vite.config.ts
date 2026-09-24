// @lovable.dev/vite-tanstack-config har allerede disse med. IKKE legg dem til her, doble
// plugins knekker appen:
//   TanStack devtools (bare i dev, først), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//   nitro (bare ved build, med cloudflare som standardmål), VITE_*-injeksjon, @-alias,
//   dedupe av React/TanStack, feillogger-plugins og sandkassedeteksjon (port/host/strictPort).
// Ekstra oppsett går gjennom defineConfig({ vite: { ... } }) og de andre valgene ved behov.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Sender TanStack Starts serverinngang til src/server.ts (SSR-feilomslaget vårt).
    // nitro/vite bygger fra denne.
    server: { entry: "server" },
  },
});
