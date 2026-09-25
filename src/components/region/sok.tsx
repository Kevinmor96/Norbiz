// Søket i hele regionen: fylker, kommuner, organer og personer i roller.
//
// Kommunene og fylkene står alt på siden, så de søkes i nettleseren med de
// samme reglene som datalaget (`sokI` i src/lib/data/sok.ts). Organene og
// rollene er for mange til å sendes med siden. De hentes fra serveren med en
// serverfunksjon, og i den statiske eksporten, der det ikke finnes noen
// server, fra søkeindeksen bygget ved eksporten (/data/sokeindeks.json).
//
// Institusjon først: en person er aldri et treff alene. Treffet viser rollen og
// organet, og lenken går til organet.

import { useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RolleIOrgan, SokKommune, SokOrgan, Sokeresultat } from "@/lib/data";
import { normaliser, sokI, type Sokegrunnlag } from "@/lib/data/sok";
import { antall } from "@/lib/format";
import { NIVAANAVN } from "@/lib/navn";
import { STATISK } from "@/lib/statisk";
import { cn } from "@/lib/utils";

import { offisielt } from "./navn";
import type { FylkeIRegion, KommuneIRegion } from "./typer";

const GRENSE = 6;

export const sokServer = createServerFn({ method: "GET" })
  .validator((d: { q: string }) => ({ q: String(d?.q ?? "").slice(0, 100) }))
  .handler(async ({ data }) => {
    const { sokIRegion } = await import("./last");
    return sokIRegion(data.q, GRENSE);
  });

/** Søkeindeksen fra den statiske eksporten, hentet én gang, ved første søk. */
let statiskIndeks: Promise<Sokegrunnlag> | null = null;
async function sokStatisk(q: string): Promise<Sokeresultat> {
  statiskIndeks ??= fetch("/data/sokeindeks.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Søkeindeksen svarte ${r.status}`);
      return r.json() as Promise<Sokegrunnlag>;
    })
    .catch((feil: unknown) => {
      // Et brudd i nettet skal ikke låse søket til neste sidelasting.
      statiskIndeks = null;
      throw feil;
    });
  return sokI(await statiskIndeks, q, GRENSE);
}

/**
 * Søket over hele regionen: serverfunksjonen, og søkeindeksen i den statiske
 * eksporten, som ikke har noen server. Kommunesøket bruker det samme. En feil
 * på serveren vises som en feil; søkeindeksen finnes bare i eksporten.
 */
export function sokRegionen(q: string): Promise<Sokeresultat> {
  return STATISK ? sokStatisk(q) : sokServer({ data: { q } });
}

type Treff =
  | { type: "fylke"; id: string; fylke: FylkeIRegion }
  | { type: "kommune"; id: string; kommune: SokKommune }
  | { type: "organ"; id: string; organ: SokOrgan }
  | { type: "rolle"; id: string; rolle: RolleIOrgan };

