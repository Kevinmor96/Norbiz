// «Er dette deg?» (spec §2, grunnlaget §2.3): retting, protest og sletting.
// Skjemaet skriver til tabellen `innsigelse`, som bare kan skrives og aldri
// leses med den offentlige nøkkelen. Uten base sier kvitteringen at ingenting
// er sendt, på samme måte som stemmen og Pro-ventelisten.
//
// Basen krever at henvendelsen gjelder et organ eller en person. Leseren
// kjenner ikke personnøklene våre, så skjemaet ber om organet og legger navnet
// inn i teksten.
//
// Ingen løfter vi ikke kan holde: ingen svarfrist før personvernerklæringen
// setter den.

import { useEffect, useId, useState, type FormEvent } from "react";

import type { Nivaa } from "@/lib/data";
import { NIVAAER } from "@/lib/data/kontrakt";
import { NIVAANAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";
import { gyldigEpost, sendInnsigelse, type Innsigelsestype, type Mottak } from "@/lib/venteliste";

import { Felt, FELTFLATE, Hovedknapp, Kvittering, Nedtrekk } from "../neste/skjema";

export interface OrganValg {
  key: string;
  navn: string;
  nivaa: Nivaa;
}

const TYPER: { type: Innsigelsestype; navn: string; forklaring: string }[] = [
  {
    type: "retting",
    navn: "Noe er feil",
    forklaring: "Navnet, tittelen, datoen eller rollen stemmer ikke.",
  },
  {
    type: "protest",
    navn: "Jeg vil ikke vises",
    forklaring: "Du protesterer mot at opplysningen om deg vises.",
  },
  {
    type: "sletting",
    navn: "Slett opplysningene om meg",
    forklaring: "Du ber oss slette det vi har lagret om deg.",
  },
];

function kvitteringstekst(mottak: Mottak): { tittel: string; detalj: string } {
  switch (mottak.status) {
    case "ingen_lagring":
    case "mangler_epost":
      return {
        tittel: "Forhåndsversjonen lagrer ikke henvendelsen ennå.",
        detalj:
          "Ingenting er sendt eller lagret. Skjemaet kobles til basen før siden lanseres, og til da har forhåndsversjonen ingen annen kanal.",
      };
    case "lagret":
      return {
        tittel: "Henvendelsen er mottatt.",
        detalj:
          "Vi sjekker opplysningen mot kilden og svarer på e-postadressen du oppga. Adressen brukes bare til dette.",
      };
    case "feil":
      return {
        tittel: "Henvendelsen ble ikke sendt.",
        detalj: `${mottak.melding} Prøv igjen om litt.`,
      };
  }
}

export function Innsigelsesskjema({ organer }: { organer: OrganValg[] }) {
  const typeNavn = useId();
  const [type, settType] = useState<Innsigelsestype>("retting");
  const [org, settOrg] = useState("");
  const [navn, settNavn] = useState("");
  const [tekst, settTekst] = useState("");
  const [epost, settEpost] = useState("");
  const [feil, settFeil] = useState<{
    org: string | null;
    tekst: string | null;
    epost: string | null;
  }>({ org: null, tekst: null, epost: null });
  const [sender, settSender] = useState(false);
  const [svar, settSvar] = useState<Mottak | null>(null);

  // Organsiden kan lenke hit med ?org=<key>, så organet står valgt.
  useEffect(() => {
    const fra = new URLSearchParams(window.location.search).get("org");
    if (fra && organer.some((o) => o.key === fra)) settOrg(fra);
  }, [organer]);

  const perNivaa = NIVAAER.map((n) => ({
    nivaa: n,
    organer: organer.filter((o) => o.nivaa === n),
  })).filter((g) => g.organer.length > 0);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nye = {
      org: org ? null : "Velg organet opplysningen står under.",
      tekst: tekst.trim() ? null : "Skriv kort hva som er feil, eller hva du vil at vi skal gjøre.",
      epost: gyldigEpost(epost)
        ? null
        : epost.trim()
          ? "E-postadressen mangler noe. Sjekk at den har @ og et domene."
          : "Skriv e-postadressen din, så vi kan svare deg.",
    };
    settFeil(nye);
    if (nye.org || nye.tekst || nye.epost) {
      e.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    settSender(true);
    const helTekst = navn.trim()
      ? `Navn i kartet: ${navn.trim()}\n\n${tekst.trim()}`
      : tekst.trim();
    const mottak = await sendInnsigelse({
      type,
      org_key: org,
      tekst: helTekst.slice(0, 4000),
      epost,
    });
    settSender(false);
    settSvar(mottak);
  }

  const k = svar ? kvitteringstekst(svar) : null;

  return (
    <form noValidate onSubmit={send} className="flex max-w-[36rem] flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[0.9375rem] font-semibold">Hva gjelder det?</legend>
        {TYPER.map((t) => (
          <label
            key={t.type}
            className={cn(
              "flex cursor-pointer items-start gap-3 border px-3.5 py-3 transition-colors duration-150",
              type === t.type ? "border-trykk bg-flate" : "border-linje hover:border-linje-sterk",
            )}
          >
            <input
              type="radio"
              name={typeNavn}
              value={t.type}
              checked={type === t.type}
              onChange={() => settType(t.type)}
              className="mt-1 size-4 shrink-0 accent-trykk"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold">{t.navn}</span>
              <span className="text-[0.8125rem] leading-[1.4] text-dempet">{t.forklaring}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Felt etikett="Organet opplysningen står under" feil={feil.org}>
        {(a) => (
          <Nedtrekk {...a} name="organ" value={org} onChange={(e) => settOrg(e.target.value)}>
            <option value="" disabled>
              Velg organ
            </option>
            {perNivaa.map((g) => (
              <optgroup key={g.nivaa} label={NIVAANAVN[g.nivaa]}>
                {g.organer.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.navn}
                  </option>
                ))}
              </optgroup>
            ))}
          </Nedtrekk>
        )}
      </Felt>

      <Felt
        etikett="Navnet ditt slik det står i kartet (valgfritt)"
        hjelp="Så vi finner riktig rolle."
      >
        {(a) => (
          <input
            {...a}
            type="text"
            name="navn"
            autoComplete="name"
            value={navn}
            onChange={(e) => settNavn(e.target.value)}
            className={FELTFLATE}
          />
        )}
      </Felt>

      <Felt etikett="Hva er feil, eller hva vil du at vi skal gjøre?" feil={feil.tekst}>
        {(a) => (
          <textarea
            {...a}
            name="tekst"
            rows={5}
            maxLength={3800}
            value={tekst}
            onChange={(e) => settTekst(e.target.value)}
            className={cn(FELTFLATE, "h-auto min-h-[8rem] resize-y py-3 leading-[1.5]")}
          />
        )}
      </Felt>

      <Felt
        etikett="E-post"
        hjelp="Vi trenger adressen for å svare deg. Den brukes ikke til noe annet."
        feil={feil.epost}
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
            onChange={(e) => settEpost(e.target.value)}
            className={FELTFLATE}
          />
        )}
      </Felt>

      <Hovedknapp sender={sender}>Send henvendelsen</Hovedknapp>
      <Kvittering mottak={svar} tittel={k?.tittel ?? ""} detalj={k?.detalj} />
    </form>
  );
}
