// Terrengfilene på disk, lest på serveren (se src/lib/terreng.ts).
//
// `import.meta.glob` uten `eager` gir én bit per fil i serverbygget, så en side
// leser bare sin egen kommunes terreng. Modulen skal aldri importeres fra kode
// som kjører i nettleseren: da ville alle terrengfilene fulgt med i bunten.

import { koteId, type Terreng, type Terrengfil } from "./terreng";

const filer = import.meta.glob<Terrengfil>(["../data/terreng/*.json", "!**/utsnitt.json"], {
  import: "default",
});

/** Kommunenumrene som har terrengfil. Til den statiske eksporten. */
export const terrengKommuner = Object.keys(filer)
  .map((sti) => sti.replace(/^.*\//, "").replace(/\.json$/, ""))
  .sort();

async function lesFil(kommunenr: string): Promise<Terrengfil | null> {
  if (!/^\d{4}$/.test(kommunenr)) return null;
  const last = filer[`../data/terreng/${kommunenr}.json`];
  return last ? await last() : null;
}

/** Kort avtrykk av stiene (FNV-1a), til adressen. */
function avtrykk(t: Terrengfil): string {
  let h = 0x811c9dc5;
  const tekst = t.hav + t.kyst.d + t.koter.map((k) => k.d).join("");
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** Terrenget for kommunen, eller `null` når kommunen ikke har kartblad ennå. */
export async function hentTerreng(kommunenr: string): Promise<Terreng | null> {
  const t = await lesFil(kommunenr);
  if (!t) return null;
  return {
    kommunenr: t.kommunenr,
    navn: t.navn,
    bbox: t.bbox,
    bredde: t.bredde,
    hoyde: t.hoyde,
    kyst: { lengde: t.kyst.lengde },
    ekvidistanse: t.ekvidistanse,
    koter: t.koter.map((k) => ({ hoyde: k.hoyde, tellekurve: k.tellekurve, lengde: k.lengde })),
    kilde: t.kilde,
    attribusjon: t.attribusjon,
    fil: `/kart/terreng/${t.kommunenr}.svg?v=${avtrykk(t)}`,
  };
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * SVG-fila med stiene, eller `null`. Stiene har ingen farge eller strek selv:
 * det arves fra <use> i siden.
 */
export async function terrengSvg(kommunenr: string): Promise<string | null> {
  const t = await lesFil(kommunenr);
  if (!t) return null;
  const sti = (id: string, d: string) => `<path id="${id}" d="${xml(d)}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.bredde} ${t.hoyde}">`,
    `<title>${xml(`Terreng for ${t.navn}. ${t.attribusjon}`)}</title>`,
    "<defs>",
    sti("hav", t.hav),
    sti("kyst", t.kyst.d),
    ...t.koter.map((k) => sti(koteId(k.hoyde), k.d)),
    "</defs>",
    "</svg>",
    "",
  ].join("\n");
}
