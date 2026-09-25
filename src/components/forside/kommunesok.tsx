// Kommunevelgeren på forsiden. En kartlagt kommune åpner kommunesiden. En
// kommune som ikke er kartlagt, velges i stemmeskjemaet lenger ned, så leseren
// kan stemme den fram.
//
// Velgeren kjenner bare kommunene datasettene og valgkretsene lister
// (neste/valgkretser.ts). Den later ikke som den har hele landet.
//
// Søket tåler aksenter: «kafjord» finner Gáivuotna-Kåfjord, og «tromso» finner
// Tromsø (lærdom fra Bransjesjekk).

import { useNavigate } from "@tanstack/react-router";
import { Command as CommandPrimitive } from "cmdk";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { KjentKommune } from "../kommune/neste/valgkretser";

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function Kommunesok({
  kommuner,
  onStem,
}: {
  kommuner: KjentKommune[];
  /** Kalles med kommunenummeret når leseren velger en kommune som ikke er kartlagt. */
  onStem: (kommunenr: string) => void;
}) {
  const navigate = useNavigate();
  const [q, settQ] = useState("");
  const [aapen, settAapen] = useState(false);
  const felt = useRef<HTMLInputElement>(null);

  const treff = useMemo(() => {
    const n = normaliser(q.trim());
    const liste = kommuner.map((k) => ({ k, t: normaliser(k.navn) }));
    if (!n) return liste.map((x) => x.k);
    // Navn som begynner med søket, står først. «kafjord» skal også treffe «Gáivuotna-Kåfjord».
    return liste
      .filter((x) => x.t.includes(n))
      .sort((a, b) => Number(!a.t.startsWith(n)) - Number(!b.t.startsWith(n)))
      .map((x) => x.k);
  }, [kommuner, q]);

  const grupper = [...new Set(kommuner.map((k) => k.gruppe))];

  const velg = (k: KjentKommune) => {
    settAapen(false);
    if (k.slug) {
      void navigate({ to: "/kommune/$slug", params: { slug: k.slug } });
    } else {
      settQ("");
      onStem(k.kommunenr);
    }
  };

  return (
    <div className="relative w-full max-w-[30rem]">
      {/* cmdk lager sin egen skjulte etikett. Denne er den synlige. */}
      <p
        aria-hidden="true"
        className="mb-2 cursor-default text-[0.9375rem] font-semibold"
        onClick={() => felt.current?.focus()}
      >
        Finn kommunen din
      </p>
      <CommandPrimitive
        shouldFilter={false}
        loop
        label="Finn kommunen din"
        className="relative"
        onKeyDown={(e) => {
          if (e.key === "Escape") settAapen(false);
        }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-dempet"
            aria-hidden="true"
          />
          <CommandPrimitive.Input
            ref={felt}
            value={q}
            onValueChange={(v) => {
              settQ(v);
              settAapen(true);
            }}
            onFocus={() => settAapen(true)}
            onBlur={() => settAapen(false)}
            placeholder="Skriv navnet på kommunen"
            className={cn(
              "h-[52px] w-full appearance-none border border-trykk bg-flate pr-4 pl-11 text-base text-trykk",
              "placeholder:text-dempet focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal",
            )}
          />
        </div>
        <CommandPrimitive.List
          className={cn(
            "absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[min(24rem,60dvh)] overflow-y-auto border border-trykk bg-flate",
            !aapen && "hidden",
          )}
        >
          {aapen && (
            <CommandPrimitive.Empty className="px-4 py-3.5 text-[0.875rem] leading-[1.45] text-dempet">
              Ingen kommune heter «{q.trim()}» i lista. Lista har kommunene i{" "}
              {grupper.join(" og ")} så langt.
            </CommandPrimitive.Empty>
          )}
          {aapen &&
            treff.map((k) => (
              <CommandPrimitive.Item
                key={k.kommunenr}
                value={k.kommunenr}
                onSelect={() => velg(k)}
                onMouseDown={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-linje px-3.5 py-2.5 last:border-b-0 data-[selected=true]:bg-flate-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3 shrink-0 border border-trykk",
                      k.slug ? "bg-trykk" : "bg-papir",
                    )}
                  />
                  <b className="truncate font-semibold">{k.navn}</b>
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-[0.8125rem]",
                    k.slug ? "font-semibold text-trykk" : "text-dempet",
                  )}
                >
                  {k.slug ? "Åpne kartbladet" : "Stem fram"}
                  {k.slug && <ArrowRight className="size-3.5" aria-hidden="true" />}
                </span>
              </CommandPrimitive.Item>
            ))}
        </CommandPrimitive.List>
      </CommandPrimitive>
    </div>
  );
}
