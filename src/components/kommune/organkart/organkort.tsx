// Et organkort i organkartet (DESIGN.md §5.3): navn, myndighet som små
// etiketter, leder med kildemerke eller «Leder ikke kartlagt», og
// sensitiv-markering der det gjelder. Hele kortet åpner organskuffen.
//
// Kortet har id-en `organ-<key>`, samme token som adressen skuffen bruker. Uten
// JavaScript ruller /kommune/tromso#organ-troms-kraft derfor til kortet.

import { MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import {
  IkkeKartlagt,
  KildeneUenige,
  MyndighetListe,
  Planlagt,
  Sensitivmerke,
  Statusmerke,
} from "@/components/organ/merker";
import { OrganLenke, organAnker } from "@/components/organ/organ-skuff";
import {
  erKonflikt,
  forsteSetning,
  lederHentesFra,
  ren,
  rollePastand,
  rolleTid,
} from "@/components/organ/tekst";
import type { OrganKort, Rolle } from "@/lib/data";
import { orgnr, tall } from "@/lib/format";
import { MYNDIGHETNAVN, ORGANTYPENAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import type { Plassert } from "./baand";

/** Hvor mange ledere kortet viser. Resten står i skuffen. */
const MAKS_LEDERE = 2;

function Lederlinje({ rolle, organnavn }: { rolle: Rolle; organnavn: string }) {
  const tid = rolleTid(rolle);
  const pastand = rollePastand(rolle, organnavn);
  return (
    <li className="leading-[1.4]">
      <span className="text-dempet">{rolle.tittel}</span>{" "}
      {rolle.parti ? (
        <>
          <b className="font-semibold">{rolle.person.navn}</b>{" "}
          <MedMerke belegg={rolle.belegg} pastand={pastand} className="text-dempet">
            ({rolle.parti})
          </MedMerke>
        </>
      ) : (
        <Pastand
          tekst={rolle.person.navn}
          belegg={rolle.belegg}
          pastand={pastand}
          className="font-semibold"
        />
      )}
      {rolle.status !== "fast" && (
        <>
          {" "}
          <Statusmerke status={rolle.status} />
        </>
      )}
      {tid.planlagt && rolle.status !== "fast" && (
        <span className="mt-0.5 block text-[0.8125rem] text-dempet">
          <Planlagt>{tid.planlagt}</Planlagt>
        </span>
      )}
    </li>
  );
}

/** Metalinjen: «Utvalg · 11 medlemmer», «Kommune · org.nr. 940 101 808». */
function meta(k: OrganKort, stor: boolean): string {
  const deler: string[] = [ORGANTYPENAVN[k.organtype]];
  if (k.antall_medlemmer !== null) deler.push(`${tall(k.antall_medlemmer)} medlemmer`);
  if (k.rekkevidde === "nasjonal") deler.push("nasjonalt");
  if (stor && k.orgnr) deler.push(`org.nr. ${orgnr(k.orgnr)}`);
  return deler.join(" · ");
}

export function Organkort({
  plassert,
  stor = false,
  synlighet,
  className,
}: {
  plassert: Plassert;
  /** Paraplyen i båndets hode: kommunen eller fylkeskommunen selv. */
  stor?: boolean;
  /** Klassene som skjuler kortet i et sammenfoldet bånd. */
  synlighet?: string;
  className?: string;
}) {
  const { kort, hull } = plassert;
  const ledere = kort.ledere.slice(0, MAKS_LEDERE);
  const flere = kort.ledere.length - ledere.length;
  const konflikt = hull.find(erKonflikt);
  const hvor = lederHentesFra(hull);
  // En stortingsbenk har representanter, ikke en leder.
  const utenLeder = kort.organtype === "lovgivende";
  // Paraplyen (kommunen eller fylkeskommunen selv) ledes gjennom organene under
  // den. At den ikke har egen leder, er ikke et hull.
  const manglerLeder = ledere.length === 0 && !utenLeder && !stor;
  const metatekst = meta(kort, stor);
  const Element = stor ? "div" : "li";

  return (
    <Element
      id={organAnker(kort.key)}
      className={cn(
        "group/kort relative flex min-w-0 scroll-mt-[calc(var(--topp)+24px)] flex-col gap-1.5 border bg-flate",
        "transition-[border-color,transform] duration-150 ease-(--ease-ut) active:scale-[0.99]",
        // Kildemerkene ligger over lenkeflaten, så de kan trykkes på for seg.
        "[&_.kildemerke]:z-[1] hover:border-trykk has-[.organlenke:focus-visible]:outline-2 has-[.organlenke:focus-visible]:outline-offset-2 has-[.organlenke:focus-visible]:outline-signal",
        stor ? "gap-2 border-trykk px-4 py-4 md:px-5" : "border-linje px-3 pt-2.5 pb-3",
        synlighet,
        className,
      )}
    >
      <p
        className={cn(
          "min-w-0 [overflow-wrap:anywhere] hyphens-auto",
          stor
            ? "seksjon text-[clamp(1.25rem,1.1rem+0.6vw,1.5rem)]"
            : "text-[0.9375rem] leading-[1.25] font-semibold",
        )}
        lang="nb"
      >
        <OrganLenke
          org={kort.key}
          navn={kort.navn}
          className="organlenke no-underline outline-none after:absolute after:inset-0 after:content-[''] group-hover/kort:underline group-hover/kort:decoration-signal"
        >
          {kort.navn}
        </OrganLenke>
      </p>

      <p className="text-[0.8125rem] leading-[1.35] text-dempet">
        <Pastand
          tekst={metatekst}
          belegg={kort.belegg}
          pastand={`${kort.navn}: ${metatekst.toLowerCase()}${kort.myndighet.length ? `. Myndighet: ${kort.myndighet.map((m) => MYNDIGHETNAVN[m].toLowerCase()).join(", ")}` : ""}.`}
        />
      </p>

      {ledere.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[0.875rem]">
          {ledere.map((r) => (
            <Lederlinje key={`${r.person.key}|${r.tittel}`} rolle={r} organnavn={kort.navn} />
          ))}
          {flere > 0 && (
            <li className="text-[0.8125rem] text-dempet">og {tall(flere)} til i profilen</li>
          )}
        </ul>
      ) : (
        utenLeder && (
          <p className="text-[0.875rem] leading-[1.4] text-dempet">
            Ingen leder. Representantene står i profilen.
          </p>
        )
      )}

      {konflikt && (
        <p className="flex flex-col items-start gap-1">
          <KildeneUenige />
          <span className="text-[0.8125rem] leading-[1.4] text-kote-tekst">
            {forsteSetning(ren(konflikt.hva))}
          </span>
        </p>
      )}

      {/* Mangler lederen, står brikken først i raden med myndigheten. Da tar et
          tomt kort én linje mindre, og kortene i et bånd blir like lette å skanne. */}
      <div className="mt-auto flex flex-col gap-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-1">
          {manglerLeder && <IkkeKartlagt>Leder ikke kartlagt</IkkeKartlagt>}
          <MyndighetListe myndighet={kort.myndighet} organnavn={kort.navn} />
          {kort.sensitiv && <Sensitivmerke />}
        </div>
        {manglerLeder && hvor && (
          <p className="text-[0.75rem] leading-[1.35] text-dempet">Leder hentes fra {hvor}</p>
        )}
      </div>
    </Element>
  );
}
