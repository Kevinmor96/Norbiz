// Seksjon 9: Metode og Pro (DESIGN.md §5.9).
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Denne seksjonen bruker:
//   <Tegnforklaring form="full" />  tegnforklaringen i full form (tellinger fra KommuneKontekst).
//   side.oversikt.verifisering      status for verifiseringen (hvor mange som er verifisert).
//   side.oversikt.kilder            kildelisten med antall påstander per kilde.
//   side.hull                       «Hull i datasettet (N)», kan foldes ut. Fritekst går
//                                   gjennom lesbar() i src/lib/format.ts.
//   side.kommune, side.kommuner     sammenstilt-dato, og kommunene Pro-påmeldingen kan gjelde.
//
// Ankere som MÅ finnes i denne seksjonen, fordi topplinjen, bunnlinjen og
// bunnteksten lenker til dem:
//   #metode  (seksjonen selv)
//   #kilder  kildelisten
//   #pro     Pro-ventelisten («Venteliste for Pro»)
//
// Oppsett: tegnforklaringen og verifiseringen i full bredde, fordi de er
// produktets signatur og trenger plass. Under dem står hullene og kildene til
// venstre og Pro til høyre på skrivebord. På mobil kommer Pro sist.

import { Link } from "@tanstack/react-router";

import { Seksjon } from "@/components/maktkart/seksjon";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";
import { datoKort } from "@/lib/format";

import { HullListe } from "./metode-pro/hull-liste";
import { Kildeliste } from "./metode-pro/kildeliste";
import { ProBlokk } from "./metode-pro/pro";
import { Verifisering } from "./metode-pro/verifisering";
import { kjenteKommuner } from "./neste/valgkretser";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

const underTittel =
  "text-[1.25rem] leading-[1.15] font-bold tracking-[-0.01em] [font-stretch:105%]";

export function MetodeProSeksjon({ side }: SeksjonProps) {
  const { kommune, oversikt } = side;
  return (
    <Seksjon
      id="metode"
      region={seksjonsnavn("metode")}
      tittel="Hvordan vet vi dette?"
      ingress={`Hver påstand har et kildemerke. Alt her er sammenstilt ${datoKort(kommune.sammenstilt)} fra et researchgrunnlag med kilder, og ingenting er etterprøvd mot registrene ennå.`}
    >
      <div className="flex flex-col gap-[clamp(48px,6vw,72px)]">
        <Tegnforklaring form="full" overskrift="h3" />

        <div className="flex flex-col gap-4">
          <h3 className={underTittel}>Slik blir en påstand verifisert</h3>
          <Verifisering telling={oversikt.verifisering} sammenstilt={kommune.sammenstilt} />
        </div>

        <div className="grid gap-x-12 gap-y-14 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-12 lg:col-span-7">
            <HullListe hull={side.hull} />

            <div id="kilder" className="flex scroll-mt-[calc(var(--topp)+16px)] flex-col gap-4">
              <h3 className={underTittel}>Kildene</h3>
              <p className="brodtekst text-[0.9375rem] text-dempet">
                Kildene datasettet for {kommune.navn} bygger på, med flest påstander først. Proff og
                Purehelp står der grunnlaget brukte dem. De skal erstattes av registrene de henter
                fra, og vi skraper dem ikke.
              </p>
              <Kildeliste kilder={oversikt.kilder} />
            </div>

            <p className="brodtekst text-[0.9375rem] text-dempet">
              Personvernet, hva vi bevisst ikke viser, og hvordan du ber om retting hvis du står i
              kartet, står på{" "}
              <Link
                to="/metode"
                hash="personvern"
                className="text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
              >
                metodesiden
              </Link>
              .
            </p>
          </div>

          <aside
            id="pro"
            aria-label="Maktkart Pro"
            className="min-w-0 scroll-mt-[calc(var(--topp)+16px)] self-start lg:col-span-5"
          >
            <ProBlokk
              kommuner={kjenteKommuner(side.kommuner)}
              standard={kommune.kommunenr}
              visKommune={false}
            />
          </aside>
        </div>
      </div>
    </Seksjon>
  );
}
