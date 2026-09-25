// Den administrative grenselinjen mellom nivåbåndene: strek-prikk, som på
// topografiske kart (DESIGN.md §5.3). Tykkelsen og monsteret går ned med
// nivået, som riks-, fylkes- og kommunegrense. Feltet under det siste båndet
// er ikke et nivå og får en prikket linje i stedet.

import { cn } from "@/lib/utils";

export type Grense = "riks" | "fylke" | "kommune" | "utenfor";

const MONSTER: Record<Grense, { strek: number; monster: string; farge: string }> = {
  riks: { strek: 2, monster: "16 5 2.5 5", farge: "text-trykk" },
  fylke: { strek: 1.5, monster: "12 4 2 4", farge: "text-trykk" },
  kommune: { strek: 1.25, monster: "8 3.5 1.5 3.5", farge: "text-trykk" },
  utenfor: { strek: 1.25, monster: "1.5 4", farge: "text-linje-sterk" },
};

export function Grenselinje({ type, className }: { type: Grense; className?: string }) {
  const m = MONSTER[type];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("block h-2 w-full", m.farge, className)}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="4"
        x2="100%"
        y2="4"
        stroke="currentColor"
        strokeWidth={m.strek}
        strokeDasharray={m.monster}
        strokeLinecap="butt"
      />
    </svg>
  );
}
