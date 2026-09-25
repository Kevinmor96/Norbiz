// Det forsiden trenger, regnet ferdig i loaderen. Forsiden viser én kartlagt
// kommune som smakebit: kartbladet og tre tall. Tallene regnes med de samme
// funksjonene som kartbladets rand på kommunesiden (topp/nokkeltall.ts), så
// forsiden og kommunesiden aldri sier forskjellige ting.
//
// Hele kommunesiden lastes på serveren, men bare tallene sendes videre. Loader-
// data serialiseres inn i HTML-en, og forsiden skal ikke bære hele datasettet.
//
// Kommunen som vises, er den med flest organer i datasettet. Malen vet ikke at
// det er Tromsø.

import { avledBelegg, type AvledetBelegg } from "@/lib/belegg";
import type { BeleggUt, Kommuneliste, KommuneMeta, KommuneOversikt } from "@/lib/data";
import { lastKommuneside } from "@/lib/kommuneside";
import type { Terreng } from "@/lib/terreng";

import { seter, utbytte } from "../kommune/topp/nokkeltall";

export interface Tallsvar {
  /** Tallet. */
  antall: number;
  belegg: AvledetBelegg;
}

export interface Forsidedata {
  kommuner: Kommuneliste;
  utvalgt: {
    kommune: KommuneMeta;
    oversikt: KommuneOversikt;
    terreng: Terreng | null;
    orgnr: string | null;
    seter: { antall: number; organ: string; kortnavn: string | null; belegg: BeleggUt } | null;
    utbytte: {
      belop: number;
      total: number;
      aar: number | null;
      forslag: boolean;
      selskap: string;
      kortnavn: string | null;
      belegg: BeleggUt;
    } | null;
    /** Kjeden med flest steg, og hvor mange av stegene som mangler navngitt leder. */
    kjede: {
      tittel: string;
      sporsmal: string;
      steg: number;
      utenLeder: number;
      belegg: AvledetBelegg;
    } | null;
    /** Tall til «fire svar». `null` når datasettet ikke har noe å telle. */
    svar: {
      prosesser: (Tallsvar & { titler: string[] }) | null;
      organer: (Tallsvar & { nivaaer: number }) | null;
      eierandeler: Tallsvar | null;
      koblinger: Tallsvar | null;
    };
    hull: number;
  } | null;
}

export async function lastForside(): Promise<Forsidedata> {
  const { data } = await import("@/lib/data");
  const kommuner = await data.kommuner();
  const forst = [...kommuner].sort(
    (a, b) => b.antall_organer - a.antall_organer || (a.slug < b.slug ? -1 : 1),
  )[0];
  if (!forst) return { kommuner, utvalgt: null };

  const side = await lastKommuneside(forst.slug);
  if (!side) return { kommuner, utvalgt: null };
  const per = side.kommune.sammenstilt;

  const s = seter(side);
  const u = utbytte(side);

  const kjede = [...side.kjeder].sort((a, b) => b.steg.length - a.steg.length)[0];
  const kjedesvar = kjede
    ? {
        tittel: kjede.prosess.tittel,
        sporsmal: kjede.prosess.sporsmal,
        steg: kjede.steg.length,
        utenLeder: kjede.steg.filter((st) => st.ledere.length === 0).length,
        belegg: avledBelegg(
          kjede.steg.flatMap((st) => [st.belegg, ...st.ledere.map((l) => l.belegg)]),
          {
            per,
            merknad: `Telt fra kjeden «${kjede.prosess.tittel}» i datasettet: steg der organet har eller mangler en navngitt leder.`,
          },
        ),
      }
    : null;

  const organer = side.organkart.grupper.flatMap((g) => g.organer);
  // Et kommunalt foretak er en del av kommunen, ikke en eierandel (DESIGN.md §5.4).
  const direkte = side.eierskap.selskaper.filter(
    (x) => x.ledd === 1 && x.org.organtype !== "KF" && x.org.organtype !== "FKF",
  );
  const eier = side.eierskap.eier?.key;

  return {
    kommuner,
    utvalgt: {
      kommune: side.oversikt.kommune,
      oversikt: side.oversikt,
      terreng: side.terreng,
      orgnr: side.kommuneprofil?.organ.orgnr ?? null,
      seter: s
        ? { antall: s.antall, organ: s.org.navn, kortnavn: s.org.kortnavn, belegg: s.belegg }
        : null,
      utbytte: u
        ? {
            belop: u.belop,
            total: u.total,
            aar: u.aar,
            forslag: u.forslag,
            selskap: u.selskap.navn,
            kortnavn: u.selskap.kortnavn,
            belegg: u.belegg,
          }
        : null,
      kjede: kjedesvar,
      svar: {
        prosesser: side.kjeder.length
          ? {
              antall: side.kjeder.length,
              titler: side.kjeder.map((k) => k.prosess.tittel),
              belegg: avledBelegg(
                side.kjeder.flatMap((k) => k.steg.map((st) => st.belegg)),
                { per, merknad: "Telt fra beslutningskjedene i datasettet." },
              ),
            }
          : null,
        organer: organer.length
          ? {
              antall: organer.length,
              nivaaer: side.organkart.grupper.length,
              belegg: avledBelegg(
                organer.map((o) => o.belegg),
                { per, merknad: "Telt fra de aktive organene i organkartet." },
              ),
            }
          : null,
        eierandeler: direkte.length
          ? {
              antall: direkte.length,
              belegg: avledBelegg(
                direkte.flatMap((x) =>
                  x.eiere.filter((e) => e.org.key === eier).map((e) => e.belegg),
                ),
                {
                  per,
                  merknad:
                    "Telt fra selskapene kommunen eier direkte i datasettet, også de uten oppgitt andel. Kommunale foretak er ikke med, fordi de er en del av kommunen.",
                },
              ),
            }
          : null,
        koblinger: side.nettverk.personer.length
          ? {
              antall: side.nettverk.personer.length,
              belegg: avledBelegg(
                side.nettverk.personer.flatMap((p) => p.roller.map((r) => r.belegg)),
                {
                  per,
                  merknad:
                    "Telt fra nettverket: personer med aktive roller i minst to organer. Sensitive organer er ikke med.",
                },
              ),
            }
          : null,
      },
      hull: side.hull.length,
    },
  };
}
