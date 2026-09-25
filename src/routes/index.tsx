// Forsiden: døra (spec §2, modus Overtale). Spørsmålet, kommunevelgeren, en
// smakebit fra en kartlagt kommune med ekte kartblad og tall, de fire svarene
// kommunesiden gir, kildemerket som tillitsbevis, stemmen på neste kommune og
// Pro-ventelisten.
//
// Alt som nevner en kommune, et organ eller et tall, kommer fra datasettene.
// Tallene regnes i loaderen (components/forside/last.ts), så forsiden ikke
// bærer hele datasettet i HTML-en.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { FireSvar } from "@/components/forside/fire-svar";
import { Kommunesok } from "@/components/forside/kommunesok";
import { Sidedel } from "@/components/forside/sidedel";
import { Smakebit } from "@/components/forside/smakebit";
import {
  Pristabell,
  ProFunksjoner,
  ProSkjema,
  Planlagt,
} from "@/components/kommune/metode-pro/pro";
import { NesteKommune } from "@/components/kommune/neste/neste-kommune";
import { kjenteKommuner } from "@/components/kommune/neste/valgkretser";
import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { Pastand } from "@/components/maktkart/kildemerke";
import { KommuneKontekst } from "@/components/maktkart/kommune-kontekst";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { Topplinje } from "@/components/maktkart/topplinje";
import { antall, datoKort, tall } from "@/lib/format";
import { nettstedUrl } from "@/lib/nettsted";

const TITTEL = "Maktkart: hvem bestemmer i din kommune?";