function Symbol({ type }: { type: Treff["type"] }) {
  // Fylke og kommune: grenseflate. Organ: rute (institusjonen). Rolle: prikk i rute.
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      className="mt-1 shrink-0 text-trykk"
    >
      {type === "fylke" || type === "kommune" ? (
        <path
          d="M2 4.5 6 1.5l6 2.5-1 6-5 2.5-4-3Z"
          fill={type === "fylke" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <rect
            x="1.5"
            y="1.5"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          {type === "rolle" && <circle cx="7" cy="7" r="2.2" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}

export function Regionsok({
  kommuner,
  fylker,
  regionnavn,
  className,
}: {
  kommuner: KommuneIRegion[];
  fylker: FylkeIRegion[];
  /** Regionens navn fra regionregisteret, til etiketten skjermlesere hører. */
  regionnavn: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const [q, settQ] = useState("");
  const [aapen, settAapen] = useState(false);
  const [svar, settSvar] = useState<{ q: string; r: Sokeresultat | null; feil: boolean } | null>(
    null,
  );
  const felt = useRef<HTMLInputElement>(null);

  // Kommunene søkes lokalt, med datalagets regler, så de kommer uten ventetid.
  const lokalt = useMemo<Sokegrunnlag>(
    () => ({
      kommuner: kommuner.map((k) => ({
        kommunenr: k.kommunenr,
        navn: k.navn,
        navn_offisielt: k.navn_offisielt,
        slug: k.slug,
        fylkesnr: k.fylkesnr,
        har_datasett: k.datasett !== null,
      })),
      organer: [],
      roller: [],
    }),
    [kommuner],
  );
  const fylkeAv = useMemo(() => new Map(fylker.map((f) => [f.fylkesnr, f])), [fylker]);
  const kommunenavn = useMemo(
    () => new Map(kommuner.map((k) => [k.kommunenr, k.navn])),
    [kommuner],
  );

  const sporring = q.trim();
  useEffect(() => {
    if (normaliser(sporring).length < 2) {
      settSvar(null);
      return;
    }
    let avbrutt = false;
    const t = window.setTimeout(async () => {
      let r: Sokeresultat | null = null;
      let feil = false;
      try {
        r = await sokRegionen(sporring);
      } catch {
        feil = true;
      }
      if (!avbrutt) settSvar({ q: sporring, r, feil });
    }, 140);
    return () => {
      avbrutt = true;
      window.clearTimeout(t);
    };
  }, [sporring]);

  const treff = useMemo<Treff[]>(() => {
    const n = normaliser(sporring);
    if (n.length < 2) return [];
    const ut: Treff[] = [];
    for (const f of fylker) {
      if (normaliser(`${f.navn_offisielt} ${f.navn}`).includes(n)) {
        ut.push({ type: "fylke", id: `fylke:${f.fylkesnr}`, fylke: f });
      }
    }
    for (const k of sokI(lokalt, sporring, GRENSE).kommuner.treff) {
      ut.push({ type: "kommune", id: `kommune:${k.kommunenr}`, kommune: k });
    }
    const r = svar?.q === sporring ? svar.r : null;
    for (const o of r?.organer.treff ?? [])
      ut.push({ type: "organ", id: `organ:${o.key}`, organ: o });
    for (const x of r?.roller.treff ?? []) {
      ut.push({ type: "rolle", id: `rolle:${x.org.key}:${x.person.key}:${x.rolletype}`, rolle: x });
    }
    return ut;
  }, [sporring, fylker, lokalt, svar]);

  const venter = normaliser(sporring).length >= 2 && svar?.q !== sporring;
  const vis = aapen && normaliser(sporring).length >= 2;
  const mer =
    svar?.q === sporring && svar.r
      ? Math.max(0, svar.r.organer.antall - svar.r.organer.treff.length) +
        Math.max(0, svar.r.roller.antall - svar.r.roller.treff.length)
      : 0;

  const velg = (t: Treff) => {
    settAapen(false);
    if (t.type === "fylke") void navigate({ to: "/fylke/$slug", params: { slug: t.fylke.slug } });
    else if (t.type === "kommune") {
      const k = t.kommune;
      if (k.har_datasett) void navigate({ to: "/kommune/$slug", params: { slug: k.slug } });
      else {
        const f = fylkeAv.get(k.fylkesnr);
        void navigate({
          to: "/fylke/$slug",
          params: { slug: f?.slug ?? "" },
          hash: `k-${k.kommunenr}`,
        });
      }
    } else if (t.type === "organ")
      void navigate({ to: "/organ/$key", params: { key: t.organ.key } });
    else void navigate({ to: "/organ/$key", params: { key: t.rolle.org.key } });
  };

  const linjer = (t: Treff): [string, string] => {
    switch (t.type) {
      case "fylke":
        return [
          offisielt(t.fylke.navn_offisielt),
          `Fylke, ${antall(t.fylke.antall_kommuner, "kommune", "kommuner")}`,
        ];
      case "kommune": {
        const f = fylkeAv.get(t.kommune.fylkesnr);
        return [
          offisielt(t.kommune.navn_offisielt),
          `Kommune i ${f?.navn ?? "fylket"}${t.kommune.har_datasett ? "" : ", ikke kartlagt ennå"}`,
        ];
      }
      case "organ": {
        const sted = t.organ.kommunenr ? kommunenavn.get(t.organ.kommunenr) : undefined;
        return [
          t.organ.navn,
          [
            NIVAANAVN[t.organ.nivaa],
            t.organ.kortnavn && t.organ.kortnavn !== t.organ.navn ? t.organ.kortnavn : null,
            sted,
          ]
            .filter(Boolean)
            .join(", "),
        ];
      }
      case "rolle":
        return [
          t.rolle.person.navn,
          `${t.rolle.tittel}, ${t.rolle.org.kortnavn ?? t.rolle.org.navn}`,
        ];
    }
  };

  return (
    <div className={cn("relative w-full max-w-[30rem]", className)}>
      {/* cmdk lager sin egen skjulte etikett. Denne er den synlige. */}
      <p
        aria-hidden="true"
        className="mb-2 cursor-default text-[0.9375rem] font-semibold"
        onClick={() => felt.current?.focus()}
      >
        Finn en kommune, et organ eller en person
      </p>
      <CommandPrimitive
        shouldFilter={false}
        loop
        label={`Søk i kommuner, organer og roller i ${regionnavn}`}
        className="relative"
        onKeyDown={(e) => {
          if (e.key === "Escape") settAapen(false);
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-dempet"
            aria-hidden="true"
          />
          <CommandPrimitive.Input
            ref={felt}
            value={q}
            onValueChange={(v) => {
              settQ(v);
              settAapen(true);
            }}
            onFocus={() => settAapen(true)}
            onBlur={() => settAapen(false)}
            placeholder="Kommune, organ eller navn"
            className={cn(
              "h-[52px] w-full appearance-none border border-trykk bg-flate pr-4 pl-11 text-base text-trykk",
              "placeholder:text-dempet focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal",
            )}
          />
        </div>
        <CommandPrimitive.List
          className={cn(
            "absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[min(26rem,60dvh)] overflow-y-auto border border-trykk bg-flate",
            !vis && "hidden",
          )}
        >
          {vis && !venter && treff.length === 0 && (
            <p className="px-4 py-3.5 text-[0.875rem] leading-[1.45] text-dempet">
              Ingen treff på «{sporring}». Søket dekker de {kommuner.length} kommunene i regionen,
              og organene og rollene i datasettene.
            </p>
          )}
          {vis &&
            treff.map((t) => {
              const [tittel, under] = linjer(t);
              return (
                <CommandPrimitive.Item
                  key={t.id}
                  value={t.id}
                  onSelect={() => velg(t)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex cursor-pointer gap-2.5 border-b border-linje px-3.5 py-2.5 last:border-b-0 data-[selected=true]:bg-flate-2"
                >
                  <Symbol type={t.type} />
                  <span className="min-w-0">
                    <b className="block font-semibold text-pretty">{tittel}</b>
                    <span className="block text-[0.8125rem] text-dempet text-pretty">{under}</span>
                  </span>
                </CommandPrimitive.Item>
              );
            })}
          {vis && venter && (
            <p className="px-4 py-3 text-[0.8125rem] text-dempet">Søker i organer og roller …</p>
          )}
          {vis && !venter && svar?.feil && (
            <p className="px-4 py-3 text-[0.8125rem] leading-[1.45] text-dempet">
              Organer og roller kan ikke søkes akkurat nå. Kommunene over er fra siden selv.
            </p>
          )}
          {vis && !venter && mer > 0 && (
            <p className="px-4 py-3 text-[0.8125rem] text-dempet">
              {antall(mer, "treff til", "treff til")}. Skriv mer for å snevre inn.
            </p>
          )}
        </CommandPrimitive.List>
      </CommandPrimitive>
    </div>
  );
}
