// Forhåndsversjonen står synlig på hver side (DESIGN.md §4). Rolig og
// vedvarende, uten alarm.
//
//   Skrivebord: en hel setning i topplinjen (ForhandsversjonTopp).
//   Mobil og nettbrett: en fast bunnlinje med tegnforklaringen og
//   Pro-ventelisten (ForhandsversjonBunn). Den vises så lenge margen med
//   tegnforklaringen ikke gjør det, altså under 1 200 px.
//
// Setningen regnes fra gradene til det siden viser, aldri fra koden:
//
//   1. Et varsel siden regner selv (`varsel`), fra datalagets gradtellinger:
//      «1 803 av 1 976 roller i Troms er hentet direkte fra registrene
//      25.09.2026. Resten er ikke etterprøvd.» Er alle rollene hentet, sier
//      det også hvor mange andre påstander som ikke er etterprøvd.
//   2. Ellers, på en kommuneside, påstandene i kommunens omfang fra
//      KommuneKontekst.
//   3. Ellers en setning som er sann uansett datasett: bare det som er merket
//      verifisert, er hentet fra registrene.
//
// Den skal aldri si mer eller mindre enn datasettet. Tallene står som de er,
// og en andel rundes ned. Hvor resten kommer fra, sies bare så langt
// tellingene vet det: fra et register vi ikke har hentet selv, eller fra en
// annen kilde. Merket ved hver påstand sier hvilken.

import { Drawer as DrawerPrimitive } from "vaul";

import type { Grader } from "@/lib/data";
import { antall, datoKort, tall } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useKommune } from "./kommune-kontekst";
import { Symbolforklaring, Tegnforklaring } from "./tegnforklaring";

export interface Forhandsvarsel {
  /** Én setning etter «Forhåndsversjon.», til topplinjen og bunnlinjen. */
  kort: string;
  /** Hele forklaringen, til bunnteksten. */
  lang: string;
}

/** Det et varsel regnes fra: gradtellingene datalaget gir for et omfang. */
export type Gradgrunnlag = Pick<Grader, "roller" | "alle" | "forst_hentet" | "sist_hentet">;

/**
 * « 25.09.2026», eller « mellom 24.09.2026 og 25.09.2026» når innhentingen gikk
 * over flere dager. Én dato når de er ulike, ville sagt at alt ble hentet den
 * dagen.
 */
export function hentetDato(forst: string | null, sist: string | null): string {
  if (!sist) return "";
  if (!forst || forst === sist) return ` ${datoKort(sist)}`;
  return ` mellom ${datoKort(forst)} og ${datoKort(sist)}`;
}

/** Påstander i omfanget som ikke er rollene og ikke er verifisert. */
function andreUetterprovd(g: Gradgrunnlag): number {
  const alle = g.alle.totalt - g.alle.verifisert;
  const roller = g.roller.totalt - g.roller.verifisert;
  return Math.max(0, alle - roller);
}

/**
 * Varselet for rollene i et omfang: «i Tromsø», «i Troms».
 * `null` når omfanget ikke har roller.
 */
