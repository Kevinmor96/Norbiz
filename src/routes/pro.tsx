// Pro (spec §2, modus Overtale): hva Pro skal gi, prishypotesene og
// ventelisten. Pro finnes ikke, og siden sier det i første linje. Under hver
// funksjon står hva datasettet allerede har som Pro skal bygge på, med
// kildemerke (components/kommune/metode-pro/grunnlag.ts).

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Download, History, Waypoints, type LucideIcon } from "lucide-react";

import { Sidedel } from "@/components/forside/sidedel";
import { lastProGrunnlag } from "@/components/kommune/metode-pro/grunnlag";
import { PRO_FUNKSJONER, type ProFunksjon } from "@/components/kommune/metode-pro/prishypoteser";
import { Planlagt, Pristabell, ProSkjema } from "@/components/kommune/metode-pro/pro";
import { kjenteKommuner } from "@/components/kommune/neste/valgkretser";
import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { Pastand } from "@/components/maktkart/kildemerke";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Topplinje } from "@/components/maktkart/topplinje";
import { nettstedUrl } from "@/lib/nettsted";

const TITTEL = "Maktkart Pro: følg med på hvem som bestemmer | Maktkart";
const BESKRIVELSE =
  "Maktkart Pro skal gi varsler ved rollebytte, hele grafen, historikk som per dato og eksport. Pro finnes ikke ennå. Prisene er hypoteser vi tester. Meld deg på ventelisten.";

export const Route = createFileRoute("/pro")({
  loader: () => lastProGrunnlag(),
  head: () => {
    const url = nettstedUrl("/pro");
    return {
      meta: [
        { title: TITTEL },
        { name: "description", content: BESKRIVELSE },
        { property: "og:title", content: TITTEL },
        { property: "og:description", content: BESKRIVELSE },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "nb_NO" },
        { name: "twitter:title", content: TITTEL },
        { name: "twitter:description", content: BESKRIVELSE },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Pro,
});

const IKON: Record<ProFunksjon["key"], LucideIcon> = {
  varsler: Bell,
  graf: Waypoints,
  historikk: History,
  eksport: Download,
};

/** Hvem Pro er for, fra spec §1. Betalingsviljen er et estimat og vises ikke. */
const FOR_HVEM = [
  { hvem: "PR, samfunnskontakt og lobbyister", trenger: "Hvem forbereder og hvem vedtar, og når de byttes ut." },
  { hvem: "Eiendomsutviklere og meglere", trenger: "Planprosessen og hvem som sitter i den." },
  { hvem: "Salg til offentlig sektor", trenger: "Beslutningstakerne og hvem som har innkjøpsmakt." },
  { hvem: "Journalister og redaksjoner", trenger: "Koblinger, historikk og kilder." },
  { hvem: "Næringsforeninger og arbeidslivet", trenger: "Oversikt over regionen." },
];

const lenke =
  "font-semibold text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal";

function Pro() {
  const { kommuner, kommune, tall } = Route.useLoaderData();
  const kjente = kjenteKommuner(kommuner);

  return (
    <>
      <Topplinje sammenstilt={kommune?.sammenstilt ?? null} proHref="#venteliste" />
      <main id="innhold" className="ramme">
        <section
          aria-labelledby="pro-tittel"
          className="grid gap-x-12 gap-y-12 pt-[clamp(28px,5vw,64px)] pb-[clamp(56px,8vw,104px)] lg:grid-cols-12"
        >
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-7 lg:pt-3">
            <Planlagt />
            <h1
              id="pro-tittel"
              className="tittel max-w-[14ch] text-[clamp(2.5rem,1.35rem+3.6vw,4.5rem)]"
            >
              Følg med på hvem som bestemmer
            </h1>
            <p className="ingress max-w-[46ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
              Maktkart Pro skal si fra når makten flytter seg i kommunene du følger: nye ledere, nye
              styrer og nye eiere, med kilde på hver endring. Pro finnes ikke ennå. Ventelisten viser
              oss om det er verdt å bygge.
            </p>
            <p className="max-w-[46ch] text-[0.9375rem] leading-[1.5] text-pretty">
              Kommunesiden er gratis og åpen.{" "}
              {kommune && (
                <Link to="/kommune/$slug" params={{ slug: kommune.slug }} className={lenke}>
                  Se hvem som bestemmer i {kommune.navn}
                </Link>
              )}
            </p>
          </div>
          <div
            id="venteliste"
            className="flex min-w-0 scroll-mt-[calc(var(--topp)+16px)] flex-col gap-6 self-start border border-trykk bg-flate p-5 sm:p-6 lg:col-span-5"
          >
            <h2 className="text-[1.375rem] leading-[1.1] font-bold tracking-[-0.01em] [font-stretch:108%]">
              Ventelisten
            </h2>
            <Pristabell />
            <ProSkjema kommuner={kjente} standard={kommune?.kommunenr ?? null} />
          </div>
        </section>

        <Sidedel
          id="funksjoner"
          tittel="Hva Pro skal gi"
          ingress="Fire ting den åpne siden ikke gjør. Under hver står det datasettet allerede har å bygge på."
        >
          <ul className="grid border-t border-trykk md:grid-cols-2">
            {PRO_FUNKSJONER.map((f, i) => {
              const Ikon = IKON[f.key];
              const t = tall[f.key];
              return (
                <li
                  key={f.key}
                  className={
                    "grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 border-b border-linje py-6 md:pr-8 " +
                    (i % 2 === 1 ? "md:border-l md:pl-8" : "")
                  }
                >
                  <Ikon className="mt-1 size-6 text-trykk" strokeWidth={1.5} aria-hidden="true" />
                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-[1.25rem] leading-[1.15] font-bold tracking-[-0.01em] [font-stretch:105%]">
                      {f.navn}
                    </h3>
                    <p className="max-w-[52ch] text-[0.9375rem] leading-[1.5] text-dempet text-pretty">
                      {f.lang}
                    </p>
                    {t && (
                      <p className="text-[0.875rem] text-pretty">
                        <span className="text-dempet">Grunnlaget nå: </span>
                        <Pastand
                          tekst={t.tekst}
                          belegg={t.belegg}
                          pastand={t.pastand}
                          className="font-semibold"
                        />
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Sidedel>

        <Sidedel
          id="for-hvem"
          tittel="Hvem Pro er for"
          ingress="De som må vite hvem som forbereder en sak, hvem som vedtar den og når de byttes ut."
        >
          <dl className="grid max-w-[56rem] border-t border-linje sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            {FOR_HVEM.map((r) => (
              <div key={r.hvem} className="contents">
                <dt className="pt-3 font-semibold sm:border-b sm:border-linje sm:py-3 sm:pr-6">{r.hvem}</dt>
                <dd className="border-b border-linje pb-3 text-dempet sm:py-3">{r.trenger}</dd>
              </div>
            ))}
          </dl>
        </Sidedel>
      </main>
      <Sidefot sammenstilt={kommune?.sammenstilt ?? null} />
      {kommune && (
        <ForhandsversjonBunn
          sammenstilt={kommune.sammenstilt}
          proHref="#venteliste"
          tegnforklaring={false}
        />
      )}
    </>
  );
}
