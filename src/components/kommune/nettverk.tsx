// Seksjon 5: Nettverket, institusjonsgraf og buediagram (DESIGN.md §5.5).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./nettverk/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.nettverk.noder     OrganRef[]. Noden er organet.
//   side.nettverk.kanter    { fra, til, person }[]. Personen er kanten, med navneskilt.
//   side.nettverk.personer  { person, roller: RolleIOrgan[] }[], lista som alternativ til grafen,
//                           og belegget per rolle (stiplet kant når en rolle må verifiseres).
//   side.eierskap           eierskapslaget («Vis eierskap», av som standard).
//   Layout: deterministisk, fra lib/graf/layout.ts (d3-force er installert).
//
// Anker: #nettverket. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function NettverkSeksjon({ side }: SeksjonProps) {
  const n = side.nettverk;
  return (
    <Seksjon
      id="nettverket"
      region={seksjonsnavn("nettverket")}
      tittel="Hvem sitter flere steder?"
      ingress="Hvert punkt er et organ. En strek mellom to organer er en person med rolle i begge. Bare aktive roller teller."
    >
      <Plassholder seksjon="Nettverket">
        {tall(n.personer.length)} personer med roller i minst to organer, {tall(n.noder.length)}{" "}
        organer og {tall(n.kanter.length)} koblinger.
      </Plassholder>
    </Seksjon>
  );
}
