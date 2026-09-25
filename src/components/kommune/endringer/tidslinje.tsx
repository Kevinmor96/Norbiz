// Tidslinjen: en loddrett målestokk med ett felt per år, vekselvis fylt og
// åpent som den graderte kanten på et kartblad. Nå-linjen er
// sammenstillingsdatoen. Over den står det som ikke har skjedd, med åpen strek.
//
// Årstallene er klebrige, men hvert årstall bor i sin egen gruppe og kan ikke
// forlate den. Derfor kan to årstall aldri stables oppå hverandre.
//
// Oppsettet følger bredden på tidslinjen selv (container queries), ikke
// vinduet, fordi margen tar bredde fra 1 200 px.

import { Pastand } from "@/components/maktkart/kildemerke";
import { OrganLenke } from "@/components/organ/organ-skuff";
import type { Endring } from "@/lib/data";
import { datoKort, datoStor, lesbar } from "@/lib/format";
import { HENDELSESTYPENAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import type { Aargruppe, Tidslinje, Udatert } from "./modell";

/** Datoen med presisjonen kilden har. Et årstall alene sier ifra om at dagen mangler. */
function Dato({ e }: { e: Endring }) {
  return (
    <time dateTime={e.dato} className="text-[0.875rem] font-bold tabular-nums">
      {e.presisjon === "aar" ? `I løpet av ${e.dato.slice(0, 4)}` : datoStor(e.dato, e.presisjon)}
    </time>
  );
}

function Organlenke({ org }: { org: NonNullable<Endring["org"]> }) {
  return (
    <OrganLenke
      org={org}
      kort
      className="self-start text-[0.8125rem] text-dempet underline decoration-linje-sterk underline-offset-[0.2em] transition-colors duration-150 hover:text-trykk hover:decoration-signal"
    />
  );
}

function Hendelse({ e, framtid }: { e: Endring; framtid: boolean }) {
  const tittel = lesbar(e.tittel);
  return (
    <li
      className={cn(
        "relative grid gap-x-6 gap-y-1.5 @2xl:grid-cols-[9.5rem_minmax(0,1fr)]",
        // Et lite hakk fra målestokken til raden, som en merkestrek på en akse.
        "before:absolute before:top-[0.72em] before:-left-[calc(1rem+1px)] before:w-3 before:border-t @2xl:before:-left-[calc(1.5rem+1px)] @2xl:before:w-5",
        framtid
          ? "border border-dashed border-kote px-4 py-3.5 before:w-4 before:border-dashed before:border-kote @2xl:before:w-6"
          : "py-3.5 before:border-trykk [&+&]:border-t [&+&]:border-linje",
        framtid && "before:top-[1.35em]",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 @2xl:flex-col @2xl:gap-1">
        <Dato e={e} />
        <span className="text-[0.75rem] text-dempet">{HENDELSESTYPENAVN[e.type]}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {framtid && (
          <span className="region self-start text-[0.6875rem] text-kote-tekst">
            Har ikke skjedd
          </span>
        )}
        <p className="max-w-[60ch] text-[1rem] leading-[1.4] font-semibold text-pretty">
          <Pastand tekst={tittel} belegg={e.belegg} />
        </p>
        {e.tekst && (
          <p className="max-w-[62ch] text-[0.9375rem] leading-[1.5] text-dempet text-pretty">
            {lesbar(e.tekst)}
          </p>
        )}
        {e.org && <Organlenke org={e.org} />}
      </div>
    </li>
  );
}

/**
 * Brudd i målestokken, som på en akse: årene uten endringer i datasettet er
 * hoppet over. Feltene har ikke lengde etter tid, og bruddet sier det.
 */
function Brudd() {
  return (
    <svg
      viewBox="0 0 20 10"
      aria-hidden="true"
      className="absolute -top-[5px] left-1/2 h-[10px] w-[20px] -translate-x-1/2 overflow-visible"
    >
      <rect x="0" y="2" width="20" height="6" className="fill-papir" />
      <path
        d="M2 8.5 7.5 1.5M12.5 8.5 18 1.5"
        className="fill-none stroke-trykk"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function Gruppe({ g, brudd }: { g: Aargruppe; brudd: boolean }) {
  const fylt = Number(g.aar) % 2 === 0;
  return (
    <div
      role="group"
      aria-labelledby={`endringer-${g.framtid ? "kommende" : "aar"}-${g.aar}`}
      className="grid grid-cols-[10px_minmax(0,1fr)] gap-x-4 @2xl:grid-cols-[5.5rem_10px_minmax(0,1fr)] @2xl:gap-x-6"
    >
      <h3
        id={`endringer-${g.framtid ? "kommende" : "aar"}-${g.aar}`}
        className={cn(
          // Klebrig innenfor sin egen gruppe. På mobil er årstallet en rad over
          // hendelsene med papir bak, så teksten under ikke skinner gjennom.
          "sticky top-(--topp) z-10 col-span-2 flex items-baseline gap-2.5 bg-papir py-2",
          "@2xl:top-[calc(var(--topp)+16px)] @2xl:col-span-1 @2xl:flex-col @2xl:gap-0.5 @2xl:self-start @2xl:bg-transparent @2xl:py-3",
        )}
      >
        <span
          className={cn(
            "text-[1.5rem] leading-none font-bold tracking-[-0.02em] tabular-nums [font-stretch:105%]",
            g.framtid && "text-dempet",
          )}
        >
          {g.aar}
        </span>
        {g.framtid && (
          <span className="text-[0.75rem] font-semibold text-kote-tekst">Har ikke skjedd</span>
        )}
      </h3>
      {/* Målestokken: ett felt per år, vekselvis fylt og åpent. Kommende år er åpne og stiplet. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative col-start-1 row-start-2 border @2xl:col-start-2 @2xl:row-start-1",
          g.framtid
            ? "border-dashed border-kote"
            : cn("border-trykk", fylt ? "bg-trykk" : "bg-papir"),
        )}
      >
        {brudd && <Brudd />}
      </span>
      <ol
        className={cn(
          "col-start-2 row-start-2 flex min-w-0 flex-col pb-6 @2xl:col-start-3 @2xl:row-start-1 @2xl:pb-8",
          g.framtid && "gap-3",
        )}
      >
        {g.hendelser.map((e) => (
          <Hendelse key={`${e.dato}|${e.type}|${e.tittel}`} e={e} framtid={g.framtid} />
        ))}
      </ol>
    </div>
  );
}

function Naalinje({ sammenstilt, harFramtid }: { sammenstilt: string; harFramtid: boolean }) {
  // Linjen er datoen datasettet ble sammenstilt, ikke «i dag». Siden vet ikke
  // hva som har skjedd etter det.
  return (
    <div className="my-3 flex flex-col gap-1">
      <p className="flex items-center gap-3">
        <span className="shrink-0 text-[0.9375rem] font-bold">
          Sammenstilt {datoKort(sammenstilt)}
        </span>
        <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-trykk" />
      </p>
      {harFramtid && (
        <p className="text-[0.8125rem] leading-[1.4] text-dempet">
          Over linjen står det som ikke har skjedd. Under står det som har skjedd.
        </p>
      )}
    </div>
  );
}

function Udaterte({ liste }: { liste: Udatert[] }) {
  if (!liste.length) return null;
  return (
    <div className="mt-10 grid gap-x-6 gap-y-4 border-t border-trykk pt-6 @2xl:grid-cols-[5.5rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <h3 id="endringer-uten-dato" className="text-[1.125rem] leading-[1.2] font-bold">
          Uten dato
        </h3>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <p className="max-w-[60ch] text-[0.9375rem] leading-[1.5] text-dempet">
          Grunnlaget nevner disse endringene, men oppgir ikke når de skjedde. De står derfor utenfor
          tidslinjen.
        </p>
        <ul aria-labelledby="endringer-uten-dato" className="grid gap-3 @3xl:grid-cols-2">
          {liste.map((u) => (
            <li
              key={`${u.org.key}|${u.hva}`}
              className="flex min-w-0 flex-col gap-1.5 border border-dashed border-kote px-4 py-3.5"
            >
              <span className="region self-start text-[0.6875rem] text-kote-tekst">
                Dato ikke oppgitt
              </span>
              <p className="text-[0.9375rem] leading-[1.45] text-pretty">{u.hva}</p>
              {(u.forklaring || u.hentesFra) && (
                <p className="text-[0.8125rem] leading-[1.45] text-dempet text-pretty">
                  {u.forklaring}
                  {u.hentesFra && ` Hentes fra ${u.hentesFra}.`}
                </p>
              )}
              <Organlenke org={u.org} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Årene hopper over minst ett år mellom to grupper. */
const hopper = (forrige: Aargruppe | undefined, g: Aargruppe) =>
  !!forrige && Math.abs(Number(forrige.aar) - Number(g.aar)) > 1;

export function TidslinjeVisning({
  tidslinje,
  sammenstilt,
  kommunenavn,
}: {
  tidslinje: Tidslinje;
  sammenstilt: string;
  kommunenavn: string;
}) {
  const { framtid, fortid, udaterte } = tidslinje;
  return (
    <div className="@container">
      <div className="flex flex-col">
        {framtid.map((g, i) => (
          <Gruppe key={`kommende-${g.aar}`} g={g} brudd={hopper(framtid[i - 1], g)} />
        ))}
        <Naalinje sammenstilt={sammenstilt} harFramtid={framtid.length > 0} />
        {fortid.map((g, i) => (
          <Gruppe key={`aar-${g.aar}`} g={g} brudd={hopper(fortid[i - 1], g)} />
        ))}
        {!fortid.length && (
          <p className="max-w-[52ch] border border-dashed border-kote px-5 py-4 text-[0.9375rem] leading-[1.5]">
            <span className="font-semibold text-kote-tekst">Ikke kartlagt.</span> Datasettet for{" "}
            {kommunenavn} har ingen daterte endringer ennå.
          </p>
        )}
      </div>
      <Udaterte liste={udaterte} />
    </div>
  );
}
