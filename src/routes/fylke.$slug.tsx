// Fylkessiden: hvem bestemmer i fylket? Kartbladet for fylket, fylkeskommunens
// politiske og administrative topp, Statsforvalteren, stortingsbenken,
// kommunene som kartbladoversikt og de største virksomhetene.
//
// Alt kommer fra datalaget (`region_oversikt`, `fylke_oversikt`) gjennom
// region/last.ts. Malen vet ikke hvilket fylke den viser. Ukjent slug gir 404.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { Seksjon } from "@/components/maktkart/seksjon";
import {
  ForhandsversjonBunn,
  hentetDato,
  varselForRoller,
} from "@/components/maktkart/forhandsversjon";
import { MedMerke } from "@/components/maktkart/kildemerke";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { Topplinje } from "@/components/maktkart/topplinje";
import { Dekningsforklaring } from "@/components/region/dekning";
import { Kommuneindeks, Organblokk, Storste, Stortingsbenk } from "@/components/region/fylke";
import { GRENSER } from "@/components/region/geometri";
import { fraServeren, hentFylkeside } from "@/components/region/hent";
import { Gradstolpe } from "@/components/region/gradstolpe";
import { offisielt } from "@/components/region/navn";
import { Regionkart } from "@/components/region/regionkart";
import type { FylkeOrgan } from "@/lib/data";
import { antall, tall } from "@/lib/format";
import { NIVAANAVN } from "@/lib/navn";
import { nettstedUrl } from "@/lib/nettsted";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fylke/$slug")({
  // Gjennom en serverfunksjon, så fylkets datasett aldri lastes i nettleseren
  // (region/hent.ts). Svaret endres bare ved en ny utrulling.
  loader: async ({ params }) => {
    const side = await fraServeren(
      () => hentFylkeside({ data: { slug: params.slug } }),
      `/fylke/${params.slug}`,
    );
    if (!side) throw notFound();
    return side;
  },
  staleTime: Infinity,
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Fylket finnes ikke | Maktkart" }, { name: "robots", content: "noindex" }],
      };
    }
    const { fylke } = loaderData;
    const r = fylke.grader.roller;
    const tittel = `Hvem bestemmer i ${fylke.navn}? | Maktkart`;
    const beskrivelse =
      `Fylkeskommunen, Statsforvalteren, stortingsbenken og de ${tall(fylke.antall_kommuner)} kommunene i ` +
      `${fylke.navn_offisielt}: ${tall(fylke.dekning.organer)} organer og ${tall(fylke.dekning.roller)} roller, med kilde og dato på hver påstand.` +
      (r.totalt
        ? ` ${tall(r.verifisert)} av ${tall(r.totalt)} roller er hentet direkte fra registrene${hentetDato(fylke.grader.forst_hentet, fylke.grader.sist_hentet)}.`
        : "");
    const url = nettstedUrl(`/fylke/${params.slug}`);
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
  component: Fylkeside,
  notFoundComponent: FylkeIkkeFunnet,
});

