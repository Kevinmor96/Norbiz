// Forsiden: «Innflytelse i Nord-Norge» (spec §2, modus Overtale). Spørsmålet,
// regionkartet som kartblad med alle kommunene, søket, fylkene som innganger,
// én kartlagt kommune som eksempel på hva siden gir, merkene og Pro.
//
// Alt som nevner en kommune, et fylke eller et tall, kommer fra datalaget
// gjennom loaderne (region/last.ts og forside/last.ts, hentet på serveren via
// region/hent.ts). Forsiden teller ingen
// ting selv. Malen vet ikke hvilken region den viser: navnet, fylkene og
// kommunene kommer fra regionregisteret.
//
// Overskriften er valgt mellom tre:
//   «Hvem bestemmer i Nord-Norge?»   spørsmålet slik folk stiller det, og det
//                                     samme som på fylkes- og kommunesidene.
//   «Innflytelse i Nord-Norge»        et merkenavn, ikke et spørsmål. Står som
//                                     regionlinje over tittelen og i <title>.
//   «Makta i nord, kommune for kommune»  lover en rangering av makt, som siden
//                                     bevisst ikke har.
// Den første vant: den er kortest, den er et spørsmål leseren kjenner igjen, og
// den lover bare det siden holder.

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { FireSvar } from "@/components/forside/fire-svar";
import { Sidedel } from "@/components/forside/sidedel";
import { Smakebit } from "@/components/forside/smakebit";
import type { KjentKommune } from "@/components/kommune/neste/valgkretser";
import {
  Pristabell,
  ProFunksjoner,
  ProSkjema,
  Planlagt,
} from "@/components/kommune/metode-pro/pro";
import { ForhandsversjonBunn, varselForFylker } from "@/components/maktkart/forhandsversjon";
import { Pastand } from "@/components/maktkart/kildemerke";
import { KommuneKontekst } from "@/components/maktkart/kommune-kontekst";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { Topplinje } from "@/components/maktkart/topplinje";
import { Dekningsforklaring } from "@/components/region/dekning";
import { Fylkekort } from "@/components/region/fylkekort";
import { GRENSER } from "@/components/region/geometri";
import { fraServeren, hentForside } from "@/components/region/hent";
import { Regionkart } from "@/components/region/regionkart";
import { Regionsok } from "@/components/region/sok";
import { antall, tall } from "@/lib/format";
import { nettstedUrl } from "@/lib/nettsted";

