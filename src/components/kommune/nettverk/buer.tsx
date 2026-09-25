// Buediagrammet på mobil (DESIGN.md §5.5, grepet fra retning A). Organene står
// på én loddrett linje, og hver person er en bue mellom organene sine. Det er
// en egen form for smal skjerm, ikke en nedskalert graf: teksten har full
// størrelse, og diagrammet vokser i høyden i stedet for å krympe.
//
// Rekkefølgen på linja regnes fra koblingene (bredde først fra organet med
// flest koblinger), så buene blir korte. Navnene står i en egen kolonne til
// høyre for buene, med en tynn ledelinje til toppen av buen sin.

import { Kildemerke } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import { splittSisteOrd } from "@/lib/format";
import type { Grafmodell } from "@/lib/graf/modell";
import { cn } from "@/lib/utils";

import { LENKESTIL } from "../pengene/felles";

const RAD = 56;
const X0 = 8;
const LUFT_NAVN = 16;

interface Bue {
  id: string;
  person: string;
  navn: string;
  rader: number[];
  maa: boolean;
  belegg: Grafmodell["personkanter"][number]["belegg"];
  pastand: string;
  bx: number;
}

/** Organene i en rekkefølge som gir korte buer: bredde først, komponent for komponent. */
function rekkefolge(modell: Grafmodell): string[] {
  const nabo = new Map<string, Set<string>>();
  for (const k of modell.personkanter) {
    nabo.set(k.fra, (nabo.get(k.fra) ?? new Set()).add(k.til));
    nabo.set(k.til, (nabo.get(k.til) ?? new Set()).add(k.fra));
  }
  const alle = [...nabo.keys()].sort();
  const grad = (k: string) => nabo.get(k)?.size ?? 0;
  const sett = new Set<string>();
  const komponenter: string[][] = [];
  for (const start of [...alle].sort((a, b) => grad(b) - grad(a) || (a < b ? -1 : 1))) {
    if (sett.has(start)) continue;
    const ko: string[] = [];
    const ko2 = [start];
    sett.add(start);
    while (ko2.length) {
      const n = ko2.shift() as string;
      ko.push(n);
      for (const m of [...(nabo.get(n) ?? [])].sort(
        (a, b) => grad(b) - grad(a) || (a < b ? -1 : 1),
      )) {
        if (!sett.has(m)) {
          sett.add(m);
          ko2.push(m);
        }
      }
    }
    komponenter.push(ko);
  }
  komponenter.sort((a, b) => b.length - a.length || ((a[0] ?? "") < (b[0] ?? "") ? -1 : 1));
  return komponenter.flat();
}

