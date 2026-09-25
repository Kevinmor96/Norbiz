// Pro som venteliste (DESIGN.md §5.9). Pro finnes ikke, og siden sier det:
// status «Planlagt», prisene står i en tabell merket som hypoteser, og
// kvitteringen sier nøyaktig hva som ble lagret. Samme deler brukes i
// seksjonen på kommunesiden, på /pro og på forsiden.

import { Bell, Download, History, Waypoints, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";
import { gyldigEpost, harLagring, meldPaa, type Mottak } from "@/lib/venteliste";

import { Felt, FELTFLATE, Hovedknapp, Kvittering, Nedtrekk } from "../neste/skjema";
import type { KjentKommune } from "../neste/valgkretser";
import { PRISHYPOTESER, PRISMERKNAD, PRO_FUNKSJONER, type ProFunksjon } from "./prishypoteser";

const IKON: Record<ProFunksjon["key"], LucideIcon> = {
  varsler: Bell,
  graf: Waypoints,
  historikk: History,
  eksport: Download,
};

/** «Planlagt»: samme stiplede ramme som alt annet som ikke har skjedd. */
export function Planlagt({ children = "Planlagt. Finnes ikke ennå." }: { children?: string }) {
  return (
    <span className="inline-flex items-center gap-2 self-start border border-dashed border-kote px-2 py-1 text-[0.8125rem] font-semibold text-kote-tekst">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="text-kote">
        <path
          d="M8 1.8 14.6 13.6H1.4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="2.6 1.8"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}

export function ProFunksjoner({
  lang = false,
  className,
}: {
  /** Lange forklaringer, til /pro. */
  lang?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col", lang ? "gap-6" : "gap-3", className)}>
      {PRO_FUNKSJONER.map((f) => {
        const Ikon = IKON[f.key];
        return (
          <li key={f.key} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
            <Ikon
              className="mt-[3px] size-[18px] text-trykk"
              strokeWidth={1.6}
              aria-hidden="true"
            />
            <span className={cn("leading-[1.45]", lang ? "text-[1rem]" : "text-[0.9375rem]")}>
              <b className={cn("font-semibold", lang && "block text-[1.0625rem]")}>{f.navn}</b>
              {lang ? (
                <span className="mt-1 block max-w-[60ch] text-dempet text-pretty">{f.lang}</span>
              ) : (
                <span className="text-dempet"> {f.kort}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Pristabell({ className }: { className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-left text-[0.9375rem]", className)}>
      <caption className="mb-2 caption-top text-left text-[0.8125rem] font-semibold text-kote-tekst">
        {PRISMERKNAD}
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Plan og hva den gir</th>
          <th scope="col">Pris</th>
        </tr>
      </thead>
      <tbody>
        {PRISHYPOTESER.map((p) => (
          <tr key={p.plan} className="border-t border-linje align-baseline last:border-b">
            <th scope="row" className="py-2.5 pr-4 font-normal">
              <b className="block font-semibold">{p.plan}</b>
              <span className="block text-[0.8125rem] leading-[1.4] text-dempet">{p.gir}</span>
            </th>
            <td className="py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
              {p.pris}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function kvitteringstekst(mottak: Mottak, epost: string): { tittel: string; detalj: string } {
  switch (mottak.status) {
    case "ingen_lagring":
    case "mangler_epost":
      return {
        tittel: "Forhåndsversjonen lagrer ikke adressen ennå.",
        detalj: "Ingenting er sendt eller lagret, heller ikke i nettleseren din.",
      };
    case "lagret":
      return {
        tittel: `${epost} står på ventelisten.`,
        detalj: "Vi skriver når Pro åpner. Adressen brukes ikke til noe annet.",
      };
    case "feil":
      return {
        tittel: "Adressen ble ikke lagret.",
        detalj: `${mottak.melding} Prøv igjen om litt.`,
      };
  }
}

/**
 * Påmeldingen. Tabellen krever en kommune for hver rad, og kommunen er også et
 * signal: den sier hvor Pro trengs først.
 */
export function ProSkjema({
  kommuner,
  standard,
  visKommune = true,
}: {
  /** Kjente kommuner, sortert. Kartlagte står først. */
  kommuner: KjentKommune[];
  /** Kommunenummeret som er valgt fra start, vanligvis kommunen siden handler om. */
  standard: string | null;
  /** På kommunesiden er kommunen gitt, og feltet kan stå bort. */
  visKommune?: boolean;
}) {
  const [epost, settEpost] = useState("");
  const [kommunenr, settKommunenr] = useState(standard ?? kommuner[0]?.kommunenr ?? "");
  const [feil, settFeil] = useState<string | null>(null);
  const [sender, settSender] = useState(false);
  const [svar, settSvar] = useState<{ mottak: Mottak; epost: string } | null>(null);

  const kartlagte = kommuner.filter((k) => k.slug);
  const grupper = new Map<string, KjentKommune[]>();
  for (const k of kommuner.filter((k) => !k.slug))
    grupper.set(k.gruppe, [...(grupper.get(k.gruppe) ?? []), k]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const e2 = epost.trim();
    if (!gyldigEpost(e2)) {
      settFeil(
        e2
          ? "E-postadressen mangler noe. Sjekk at den har @ og et domene."
          : "Skriv e-postadressen din, så sier vi fra når Pro åpner.",
      );
      e.currentTarget.querySelector<HTMLInputElement>("input[type=email]")?.focus();
      return;
    }
    settFeil(null);
    settSender(true);
    const mottak = await meldPaa({ formaal: "pro", kommunenr, epost: e2 });
    settSender(false);
    settSvar({ mottak, epost: e2 });
  }

  const tekst = svar ? kvitteringstekst(svar.mottak, svar.epost) : null;

  return (
    <form noValidate onSubmit={send} className="flex flex-col gap-4">
      <Felt
        etikett="E-post"
        hjelp={
          harLagring
            ? "Vi skriver når Pro åpner. Adressen brukes ikke til noe annet."
            : "Forhåndsversjonen lagrer ikke adressen ennå."
        }
        feil={feil}
      >
        {(a) => (
          <input
            {...a}
            type="email"
            name="epost"
            required
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            value={epost}
            onChange={(ev) => settEpost(ev.target.value)}
            className={FELTFLATE}
          />
        )}
      </Felt>
      {visKommune && kommuner.length > 1 && (
        <Felt etikett="Kommunen du vil følge">
          {(a) => (
            <Nedtrekk
              {...a}
              name="kommune"
              value={kommunenr}
              onChange={(ev) => settKommunenr(ev.target.value)}
            >
              {kartlagte.length > 0 && (
                <optgroup label="Kartlagt">
                  {kartlagte.map((k) => (
                    <option key={k.kommunenr} value={k.kommunenr}>
                      {k.navn}
                    </option>
                  ))}
                </optgroup>
              )}
              {[...grupper].map(([gruppe, liste]) => (
                <optgroup key={gruppe} label={`${gruppe}, ikke kartlagt`}>
                  {liste.map((k) => (
                    <option key={k.kommunenr} value={k.kommunenr}>
                      {k.navn}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Nedtrekk>
          )}
        </Felt>
      )}
      <Hovedknapp sender={sender}>Sett meg på ventelisten</Hovedknapp>
      <Kvittering
        mottak={svar?.mottak ?? null}
        tittel={tekst?.tittel ?? ""}
        detalj={tekst?.detalj}
      />
    </form>
  );
}

/**
 * Pro i sin helhet, slik den står i metodeseksjonen og på forsiden: status,
 * hva Pro skal gi, prishypotesene og påmeldingen.
 */
export function ProBlokk({
  kommuner,
  standard,
  visKommune,
  overskrift: Overskrift = "h3",
  className,
}: {
  kommuner: KjentKommune[];
  standard: string | null;
  visKommune?: boolean;
  overskrift?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 border border-trykk bg-flate p-5 sm:p-6", className)}>
      <Planlagt />
      <div className="flex flex-col gap-2">
        <Overskrift className="text-[clamp(1.5rem,1.3rem+0.6vw,1.75rem)] leading-[1.05] font-[760] tracking-[-0.02em] [font-stretch:112%]">
          Maktkart Pro
        </Overskrift>
        <p className="text-[0.9375rem] leading-[1.5] text-pretty">
          Pro finnes ikke ennå. Dette er det vi planlegger å bygge, og ventelisten viser oss om det
          er verdt det.
        </p>
      </div>
      <ProFunksjoner />
      <Pristabell />
      <ProSkjema
        kommuner={kommuner}
        standard={standard}
        {...(visKommune === undefined ? {} : { visKommune })}
      />
    </div>
  );
}
