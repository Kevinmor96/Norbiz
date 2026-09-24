// Plassholderen i seksjonene som ennå ikke er bygget. Den er tydelig merket,
// så ingen tror den er innhold, og den viser hvilke data seksjonen får.
// Fjernes av seksjonsbyggeren sammen med stubben.

import type { ReactNode } from "react";

export function Plassholder({ seksjon, children }: { seksjon: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-kote bg-flate/60 px-5 py-4 text-[0.875rem] leading-[1.5]">
      <p className="region mb-2 text-[0.6875rem] text-kote-tekst">Plassholder</p>
      <p className="font-semibold">{seksjon} bygges her.</p>
      {children && <div className="mt-2 text-dempet">{children}</div>}
    </div>
  );
}
