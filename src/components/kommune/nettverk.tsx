// Seksjon 5: Nettverket (DESIGN.md §5.5). Hvem sitter flere steder?
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Seksjonen bruker:
//   side.nettverk    organene, personene med aktive roller i minst to organer, og rollene
//   side.organkart   `overordnet`, til utvalgsregelen (strukturkoblinger vises ikke)
//   side.eierskap    eierskapslaget («Vis eierskap», av som standard)
//
// Institusjon først: noden er organet, og personen er kanten. Grafen er regnet
// av src/lib/graf/layout.ts og er lik for samme data. På skrivebord vises
// grafen med lista under. På mobil og nettbrett er lista standard, og
// buediagrammet kan velges. Lista er med på alle bredder.
//
// Anker: #nettverket. Regionnavn og anker står i ./seksjoner.ts.

import { useMemo, useState } from "react";

import { MedMerke } from "@/components/maktkart/kildemerke";
import { Seksjon } from "@/components/maktkart/seksjon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { avledBelegg } from "@/lib/belegg";
import { antall, tall } from "@/lib/format";
import { lerretFor, regnOppsett } from "@/lib/graf/layout";
import { byggGrafmodell, grafInn, iSetning, organnavn, type Strukturkobling } from "@/lib/graf/modell";
import { cn } from "@/lib/utils";

import { Buediagram } from "./nettverk/buer";
import { Bryter } from "./nettverk/bryter";
import { Nettverksgraf } from "./nettverk/graf";
import { Personliste } from "./nettverk/liste";
import { IkkeKartlagt } from "./pengene/felles";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

/** Setningen om en kobling som følger av styringsmodellen. Titler og organer fra datasettet. */
function strukturSetning(s: Strukturkobling): string {
  const over = iSetning(organnavn(s.over.org));
  const under = iSetning(organnavn(s.under.org));
  if (s.beggeLedere) return `${s.over.tittel} ${s.person.navn} leder både ${over} og ${under}.`;
  return `${s.person.navn} har roller i både ${over} og ${under}, og ${under} ligger rett under ${over}.`;
}

function Strek({ stiplet = false, vann = false }: { stiplet?: boolean; vann?: boolean }) {
  return (
    <svg width="28" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        x2="27"
        y1="4"
        y2="4"
        className={vann ? "stroke-vann" : "stroke-trykk"}
        strokeWidth={vann ? 1.25 : 1.75}
        strokeDasharray={stiplet ? (vann ? "3 3" : "6 4") : undefined}
      />
    </svg>
  );
}

