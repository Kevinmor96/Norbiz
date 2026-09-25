// /sitemap.xml: forsiden, metoden, Pro, hvert fylke i regionregisteret, hver
// kommune med datasett og hvert organ som har en side. Listen regnes fra lese-API-et, så en ny kommune
// kommer med når datasettet finnes, uten at denne fila endres.
//
// Organene er de kommunesidene lenker til, og de organprofilene lenker videre
// til (et nedlagt fylke står bare som relasjon på etterfølgeren sin). Det er
// én profil per organ, og bare på serveren.
//
// Adressene er absolutte når VITE_NETTSTED_URL er satt (se src/lib/nettsted.ts)
// og relative ellers. Protokollen krever absolutte adresser, men domenet er
// ikke bestemt, og vi later ikke som vi har et.
//
// <lastmod> er datoen datasettet ble sammenstilt. Det er den eneste datoen vi
// vet, og den sier ikke at noe er ferskt.

import { createFileRoute } from "@tanstack/react-router";

import type { Datalag, OrganRef } from "@/lib/data";
import { nettstedUrl } from "@/lib/nettsted";

interface Adresse {
  sti: string;
  lastmod: string | null;
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Den seneste av to datoer (YYYY-MM-DD sorteres som tekst). */
const senest = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

/**
 * Organene en kommuneside lenker til: organkartet, eierskapet, endringene og
 * hullene. Et nedlagt organ står ikke i organkartet, men kan stå i en endring.
 */
async function organerI(data: Datalag, kommunenr: string): Promise<OrganRef[]> {
  const [organkart, eierskap, endringer, hull] = await Promise.all([
    data.organkart(kommunenr),
    data.eierskap(kommunenr),
    data.endringer(kommunenr),
    data.hull(kommunenr),
  ]);
  const organer: (OrganRef | null)[] = [
    ...(organkart?.grupper.flatMap((g) => g.organer) ?? []),
    eierskap?.eier ?? null,
    ...(eierskap?.selskaper.map((s) => s.org) ?? []),
    ...[...(endringer?.skjedd ?? []), ...(endringer?.ikke_skjedd ?? [])].map((e) => e.org),
    ...(hull ?? []).map((h) => h.gjelder),
  ];
  return organer.filter((o): o is OrganRef => o !== null);
}

async function adresser(): Promise<Adresse[]> {
  const { data } = await import("@/lib/data");
  const kommuner = [...(await data.kommuner())].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const sist = kommuner.reduce<string | null>((d, k) => senest(d, k.sammenstilt), null);

  const organer = new Map<string, string | null>();
  const ko: string[] = [];
  const legg = (o: OrganRef, dato: string | null) => {
    if (!organer.has(o.key)) ko.push(o.key);
    organer.set(o.key, senest(organer.get(o.key) ?? null, dato));
  };
  for (const k of kommuner) {
    for (const o of await organerI(data, k.kommunenr)) legg(o, k.sammenstilt);
  }
  // Videre gjennom profilene til ingen nye organer dukker opp.
  for (let key = ko.shift(); key !== undefined; key = ko.shift()) {
    const p = await data.organ_profil(key);
    if (!p) continue;
    const dato = organer.get(key) ?? null;
    const naboer = [
      p.overordnet,
      ...p.underordnede,
      ...p.eiere.map((e) => e.org),
      ...p.eierandeler.map((e) => e.org),
      ...p.relasjoner.map((r) => r.org),
    ];
    for (const o of naboer) if (o) legg(o, dato);
  }

  const region = await data.region_oversikt();
  return [
    { sti: "/", lastmod: sist },
    { sti: "/metode", lastmod: sist },
    { sti: "/pro", lastmod: null },
    ...region.fylker.map((f) => ({ sti: `/fylke/${f.slug}`, lastmod: sist })),
    ...kommuner.map((k) => ({ sti: `/kommune/${k.slug}`, lastmod: k.sammenstilt })),
    ...[...organer.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, lastmod]) => ({ sti: `/organ/${key}`, lastmod })),
  ];
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const rader = (await adresser()).map(
          ({ sti, lastmod }) =>
            `  <url><loc>${xml(nettstedUrl(sti))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
        );
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...rader,
          "</urlset>",
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
