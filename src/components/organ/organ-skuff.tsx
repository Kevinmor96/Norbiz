// Organskuffen (DESIGN.md §5.3): detalj uten å forlate siden. Sheet fra
// høyre på skrivebord, Drawer nedenfra på mobil. Innholdet er organprofilen,
// det samme som /organ/$key viser.
//
// API for de andre seksjonene:
//
//   import { OrganLenke, aapneOrgan, useOrganSkuff } from "@/components/organ/organ-skuff";
//
//   // Lenke til et organ. Åpner skuffen på kommunesiden, og går til
//   // /organ/$key med ny fane, uten JavaScript og der skuffen ikke finnes.
//   <OrganLenke org={o.key} navn={o.navn}>{o.navn}</OrganLenke>
//
//   // Fra egen kode. Gir false når skuffen ikke finnes på siden, så kalleren
//   // kan navigere til /organ/$key i stedet.
//   if (!aapneOrgan(key, { fra: knapp, navn })) navigate({ to: "/organ/$key", params: { key } });
//
//   // Hvilket organ som er åpent, til markering.
//   const { aapen } = useOrganSkuff();
//
// Skuffen er en butikk på modulnivå, ikke en React-kontekst. Seksjonene er
// søsken under ruten, og ruten skal ikke endres av seksjonsbyggerne, så en
// provider rundt dem finnes ikke. <OrganSkuffVert /> står én gang på siden
// (i organkartet) og tegner skuffen. `aapneOrgan` virker fra hvor som helst.
//
// Adressen følger skuffen: /kommune/tromso#organ-troms-kraft åpner Troms Kraft
// når siden lastes, og uten JavaScript ruller den til kortet i organkartet,
// som har samme id. Ankeret er et rent token, ingen spørring eller sti.

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import {
  fokusTilbake,
  lukkOrgan,
  navnMensLaster,
  registrerVert,
  useOrganSkuff,
  useProfil,
  type Tilstand,
} from "./organ-lenke";
import { nivaalinje, ProfilDeler, ProfilFakta, ProfilKommuner } from "./organ-profil";

export {
  aapneOrgan,
  forhandslastOrganer,
  lukkOrgan,
  OrganLenke,
  organAnker,
  useOrganSkuff,
} from "./organ-lenke";

// ---------------------------------------------------------------------------
// Verten: tegner skuffen. Står én gang på siden.
// ---------------------------------------------------------------------------

/** Skrivebord: Sheet fra høyre. Under: Drawer nedenfra (DESIGN.md §5.3). */
const SKRIVEBORD = "(min-width: 48rem)";

export function OrganSkuffVert() {
  const { aapen } = useOrganSkuff();
  const skrivebord = useMediaQuery(SKRIVEBORD, true);
  const [tilstand, provIgjen] = useProfil(aapen);

  useEffect(() => registrerVert(), []);

  const lukkFokus = (e: Event) => {
    e.preventDefault();
    fokusTilbake();
  };

  const innhold = (Tittel: typeof DialogPrimitive.Title, Lukk: typeof DialogPrimitive.Close) => (
    <SkuffInnhold
      tilstand={tilstand}
      hint={navnMensLaster()}
      Tittel={Tittel}
      Lukk={Lukk}
      provIgjen={provIgjen}
    />
  );

  if (skrivebord) {
    return (
      <DialogPrimitive.Root open={aapen !== null} onOpenChange={(o) => !o && lukkOrgan()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-slor",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
            )}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onCloseAutoFocus={lukkFokus}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-[min(36rem,100vw)] flex-col border-l border-trykk bg-papir text-trykk outline-none",
              "ease-(--ease-skuff) data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-[320ms]",
              "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-200",
            )}
          >
            {innhold(DialogPrimitive.Title, DialogPrimitive.Close)}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DrawerPrimitive.Root
      open={aapen !== null}
      onOpenChange={(o) => !o && lukkOrgan()}
      shouldScaleBackground={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-slor" />
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={lukkFokus}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col border-t border-trykk bg-papir text-trykk outline-none"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 bg-linje-sterk" aria-hidden="true" />
          {innhold(DrawerPrimitive.Title, DrawerPrimitive.Close)}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

function SkuffInnhold({
  tilstand,
  hint,
  Tittel,
  Lukk,
  provIgjen,
}: {
  tilstand: Tilstand | null;
  hint: string | null;
  Tittel: typeof DialogPrimitive.Title;
  Lukk: typeof DialogPrimitive.Close;
  provIgjen: () => void;
}) {
  const kropp = useRef<HTMLDivElement>(null);
  const tittel = useRef<HTMLHeadingElement>(null);
  const forrige = useRef<string | null>(null);
  const key = tilstand?.key ?? null;
  const profil = tilstand?.status === "klar" ? tilstand.profil : null;

  // Et nytt organ i en åpen skuff: til toppen, og fokus på navnet, så en
  // skjermleser hører hvilket organ som nå vises.
  useEffect(() => {
    if (!key) return;
    if (forrige.current && forrige.current !== key) {
      kropp.current?.scrollTo({ top: 0 });
      tittel.current?.focus({ preventScroll: true });
    }
    forrige.current = key;
  }, [key]);

  const navn =
    profil?.organ.navn ?? hint ?? (tilstand?.status === "laster" ? "Henter organet" : "Organet");

  return (
    <>
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5 border-b border-trykk bg-flate px-4 pt-3.5 pb-4 md:px-6 md:pt-5">
        <p className="region min-h-[1.2em] text-[0.6875rem] text-dempet">
          {profil ? nivaalinje(profil.organ) : ""}
        </p>
        <Lukk
          className={cn(
            "row-span-2 inline-grid size-11 cursor-pointer place-items-center border border-trykk bg-papir",
            "transition-transform duration-150 ease-(--ease-ut) active:scale-[0.96]",
          )}
          aria-label="Lukk organprofilen"
        >
          <X className="size-4" aria-hidden="true" />
        </Lukk>
        <Tittel
          ref={tittel}
          tabIndex={-1}
          className="seksjon col-start-1 text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] outline-none"
        >
          {navn}
        </Tittel>
        {profil && <ProfilFakta profil={profil} className="col-span-2 mt-2" />}
      </header>

      <div
        ref={kropp}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6 md:px-6 [scrollbar-width:thin]"
      >
        {tilstand?.status === "laster" && (
          <p role="status" className="py-6 text-[0.9375rem] text-dempet">
            Henter organprofilen …
          </p>
        )}
        {tilstand?.status === "feil" && (
          <div role="alert" className="py-6">
            <p className="text-[0.9375rem]">Profilen kunne ikke hentes.</p>
            <button
              type="button"
              onClick={provIgjen}
              className="mt-3 h-10 cursor-pointer border border-trykk px-4 text-[0.875rem] font-semibold transition-transform duration-150 ease-(--ease-ut) active:scale-[0.97]"
            >
              Prøv igjen
            </button>
          </div>
        )}
        {tilstand?.status === "mangler" && (
          <p className="py-6 text-[0.9375rem] leading-[1.5]">
            Organet finnes ikke i datasettet. Lenken kan være skrevet feil, eller organet kan være
            fjernet.
          </p>
        )}
        {profil && <ProfilDeler profil={profil} overskrift="h3" />}
      </div>

      {key && (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-linje bg-papir px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] md:px-6">
          {profil ? <ProfilKommuner profil={profil} /> : <span />}
          <Link
            to="/organ/$key"
            params={{ key }}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold whitespace-nowrap underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
          >
            Åpne som egen side
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </footer>
      )}
    </>
  );
}
