// Regionkartet: kommunene som flater på et kartblad, farget etter hvor mye
// datasettet dekker (DESIGN.md: kartbladet er siden). Samme komponent tegner
// hele regionen på forsiden og ett fylke på fylkessiden.
//
// Kartet tegnes som SVG på serveren og trenger ingen JavaScript: hver kommune
// er en lenke, og navnet står i lenkens <title>. Med JavaScript viser teksten
// under kartet kommunen leseren peker på.
//
// Fargen er dekning, ikke makt. Mer blekk betyr mer av svaret på «hvem
// bestemmer her?» i datasettet. Signalfargen brukes bare til fokus, slik
// designsystemet sier.
//
// Lag, nedenfra: hav (rammens bakgrunn), land, kommuneflatene svakt på sjø og
// fullt på land (landmasken som klippesti), grensene, kysten, lenkene øverst.
// Stiene står én gang i <defs> og brukes med <use>, så HTML-en ikke bærer dem
// tre ganger.

import { Link } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";

import { datoKort, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FYLKESKART, GRENSER, REGIONLAND, type Utsnitt } from "./geometri";
import { offisielt } from "./navn";
import { DEKNING, type Dekningsklasse, type KommuneIRegion } from "./typer";

/** Fyllet per klasse. Trykkfargen i fallende styrke, og skravur for det som ikke er kartlagt. */
const FYLL: Record<Exclude<Dekningsklasse, "ingen">, string> = {
  kjeder: "fill-trykk",
  folkevalgte: "fill-trykk/60",
  register: "fill-trykk/25",
};

/** Klassen for en flate: fyll eller skravur. `skravur` er mønsterets id. */
export function fyllFor(
  klasse: Dekningsklasse,
  skravur: string,
): { className?: string; fill?: string } {
  return klasse === "ingen" ? { fill: `url(#${skravur})` } : { className: FYLL[klasse] };
}

/** Skravuren for «ikke kartlagt»: tynne skrå streker på papir, som ukartlagt land. */
export function Skravur({ id, tetthet = 1 }: { id: string; tetthet?: number }) {
  const s = 6 * tetthet;
  return (
    <pattern
      id={id}
      width={s}
      height={s}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={s} height={s} className="fill-papir" />
      <line x1="0" y1="0" x2="0" y2={s} className="stroke-linje-sterk" strokeWidth={s / 5} />
    </pattern>
  );
}

function Nordpil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 40" width="18" height="28" aria-hidden="true" className={className}>
      <path d="M13 2 20 24 13 19 6 24Z" className="fill-trykk" />
      <path d="M13 2v17l-7 5Z" className="fill-papir stroke-trykk" strokeWidth="1" />
      <text
        x="13"
        y="37.5"
        textAnchor="middle"
        className="fill-trykk utsparing-svg"
        style={{ font: "700 11px var(--font-archivo)" }}
      >
        N
      </text>
    </svg>
  );
}

export function kommuneHref(k: KommuneIRegion, fylkeslug: string | undefined) {
  return k.datasett
    ? ({ to: "/kommune/$slug", params: { slug: k.slug } } as const)
    : ({
        to: "/fylke/$slug",
        params: { slug: fylkeslug ?? "" },
        hash: `k-${k.kommunenr}`,
      } as const);
}

interface Etikett {
  nr: string;
  tekst: string;
  x: number;
  y: number;
  /** Får plass på smal skjerm også. */
  smal: boolean;
  /** Står på en mørk flate (mest blekk): trykkes i papir med mørk utsparing. */
  invers?: boolean;
}

/**
 * Hvilke kommunenavn som får plass på kartet. Grådig etter folketall: den
 * største kommunen først, og et navn som ville overlappet et som alt står,
 * utelates. Regnes to ganger: for kartets bredde på skrivebord og på mobil.
 * Deterministisk, så serveren og nettleseren velger det samme.
 */
function plasser(
  kandidater: { nr: string; tekst: string; x: number; y: number; vekt: number; invers: boolean }[],
  utsnitt: Utsnitt,
): Etikett[] {
  const velg = (pikslerBredde: number) => {
    const skala = pikslerBredde / utsnitt[2];
    const [ux, uy, ub, uh] = utsnitt;
    // Kartbladets tittel står øverst til venstre og nordpilen nederst til
    // høyre. Navnene holder seg unna dem.
    const bokser: [number, number, number, number][] = [
      [ux, uy, ux + 210 / skala, uy + 58 / skala],
      [ux + ub - 48 / skala, uy + uh - 60 / skala, ux + ub, uy + uh],
    ];
    const valgt = new Set<string>();
    for (const k of [...kandidater].sort((a, b) => b.vekt - a.vekt || (a.nr < b.nr ? -1 : 1))) {
      // 12 px Archivo i 84 % bredde: rundt 6,2 px per tegn, pluss luft rundt.
      const b = (k.tekst.length * 6.2 + 10) / skala / 2;
      const h = 18 / skala / 2;
      const boks: [number, number, number, number] = [k.x - b, k.y - h, k.x + b, k.y + h];
      const utenfor =
        boks[0] < utsnitt[0] ||
        boks[2] > utsnitt[0] + utsnitt[2] ||
        boks[1] < utsnitt[1] ||
        boks[3] > utsnitt[1] + utsnitt[3];
      if (utenfor) continue;
      if (
        bokser.some((o) => boks[0] < o[2] && boks[2] > o[0] && boks[1] < o[3] && boks[3] > o[1])
      ) {
        continue;
      }
      bokser.push(boks);
      valgt.add(k.nr);
    }
    return valgt;
  };
  // Et høyt utsnitt (Nordland) får smalere kart, fordi høyden er begrenset til skjermen.
  const stor = velg(Math.min(720, (740 * utsnitt[2]) / utsnitt[3]));
  const liten = velg(340);
  return kandidater
    .filter((k) => stor.has(k.nr))
    .map((k) => ({
      nr: k.nr,
      tekst: k.tekst,
      x: k.x,
      y: k.y,
      smal: liten.has(k.nr),
      invers: k.invers,
    }));
}

