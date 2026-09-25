// «Fire svar på samme spørsmål»: det kommunesiden viser, satt opp som en
// tegnforklaring. Hvert svar har sitt tegn fra kartet (løypa, nivåbåndene,
// elva og kanten), spørsmålet leseren stiller, og et tall fra den kartlagte
// kommunen som bevis. Tallene er talt fra datasettet og har kildemerke.

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Pastand } from "@/components/maktkart/kildemerke";
import { antall } from "@/lib/format";

import type { Forsidedata, Tallsvar } from "./last";

type Utvalgt = NonNullable<Forsidedata["utvalgt"]>;

function Tegn({ hva }: { hva: "kjeden" | "organer" | "pengene" | "nettverket" }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" className="shrink-0">
      {hva === "kjeden" && (
        <g fill="none" strokeWidth="1.8" className="stroke-signal">
          <path d="M8 8 14 18H2Z" strokeLinejoin="round" />
          <path d="M10 18 22 26M26 29 36 36" />
          <circle cx="24" cy="27.5" r="3.6" />
          <circle cx="39" cy="38.5" r="5" />
          <circle cx="39" cy="38.5" r="2.6" />
        </g>
      )}
      {hva === "organer" && (
        <g className="stroke-trykk" fill="none" strokeWidth="1.5">
          <rect x="3" y="5" width="42" height="8" />
          <rect x="3" y="15" width="42" height="8" />
          <rect x="3" y="25" width="42" height="8" />
          <rect x="3" y="35" width="42" height="8" />
          <path d="M3 14h42M3 24h42M3 34h42" strokeDasharray="4 2 1 2" className="stroke-linje-sterk" />
        </g>
      )}
      {hva === "pengene" && (
        <g fill="none" className="stroke-vann">
          {/* Elva deler seg: bredden er beløpet, som i utbytteelva på kommunesiden. */}
          <path d="M2 24h16" strokeWidth="9" />
          <path d="M17.5 21.5c9 0 11-10 28.5-10" strokeWidth="5" />
          <path d="M17.5 26c9 0 11 8.5 28.5 8.5" strokeWidth="3.5" />
        </g>
      )}
      {hva === "nettverket" && (
        <g strokeWidth="1.5" fill="none" className="stroke-trykk">
          <rect x="3" y="8" width="14" height="10" />
          <rect x="31" y="8" width="14" height="10" />
          <rect x="17" y="32" width="14" height="10" />
          <path d="M17 13h14M12 18l8 14M36 18l-8 14" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

function Bevis({ svar, tekst, pastand }: { svar: Tallsvar | null; tekst: string; pastand: string }) {
  if (!svar) {
    return (
      <span className="self-start border border-dashed border-kote px-2 py-0.5 text-[0.8125rem] text-kote-tekst">
        Ikke kartlagt ennå
      </span>
    );
  }
  // Pastand binder merket til siste ord, så en lang setning kan brytes uten at merket står alene.
  return (
    <p className="text-[0.9375rem] font-semibold text-pretty">
      <Pastand tekst={tekst} belegg={svar.belegg} pastand={pastand} />
    </p>
  );
}

export function FireSvar({ utvalgt }: { utvalgt: Utvalgt }) {
  const { kommune, svar } = utvalgt;
  const navn = kommune.navn;
  const rader = [
    {
      id: "kjeden",
      tegn: "kjeden" as const,
      navn: "Kjeden",
      sporsmal: "Hvem forbereder saken, og hvem vedtar den?",
      tekst:
        "Saken steg for steg, fra administrasjonen som skriver den til organet som vedtar og instansen som behandler klagen.",
      bevis: (
        <Bevis
          svar={svar.prosesser}
          pastand={`Datasettet for ${navn} har ${svar.prosesser?.antall ?? 0} beslutningskjeder`}
          tekst={
            svar.prosesser
              ? `${antall(svar.prosesser.antall, "kjede", "kjeder")} i ${navn}: ${svar.prosesser.titler.join(" og ").toLowerCase()}`
              : ""
          }
        />
      ),
    },
    {
      id: "organer",
      tegn: "organer" as const,
      navn: "Organene",
      sporsmal: "Hvem sitter hvor?",
      tekst: "Stat, fylke, kommune og selskaper i hvert sitt bånd, med leder og myndighet for hvert organ.",
      bevis: (
        <Bevis
          svar={svar.organer}
          pastand={`Organkartet for ${navn} har ${svar.organer?.antall ?? 0} aktive organer`}
          tekst={
            svar.organer ? `${antall(svar.organer.antall, "aktivt organ", "aktive organer")} i ${navn}` : ""
          }
        />
      ),
    },
    {
      id: "pengene",
      tegn: "pengene" as const,
      navn: "Pengene",
      sporsmal: "Hva eier kommunen, og hvor går utbyttet?",
      tekst: "Eierandelene med siste regnskapstall og år, og utbyttet som en elv fra selskapet til eierne.",
      bevis: (
        <Bevis
          svar={svar.eierandeler}
          pastand={`${navn} kommune eier ${svar.eierandeler?.antall ?? 0} selskaper direkte i datasettet`}
          tekst={
            svar.eierandeler
              ? `${antall(svar.eierandeler.antall, "selskap", "selskaper")} eid direkte av ${navn} kommune`
              : ""
          }
        />
      ),
    },
    {
      id: "nettverket",
      tegn: "nettverket" as const,
      navn: "Koblingene",
      sporsmal: "Hvem sitter flere steder?",
      tekst: "Organene er punktene, og personene er linjene mellom dem. Bare aktive roller teller.",
      bevis: (
        <Bevis
          svar={svar.koblinger}
          pastand={`${svar.koblinger?.antall ?? 0} personer har aktive roller i minst to organer i datasettet for ${navn}`}
          tekst={
            svar.koblinger
              ? `${antall(svar.koblinger.antall, "person", "personer")} med roller i minst to organer`
              : ""
          }
        />
      ),
    },
  ];

  return (
    <ul className="grid border-t border-trykk md:grid-cols-2">
      {rader.map((r, i) => (
        <li
          key={r.id}
          className={
            "grid grid-cols-[48px_minmax(0,1fr)] gap-x-5 gap-y-2 border-b border-linje py-6 md:pr-8 " +
            (i % 2 === 1 ? "md:border-l md:pl-8" : "")
          }
        >
          <Tegn hva={r.tegn} />
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-[1.25rem] leading-[1.15] font-bold tracking-[-0.01em] [font-stretch:105%]">
              {r.navn}
            </h3>
            <p className="text-[1rem] font-semibold">{r.sporsmal}</p>
            <p className="max-w-[46ch] text-[0.9375rem] leading-[1.5] text-dempet text-pretty">{r.tekst}</p>
            {r.bevis}
            <Link
              to="/kommune/$slug"
              params={{ slug: kommune.slug }}
              hash={r.id}
              className="mt-1 inline-flex items-center gap-1.5 self-start text-[0.9375rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
            >
              Se {r.navn.toLowerCase()} i {navn}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

