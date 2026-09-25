// Statisk eksport: samme oppsett som vite.config.ts, men sidene forhåndsrendres
// til filer i .output/public som kan legges ut som rene filer.
//
//   npm run build:statisk   ->  .output/public
//
// vite.config.ts er Lovable-malen og holdes lik den. Denne filen er bare for oss.
//
// Nitro-målet må stå på standarden (cloudflare-module). Forhåndsrenderingen i
// @lovable.dev/vite-tanstack-config kaller fetch() på nitros serverinngang, og
// node-server-målet eksporterer ingen fetch, det starter en lytter. Da feiler
// hver side med 500 og bygget henger.
//
// Hva eksporten inneholder, og hvorfor:
//
// - Sidene: forsiden, metoden, Pro, hver kommune med datasett, hvert fylke i
//   regionregisteret og hvert organ. Organsidene er om lag 1 900 filer på
//   rundt 60 kB. Det er mange, men ikke for mange, og en lenke til et organ
//   (fra søk, delt adresse, uten JavaScript) skal virke også her. Blir de for
//   mange, er vekselen `ORGANSIDER` under: da forhåndsrendres ikke
//   organsidene, og /organ/<key> virker bare via organskuffen på
//   kommunesiden, som henter /data/organ/<key>.json.
// - Dataene nettleseren henter når det ikke finnes noen server
//   (src/lib/data/hent.ts): /data/kommune/<slug>.json (hele kommunesiden, som
//   seksjonene hydreres fra), /data/organ/<key>.json (organskuffen) og
//   /data/sokeindeks.json (søket).
// - Terrenget: /kart/terreng/<kommunenr>.svg, stiene kartbladet og
//   løypekartet tegner med <use href> (src/lib/terreng.ts).
// - /sitemap.xml og /robots.txt, som filer.
//
// Lista leses fra filene på samme måte som datalaget gjør det: ett datasett per
// fil i src/data/, og sluggen er filnavnet.
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/** Forhåndsrender organsidene. Se over. */
const ORGANSIDER = true;

const datasett = readdirSync("src/data")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((fil) => ({
    slug: fil.replace(/\.json$/, ""),
    data: JSON.parse(readFileSync(`src/data/${fil}`, "utf8")) as {
      organisasjoner?: { key: string }[];
    },
  }));

const organer = [
  ...new Set(datasett.flatMap((d) => (d.data.organisasjoner ?? []).map((o) => o.key))),
].sort();

const fylker = existsSync("src/routes/fylke.$slug.tsx")
  ? (
      JSON.parse(readFileSync("src/data/region/nord-norge.json", "utf8")) as {
        fylker: { navn: string }[];
      }
    ).fylker.map((f) =>
      f.navn
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
  : [];

const terreng = readdirSync("src/data/terreng")
  .filter((f) => /^\d{4}\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const sider = [
  { path: "/" },
  { path: "/metode" },
  { path: "/pro" },
  ...datasett.map((d) => ({ path: `/kommune/${d.slug}` })),
  ...fylker.map((slug) => ({ path: `/fylke/${slug}` })),
  ...(ORGANSIDER ? organer.map((key) => ({ path: `/organ/${key}` })) : []),
];

const filer = [
  ...datasett.map((d) => ({ path: `/data/kommune/${d.slug}.json` })),
  ...organer.map((key) => ({ path: `/data/organ/${key}.json` })),
  { path: "/data/sokeindeks.json" },
  ...terreng.map((nr) => ({ path: `/kart/terreng/${nr}.svg` })),
  // Serverrutene, som filer. Innholdet følger VITE_NETTSTED_URL ved bygging.
  { path: "/sitemap.xml" },
  { path: "/robots.txt" },
];

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    prerender: {
      enabled: true,
      // Følger lenkene fra sidene, så en side ingen liste over nevner, men som
      // en side lenker til, kommer med.
      crawlLinks: true,
      failOnError: true,
      // Uten organsider følges heller ikke lenkene til dem.
      filter: (side: { path: string }) => ORGANSIDER || !side.path.startsWith("/organ/"),
    },
    pages: [...sider, ...filer],
  },
});
