// Personvernet i kartet (spec §4 og §5, grunnlaget §2.3). Reglene står som en
// liste over hva vi gjør og hva vi bevisst ikke gjør. Det som ennå ikke er på
// plass, står som planlagt. Vi lover ikke mer enn det koden og basen gjør.

import { Check, X } from "lucide-react";

import { Planlagt } from "./pro";

const GJOR = [
  {
    tittel: "Institusjon først.",
    tekst:
      "En person finnes bare gjennom en rolle i et organ. Det finnes ingen personprofiler, og i nettverket er personen en linje mellom to organer.",
  },
  {
    tittel: "Bare offentlige roller.",
    tekst:
      "Vi viser verv og lederroller i offentlige organer og selskaper. Parti står bare ved folkevalgte, som selv har gjort det kjent.",
  },
  {
    tittel: "Sensitive organer vises smalt.",
    tekst:
      "For domstoler, politi, påtalemyndighet og Forsvaret viser vi bare toppleder, og organene er aldri med i nettverket.",
  },
  {
    tittel: "Sperring i basen.",
    tekst:
      "Tas en innsigelse til følge, sperres personen i databasen. Da forsvinner rollene og alle hendelser og hull som nevner personen, fra hver offentlig spørring. Regelen ligger i basen, så ingen side kan glemme den.",
  },
];

const GJOR_IKKE = [
  {
    tittel: "Ingen personbilder, fødselsdatoer eller adresser.",
    tekst:
      "Innhentingen skal bruke fødselsdatoen fra Brønnøysundregistrene bare til å skille folk med samme navn. Den skal lagres som hash og aldri vises.",
  },
  {
    tittel: "Ingen skattelister.",
    tekst:
      "Søk i skattelistene logges hos Skatteetaten, og Den europeiske menneskerettsdomstolen har slått ned på nettpublisering av skatteopplysninger (2023). Vi importerer dem ikke.",
  },
  {
    tittel: "Ingen personscore og ingen lister som rangerer mennesker.",
    tekst:
      "Omdømmerisikoen er størst her, og en rangering av personer sier mer om modellen enn om makten.",
  },
  {
    tittel: "Ingen samlet maktscore.",
    tekst:
      "Scoren i grunnlaget har sju vektede ledd. For den første kommunen mangler minst tre av dem målte data: arealmakt, anskaffelser og eierposisjon vektet med egenkapital. Vi viser myndighet, eierskap og beslutningskjeder, som er fakta.",
  },
  {
    tittel: "Ingen aksjonærer under terskelen.",
    tekst: "Hvor terskelen skal gå, skal en advokat vurdere før lansering.",
  },
  {
    tittel: "Ingen skraping av Proff og Purehelp.",
    tekst:
      "De videreselger registerdata med databasevern og avtalevilkår. Vi henter fra registrene selv. Der grunnlaget brukte dem, står tallet som «må verifiseres».",
  },
];

const IKKE_KLART = [
  "Interesseavveining for behandlingen (berettiget interesse, GDPR art. 6 nr. 1 bokstav f)",
  "Personvernkonsekvensvurdering (DPIA)",
  "Personvernerklæring med frist for svar på henvendelser",
  "Informasjon til personene som står i kartet",
];

function Regel({ ikon, tittel, tekst }: { ikon: "ja" | "nei"; tittel: string; tekst: string }) {
  const Ikon = ikon === "ja" ? Check : X;
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-t border-linje py-3.5">
      <Ikon className="mt-[3px] size-[18px] text-trykk" strokeWidth={1.8} aria-hidden="true" />
      <p className="text-[0.9375rem] leading-[1.5] text-pretty">
        <b className="font-semibold">{tittel}</b> <span className="text-dempet">{tekst}</span>
      </p>
    </li>
  );
}

export function Personvern() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[1.0625rem] font-bold">Slik er kartet bygget</h3>
          <ul className="flex flex-col">
            {GJOR.map((r) => (
              <Regel key={r.tittel} ikon="ja" {...r} />
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-[1.0625rem] font-bold">Det vi bevisst ikke gjør</h3>
          <ul className="flex flex-col">
            {GJOR_IKKE.map((r) => (
              <Regel key={r.tittel} ikon="nei" {...r} />
            ))}
          </ul>
        </div>
      </div>
      <div className="flex max-w-[60ch] flex-col gap-3 border border-dashed border-kote p-4 sm:p-5">
        <Planlagt>Før lansering</Planlagt>
        <p className="text-[0.9375rem] leading-[1.5] text-pretty">
          Dette finnes ikke ennå, og skal være på plass før siden lanseres:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.9375rem] leading-[1.5] marker:text-kote">
          {IKKE_KLART.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
