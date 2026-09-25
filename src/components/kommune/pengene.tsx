// Seksjon 4: Pengene (DESIGN.md §5.4). Hva kommunen eier, hvor utbyttet går,
// og kommunens eget regnskap.
//
// Props (stabilt, ruten endres ikke):
//   side: Kommuneside  hele kommunesiden fra loaderen (src/lib/kommuneside.ts)
//
// Seksjonen bruker:
//   side.eierskap        eier, selskaper (ledd, eiere, nøkkeltall) og utbytte
//   side.kommuneprofil   kommunens egne nøkkeltall (merforbruk, underskudd)
//   side.endringer       utbyttehendelser, for å se om beløpet er et forslag
//   side.hull            det som mangler om eierskapet og utbyttet
//
// Alt regnes fra datasettet i ./pengene/utregning.ts. Ingen komponent vet
// hvilken kommune eller hvilket selskap det gjelder. Mangler data, viser
// seksjonen hva som mangler og hvor det hentes.
//
// Anker: #pengene. Regionnavn og anker står i ./seksjoner.ts.

import { Seksjon } from "@/components/maktkart/seksjon";

import { Eierstolper } from "./pengene/eierstolper";
import { IkkeKartlagt } from "./pengene/felles";
import { Eierhull, Eierkjede, Foretak } from "./pengene/foretak";
import { Regnskap } from "./pengene/regnskap";
import { IngenUtbytte, Utbytteelv } from "./pengene/utbytteelv";
import { eierandeler, kommuneregnskap, utbytteElv } from "./pengene/utregning";
import { seksjonsnavn, type SeksjonProps } from "./seksjoner";

export function PengeneSeksjon({ side }: SeksjonProps) {
  const elv = utbytteElv(side);
  const eie = eierandeler(side, elv?.selskap.key ?? null);
  const regnskap = kommuneregnskap(side);
  const kommuneorgan = side.kommuneprofil?.organ ?? side.oversikt.kommuneorgan;
  const harEierskap = Boolean(
    eie && (eie.direkte.length || eie.foretak.length || eie.indirekte.length),
  );

  return (
    <Seksjon
      id="pengene"
      region={seksjonsnavn("pengene")}
      tittel="Hva eier kommunen?"
      ingress="Eierandeler i selskaper, med tall fra siste oppgitte regnskapsår, og hvor utbyttet går videre."
    >
      <div className="grid gap-x-12 gap-y-14 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          {eie && harEierskap ? (
            <>
              {eie.direkte.length > 0 ? (
                <Eierstolper rader={eie.direkte} eier={eie.eier} tittelId="pengene-eierandeler" />
              ) : (
                <IngenAndeler />
              )}
              <Eierhull hull={eie.hull} />
            </>
          ) : (
            <IngenEierskap kommunenavn={side.kommune.navn} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-14 lg:col-span-5">
          {elv ? (
            <Utbytteelv
              elv={elv}
              tittelId="pengene-utbytte"
              sammenstilt={side.kommune.sammenstilt}
            />
          ) : (
            <IngenUtbytte tittelId="pengene-utbytte" />
          )}
          {eie && <Foretak rader={eie.foretak} eier={eie.eier} tittelId="pengene-foretak" />}
          {eie && <Eierkjede rader={eie.indirekte} tittelId="pengene-kjede" />}
        </div>

        <div className="min-w-0 lg:col-span-12">
          <Regnskap grupper={regnskap} organ={kommuneorgan ?? null} tittelId="pengene-regnskap" />
        </div>
      </div>
    </Seksjon>
  );
}

function IngenEierskap({ kommunenavn }: { kommunenavn: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="seksjon text-[1.25rem] leading-[1.15]">Eierandeler</h3>
      <p>
        <IkkeKartlagt>Eierskapet er ikke kartlagt</IkkeKartlagt>
      </p>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Datasettet har ingen eierandeler for {kommunenavn} ennå. Eierandelene hentes fra kommunens
        eierskapsmelding og Aksjonærregisteret, og regnskapstallene fra Regnskapsregisteret.
      </p>
    </div>
  );
}

function IngenAndeler() {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="seksjon text-[1.25rem] leading-[1.15]">Eierandeler</h3>
      <p className="brodtekst text-[0.9375rem] text-dempet">
        Kommunen eier ingen aksjeselskaper direkte i datasettet. Foretakene og selskapene lenger ned
        i eierkjeden står ved siden av.
      </p>
    </div>
  );
}
