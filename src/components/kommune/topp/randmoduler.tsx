// Randopplysningene: fire tall som bare denne kommunen har, i en kolonne langs
// kartbladet (DESIGN.md §5.1, modulene fra retning B). Hvert tall har sitt
// eget kildemerke, og hver figur har en tekst for skjermlesere.
//
// Figurene er små og stille: seter i trykkfarge (organer er ikke penger),
// eierandeler og utbytte i vann (vann betyr penger), rollebyttene som streker
// på en akse som slutter ved «Sammenstilt», aldri «i dag».

import type { ReactNode } from "react";

import { MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import { dato, datoKort, millioner, prosent, tall } from "@/lib/format";
import type { Kommuneside } from "@/lib/kommuneside";
import { cn } from "@/lib/utils";

import { aksjeselskaper, rollebytter, seter, utbytte } from "./nokkeltall";

function Modul({
  tall: verdi,
  etikett,
  figur,
  meta,
}: {
  tall: ReactNode;
  etikett: ReactNode;
  figur?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-trykk pt-3">
      <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">{verdi}</p>
      <p className="etikett text-[0.875rem] text-pretty">{etikett}</p>
      {figur && <div className="mt-1.5">{figur}</div>}
      {meta && <p className="text-[0.75rem] leading-[1.35] text-dempet">{meta}</p>}
    </div>
  );
}

/** Et hull i randen: tallet finnes ikke i datasettet ennå. */
function Hull({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-trykk pt-3">
      <p className="self-start border border-dashed border-kote px-2 py-1 text-[0.8125rem] text-kote-tekst">
        {children}
      </p>
    </div>
  );
}

const Stort = ({ children }: { children: ReactNode }) => (
  <span className="text-[clamp(2rem,1.6rem+1.2vw,2.5rem)] font-[760] tracking-[-0.02em] [font-stretch:108%]">
    {children}
  </span>
);
const Enhet = ({ children }: { children: ReactNode }) => (
  <span className="text-[0.9375rem] font-semibold">{children}</span>
);

const YTRE = 32;
/** Ønsket avstand mellom setene, langs buen og mellom radene. */
const AVSTAND = 7;

/**
 * Radene i salen. Tre faste rader ga 3, 5 og 7 seter for et kommunestyre på
 * 15, og da sto setene i stråler, ikke i buer. Her velges antall rader så
 * avstanden mellom setene blir omtrent den samme langs buen og mellom radene:
 * med k rader og avstand s rommer rad i omtrent π·rᵢ/s + 1 seter, og s løses
 * for hver k. Små styrer får én bue, store får flere.
 */
function salen(antall: number): { radius: number; seter: number }[] {
  let best: { radius: number; seter: number }[] = [{ radius: YTRE, seter: antall }];
  let avvik = Infinity;
  for (let k = 1; k <= 6; k++) {
    const s = (Math.PI * YTRE * k) / (antall - k + (Math.PI * k * (k - 1)) / 2);
    if (!(s > 0) || s < 5.2 || YTRE - (k - 1) * s < 8) continue;
    if (Math.abs(s - AVSTAND) >= avvik) continue;
    avvik = Math.abs(s - AVSTAND);
    const radier = Array.from({ length: k }, (_, i) => YTRE - i * s);
    const sum = radier.reduce((a, b) => a + b, 0);
    // Største rest: setene fordeles etter radius og summerer alltid til antall.
    const andel = radier.map((r) => (antall * r) / sum);
    const seter = andel.map(Math.floor);
    const igjen = antall - seter.reduce((a, b) => a + b, 0);
    andel
      .map((a, i) => ({ i, rest: a - Math.floor(a) }))
      .sort((a, b) => b.rest - a.rest || a.i - b.i)
      .slice(0, igjen)
      .forEach(({ i }) => (seter[i] = (seter[i] ?? 0) + 1));
    best = radier.map((radius, i) => ({ radius, seter: seter[i] ?? 0 }));
  }
  return best;
}

/** Halvsirkel med ett sete per medlem, i buer som i en sal. */
function Halvsirkel({ antall }: { antall: number }) {
  const seter: { x: number; y: number }[] = [];
  for (const { radius: r, seter: k } of salen(antall)) {
    for (let j = 0; j < k; j++) {
      const v = k === 1 ? Math.PI / 2 : Math.PI - (j * Math.PI) / (k - 1);
      seter.push({ x: 36 + r * Math.cos(v), y: 36 - r * Math.sin(v) });
    }
  }
  return (
    <svg
      viewBox="0 0 72 40"
      width="108"
      height="60"
      role="img"
      aria-label={`${antall} seter`}
      className="block fill-trykk"
    >
      {seter.map((s, i) => (
        <circle key={i} cx={s.x.toFixed(2)} cy={s.y.toFixed(2)} r="2.1" />
      ))}
    </svg>
  );
}

function Seter({ side }: { side: Kommuneside }) {
  const s = seter(side);
  if (!s) return <Hull>Kommunestyret er ikke kartlagt</Hull>;
  return (
    <Modul
      tall={
        <MedMerke belegg={s.belegg} pastand={`${s.org.navn} har ${s.antall} medlemmer`}>
          <Stort>{tall(s.antall)}</Stort>
        </MedMerke>
      }
      etikett={`medlemmer i ${(s.org.kortnavn ?? s.org.navn).toLowerCase()}`}
      figur={<Halvsirkel antall={s.antall} />}
    />
  );
}

function Aksjeselskaper({ side }: { side: Kommuneside }) {
  const a = aksjeselskaper(side);
  if (!a) return <Hull>Eierandelene er ikke kartlagt</Hull>;
  const n = a.rader.length;
  const bredde = Math.max(1, n) * 9;
  return (
    <Modul
      tall={
        <MedMerke
          belegg={a.belegg}
          pastand={`${a.eier.navn} har oppgitt eierandel i ${n} aksjeselskaper`}
        >
          <Stort>{tall(n)}</Stort>
        </MedMerke>
      }
      etikett="aksjeselskaper med oppgitt kommunal eierandel"
      figur={
        n > 0 && (
          <svg
            viewBox={`0 0 ${bredde} 34`}
            width={Math.min(200, bredde * 1.5)}
            height="44"
            role="img"
            aria-label={`Eierandelene går fra ${prosent(a.rader[n - 1]?.andel.andel ?? 0)} til ${prosent(a.rader[0]?.andel.andel ?? 0)}`}
            className="block overflow-visible"
          >
            <line
              x1="0"
              y1="33.5"
              x2={bredde}
              y2="33.5"
              className="stroke-linje-sterk"
              strokeWidth="1"
            />
            {a.rader.map((r, i) => {
              const h = Math.max(1.5, (r.andel.andel / 100) * 32);
              return (
                <rect
                  key={r.org.key}
                  x={i * 9 + 1.5}
                  y={33 - h}
                  width="6"
                  height={h}
                  className="fill-vann"
                >
                  <title>{`${r.org.navn}: ${prosent(r.andel.andel)}`}</title>
                </rect>
              );
            })}
          </svg>
        )
      }
      meta="Kommunale foretak er ikke med. De er en del av kommunen."
    />
  );
}

function Utbytte({ side }: { side: Kommuneside }) {
  const u = utbytte(side);
  if (!u) return <Hull>Ingen utbytte i datasettet</Hull>;
  const selskap = u.selskap.kortnavn ?? u.selskap.navn;
  const deler = [...u.mottakere].sort(
    (a, b) => Number(b.org.key === u.kommunenKey) - Number(a.org.key === u.kommunenKey),
  );
  const status = u.forslag ? ", foreslått" : "";
  return (
    <Modul
      tall={
        <>
          <Stort>{millioner(u.belop)}</Stort>
          <Enhet>
            <Pastand
              tekst={`av ${millioner(u.total)}\u00a0mill.\u00a0kr${status}`}
              belegg={u.belegg}
              pastand={`${u.forslag ? "Foreslått utbytte" : "Utbytte"} fra ${u.selskap.navn} til kommunen: ${millioner(u.belop)} av ${millioner(u.total)} mill. kr`}
            />
          </Enhet>
        </>
      }
      etikett={`utbytte fra ${selskap} til kommunen${u.aar ? ` for ${u.aar}` : ""}`}
      figur={
        deler.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <div
              role="img"
              aria-label={`${millioner(u.belop)} av ${millioner(u.total)} millioner kroner går til kommunen`}
              className="flex h-2.5 w-full gap-[2px]"
            >
              {deler.map((d) => (
                <span
                  key={d.org.key}
                  title={`${d.org.navn}: ${millioner(d.belop_nok ?? 0)} mill. kr`}
                  className={cn(
                    "block h-full",
                    d.org.key === u.kommunenKey ? "bg-vann" : "bg-vann-lys",
                  )}
                  style={{ flex: d.belop_nok ?? 0 }}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2 text-[0.75rem] text-dempet">
              {deler.map((d) => (
                <span key={d.org.key} className="truncate">
                  {d.org.key === u.kommunenKey ? "Kommunen" : (d.org.kortnavn ?? d.org.navn)}
                </span>
              ))}
            </div>
          </div>
        )
      }
    />
  );
}

function Rollebytter({ side }: { side: Kommuneside }) {
  const r = rollebytter(side);
  const n = r.hendelser.length;
  return (
    <Modul
      tall={
        <MedMerke
          belegg={r.belegg}
          pastand={`${n} rollebytter i organene fra ${dato(r.fra)} til ${datoKort(r.til)}`}
        >
          <Stort>{tall(n)}</Stort>
        </MedMerke>
      }
      etikett={`rollebytter siden ${datoKort(r.fra).replace(/^0?(\d+)\.0?(\d+)\./, "$1.$2.")}`}
      figur={
        <div className="flex flex-col gap-1">
          <svg
            viewBox="0 0 200 22"
            preserveAspectRatio="none"
            width="100%"
            height="22"
            role="img"
            aria-label={`${n} rollebytter mellom ${dato(r.fra)} og sammenstillingen ${datoKort(r.til)}`}
            className="block overflow-visible"
          >
            <line
              x1="0"
              y1="20.5"
              x2="200"
              y2="20.5"
              className="stroke-linje-sterk"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="199.5"
              y1="12"
              x2="199.5"
              y2="22"
              className="stroke-trykk"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {r.merker.map((m) => (
              <line
                key={`${m.hendelse.dato}|${m.hendelse.tittel}`}
                x1={(m.x * 196 + 2).toFixed(1)}
                x2={(m.x * 196 + 2).toFixed(1)}
                y1="6"
                y2="20.5"
                className="stroke-trykk"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${dato(m.hendelse.dato, m.hendelse.presisjon)}: ${m.hendelse.tittel}`}</title>
              </line>
            ))}
          </svg>
          <div className="flex justify-between text-[0.75rem] text-dempet">
            <span>{r.fra.slice(0, 4)}</span>
            <span>Sammenstilt {datoKort(r.til)}</span>
          </div>
        </div>
      }
    />
  );
}

/** Kolonnen langs kartet. To og to under kartet, én kolonne når den står ved siden av. */
export function Randmoduler({ side }: { side: Kommuneside }) {
  return (
    <div className="grid grid-cols-2 content-start gap-x-5 gap-y-6 md:grid-cols-1 md:gap-y-5 lg:grid-cols-2 lg:gap-y-6 xl:grid-cols-1 xl:gap-y-5">
      <Seter side={side} />
      <Aksjeselskaper side={side} />
      <Utbytte side={side} />
      <Rollebytter side={side} />
    </div>
  );
}
