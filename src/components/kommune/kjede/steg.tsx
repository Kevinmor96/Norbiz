// Stegene i kjeden som tekst: organet, myndigheten, hva organet gjør i saken
// og hvem som leder det. Lista er hovedinnholdet og tekstalternativet til
// løypekartet. På skrivebord står den til høyre for kartet. På mobil har den
// sitt eget loddrette spor med løypesymbolene, fordi kartet ikke får plass.
//
// Stegene med myndighet «innstilling» står i en sone i signaltint med
// etiketten «Forberedende makt». Sonen er der saken skrives, og det er den
// ingen andre viser (spec §3.2).

import type { CSSProperties } from "react";

import { MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import type { OrganRef, Rolle } from "@/lib/data";
import { dato, lesbar, tall } from "@/lib/format";
import { MYNDIGHETNAVN, NIVAANAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import type { Hullhint } from "./hull";
import type { Loype, Post } from "./modell";
import { PostIkon } from "./symboler";
import { ETAPPE_MS } from "./use-loype";

const STATUS: Record<Rolle["status"], string | null> = {
  fast: null,
  fungerende: "fungerende",
  konstituert: "konstituert",
  permisjon: "i permisjon",
  vara: "vara",
};

function Leder({ rolle, org }: { rolle: Rolle; org: OrganRef }) {
  // Tittel og navn, aldri bilde eller fødselsår (DESIGN.md §9). Når tittelen
  // bare er «Leder», står navnet alene, fordi feltet allerede heter Leder.
  const tittel = /^leder$/i.test(rolle.tittel) ? "" : `${rolle.tittel} `;
  const parti = rolle.parti ? ` (${rolle.parti})` : "";
  const status = STATUS[rolle.status];
  const tekst = `${tittel}${rolle.person.navn}${parti}`;
  return (
    <span className="block">
      <Pastand
        tekst={tekst}
        belegg={rolle.belegg}
        pastand={`${rolle.tittel} i ${org.navn}: ${rolle.person.navn}${parti}`}
      />
      {status && (
        <span className="text-dempet">
          , {status}
          {rolle.til_forventet && ` til ${dato(rolle.til_forventet)} ifølge kilden`}
        </span>
      )}
    </span>
  );
}

/** Den stiplede brikken for det datasettet ikke navngir (DESIGN.md §3). */
function IkkeKartlagt({ children }: { children: string }) {
  return (
    <span className="inline-block border border-dashed border-kote px-2 py-0.5 text-[0.8125rem] leading-[1.35] whitespace-nowrap text-kote-tekst">
      {children}
    </span>
  );
}

function Hentes({ hint }: { hint: Hullhint }) {
  return (
    <>
      {hint.forklaring && <span> {hint.forklaring}</span>}
      {hint.hentesFra && <span> Hentes fra {hint.hentesFra}.</span>}
    </>
  );
}

function Stegfakta({ post }: { post: Post }) {
  const org = post.org;
  if (!org) return null;
  const organ = post.organ;
  return (
    <dl className="mt-5 grid max-w-[52ch] grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2.5 text-[0.9375rem] leading-[1.45]">
      <dt className="text-dempet">Leder</dt>
      <dd className="min-w-0">
        {post.ledere.length ? (
          post.ledere.map((r) => <Leder key={`${r.person.key}-${r.tittel}`} rolle={r} org={org} />)
        ) : (
          <span className="text-dempet">
            <IkkeKartlagt>Leder ikke kartlagt</IkkeKartlagt>
            {post.lederhull ? (
              post.lederhull.hentesFra ? (
                <span> Hentes fra {post.lederhull.hentesFra}.</span>
              ) : (
                <span> {post.lederhull.hva}</span>
              )
            ) : (
              <span> Datasettet navngir ingen.</span>
            )}
          </span>
        )}
      </dd>
      <dt className="text-dempet">Nivå</dt>
      <dd className="min-w-0">
        {NIVAANAVN[org.nivaa]}
        {organ?.antall_medlemmer != null && (
          <>
            {", "}
            <MedMerke
              belegg={organ.belegg}
              pastand={`${organ.navn} har ${tall(organ.antall_medlemmer)} medlemmer`}
            >
              {tall(organ.antall_medlemmer)}&nbsp;medlemmer
            </MedMerke>
          </>
        )}
      </dd>
    </dl>
  );
}

/** Sporet til venstre for steget på mobil: symbolet og streken ned til neste post. */
function Spor({
  post,
  neste,
  aktiv,
  tegnet,
  forsinkelse,
}: {
  post: Post;
  neste: Post | undefined;
  aktiv: number;
  tegnet: number;
  forsinkelse: Record<number, number>;
}) {
  const ukjent = neste?.form === "mangler";
  const stiplet = neste?.klage || ukjent;
  const erTegnet = neste ? neste.indeks <= tegnet : false;
  const stil: CSSProperties = {
    clipPath: erTegnet ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
    transitionDelay: `${neste ? (forsinkelse[neste.indeks] ?? 0) : 0}ms`,
    transitionDuration: `${ETAPPE_MS}ms`,
  };
  return (
    <div className="relative lg:hidden" aria-hidden="true">
      <PostIkon
        form={post.form}
        storrelse={30}
        aktiv={post.indeks === aktiv && post.form !== "mangler"}
        passert={post.indeks < aktiv}
        className="relative z-[1] mx-auto"
      />
      {neste && (
        <span className="absolute top-[40px] bottom-[-18px] left-1/2 w-0 -translate-x-1/2">
          {ukjent ? (
            <span className="absolute inset-y-0 left-[-1px] border-l-2 border-dashed border-kote" />
          ) : (
            <>
              <span
                className={cn(
                  "absolute inset-y-0 left-[-1px] border-l-2 border-signal/30",
                  stiplet && "border-dashed",
                )}
              />
              <span
                className={cn(
                  "absolute inset-y-0 left-[-1.5px] border-l-[3px] border-signal transition-[clip-path] ease-(--ease-ut)",
                  stiplet && "border-dashed",
                )}
                style={stil}
              />
            </>
          )}
        </span>
      )}
    </div>
  );
}

function Myndighet({ post }: { post: Post }) {
  if (!post.myndighet) return null;
  return (
    <span
      className={cn(
        "border px-1.5 py-px text-[0.75rem] leading-[1.4] font-semibold [font-stretch:92%]",
        post.forberedende ? "border-signal/60 text-signal-tekst" : "border-linje-sterk text-trykk",
      )}
    >
      {MYNDIGHETNAVN[post.myndighet]}
    </span>
  );
}

export function Stegliste({
  loype,
  aktiv,
  tegnet,
  forsinkelse,
  listeRef,
}: {
  loype: Loype;
  aktiv: number;
  tegnet: number;
  forsinkelse: Record<number, number>;
  listeRef: (el: HTMLElement | null) => void;
}) {
  const poster = loype.poster;
  const antallSteg = loype.steg.length;
  return (
    <ol ref={listeRef} className="flex flex-col" aria-label={`Stegene i saken: ${loype.tittel}`}>
      {poster.map((p, i) => {
        const forrige = poster[i - 1];
        const neste = poster[i + 1];
        const iSone = p.forberedende;
        const soneStart = iSone && !forrige?.forberedende;
        const soneSlutt = iSone && !neste?.forberedende;
        const sist = !neste;
        return (
          <li
            key={p.indeks}
            data-steg={p.indeks}
            aria-current={p.indeks === aktiv ? "step" : undefined}
            className={cn(
              "relative grid grid-cols-[34px_minmax(0,1fr)] gap-x-4 px-3 pt-5 pb-9 sm:px-5 lg:block lg:px-7 lg:pt-7",
              sist ? "lg:pb-8" : "lg:min-h-[38vh] lg:pb-14",
              iSone && "border-x border-signal/45 bg-signal/[0.045]",
              soneStart && "border-t",
              soneSlutt && "border-b",
            )}
          >
            <Spor post={p} neste={neste} aktiv={aktiv} tegnet={tegnet} forsinkelse={forsinkelse} />
            <div className="min-w-0">
              {soneStart && (
                <div className="mb-4 flex flex-col gap-1">
                  <p className="region text-[0.6875rem] text-signal-tekst">Forberedende makt</p>
                  <p className="max-w-[44ch] text-[0.875rem] leading-[1.45] text-dempet">
                    Her skrives saken. Den som skriver saken, former vedtaket.
                  </p>
                </div>
              )}
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <PostIkon
                  form={p.form}
                  storrelse={20}
                  aktiv={p.indeks === aktiv && p.form !== "mangler"}
                  className="hidden lg:block"
                />
                <span
                  className={cn(
                    "text-[0.875rem] font-bold tabular-nums",
                    p.form === "mangler" ? "text-kote-tekst" : "text-signal-tekst",
                  )}
                >
                  {p.nr !== null && p.org
                    ? `Steg ${tall(p.nr)} av ${tall(antallSteg)}`
                    : p.nr === null
                      ? "Etter vedtaket"
                      : `Steg ${tall(p.nr)}`}
                </span>
                <Myndighet post={p} />
                {p.klage && (
                  <span className="text-[0.8125rem] text-dempet">Bare hvis noen klager</span>
                )}
              </p>
              {p.org ? (
                <>
                  <h3 className="mt-2.5 text-[clamp(1.375rem,1.15rem+0.8vw,1.75rem)] leading-[1.12] font-bold tracking-[-0.015em] [font-stretch:104%]">
                    <OrganLenke
                      org={p.org}
                      className="underline decoration-linje-sterk decoration-1 underline-offset-[0.18em] transition-[text-decoration-color] duration-150 hover:decoration-signal"
                    />
                  </h3>
                  <p className="brodtekst mt-3 max-w-[48ch] text-[1.0625rem]">
                    {p.belegg ? (
                      <Pastand
                        tekst={lesbar(p.hva)}
                        belegg={p.belegg}
                        pastand={`${p.org.navn}: ${lesbar(p.hva)}`}
                      />
                    ) : (
                      lesbar(p.hva)
                    )}
                  </p>
                  <Stegfakta post={p} />
                  {p.navnehull.map((h) => (
                    <p
                      key={h.hva}
                      className="mt-4 max-w-[52ch] text-[0.875rem] leading-[1.5] text-dempet"
                    >
                      <IkkeKartlagt>Ikke kartlagt</IkkeKartlagt> <span>{h.hva}</span>
                      <Hentes hint={h} />
                    </p>
                  ))}
                </>
              ) : (
                <>
                  <h3 className="mt-2.5 text-[clamp(1.375rem,1.15rem+0.8vw,1.75rem)] leading-[1.12] font-bold tracking-[-0.015em] text-kote-tekst [font-stretch:104%]">
                    Ikke kartlagt
                  </h3>
                  <p className="brodtekst mt-3 max-w-[48ch] text-[1rem] text-dempet">
                    {lesbar(p.hva)}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