export interface RegionkartProps {
  kommuner: KommuneIRegion[];
  fylker: { fylkesnr: string; navn: string; slug: string }[];
  /** Tegn bare dette fylket, i større målestokk. Uten: hele regionen. */
  fylkesnr?: string;
  /** Overskriften i kartbladets hjørne. */
  tittel: string;
  /** Linja under overskriften: «80 kommuner». */
  undertittel?: string;
  /** Står under kartet, over kildelinja. Tegnforklaringen hører her. */
  children?: ReactNode;
  className?: string;
}

export function Regionkart({
  kommuner,
  fylker,
  fylkesnr,
  tittel,
  undertittel,
  children,
  className,
}: RegionkartProps) {
  const id = `rk${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [aktiv, settAktiv] = useState<string | null>(null);

  const fylkeskart = fylkesnr ? FYLKESKART.filter((f) => f.fylkesnr === fylkesnr) : FYLKESKART;
  const utsnitt: Utsnitt = (fylkesnr ? fylkeskart[0]?.utsnitt : undefined) ?? [
    0,
    0,
    GRENSER.bredde,
    GRENSER.hoyde,
  ];
  const land = fylkesnr ? (fylkeskart[0]?.land ?? REGIONLAND) : REGIONLAND;
  const [x0, y0, b, h] = utsnitt;

  const kommuneAv = new Map(kommuner.map((k) => [k.kommunenr, k]));
  const fylkeAv = new Map(fylker.map((f) => [f.fylkesnr, f]));
  const flater = fylkeskart.flatMap((f) =>
    f.kommuner.flatMap((g) => {
      const k = kommuneAv.get(g.nr);
      return k ? [{ g, k }] : [];
    }),
  );

  const skravur = `${id}-skravur`;
  const klipp = `${id}-klipp`;
  const landId = `${id}-land`;
  const sti = (nr: string) => `${id}-k${nr}`;

  // Navnene: fylkene på regionkartet, kommunene på fylkeskartet.
  const etiketter: Etikett[] = fylkesnr
    ? plasser(
        flater.map(({ g, k }) => ({
          nr: k.kommunenr,
          tekst: k.navn,
          x: g.etikett[0],
          y: g.etikett[1],
          vekt: k.folketall.verdi,
          invers: k.klasse === "kjeder",
        })),
        utsnitt,
      )
    : GRENSER.fylker.flatMap((f) => {
        const fy = fylkeAv.get(f.nr);
        return fy
          ? [{ nr: f.nr, tekst: fy.navn, x: f.etikett[0], y: f.etikett[1], smal: true }]
          : [];
      });

  const vist = aktiv ? kommuneAv.get(aktiv) : undefined;

  return (
    <figure className={cn("m-0 flex min-w-0 flex-col gap-3", className)}>
      <div
        className="relative mx-auto w-full border border-trykk bg-vann-lys p-[5px]"
        // Høye fylker (Nordland) skal ikke bli høyere enn skjermen: bredden gir etter.
        style={{ maxWidth: `calc((100dvh - 9rem) * ${b / h} + 12px)` }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${b} / ${h}` }}>
          <svg
            viewBox={utsnitt.join(" ")}
            className="absolute inset-0 block h-full w-full"
            role="group"
            aria-label={`Kart over ${tittel}. Hver kommune er en lenke.`}
          >
            <defs>
              <Skravur id={skravur} tetthet={b / 900} />
              {/* Landet står én gang og brukes tre ganger: som flate, som klippesti og som kyst. */}
              <path id={landId} d={land} vectorEffect="non-scaling-stroke" />
              <clipPath id={klipp}>
                <use href={`#${landId}`} />
              </clipPath>
              {flater.map(({ g }) => (
                <path key={g.nr} id={sti(g.nr)} d={g.d} vectorEffect="non-scaling-stroke" />
              ))}
            </defs>

            <use href={`#${landId}`} className="fill-papir" />
            <g opacity="0.22" aria-hidden="true">
              {flater.map(({ k }) => (
                <use
                  key={k.kommunenr}
                  href={`#${sti(k.kommunenr)}`}
                  {...fyllFor(k.klasse, skravur)}
                />
              ))}
            </g>
            <g clipPath={`url(#${klipp})`} aria-hidden="true">
              {flater.map(({ k }) => (
                <use
                  key={k.kommunenr}
                  href={`#${sti(k.kommunenr)}`}
                  {...fyllFor(k.klasse, skravur)}
                />
              ))}
            </g>
            <g fill="none" aria-hidden="true" strokeLinejoin="round">
              <use
                href={`#${landId}`}
                className="stroke-vann"
                strokeWidth="0.6"
                opacity="0.7"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={GRENSER.kommunegrenser}
                className="stroke-papir"
                strokeWidth="0.9"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={GRENSER.ytre}
                className="stroke-linje-sterk"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
              {/* Administrativ grense: strek-prikk, som mellom nivåbåndene på kommunesiden. */}
              <path
                d={GRENSER.fylkesgrenser}
                className="stroke-papir"
                strokeWidth="3.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={GRENSER.fylkesgrenser}
                className="stroke-trykk"
                strokeWidth="1.5"
                strokeDasharray="7 3 1.5 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g>
              {flater.map(({ k }) => {
                const fylke = fylkeAv.get(k.fylkesnr);
                const beskrivelse = `${offisielt(k.navn_offisielt)}. ${DEKNING[k.klasse].navn}.`;
                return (
                  <Link
                    key={k.kommunenr}
                    {...kommuneHref(k, fylke?.slug)}
                    aria-label={beskrivelse}
                    className="group outline-none"
                    onPointerEnter={() => settAktiv(k.kommunenr)}
                    onPointerLeave={() => settAktiv((a) => (a === k.kommunenr ? null : a))}
                    onFocus={() => settAktiv(k.kommunenr)}
                    onBlur={() => settAktiv((a) => (a === k.kommunenr ? null : a))}
                  >
                    <title>{beskrivelse}</title>
                    <use
                      href={`#${sti(k.kommunenr)}`}
                      className="fill-transparent stroke-transparent transition-[stroke] duration-150 group-hover:stroke-signal group-focus-visible:stroke-signal"
                      strokeWidth="2"
                    />
                  </Link>
                );
              })}
            </g>
          </svg>

          {etiketter.map((e) => (
            <span
              key={e.nr}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap",
                e.invers ? "utsparing-invers text-paa-trykk" : "utsparing text-trykk",
                fylkesnr
                  ? "etikett text-[0.75rem]"
                  : "region text-[0.6875rem] tracking-[0.24em] sm:text-[0.8125rem]",
                !e.smal && "max-md:hidden",
              )}
              style={{ left: `${((e.x - x0) / b) * 100}%`, top: `${((e.y - y0) / h) * 100}%` }}
            >
              {e.tekst}
            </span>
          ))}

          <p className="utsparing pointer-events-none absolute top-3 left-4 flex max-w-[55%] flex-col gap-0.5 md:top-4 md:left-5">
            <b className="region text-[0.75rem] tracking-[0.3em] [font-stretch:125%] md:text-[0.8125rem]">
              {tittel}
            </b>
            {undertittel && <span className="text-[0.75rem] text-dempet">{undertittel}</span>}
          </p>
          <Nordpil className="absolute right-3 bottom-3 md:right-4 md:bottom-4" />
        </div>
        <i className="gradert gradert-t" aria-hidden="true" />
        <i className="gradert gradert-b" aria-hidden="true" />
        <i className="gradert gradert-v" aria-hidden="true" />
        <i className="gradert gradert-h" aria-hidden="true" />
        <span
          className="pointer-events-none absolute inset-[5px] border border-trykk"
          aria-hidden="true"
        />
      </div>

      <figcaption className="flex flex-col gap-3">
        {/* Kommunen leseren peker på. Står i DOM-en hele tiden, så høyden ikke hopper.
            Folketallet står med år; kildemerket står ved det samme tallet i kommuneindeksen
            på fylkessiden, fordi et merke her forsvinner før pekeren når det. */}
        <p aria-live="polite" className="text-[0.875rem] leading-[1.4] md:min-h-[2.75rem]">
          {vist ? (
            <>
              <b className="font-semibold">{offisielt(vist.navn_offisielt)}</b>
              <span className="text-dempet">
                {" "}
                · {tall(vist.folketall.verdi)} innbyggere 1.1.{vist.folketall.aar} ·{" "}
                {DEKNING[vist.klasse].navn}
                {vist.datasett &&
                  ` · ${tall(vist.datasett.organer)} organer og ${tall(vist.datasett.roller)} roller`}
              </span>
            </>
          ) : (
            <span className="text-dempet">
              <span className="max-md:hidden">
                Pek på en kommune for å se navnet og hva vi har. Trykk for å åpne den.
              </span>
              <span className="md:hidden">Trykk på en kommune for å åpne den.</span>
            </span>
          )}
        </p>
        {children}
        <span className="text-[0.75rem] leading-[1.4] text-dempet">
          {GRENSER.meta.attribusjon} Kommunegrensene er hentet {datoKort(GRENSER.meta.hentet)} og
          tar med sjøarealet, slik Kartverket fører dem.
        </span>
      </figcaption>
    </figure>
  );
}
