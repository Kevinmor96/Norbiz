// Verifiseringen i tre steg: hent, sammenlign, avvik til kontroll
// (DESIGN.md §5.9, grepet er fra retning B). Under stegene står status, regnet
// fra datasettet: hvor mange påstander som faktisk er verifisert. I
// forhåndsversjonen er det null, og det står der rolig.

import { ArrowRight } from "lucide-react";

import { GRADFARGE, MerkeSymbol } from "@/components/maktkart/merkesymbol";
import type { Verifiseringstelling } from "@/lib/data";
import { antall, datoKort, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEG = [
  {
    navn: "Hent",
    tekst:
      "Innhentingen henter Enhetsregisteret, rollene og nøkkeltallene for hvert organisasjonsnummer i datasettet, direkte fra Brønnøysundregistrene.",
  },
  {
    navn: "Sammenlign",
    tekst:
      "Sier registeret det samme som grunnlaget, blir påstanden verifisert, med tidspunktet den ble hentet.",
  },
  {
    navn: "Avvik til kontroll",
    tekst:
      "Sier registeret noe annet, går avviket i en kø til manuell kontroll. Påstanden beholder graden sin til avviket er avgjort.",
  },
] as const;

export function Verifisering({
  telling,
  sammenstilt,
  className,
}: {
  telling: Verifiseringstelling;
  /** `YYYY-MM-DD`, datoen statusen gjelder. */
  sammenstilt: string;
  className?: string;
}) {
  const totalt = telling.verifisert + telling.oppgitt + telling.maa_verifiseres;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ol className="grid border border-trykk md:grid-cols-3">
        {STEG.map((s, i) => (
          <li
            key={s.navn}
            className={cn(
              "flex flex-col gap-1.5 p-4",
              i > 0 && "border-trykk max-md:border-t md:border-l",
            )}
          >
            <span className="flex items-center gap-2 text-[1rem] font-bold">
              {s.navn}
              {i < STEG.length - 1 && (
                <ArrowRight className="size-4 text-dempet max-md:rotate-90" aria-hidden="true" />
              )}
            </span>
            <span className="text-[0.875rem] leading-[1.45] text-dempet text-pretty">
              {s.tekst}
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 text-[0.875rem] leading-[1.45] text-pretty">
        <MerkeSymbol
          grad="verifisert"
          storrelse={14}
          className={cn("mt-[3px]", GRADFARGE.verifisert)}
        />
        <span>
          <b className="font-semibold">Status {datoKort(sammenstilt)}:</b>{" "}
          {telling.verifisert === 0
            ? `Innhentingen har ikke kjørt ennå. Ingen av de ${tall(totalt)} påstandene er verifisert.`
            : `${tall(telling.verifisert)} av ${antall(totalt, "påstand", "påstander")} er verifisert.`}{" "}
          Tall fra Proff og Purehelp står som «må verifiseres» til de er hentet fra
          Regnskapsregisteret.
        </span>
      </p>
    </div>
  );
}
