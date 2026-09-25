// Søket i kommunens organer og roller. Filteret går i nettleseren over
// organkartet fra loaderen: organene og lederne de har. Et treff åpner
// organet i skuffen, og går til organsiden der skuffen ikke finnes.
//
// Personer finnes bare gjennom en rolle (institusjon først), så et navn gir
// treff på rollen personen har, og treffet peker til organet.
//
// Søket tåler aksenter og norske bokstaver i begge retninger: «tromso» finner
// Tromsø og «hermes» ville funnet Hermès (lærdom fra Bransjesjekk). Brettingen
// er datalagets egen (`normaliser` i src/lib/data/sok.ts), så dette søket og
// søket i hele regionen finner det samme.
//
// Finner søket lite i kommunen, spør det datalaget om resten av regionen
// (serverfunksjonen i region/sok.tsx). Treffene der står under en egen
// overskrift og går til kommunesiden eller organsiden.

import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { aapneOrgan } from "@/components/organ/organ-skuff";
import { sokRegionen } from "@/components/region/sok";
import type { Organkart, Sokeresultat } from "@/lib/data";
import { normaliser as brett } from "@/lib/data/sok";
import { antall } from "@/lib/format";
import { NIVAANAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

interface Treff {
  id: string;
  org: string;
  tittel: string;
  under: string;
  type: "organ" | "rolle";
  tekst: string;
}

/** Datalagets bretting: små bokstaver uten aksenter, æ som ae. Brukes på både søk og indeks. */
const normaliser = (s: string) => brett(s.replace(/\u00ad/g, ""));

/** Et treff utenfor kommunen, fra søket i hele regionen. */
interface Regiontreff {
  id: string;
  tittel: string;
  under: string;
  gaaTil:
    | { to: "/kommune/$slug"; params: { slug: string } }
    | { to: "/organ/$key"; params: { key: string } };
}

function regiontreff(r: Sokeresultat, her: Set<string>, kommunenavn: string): Regiontreff[] {
  const ut: Regiontreff[] = [];
  for (const k of r.kommuner.treff) {
    if (!k.har_datasett || k.navn === kommunenavn) continue;
    ut.push({
      id: `r-kommune:${k.kommunenr}`,
      tittel: k.navn_offisielt.replace(/ - /g, "\u00a0- "),
      under: "Kommune",
      gaaTil: { to: "/kommune/$slug", params: { slug: k.slug } },
    });
  }
  for (const o of r.organer.treff) {
    if (her.has(o.key)) continue;
    ut.push({
      id: `r-organ:${o.key}`,
      tittel: o.navn,
      under: NIVAANAVN[o.nivaa],
      gaaTil: { to: "/organ/$key", params: { key: o.key } },
    });
  }
  for (const x of r.roller.treff) {
    if (her.has(x.org.key)) continue;
    ut.push({
      id: `r-rolle:${x.org.key}:${x.person.key}:${x.rolletype}`,
      tittel: x.person.navn,
      under: `${x.tittel}, ${x.org.kortnavn ?? x.org.navn}`,
      gaaTil: { to: "/organ/$key", params: { key: x.org.key } },
    });
  }
  return ut.slice(0, 6);
}

function lagIndeks(organkart: Organkart): { treff: Treff[]; organer: number; roller: number } {
  const treff: Treff[] = [];
  let roller = 0;
  for (const gruppe of organkart.grupper) {
    for (const o of gruppe.organer) {
      const nivaa = NIVAANAVN[o.nivaa];
      treff.push({
        id: `organ:${o.key}`,
        org: o.key,
        tittel: o.navn,
        under: o.kortnavn && o.kortnavn !== o.navn ? `${nivaa}, ${o.kortnavn}` : nivaa,
        type: "organ",
        tekst: normaliser(`${o.navn} ${o.kortnavn ?? ""}`),
      });
      for (const r of o.ledere) {
        roller += 1;
        treff.push({
          id: `rolle:${o.key}:${r.person.key}:${r.rolletype}`,
          org: o.key,
          tittel: r.person.navn,
          under: `${r.tittel}, ${o.kortnavn ?? o.navn}`,
          type: "rolle",
          tekst: normaliser(`${r.person.navn} ${r.tittel} ${o.navn} ${o.kortnavn ?? ""}`),
        });
      }
    }
  }
  return { treff, organer: treff.length - roller, roller };
}

function sok(indeks: Treff[], q: string): Treff[] {
  const ord = normaliser(q).split(/\s+/).filter(Boolean);
  if (!ord.length) return [];
  // Alle ordene må finnes. Treff der tittelen begynner med søket, står først.
  const start = ord.join(" ");
  return indeks
    .filter((t) => ord.every((o) => t.tekst.includes(o)))
    .map((t) => ({
      t,
      rang: normaliser(t.tittel).startsWith(start) ? 0 : t.type === "organ" ? 1 : 2,
    }))
    .sort((a, b) => a.rang - b.rang)
    .map((x) => x.t)
    .slice(0, 8);
}

function Symbol({ type }: { type: Treff["type"] }) {
  // Organ: rute (institusjonen). Rolle: prikk i rute (en person i institusjonen).
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      className="mt-1 shrink-0 text-trykk"
    >
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
    </svg>
  );
}

