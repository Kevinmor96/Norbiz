import { useCallback, useEffect, useRef, useState } from "react";

interface Valg {
  /** Slutt å observere etter første treff. Standard: true, bevegelser skjer én gang. */
  once?: boolean;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * `[ref, iBildet]`. Brukes til å starte en bevegelse når noe kommer i bildet.
 *
 * Regelen fra spec §4.6 gjelder: innholdet skal være synlig uten denne. Bruk
 * `iBildet` til å spille av en overgang fra en synlig tilstand, aldri til å
 * vise noe som ellers er skjult. Uten IntersectionObserver regnes alt som i
 * bildet.
 */
export function useInView<T extends Element = HTMLElement>({
  once = true,
  rootMargin = "0px",
  threshold = 0,
}: Valg = {}): [(el: T | null) => void, boolean] {
  const [iBildet, settIBildet] = useState(false);
  const [el, settEl] = useState<T | null>(null);
  const ferdig = useRef(false);
  const ref = useCallback((node: T | null) => settEl(node), []);
  const terskel = Array.isArray(threshold) ? threshold.join(",") : String(threshold);

  useEffect(() => {
    if (!el || ferdig.current) return;
    if (typeof IntersectionObserver === "undefined") {
      settIBildet(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([oppf]) => {
        if (!oppf) return;
        if (oppf.isIntersecting) {
          settIBildet(true);
          if (once) {
            ferdig.current = true;
            obs.disconnect();
          }
        } else if (!once) {
          settIBildet(false);
        }
      },
      { rootMargin, threshold: terskel.split(",").map(Number) },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [el, once, rootMargin, terskel]);

  return [ref, iBildet];
}