export const Route = createFileRoute("/")({
  loader: async () => {
    // Dynamisk import: loadere deles ikke opp, og datasettet skal ikke i hovedbunten.
    const { lastForside } = await import("@/components/forside/last");
    return lastForside();
  },
  head: ({ loaderData }) => {
    const u = loaderData?.utvalgt;
    const beskrivelse = u
      ? `Hvem bestemmer i kommunen din? Maktkart viser organene, rollene og pengene i en kommune, med kilde og dato på hver påstand. ${u.kommune.navn} er kartlagt først: ${tall(u.oversikt.dekning.organer)} organer og ${tall(u.oversikt.dekning.roller)} roller, sammenstilt ${datoKort(u.kommune.sammenstilt)}.`
      : "Hvem bestemmer i kommunen din? Maktkart viser organene, rollene og pengene i en kommune, med kilde og dato på hver påstand.";
    const url = nettstedUrl("/");
    return {
      meta: [
        { title: TITTEL },
        { name: "description", content: beskrivelse },
        { property: "og:title", content: TITTEL },
        { property: "og:description", content: beskrivelse },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "nb_NO" },
        { name: "twitter:title", content: TITTEL },
        { name: "twitter:description", content: beskrivelse },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Forside,
});

function Forside() {
  const { kommuner, utvalgt } = Route.useLoaderData();
  const [valgt, settValgt] = useState<string | null>(null);
  const kjente = kjenteKommuner(kommuner);
  const kartlagte = kjente.filter((k) => k.slug);
  const apne = kjente.length - kartlagte.length;

  const stem = (kommunenr: string) => {
    settValgt(kommunenr);
    const del = document.getElementById("neste");
    del?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    // Fokus til e-postfeltet: kommunen er valgt, og det neste leseren gjør, er å skrive adressen.
    window.setTimeout(
      () =>
        del?.querySelector<HTMLInputElement>("input[type=email]")?.focus({ preventScroll: true }),
      400,
    );
  };

  const innhold = (
    <>
      <Topplinje sammenstilt={utvalgt?.kommune.sammenstilt ?? null} proHref="#pro" />
      <main id="innhold">
        <section
          aria-labelledby="forside-tittel"
          className="ramme pt-[clamp(28px,5vw,64px)] pb-[clamp(48px,7vw,96px)]"
        >
          <div className="grid gap-x-6 gap-y-12 lg:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-7 lg:col-span-5 lg:pt-3">
              <h1
                id="forside-tittel"
                className="tittel text-[clamp(2.5rem,1.35rem+3.6vw,4.75rem)] lg:text-[clamp(3rem,0.6rem+4.4vw,4.75rem)]"
              >
                Hvem bestemmer i din kommune?
              </h1>
              <p className="ingress max-w-[38ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
                Maktkart viser organene, rollene og pengene i en kommune, og hvordan de henger
                sammen. Hver påstand har kilde og dato.
              </p>
              <Kommunesok kommuner={kjente} onStem={stem} />
              <p className="max-w-[30rem] text-[0.875rem] leading-[1.5] text-dempet text-pretty">
                {kartlagte.length > 0 ? (
                  <>
                    Kartlagt nå:{" "}
                    {kartlagte.map((k, i) => (
                      <span key={k.kommunenr}>
                        {i > 0 && ", "}
                        <Link
                          to="/kommune/$slug"
                          params={{ slug: k.slug ?? "" }}
                          className="font-semibold text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                        >
                          {k.navn}
                        </Link>
                      </span>
                    ))}
                    .{" "}
                  </>
                ) : (
                  "Ingen kommune er kartlagt ennå. "
                )}
                {apne > 0 && (
                  <>
                    {antall(apne, "kommune til", "kommuner til")} kan{" "}
                    <a
                      href="#neste"
                      className="text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
                    >
                      stemmes fram
                    </a>
                    .
                  </>
                )}
              </p>
            </div>
            <div className="min-w-0 lg:col-span-7">
              {utvalgt ? (
                <Smakebit utvalgt={utvalgt} />
              ) : (
                <p className="border border-dashed border-kote p-6 text-dempet">
                  Ingen kommune er kartlagt ennå. Kartbladet kommer når den første er det.
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="ramme">
          {utvalgt && (
            <Sidedel
              id="svarene"
              tittel="Fire svar på samme spørsmål"
              ingress={`Kommunesiden svarer på «hvem bestemmer her?» på fire måter. Tallene er fra ${utvalgt.kommune.navn}.`}
            >
              <FireSvar utvalgt={utvalgt} />
            </Sidedel>
          )}

          {utvalgt && (
            <Sidedel
              id="merkene"
              tittel="Hver påstand har et merke"
              ingress="Merket viser hvor påstanden kommer fra og hvor langt den er etterprøvd. Formen bærer graden, så den kan leses uten farge."
            >
              <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
                <Tegnforklaring className="max-w-[30rem] lg:col-span-5" overskrift="h3" />
                <div className="flex max-w-[60ch] flex-col gap-5 lg:col-span-7">
                  <Avsnitt tittel="Prøv et merke">
                    {utvalgt.seter ? (
                      <Pastand
                        tekst={`${utvalgt.seter.organ} har ${tall(utvalgt.seter.antall)} medlemmer.`}
                        belegg={utvalgt.seter.belegg}
                        pastand={`${utvalgt.seter.organ} har ${utvalgt.seter.antall} medlemmer`}
                        storrelse={14}
                      />
                    ) : (
                      "Merkene står etter hver påstand på kommunesiden."
                    )}{" "}
                    Trykk på merket for å se kilden, datoen og graden.
                  </Avsnitt>
                  <Avsnitt tittel="Forhåndsversjon">
                    Alt er sammenstilt {datoKort(utvalgt.kommune.sammenstilt)} fra et
                    researchgrunnlag med kilder. Ingen påstand er etterprøvd mot
                    Brønnøysundregistrene ennå, og derfor har ingen merker graden verifisert. Det
                    står på hver side til det er gjort.
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
          )}

          <Sidedel
            id="neste"
            tittel="Hvilken kommune skal kartlegges nå?"
            ingress="Hver kommune får den samme siden. Stem fram den neste. Stemmene viser oss hvor behovet er størst."
          >
            <NesteKommune
              fylkesnr={utvalgt?.kommune.fylkesnr ?? kommuner[0]?.fylkesnr ?? ""}
              fylke={utvalgt?.kommune.fylke ?? kommuner[0]?.fylke ?? ""}
              kartlagte={kommuner}
              sammenligning={
                utvalgt
                  ? {
                      navn: utvalgt.kommune.navn,
                      organer: utvalgt.oversikt.dekning.organer,
                      roller: utvalgt.oversikt.dekning.roller,
                      hull: utvalgt.hull,
                    }
                  : null
              }
              valgt={valgt}
              onVelg={settValgt}
            />
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
                <ProSkjema kommuner={kjente} standard={utvalgt?.kommune.kommunenr ?? null} />
              </div>
            </div>
          </Sidedel>
        </div>
      </main>
      <Sidefot
        sammenstilt={utvalgt?.kommune.sammenstilt ?? null}
        terrengKreditt={utvalgt?.terreng?.attribusjon ?? null}
      />
      {utvalgt && <ForhandsversjonBunn sammenstilt={utvalgt.kommune.sammenstilt} proHref="#pro" />}
    </>
  );

  // Kontekstene gir tegnforklaringen og kildelappen tellingene fra datasettet som vises.
  return utvalgt ? (
    <KommuneKontekst oversikt={utvalgt.oversikt} proHref="#pro">
      {innhold}
    </KommuneKontekst>
  ) : (
    innhold
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
