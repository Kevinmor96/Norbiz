// Institusjonsgrafen på skrivebord (DESIGN.md §5.5). Noden er organet, og
// personen er kanten, med et navneskilt som bærer kildemerket. En kant er
// stiplet når minst én av rollene den bygger på, må verifiseres.
//
// Koordinatene kommer fra src/lib/graf/layout.ts og regnes likt på serveren og
// i nettleseren. Kantene er SVG. Organnavnene, skiltene og kildemerkene er
// HTML oppå, plassert i prosent av lerretet pluss en fast pikselavstand. Da
// har teksten alltid samme størrelse, og grafen kan bare bli større enn
// lerretet den er regnet på, aldri mindre. Etiketter som ikke kolliderer på
// lerretet, kolliderer derfor ikke på skjermen heller.
//
// Grafen legger seg én gang (600 ms) når den kommer i bildet: alt står litt
// nærmere midten og glir ut til plassen sin. I ro og med redusert bevegelse
// står den ferdig.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Kildemerke } from "@/components/maktkart/kildemerke";
import { NODE_RADIUS, type KantUt, type Oppsett } from "@/lib/graf/layout";
import { andelTekst, GRAFSKRIFT, type Grafmodell } from "@/lib/graf/modell";
import { prosent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { OrganLenke } from "../pengene/felles";
import { useSpillEnGang, type Fase } from "../pengene/spill-en-gang";

/** Hvor mye nærmere midten grafen starter når den legger seg. */
const START = 0.9;
const VARIGHET = 600;

/** 1 i ro. Fra START til 1 når grafen legger seg, med samme kurve som --ease-ut. */
function useLegg(fase: Fase): number {
  const [k, settK] = useState(1);
  useEffect(() => {
    if (fase === "ro") return settK(1);
    if (fase === "klar") return settK(START);
    let ramme = 0;
    const t0 = performance.now();
    const steg = (t: number) => {
      const p = Math.min(1, (t - t0) / VARIGHET);
      settK(START + (1 - START) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) ramme = requestAnimationFrame(steg);
    };
    ramme = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(ramme);
  }, [fase]);
  return k;
}

/** Pilspissen på en eierkant: like utenfor noden den peker på. */
function pil(k: KantUt): string | null {
  const p = k.punkter;
  const slutt = p[p.length - 1];
  if (!slutt) return null;
  let i = p.length - 2;
  let q = p[i];
  while (q && i > 0 && Math.hypot(slutt[0] - q[0], slutt[1] - q[1]) < NODE_RADIUS + 5) {
    i -= 1;
    q = p[i];
  }
  const forrige = p[Math.max(0, i - 1)];
  if (!q || !forrige) return null;
  const vx = q[0] - forrige[0];
  const vy = q[1] - forrige[1];
  const l = Math.hypot(vx, vy) || 1;
  const ux = vx / l;
  const uy = vy / l;
  const s = 6.5;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `M${r(q[0] - ux * s - uy * s * 0.6)} ${r(q[1] - uy * s + ux * s * 0.6)}L${r(q[0])} ${r(q[1])}L${r(q[0] - ux * s + uy * s * 0.6)} ${r(q[1] - uy * s - ux * s * 0.6)}`;
}

export function Nettverksgraf({
  modell,
  oppsett: begge,
  visEierskap,
  aktiv,
  settAktiv,
}: {
  modell: Grafmodell;
  oppsett: Oppsett;
  visEierskap: boolean;
  aktiv: string | null;
  settAktiv: (person: string | null) => void;
}) {
  const [ref, fase] = useSpillEnGang<HTMLDivElement>();
  const k = useLegg(fase);
  // Nodene står likt i begge lagene. Kantene og skiltene er satt for laget som vises.
  const oppsett = visEierskap ? begge.medEierskap : begge.personer;
  const { bredde: B, hoyde: H } = oppsett;
  const cx = B / 2;
  const cy = H / 2;
  const X = (x: number) => cx + (x - cx) * k;
  const Y = (y: number) => cy + (y - cy) * k;
  const px = (x: number) => `${((X(x) / B) * 100).toFixed(3)}%`;
  const py = (y: number) => `${((Y(y) / H) * 100).toFixed(3)}%`;

  const noder = new Map(modell.noder.map((n) => [n.organ.key, n]));
  const personkant = new Map(modell.personkanter.map((p) => [p.id, p]));
  const knute = new Map(modell.knuter.map((p) => [p.id, p]));
  const eierkant = new Map(modell.eierkanter.map((e) => [e.id, e]));

  // Hvem kanten tilhører, for markeringen når leseren peker på et navn.
  const eierAv = (kant: KantUt) =>
    kant.knute ? (knute.get(kant.knute)?.person.key ?? null) : (personkant.get(kant.id)?.person.key ?? null);
  const maa = (kant: KantUt) =>
    kant.knute
      ? Boolean(knute.get(kant.knute)?.maaVerifiseres)
      : kant.lag === "eier"
        ? Boolean(eierkant.get(kant.id)?.maaVerifiseres)
        : Boolean(personkant.get(kant.id)?.maaVerifiseres);

  // Organene personen som er pekt på sitter i, så resten kan dempes.
  const aktiveOrganer = new Set<string>();
  if (aktiv) {
    for (const p of modell.personkanter) {
      if (p.person.key !== aktiv) continue;
      aktiveOrganer.add(p.fra);
      aktiveOrganer.add(p.til);
    }
  }
  const dempet = (person: string | null) => aktiv !== null && person !== aktiv;

  const personkanter = oppsett.kanter.filter((e) => e.lag === "person");
  const eierkanter = oppsett.kanter.filter((e) => e.lag === "eier");

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Nettverksgraf. Punktene er organer, og strekene er personer med rolle i begge. Samme innhold står i lista under grafen."
      className="relative w-full bg-flate"
      style={{ aspectRatio: `${B} / ${H}` }}
      onPointerLeave={() => settAktiv(null)}
    >
      <svg
        viewBox={`0 0 ${B} ${H}`}
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
          {visEierskap && (
            <g className="stroke-vann">
              {eierkanter.map((e) => {
                const spiss = pil(e);
                return (
                  <g key={e.id} className={cn("transition-opacity duration-200", aktiv && "opacity-25")}>
                    <path
                      d={e.sti}
                      fill="none"
                      strokeWidth="1.25"
                      strokeDasharray={maa(e) ? "3 3" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                    {spiss && (
                      <path
                        d={spiss}
                        fill="none"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}
          <g className="stroke-trykk">
            {personkanter.map((e) => {
              const person = eierAv(e);
              return (
                <path
                  key={e.id}
                  d={e.sti}
                  fill="none"
                  strokeWidth={person && person === aktiv ? 2.75 : 1.75}
                  strokeDasharray={maa(e) ? "6 4" : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={cn("transition-opacity duration-200", dempet(person) && "opacity-15")}
                />
              );
            })}
          </g>
        </g>
      </svg>

      {/* Nodene: et lite kvadrat i trykkfarge med papirring, og navnet som lenke. */}
      {oppsett.noder.map((n) => {
        const node = noder.get(n.key);
        if (!node) return null;
        if (node.bareEierskap && !visEierskap) return null;
        const b = n.etikett.boks;
        const side = n.etikett.side;
        const juster = side.startsWith("v") ? "slutt" : side === "u" || side === "o" ? "midt" : "start";
        const dx = juster === "slutt" ? b.x + b.b - n.x : juster === "midt" ? b.x + b.b / 2 - n.x : b.x - n.x;
        const av = aktiv !== null && !aktiveOrganer.has(n.key);
        const stil: CSSProperties = {
          left: `calc(${px(n.x)} + ${dx.toFixed(1)}px)`,
          top: `calc(${py(n.y)} + ${(b.y - n.y).toFixed(1)}px)`,
          transform: juster === "slutt" ? "translateX(-100%)" : juster === "midt" ? "translateX(-50%)" : undefined,
          lineHeight: `${GRAFSKRIFT.organLinje}px`,
          fontSize: `${GRAFSKRIFT.organ}px`,
        };
        return (
          <div key={n.key}>
            <span
              aria-hidden="true"
              className={cn(
                "absolute size-[11px] -translate-1/2 border-2 border-flate bg-trykk transition-opacity duration-200 box-content",
                node.bareEierskap && "bg-vann",
                av && "opacity-35",
              )}
              style={{ left: px(n.x), top: py(n.y) }}
            />
            <p
              className={cn(
                "etikett absolute font-semibold whitespace-nowrap transition-opacity duration-200",
                juster === "slutt" ? "text-right" : juster === "midt" ? "text-center" : "text-left",
                av && "opacity-35",
              )}
              style={stil}
            >
              <OrganLenke org={node.organ} className="decoration-transparent hover:decoration-signal">
                {node.linjer.map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </OrganLenke>
            </p>
          </div>
        );
      })}

      {/* Navneskiltene på kantene. */}
      {oppsett.kanter.map((e) => {
        if (!e.skilt) return null;
        if (e.lag === "eier") {
          if (!visEierskap) return null;
          const ek = eierkant.get(e.id);
          if (!ek) return null;
          const fra = noder.get(ek.fra)?.organ.navn ?? ek.fra;
          const til = noder.get(ek.til)?.organ.navn ?? ek.til;
          return (
            <span
              key={e.id}
              className={cn(
                "etikett absolute inline-flex h-5 -translate-1/2 items-center border border-vann bg-flate px-1.5 text-[12px] font-semibold whitespace-nowrap transition-opacity duration-200",
                aktiv && "opacity-25",
              )}
              style={{ left: px(e.skilt.x), top: py(e.skilt.y) }}
            >
              {andelTekst(ek.andel)}
              <Kildemerke
                belegg={ek.eierandel.belegg}
                pastand={
                  ek.andel !== null
                    ? `${fra} eier ${prosent(ek.andel)} av ${til}`
                    : `${fra} er eier i ${til}. Andelen er ikke oppgitt`
                }
              />
            </span>
          );
        }
        const p = personkant.get(e.id);
        if (!p) return null;
        return (
          <Skilt
            key={e.id}
            navn={p.person.navn}
            x={px(e.skilt.x)}
            y={py(e.skilt.y)}
            dempet={dempet(p.person.key)}
            onAktiv={(pa) => settAktiv(pa ? p.person.key : null)}
          >
            <Kildemerke belegg={p.belegg} pastand={p.pastand} />
          </Skilt>
        );
      })}
      {oppsett.knuter.map((kn) => {
        const p = knute.get(kn.id);
        if (!p) return null;
        return (
          <Skilt
            key={kn.id}
            navn={p.person.navn}
            x={px(kn.x)}
            y={py(kn.y)}
            dempet={dempet(p.person.key)}
            onAktiv={(pa) => settAktiv(pa ? p.person.key : null)}
          >
            <Kildemerke belegg={p.belegg} pastand={p.pastand} />
          </Skilt>
        );
      })}
    </div>
  );
}

function Skilt({
  navn,
  x,
  y,
  dempet,
  onAktiv,
  children,
}: {
  navn: string;
  x: string;
  y: string;
  dempet: boolean;
  onAktiv: (pa: boolean) => void;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "etikett absolute inline-flex h-6 -translate-1/2 items-center border border-trykk bg-flate pr-1.5 pl-2 font-semibold whitespace-nowrap transition-opacity duration-200",
        dempet && "opacity-25",
      )}
      style={{ left: x, top: y, fontSize: `${GRAFSKRIFT.skilt}px` }}
      onPointerEnter={() => onAktiv(true)}
      onFocus={() => onAktiv(true)}
      onBlur={() => onAktiv(false)}
    >
      {navn}
      {children}
    </span>
  );
}