export function varselForRoller(omfang: string, g: Gradgrunnlag): Forhandsvarsel | null {
  const { totalt, verifisert, fra_register } = g.roller;
  if (totalt === 0) return null;
  const dato = hentetDato(g.forst_hentet, g.sist_hentet);
  const ikkeHentet = Math.max(0, fra_register - verifisert);
  const andre = totalt - verifisert - ikkeHentet;
  const resten = [
    ikkeHentet > 0 && `${tall(ikkeHentet)} er fra registre vi ikke har hentet selv`,
    andre > 0 && `${tall(andre)} er fra andre kilder`,
  ].filter(Boolean);
  const restSetning = resten.length
    ? ` Av resten ${resten.join(", og ")}. De er ikke etterprøvd av oss.`
    : "";
  if (verifisert === 0) {
    return {
      kort: `Ingen av de ${tall(totalt)} rollene ${omfang} er hentet direkte fra registrene ennå.`,
      lang: `Ingen av de ${tall(totalt)} rollene ${omfang} er hentet direkte fra registrene ennå.${restSetning}`,
    };
  }
  if (verifisert === totalt) {
    // Alle rollene er hentet, men siden viser også organer, tall og hendelser.
    // Er noen av dem ikke etterprøvd, sier varselet det, så «alle» ikke leses
    // som alt på siden.
    const s = `Alle de ${tall(totalt)} rollene ${omfang} er hentet direkte fra registrene${dato}.`;
    const n = andreUetterprovd(g);
    const tillegg = n
      ? ` ${tall(n)} ${n === 1 ? "annen påstand" : "andre påstander"} er ikke etterprøvd.`
      : "";
    return {
      kort: `${s}${tillegg}`,
      lang: `${s}${tillegg} Merket ved hver påstand sier hvor den kommer fra.`,
    };
  }
  const s = `${tall(verifisert)} av ${tall(totalt)} roller ${omfang} er hentet direkte fra registrene${dato}.`;
  return { kort: `${s} Resten er ikke etterprøvd.`, lang: `${s}${restSetning}` };
}

/**
 * Varselet for en region med flere fylker. Rollene kan ikke summeres over
 * fylkene (Statsforvalteren står i to), så varselet sier spennet i andelen og
 * nevner fylkene som ikke har roller ennå.
 */
export function varselForFylker(
  fylker: { navn: string; grader: Gradgrunnlag }[],
): Forhandsvarsel | null {
  const med = fylker.filter((f) => f.grader.roller.totalt > 0);
  if (!med.length) return null;
  const uten = fylker.filter((f) => f.grader.roller.totalt === 0).map((f) => f.navn);
  const liste = (xs: string[]) =>
    xs.length > 1 ? `${xs.slice(0, -1).join(", ")} og ${xs.at(-1)}` : (xs[0] ?? "");
  const datoer = (velg: (g: Gradgrunnlag) => string | null) =>
    med
      .map((f) => velg(f.grader))
      .filter((d): d is string => d !== null)
      .sort();
  const dato = hentetDato(
    datoer((g) => g.forst_hentet)[0] ?? null,
    datoer((g) => g.sist_hentet).at(-1) ?? null,
  );
  const detaljer = med
    .map((f) => `${f.navn}: ${tall(f.grader.roller.verifisert)} av ${tall(f.grader.roller.totalt)}`)
    .join(". ");
  const utenSetning = uten.length ? ` ${liste(uten)} har ingen roller i datasettene ennå.` : "";
  const hvor =
    uten.length || med.length === 1 ? `i ${liste(med.map((f) => f.navn))}` : "i hvert fylke";
  const alleRoller = med.every((f) => f.grader.roller.verifisert === f.grader.roller.totalt);
  // Påstandene kan heller ikke summeres over fylkene, så varselet sier bare om
  // noe utenom rollene står uetterprøvd, ikke hvor mye.
  const andreUten = med.some((f) => andreUetterprovd(f.grader) > 0);

  let hoved: string;
  let rest: string;
  if (med.length === 1 && !alleRoller) {
    const r = med[0]!.grader.roller;
    hoved = `${tall(r.verifisert)} av ${tall(r.totalt)} roller i ${med[0]!.navn} er hentet direkte fra registrene${dato}.`;
    rest = "Resten er ikke etterprøvd.";
  } else if (alleRoller) {
    hoved = `Alle rollene ${hvor} er hentet direkte fra registrene${dato}.`;
    rest = andreUten ? "Noen andre påstander er ikke etterprøvd." : "";
  } else {
    const andeler = med.map((f) =>
      Math.floor((100 * f.grader.roller.verifisert) / f.grader.roller.totalt),
    );
    const lav = Math.min(...andeler);
    const hoy = Math.max(...andeler);
    const spenn = lav === hoy ? `${lav} %` : `Mellom ${lav} og ${hoy} %`;
    hoved = `${spenn} av rollene ${hvor} er hentet direkte fra registrene${dato}.`;
    rest = "Resten er ikke etterprøvd.";
  }
  return {
    // Den korte står i topplinjen og må holde seg til to linjer. Fylkene uten
    // roller står i den lange og på fylkeskortene.
    kort: rest ? `${hoved} ${rest}` : hoved,
    lang: `${hoved}${med.length > 1 ? ` ${detaljer}.` : ""}${rest ? ` ${rest.replace(/\.$/, " av oss.")}` : ""} Merket ved hver påstand sier hvor den kommer fra.${utenSetning}`,
  };
}

