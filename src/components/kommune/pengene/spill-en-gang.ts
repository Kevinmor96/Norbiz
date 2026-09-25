// Én bevegelse, én gang, og bare når leseren ser den (DESIGN.md §7).
//
// Figuren tegnes ferdig på serveren og er ferdig i ro. Bevegelsen spilles bare
// hvis figuren var utenfor skjermen da siden ble lastet: da settes den i
// starttilstanden mens ingen ser den, og spilles når den kommer i bildet. En
// figur som alt er i bildet (lenke rett til #pengene, et skjermbilde), står
// stille. Ingenting skjules i påvente av en observer.
//
//   ro     ferdig tegnet, ingen overgang (serveren, redusert bevegelse)
//   klar   starttilstanden, mens figuren er utenfor skjermen
//   spill  overgangen fra start til ferdig, én gang

import { useCallback, useEffect, useRef, useState } from "react";

export type Fase = "ro" | "klar" | "spill";

export function useSpillEnGang<T extends Element>(): [(el: T | null) => void, Fase] {
  const [fase, settFase] = useState<Fase>("ro");
  const [el, settEl] = useState<T | null>(null);
  const ferdig = useRef(false);
  const ref = useCallback((node: T | null) => settEl(node), []);

  useEffect(() => {
    if (!el || ferdig.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let forste = true;
    const obs = new IntersectionObserver(
      ([o]) => {
        if (!o) return;
        if (forste) {
          forste = false;
          if (o.isIntersecting) {
            // Alt i bildet: figuren står som den er.
            ferdig.current = true;
            obs.disconnect();
          } else {
            settFase("klar");
          }
          return;
        }
        if (o.isIntersecting && o.intersectionRatio >= 0.25) {
          ferdig.current = true;
          settFase("spill");
          obs.disconnect();
        }
      },
      { threshold: [0, 0.25] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);

  return [ref, fase];
}
