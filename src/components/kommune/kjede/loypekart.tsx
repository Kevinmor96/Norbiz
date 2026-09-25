// Løypekartet: kjeden som orienteringsløype over et dempet terreng
// (DESIGN.md §5.2). Står klebrig til venstre for stegene på skrivebord.
//
// Postene står i sikksakk ovenfra og ned, i samme rekkefølge som stegene i
// teksten. Plasseringen er regnet fra antall poster og betyr ingenting
// geografisk. Terrenget er kommunens eget kartblad, dempet og beskåret. Det er
// pynt, og undertekstene sier det.
//
// Etappene tegnes med en maske: den synlige streken (hel, eller stiplet for
// klage) ligger under en maske som trekkes fram med stroke-dashoffset. Da kan
// også en stiplet etappe tegnes som en strek, ikke tones inn.

import { useId, type CSSProperties } from "react";

import { MYNDIGHETNAVN } from "@/lib/navn";
import { koteId, type Terreng } from "@/lib/terreng";
import { cn } from "@/lib/utils";

import { kortnavn, POSTRADIUS, type Loype, type Post } from "./modell";
import { PostSymbol } from "./symboler";
import { ETAPPE_MS } from "./use-loype";

const B = 440;
const H = 560;
/** Postene veksler mellom to kolonner, så etappene får retning og etikettene plass. */
const KOLONNE = [96, 168] as const;
const MAKS_AVSTAND = 150;
/** Sonen for forberedende makt har mer luft over postene, der etiketten står. */
const SONE_OVER = 54;
const SONE_UNDER = 42;

interface Plassert extends Post {
  x: number;
  y: number;
}

function plasser(poster: Post[]): Plassert[] {
  const n = poster.length;
  const avstand = n > 1 ? Math.min(MAKS_AVSTAND, (H - 150) / (n - 1)) : 0;
  const start = (H - avstand * (n - 1)) / 2 + 8;
  return poster.map((p, i) => ({ ...p, x: KOLONNE[i % 2] ?? KOLONNE[0], y: start + i * avstand }));
}

/** Del navnet på ord, så ingen linje blir lengre enn `maks` tegn. */
function linjer(tekst: string, maks: number): string[] {
  const ut: string[] = [];
  let linje = "";
  for (const ord of tekst.split(" ")) {
    if (linje && (linje + " " + ord).length > maks) {
      ut.push(linje);
      linje = ord;
    } else {
      linje = linje ? `${linje} ${ord}` : ord;
    }
  }
  if (linje) ut.push(linje);
  return ut;
}

function myndighetEtikett(p: Post): string {
  if (p.form === "mangler") return "Ikke kartlagt";
  if (p.klage) return "Klage, hvis noen klager";
  return p.myndighet ? MYNDIGHETNAVN[p.myndighet] : "";
}

/** Sammenhengende rekker av innstillingssteg. Hver rekke får én sone. */
function soner(poster: Plassert[]): Plassert[][] {
  const ut: Plassert[][] = [];
  let rekke: Plassert[] = [];
  for (const p of poster) {
    if (p.forberedende) rekke.push(p);
    else if (rekke.length) {
      ut.push(rekke);
      rekke = [];
    }
  }
  if (rekke.length) ut.push(rekke);
  return ut;
}

type Strekstil = CSSProperties & Record<`--${string}`, string | number>;

function Terrengbakgrunn({ terreng }: { terreng: Terreng | null }) {
  if (!terreng) {
    // Reservevarianten: rutenett, som kartbladet uten terrengfil.
    return (
      <g className="stroke-linje" strokeWidth={1}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={`y${i}`} x1="0" x2={B} y1={i * 70} y2={i * 70} />
        ))}
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={`x${i}`} y1="0" y2={H} x1={i * 73} x2={i * 73} />
        ))}
      </g>
    );
  }
  // Annenhver kote og tellekurvene holder: bakgrunnen skal leses som terreng,
  // ikke telles.
  const koter = terreng.koter.filter((k, i) => k.tellekurve || i % 2 === 0);
  // Stiene hentes med <use> fra terrengfila, og vector-effect arves ikke inn i
  // dem. Streken settes derfor i terrengets enheter, delt på skalaen `slice`
  // gir, så den blir like tynn som før i løypekartets egne enheter.
  const skala = Math.max(B / terreng.bredde, H / terreng.hoyde);
  const strek = (px: number) => px / skala;
  return (
    <svg
      x="0"
      y="0"
      width={B}
      height={H}
      viewBox={`0 0 ${terreng.bredde} ${terreng.hoyde}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <use href={`${terreng.fil}#hav`} className="fill-vann-lys opacity-70" />
      {koter.map((k) => (
        <use
          key={k.hoyde}
          href={`${terreng.fil}#${koteId(k.hoyde)}`}
          className="fill-none stroke-kote"
          strokeWidth={strek(k.tellekurve ? 1.3 : 0.9)}
          opacity={k.tellekurve ? 0.42 : 0.3}
        />
      ))}
      <use
        href={`${terreng.fil}#kyst`}
        className="fill-none stroke-vann"
        strokeWidth={strek(1.2)}
        opacity={0.45}
      />
    </svg>
  );
}

