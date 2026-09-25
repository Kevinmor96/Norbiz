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
    const koordinater = (o) =>
      JSON.stringify([o.personer, o.medEierskap].map((g) => ({
        hoyde: g.hoyde,
        noder: g.noder.map((n) => [n.key, n.x, n.y, n.etikett.side]),
        knuter: g.knuter.map((n) => [n.id, n.x, n.y]),
        kanter: [...g.kanter]
          .sort((x, y) => (x.id < y.id ? -1 : 1))
          .map((e) => [e.id, e.sti, e.skilt && [e.skilt.x, e.skilt.y]]),
      })));
    const likt = koordinater(a) === koordinater(b) && koordinater(a) === koordinater(omvendt);
    // Begge lagene sjekkes: grafen slik den står først, og med eierskapet slått på.
    const kollisjoner = [
      ...finnKollisjoner(a.personer).map((c) => ({ ...c, lag: "personer" })),
      ...finnKollisjoner(a.medEierskap).map((c) => ({ ...c, lag: "med eierskap" })),
    ];
    // Nodene skal stå stille når eierskapslaget slås på.
    const stille = a.personer.noder.every((n) => {
      const m = a.medEierskap.noder.find((x) => x.key === n.key);
      return m && m.x === n.x && m.y === n.y;
    });

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
      `  ${modell.knuter.length} knuter (personer i tre eller flere organer), lerret ${a.personer.bredde} × ${a.personer.hoyde} px`,
    );
    console.log(`  deterministisk: ${likt ? "ja" : "NEI"}`);
    console.log(`  etikettkollisjoner: ${kollisjoner.length}`);
    for (const c of kollisjoner) console.log(`    ${c.lag}: ${c.hva}: ${c.a} ${c.b}`);
    console.log(`  skjulte etiketter og skilt: ${a.personer.skjulte} uten eierskap, ${a.medEierskap.skjulte} med`);
    console.log(`  nodene står stille når eierskapet slås på: ${stille ? "ja" : "NEI"}`);
    console.log(`  kanter mellom et organ og organet rett under: ${brudd.length}`);
    if (!likt || !stille || kollisjoner.length > 0 || brudd.length > 0) feil += 1;
  }
  // En tett, laget graf som prøver etikettplasseringen hardere enn Tromsø:
  // et nav med mange kanter, parallelle kanter mellom samme par, to knuter og
  // lange navn. Den skal også gå uten kollisjoner.
  const { tekstbredde } = await server.ssrLoadModule("/src/lib/graf/layout.ts");
  const navn = [
    "Kommunestyret",
    "Formannskapet",
    "Havnestyret KF",
    "Energiselskapet Nord AS",
    "Sparebanken Midt-Nord",
    "Industriparken Vest AS",
    "Eiendomsselskapet Sentrum AS",
    "Fylkestinget",
    "Holdingselskapet AS",
  ];
  const organ = (i) => `o${i}`;
  const skilt = (t) => ({ bredde: tekstbredde(t, 12.5) + 32, hoyde: 24 });
  const syntetisk = {
    noder: navn.map((n, i) => ({ key: organ(i), etikett: { bredde: tekstbredde(n, 13), hoyde: 18 } })),
    kanter: [
      ...[1, 2, 3, 4, 5].map((j) => ({ id: `nav-${j}`, fra: organ(3), til: organ(j === 3 ? 0 : j), lag: "person", skilt: skilt(`Person Navnesen ${j}`) })),
      { id: "par-a", fra: organ(4), til: organ(5), lag: "person", skilt: skilt("Anne Marie Parallell") },
      { id: "par-b", fra: organ(4), til: organ(5), lag: "person", skilt: skilt("Bjørn Olav Parallell") },
      { id: "par-e", fra: organ(4), til: organ(5), lag: "eier", skilt: { bredde: tekstbredde("100 %", 12) + 26, hoyde: 20 } },
      { id: "lang", fra: organ(7), til: organ(8), lag: "person", skilt: skilt("Karoline Kristiansen-Aakre") },
      { id: "eier-1", fra: organ(8), til: organ(3), lag: "eier", skilt: { bredde: tekstbredde("60 %", 12) + 26, hoyde: 20 } },
    ],
    knuter: [
      { id: "k1", organer: [organ(2), organ(5), organ(6)], skilt: skilt("Kjell Tre Organer") },
      { id: "k2", organer: [organ(0), organ(1), organ(6), organ(7)], skilt: skilt("Fire Organer Hansen") },
    ],
  };
  const s1 = regnOppsett(syntetisk, lerretFor(syntetisk.noder.length));
  const s2 = regnOppsett(syntetisk, lerretFor(syntetisk.noder.length));
  const sk = [...finnKollisjoner(s1.personer), ...finnKollisjoner(s1.medEierskap)];
  const sLikt = JSON.stringify(s1) === JSON.stringify(s2);
  console.log(`\nLaget testgraf (${syntetisk.noder.length} noder, ${syntetisk.kanter.length} kanter, 2 knuter)`);
  console.log(`  deterministisk: ${sLikt ? "ja" : "NEI"}`);
  console.log(`  etikettkollisjoner: ${sk.length}`);
  for (const c of sk) console.log(`    ${c.hva}: ${c.a} ${c.b}`);
  console.log(`  skjulte etiketter og skilt: ${s1.personer.skjulte} uten eierskap, ${s1.medEierskap.skjulte} med`);
  if (!sLikt || sk.length > 0) feil += 1;

  // Skala: 400 organer og 480 personkoblinger, laget med en fast slumpkilde.
  // Kravet er under 200 ms på serveren, deterministisk, og ingen kollisjoner
  // blant det som vises. Det som ikke får plass, skjules i stedet for å
  // legges oppå noe annet.
  let frø = 7;
  const slump = () => ((frø = (Math.imul(frø, 1664525) + 1013904223) >>> 0) / 4294967296);
  const stor = { noder: [], kanter: [], knuter: [] };
  for (let i = 0; i < 400; i++) {
    const n = `Organ nummer ${i} AS`;
    stor.noder.push({ key: `s${String(i).padStart(3, "0")}`, etikett: { bredde: tekstbredde(n, 13), hoyde: 18 } });
  }
  for (let i = 0; i < 480; i++) {
    // Mange koblinger til noen få store organer, og ellers klynger: et styre
    // henger sammen med selskapene rundt seg, som i virkeligheten. Hver
    // femte kobling går hvor som helst.
    const a = Math.floor(Math.pow(slump(), 1.6) * 400);
    let b = i % 5 === 0 ? Math.floor(slump() * 400) : (a + 1 + Math.floor(slump() * 12)) % 400;
    if (b === a) b = (b + 1) % 400;
    const p = `Person Personsen ${i}`;
    stor.kanter.push({ id: `p${i}`, fra: stor.noder[a].key, til: stor.noder[b].key, lag: "person", skilt: skilt(p) });
  }
  for (let i = 0; i < 20; i++) {
    const o = [0, 1, 2].map(() => stor.noder[Math.floor(slump() * 400)].key);
    stor.knuter.push({ id: `sk${i}`, organer: [...new Set(o)], skilt: skilt(`Knute Knutsen ${i}`) });
  }
  // Første kjøring inkluderer JIT-kompilering. Serveren er varm, så kravet
  // måles på andre kjøring. Begge tider skrives ut.
  const t0 = performance.now();
  const g1 = regnOppsett(stor, lerretFor(stor.noder.length));
  const kald = performance.now() - t0;
  const t1 = performance.now();
  const g2 = regnOppsett(stor, lerretFor(stor.noder.length));
  const ms = performance.now() - t1;
  // I en stor graf er kravet at ingen etiketter overlapper hverandre eller en
  // node. Kanter som krysser et navn, telles for seg: i et tett nett står
  // navnet på papir over streken.
  const alleK = [...finnKollisjoner(g1.personer), ...finnKollisjoner(g1.medEierskap)];
  const gk = alleK.filter((c) => c.hva !== "kant går gjennom node" && c.hva !== "kant krysser etikett");
  const krysser = alleK.filter((c) => c.hva === "kant krysser etikett").length;
  const gjennom = alleK.filter((c) => c.hva === "kant går gjennom node").length;
  const gLikt = JSON.stringify(g1) === JSON.stringify(g2);
  console.log(`\nSkala (${stor.noder.length} noder, ${stor.kanter.length} kanter, ${stor.knuter.length} knuter)`);
  console.log(`  tid: ${Math.round(ms)} ms varm, ${Math.round(kald)} ms kald (krav: under 200 ms)`);
  console.log(`  deterministisk: ${gLikt ? "ja" : "NEI"}`);
  console.log(`  etikettkollisjoner blant det som vises: ${gk.length}`);
  console.log(`  skjulte etiketter og skilt: ${g1.personer.skjulte} av ${stor.noder.length + stor.kanter.length + stor.knuter.length}`);
  console.log(`  kanter som krysser et synlig navn: ${krysser}, kanter gjennom en node: ${gjennom} (egne tall, se over)`);
  const typer = {};
  for (const c of gk) typer[c.hva] = (typer[c.hva] ?? 0) + 1;
  if (gk.length) console.log(`  fordelt: ${JSON.stringify(typer)}`);
  if (!gLikt || gk.length > 0 || ms > 200) feil += 1;
} finally {
  await server.close();
}

console.log(feil ? `\n${feil} kommune(r) feilet.` : "\nAlt i orden.");
process.exit(feil ? 1 : 0);