export function NettverkSeksjon({ side }: SeksjonProps) {
  const modell = useMemo(
    () =>
      byggGrafmodell({
        nettverk: side.nettverk,
        organkart: side.organkart,
        eierskap: side.eierskap,
        sammenstilt: side.kommune.sammenstilt,
      }),
    [side.nettverk, side.organkart, side.eierskap, side.kommune.sammenstilt],
  );
  const oppsett = useMemo(
    () => regnOppsett(grafInn(modell), lerretFor(modell.noder.length)),
    [modell],
  );
  const [visEierskap, settVisEierskap] = useState(false);
  const [visning, settVisning] = useState<"liste" | "buer">("liste");
  const [aktiv, settAktiv] = useState<string | null>(null);

  const m = modell.personkanter.length;
  const n = modell.personkanter.filter((k) => k.maaVerifiseres).length;
  const telling = avledBelegg(
    modell.personkanter.flatMap((k) => k.roller.map((r) => r.belegg)),
    {
      per: side.kommune.sammenstilt,
      merknad:
        "Telt fra koblingene i grafen: ett organpar per person. En kobling bygger på noe som må verifiseres når minst én av de to rollene må det.",
    },
  );
  const harEierlag = modell.eierkanter.length > 0;

  return (
    <Seksjon
      id="nettverket"
      region={seksjonsnavn("nettverket")}
      tittel="Hvem sitter flere steder?"
      ingress="Hvert punkt er et organ. En strek mellom to organer er en person med rolle i begge. Bare aktive roller teller."
    >
      {m === 0 ? (
        <div className="flex max-w-[62ch] flex-col gap-3">
          <p>
            <IkkeKartlagt>Ingen koblinger i datasettet</IkkeKartlagt>
          </p>
          <p className="brodtekst text-[0.9375rem] text-dempet">
            Datasettet har ingen personer med aktive roller i to eller flere organer i{" "}
            {side.kommune.navn}. Rollene hentes fra Enhetsregisteret og fra organenes egne sider.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-dempet">
              <li className="flex items-center gap-2">
                <Strek />
                Person med rolle i begge organer
              </li>
              <li className="flex items-center gap-2">
                <Strek stiplet />
                Bygger på minst én rolle som må verifiseres
              </li>
              {visEierskap && (
                <li className="hidden items-center gap-2 lg:flex">
                  <Strek vann stiplet />
                  Eierandel, pil mot selskapet
                </li>
              )}
            </ul>
            {harEierlag && (
              <Bryter pa={visEierskap} settPa={settVisEierskap} className="hidden lg:flex">
                Vis eierskap
              </Bryter>
            )}
            <ToggleGroup
              type="single"
              value={visning}
              onValueChange={(v) => v && settVisning(v as "liste" | "buer")}
              aria-label="Visning"
              className="gap-0 lg:hidden"
            >
              {(["liste", "buer"] as const).map((v) => (
                <ToggleGroupItem
                  key={v}
                  value={v}
                  className="h-11 min-w-[5.5rem] border border-trykk px-4 text-[0.875rem] font-semibold first:border-r-0 hover:bg-flate-2 hover:text-trykk data-[state=on]:bg-trykk data-[state=on]:text-paa-trykk"
                >
                  {v === "liste" ? "Liste" : "Buer"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="hidden border border-linje-sterk lg:block">
            <Nettverksgraf
              modell={modell}
              oppsett={oppsett}
              visEierskap={visEierskap}
              aktiv={aktiv}
              settAktiv={settAktiv}
            />
          </div>

          <div className={cn(visning === "buer" ? "block lg:hidden" : "hidden")}>
            <Buediagram modell={modell} aktiv={aktiv} settAktiv={settAktiv} />
          </div>

          <div className={cn(visning === "liste" ? "block" : "hidden lg:block")}>
            <h3 className="sr-only">Personene i nettverket, alfabetisk</h3>
            <p className="mb-3 hidden text-[0.875rem] text-dempet lg:block">
              Grafen som liste, alfabetisk. Pek på en person for å se koblingene i grafen.
            </p>
            <Personliste personer={modell.personer} aktiv={aktiv} settAktiv={settAktiv} />
          </div>

          <div className="flex max-w-[68ch] flex-col gap-2 text-[0.9375rem] leading-[1.55]">
            <p className="font-semibold">
              <MedMerke
                belegg={telling}
                pastand={`${n} av ${m} koblinger i nettverket bygger på minst én rolle som må verifiseres`}
              >
                {tall(n)} av {antall(m, "kobling", "koblinger")}
              </MedMerke>{" "}
              bygger på minst én rolle som må verifiseres.
            </p>
            <p className="text-dempet">
              {modell.struktur.map((s) => (
                <span key={`${s.person.key}-${s.over.org.key}-${s.under.org.key}`}>
                  {strukturSetning(s)}{" "}
                </span>
              ))}
              {modell.struktur.length > 0
                ? `${modell.struktur.length > 1 ? "Slike koblinger følger" : "Det følger"} av styringsmodellen og vises ikke som kobling. `
                : "Koblinger mellom et organ og organet rett under det følger av styringsmodellen og vises ikke. "}
              Tidligere roller teller ikke. Domstoler, politi, påtalemyndighet og Forsvaret er aldri
              med.
            </p>
          </div>
        </div>
      )}
    </Seksjon>
  );
}