function Fylkeside() {
  const side = Route.useLoaderData();
  const { fylke, kommuner } = side;
  const varsel = varselForRoller(`i ${fylke.navn}`, fylke.grader);
  const politiskeLedere = side.politisk.filter((o) => o.ledere.length);
  const ingenTopp = !side.fylkeskommune && !side.statsforvalter.length && !side.storting.length;

  return (
    <>
      <Topplinje
        kommune={{
          navn: fylke.navn,
          kommunenr: fylke.fylkesnr,
          nummertekst: `fylke ${fylke.fylkesnr}`,
        }}
        varsel={varsel}
      />
      <main id="innhold">
        <section
          aria-labelledby="fylke-tittel"
          className="ramme pt-[clamp(28px,5vw,64px)] pb-[clamp(24px,4vw,48px)]"
        >
          {/* Som på forsiden: på mobil kommer kartet rett etter ingressen. */}
          <div className="grid gap-x-6 gap-y-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-y-7">
            <div className="flex min-w-0 flex-col gap-7 lg:col-span-5 lg:pt-3">
              <div className="flex flex-col gap-4">
                <p className="region text-[0.75rem] text-dempet sm:text-[0.8125rem]">
                  Fylke {fylke.fylkesnr} · {antall(fylke.antall_kommuner, "kommune", "kommuner")}
                </p>
                <h1
                  id="fylke-tittel"
                  className="tittel text-[clamp(2.25rem,1.2rem+3.4vw,4.25rem)] lg:text-[clamp(2.75rem,0.6rem+3.9vw,4.25rem)]"
                >
                  Hvem bestemmer i {offisielt(fylke.navn_offisielt)}?
                </h1>
              </div>
              <p className="ingress max-w-[38ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
                Fylkeskommunen, Statsforvalteren, stortingsbenken og de{" "}
                {tall(fylke.antall_kommuner)} kommunene i {fylke.navn}. Hver påstand har kilde og
                dato.
              </p>
            </div>
            <Regionkart
              className="lg:col-span-7 lg:row-span-2"
              kommuner={kommuner}
              fylker={[{ fylkesnr: fylke.fylkesnr, navn: fylke.navn, slug: fylke.slug }]}
              fylkesnr={fylke.fylkesnr}
              tittel={fylke.navn}
              undertittel={`Kartblad ${fylke.fylkesnr} · ${antall(fylke.antall_kommuner, "kommune", "kommuner")}`}
            >
              <Dekningsforklaring klasser={fylke.klasser} />
            </Regionkart>
            <div className="flex min-w-0 flex-col gap-7 lg:col-span-5">
              <dl className="grid max-w-[30rem] grid-cols-2 gap-x-6 gap-y-4 border-t border-trykk pt-4">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[0.8125rem] text-dempet">
                    Innbyggere 1.1.{fylke.folketall.aar}
                  </dt>
                  <dd className="text-[1.5rem] font-bold tracking-[-0.015em]">
                    <MedMerke
                      belegg={fylke.folketall.belegg}
                      pastand={`${fylke.navn} hadde ${tall(fylke.folketall.verdi)} innbyggere 1. januar ${fylke.folketall.aar}`}
                    >
                      {tall(fylke.folketall.verdi)}
                    </MedMerke>
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[0.8125rem] text-dempet">I datasettene, telt én gang</dt>
                  <dd className="text-[0.9375rem] leading-[1.35] font-semibold">
                    {antall(fylke.dekning.organer, "organ", "organer")}
                    <br />
                    {antall(fylke.dekning.roller, "rolle", "roller")}
                  </dd>
                </div>
                <Gradstolpe className="col-span-2" telling={fylke.grader.roller} hva="roller" />
              </dl>
              <Tegnforklaring className="max-w-[30rem]" telling={fylke.grader.alle} />
            </div>
          </div>
        </section>

        <div className="ramme">
          {ingenTopp ? (
            // Designet tom tilstand: når ingenting av fylkets egne organer er i
            // datasettene, sier én seksjon det, i stedet for tre tomme.
            <Seksjon
              id="fylkeskommunen"
              region="Fylkeskommunen og staten"
              tittel={`Hvem styrer ${fylke.navn}?`}
            >
              <p className="inline-block border border-dashed border-linje-sterk px-3 py-2 text-[0.9375rem] leading-[1.5] text-dempet">
                Fylkeskommunen, Statsforvalteren og stortingsbenken for {fylke.navn} er ikke
                kartlagt ennå. Kommunene og virksomhetene under er det.
              </p>
            </Seksjon>
          ) : (
            <>
              <Seksjon
                id="fylkeskommunen"
                region="Fylkeskommunen"
                tittel={`Hvem styrer ${side.fylkeskommune?.navn ?? `fylkeskommunen i ${fylke.navn}`}?`}
                ingress={
                  side.fylkeskommune
                    ? "Den politiske toppen vedtar, og den administrative toppen forbereder sakene og setter vedtakene i verk."
                    : undefined
                }
              >
                {side.fylkeskommune ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-3">
                      <h3 className="region text-[0.75rem] text-dempet">Politisk topp</h3>
                      {politiskeLedere.length ? (
                        politiskeLedere.map((o) => <Organblokk key={o.key} organ={o} />)
                      ) : side.politisk[0] ? (
                        <Organblokk organ={side.politisk[0]} tom="Politisk leder ikke kartlagt" />
                      ) : (
                        <Organblokk
                          organ={side.fylkeskommune}
                          ledere={[]}
                          tom="Fylkestinget er ikke kartlagt"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <h3 className="region text-[0.75rem] text-dempet">Administrativ topp</h3>
                      {side.administrativ.length ? (
                        side.administrativ.map((o) => (
                          <Organblokk
                            key={o.key}
                            organ={o}
                            tom="Administrativ leder ikke kartlagt"
                          />
                        ))
                      ) : (
                        <Organblokk
                          organ={side.fylkeskommune}
                          tom="Administrativ leder ikke kartlagt"
                        />
                      )}
                    </div>
                    {side.andre.length > 0 && (
                      <Organliste
                        className="md:col-span-2"
                        innledning="Flere organer i fylkeskommunen:"
                        organer={side.andre}
                      />
                    )}
                    {side.utenfor.length > 0 && (
                      <Organliste
                        className="md:col-span-2"
                        innledning="Utenfor fylkeskommunen, men ført på fylket:"
                        organer={side.utenfor}
                        medNivaa
                      />
                    )}
                  </div>
                ) : (
                  <p className="inline-block border border-dashed border-linje-sterk px-3 py-2 text-[0.9375rem] text-dempet">
                    Fylkeskommunen er ikke kartlagt ennå.
                  </p>
                )}
              </Seksjon>

              <Seksjon
                id="staten"
                region="Staten i fylket"
                tittel={`Hvem representerer staten i ${fylke.navn}?`}
                ingress="Statsforvalteren for kommunene i fylket og stortingsbenken fra fylkets valgkrets, slik datasettene fører dem."
              >
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
                    <h3 className="region text-[0.75rem] text-dempet">Statsforvalteren</h3>
                    {side.statsforvalter.length ? (
                      side.statsforvalter.map((o) => <Organblokk key={o.key} organ={o} />)
                    ) : (
                      <p className="self-start border border-dashed border-linje-sterk px-3 py-2 text-[0.9375rem] text-dempet">
                        Statsforvalteren er ikke kartlagt for kommunene i {fylke.navn} ennå.
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
                    <h3 className="region text-[0.75rem] text-dempet">Stortingsbenken</h3>
                    {side.storting.length ? (
                      side.storting.map((o) => <Stortingsbenk key={o.key} organ={o} />)
                    ) : (
                      <p className="self-start border border-dashed border-linje-sterk px-3 py-2 text-[0.9375rem] text-dempet">
                        Stortingsrepresentantene fra {fylke.navn} er ikke kartlagt ennå.
                      </p>
                    )}
                  </div>
                </div>
              </Seksjon>
            </>
          )}

          <Seksjon
            id="kommunene"
            region="Kommunene"
            tittel={`${tall(fylke.antall_kommuner)} kommuner, ${tall(fylke.kartlagt)} med datasett`}
            ingress="Hvert blad er en kommune. Merket ved folketallet er fra SSB, og dekningen sier hvor mye av svaret datasettet har."
          >
            <Kommuneindeks kommuner={kommuner} fylke={fylke} />
          </Seksjon>

          <Seksjon
            id="virksomhetene"
            region="Virksomhetene"
            tittel={`De største virksomhetene i ${fylke.navn}`}
            ingress="Målt i omsetning, fordi datasettene ikke har antall ansatte med år. Bare virksomheter registrert i en kommune i fylket, med eget regnskap. Tallet gjelder hele virksomheten, også det som skjer utenfor fylket."
          >
            <Storste storste={side.storste} kommuner={kommuner} />
          </Seksjon>
        </div>
      </main>
      <Sidefot varsel={varsel} terrengKreditt={GRENSER.meta.attribusjon} />
      <ForhandsversjonBunn varsel={varsel} />
    </>
  );
}

/** Organer i løpende tekst, hvert med lenke til organsiden. */
function Organliste({
  innledning,
  organer,
  medNivaa = false,
  className,
}: {
  innledning: string;
  organer: FylkeOrgan[];
  /** Skriv nivået etter navnet: «LO Troms (interesseorganisasjon)». */
  medNivaa?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-[0.875rem] leading-[1.5] text-dempet", className)}>
      {innledning}{" "}
      {organer.map((o, i) => (
        <span key={o.key}>
          {i > 0 && ", "}
          <Link
            to="/organ/$key"
            params={{ key: o.key }}
            className="text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
          >
            {o.navn}
          </Link>
          {medNivaa && ` (${NIVAANAVN[o.nivaa].toLowerCase()})`}
        </span>
      ))}
      .
    </p>
  );
}

function FylkeIkkeFunnet() {
  const { slug } = Route.useParams();
  return (
    <>
      <Topplinje />
      <main id="innhold" className="ramme py-24">
        <p className="region mb-3 text-[0.75rem] text-dempet">Finnes ikke</p>
        <h1 className="tittel max-w-[18ch] text-[clamp(2.25rem,1.5rem+3vw,3.75rem)]">
          Vi har ikke noe fylke som heter «{slug}».
        </h1>
        <p className="ingress mt-5 max-w-[48ch] text-dempet">
          Adressen peker til et fylke utenfor regionen, eller den er skrevet feil.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center border border-trykk px-5 font-semibold no-underline transition-transform duration-150 ease-(--ease-ut) active:scale-[0.97]"
        >
          Til forsiden
        </Link>
      </main>
    </>
  );
}
