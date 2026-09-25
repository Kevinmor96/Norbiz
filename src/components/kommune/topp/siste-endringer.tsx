// Stripen med de siste hendelsene under kartbladet (DESIGN.md §5.1). Bare det
// som har skjedd: planlagte hendelser står i tidslinjen, over nå-linjen.

import { Pastand } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import type { Endring } from "@/lib/data";
import { datoStor, lesbar } from "@/lib/format";

export function SisteEndringer({ endringer }: { endringer: Endring[] }) {
  if (!endringer.length) return null;
  return (
    <section
      aria-labelledby="siste-endringer-tittel"
      className="mt-10 grid gap-x-8 gap-y-4 border-t border-trykk pt-5 pb-2 lg:grid-cols-[10rem_minmax(0,1fr)]"
    >
      <div className="flex items-baseline justify-between gap-4 lg:flex-col lg:justify-start lg:gap-1.5">
        <h2 id="siste-endringer-tittel" className="text-[1rem] leading-[1.3] font-bold">
          Siste endringer
        </h2>
        <a
          href="#endringer"
          className="text-[0.875rem] text-dempet underline decoration-linje-sterk hover:text-trykk hover:decoration-signal"
        >
          Hele tidslinjen
        </a>
      </div>
      <ol className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-5">
        {endringer.map((e) => (
          <li
            key={`${e.dato}|${e.type}|${e.tittel}`}
            className="flex min-w-0 flex-col gap-1.5 border-l border-linje pl-4"
          >
            <time dateTime={e.dato} className="text-[0.875rem] font-bold">
              {datoStor(e.dato, e.presisjon)}
            </time>
            <p className="text-[0.9375rem] leading-[1.4] text-pretty">
              <Pastand tekst={lesbar(e.tittel)} belegg={e.belegg} />
            </p>
            {e.org && (
              <OrganLenke
                org={e.org}
                kort
                className="self-start text-[0.8125rem] text-dempet underline decoration-linje-sterk hover:text-trykk hover:decoration-signal"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
