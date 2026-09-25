// Bunnteksten: hva Maktkart er, hvordan en person i kartet ber om retting, og
// hvor terrenget kommer fra.

import { datoKort } from "@/lib/format";

import { useForhandsvarsel, type Forhandsvarsel } from "./forhandsversjon";

export function Sidefot({
  sammenstilt,
  kommunenavn,
  terrengKreditt,
  metodeHref = "/metode",
  varsel,
}: {
  sammenstilt?: string | null;
  /** Forhåndsvarselet regnet fra gradene. Utelatt: kommunens påstander eller den generelle setningen. */
  varsel?: Forhandsvarsel | null;
  kommunenavn?: string | null;
  /** Kredittlinjen fra terrengfila. Utelates når siden ikke har kartblad. */
  terrengKreditt?: string | null;
  /** Metoden: `#metode` på kommunesiden, ellers `/metode`. Kildelisten står der. */
  metodeHref?: string;
}) {
  const kilder = metodeHref.startsWith("#") ? "#kilder" : `${metodeHref}#kilder`;
  const v = useForhandsvarsel(varsel);
  return (
    <footer className="mt-8 border-t border-trykk pt-8 pb-12">
      <div className="ramme grid gap-x-6 gap-y-6 text-[0.8125rem] leading-[1.5] text-dempet md:grid-cols-3">
        <p>
          <b className="mb-1 block font-semibold text-trykk">Maktkart</b>
          Arbeidsnavn. Forhåndsversjon
          {kommunenavn ? ` for ${kommunenavn}` : ""}
          {sammenstilt ? `, sammenstilt ${datoKort(sammenstilt)}` : ""}. {v.lang}{" "}
          <a
            href={kilder}
            className="text-trykk underline decoration-linje-sterk hover:decoration-signal"
          >
            Kildelisten
          </a>
        </p>
        <p>
          <b className="mb-1 block font-semibold text-trykk">Står du i kartet?</b>
          Ser du en feil om deg selv eller rollen din, kan du be om retting eller protestere mot at
          opplysningen vises.{" "}
          <a
            href="/metode#retting"
            className="text-trykk underline decoration-linje-sterk hover:decoration-signal"
          >
            Er dette deg?
          </a>{" "}
          <a
            href="/metode#personvern"
            className="text-trykk underline decoration-linje-sterk hover:decoration-signal"
          >
            Personvern
          </a>
        </p>
        {terrengKreditt && (
          <p>
            <b className="mb-1 block font-semibold text-trykk">Kartgrunnlag</b>
            {terrengKreditt}
          </p>
        )}
      </div>
    </footer>
  );
}
