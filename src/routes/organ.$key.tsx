// Organprofilen. PLASSHOLDER: seksjonsbyggeren for organkartet eier denne
// ruten og bygger profilen (myndighet, roller nå og før, eierskap begge veier,
// nøkkeltall med år, hendelser og kilder). Ruten løser allerede opp nøkkelen og
// gir 404 for ukjente organer, så lenkene fra kommunesiden virker og kan
// forhåndsrendres.

import { createFileRoute, notFound } from "@tanstack/react-router";

import { Sidefot } from "@/components/maktkart/sidefot";
import { Topplinje } from "@/components/maktkart/topplinje";
import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { NIVAANAVN, ORGANTYPENAVN } from "@/lib/navn";

export const Route = createFileRoute("/organ/$key")({
  loader: async ({ params }) => {
    // Dynamisk import: loadere deles ikke opp, og datasettet skal ikke i hovedbunten.
    const { data } = await import("@/lib/data");
    const profil = await data.organ_profil(params.key);
    if (!profil) throw notFound();
    return profil;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.organ.navn} | Maktkart`
          : "Organet finnes ikke | Maktkart",
      },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ],
  }),
  component: Organprofil,
});

function Organprofil() {
  const profil = Route.useLoaderData();
  const { organ } = profil;
  const sammenstilt = profil.kommuner[0]?.sammenstilt ?? null;

  return (
    <>
      <Topplinje sammenstilt={sammenstilt} />
      <main id="innhold" className="ramme py-16">
        <p className="region mb-3 text-[0.75rem] text-dempet">
          {NIVAANAVN[organ.nivaa]} · {ORGANTYPENAVN[organ.organtype]}
        </p>
        <h1 className="tittel max-w-[20ch] text-[clamp(2.25rem,1.5rem+3vw,3.75rem)]">
          {organ.navn}
        </h1>
        <p className="ingress mt-5 max-w-[60ch] text-dempet">{organ.beskrivelse}</p>
        <div className="mt-10 max-w-[60ch] border border-dashed border-kote px-5 py-4 text-[0.875rem]">
          <p className="region mb-2 text-[0.6875rem] text-kote-tekst">Plassholder</p>
          Organprofilen bygges her.
        </div>
      </main>
      <Sidefot sammenstilt={sammenstilt} />
      {sammenstilt && <ForhandsversjonBunn sammenstilt={sammenstilt} tegnforklaring={false} />}
    </>
  );
}
