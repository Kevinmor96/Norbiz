// Organprofilen som egen side (spec §2): myndighet, roller nå og før,
// eierskap begge veier, nøkkeltall med år, plass og koblinger, hendelser,
// bransjer, det vi ikke vet og kildene. Samme innhold som organskuffen på
// kommunesiden, fra samme komponent, så de aldri sier forskjellige ting.
//
// Siden rendres på serveren og skal kunne hentes opp i søk («hvem leder Troms
// Kraft»). Ukjent nøkkel gir 404. Modus er Operere (DESIGN.md): skanbarhet
// slår uttrykk.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { Topplinje } from "@/components/maktkart/topplinje";
import {
  nivaalinje,
  ProfilDeler,
  ProfilFakta,
  ProfilKommuner,
  profilbeskrivelse,
} from "@/components/organ/organ-profil";
import type { OrganProfil, Verifiseringstelling } from "@/lib/data";
import { tilSiden } from "@/lib/nyttelast";
import { nettstedUrl } from "@/lib/nettsted";

export const Route = createFileRoute("/organ/$key")({
  loader: async ({ params }) => {
    // Dynamisk import: loadere deles ikke opp, og datasettet skal ikke i hovedbunten.
    const { data } = await import("@/lib/data");
    const profil = await data.organ_profil(params.key);
    if (!profil) throw notFound();
    // Profilen serialiseres inn i HTML-en. Se src/lib/nyttelast.ts.
    return tilSiden(profil);
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Organet finnes ikke | Maktkart" }, { name: "robots", content: "noindex" }],
      };
    }
    const tittel = `${loaderData.organ.navn} | Maktkart`;
    const beskrivelse = profilbeskrivelse(loaderData, loaderData.kommuner[0]?.sammenstilt ?? null);
    const url = nettstedUrl(`/organ/${params.key}`);
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
  component: Organprofil,
  notFoundComponent: OrganIkkeFunnet,
});

/**
 * Påstandene på siden etter grad, regnet fra profilen. Tegnforklaringen og
 * filteret teller herfra, aldri fra hvor mange merker som står på siden.
 */
function telling(p: OrganProfil): Verifiseringstelling {
  const t: Verifiseringstelling = { verifisert: 0, oppgitt: 0, maa_verifiseres: 0 };
  const belegg = [
    p.organ.belegg,
    ...p.roller.naa.map((r) => r.belegg),
    ...p.roller.tidligere.map((r) => r.belegg),
    ...p.eiere.map((e) => e.belegg),
    ...p.eierandeler.map((e) => e.belegg),
    ...p.relasjoner.map((r) => r.belegg),
    ...p.nokkeltall.map((n) => n.belegg),
    ...p.hendelser.map((h) => h.belegg),
  ];
  for (const b of belegg) t[b.verifisering] += 1;
  return t;
}

function Brodsmuler({ profil }: { profil: OrganProfil }) {
  const kommune = profil.kommuner[0] ?? null;
  const ledd: { til: ReactNode; key: string }[] = [
    {
      key: "forside",
      til: (
        <Link to="/" className="underline decoration-linje-sterk hover:decoration-signal">
          Maktkart
        </Link>
      ),
    },
  ];
  if (kommune) {
    ledd.push(
      {
        key: "kommune",
        til: (
          <a
            href={`/kommune/${kommune.slug}`}
            className="underline decoration-linje-sterk hover:decoration-signal"
          >
            {kommune.navn}
          </a>
        ),
      },
      {
        key: "organkart",
        til: (
          <a
            href={`/kommune/${kommune.slug}#organer`}
            className="underline decoration-linje-sterk hover:decoration-signal"
          >
            Organkartet
          </a>
        ),
      },
    );
  }
  return (
    <nav aria-label="Brødsmuler" className="text-[0.875rem] text-dempet">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {ledd.map((l) => (
          <li key={l.key} className="inline-flex items-center gap-1.5">
            {l.til}
            <ChevronRight className="size-3.5 text-linje-sterk" aria-hidden="true" />
          </li>
        ))}
        <li aria-current="page" className="min-w-0 font-semibold text-trykk">
          {profil.organ.kortnavn ?? profil.organ.navn}
        </li>
      </ol>
    </nav>
  );
}

function Organprofil() {
  const profil = Route.useLoaderData();
  const { organ } = profil;
  const kommune = profil.kommuner[0] ?? null;
  const sammenstilt = kommune?.sammenstilt ?? null;

  return (
    <>
      <Topplinje
        kommune={kommune ? { navn: kommune.navn, kommunenr: kommune.kommunenr } : null}
        sammenstilt={sammenstilt}
      />
      <main id="innhold" className="ramme pt-6 pb-16 md:pt-8">
        <Brodsmuler profil={profil} />

        <header className="mt-8 flex max-w-[62ch] flex-col gap-3 md:mt-12">
          <p className="region text-[0.75rem] text-dempet">{nivaalinje(organ)}</p>
          <h1 className="tittel text-[clamp(2rem,1.4rem+2.6vw,3.25rem)]">{organ.navn}</h1>
          <ProfilKommuner profil={profil} />
        </header>

        <div className="mt-8 grid gap-x-12 gap-y-10 border-t border-trykk pt-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <ProfilDeler
            profil={profil}
            overskrift="h2"
            utelat={["bransjer", "kilder"]}
            className="min-w-0 max-w-[46rem]"
          />
          <aside aria-label="Fakta og kilder" className="flex min-w-0 flex-col gap-8">
            <section
              aria-labelledby="fakta-tittel"
              className="border border-trykk bg-flate px-4 py-4"
            >
              <h2 id="fakta-tittel" className="region mb-3 text-[0.6875rem] text-dempet">
                Registeropplysninger
              </h2>
              <ProfilFakta profil={profil} />
            </section>
            <Tegnforklaring overskrift="h2" telling={telling(profil)} />
            <ProfilDeler
              profil={profil}
              overskrift="h2"
              utelat={[
                "beskrivelse",
                "roller",
                "eierskap",
                "nokkeltall",
                "plass",
                "hendelser",
                "hull",
              ]}
            />
          </aside>
        </div>
      </main>
      <Sidefot sammenstilt={sammenstilt} kommunenavn={kommune?.navn ?? null} />
      {sammenstilt && <ForhandsversjonBunn sammenstilt={sammenstilt} tegnforklaring={false} />}
    </>
  );
}

function OrganIkkeFunnet() {
  const { key } = Route.useParams();
  return (
    <>
      <Topplinje />
      <main id="innhold" className="ramme py-24">
        <p className="region mb-3 text-[0.75rem] text-dempet">Ikke i kartet</p>
        <h1 className="tittel max-w-[18ch] text-[clamp(2.25rem,1.5rem+3vw,3.75rem)]">
          Organet «{key}» finnes ikke i datasettet.
        </h1>
        <p className="ingress mt-5 max-w-[48ch] text-dempet">
          Lenken kan være skrevet feil, eller organet kan være fjernet. Organkartet på kommunesiden
          viser alle organene vi har kartlagt.
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
