// Seksjon 2: Beslutningskjeden, orienteringsløypa (DESIGN.md §5.2, spec §3.2).
//
// Dette er differensieringen: den forberedende makten ingen andre viser.
// Leseren følger saken fra den skrives til den vedtas og kan påklages. Hvert
// steg viser organet, myndigheten, hva organet gjør i saken og hvem som leder
// det, med kildemerke.
//
// Skrivebord: løypekartet står klebrig til venstre over et dempet terreng, og
// stegene går til høyre. Etappene tegnes i signalfarge når leseren når steget.
// Mobil: et loddrett spor med symbolene og en klebrig framdrift øverst.
//
// Alt står ferdig tegnet fra serveren. Bevegelsen spilles bare av når kjeden
// ligger under det leseren ser, og aldri med redusert bevegelse.
//
// Props: `side` (hele kommunesiden fra loaderen). Seksjonen bruker
//   side.kjeder              Beslutningskjede[], én per prosess.
//   side.oversikt.prosesser  til prosessvelgeren (via kjedene, samme rekkefølge).
//   side.hull                «Leder ikke kartlagt. Hentes fra …» per organ.
//   side.organkart           medlemstall og belegg for organene i kjeden.
//   side.terreng             bakgrunnen i løypekartet, eller rutenett uten terrengfil.
//
// Anker: #kjeden. Regionnavn og anker står i ./seksjoner.ts.

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { useEffect, useMemo, useRef, useState } from "react";

import { Kildemerke } from "@/components/maktkart/kildemerke";
import { Seksjon } from "@/components/maktkart/seksjon";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { avledBelegg } from "@/lib/belegg";
import { tall } from "@/lib/format";
import type { Terreng } from "@/lib/terreng";
import { cn } from "@/lib/utils";

import { Framdrift } from "./kjede/framdrift";
import { Loypekart } from "./kjede/loypekart";
import { byggLoype, ingress, oppsummering, rangerLoyper, type Loype } from "./kjede/modell";
import { Stegliste } from "./kjede/steg";
import { useLoype } from "./kjede/use-loype";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function KjedeSeksjon({ side }: SeksjonProps) {
  const loyper = useMemo(
    () => rangerLoyper(side.kjeder.map((k) => byggLoype(k, side.hull, side.organkart))),
    [side.kjeder, side.hull, side.organkart],
  );
  const [valgt, settValgt] = useState(loyper[0]?.key ?? "");
  const loype = loyper.find((l) => l.key === valgt) ?? loyper[0];

  if (!loype) {
    // Tom kommune: malen sier hva som mangler i stedet for å se ødelagt ut.
    return (
      <Seksjon
        id="kjeden"
        region={seksjonsnavn("kjeden")}
        tittel={`Hvem bestemmer en sak i ${side.kommune.navn}?`}
        ingress="Beslutningskjeden viser hvem som skriver saken, hvem som vedtar den og hvem som behandler klager."
      >
        <p className="max-w-[52ch] border border-dashed border-kote px-5 py-4 text-[0.9375rem] leading-[1.5]">
          <span className="font-semibold text-kote-tekst">Ikke kartlagt.</span> Datasettet for{" "}
          {side.kommune.navn} har ingen beslutningskjeder ennå. Organkartet under viser hvem som har
          myndighet.
        </p>
      </Seksjon>
    );
  }

  return (
    <Seksjon
      id="kjeden"
      region={seksjonsnavn("kjeden")}
      tittel={loype.sporsmal}
      ingress={ingress(loype)}
      verktoy={
        loyper.length > 1 ? (
          <Prosessvelger loyper={loyper} valgt={loype.key} velg={settValgt} />
        ) : undefined
      }
    >
      <Kjede loype={loype} terreng={side.terreng} sammenstilt={side.kommune.sammenstilt} />
    </Seksjon>
  );
}

function Prosessvelger({
  loyper,
  valgt,
  velg,
}: {
  loyper: Loype[];
  valgt: string;
  velg: (key: string) => void;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={valgt}
      // Et trykk på valgt prosess skal ikke tømme valget.
      onValueChange={(v) => v && velg(v)}
      aria-label="Velg sak"
      className="inline-flex max-w-full flex-wrap border border-trykk"
    >
      {loyper.map((l) => (
        <ToggleGroupPrimitive.Item
          key={l.key}
          value={l.key}
          className={cn(
            "h-11 cursor-pointer px-4.5 text-[0.9375rem] font-semibold [&+&]:border-l [&+&]:border-trykk",
            "transition-[background-color,color,transform] duration-150 ease-(--ease-ut) active:scale-[0.97]",
            "hover:bg-flate-2 data-[state=on]:bg-trykk data-[state=on]:text-paa-trykk",
          )}
        >
          {l.tittel}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

function Oppsummering({ loype, sammenstilt }: { loype: Loype; sammenstilt: string }) {
  const o = oppsummering(loype);
  if (!o) return null;
  const belegg = avledBelegg(o.deler, {
    per: sammenstilt,
    merknad: "Telt fra stegene i kjeden og lederne datasettet navngir for organene.",
  });
  // Lappen viser første setning. Resten er vår lesning, ikke en påstand fra kilden.
  const hel = o.uten > 0 ? `${tall(o.uten)} av ${tall(o.av)} steg ${o.tekst}` : o.tekst;
  const pastand = hel.split(/(?<=\.)\s/)[0] ?? hel;
  return (
    <p className="mb-8 max-w-[56ch] text-[clamp(1.0625rem,0.98rem+0.35vw,1.25rem)] leading-[1.45] text-pretty lg:mb-10">
      {o.uten > 0 && (
        <b className="font-bold">
          {tall(o.uten)} av {tall(o.av)} steg
        </b>
      )}{" "}
      {o.tekst}
      <Kildemerke belegg={belegg} pastand={pastand} />
    </p>
  );
}

function Kjede({
  loype,
  terreng,
  sammenstilt,
}: {
  loype: Loype;
  terreng: Terreng | null;
  sammenstilt: string;
}) {
  const { aktiv, tegnet, forsinkelse, listeRef } = useLoype(loype.poster.length, loype.key);
  const redusert = useReducedMotion();
  const innhold = useRef<HTMLDivElement>(null);
  const forrige = useRef(loype.key);

  // Bytte av sak: det nye innholdet toner inn med et lett slør, så leseren ser
  // at kjeden er byttet ut og ikke bare flyttet. Bare ved bytte, aldri ved lasting.
  useEffect(() => {
    if (forrige.current === loype.key) return;
    forrige.current = loype.key;
    if (redusert || !innhold.current?.animate) return;
    innhold.current.animate(
      [
        { opacity: 0.35, filter: "blur(2px)" },
        { opacity: 1, filter: "blur(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }, [loype.key, redusert]);

  return (
    <div ref={innhold}>
      <Oppsummering loype={loype} sammenstilt={sammenstilt} />
      <div className="grid gap-x-10 lg:grid-cols-12 xl:gap-x-12">
        <div className="hidden lg:col-span-6 lg:block">
          <Loypekart
            loype={loype}
            terreng={terreng}
            aktiv={aktiv}
            tegnet={tegnet}
            forsinkelse={forsinkelse}
            className="sticky top-[calc(var(--topp)+24px)]"
          />
        </div>
        <div className="min-w-0 lg:col-span-6">
          <Framdrift loype={loype} aktiv={aktiv} />
          <Stegliste
            loype={loype}
            aktiv={aktiv}
            tegnet={tegnet}
            forsinkelse={forsinkelse}
            listeRef={listeRef}
          />
        </div>
      </div>
    </div>
  );
}