const GENERELT: Forhandsvarsel = {
  kort: "Bare det som er merket verifisert, er hentet direkte fra registrene. Resten er ikke etterprøvd.",
  lang: "Bare påstandene som er merket verifisert, er hentet direkte fra registrene av vår egen innhenting. Resten er ikke etterprøvd av oss. Merket ved hver påstand sier hvor den kommer fra.",
};

/** Varselet for siden: det siden regnet, ellers kommunens påstander, ellers det generelle. */
export function useForhandsvarsel(varsel?: Forhandsvarsel | null): Forhandsvarsel {
  const kommune = useKommune();
  if (varsel) return varsel;
  if (kommune) {
    const { verifisert, oppgitt, maa_verifiseres } = kommune.telling;
    const totalt = verifisert + oppgitt + maa_verifiseres;
    if (totalt > 0) {
      const omfang = `om ${kommune.kommune.navn}`;
      if (verifisert === 0) {
        return {
          kort: `Ingen av de ${tall(totalt)} påstandene ${omfang} er hentet direkte fra registrene ennå.`,
          lang: `Ingen av de ${tall(totalt)} påstandene ${omfang} er hentet direkte fra registrene ennå. De er sammenstilt ${datoKort(kommune.kommune.sammenstilt)} og ikke etterprøvd av oss.`,
        };
      }
      if (verifisert === totalt) {
        const s = `Alle de ${tall(totalt)} påstandene ${omfang} er hentet direkte fra registrene.`;
        return { kort: s, lang: `${s} Merket ved hver påstand sier hvor den kommer fra.` };
      }
      const s = `${tall(verifisert)} av ${antall(totalt, "påstand", "påstander")} ${omfang} er hentet direkte fra registrene.`;
      return {
        kort: `${s} Resten er ikke etterprøvd.`,
        lang: `${s} Resten er ikke etterprøvd av oss. Merket ved hver påstand sier hvor den kommer fra.`,
      };
    }
  }
  return GENERELT;
}

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
  varsel,
  className,
}: {
  /** Regnet fra gradene. Utelatt: kommunens påstander, ellers den generelle setningen. */
  varsel?: Forhandsvarsel | null | undefined;
  className?: string;
}) {
  const v = useForhandsvarsel(varsel);
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
        <strong className="font-semibold text-trykk">Forhåndsversjon.</strong> {v.kort}
      </span>
    </p>
  );
}

export function ForhandsversjonBunn({
  varsel,
  proHref = "/pro",
  tegnforklaring = true,
}: {
  /** Regnet fra gradene. Utelatt: kommunens påstander, ellers den generelle setningen. */
  varsel?: Forhandsvarsel | null | undefined;
  /** Ikke lenger i bruk: setningen regnes fra gradene. Står igjen så eldre kall virker. */
  sammenstilt?: string | null;
  proHref?: string;
  /** Knappen til tegnforklaringen. Av på sider uten kildemerker. */
  tegnforklaring?: boolean;
}) {
  const v = useForhandsvarsel(varsel);
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
            <strong className="font-semibold text-trykk">Forhåndsversjon.</strong> {v.kort}
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
