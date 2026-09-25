// Hvor langt leseren har kommet i løypa, og hvor langt den er tegnet.
//
// `aktiv` er steget som står midt i vinduet. Det følger rullingen begge veier,
// fordi det er en tilstand (hvor er jeg), ikke en bevegelse.
//
// `tegnet` er den siste etappen som er tegnet i signalfarge. Den vokser bare:
// en etappe tegnes én gang, når leseren når steget den fører til, og blir
// liggende. Ruller leseren forbi flere steg på en gang, tegnes etappene etter
// hverandre, 400 ms hver (DESIGN.md §7).
//
// Hvilestillingen er hele løypa tegnet. Serveren sender den (useReducedMotion
// er sann der), og den står igjen når leseren har bedt om redusert bevegelse.
// Løypa trekkes bare tilbake før tegningen når kjeden ligger under det leseren
// ser, så ingen ser en ferdig løype forsvinne.

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** Varigheten per etappe. Samme tall som i DESIGN.md §7. */
export const ETAPPE_MS = 400;

export interface Loypetilstand {
  aktiv: number;
  tegnet: number;
  /** Forsinkelsen i ms per etappe som tegnes nå, så etappene kommer i rekkefølge. */
  forsinkelse: Record<number, number>;
  /** Settes på lista med stegene. Hvert steg har `data-steg="<indeks>"`. */
  listeRef: (el: HTMLElement | null) => void;
}

export function useLoype(antallPoster: number, nokkel: string): Loypetilstand {
  const redusert = useReducedMotion();
  const [aktiv, settAktiv] = useState(0);
  const [tegnet, settTegnet] = useState(antallPoster - 1);
  const [forsinkelse, settForsinkelse] = useState<Record<number, number>>({});
  const [liste, settListe] = useState<HTMLElement | null>(null);
  const forrigeNokkel = useRef<string | null>(null);

  // Nytt valg av prosess, eller første gang siden er klar: bestem om løypa
  // skal tegnes mens leseren ruller, eller stå ferdig.
  useEffect(() => {
    const bytte = forrigeNokkel.current !== null && forrigeNokkel.current !== nokkel;
    forrigeNokkel.current = nokkel;
    settAktiv(0);
    settForsinkelse({});
    if (redusert || !liste) {
      settTegnet(antallPoster - 1);
      return;
    }
    // Ved bytte står leseren ved velgeren, rett over løypa, og ser den tegnes
    // på nytt for den nye saken. Ved første lasting tegnes den bare når den
    // ligger under det leseren ser.
    const underVinduet = liste.getBoundingClientRect().top > window.innerHeight * 0.6;
    settTegnet(bytte || underVinduet ? 0 : antallPoster - 1);
  }, [nokkel, redusert, liste, antallPoster]);

  // Steget midt i vinduet er aktivt.
  useEffect(() => {
    if (!liste || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (oppf) => {
        for (const o of oppf) {
          if (!o.isIntersecting) continue;
          const i = Number((o.target as HTMLElement).dataset["steg"]);
          if (Number.isFinite(i)) settAktiv(i);
        }
      },
      { rootMargin: "-42% 0px -50% 0px" },
    );
    for (const el of liste.querySelectorAll<HTMLElement>("[data-steg]")) obs.observe(el);
    return () => obs.disconnect();
  }, [liste, nokkel]);

  // Løypa tegnes fram til det aktive steget, og aldri tilbake.
  useEffect(() => {
    if (aktiv <= tegnet) return;
    const ny: Record<number, number> = {};
    for (let i = tegnet + 1; i <= aktiv; i++) ny[i] = (i - tegnet - 1) * ETAPPE_MS;
    settForsinkelse(ny);
    settTegnet(aktiv);
  }, [aktiv, tegnet]);

  return { aktiv, tegnet, forsinkelse, listeRef: settListe };
}
