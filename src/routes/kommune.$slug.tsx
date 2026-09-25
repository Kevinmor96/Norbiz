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
//
// Hele siden rendres på serveren, men bare `Lettside` (topplinjen,
// tegnforklaringen, forhåndsvarselet) serialiseres inn i HTML-en. Hele
// `Kommuneside` er pakket i `BareServer` og skrives som null (src/lib/kommuneside.ts).
// Hver seksjon står i en Suspense-grense. I nettleseren venter grensen på hele
// siden, som hentes etter at siden er vist (src/lib/data/hent.ts). Så lenge den
// venter, står serverens HTML urørt: React hydrerer ikke grensen før dataene er
// der, og da med de samme dataene, så ingenting tegnes på nytt. Siden er lesbar
// og lenkene virker fra første byte; knappene, søkene og skuffen virker når
// seksjonen er hydrert. Ved navigering i nettleseren henter loaderen hele
// siden før den vises, og grensene venter ikke.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Suspense, use, type ReactNode } from "react";

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
import { ForhandsversjonBunn, varselForRoller } from "@/components/maktkart/forhandsversjon";
import { KommuneKontekst } from "@/components/maktkart/kommune-kontekst";
import { MargIndeks } from "@/components/maktkart/marg-indeks";
import { Sidefot } from "@/components/maktkart/sidefot";
import { Topplinje } from "@/components/maktkart/topplinje";
import { OrganSkuffVert } from "@/components/organ/organ-skuff";
import { BareServer } from "@/lib/bare-server";
import { hentKommuneside } from "@/lib/data/hent";
import { datoKort, tall } from "@/lib/format";
import type { Kommuneside as Side } from "@/lib/kommuneside";
import { lettside } from "@/lib/lettside";
import { nettstedUrl } from "@/lib/nettsted";

/** Hele kommunesiden: på serveren fra datalaget, i nettleseren fra hent.ts. */
const lastSiden = createIsomorphicFn()
  .server(async (slug: string) => (await import("@/lib/kommuneside")).lastKommuneside(slug))
  .client((slug: string) => hentKommuneside(slug));

export const Route = createFileRoute("/kommune/$slug")({
  loader: async ({ params }) => {
    const side = await lastSiden(params.slug);
    if (!side) throw notFound();
    return { lett: lettside(side), full: new BareServer(side) };
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
    const { kommune, oversikt } = loaderData.lett;
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

/**
 * Hele siden til en seksjon. På serveren og etter navigering er den med i
 * loaderdataene. Under hydreringen er den ikke det: da venter `use` på
 * hentingen, og Suspense-grensen rundt beholder serverens HTML til den er
 * ferdig. Løftet er det samme for alle seksjonene (hent.ts husker det).
 */
function Medsiden({
  slug,
  full,
  children,
}: {
  slug: string;
  full: Side | null;
  children: (side: Side) => ReactNode;
}) {
  const side = full ?? use(hentSikkert(slug));
  return children(side);
}

/**
 * Hentingen for seksjonene. Feiler den, prøves den én gang til. Feiler den
 * igjen, løses løftet aldri: seksjonene blir stående som serverens HTML, som er
 * lesbar og har vanlige lenker, i stedet for å byttes ut med en feilmelding.
 */
const hentinger = new Map<string, Promise<Side>>();
function hentSikkert(slug: string): Promise<Side> {
  let p = hentinger.get(slug);
  if (!p) {
    p = (async () => {
      for (let forsok = 0; forsok < 2; forsok++) {
        try {
          const side = await hentKommuneside(slug);
          if (side) return side;
        } catch (feil) {
          console.warn(`Kommunesiden for ${slug} kunne ikke hentes`, feil);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      return new Promise<Side>(() => {});
    })();
    hentinger.set(slug, p);
  }
  return p;
}

/** En seksjon som hydreres når hele siden er hentet. Reserven vises bare ved en feil i grensen. */
function Utsatt({
  slug,
  full,
  children,
}: {
  slug: string;
  full: Side | null;
  children: (side: Side) => ReactNode;
}) {
  return (
    <Suspense fallback={<div className="ramme min-h-[40vh]" aria-busy="true" />}>
      <Medsiden slug={slug} full={full}>
        {children}
      </Medsiden>
    </Suspense>
  );
}

function Kommuneside() {
  const { lett, full } = Route.useLoaderData();
  const { kommune } = lett;
  const slug = kommune.slug;
  const side = full.verdi;
  const varsel = varselForRoller(`i ${kommune.navn}`, lett.grader);

  return (
    <KommuneKontekst oversikt={lett.oversikt} metodeHref="#metode" proHref="#pro">
      <Topplinje
        kommune={{ navn: kommune.navn, kommunenr: kommune.kommunenr }}
        sammenstilt={kommune.sammenstilt}
        varsel={varsel}
        metodeHref="#metode"
        proHref="#pro"
      />
      <main id="innhold">
        <Utsatt slug={slug} full={side}>
          {(s) => <ToppSeksjon side={s} />}
        </Utsatt>
        <MargIndeks seksjoner={SEKSJONER}>
          <Utsatt slug={slug} full={side}>
            {(s) => <KjedeSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <OrgankartSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <PengeneSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <NettverkSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <EndringerSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <BransjeSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <NesteSeksjon side={s} />}
          </Utsatt>
          <Utsatt slug={slug} full={side}>
            {(s) => <MetodeProSeksjon side={s} />}
          </Utsatt>
        </MargIndeks>
      </main>
      <Sidefot
        sammenstilt={kommune.sammenstilt}
        kommunenavn={kommune.navn}
        terrengKreditt={lett.terrengKreditt}
        metodeHref="#metode"
      />
      <ForhandsversjonBunn sammenstilt={kommune.sammenstilt} varsel={varsel} proHref="#pro" />
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
