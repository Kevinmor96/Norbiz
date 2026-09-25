// Metodesiden (spec §2, modus Operere): hvordan tallene er sammenstilt, hva
// merkene betyr, hva «Forhåndsversjon» betyr, kildene, personvernet og «Er
// dette deg?». Skanbarhet slår uttrykk. Margen med innhold og tegnforklaring
// er den samme som på kommunesiden.
//
// Siden gjelder alle kommuner. Tellingene kommer fra datasettene, og står det
// flere, gjelder merketellingene det største.
//
// Ankere andre sider lenker til: #merkene (kildelappen), #kilder, #personvern
// og #retting.

import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import { Sidedel } from "@/components/forside/sidedel";
import { HullListe } from "@/components/kommune/metode-pro/hull-liste";
import { Innsigelsesskjema } from "@/components/kommune/metode-pro/innsigelse";
import { Kildeliste } from "@/components/kommune/metode-pro/kildeliste";
import { Personvern } from "@/components/kommune/metode-pro/personvern";
import { Verifisering } from "@/components/kommune/metode-pro/verifisering";
import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { MERKENE_ANKER } from "@/components/maktkart/kildelapp";
import { KommuneKontekst } from "@/components/maktkart/kommune-kontekst";
import { MargIndeks } from "@/components/maktkart/marg-indeks";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { Topplinje } from "@/components/maktkart/topplinje";
import { fraServeren } from "@/lib/data/hent";
import { datoKort, tall } from "@/lib/format";
import { nettstedUrl } from "@/lib/nettsted";

const TITTEL = "Metode og personvern | Maktkart";
const BESKRIVELSE =
  "Hvordan Maktkart sammenstiller organene, rollene og pengene i en kommune: kildene, de tre verifiseringsgradene, personvernet og hvordan du ber om retting hvis du står i kartet.";

const DELER = [
  { id: "sammenstilling", navn: "Sammenstillingen" },
  { id: "forhandsversjon", navn: "Forhåndsversjonen" },
  // Kildelappens «Om kildemerkene» lenker hit (MERKENE_ANKER i kildelapp.tsx).
  { id: MERKENE_ANKER, navn: "Merkene" },
  { id: "verifisering", navn: "Verifiseringen" },
  { id: "kilder", navn: "Kildene" },
  { id: "personvern", navn: "Personvern" },
  { id: "retting", navn: "Er dette deg?" },
] as const;

/** Gjennom en serverfunksjon, så datalaget aldri lastes i nettleseren (src/lib/data/hent.ts). */
const metodeFn = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/metode-data")).lastMetode(),
);

