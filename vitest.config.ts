// Testene for datalaget kjører i Node og skal ikke laste Lovable-oppsettet i
// vite.config.ts (TanStack Start, nitro, Tailwind). Derfor egen konfig.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