export const Route = createFileRoute("/")({
  // Gjennom en serverfunksjon, så datalaget aldri lastes i nettleseren (region/hent.ts).
  // Svaret endres bare ved en ny utrulling, så det hentes én gang per økt.
  loader: () => fraServeren(() => hentForside(), "/"),
  staleTime: Infinity,
  head: ({ loaderData }) => {
    const r = loaderData?.region;
    const tittel = r
      ? `Hvem bestemmer i ${r.region.navn}? Innflytelse, kommune for kommune | Maktkart`
      : "Maktkart";
    const beskrivelse = r
      ? `Hvem bestemmer i ${r.region.navn}? Organene, rollene og pengene i ${tall(r.kommuner.length)} kommuner i ${r.fylker
          .map((f) => f.navn)
          .join(", ")
          .replace(/, ([^,]*)$/, " og $1")}, med kilde og dato på hver påstand.`
      : "Hvem bestemmer i kommunen din? Maktkart viser organene, rollene og pengene, med kilde og dato på hver påstand.";
    const url = nettstedUrl("/");
    return {
      meta: [
        { title: tittel },
        { name: "description", content: beskrivelse },
        { property: "og:title", content: tittel },
        { property: "og:description", content: beskrivelse },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "nb_NO" },
        { name: "twitter:title", content: tittel },
        { name: "twitter:description", content: beskrivelse },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Forside,
});

/** «Nordland, Troms og Finnmark». */
function oppramsing(navn: string[]): string {
  return navn.length > 1 ? `${navn.slice(0, -1).join(", ")} og ${navn.at(-1)}` : (navn[0] ?? "");
}

function Forside() {
  const { utvalgt, region } = Route.useLoaderData();
  const { fylker, kommuner } = region;
  const varsel = varselForFylker(fylker.map((f) => ({ navn: f.navn, grader: f.grader })));
  const fylkeAv = new Map(fylker.map((f) => [f.fylkesnr, f]));
  // Pro-skjemaet velger blant alle kommunene i regionen. De med datasett står først.
  const proKommuner: KjentKommune[] = kommuner
    .map((k) => ({
      kommunenr: k.kommunenr,
      navn: k.navn,
      slug: k.datasett ? k.slug : null,
      gruppe: fylkeAv.get(k.fylkesnr)?.navn ?? "",
    }))
    .sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
  const medDatasett = kommuner.filter((k) => k.datasett).length;

  return (
    <>
      <Topplinje varsel={varsel} proHref="#pro" />
      <main id="innhold">
        <section
          aria-labelledby="forside-tittel"
          className="ramme pt-[clamp(28px,5vw,64px)] pb-[clamp(40px,6vw,80px)]"
        >
          {/* På mobil kommer kartet rett etter ingressen: det er beviset. På skrivebord står
              det til høyre for både tittelen og søket. */}
          <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-y-7">
            <div className="flex min-w-0 flex-col gap-7 lg:col-span-5 lg:pt-3">
              <div className="flex flex-col gap-4">
                <p className="region text-[0.75rem] text-dempet sm:text-[0.8125rem]">
                  Innflytelse i {region.region.navn}
                </p>
                <h1
                  id="forside-tittel"
                  className="tittel text-[clamp(2.5rem,1.35rem+3.6vw,4.75rem)] lg:text-[clamp(3rem,0.6rem+4.4vw,4.75rem)]"
                >
                  Hvem bestemmer i {region.region.navn}?
                </h1>
              </div>
              <p className="ingress max-w-[38ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
                {tall(kommuner.length)} kommuner i {oppramsing(fylker.map((f) => f.navn))}.
                Organene, rollene og pengene, og hvordan de henger sammen. Hver påstand har kilde og
                dato.
              </p>
            </div>
            <Regionkart
              className="lg:col-span-7 lg:row-span-2"
              kommuner={kommuner}
              fylker={fylker}
              tittel={region.region.navn}
              undertittel={`${antall(kommuner.length, "kommune", "kommuner")} i ${antall(fylker.length, "fylke", "fylker")}`}
            >
              <Dekningsforklaring klasser={region.region.klasser} />
            </Regionkart>
            <div className="grid min-w-0 content-start gap-7 md:grid-cols-2 md:gap-x-8 lg:col-span-5 lg:grid-cols-1">
              <Regionsok kommuner={kommuner} fylker={fylker} regionnavn={region.region.navn} />
              <Tegnforklaring className="max-w-[30rem]" visTall={false} />
            </div>
          </div>
        </section>

        <div className="ramme">
          <Sidedel
            id="fylkene"
            tittel={`${tall(fylker.length)} fylker, ${tall(kommuner.length)} kommuner`}
            ingress={`Hvert fylke har sin side: fylkeskommunen, Statsforvalteren, stortingsbenken, kommunene og de største virksomhetene. ${
              medDatasett === kommuner.length
                ? "Alle kommunene har datasett."
                : `${tall(medDatasett)} av ${tall(kommuner.length)} kommuner har datasett.`
            }`}
          >
            <ul className="grid gap-x-8 gap-y-10 md:grid-cols-3">
              {fylker.map((f) => (
                <Fylkekort key={f.fylkesnr} fylke={f} />
              ))}
            </ul>
          </Sidedel>

          {utvalgt && (
            // Eksempelet er én kommune, og merkene der hører til den kommunens datasett.
            <KommuneKontekst oversikt={utvalgt.oversikt} proHref="#pro">
              <Sidedel
                id="eksempel"
                tittel={`Én kommune, fire svar: ${utvalgt.kommune.navn}`}
                ingress={`${utvalgt.kommune.navn} har flest organer i datasettet. Kommunesiden svarer på «hvem bestemmer her?» på fire måter. Hver kommune får den samme siden, med det datasettet har.`}
              >
                <div className="flex flex-col gap-12">
                  <div className="max-w-[56rem]">
                    <Smakebit utvalgt={utvalgt} />
                  </div>
                  <FireSvar utvalgt={utvalgt} />
                </div>
              </Sidedel>
            </KommuneKontekst>
          )}

          <Sidedel
            id="merkene"
            tittel="Hver påstand har et merke"
            ingress="Merket viser hvor påstanden kommer fra og hvor langt den er etterprøvd. Formen bærer graden, så den kan leses uten farge."
          >
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
              <Tegnforklaring
                className="max-w-[30rem] lg:col-span-5"
                overskrift="h3"
                visTall={false}
              />
              <div className="flex max-w-[60ch] flex-col gap-5 lg:col-span-7">
                <Avsnitt tittel="Prøv et merke">
                  {fylker[0] ? (
                    <Pastand
                      tekst={`${fylker[0].navn} hadde ${tall(fylker[0].folketall.verdi)} innbyggere 1. januar ${fylker[0].folketall.aar}.`}
                      belegg={fylker[0].folketall.belegg}
                      storrelse={14}
                    />
                  ) : (
                    "Merkene står etter hver påstand."
                  )}{" "}
                  Trykk på merket for å se kilden, datoen og graden.
                </Avsnitt>
                <Avsnitt tittel="Forhåndsversjon">
                  {varsel?.lang ??
                    "Bare det som er merket verifisert, er hentet direkte fra registrene. Resten er ikke etterprøvd."}{" "}
                  Tellingene per grad står på hver fylkes- og kommuneside.
                </Avsnitt>
                <Avsnitt tittel="Institusjon først">
                  Personer vises bare gjennom en rolle i et organ. Ingen bilder, ingen
                  personprofiler og ingen lister som rangerer mennesker.
                </Avsnitt>
                <Link
                  to="/metode"
                  className="inline-flex items-center self-start text-[0.9375rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                >
                  Slik er tallene sammenstilt
                </Link>
              </div>
            </div>
          </Sidedel>

          <Sidedel
            id="pro"
            tittel="Pro, for dem som følger med hver uke"
            ingress="Den åpne siden viser hvem som bestemmer. Pro skal si fra når det endrer seg."
          >
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
              <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
                <Planlagt />
                <ProFunksjoner />
                <Link
                  to="/pro"
                  className="inline-flex items-center self-start text-[0.9375rem] font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                >
                  Mer om Pro
                </Link>
              </div>
              <div className="flex min-w-0 flex-col gap-6 border border-trykk bg-flate p-5 sm:p-6 lg:col-span-5">
                <Pristabell />
                <ProSkjema kommuner={proKommuner} standard={null} />
              </div>
            </div>
          </Sidedel>
        </div>
      </main>
      <Sidefot varsel={varsel} terrengKreditt={GRENSER.meta.attribusjon} />
      <ForhandsversjonBunn varsel={varsel} proHref="#pro" />
    </>
  );
}

function Avsnitt({ tittel, children }: { tittel: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[1.0625rem] font-bold">{tittel}</h3>
      <p className="brodtekst text-[1rem] text-pretty">{children}</p>
    </div>
  );
}
