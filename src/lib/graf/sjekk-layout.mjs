// Sjekker oppsettet for nettverksgrafen mot datasettene i src/data/.
//
//   node src/lib/graf/sjekk-layout.mjs
//
// Tre krav fra DESIGN.md §5.5, for hver kommune:
//   1. Samme data gir identiske koordinater (regnet to ganger, og én gang med
//      nodene og kantene i omvendt rekkefølge).
//   2. Ingen etikettkollisjoner: ingen kant krysser et organnavn eller et annet
//      skilt, ingen etiketter overlapper, og alt står innenfor lerretet.
//   3. Utvalgsregelen er brukt: ingen kant går mellom et organ og organet rett under.
//
// Skriptet kjører TypeScript-filene gjennom Vite, fordi datalaget laster
// datasettene med import.meta.glob. Det avslutter med kode 1 ved feil.

import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const rot = fileURLToPath(new URL("../../..", import.meta.url));
const server = await createServer({
  configFile: false,
  root: rot,
  logLevel: "error",
  resolve: { alias: { "@": `${rot}src` } },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});

let feil = 0;
try {
  const { lokal } = await server.ssrLoadModule("/src/lib/data/lokal.ts");
  const { byggGrafmodell, grafInn } = await server.ssrLoadModule("/src/lib/graf/modell.ts");
  const { regnOppsett, lerretFor, finnKollisjoner } = await server.ssrLoadModule("/src/lib/graf/layout.ts");

  for (const k of await lokal.kommuner()) {
    const [nettverk, organkart, eierskap] = await Promise.all([
      lokal.nettverk(k.kommunenr),
      lokal.organkart(k.kommunenr),
      lokal.eierskap(k.kommunenr),
    ]);
    const modell = byggGrafmodell({ nettverk, organkart, eierskap, sammenstilt: k.sammenstilt });
    const inn = grafInn(modell);
    const lerret = lerretFor(inn.noder.length);

    const a = regnOppsett(inn, lerret);
    const b = regnOppsett(inn, lerret);
    const omvendt = regnOppsett(
      {
        noder: [...inn.noder].reverse(),
        kanter: [...inn.kanter].reverse(),
        knuter: [...inn.knuter].reverse().map((k) => ({ ...k, organer: [...k.organer].reverse() })),
      },
      lerret,
    );
    const koordinater = (g) =>
      JSON.stringify({
        hoyde: g.hoyde,
        noder: g.noder.map((n) => [n.key, n.x, n.y, n.etikett.side]),
        knuter: g.knuter.map((n) => [n.id, n.x, n.y]),
        kanter: [...g.kanter]
          .sort((x, y) => (x.id < y.id ? -1 : 1))
          .map((e) => [e.id, e.sti, e.skilt && [e.skilt.x, e.skilt.y]]),
      });
    const likt = koordinater(a) === koordinater(b) && koordinater(a) === koordinater(omvendt);
    const kollisjoner = finnKollisjoner(a);

    const overordnet = new Map();
    for (const g of organkart.grupper) for (const o of g.organer) overordnet.set(o.key, o.overordnet);
    const brudd = modell.personkanter.filter(
      (e) => overordnet.get(e.fra) === e.til || overordnet.get(e.til) === e.fra,
    );

    console.log(`\n${k.navn} (${k.kommunenr})`);
    console.log(
      `  ${modell.noder.length} noder, ${modell.personkanter.length} personkanter, ` +
        `${modell.eierkanter.length} eierkanter, ${modell.struktur.length} strukturkoblinger utelatt`,
    );
    console.log(
      `  ${modell.knuter.length} knuter (personer i tre eller flere organer), lerret ${a.bredde} × ${a.hoyde} px`,
    );
    console.log(`  deterministisk: ${likt ? "ja" : "NEI"}`);
    console.log(`  etikettkollisjoner: ${kollisjoner.length}`);
    for (const c of kollisjoner) console.log(`    ${c.hva}: ${c.a} ${c.b}`);
    console.log(`  kanter mellom et organ og organet rett under: ${brudd.length}`);
    if (!likt || kollisjoner.length > 0 || brudd.length > 0) feil += 1;
  }
} finally {
  await server.close();
}

console.log(feil ? `\n${feil} kommune(r) feilet.` : "\nAlt i orden.");
process.exit(feil ? 1 : 0);