export function Loypekart({
  loype,
  terreng,
  aktiv,
  tegnet,
  forsinkelse,
  className,
}: {
  loype: Loype;
  terreng: Terreng | null;
  aktiv: number;
  tegnet: number;
  forsinkelse: Record<number, number>;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const poster = plasser(loype.poster);
  const beskrivelse =
    `Løypekart for ${loype.tittel.toLowerCase()}: ` +
    poster
      .map((p) =>
        p.org
          ? `${p.nr}. ${kortnavn(p.org)}, ${myndighetEtikett(p).toLowerCase()}`
          : "et steg som ikke er kartlagt",
      )
      .join("; ") +
    ". Stegene står som liste ved siden av kartet.";

  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <div className="relative border border-linje-sterk bg-papir">
        <svg
          viewBox={`0 0 ${B} ${H}`}
          role="img"
          aria-label={beskrivelse}
          className="block h-auto w-full"
        >
          <Terrengbakgrunn terreng={terreng} />

          {soner(poster).map((rekke) => {
            const topp = Math.min(...rekke.map((p) => p.y)) - SONE_OVER;
            const bunn = Math.max(...rekke.map((p) => p.y)) + SONE_UNDER;
            return (
              <g key={`sone-${rekke[0]?.indeks}`}>
                <rect
                  x={14}
                  y={topp}
                  width={B - 28}
                  height={bunn - topp}
                  className="fill-signal stroke-signal [fill-opacity:0.06] [stroke-opacity:0.5]"
                  strokeWidth={1}
                />
                <text
                  x={26}
                  y={topp + 19}
                  className="utsparing-svg fill-signal-tekst text-[11px] font-bold tracking-[0.14em] uppercase"
                >
                  Forberedende makt
                </text>
              </g>
            );
          })}

          {poster.map((p, i) => {
            const fra = poster[i - 1];
            if (!fra) return null;
            const dx = p.x - fra.x;
            const dy = p.y - fra.y;
            const l = Math.hypot(dx, dy) || 1;
            const r0 = POSTRADIUS[fra.form] + 3;
            const r1 = POSTRADIUS[p.form] + 3;
            const ax = fra.x + (dx / l) * r0;
            const ay = fra.y + (dy / l) * r0;
            const bx = p.x - (dx / l) * r1;
            const by = p.y - (dy / l) * r1;
            const lengde = Math.hypot(bx - ax, by - ay);
            const ukjent = p.form === "mangler";
            const stiplet = p.klage || ukjent ? "7 6" : undefined;
            if (ukjent) {
              // Etappen til en post som ikke er kartlagt, er ikke en del av
              // saken vi kjenner. Den står i kote og tegnes aldri i signal.
              return (
                <line
                  key={`etappe-${i}`}
                  x1={ax}
                  y1={ay}
                  x2={bx}
                  y2={by}
                  className="stroke-kote"
                  strokeWidth={2}
                  strokeDasharray={stiplet}
                />
              );
            }
            const erTegnet = i <= tegnet;
            const stil: Strekstil = {
              strokeDasharray: lengde,
              strokeDashoffset: erTegnet ? 0 : lengde,
              transitionDelay: `${forsinkelse[i] ?? 0}ms`,
              transitionDuration: `${ETAPPE_MS}ms`,
            };
            return (
              <g key={`etappe-${i}`}>
                <mask
                  id={`${id}-maske-${i}`}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={B}
                  height={H}
                >
                  <line
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke="white"
                    strokeWidth={8}
                    className="transition-[stroke-dashoffset] ease-(--ease-ut)"
                    style={stil}
                  />
                </mask>
                {/* Løypa som gjenstår: svak, så leseren ser hvor saken går. */}
                <line
                  x1={ax}
                  y1={ay}
                  x2={bx}
                  y2={by}
                  className="stroke-signal [stroke-opacity:0.3]"
                  strokeWidth={2}
                  strokeDasharray={stiplet}
                />
                <line
                  x1={ax}
                  y1={ay}
                  x2={bx}
                  y2={by}
                  className="stroke-signal"
                  strokeWidth={3.2}
                  strokeDasharray={stiplet}
                  mask={`url(#${id}-maske-${i})`}
                />
              </g>
            );
          })}

          {poster.map((p) => {
            const navn = p.org ? kortnavn(p.org) : "Ikke kartlagt";
            // Etiketten står til høyre for posten. Posten i høyre kolonne har
            // mindre plass, så navnet brytes kortere der.
            const maks = p.x > KOLONNE[0] ? 19 : 24;
            const navnelinjer = p.org ? linjer(navn, maks) : [];
            const alle = navnelinjer.length + 1;
            const tx = p.x + POSTRADIUS[p.form] + 14;
            const ty = p.y - (alle * 17) / 2 + 13;
            const erAktiv = p.indeks === aktiv;
            return (
              <g key={`post-${p.indeks}`}>
                <PostSymbol
                  form={p.form}
                  x={p.x}
                  y={p.y}
                  aktiv={erAktiv && p.form !== "mangler"}
                  passert={p.indeks < aktiv}
                />
                <text x={tx} y={ty} className="utsparing-svg fill-trykk">
                  {navnelinjer.map((linje, j) => (
                    <tspan
                      key={`${j}-${linje}`}
                      x={tx}
                      dy={j === 0 ? 0 : 17}
                      className="text-[14.5px] font-[650] [font-stretch:90%]"
                    >
                      {j === 0 && p.nr !== null && (
                        <tspan className="fill-signal-tekst font-extrabold">{`${p.nr} `}</tspan>
                      )}
                      {linje}
                    </tspan>
                  ))}
                  <tspan
                    x={tx}
                    dy={navnelinjer.length ? 17 : 0}
                    className={cn(
                      "text-[12.5px] [font-stretch:92%]",
                      p.form === "mangler" ? "fill-kote-tekst font-semibold" : "fill-dempet",
                    )}
                  >
                    {myndighetEtikett(p)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="text-[0.75rem] leading-[1.4] text-dempet">
        Løypa følger saken. Terrenget er pynt, ikke plassering.
      </figcaption>
    </figure>
  );
}
