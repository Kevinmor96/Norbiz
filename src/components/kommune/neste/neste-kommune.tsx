// «Neste kommune» som én blokk: kartbladoversikten, stemmeskjemaet og
// forhåndsvisningen av en tom kommune. Brukes i seksjon 8 på kommunesiden og
// på forsiden.
//
// Valget deles: en rute i oversikten, lista i skjemaet og søket på forsiden
// velger den samme kommunen. Forsiden styrer valget selv (`valgt` og
// `onVelg`), ellers holder blokka det.

import { useState } from "react";

import type { Kommuneliste } from "@/lib/data";

import { Kartbladoversikt, type Rute } from "./kartbladoversikt";
import { Stemmeskjema } from "./stemmeskjema";
import { TomKommune } from "./tom-kommune";
import { kjenteKommuner, valgkretsFor } from "./valgkretser";

const samlet = new Intl.Collator("nb");

export function NesteKommune({
  fylkesnr,
  fylke,
  kartlagte,
  gjeldendeSlug,
  sammenligning,
  valgt: styrtValgt,
  onVelg: styrtVelg,
}: {
  /** Fylket valgkretsen følger. */
  fylkesnr: string;
  fylke: string;
  /** Kommunene med datasett (`data.kommuner()`). */
  kartlagte: Kommuneliste;
  gjeldendeSlug?: string | undefined;
  sammenligning?: { navn: string; organer: number; roller: number; hull: number } | null;
  valgt?: string | null;
  onVelg?: (kommunenr: string | null) => void;
}) {
  const [egetValg, settEgetValg] = useState<string | null>(null);
  const valgt = styrtValgt !== undefined ? styrtValgt : egetValg;
  const velg = styrtVelg ?? settEgetValg;

  const valgkrets = valgkretsFor(fylkesnr);
  const organer = new Map(kartlagte.map((k) => [k.kommunenr, k.antall_organer]));
  const iKretsen = new Set(valgkrets?.kommuner.map((k) => k.kommunenr) ?? []);
  const ruter: Rute[] = kjenteKommuner(kartlagte)
    .filter((k) => {
      if (iKretsen.has(k.kommunenr)) return true;
      const kartlagt = kartlagte.find((x) => x.kommunenr === k.kommunenr);
      return kartlagt?.fylkesnr === fylkesnr;
    })
    .map((k) => ({ ...k, organer: organer.get(k.kommunenr) ?? null }))
    .sort((a, b) => samlet.compare(a.navn, b.navn));

  // Skjemaet tilbyr alle kjente kommuner som ikke er kartlagt, også i andre valgkretser.
  const apne = kjenteKommuner(kartlagte).filter((k) => !k.slug);
  const valgtKommune = apne.find((k) => k.kommunenr === valgt) ?? null;

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        <Kartbladoversikt
          tittel={`Kartbladoversikt, ${valgkrets?.navn ?? `${fylke} fylke`}`}
          valgkrets={valgkrets}
          ruter={ruter}
          gjeldendeSlug={gjeldendeSlug}
          valgt={valgt}
          onVelg={velg}
        />
      </div>
      <div className="max-w-[34rem] min-w-0 lg:col-span-7 lg:row-start-2">
        {apne.length > 0 ? (
          <Stemmeskjema apne={apne} valgt={valgt} onVelg={velg} />
        ) : (
          <p className="text-[0.9375rem] text-dempet">
            Alle kommunene grunnlaget lister, er kartlagt.
          </p>
        )}
      </div>
      {/* Etter skjemaet i kildekoden, så valget og stemmen står tett på mobil. */}
      <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
        <TomKommune
          valgt={
            valgtKommune ? { navn: valgtKommune.navn, kommunenr: valgtKommune.kommunenr } : null
          }
          sammenligning={sammenligning ?? null}
        />
      </div>
    </div>
  );
}
