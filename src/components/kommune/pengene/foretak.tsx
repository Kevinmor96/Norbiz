// Kommunale foretak og selskaper kommunen eier gjennom andre (DESIGN.md §5.4).
//
// Et kommunalt foretak (KF) er en del av kommunen, med kommunestyret som
// øverste organ. Det har ingen eierandel, så det står i sin egen gruppe og
// aldri som en stolpe. Selskaper lenger ned i eierkjeden står med eierne sine,
// så leseren ser hvem kommunen eier gjennom.

import { Kildemerke, MedMerke } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import type { HullPunkt, OrganRef } from "@/lib/data";
import { lesbar, prosent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Blokktittel, LENKESTIL, Nokkeltall } from "./felles";
import type { Foretaksrad, Indirekterad } from "./utregning";
import { VisAlle } from "./vis-alle";

/** Radene som vises før «Vis alle» i de to kortere listene. */
const TOPP = 8;

export function Foretak({
  rader,
  eier,
  tittelId,
}: {
  rader: Foretaksrad[];
  eier: OrganRef;
  tittelId: string;
}) {
  if (rader.length === 0) return null;
  // Fylkeskommunen har fylkeskommunale foretak. Navnet følger eieren.
  const fylke = eier.organtype === "fylkeskommune";
  return (
    <div className="flex flex-col gap-3">
      <Blokktittel id={tittelId}>
        {fylke
          ? "Fylkeskommunale foretak, del av fylkeskommunen"
          : "Kommunale foretak, del av kommunen"}
      </Blokktittel>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Foretakene er en del av {eier.navn}. De har ingen eierandel, og derfor står de ikke blant
        stolpene.
      </p>
      <VisAlle
        className="mt-1"
        antall={rader.length}
        hva="foretak"
        forste={
          <ForetakListe
            rader={rader.slice(0, TOPP)}
            eier={eier}
            fylke={fylke}
            tittelId={tittelId}
          />
        }
        resten={
          rader.length > TOPP && (
            <div className="mt-3">
              <ForetakListe rader={rader.slice(TOPP)} eier={eier} fylke={fylke} />
            </div>
          )
        }
      />
    </div>
  );
}

function ForetakListe({
  rader,
  eier,
  fylke,
  tittelId,
}: {
  rader: Foretaksrad[];
  eier: OrganRef;
  fylke: boolean;
  tittelId?: string;
}) {
  return (
    <ul aria-labelledby={tittelId} className="border-b border-linje">
      {rader.map((r) => (
        <li key={r.org.key} className="flex flex-col gap-1 border-t border-linje py-2.5">
          <p className="font-semibold text-pretty">
            <span className="whitespace-nowrap">
              <OrganLenke org={r.org} className={LENKESTIL} />
              <Kildemerke
                belegg={r.belegg}
                pastand={`${r.org.navn} er et ${fylke ? "fylkeskommunalt" : "kommunalt"} foretak i ${eier.navn}`}
              />
            </span>
          </p>
          {r.tall.length > 0 && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
              {r.tall.map((t) => (
                <Nokkeltall key={`${t.aar}-${t.type}-${String(t.konsern)}`} t={t} organ={r.org} />
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Eierkjede({ rader, tittelId }: { rader: Indirekterad[]; tittelId: string }) {
  if (rader.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <Blokktittel id={tittelId}>Eid gjennom andre</Blokktittel>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Selskaper kommunen eier gjennom selskapene eller foretakene sine.
      </p>
      <VisAlle
        className="mt-1"
        antall={rader.length}
        hva="selskaper"
        forste={<KjedeListe rader={rader.slice(0, TOPP)} tittelId={tittelId} />}
        resten={
          rader.length > TOPP && (
            <div className="mt-3">
              <KjedeListe rader={rader.slice(TOPP)} />
            </div>
          )
        }
      />
    </div>
  );
}

function KjedeListe({ rader, tittelId }: { rader: Indirekterad[]; tittelId?: string }) {
  return (
    <ul aria-labelledby={tittelId} className="border-b border-linje">
      {rader.map((r) => (
        <li key={r.org.key} className="flex flex-col gap-1 border-t border-linje py-2.5">
          <p className="font-semibold text-pretty">
            <OrganLenke org={r.org} className={LENKESTIL} />
          </p>
          <p className="text-[0.8125rem] leading-[1.5] text-dempet">
            Eid av{" "}
            {r.eiere.map((e, i) => (
              <span key={e.org.key}>
                {i > 0 && (i === r.eiere.length - 1 ? " og " : ", ")}
                <OrganLenke org={e.org} className={cn(LENKESTIL, "text-trykk")} />{" "}
                {e.andel !== null ? (
                  <MedMerke
                    belegg={e.belegg}
                    pastand={`${e.org.navn} eier ${prosent(e.andel)} av ${r.org.navn}`}
                    className="font-semibold text-trykk"
                  >
                    {prosent(e.andel)}
                  </MedMerke>
                ) : (
                  <span className="whitespace-nowrap">
                    (andel ikke oppgitt)
                    <Kildemerke
                      belegg={e.belegg}
                      pastand={`${e.org.navn} er eier i ${r.org.navn}. Andelen er ikke oppgitt`}
                    />
                  </span>
                )}
              </span>
            ))}
          </p>
          {r.tall.length > 0 && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
              {r.tall.map((t) => (
                <Nokkeltall key={`${t.aar}-${t.type}-${String(t.konsern)}`} t={t} organ={r.org} />
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Det datasettet sier mangler i eieroversikten. Skrevet om, så «[verifiser]» aldri når leseren. */
export function Eierhull({ hull }: { hull: HullPunkt[] }) {
  if (hull.length === 0) return null;
  return (
    <div className="mt-6 flex flex-col gap-2">
      <p className="region text-[0.6875rem] text-kote-tekst">Ikke med i oversikten</p>
      <ul className="flex flex-col gap-2 text-[0.8125rem] leading-[1.5]">
        {hull.map((h) => (
          <li key={h.hva} className="border-l border-dashed border-kote pl-3 text-pretty">
            {lesbar(h.hva)} <span className="text-dempet">{lesbar(h.hvorfor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
