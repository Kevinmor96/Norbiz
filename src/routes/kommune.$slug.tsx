// Kommunesiden: produktet (spec §3). Hver seksjon får hele kommunesiden som
// `side` og henter det den trenger derfra (se src/components/kommune/seksjoner.ts).
//
// Organskuffen står her, én gang for hele siden, og ikke i en seksjon. Da
// åpner et organnavn skuffen fra hvilken som helst seksjon, og skuffen
// finnes selv om en seksjon tas bort.
//
// Loaderen slår opp sluggen blant kommunene med datasett. Ukjent slug gir 404.
// Alt siden viser, kommer fra lese-API-et i src/lib/data, så byttet til
// Supabase endrer ikke denne fila.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { BransjeSeksjon } from "@/components/kommune/bransje";
import { EndringerSeksjon } from "@/components/kommune/endringer";
import { KjedeSeksjon } from "@/components/kommune/kjede";
import { MetodeProSeksjon } from "@/components/kommune/metode-pro";
import { NesteSeksjon } from "@/components/kommune/neste";
import { NettverkSeksjon } from "@/components/kommune/nettverk";
import { OrgankartSeksjon } from "@/components/kommune/organkart";
import { PengeneSeksjon } from "@/components/kommune/pengene";
import { SEKSJONER } from "@/components/kommune/seksjoner";
import { ToppSeksjon } from "@/components/kommune/topp";
import { ForhandsversjonBunn } from "@/components/maktkart/forhandsversjon";
import { KommuneKontekst } from "@/components/maktkart/kommune-kontekst";
import { MargIndeks } from "@/components/maktkart/marg-indeks";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Topplinje } from "@/components/maktkart/topplinje";
import { OrganSkuffVert } from "@/components/organ/organ-skuff";
import { datoKort, tall } from "@/lib/format";
import { lastKommuneside } from "@/lib/kommuneside";
import { nettstedUrl } from "@/lib/nettsted";

export const Route = createFileRoute("/kommune/$slug")({
  loader: async ({ params }) => {
    const side = await lastKommuneside(params.slug);
    if (!side) throw notFound();
    return side;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Kommunen er ikke kartlagt | Maktkart" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { kommune, oversikt } = loaderData;
    const tittel = `Hvem bestemmer i ${kommune.navn}? | Maktkart`;
    const beskrivelse =
      `Organene, rollene og pengene i ${kommune.navn} kommune: ${tall(oversikt.dekning.organer)} organer, ` +
      `${tall(oversikt.dekning.roller)} roller og ${tall(oversikt.eierskap.direkte)} eierandeler, med kilde og dato på hver påstand. ` +
      `Sammenstilt ${datoKort(kommune.sammenstilt)}, ikke etterprøvd mot Brreg.`;
    const url = nettstedUrl(`/kommune/${params.slug}`);
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
  component: Kommuneside,
  notFoundComponent: KommuneIkkeFunnet,
});

function Kommuneside() {
  const side = Route.useLoaderData();
  const { kommune } = side;

  return (
    <KommuneKontekst oversikt={side.oversikt} metodeHref="#metode" proHref="#pro">
      <Topplinje
        kommune={{ navn: kommune.navn, kommunenr: kommune.kommunenr }}
        sammenstilt={kommune.sammenstilt}
        metodeHref="#metode"
        proHref="#pro"
      />
      <main id="innhold">
        <ToppSeksjon side={side} />
        <MargIndeks seksjoner={SEKSJONER}>
          <KjedeSeksjon side={side} />
          <OrgankartSeksjon side={side} />
          <PengeneSeksjon side={side} />
          <NettverkSeksjon side={side} />
          <EndringerSeksjon side={side} />
          <BransjeSeksjon side={side} />
          <NesteSeksjon side={side} />
          <MetodeProSeksjon side={side} />
        </MargIndeks>
      </main>
      <Sidefot
        sammenstilt={kommune.sammenstilt}
        kommunenavn={kommune.navn}
        terrengKreditt={side.terreng?.attribusjon ?? null}
        metodeHref="#metode"
      />
      <ForhandsversjonBunn sammenstilt={kommune.sammenstilt} proHref="#pro" />
      <OrganSkuffVert />
    </KommuneKontekst>
  );
}

function KommuneIkkeFunnet() {
  const { slug } = Route.useParams();
  return (
    <>
      <Topplinje />
      <main id="innhold" className="ramme py-24">
        <p className="region mb-3 text-[0.75rem] text-dempet">Ikke kartlagt</p>
        <h1 className="tittel max-w-[18ch] text-[clamp(2.25rem,1.5rem+3vw,3.75rem)]">
          Vi har ikke kartlagt «{slug}» ennå.
        </h1>
        <p className="ingress mt-5 max-w-[48ch] text-dempet">
          Adressen peker til en kommune vi ikke har datasett for, eller den er skrevet feil. Tromsø
          er den første kommunen i kartet.
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