export function Buediagram({
  modell,
  aktiv,
  settAktiv,
}: {
  modell: Grafmodell;
  aktiv: string | null;
  settAktiv: (person: string | null) => void;
}) {
  const rekke = rekkefolge(modell);
  const rad = new Map(rekke.map((k, i) => [k, i]));
  const organ = new Map(modell.noder.map((n) => [n.organ.key, n.organ]));
  const y = (i: number) => RAD / 2 + i * RAD;

  const buer: Bue[] = [
    ...modell.personkanter
      .filter((k) => !k.knute)
      .map((k) => ({
        id: k.id,
        person: k.person.key,
        navn: k.person.navn,
        rader: [rad.get(k.fra) ?? 0, rad.get(k.til) ?? 0].sort((a, b) => a - b),
        maa: k.maaVerifiseres,
        belegg: k.belegg,
        pastand: k.pastand,
        bx: 0,
      })),
    ...modell.knuter.map((k) => ({
      id: k.id,
      person: k.person.key,
      navn: k.person.navn,
      rader: k.organer.map((o) => rad.get(o) ?? 0).sort((a, b) => a - b),
      maa: k.maaVerifiseres,
      belegg: k.belegg,
      pastand: k.pastand,
      bx: 0,
    })),
  ];
  // Korte buer innerst. En bue som overlapper buer som alt er lagt, legges
  // utenfor dem, så ingen buer ligger oppå hverandre.
  buer.sort(
    (a, b) =>
      (a.rader[a.rader.length - 1] ?? 0) -
        (a.rader[0] ?? 0) -
        ((b.rader[b.rader.length - 1] ?? 0) - (b.rader[0] ?? 0)) || (a.id < b.id ? -1 : 1),
  );
  const lagt: Bue[] = [];
  for (const b of buer) {
    const fra = b.rader[0] ?? 0;
    const til = b.rader[b.rader.length - 1] ?? 0;
    const under = lagt.filter(
      (l) => (l.rader[0] ?? 0) < til && (l.rader[l.rader.length - 1] ?? 0) > fra,
    );
    b.bx = Math.max(24 + (til - fra) * 6, ...under.map((l) => l.bx + 13));
    lagt.push(b);
  }

  const apex = (b: Bue) => X0 + 0.75 * b.bx;
  const xNavn = Math.max(0, ...buer.map(apex)) + LUFT_NAVN;
  // Navnene står ved toppen av buen sin (den første buen, for en person i
  // flere enn to organer), skjøvet fra hverandre når de ville kollidert.
  const navn = buer
    .map((b) => ({ b, midt: (y(b.rader[0] ?? 0) + y(b.rader[1] ?? 0)) / 2, yN: 0 }))
    .sort((a, c) => a.midt - c.midt || (a.b.id < c.b.id ? -1 : 1));
  let forrige = -Infinity;
  for (const n of navn) {
    n.yN = Math.max(n.midt, forrige + 32);
    forrige = n.yN;
  }
  const hoyde = Math.max(rekke.length * RAD, forrige + 20);

  const sti = (b: Bue) => {
    let d = "";
    for (let i = 0; i < b.rader.length - 1; i++) {
      const y1 = y(b.rader[i] ?? 0);
      const y2 = y(b.rader[i + 1] ?? 0);
      d += `${i === 0 ? `M${X0} ${y1}` : ""}C${X0 + b.bx} ${y1} ${X0 + b.bx} ${y2} ${X0} ${y2}`;
    }
    return d;
  };

  return (
    <div
      role="group"
      aria-label="Buediagram. Organene står på en linje, og hver bue er en person med roller i organene buen går mellom. Samme innhold står i lista."
      className="grid grid-cols-[minmax(0,8.25rem)_minmax(0,1fr)] gap-x-2"
      onPointerLeave={() => settAktiv(null)}
    >
      <ol style={{ height: hoyde }}>
        {rekke.map((k) => {
          const o = organ.get(k);
          return (
            <li
              key={k}
              className="etikett flex items-center justify-end text-right text-[0.8125rem] leading-[1.2] font-semibold"
              style={{ height: RAD }}
            >
              {o ? <OrganLenke org={o} kort className={cn(LENKESTIL, "line-clamp-2")} /> : k}
            </li>
          );
        })}
      </ol>
      <div className="relative min-w-0 overflow-x-clip" style={{ height: hoyde }}>
        <svg
          width={xNavn}
          height={hoyde}
          aria-hidden="true"
          className="absolute top-0 left-0 overflow-visible"
        >
          <line
            x1={X0}
            x2={X0}
            y1={y(0)}
            y2={y(Math.max(0, rekke.length - 1))}
            className="stroke-linje-sterk"
            strokeWidth="1"
          />
          {navn.map(({ b, midt, yN }) => {
            const av = aktiv !== null && aktiv !== b.person;
            return (
              <g
                key={b.id}
                className={cn("stroke-trykk transition-opacity duration-200", av && "opacity-20")}
              >
                <path
                  d={sti(b)}
                  fill="none"
                  strokeWidth={aktiv === b.person ? 2.5 : 1.75}
                  strokeDasharray={b.maa ? "5 4" : undefined}
                />
                <path
                  d={`M${apex(b) + 3} ${midt}L${xNavn - 12} ${midt}L${xNavn - 5} ${yN}`}
                  fill="none"
                  strokeWidth="1"
                  className="stroke-linje-sterk"
                />
              </g>
            );
          })}
          {rekke.map((k, i) => (
            <rect
              key={k}
              x={X0 - 5}
              y={y(i) - 5}
              width="10"
              height="10"
              className="fill-trykk stroke-papir"
              strokeWidth="2"
            />
          ))}
        </svg>
        {navn.map(({ b, yN }) => (
          <p
            key={b.id}
            className={cn(
              "etikett absolute -translate-y-1/2 text-[0.8125rem] leading-[1.15] font-semibold transition-opacity duration-200",
              aktiv !== null && aktiv !== b.person && "opacity-35",
            )}
            // Et langt navn brytes før det når kanten. Merket følger siste ord.
            style={{ left: xNavn, top: yN, maxWidth: `calc(100% - ${xNavn}px)` }}
            onPointerEnter={() => settAktiv(b.person)}
            onFocus={() => settAktiv(b.person)}
            onBlur={() => settAktiv(null)}
          >
            {splittSisteOrd(b.navn)[0]}
            <span className="whitespace-nowrap">
              {splittSisteOrd(b.navn)[1]}
              <Kildemerke belegg={b.belegg} pastand={b.pastand} />
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
