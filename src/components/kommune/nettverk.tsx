// Seksjon 5: Nettverket (DESIGN.md §5.5). Hvem sitter flere steder?
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Seksjonen bruker:
//   side.nettverk    organene, personene med aktive roller i minst to organer, og rollene
//   side.organkart   `overordnet`, til utvalgsregelen og til kommunens egne organer
//   side.eierskap    eierskapslaget («Vis eierskap», av som standard) og kommunens selskaper
//   side.segmenter   organene per bransje, til bransjefilteret
//
// Institusjon først: noden er organet, og personen er kanten. Grafen viser et
// avgrenset utvalg (src/lib/graf/utvalg.ts), så den aldri blir et nøste når
// datasettet vokser, og regelen for utvalget står over grafen. Søk, nivå og
// bransje styrer både grafen og lista. Lista har alle som passer, side for
// side. Oppsettet regnes av src/lib/graf/layout.ts og er likt for samme data.
//
// Anker: #nettverket. Regionnavn og anker står i ./seksjoner.ts.

import { ChevronDown, Search, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState, type ReactNode } from "react";

import { MedMerke } from "@/components/maktkart/kildemerke";
import { Seksjon } from "@/components/maktkart/seksjon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { avledBelegg } from "@/lib/belegg";
import type { Nivaa } from "@/lib/data";
import { NIVAAER } from "@/lib/data/kontrakt";
import { antall, tall } from "@/lib/format";
import { lerretFor, regnOppsett } from "@/lib/graf/layout";
import { byggGrafmodell, grafInn, iSetning, organnavn, type Strukturkobling } from "@/lib/graf/modell";
import {
  delnettverk,
  erTomt,
  kommunelag,
  MAKS_KOBLINGER,
  passer,
  TOMT_FILTER,
  velgKoblinger,
  type Filter,
  type Kontekst,
  type Utvalg,
} from "@/lib/graf/utvalg";
import { NIVAANAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import { Buediagram } from "./nettverk/buer";
import { Bryter } from "./nettverk/bryter";
import { Nettverksgraf } from "./nettverk/graf";
import { Personliste } from "./nettverk/liste";
import { IkkeKartlagt } from "./pengene/felles";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

/** Setningen om en kobling som følger av styringsmodellen. Titler og organer fra datasettet. */
function strukturSetning(s: Strukturkobling): string {
  const over = iSetning(organnavn(s.over.org));
  const under = iSetning(organnavn(s.under.org));
  if (s.beggeLedere) return `${s.over.tittel} ${s.person.navn} leder både ${over} og ${under}.`;
  return `${s.person.navn} har roller i både ${over} og ${under}, og ${under} ligger rett under ${over}.`;
}

/** Hva grafen viser, som leseren kan kontrollere. */
function utvalgSetning(u: Utvalg): string {
  const n = u.kanter.length;
  if (u.regel === "alle") return `Grafen viser alle ${antall(n, "koblingen", "koblingene")}.`;
  if (u.regel === "filter") {
    if (u.treff === 0) return "Ingen koblinger passer.";
    return u.avkortet
      ? `${antall(u.treff, "kobling passer", "koblinger passer")}. Grafen viser de første ${n}, ordnet etter organ. Snevre inn søket for å se resten, eller bruk lista.`
      : `${antall(u.treff, "kobling passer", "koblinger passer")}, og grafen viser ${u.treff === 1 ? "den" : "alle"}.`;
  }
  const hvem =
    u.lag === 1
      ? "kommunens egne organer"
      : u.lag === 2
        ? "kommunens egne organer og selskapene den eier"
        : "kommunens egne organer og selskapene den eier, direkte og gjennom andre";
  return (
    `Nettverket har ${tall(u.totalt)} koblinger. Grafen viser ${u.avkortet ? `de første ${n}, ordnet etter organ, av dem` : `de ${n}`} som berører ${hvem}. ` +
    "Søk eller velg nivå eller bransje for å se andre deler. Lista har alle."
  );
}

function Strek({ stiplet = false, vann = false }: { stiplet?: boolean; vann?: boolean }) {
  return (
    <svg width="28" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        x2="27"
        y1="4"
        y2="4"
        className={vann ? "stroke-vann" : "stroke-trykk"}
        strokeWidth={vann ? 1.25 : 1.75}
        strokeDasharray={stiplet ? (vann ? "3 3" : "6 4") : undefined}
      />
    </svg>
  );
}

function Velger({
  etikett,
  verdi,
  settVerdi,
  children,
}: {
  etikett: string;
  verdi: string;
  settVerdi: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold">
        {etikett}
      </label>
      <div className="relative">
        <select
          id={id}
          value={verdi}
          onChange={(e) => settVerdi(e.target.value)}
          className="h-11 w-full min-w-0 cursor-pointer appearance-none border border-trykk bg-papir pr-9 pl-3 text-[0.9375rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-dempet"
        />
      </div>
    </div>
  );
}

export function NettverkSeksjon({ side }: SeksjonProps) {
  const sokId = useId();
  const full = useMemo(
    () =>
      byggGrafmodell({
        nettverk: side.nettverk,
        organkart: side.organkart,
        eierskap: side.eierskap,
        sammenstilt: side.kommune.sammenstilt,
      }),
    [side.nettverk, side.organkart, side.eierskap, side.kommune.sammenstilt],
  );
  const ktx = useMemo<Kontekst>(
    () => ({
      lag: kommunelag({
        organkart: side.organkart,
        eierskap: side.eierskap,
        kommuneorgan: side.oversikt.kommuneorgan,
      }),
      segmenter: new Map(side.segmenter.map((s) => [s.segment.kode, new Set(s.organer.map((o) => o.org.key))])),
      organer: new Map(side.nettverk.noder.map((o) => [o.key, o])),
    }),
    [side.organkart, side.eierskap, side.oversikt.kommuneorgan, side.segmenter, side.nettverk.noder],
  );

  const [filter, settFilter] = useState<Filter>(TOMT_FILTER);
  // Søket skrives fortløpende. Grafen regnes på nytt når leseren tar en pause.
  const utsatt = useDeferredValue(filter);
  const utvalg = useMemo(() => velgKoblinger(full, utsatt, ktx), [full, utsatt, ktx]);
  const vis = useMemo(
    () =>
      byggGrafmodell({
        nettverk: delnettverk(side.nettverk, utvalg.kanter),
        organkart: side.organkart,
        eierskap: side.eierskap,
        sammenstilt: side.kommune.sammenstilt,
      }),
    [utvalg, side.nettverk, side.organkart, side.eierskap, side.kommune.sammenstilt],
  );
  const oppsett = useMemo(() => regnOppsett(grafInn(vis), lerretFor(vis.noder.length)), [vis]);
  const listePersoner = useMemo(
    () => (erTomt(utsatt) ? full.personer : full.personer.filter((p) => p.kanter.some((k) => passer(k, utsatt, ktx)))),
    [full, utsatt, ktx],
  );

  const [visEierskap, settVisEierskap] = useState(false);
  const [visning, settVisning] = useState<"liste" | "buer">("liste");
  const [aktiv, settAktiv] = useState<string | null>(null);

  const m = full.personkanter.length;
  const n = full.personkanter.filter((k) => k.maaVerifiseres).length;
  const telling = avledBelegg(
    full.personkanter.flatMap((k) => k.roller.map((r) => r.belegg)),
    {
      per: side.kommune.sammenstilt,
      merknad:
        "Telt fra alle koblingene i nettverket: ett organpar per person. En kobling bygger på noe som må verifiseres når minst én av rollene må det.",
    },
  );

  // Valgene i filtrene: bare nivåer og bransjer som finnes blant organene i nettverket.
  const nivaaer = NIVAAER.filter((nv) => side.nettverk.noder.some((o) => o.nivaa === nv));
  const bransjer = side.segmenter.filter((s) =>
    s.organer.some((o) => side.nettverk.noder.some((x) => x.key === o.org.key)),
  );
  const harEierlag = vis.eierkanter.length > 0;
  const aktivtFilter = !erTomt(filter);

  if (m === 0) {
    return (
      <Seksjon
        id="nettverket"
        region={seksjonsnavn("nettverket")}
        tittel="Hvem sitter flere steder?"
        ingress="Hvert punkt er et organ. En strek mellom to organer er en person med rolle i begge. Bare aktive roller teller."
      >
        <div className="flex max-w-[62ch] flex-col gap-3">
          <p>
            <IkkeKartlagt>Ingen koblinger i datasettet</IkkeKartlagt>
          </p>
          <p className="brodtekst text-[0.9375rem] text-dempet">
            Datasettet har ingen personer med aktive roller i to eller flere organer i{" "}
            {side.kommune.navn}. Rollene hentes fra Enhetsregisteret og fra organenes egne sider.
          </p>
        </div>
      </Seksjon>
    );
  }

  return (
    <Seksjon
      id="nettverket"
      region={seksjonsnavn("nettverket")}
      tittel="Hvem sitter flere steder?"
      ingress="Hvert punkt er et organ. En strek mellom to organer er en person med rolle i begge. Bare aktive roller teller."
    >
      <div className="flex flex-col gap-6">
        {/* Søk og filtre styrer både grafen og lista. */}
        <div
          role="search"
          aria-label="Søk og filtrer nettverket"
          className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label htmlFor={sokId} className="text-[0.8125rem] font-semibold">
              Søk etter organ eller person
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dempet"
              />
              <input
                id={sokId}
                type="search"
                value={filter.sok}
                onChange={(e) => settFilter((f) => ({ ...f, sok: e.target.value }))}
                placeholder="For eksempel et selskap eller et navn"
                autoComplete="off"
                className="h-11 w-full min-w-0 border border-trykk bg-papir pr-3 pl-9 text-[0.9375rem] outline-none placeholder:text-dempet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              />
            </div>
          </div>
          {nivaaer.length > 1 && (
            <Velger
              etikett="Nivå"
              verdi={filter.nivaa ?? ""}
              settVerdi={(v) => settFilter((f) => ({ ...f, nivaa: (v || null) as Nivaa | null }))}
            >
              <option value="">Alle nivåer</option>
              {nivaaer.map((nv) => (
                <option key={nv} value={nv}>
                  {NIVAANAVN[nv]}
                </option>
              ))}
            </Velger>
          )}
          {bransjer.length > 0 && (
            <Velger
              etikett="Bransje"
              verdi={filter.segment ?? ""}
              settVerdi={(v) => settFilter((f) => ({ ...f, segment: v || null }))}
            >
              <option value="">Alle bransjer</option>
              {bransjer.map((s) => (
                <option key={s.segment.kode} value={s.segment.kode}>
                  {s.segment.navn}
                </option>
              ))}
            </Velger>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
          <p className="max-w-[70ch] text-[0.9375rem] leading-[1.5]" aria-live="polite">
            {utvalgSetning(utvalg)}{" "}
            {aktivtFilter && (
              <button
                type="button"
                onClick={() => settFilter(TOMT_FILTER)}
                className="inline-flex items-center gap-1 font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
              >
                <X aria-hidden="true" className="size-3.5" />
                Vis hele nettverket
              </button>
            )}
          </p>
          {harEierlag && (
            <Bryter pa={visEierskap} settPa={settVisEierskap} className="hidden lg:flex">
              Vis eierskap
            </Bryter>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-dempet">
            <li className="flex items-center gap-2">
              <Strek />
              Person med rolle i begge organer
            </li>
            <li className="flex items-center gap-2">
              <Strek stiplet />
              Bygger på minst én rolle som må verifiseres
            </li>
            {visEierskap && (
              <li className="hidden items-center gap-2 lg:flex">
                <Strek vann stiplet />
                Eierandel, pil mot selskapet
              </li>
            )}
          </ul>
          <ToggleGroup
            type="single"
            value={visning}
            onValueChange={(v) => v && settVisning(v as "liste" | "buer")}
            aria-label="Visning"
            className="gap-0 lg:hidden"
          >
            {(["liste", "buer"] as const).map((v) => (
              <ToggleGroupItem
                key={v}
                value={v}
                className="h-11 min-w-[5.5rem] border border-trykk px-4 text-[0.875rem] font-semibold first:border-r-0 hover:bg-flate-2 hover:text-trykk data-[state=on]:bg-trykk data-[state=on]:text-paa-trykk"
              >
                {v === "liste" ? "Liste" : "Buer"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {utvalg.kanter.length > 0 ? (
          <>
            <div className="hidden border border-linje-sterk lg:block">
              <Nettverksgraf
                modell={vis}
                oppsett={oppsett}
                visEierskap={visEierskap}
                aktiv={aktiv}
                settAktiv={settAktiv}
              />
            </div>
            <div className={cn(visning === "buer" ? "block lg:hidden" : "hidden")}>
              <Buediagram modell={vis} aktiv={aktiv} settAktiv={settAktiv} />
            </div>
          </>
        ) : (
          <div className="hidden border border-dashed border-linje-sterk px-5 py-10 text-center text-[0.9375rem] text-dempet lg:block">
            Ingen koblinger passer søket. Prøv et annet navn, eller vis hele nettverket.
          </div>
        )}

        <div className={cn(visning === "liste" ? "block" : "hidden lg:block")}>
          <h3 className="sr-only">Personene i nettverket, alfabetisk</h3>
          <p className="mb-3 text-[0.875rem] text-dempet">
            <span className="hidden lg:inline">
              Grafen som liste, alfabetisk. Pek på en person for å se koblingene i grafen.{" "}
            </span>
            {aktivtFilter
              ? `${antall(listePersoner.length, "person passer", "personer passer")}.`
              : `${antall(listePersoner.length, "person", "personer")} med roller i minst to organer.`}
          </p>
          <Personliste personer={listePersoner} aktiv={aktiv} settAktiv={settAktiv} />
        </div>

        <div className="flex max-w-[68ch] flex-col gap-2 text-[0.9375rem] leading-[1.55]">
          <p className="font-semibold">
            <MedMerke
              belegg={telling}
              pastand={`${n} av ${m} koblinger i nettverket bygger på minst én rolle som må verifiseres`}
            >
              {tall(n)} av {antall(m, "kobling", "koblinger")}
            </MedMerke>{" "}
            bygger på minst én rolle som må verifiseres.
          </p>
          <p className="text-dempet">
            {full.struktur.map((s) => (
              <span key={`${s.person.key}-${s.over.org.key}-${s.under.org.key}`}>
                {strukturSetning(s)}{" "}
              </span>
            ))}
            {full.struktur.length > 0
              ? `${full.struktur.length > 1 ? "Slike koblinger følger" : "Det følger"} av styringsmodellen og vises ikke som kobling. `
              : "Koblinger mellom et organ og organet rett under det følger av styringsmodellen og vises ikke. "}
            Tidligere roller teller ikke. Domstoler, politi, påtalemyndighet og Forsvaret er aldri
            med. Grafen viser høyst {MAKS_KOBLINGER} koblinger om gangen.
          </p>
        </div>
      </div>
    </Seksjon>
  );
}
