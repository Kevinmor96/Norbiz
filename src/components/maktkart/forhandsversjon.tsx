// Forhåndsversjonen står synlig på hver side så lenge ingenting er verifisert
// (DESIGN.md §4). Rolig og vedvarende, uten alarm.
//
//   Skrivebord: en hel setning i topplinjen (ForhandsversjonTopp).
//   Mobil og nettbrett: en fast bunnlinje med tegnforklaringen og
//   Pro-ventelisten (ForhandsversjonBunn). Den vises så lenge margen med
//   tegnforklaringen ikke gjør det, altså under 1 200 px.
//
// Datoen kommer fra datasettet (`meta.sammenstilt`), aldri fra koden.

import { Drawer as DrawerPrimitive } from "vaul";

import { datoKort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Symbolforklaring, Tegnforklaring } from "./tegnforklaring";

/** Den stiplede trekanten: det uetterprøvde, i kote. */
function StipletTrekant({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className={cn("shrink-0 text-kote", className)}
    >
      <path
        d="M8 1.8 14.6 13.6H1.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.6 1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ForhandsversjonTopp({
  sammenstilt,
  className,
}: {
  /** `YYYY-MM-DD` fra datasettet. */
  sammenstilt: string;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        "flex min-w-0 items-center gap-2.5 text-[0.8125rem] leading-[1.3] text-dempet",
        className,
      )}
    >
      <StipletTrekant />
      <span>
        <strong className="font-semibold text-trykk">Forhåndsversjon.</strong> Tallene er fra
        researchgrunnlaget sammenstilt {datoKort(sammenstilt)} og ikke etterprøvd mot Brreg.
      </span>
    </p>
  );
}

export function ForhandsversjonBunn({
  sammenstilt,
  proHref = "/pro",
  tegnforklaring = true,
}: {
  sammenstilt: string;
  proHref?: string;
  /** Knappen til tegnforklaringen. Av på sider uten kildemerker. */
  tegnforklaring?: boolean;
}) {
  return (
    <div
      className={cn(
        "bunnlinje fixed inset-x-0 bottom-0 z-40 border-t border-trykk bg-papir marg:hidden",
        "px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2">
        <p role="note" className="flex min-w-0 flex-[1_1_16rem] items-start gap-2">
          <StipletTrekant className="mt-px" />
          <span className="text-[0.75rem] leading-[1.3] text-dempet">
            <strong className="font-semibold text-trykk">Forhåndsversjon.</strong> Sammenstilt{" "}
            {datoKort(sammenstilt)} fra researchgrunnlaget. Ikke etterprøvd mot Brreg.
          </span>
        </p>
        <div className="flex flex-[1_0_auto] gap-2 sm:flex-none">
          {tegnforklaring && (
            <DrawerPrimitive.Root shouldScaleBackground={false}>
              <DrawerPrimitive.Trigger
                className={cn(
                  "inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 border border-trykk bg-flate px-3",
                  "text-[0.875rem] font-semibold whitespace-nowrap transition-transform duration-150 ease-(--ease-ut) active:scale-[0.97] sm:flex-none",
                )}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle
                    cx="8"
                    cy="8"
                    r="5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="8" cy="8" r="1.8" fill="currentColor" />
                </svg>
                Tegnforklaring
              </DrawerPrimitive.Trigger>
              <DrawerPrimitive.Portal>
                <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-slor" />
                <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col border-t border-trykk bg-flate text-trykk outline-none">
                  <div
                    className="mx-auto mt-2.5 h-1 w-10 shrink-0 bg-linje-sterk"
                    aria-hidden="true"
                  />
                  <DrawerPrimitive.Title className="sr-only">Tegnforklaring</DrawerPrimitive.Title>
                  <DrawerPrimitive.Description className="sr-only">
                    Hva kildemerkene betyr. Trykk på en grad for å vise bare den.
                  </DrawerPrimitive.Description>
                  <div className="flex flex-col gap-6 overflow-y-auto px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
                    <Tegnforklaring />
                    <Symbolforklaring />
                    <DrawerPrimitive.Close className="h-11 w-full cursor-pointer border border-trykk text-[0.9375rem] font-semibold transition-transform duration-150 ease-(--ease-ut) active:scale-[0.98]">
                      Lukk
                    </DrawerPrimitive.Close>
                  </div>
                </DrawerPrimitive.Content>
              </DrawerPrimitive.Portal>
            </DrawerPrimitive.Root>
          )}
          <a
            href={proHref}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center border border-trykk bg-trykk px-3 text-[0.875rem] font-semibold whitespace-nowrap text-paa-trykk",
              "no-underline transition-transform duration-150 ease-(--ease-ut) active:scale-[0.97] sm:flex-none",
            )}
          >
            Venteliste for Pro
          </a>
        </div>
      </div>
    </div>
  );
}