export const Route = createFileRoute("/metode")({
  loader: () => fraServeren(() => metodeFn(), "/metode"),
  head: () => {
    const url = nettstedUrl("/metode");
    return {
      meta: [
        { title: TITTEL },
        { name: "description", content: BESKRIVELSE },
        { property: "og:title", content: TITTEL },
        { property: "og:description", content: BESKRIVELSE },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "nb_NO" },
        { name: "twitter:title", content: TITTEL },
        { name: "twitter:description", content: BESKRIVELSE },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Metode,
});

const lenke =
  "font-semibold text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal";

function Avsnitt({ children }: { children: ReactNode }) {
  return <p className="brodtekst text-pretty">{children}</p>;
}

function Metode() {
  const { datasett } = Route.useLoaderData();
  const forst = datasett[0];
  const sammenstilt = forst?.oversikt.kommune.sammenstilt ?? null;
  // Alle organer fra alle datasett, én gang hver.
  const organer = [
    ...new Map(datasett.flatMap((d) => d.organer).map((o) => [o.key, o])).values(),
  ].sort((a, b) => a.navn.localeCompare(b.navn, "nb"));

  const side = (
    <>
      <Topplinje sammenstilt={sammenstilt} metodeHref="#sammenstilling" />
      <main id="innhold">
        <header className="ramme pt-[clamp(28px,5vw,64px)] pb-[clamp(24px,3vw,40px)]">
          <h1 className="tittel max-w-[16ch] text-[clamp(2.25rem,1.5rem+3vw,3.75rem)]">
            Slik vet vi det vi viser
          </h1>
          <p className="ingress mt-5 max-w-[56ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
            Hvordan tallene er sammenstilt, hva merkene betyr, hvilke kilder vi bruker og hvordan
            personvernet er bygget inn. Står du i kartet, kan du be om retting{" "}
            <a href="#retting" className={lenke}>
              nederst på siden
            </a>
            .
          </p>
        </header>
        <MargIndeks seksjoner={DELER}>
          <Sidedel id="sammenstilling" tittel="Slik er tallene sammenstilt" smal>
            <div className="flex flex-col gap-6">
              <Avsnitt>
                Hver kommune har ett datasett. Det er sammenstilt fra et researchgrunnlag der hver
                opplysning har en navngitt kilde: registrene, organenes egne sider, redaksjonelle
                kilder og videreformidlere som Proff og Purehelp. Siden og databasen leser det samme
                datasettet, så de kan ikke si forskjellige ting.
              </Avsnitt>
              <Avsnitt>
                Et tall uten regnskapsår tas ikke inn. Det føres som et hull til året er kjent. Der
                kilden skiller morselskap og konsern, står det ved tallet. Det som er planlagt eller
                foreslått, som et valg eller en strukturdebatt, har egen form og regnes aldri som
                skjedd.
              </Avsnitt>
              {datasett.length > 0 ? (
                <table className="w-full max-w-[44rem] border-collapse text-left text-[0.9375rem]">
                  <caption className="mb-2 caption-top text-left text-[0.875rem] font-semibold">
                    Datasettene
                  </caption>
                  <thead>
                    <tr className="text-[0.8125rem] text-dempet">
                      <th scope="col" className="pb-2 font-semibold">
                        Kommune
                      </th>
                      <th scope="col" className="pb-2 text-right font-semibold">
                        Organer
                      </th>
                      <th scope="col" className="pb-2 text-right font-semibold max-sm:hidden">
                        Roller
                      </th>
                      <th scope="col" className="pb-2 text-right font-semibold">
                        Påstander
                      </th>
                      <th scope="col" className="pb-2 text-right font-semibold">
                        Hull
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasett.map(({ oversikt: o }) => (
                      <tr
                        key={o.kommune.kommunenr}
                        className="border-t border-linje align-baseline"
                      >
                        <th scope="row" className="py-2.5 pr-3 font-normal">
                          <Link
                            to="/kommune/$slug"
                            params={{ slug: o.kommune.slug }}
                            className={lenke}
                          >
                            {o.kommune.navn}
                          </Link>
                          <span className="block text-[0.8125rem] text-dempet">
                            Sammenstilt {datoKort(o.kommune.sammenstilt)}
                          </span>
                        </th>
                        <td className="py-2.5 pl-3 text-right tabular-nums">
                          {tall(o.dekning.organer)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums max-sm:hidden">
                          {tall(o.dekning.roller)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums">
                          {tall(
                            o.verifisering.verifisert +
                              o.verifisering.oppgitt +
                              o.verifisering.maa_verifiseres,
                          )}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums">
                          {tall(o.dekning.hull)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="border border-dashed border-kote px-4 py-3.5 text-[0.9375rem]">
                  Ingen kommune er kartlagt ennå.
                </p>
              )}
            </div>
          </Sidedel>

          <Sidedel id="forhandsversjon" tittel="Hva «Forhåndsversjon» betyr" smal>
            <div className="flex flex-col gap-5">
              <Avsnitt>
                Ingen påstand er etterprøvd mot registrene ennå. Innhentingen fra
                Brønnøysundregistrene har ikke kjørt, så alt står slik researchgrunnlaget oppga det.
                Derfor har ingen merker graden verifisert, og derfor står «Forhåndsversjon» på hver
                side til innhentingen har kjørt.
              </Avsnitt>
              <Avsnitt>
                Vi skriver datoen datasettet ble sammenstilt
                {sammenstilt ? `, ${datoKort(sammenstilt)}` : ""}. Vi kaller ingenting ferskt før
                innhentingen faktisk holder det oppdatert.
              </Avsnitt>
            </div>
          </Sidedel>

          <Sidedel
            id={MERKENE_ANKER}
            smal
            tittel="Hva merkene betyr"
            ingress={
              forst && datasett.length > 1
                ? `Tellingene gjelder datasettet for ${forst.oversikt.kommune.navn}.`
                : undefined
            }
          >
            <Tegnforklaring form="full" tittel="Tre grader, tre former" overskrift="h3" />
          </Sidedel>

          <Sidedel id="verifisering" tittel="Slik blir en påstand verifisert" smal>
            {forst ? (
              <Verifisering
                telling={forst.oversikt.verifisering}
                sammenstilt={forst.oversikt.kommune.sammenstilt}
              />
            ) : null}
          </Sidedel>

          <Sidedel
            id="kilder"
            smal
            tittel="Kildene"
            ingress="Vi henter ved kilden. Registrene går foran organenes egne sider, og de går foran redaksjonelle kilder og videreformidlere."
          >
            <div className="flex flex-col gap-12">
              {datasett.map(({ oversikt: o, hull }) => (
                <div key={o.kommune.kommunenr} className="flex max-w-[44rem] flex-col gap-4">
                  <h3 className="text-[1.0625rem] font-bold">Datasettet for {o.kommune.navn}</h3>
                  <Kildeliste kilder={o.kilder} />
                  <HullListe hull={hull} />
                </div>
              ))}
            </div>
          </Sidedel>

          <Sidedel
            id="personvern"
            smal
            tittel="Personvern"
            ingress="Kartet handler om makt i institusjoner. Personer står der bare fordi de har en offentlig rolle."
          >
            <Personvern />
          </Sidedel>

          <Sidedel
            id="retting"
            smal
            tittel="Er dette deg?"
            ingress="Står du i kartet og ser en feil, kan du be om retting. Du kan også protestere mot at opplysningen vises, eller be oss slette den."
          >
            <div className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <Innsigelsesskjema organer={organer} />
              <div className="flex max-w-[40ch] flex-col gap-3 text-[0.9375rem] leading-[1.5] text-dempet">
                <p className="text-pretty">
                  Retting, protest og sletting er rettighetene dine etter personvernforordningen
                  (artikkel 16, 21 og 17).
                </p>
                <p className="text-pretty">
                  Vi sjekker opplysningen mot kilden. Tas en protest eller en sletting til følge,
                  sperres personen i basen, og da forsvinner rollen og alt som nevner personen fra
                  sidene.
                </p>
              </div>
            </div>
          </Sidedel>
        </MargIndeks>
      </main>
      <Sidefot sammenstilt={sammenstilt} metodeHref="/metode" />
      {sammenstilt && <ForhandsversjonBunn sammenstilt={sammenstilt} />}
    </>
  );

  return forst ? (
    <KommuneKontekst oversikt={forst.oversikt} metodeHref={`#${MERKENE_ANKER}`}>
      {side}
    </KommuneKontekst>
  ) : (
    side
  );
}
