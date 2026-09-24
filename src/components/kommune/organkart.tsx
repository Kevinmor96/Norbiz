// Seksjon 3: Organkartet, nivåbånd (DESIGN.md §5.3).
// STUB. Seksjonsbyggeren erstatter innholdet. Legg egne filer i ./organkart/.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   side.organkart.grupper  { nivaa, organer: OrganKort[] }[] i NIVAAER-rekkefølge. Hvert
//                           OrganKort har myndighet, belegg og ledere.
//   side.hull               HullPunkt[] til «Leder ikke kartlagt» per organ.
//   Organskuffen (Sheet/Drawer) henter profilen ved behov: `data.organ_profil(key)` fra
//   "@/lib/data". Den finnes også som egen side: /organ/$key.
//
// Anker: #organer. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";
import { tall } from "@/lib/format";

import { Plassholder } from "./plassholder";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function OrgankartSeksjon({ side }: SeksjonProps) {
  const antall = side.organkart.grupper.reduce((n, g) => n + g.organer.length, 0);
  return (
    <Seksjon
      id="organer"
      region={seksjonsnavn("organer")}
      tittel="Hvem sitter hvor?"
      ingress={`Organene som har makt i ${side.kommune.navn}, fra staten til kommunens selskaper. Folkevalgte organer og administrasjonen står hver for seg. Trykk på et organ for å se roller, eierskap og kilder.`}
    >
      <Plassholder seksjon="Organkartet">
        {tall(antall)} aktive organer på {side.organkart.grupper.length} nivåer.
      </Plassholder>
    </Seksjon>
  );
}
