// Tallene /pro viser under hver funksjon: hva datasettet allerede har som Pro
// skal bygge på. Regnes i loaderen fra den største kartlagte kommunen, med
// avledet belegg, så hvert tall har kildemerke som alt annet.

import { avledBelegg, type AvledetBelegg } from "@/lib/belegg";
import type { Kommuneliste, KommuneMeta } from "@/lib/data";
import { dato, tall } from "@/lib/format";
import { lastKommuneside } from "@/lib/kommuneside";

import { rollebytter } from "../topp/nokkeltall";
import type { ProFunksjon } from "./prishypoteser";

export interface Grunnlagstall {
  /** Hele setningen, med tallet i. */
  tekst: string;
  /** Påstanden i kildelappen. */
  pastand: string;
  belegg: AvledetBelegg;
}

export interface ProGrunnlag {
  kommuner: Kommuneliste;
  kommune: KommuneMeta | null;
  tall: Partial<Record<ProFunksjon["key"], Grunnlagstall>>;
}

export async function lastProGrunnlag(): Promise<ProGrunnlag> {
  const { data } = await import("@/lib/data");
  const kommuner = await data.kommuner();
  const forst = [...kommuner].sort(
    (a, b) => b.antall_organer - a.antall_organer || (a.slug < b.slug ? -1 : 1),
  )[0];
  const side = forst ? await lastKommuneside(forst.slug) : null;
  if (!side) return { kommuner, kommune: null, tall: {} };

  const navn = side.kommune.navn;
  const per = side.kommune.sammenstilt;
  const t: ProGrunnlag["tall"] = {};

  const r = rollebytter(side);
  if (r.hendelser.length) {
    t.varsler = {
      tekst: `${tall(r.hendelser.length)} rollebytter i ${navn} siden ${dato(r.fra)}`,
      pastand: `${tall(r.hendelser.length)} rollebytter i organene i ${navn} fra ${dato(r.fra)} til sammenstillingen`,
      belegg: r.belegg,
    };
  }

  const kanter = side.nettverk.kanter.length;
  if (side.nettverk.personer.length) {
    t.graf = {
      tekst: `${tall(kanter)} koblinger mellom organene i ${navn} på den åpne siden`,
      pastand: `${tall(kanter)} koblinger mellom organer i nettverket for ${navn}`,
      belegg: avledBelegg(
        side.nettverk.personer.flatMap((p) => p.roller.map((x) => x.belegg)),
        { per, merknad: "Telt fra nettverket: personer med aktive roller i minst to organer." },
      ),
    };
  }

  const hendelser = side.endringer.skjedd.length;
  if (hendelser) {
    t.historikk = {
      tekst: `${tall(hendelser)} hendelser med dato i ${navn}`,
      pastand: `Datasettet for ${navn} har ${tall(hendelser)} hendelser som har skjedd`,
      belegg: avledBelegg(
        side.endringer.skjedd.map((e) => e.belegg),
        { per, merknad: "Telt fra hendelsene i datasettet som har skjedd." },
      ),
    };
  }

  const organer = side.organkart.grupper.flatMap((g) => g.organer);
  if (organer.length) {
    t.eksport = {
      tekst: `${tall(organer.length)} organer i ${navn}, hvert med kilde`,
      pastand: `Organkartet for ${navn} har ${tall(organer.length)} aktive organer`,
      belegg: avledBelegg(
        organer.map((o) => o.belegg),
        { per, merknad: "Telt fra de aktive organene i organkartet." },
      ),
    };
  }

  return { kommuner, kommune: side.oversikt.kommune, tall: t };
}
