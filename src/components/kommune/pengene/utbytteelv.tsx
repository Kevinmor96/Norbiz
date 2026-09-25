// Utbyttet som elv (DESIGN.md §5.4). Selskapet øverst, mottakerne nederst, og
// bredden på hver gren er proporsjonal med beløpet. Kommunens del er fylt vann
// hele veien fra kilden, så leseren kan følge pengene til kommunen.
//
// Elva står loddrett, så den samme figuren virker i en smal kolonne på
// skrivebord og på en 390 px mobil. Beløpene står i HTML under grenene, i et
// rutenett der hver kolonne står rett under sin gren. Da har hvert beløp sitt
// eget kildemerke, og teksten skaleres aldri.
//
// Strømlinjene tegnes én gang når elva kommer i bildet, og ligger så stille.
// Uendelig bevegelse ved lesestoff er uro. Beløpene er i kursiv: flyt.

import { MedMerke } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import { avledBelegg } from "@/lib/belegg";
import { dato, kroner, lesbar, prosent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Blokktittel, IkkeKartlagt, LENKESTIL } from "./felles";
import { useSpillEnGang } from "./spill-en-gang";
import type { Mottaker, utbytteElv } from "./utregning";

type Elv = NonNullable<ReturnType<typeof utbytteElv>>;

const B = 360;
const H = 236;
const DELING = 64;
/** Stammen er en fast andel av bredden. Grenene deler den etter beløp. */
const STAMME = B * 0.36;

interface Gren {
  nokkel: string;
  mottaker: Mottaker | null;
  belop: number;
  /** Venstre og høyre kant der grenen går ut av stammen. */
  a: number;
  b: number;
  /** Midten og bredden nederst. */
  cx: number;
  w: number;
}

function grener(elv: Elv): Gren[] {
  const deler = [
    ...elv.mottakere.map((m) => ({
      nokkel: m.org.key,
      mottaker: m as Mottaker | null,
      belop: m.belop,
    })),
    ...(elv.ufordelt > 0 ? [{ nokkel: "ufordelt", mottaker: null, belop: elv.ufordelt }] : []),
  ];
  const n = deler.length;
  let x = (B - STAMME) / 2;
  return deler.map((d, i) => {
    const w = (STAMME * d.belop) / elv.totalbelop;
    const g = { ...d, a: x, b: x + w, cx: ((i + 0.5) / n) * B, w };
    x += w;
    return g;
  });
}

const r = (v: number) => Math.round(v * 10) / 10;

function grensti(g: Gren): string {
  const ys = DELING;
  const ye = H;
  const v = g.cx - g.w / 2;
  const h = g.cx + g.w / 2;
  return (
    `M${r(g.a)} 0L${r(g.a)} ${ys}C${r(g.a)} ${ys + 70} ${r(v)} ${ye - 80} ${r(v)} ${ye}` +
    `L${r(h)} ${ye}C${r(h)} ${ye - 80} ${r(g.b)} ${ys + 70} ${r(g.b)} ${ys}L${r(g.b)} 0Z`
  );
}

function stromsti(g: Gren): string {
  const m = (g.a + g.b) / 2;
  return `M${r(m)} 6L${r(m)} ${DELING}C${r(m)} ${DELING + 70} ${r(g.cx)} ${H - 80} ${r(g.cx)} ${H - 10}`;
}

