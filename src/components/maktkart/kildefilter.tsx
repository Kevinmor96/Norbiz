// Tegnforklaringen er et filter (DESIGN.md §3): et trykk på en grad demper
// alle andre kildemerker på siden. Tilstanden bor her.
//
// Dempingen gjøres i CSS fra et attributt på <html> (`data-kildefilter`), ikke
// ved at hvert merke leser konteksten. Da slipper hundrevis av merker å tegnes
// på nytt, og merker i skuffer og lapper (som ligger i portaler utenfor
// siden) dempes likt.
//
// Provideren står i rotruten, rundt alle sider. Den er også verten for den ene
// kildelappen siden har (se kildelapp.tsx), så <Kildemerke> virker overalt der
// provideren står.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Verifisering } from "@/lib/data";

import { KildelappVert } from "./kildelapp";

interface Kildefilter {
  /** Graden som vises, eller `null` når alle merker vises. */
  filter: Verifisering | null;
  settFilter: (grad: Verifisering | null) => void;
}

const Kontekst = createContext<Kildefilter | null>(null);

export function KildefilterProvider({ children }: { children: ReactNode }) {
  const [filter, settFilter] = useState<Verifisering | null>(null);

  useEffect(() => {
    const rot = document.documentElement;
    if (filter) rot.setAttribute("data-kildefilter", filter);
    else rot.removeAttribute("data-kildefilter");
    return () => rot.removeAttribute("data-kildefilter");
  }, [filter]);

  const verdi = useMemo(() => ({ filter, settFilter }), [filter]);
  return (
    <Kontekst.Provider value={verdi}>
      <KildelappVert>{children}</KildelappVert>
    </Kontekst.Provider>
  );
}

export function useKildefilter(): Kildefilter {
  const k = useContext(Kontekst);
  if (!k) throw new Error("useKildefilter må brukes innenfor <KildefilterProvider>");
  return k;
}
