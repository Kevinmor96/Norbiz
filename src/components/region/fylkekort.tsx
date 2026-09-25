// Fylkene som innganger på forsiden: offisielt navn, folketall med kildemerke,
// kommunene og hvor mye som er kartlagt, og gradstolpen for rollene. Alt er
// regnet i datalaget. Kortet lenker til fylkessiden.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { MedMerke } from "@/components/maktkart/kildemerke";
import { antall, tall } from "@/lib/format";

import { Gradstolpe } from "./gradstolpe";
import { offisielt } from "./navn";
import { DEKNING, DEKNINGSKLASSER, type FylkeIRegion } from "./typer";

export function Fylkekort({ fylke }: { fylke: FylkeIRegion }) {
  const klasser = DEKNINGSKLASSER.filter((k) => fylke.klasser[k] > 0);
  return (
    <li className="flex min-w-0 flex-col gap-4 border-t border-trykk pt-4">
      <header className="flex flex-col gap-1">
        <p className="region text-[0.75rem] text-dempet">Fylke {fylke.fylkesnr}</p>
        <h3 className="seksjon text-[clamp(1.375rem,1.1rem+0.9vw,1.75rem)]">
          <Link
            to="/fylke/$slug"
            params={{ slug: fylke.slug }}
            className="no-underline hover:underline hover:decoration-signal"
          >
            {offisielt(fylke.navn_offisielt)}
          </Link>
        </h3>
      </header>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[0.8125rem] text-dempet">Innbyggere 1.1.{fylke.folketall.aar}</dt>
          <dd className="text-[1.25rem] font-bold tracking-[-0.01em]">
            <MedMerke
              belegg={fylke.folketall.belegg}
              pastand={`${fylke.navn} hadde ${tall(fylke.folketall.verdi)} innbyggere 1. januar ${fylke.folketall.aar}`}
            >
              {tall(fylke.folketall.verdi)}
            </MedMerke>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[0.8125rem] text-dempet">Kommuner</dt>
          <dd className="text-[1.25rem] font-bold tracking-[-0.01em]">
            {tall(fylke.antall_kommuner)}
            <span className="ml-1.5 text-[0.8125rem] font-normal text-dempet">
              {fylke.kartlagt === fylke.antall_kommuner
                ? "alle med datasett"
                : `${tall(fylke.kartlagt)} med datasett`}
            </span>
          </dd>
        </div>
        {fylke.kartlagt > 0 && (
          <div className="col-span-2 flex flex-col gap-0.5">
            <dt className="text-[0.8125rem] text-dempet">I datasettene, telt én gang</dt>
            <dd className="text-[0.9375rem] font-semibold">
              {antall(fylke.dekning.organer, "organ", "organer")} ·{" "}
              {antall(fylke.dekning.roller, "rolle", "roller")} ·{" "}
              {antall(fylke.dekning.personer, "person", "personer")}
            </dd>
          </div>
        )}
      </dl>
      {fylke.kartlagt > 0 ? (
        <Gradstolpe telling={fylke.grader.roller} hva="roller" />
      ) : (
        <p className="self-start border border-dashed border-linje-sterk px-2 py-1 text-[0.8125rem] text-dempet">
          Ingen kommune i {fylke.navn} har datasett ennå
        </p>
      )}
      {fylke.kartlagt > 0 && klasser.length > 0 && (
        <p className="text-[0.8125rem] leading-[1.45] text-dempet text-pretty">
          {klasser
            .map((k) => `${DEKNING[k].navn}: ${antall(fylke.klasser[k], "kommune", "kommuner")}`)
            .join(". ")}
          .
        </p>
      )}
      <Link
        to="/fylke/$slug"
        params={{ slug: fylke.slug }}
        className="mt-auto inline-flex items-center gap-1.5 self-start text-[0.9375rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
      >
        Hvem bestemmer i {fylke.navn}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}
