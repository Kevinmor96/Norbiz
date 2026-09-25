// Den klebrige framdriften i kjeden på mobil (fra B): «Steg 2 av 4:
// Kommune- og byutviklingsutvalget · innstilling». Den står øverst mens
// leseren ruller gjennom stegene, så leseren vet hvor i saken hen er selv når
// løypekartet ikke får plass.
//
// Høyden er fast. Et langt organnavn kortes med ellipse, fordi en høyde som
// endrer seg under rulling, flytter teksten leseren er midt i.

import { MYNDIGHETNAVN } from "@/lib/navn";
import { tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { kortnavn, type Loype } from "./modell";

export function Framdrift({ loype, aktiv }: { loype: Loype; aktiv: number }) {
  const post = loype.poster[aktiv] ?? loype.poster[0];
  if (!post) return null;
  const antall = loype.steg.length;
  return (
    <div
      aria-hidden="true"
      className="sticky top-(--topp) z-20 -mx-3 mb-2 flex flex-col gap-2 border-b border-linje bg-papir px-3 pt-2.5 pb-2 sm:-mx-5 sm:px-5 lg:hidden"
    >
      <div className="flex gap-1">
        {loype.poster.map((p) => (
          <span
            key={p.indeks}
            className={cn(
              "h-1 flex-1 transition-colors duration-300 ease-(--ease-ut)",
              p.form === "mangler"
                ? "border-t-2 border-dashed border-kote"
                : p.indeks <= aktiv
                  ? "bg-signal"
                  : "bg-linje",
            )}
          />
        ))}
      </div>
      <p className="flex min-w-0 items-baseline gap-1 text-[0.8125rem] leading-[1.3] whitespace-nowrap">
        {post.org && post.nr !== null ? (
          <>
            <span className="shrink-0 font-semibold text-signal-tekst tabular-nums">
              Steg {tall(post.nr)} av {tall(antall)}:
            </span>
            <b className="min-w-0 truncate font-semibold">{kortnavn(post.org)}</b>
            {post.myndighet && (
              <span className="shrink-0 text-dempet">
                · {MYNDIGHETNAVN[post.myndighet].toLowerCase()}
              </span>
            )}
          </>
        ) : (
          <span className="font-semibold text-kote-tekst">
            {post.nr === null ? "Etter vedtaket: ikke kartlagt" : "Steget er ikke kartlagt"}
          </span>
        )}
      </p>
    </div>
  );
}