export function Sok({ organkart, kommunenavn }: { organkart: Organkart; kommunenavn: string }) {
  const navigate = useNavigate();
  const [q, settQ] = useState("");
  const [aapen, settAapen] = useState(false);
  const felt = useRef<HTMLInputElement>(null);
  const indeks = useMemo(() => lagIndeks(organkart), [organkart]);
  const treff = useMemo(() => sok(indeks.treff, q), [indeks, q]);
  const vis = aapen && q.trim().length > 0;

  // Resten av regionen, bare når kommunen selv gir få treff. Uten server (den
  // statiske eksporten) søkes det i søkeindeksen fra eksporten. Feiler begge,
  // blir lista tom, og søket i kommunen virker som før.
  const [region, settRegion] = useState<{ q: string; treff: Regiontreff[] } | null>(null);
  const sporring = q.trim();
  const faa = treff.length < 3 && normaliser(sporring).length >= 2;
  useEffect(() => {
    if (!faa) return;
    let avbrutt = false;
    const her = new Set(indeks.treff.map((t) => t.org));
    const t = window.setTimeout(() => {
      sokRegionen(sporring)
        .then((r) => {
          if (!avbrutt) settRegion({ q: sporring, treff: regiontreff(r, her, kommunenavn) });
        })
        .catch(() => {
          if (!avbrutt) settRegion({ q: sporring, treff: [] });
        });
    }, 160);
    return () => {
      avbrutt = true;
      window.clearTimeout(t);
    };
  }, [faa, sporring, indeks, kommunenavn]);
  const utenfor = faa && region?.q === sporring ? region.treff : [];

  const velg = (t: Treff) => {
    settAapen(false);
    // Fokus tilbake til søkefeltet når skuffen lukkes, ikke til et treff som er borte.
    if (aapneOrgan(t.org, { fra: felt.current, navn: t.type === "organ" ? t.tittel : null }))
      return;
    void navigate({ to: "/organ/$key", params: { key: t.org } });
  };

  return (
    <div className="relative w-full max-w-[30rem]">
      {/* cmdk lager sin egen skjulte etikett og id på feltet. Denne er den synlige. */}
      <p
        aria-hidden="true"
        className="mb-2 cursor-default text-[0.875rem] font-semibold"
        onClick={() => felt.current?.focus()}
      >
        Søk i organer og roller
      </p>
      <CommandPrimitive
        shouldFilter={false}
        loop
        label="Søk i organer og roller"
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
            // Malen vet ikke hvilken kommune den viser, så eksempelet nevner ingen
            // bestemt virksomhet (det sto «Troms Kraft» her, også i Alta).
            placeholder="For eksempel ordfører eller et selskap"
            className={cn(
              "h-[52px] w-full appearance-none border border-trykk bg-flate pr-4 pl-11 text-base text-trykk",
              "placeholder:text-dempet focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal",
            )}
          />
        </div>
        <CommandPrimitive.List
          className={cn(
            "absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[22rem] overflow-y-auto border border-trykk bg-flate",
            !vis && "hidden",
          )}
        >
          {vis && (
            <CommandPrimitive.Empty className="px-4 py-3.5 text-[0.875rem] text-dempet">
              Ingen treff på «{q.trim()}». Søket dekker organer og ledere i {kommunenavn}
              {faa ? ", og kommuner, organer og roller i resten av regionen" : ""}.
            </CommandPrimitive.Empty>
          )}
          {vis &&
            treff.map((t) => (
              <CommandPrimitive.Item
                key={t.id}
                value={t.id}
                onSelect={() => velg(t)}
                onMouseDown={(e) => e.preventDefault()}
                className="flex cursor-pointer gap-2.5 border-b border-linje px-3.5 py-2.5 last:border-b-0 data-[selected=true]:bg-flate-2"
              >
                <Symbol type={t.type} />
                <span className="min-w-0">
                  <b className="block font-semibold">{t.tittel}</b>
                  <span className="block text-[0.8125rem] text-dempet">{t.under}</span>
                </span>
              </CommandPrimitive.Item>
            ))}
          {vis && utenfor.length > 0 && (
            <CommandPrimitive.Group
              heading={`Utenfor ${kommunenavn}`}
              className="border-t border-trykk [&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:text-dempet"
            >
              {utenfor.map((t) => (
                <CommandPrimitive.Item
                  key={t.id}
                  value={t.id}
                  onSelect={() => {
                    settAapen(false);
                    void navigate(t.gaaTil);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex cursor-pointer gap-2.5 border-b border-linje px-3.5 py-2.5 last:border-b-0 data-[selected=true]:bg-flate-2"
                >
                  <Symbol type={t.id.startsWith("r-rolle") ? "rolle" : "organ"} />
                  <span className="min-w-0">
                    <b className="block font-semibold">{t.tittel}</b>
                    <span className="block text-[0.8125rem] text-dempet">{t.under}</span>
                  </span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
        </CommandPrimitive.List>
      </CommandPrimitive>
      <p className="mt-2 text-[0.8125rem] text-dempet">
        {antall(indeks.organer, "organ", "organer")} og {antall(indeks.roller, "leder", "ledere")} i
        datasettet.
      </p>
    </div>
  );
}
