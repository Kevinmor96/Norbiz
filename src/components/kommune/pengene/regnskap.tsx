// Kommunens eget regnskap (DESIGN.md §5.4). Hvert mål står i sin egen kolonne
// med sine egne år og kilder. Merforbruk og underskudd er to ulike mål, så de
// står aldri på samme akse, og siden regner aldri differansen mellom dem.

import type { CSSProperties } from "react";

import { MedMerke } from "@/components/maktkart/kildemerke";
import type { Nokkeltalltype, OrganRef } from "@/lib/data";
import { NOKKELTALLNAVN } from "@/lib/navn";

import { Blokktittel, IkkeKartlagt, aarOgOmfang, verdiTekst } from "./felles";
import { kildeKort, type kommuneregnskap } from "./utregning";

type Grupper = ReturnType<typeof kommuneregnskap>;

/** Hva målet betyr, i én setning. Bare for målene en kommune fører. */
const FORKLARING: Partial<Record<Nokkeltalltype, string>> = {
  merforbruk: "Det kommunen brukte ut over det budsjettet hadde dekning for.",
  underskudd: "Negativt driftsresultat: driftsutgiftene var større enn driftsinntektene.",
  driftsresultat: "Driftsinntektene minus driftsutgiftene.",
};

function liste(ord: string[]): string {
  if (ord.length <= 1) return ord.join("");
  return `${ord.slice(0, -1).join(", ")} og ${ord[ord.length - 1]}`;
}

export function Regnskap({
  grupper,
  organ,
  tittelId,
}: {
  grupper: Grupper;
  organ: OrganRef | null;
  tittelId: string;
}) {
  const navn = grupper.map((g) => NOKKELTALLNAVN[g.type].toLowerCase());
  return (
    <div className="flex flex-col gap-3 border-t border-trykk pt-6">
      <Blokktittel id={tittelId}>Kommunens eget regnskap</Blokktittel>
      {grupper.length === 0 || !organ ? (
        <>
          <p>
            <IkkeKartlagt>Regnskapet er ikke kartlagt</IkkeKartlagt>
          </p>
          <p className="brodtekst text-[0.9375rem] text-dempet">
            Datasettet har ingen regnskapstall for kommunen ennå. De hentes fra KOSTRA hos SSB og
            fra kommunens eget årsregnskap.
          </p>
        </>
      ) : (
        <>
          {grupper.length > 1 && (
            <p className="brodtekst text-[0.9375rem] text-dempet">
              {liste(navn).charAt(0).toUpperCase() + liste(navn).slice(1)} er ulike mål, regnet
              på ulike måter. Tallene står hver for seg og kan ikke trekkes fra hverandre.
            </p>
          )}
          <div
            className="mt-3 grid max-w-[62rem] gap-x-10 gap-y-8 sm:grid-cols-[repeat(var(--kolonner),minmax(0,1fr))]"
            style={{ "--kolonner": Math.min(3, grupper.length) } as CSSProperties}
          >
            {grupper.map((g) => (
              <section
                key={g.type}
                aria-labelledby={`${tittelId}-${g.type}`}
                className="flex min-w-0 flex-col gap-3"
              >
                <div>
                  <h4
                    id={`${tittelId}-${g.type}`}
                    className="text-[1rem] font-bold [font-stretch:104%]"
                  >
                    {NOKKELTALLNAVN[g.type]}
                  </h4>
                  {FORKLARING[g.type] && (
                    <p className="mt-1 max-w-[44ch] text-[0.8125rem] leading-[1.45] text-dempet">
                      {FORKLARING[g.type]}
                    </p>
                  )}
                </div>
                <dl className="flex flex-col">
                  {g.tall.map((t) => (
                    <div
                      key={`${t.aar}-${t.periode ?? ""}-${String(t.konsern)}-${t.belegg.kilde.key}`}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-3 border-t border-linje py-2.5"
                    >
                      <dt className="text-[0.875rem] font-semibold text-dempet">{aarOgOmfang(t)}</dt>
                      <dd className="flex flex-col gap-0.5">
                        <MedMerke
                          belegg={t.belegg}
                          pastand={`${NOKKELTALLNAVN[g.type]} i ${organ.navn} i ${aarOgOmfang(t)}: ${verdiTekst(t)}, ifølge ${kildeKort(t.belegg.kilde.navn)}`}
                          className="text-[1.375rem] leading-tight font-bold tracking-[-0.01em] [font-stretch:106%]"
                        >
                          {verdiTekst(t)}
                        </MedMerke>
                        <span className="text-[0.8125rem] text-dempet">
                          ifølge {kildeKort(t.belegg.kilde.navn)}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