export function Utbytteelv({
  elv,
  tittelId,
  sammenstilt,
}: {
  elv: Elv;
  tittelId: string;
  sammenstilt: string;
}) {
  const [ref, fase] = useSpillEnGang<SVGSVGElement>();
  const gs = grener(elv);
  const selskap = elv.selskap.navn;
  const status = elv.forslag ? "Foreslått utbytte" : "Utbytte";
  const aar = elv.totaltall?.aar ?? null;
  const per = elv.totaltall?.belegg.per ?? elv.mottakere[0]?.belegg.per ?? null;
  const naar = aar !== null ? `for ${aar}` : per ? `per ${dato(per)}` : "";
  // Uten selskapets eget utbyttetall er summen regnet fra mottakerne, og
  // merket sier det.
  const totalbelegg =
    elv.totaltall?.belegg ??
    avledBelegg(
      elv.mottakere.map((m) => m.belegg),
      {
        per: sammenstilt,
        merknad: `Selskapets eget utbyttetall mangler i datasettet. Summen er regnet fra beløpene til mottakerne.`,
      },
    );
  const tilEieren = elv.mottakere.some((m) => m.erEieren);
  const beskrivelse =
    `${status} fra ${selskap} ${naar}: ${kroner(elv.totalbelop)}. ` +
    gs
      .map((g) =>
        g.mottaker
          ? `${kroner(g.belop)} til ${g.mottaker.org.navn}`
          : `${kroner(g.belop)} er ikke fordelt i kilden`,
      )
      .join(", ") +
    ".";

  return (
    <div className="flex flex-col gap-3">
      <Blokktittel id={tittelId}>Hvor utbyttet går</Blokktittel>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        {tilEieren
          ? "Det største utbyttet til kommunen i datasettet."
          : "Det største utbyttet i eierkjeden i datasettet."}{" "}
        Bredden på hver gren er beløpet.
      </p>

      <figure className="mt-2 border border-linje-sterk px-4 pt-4 pb-5">
        <figcaption className="flex flex-col items-center text-center">
          <span className="flyt text-[1.625rem] leading-none tracking-[-0.01em] [font-stretch:104%]">
            <MedMerke
              belegg={totalbelegg}
              pastand={`${status} fra ${selskap} ${naar}: ${kroner(elv.totalbelop)}`}
            >
              {kroner(elv.totalbelop)}
            </MedMerke>
          </span>
          <span className="etikett mt-2 text-[0.9375rem] text-pretty">
            <strong className="font-bold">{elv.forslag ? "foreslått" : "utbytte"}</strong>
            {elv.forslag ? " utbytte" : ""} fra <OrganLenke org={elv.selskap} className={LENKESTIL} />
            {naar ? ` ${naar}` : ""}
          </span>
        </figcaption>

        <svg
          ref={ref}
          viewBox={`0 0 ${B} ${H}`}
          role="img"
          aria-label={beskrivelse}
          className="mx-auto mt-3 block h-auto w-full max-w-[26rem] overflow-visible"
        >
          {gs.map((g) =>
            g.mottaker ? (
              <path
                key={g.nokkel}
                d={grensti(g)}
                className={cn("fill-vann", !g.mottaker.erEieren && "opacity-30")}
                stroke="var(--papir)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              // Det kilden ikke fordeler, tegnes åpent: pengene finnes, men vi vet ikke hvor de går.
              <path
                key={g.nokkel}
                d={grensti(g)}
                fill="none"
                className="stroke-linje-sterk"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
          {/* Kilden: en strek over stammen, der hele beløpet går ut. */}
          <line
            x1={r((B - STAMME) / 2 - 8)}
            x2={r((B + STAMME) / 2 + 8)}
            y1="1"
            y2="1"
            className="stroke-trykk"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {gs
            .filter((g) => g.mottaker && g.w >= 8)
            .map((g) => (
              <g
                key={`strom-${g.nokkel}`}
                className={g.mottaker?.erEieren ? "stroke-papir" : "stroke-vann"}
              >
                <path
                  d={stromsti(g)}
                  pathLength={1}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="1"
                  style={{
                    strokeDashoffset: fase === "klar" ? 1 : 0,
                    transition:
                      fase === "spill" ? "stroke-dashoffset 800ms var(--ease-ut)" : undefined,
                  }}
                />
                <path
                  d={`M${r(g.cx - 4)} ${H - 15}L${r(g.cx)} ${H - 9}L${r(g.cx + 4)} ${H - 15}`}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    opacity: fase === "klar" ? 0 : 1,
                    transition: fase === "spill" ? "opacity 200ms linear 650ms" : undefined,
                  }}
                />
              </g>
            ))}
        </svg>

        <ul
          className="mx-auto grid max-w-[26rem] gap-x-2"
          style={{ gridTemplateColumns: `repeat(${gs.length}, minmax(0, 1fr))` }}
        >
          {gs.map((g) => (
            <li key={g.nokkel} className="flex flex-col items-center pt-2.5 text-center">
              {g.mottaker ? (
                <>
                  <span className="flyt text-[1.1875rem] leading-tight">
                    <MedMerke
                      belegg={g.mottaker.belegg}
                      pastand={
                        `${g.mottaker.org.navn} får ${kroner(g.belop)} av ${elv.forslag ? "det foreslåtte utbyttet" : "utbyttet"} fra ${selskap}` +
                        (g.mottaker.andel !== null ? `, som eier ${prosent(g.mottaker.andel)}` : "")
                      }
                    >
                      {kroner(g.belop)}
                    </MedMerke>
                  </span>
                  <span
                    className={cn(
                      "etikett mt-1 text-[0.8125rem] text-pretty",
                      g.mottaker.erEieren ? "font-bold" : "text-dempet",
                    )}
                  >
                    <OrganLenke org={g.mottaker.org} className={LENKESTIL} />
                  </span>
                  {g.mottaker.andel !== null && (
                    <span className="text-[0.75rem] text-dempet">
                      eier {prosent(g.mottaker.andel)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="flyt text-[1.1875rem] leading-tight">{kroner(g.belop)}</span>
                  <IkkeKartlagt className="mt-1">Ikke fordelt i kilden</IkkeKartlagt>
                </>
              )}
            </li>
          ))}
        </ul>
      </figure>

      {(elv.forslag || elv.hull.length > 0) && (
        <div className="flex flex-col gap-1.5 text-[0.8125rem] leading-[1.5] text-dempet">
          {elv.hull.length > 0
            ? elv.hull.map((h) => <p key={h.hva}>{lesbar(h.hva)}</p>)
            : elv.forslag && (
                <p>
                  Kilden omtaler beløpet som et forslag. Datasettet sier ikke om det er vedtatt.
                </p>
              )}
        </div>
      )}
    </div>
  );
}

/** Når datasettet ikke har utbytte med beløp. */
export function IngenUtbytte({ tittelId }: { tittelId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Blokktittel id={tittelId}>Hvor utbyttet går</Blokktittel>
      <p>
        <IkkeKartlagt>Utbytte ikke kartlagt</IkkeKartlagt>
      </p>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Datasettet har ingen utbytte med beløp for selskapene kommunen eier. Utbytte hentes fra
        selskapenes årsregnskap i Regnskapsregisteret.
      </p>
    </div>
  );
}
