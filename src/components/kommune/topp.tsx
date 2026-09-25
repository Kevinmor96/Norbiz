// Seksjon 1: toppen, kartbladet (DESIGN.md §5.1).
//
// Venstre: tittelen, ingressen, søket og «Slik leser du merkene». Leseren skal
// lære merket før første tall, og førsteinntrykket er ofte et skjermbilde, så
// forklaringen står i første skjermbilde.
// Høyre: kartbladet med randopplysningene langs kartet.
// Under: stripen med de siste endringene.
//
// Props: `side` (hele kommunesiden fra loaderen). Seksjonen bruker
//   side.kommune, side.oversikt (kommunestyre, utbytte, siste endringer),
//   side.eierskap, side.endringer, side.organkart (søket),
//   side.kommuneprofil (org.nr.) og side.terreng.

import { Kartblad } from "@/components/maktkart/kartblad";
import { Tegnforklaring } from "@/components/maktkart/tegnforklaring";

import type { SeksjonProps } from "./seksjoner";
import { Randmoduler } from "./topp/randmoduler";
import { SisteEndringer } from "./topp/siste-endringer";
import { Sok } from "./topp/sok";

export function ToppSeksjon({ side }: SeksjonProps) {
  const { kommune } = side;
  return (
    <section id="topp" aria-labelledby="topp-tittel" className="ramme pt-[clamp(28px,5vw,64px)]">
      <div className="grid gap-x-6 gap-y-10 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-7 lg:col-span-5 lg:pt-3">
          <h1
            id="topp-tittel"
            className="tittel text-[clamp(2.5rem,1.35rem+3.6vw,4.75rem)] lg:text-[clamp(3rem,0.6rem+4.4vw,4.75rem)]"
          >
            Hvem bestemmer i {kommune.navn}?
          </h1>
          <p className="ingress max-w-[36ch] text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)] text-dempet">
            Organene, rollene og pengene i {kommune.navn} kommune, og hvordan de henger sammen. Hver
            påstand har kilde og dato.
          </p>
          {/* På nettbrett står søket og tegnforklaringen side om side, så kartet kommer høyere opp. */}
          <div className="grid gap-7 md:grid-cols-2 md:gap-x-8 lg:grid-cols-1">
            <Sok organkart={side.organkart} kommunenavn={kommune.navn} />
            <Tegnforklaring className="max-w-[30rem]" />
          </div>
        </div>
        <Kartblad
          className="lg:col-span-7"
          kommune={{ navn: kommune.navn, kommunenr: kommune.kommunenr, fylke: kommune.fylke }}
          orgnr={side.kommuneprofil?.organ.orgnr ?? null}
          terreng={side.terreng}
          rand={<Randmoduler side={side} />}
        />
      </div>
      <SisteEndringer endringer={side.oversikt.siste_endringer} />
    </section>
  );
}
