// Stemmen på neste kommune (DESIGN.md §5.8). Skjemaet er ærlig om hva som
// skjer: uten base sier kvitteringen «Forhåndsversjonen lagrer ikke stemmen
// ennå», og med base skrives stemmen til `venteliste`. Stemmetall vises
// aldri, heller ikke til den som stemmer.

import { useState, type FormEvent } from "react";

import { gyldigEpost, harLagring, meldPaa, type Mottak } from "@/lib/venteliste";

import { Felt, FELTFLATE, Hovedknapp, Kvittering, Nedtrekk } from "./skjema";
import type { KjentKommune } from "./valgkretser";

function kvitteringstekst(mottak: Mottak, navn: string): { tittel: string; detalj: string } {
  switch (mottak.status) {
    case "ingen_lagring":
      return {
        tittel: "Forhåndsversjonen lagrer ikke stemmen ennå.",
        detalj: `Du valgte ${navn}. Ingenting er sendt eller lagret, heller ikke i nettleseren din.`,
      };
    case "mangler_epost":
      return {
        tittel: "Stemmen er ikke lagret.",
        detalj:
          "Ventelisten lagrer bare stemmer med e-postadresse ennå. Skriv inn adressen hvis du vil at stemmen skal telle.",
      };
    case "lagret":
      return {
        tittel: `Stemmen på ${navn} er lagret.`,
        detalj: "Vi bruker adressen bare til å si fra når kommunen er kartlagt.",
      };
    case "feil":
      return { tittel: "Stemmen ble ikke lagret.", detalj: `${mottak.melding} Prøv igjen om litt.` };
  }
}

export function Stemmeskjema({
  apne,
  valgt,
  onVelg,
}: {
  /** Kommunene som kan stemmes fram: de som ikke er kartlagt. */
  apne: KjentKommune[];
  valgt: string | null;
  onVelg: (kommunenr: string | null) => void;
}) {
  const [epost, settEpost] = useState("");
  const [feil, settFeil] = useState<{ kommune: string | null; epost: string | null }>({
    kommune: null,
    epost: null,
  });
  const [sender, settSender] = useState(false);
  const [svar, settSvar] = useState<{ mottak: Mottak; navn: string } | null>(null);

  const grupper = new Map<string, KjentKommune[]>();
  for (const k of apne) grupper.set(k.gruppe, [...(grupper.get(k.gruppe) ?? []), k]);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const kommune = apne.find((k) => k.kommunenr === valgt);
    const nyeFeil = {
      kommune: kommune ? null : "Velg en kommune i oversikten eller i lista.",
      epost:
        epost.trim() && !gyldigEpost(epost)
          ? "E-postadressen mangler noe. Sjekk at den har @ og et domene."
          : null,
    };
    settFeil(nyeFeil);
    if (!kommune || nyeFeil.epost) {
      const forste = e.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]");
      forste?.focus();
      return;
    }
    settSender(true);
    const mottak = await meldPaa({
      formaal: "stemme",
      kommunenr: kommune.kommunenr,
      epost: epost.trim() || null,
    });
    settSender(false);
    settSvar({ mottak, navn: kommune.navn });
  }

  const tekst = svar ? kvitteringstekst(svar.mottak, svar.navn) : null;

  return (
    <form noValidate onSubmit={send} className="flex flex-col gap-4">
      <h3 className="text-[1.0625rem] font-bold">Stem fram neste kommune</h3>
      <Felt etikett="Kommunen du vil ha kartlagt" feil={feil.kommune}>
        {(a) => (
          <Nedtrekk
            {...a}
            name="kommune"
            value={valgt ?? ""}
            onChange={(e) => {
              onVelg(e.target.value || null);
              settFeil((f) => ({ ...f, kommune: null }));
            }}
          >
            <option value="" disabled>
              Velg kommune
            </option>
            {[...grupper].map(([gruppe, kommuner]) => (
              <optgroup key={gruppe} label={gruppe}>
                {kommuner.map((k) => (
                  <option key={k.kommunenr} value={k.kommunenr}>
                    {k.navn}
                  </option>
                ))}
              </optgroup>
            ))}
          </Nedtrekk>
        )}
      </Felt>
      <Felt
        etikett="E-post (valgfritt)"
        hjelp={
          harLagring
            ? "Stemmen lagres sammen med adressen. Den brukes bare til å si fra når kommunen er kartlagt."
            : "Bare for å si fra når kommunen er kartlagt."
        }
        feil={feil.epost}
      >
        {(a) => (
          <input
            {...a}
            type="email"
            name="epost"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            value={epost}
            onChange={(e) => settEpost(e.target.value)}
            className={FELTFLATE}
          />
        )}
      </Felt>
      <Hovedknapp sender={sender}>Stem</Hovedknapp>
      <Kvittering
        mottak={svar?.mottak ?? null}
        tittel={tekst?.tittel ?? ""}
        detalj={tekst?.detalj}
      />
      <p className="text-[0.8125rem] leading-[1.45] text-dempet text-pretty">
        Stemmetallene vises ikke. De forteller oss hvor vi skal kartlegge neste gang.
      </p>
    </form>
  );
}
