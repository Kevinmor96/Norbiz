// Butikken bak organskuffen og lenken til et organ. Egen fil, så
// organprofilen kan lenke til andre organer uten å importere skuffen den
// selv står i. Importer fra organ-skuff.tsx, som eksporterer alt herfra.

import { Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

import type { OrganProfil, OrganRef } from "@/lib/data";
import { forhandslastOrganprofil, hentOrganprofil } from "@/lib/data/hent";

// ---------------------------------------------------------------------------
// Butikken
// ---------------------------------------------------------------------------

let aapenKey: string | null = null;
let navnHint: string | null = null;
let fraElement: HTMLElement | null = null;
let verter = 0;
const lyttere = new Set<() => void>();

const varsle = () => {
  for (const l of lyttere) l();
};
const abonner = (l: () => void) => {
  lyttere.add(l);
  return () => {
    lyttere.delete(l);
  };
};

/** Ankeret til et organ: kortet i organkartet har denne id-en, og adressen bruker den. */
export const organAnker = (key: string) => `organ-${key}`;
const ANKER = /^#organ-([a-z0-9][a-z0-9-]*)$/;

function settAdresse(key: string | null) {
  const { pathname, search, hash } = window.location;
  // history.state beholdes: ruteren har sin egen nøkkel der.
  if (key) {
    if (hash !== `#${organAnker(key)}`)
      history.replaceState(history.state, "", `${pathname}${search}#${organAnker(key)}`);
  } else if (ANKER.test(hash)) {
    history.replaceState(history.state, "", `${pathname}${search}`);
  }
}

/**
 * Åpner organet i skuffen. `fra` får fokus tilbake når skuffen lukkes. `navn`
 * vises i hodet mens profilen hentes. Gir `false` når skuffen ikke finnes på
 * siden.
 */
export function aapneOrgan(
  key: string,
  valg: { fra?: Element | null; navn?: string | null } = {},
): boolean {
  if (verter === 0 || typeof window === "undefined") return false;
  if (aapenKey === null) {
    const fra = valg.fra ?? document.activeElement;
    fraElement = fra instanceof HTMLElement ? fra : null;
  }
  navnHint = valg.navn ?? null;
  aapenKey = key;
  varsle();
  settAdresse(key);
  return true;
}

export function lukkOrgan() {
  if (aapenKey === null) return;
  aapenKey = null;
  varsle();
  settAdresse(null);
}

/**
 * Kalles av verten når skuffen monteres. Åpner organet adressen peker på, og
 * følger med når adressen endres. Gir tilbake opprydningen.
 */
export function registrerVert(): () => void {
  verter += 1;
  const lesAdresse = () => {
    const m = ANKER.exec(window.location.hash);
    if (m && m[1] !== aapenKey) aapneOrgan(m[1]!, { fra: null });
  };
  lesAdresse();
  window.addEventListener("hashchange", lesAdresse);
  return () => {
    verter -= 1;
    window.removeEventListener("hashchange", lesAdresse);
  };
}

/** Navnet lenken oppga, til skuffens hode mens profilen hentes. */
export const navnMensLaster = () => navnHint;

/** Gir fokus tilbake til det som åpnet skuffen. Én gang. */
export function fokusTilbake() {
  const el = fraElement;
  fraElement = null;
  if (el?.isConnected) el.focus({ preventScroll: true });
}

export function useOrganSkuff() {
  const aapen = useSyncExternalStore(
    abonner,
    () => aapenKey,
    () => null,
  );
  return { aapen, aapne: aapneOrgan, lukk: lukkOrgan };
}

// ---------------------------------------------------------------------------
// Profilene. Datalaget kommer aldri i nettleseren: profilen hentes fra
// serveren, eller som fil i den statiske eksporten (src/lib/data/hent.ts), og
// hentingen starter alt når leseren peker på eller fokuserer organet.
// ---------------------------------------------------------------------------

/** Starter hentingen av organets profil. Kalles når leseren peker på eller fokuserer et organ. */
export function forhandslastOrganer(key?: string) {
  if (key) forhandslastOrganprofil(key);
}

const hentProfil = (key: string): Promise<OrganProfil | null> => hentOrganprofil(key);

export type Tilstand =
  | { key: string; status: "laster" }
  | { key: string; status: "klar"; profil: OrganProfil }
  | { key: string; status: "mangler" }
  | { key: string; status: "feil" };

export function useProfil(key: string | null): [Tilstand | null, () => void] {
  const [tilstand, settTilstand] = useState<Tilstand | null>(null);
  const [forsok, settForsok] = useState(0);
  useEffect(() => {
    if (!key) return;
    let aktiv = true;
    settTilstand((t) => (t?.key === key && t.status === "klar" ? t : { key, status: "laster" }));
    hentProfil(key).then(
      (profil) => {
        if (aktiv)
          settTilstand(profil ? { key, status: "klar", profil } : { key, status: "mangler" });
      },
      () => {
        if (aktiv) settTilstand({ key, status: "feil" });
      },
    );
    return () => {
      aktiv = false;
    };
  }, [key, forsok]);
  return [tilstand, () => settForsok((n) => n + 1)];
}

// ---------------------------------------------------------------------------
// Lenken
// ---------------------------------------------------------------------------

/**
 * Lenke til et organ. Er skuffen på siden, åpner et vanlig klikk den. Et klikk
 * med modifikator, midtklikk og sider uten skuff går til /organ/$key.
 *
 * `org` er nøkkelen eller hele organreferansen. Med referansen blir navnet
 * både hint til skuffens hode og lenketeksten, så seksjonene slipper å
 * gjenta det. `kort` bruker kortnavnet der det finnes, til trange flater.
 */
export function OrganLenke({
  org,
  navn,
  kort = false,
  children,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
}: {
  org: string | OrganRef;
  /** Vises i skuffens hode mens profilen hentes. Leses fra `org` når den er en referanse. */
  navn?: string;
  kort?: boolean;
  /** Egen lenketekst. Ellers organets navn, eller kortnavnet med `kort`. */
  children?: ReactNode;
  className?: string | undefined;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const ref = typeof org === "string" ? null : org;
  const key = ref ? ref.key : (org as string);
  const hint = navn ?? ref?.navn ?? null;
  const tekst = children ?? (ref ? (kort ? (ref.kortnavn ?? ref.navn) : ref.navn) : (hint ?? key));
  const klikk = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (aapneOrgan(key, { fra: e.currentTarget, navn: hint })) e.preventDefault();
  };
  return (
    <Link
      to="/organ/$key"
      params={{ key }}
      id={id}
      className={className}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      onClick={klikk}
      onPointerEnter={() => forhandslastOrganer(key)}
      onFocus={() => forhandslastOrganer(key)}
    >
      {tekst}
    </Link>
  );
}
