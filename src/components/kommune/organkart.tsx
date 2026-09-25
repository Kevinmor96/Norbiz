// Seksjon 3: Organkartet, nivåbånd (DESIGN.md §5.3). Hvem sitter hvor?
//
// Fire bånd, STAT, FYLKE, KOMMUNE og SELSKAPER, skilt av administrative
// grenselinjer med strek-prikk. Kommune- og fylkesbåndet har to kolonner:
// folkevalgte organer og administrasjon. Hvert organ er et kort som åpner
// organskuffen. Skuffen tegnes her, én gang for hele siden, og de andre
// seksjonene åpner den med `aapneOrgan` eller `<OrganLenke>`.
//
// Inndelingen og regelen for hva et sammenfoldet bånd viser, står i
// ./organkart/baand.ts.
//
// Anker: #organer. Hvert kort har ankeret #organ-<key>.

import { Fragment, useMemo, type ReactNode } from "react";

import { Seksjon } from "@/components/maktkart/seksjon";
import { IkkeKartlagt, KildeneUenige, Sensitivmerke } from "@/components/organ/merker";
import { OrganSkuffVert } from "@/components/organ/organ-skuff";
import { erKonflikt } from "@/components/organ/tekst";
import { tall } from "@/lib/format";

import { lagBaand, type Baand } from "./organkart/baand";
import { Grenselinje, type Grense } from "./organkart/grenselinje";
import { Nivaabaand } from "./organkart/nivaabaand";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

/** Grensen under et bånd. Feltet «Utenfor nivåene» er ikke et nivå og får en prikket linje. */
function grenseUnder(baand: Baand, neste: Baand): Grense {
  if (neste.id === "utenfor") return "utenfor";
  return baand.id === "stat" ? "riks" : baand.id === "fylke" ? "fylke" : "kommune";
}

/** Tegnene på kortene, bare de som faktisk brukes i kartet. */
function Kortforklaring({ side }: SeksjonProps) {
  const organer = side.organkart.grupper.flatMap((g) => g.organer);
  const harInnstilling = organer.some((o) => o.myndighet.includes("innstilling"));
  const harKonflikt = side.hull.some(erKonflikt);
  const harSensitiv = organer.some((o) => o.sensitiv);
  const Punkt = ({ tegn, tekst }: { tegn: ReactNode; tekst: string }) => (
    <li className="flex items-center gap-2">
      {tegn}
      <span>{tekst}</span>
    </li>
  );
  return (
    <ul
      aria-label="Tegnene på organkortene"
      className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] leading-[1.3] text-dempet"
    >
      {harInnstilling && (
        <Punkt
          tegn={
            <span className="border border-signal px-[7px] py-[4px] text-[0.75rem] leading-[1.15] font-semibold text-signal-tekst [font-stretch:92%]">
              Innstilling
            </span>
          }
          tekst="forberedende makt"
        />
      )}
      <Punkt tegn={<IkkeKartlagt>Leder ikke kartlagt</IkkeKartlagt>} tekst="datasettet navngir ingen" />
      {harKonflikt && <Punkt tegn={<KildeneUenige />} tekst="to kilder sier forskjellige ting" />}
      {harSensitiv && <Punkt tegn={<Sensitivmerke />} tekst="domstol, politi og påtale" />}
      <Punkt tegn={<Grenselinje type="fylke" className="w-10" />} tekst="grense mellom nivåene" />
    </ul>
  );
}

export function OrgankartSeksjon({ side }: SeksjonProps) {
  const baand = useMemo(() => lagBaand(side), [side]);
  const antall = baand.reduce((n, b) => n + b.antall + (b.paraply ? 1 : 0), 0);

  return (
    <Seksjon
      id="organer"
      region={seksjonsnavn("organer")}
      tittel="Hvem sitter hvor?"
      ingress={`${tall(antall)} organer har makt i ${side.kommune.navn}, fra staten til kommunens selskaper. Folkevalgte organer og administrasjonen står hver for seg. Trykk på et organ for å se roller, eierskap og kilder.`}
      verktoy={antall > 0 ? <Kortforklaring side={side} /> : undefined}
    >
      {antall > 0 ? (
        <div className="border border-trykk bg-flate-2">
          {baand.map((b, i) => (
            <Fragment key={b.id}>
              <Nivaabaand baand={b} />
              {i < baand.length - 1 && (
                <div className="px-4 md:px-6">
                  <Grenselinje type={grenseUnder(b, baand[i + 1]!)} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-kote bg-flate px-5 py-6">
          <p className="font-semibold">Organkartet er tomt.</p>
          <p className="mt-1 text-[0.9375rem] text-dempet">
            Datasettet for {side.kommune.navn} har ingen aktive organer ennå. Når organene er
            kartlagt, står de her, fra staten til kommunens selskaper.
          </p>
        </div>
      )}
      <OrganSkuffVert />
    </Seksjon>
  );
}
