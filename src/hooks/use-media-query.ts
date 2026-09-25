import { useSyncExternalStore } from "react";

// Én MediaQueryList per spørring, delt av alle som lytter. Siden har hundrevis
// av kildemerker, og hvert av dem skal ikke ha sin egen lytter.
const lister = new Map<string, MediaQueryList>();

function liste(sporring: string): MediaQueryList {
  let mql = lister.get(sporring);
  if (!mql) {
    mql = window.matchMedia(sporring);
    lister.set(sporring, mql);
  }
  return mql;
}

/**
 * `true` når mediespørringen treffer. På serveren og ved hydrering gir den
 * `serververdi`, så første maling er lik på begge sider. Oppdateres straks
 * etter hydrering.
 */
export function useMediaQuery(sporring: string, serververdi = false): boolean {
  return useSyncExternalStore(
    (varsle) => {
      const mql = liste(sporring);
      mql.addEventListener("change", varsle);
      return () => mql.removeEventListener("change", varsle);
    },
    () => liste(sporring).matches,
    () => serververdi,
  );
}

/** Mus eller styreplate: kildelappen er en Popover. Ellers en Drawer nedenfra. */
export const FIN_PEKER = "(hover: hover) and (pointer: fine)";
/** Brytepunktet der margen kommer inn. Samme som `marg:` i styles.css. */
export const MARG = "(min-width: 75rem)";
