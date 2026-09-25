// Henting av data fra nettleseren, uten at datalaget kommer i nettleserbunten.
//
// Nettleseren leser aldri datasettene. Den får det loaderen serialiserer inn i
// HTML-en, og henter resten her:
//
// - kommunesiden: hele `Kommuneside` etter at siden er vist, og ved navigering
//   til en ny kommune (src/routes/kommune.$slug.tsx),
// - organprofilen: organskuffen og /organ/$key ved navigering.
//
// Med server er det en TanStack Start-serverfunksjon. Handleren laster
// datalaget på serveren, og nettleseren får bare svaret. Den statiske eksporten
// har ingen server. Der feiler kallet, og svaret hentes i stedet som en fil
// bygget ved eksporten: /data/kommune/<slug>.json og /data/organ/<key>.json
// (rutene src/routes/data.*.ts, forhåndsrendret av vite.statisk.config.ts).
// Når ett kall har feilet på den måten, går resten rett til filene.
//
// Svarene huskes per nøkkel, så to seksjoner som ber om det samme, deler ett
// kall, og en feil kan prøves igjen.

import { isNotFound, isRedirect, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import type { Kommuneside } from "@/lib/kommuneside";

import type { OrganProfil } from "./kontrakt";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const kommunesideFn = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => ({ slug: String(d?.slug ?? "").slice(0, 80) }))
  .handler(async ({ data }): Promise<Kommuneside | null> => {
    if (!SLUG.test(data.slug)) return null;
    return (await import("@/lib/kommuneside")).lastKommuneside(data.slug);
  });

export const organprofilFn = createServerFn({ method: "GET" })
  .validator((d: { key: string }) => ({ key: String(d?.key ?? "").slice(0, 160) }))
  .handler(async ({ data }): Promise<OrganProfil | null> => {
    if (!SLUG.test(data.key)) return null;
    const [{ data: datalag }, { tilSiden }] = await Promise.all([
      import("@/lib/data"),
      import("@/lib/nyttelast"),
    ]);
    const p = await datalag.organ_profil(data.key);
    return p ? tilSiden(p) : null;
  });

/**
 * Sant i den statiske eksporten (satt av vite.statisk.config.ts), og når en
 * serverfunksjon har feilet i nettleseren på en måte som bare filen kunne
 * redde. Da går hentingen rett til filene.
 */
let utenServer = import.meta.env["VITE_STATISK"] === "1";

async function statisk<T>(sti: string): Promise<T | null> {
  const svar = await fetch(sti, { headers: { accept: "application/json" } });
  if (svar.status === 404) return null;
  if (!svar.ok) throw new Error(`${sti} svarte ${svar.status}`);
  return (await svar.json()) as T;
}

async function fraServerEllerFil<T>(kall: () => Promise<T>, fil: string): Promise<T | null> {
  if (!utenServer) {
    try {
      return await kall();
    } catch (feil) {
      // Uten server er det ingenting å prøve igjen mot. Er det en server, er
      // feilen ekte, og filen finnes heller ikke der.
      utenServer = true;
      try {
        return await statisk<T>(fil);
      } catch {
        utenServer = false;
        throw feil;
      }
    }
  }
  return statisk<T>(fil);
}

function husk<T>(minne: Map<string, Promise<T>>, nokkel: string, hent: () => Promise<T>) {
  let p = minne.get(nokkel);
  if (!p) {
    p = hent();
    minne.set(nokkel, p);
    p.catch(() => minne.delete(nokkel));
  }
  return p;
}

const kommunesider = new Map<string, Promise<Kommuneside | null>>();
const organprofiler = new Map<string, Promise<OrganProfil | null>>();

/** Hele kommunesiden, fra nettleseren. `null` når sluggen ikke er en kommune med datasett. */
export function hentKommuneside(slug: string): Promise<Kommuneside | null> {
  return husk(kommunesider, slug, () =>
    fraServerEllerFil(
      () => kommunesideFn({ data: { slug } }),
      `/data/kommune/${encodeURIComponent(slug)}.json`,
    ),
  );
}

/** Organprofilen, fra nettleseren. `null` når organet ikke finnes. */
export function hentOrganprofil(key: string): Promise<OrganProfil | null> {
  return husk(organprofiler, key, () =>
    fraServerEllerFil(
      () => organprofilFn({ data: { key } }),
      `/data/organ/${encodeURIComponent(key)}.json`,
    ),
  );
}

/** Starter hentingen av organprofilen, så skuffen har den når leseren trykker. */
export function forhandslastOrganprofil(key: string): void {
  void hentOrganprofil(key).catch(() => undefined);
}

const LASTET_NYTT = "maktkart:lastet-nytt";

/**
 * Loaderdata for en side uten egen JSON-fil (/metode, /pro): fra
 * serverfunksjonen, og uten server en vanlig sidelasting av adressen, fordi
 * siden er forhåndsrendret med dataene i HTML-en. Samme adresse lastes ikke to
 * ganger på rad: mangler siden også som fil, gir kallet feilen videre.
 */
export async function fraServeren<T>(kall: () => Promise<T>, sti: string): Promise<T> {
  try {
    return await kall();
  } catch (feil) {
    if (isRedirect(feil) || isNotFound(feil) || typeof window === "undefined") throw feil;
    let forrige = "";
    try {
      forrige = sessionStorage.getItem(LASTET_NYTT) ?? "";
      sessionStorage.setItem(LASTET_NYTT, `${sti}|${Date.now()}`);
    } catch {
      throw feil;
    }
    const [s, tid] = forrige.split("|");
    if (s === sti && Date.now() - Number(tid) < 15_000) throw feil;
    throw redirect({ href: sti, reloadDocument: true });
  }
}
