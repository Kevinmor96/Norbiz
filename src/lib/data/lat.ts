// Den late implementasjonen av datalaget: laster bare datasettene et svar
// trenger, ett om gangen, og husker dem.
//
// Hvert kall slår opp i indeksen (indeks.ts) hvilke filer svaret trenger,
// laster dem, samler dem (samle.ts) og regner med `lagLokal` over den delen.
// Samlingen for en gitt mengde filer huskes, så neste kall på samme kommune er
// varmt. Delsamlingen får hele kommunelista, alle segmentene og tallene per
// kommune og fylke fra indeksen, fordi det er ting en del av samlingen ikke
// kan vite.
//
// Er indeksen gammel, bygges den på nytt fra alle filene. `kontroll` sier hvor
// grundig det sjekkes:
//
// - `lastede`: filsettet, og avtrykket til hver fil som lastes. Billig, og det
//   som brukes i produksjon, der testene har sjekket indeksen før bygget.
// - `alle`: laster alle filene første gang og sammenligner hvert avtrykk. For
//   utvikling, der datasettene endres mens serveren går.

import type { Regionregister } from "../../data/region/types";
import type { Kommunedatasett } from "../../data/types";
import { avtrykk, byggIndeks, type Dataindeks } from "./indeks";
import type { Datalag } from "./kontrakt";
import { lagLokal, type LokalDatalag } from "./lokal";
import { samle } from "./samle";
import type { Sokegrunnlag } from "./sok";

export interface Datakilde {
  /** Slug → laster for datasettet. */
  filer: Record<string, () => Promise<Kommunedatasett>>;
  /** Den innsjekkede indeksen, eller `null` for å bygge den fra filene. */
  indeks: Dataindeks | null;
  region: Regionregister | null;
  kontroll: "lastede" | "alle";
  /** Hvor en utdatert indeks meldes. Standard: console.warn. */
  varsle?: (melding: string) => void;
}

export interface LatDatalag extends Datalag {
  /** Datasettene som er lastet så langt, sortert. Til målinger og tester. */
  lastet(): string[];
  /** Søkegrunnlaget over alle datasettene. Til den statiske eksporten. */
  sokegrunnlag(): Promise<Sokegrunnlag>;
}

const tekst = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function lagLatLokal(kilde: Datakilde): LatDatalag {
  const slugs = Object.keys(kilde.filer).sort(tekst);
  const lastede = new Map<string, Promise<Kommunedatasett>>();
  const varsle = kilde.varsle ?? ((m: string) => console.warn(m));
  let utdatert = false;

  function last(slug: string): Promise<Kommunedatasett> {
    let p = lastede.get(slug);
    if (!p) {
      const laster = kilde.filer[slug];
      if (!laster) return Promise.reject(new Error(`Datasettet «${slug}» finnes ikke.`));
      p = laster().then((data) => {
        if (kilde.indeks && !utdatert) {
          const rad = kilde.indeks.datasett.find((d) => d.slug === slug);
          if (!rad || rad.avtrykk !== avtrykk(data)) utdatert = true;
        }
        return data;
      });
      lastede.set(slug, p);
      // En fil som ikke lot seg laste, skal kunne prøves igjen.
      p.catch(() => lastede.delete(slug));
    }
    return p;
  }

  let bygget: Promise<Dataindeks> | null = null;
  function byggFraFilene(grunn: string): Promise<Dataindeks> {
    bygget ??= (async () => {
      varsle(
        `Dataindeksen (src/lib/data/indeks.json) er utdatert: ${grunn}. ` +
          "Bygger den fra alle datasettene; siden er riktig, men treg. Kjør `npm run data:indeks`.",
      );
      const alle = await Promise.all(slugs.map(async (slug) => ({ slug, data: await last(slug) })));
      return byggIndeks(alle, kilde.region);
    })();
    return bygget;
  }

  let sjekket: Promise<Dataindeks> | null = null;
  /** Indeksen som gjelder nå: den innsjekkede, eller en bygget fra filene. */
  function indeks(): Promise<Dataindeks> {
    if (bygget) return bygget;
    sjekket ??= (async () => {
      const ix = kilde.indeks;
      if (!ix) return byggFraFilene("den mangler");
      const iIndeks = ix.datasett.map((d) => d.slug);
      if (iIndeks.join(",") !== slugs.join(",")) {
        const nye = slugs.filter((x) => !iIndeks.includes(x));
        const borte = iIndeks.filter((x) => !slugs.includes(x));
        return byggFraFilene(
          [
            nye.length ? `nye datasett ${nye.join(", ")}` : "",
            borte.length ? `borte ${borte.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("; "),
        );
      }
      if (kilde.kontroll === "alle") {
        await Promise.all(slugs.map(last));
        if (utdatert) return byggFraFilene("et datasett er endret");
      }
      return ix;
    })();
    return sjekket;
  }

  // Én samling per mengde filer. Nøkkelen tar med hvilken indeks den er
  // regnet med, så en ny indeks ikke gjenbruker samlinger fra den gamle.
  const samlinger = new Map<string, LokalDatalag>();

  async function over(finn: (ix: Dataindeks) => string[] | null): Promise<LokalDatalag | null> {
    let ix = await indeks();
    let filer = finn(ix);
    if (filer === null) return null;
    let data = await Promise.all(filer.map(async (slug) => ({ slug, data: await last(slug) })));
    // En fil som lastes nå, kan vise at indeksen er gammel. Da regnes
    // filmengden på nytt med en indeks bygget fra alle filene.
    if (utdatert && ix === kilde.indeks) {
      ix = await byggFraFilene("et datasett er endret");
      filer = finn(ix);
      if (filer === null) return null;
      data = await Promise.all(filer.map(async (slug) => ({ slug, data: await last(slug) })));
    }
    const nokkel = `${ix === kilde.indeks ? "innsjekket" : "bygget"}:${[...filer].sort(tekst).join(",")}`;
    let d = samlinger.get(nokkel);
    if (!d) {
      const s = samle(data);
      const egne = new Map(s.kommuner.map((k) => [k.slug, k]));
      // Hele kommunelista fra indeksen. Prosessene finnes bare for kommunene som
      // er lastet, og de er de eneste som spørres om prosesser i denne samlingen.
      s.kommuner = ix.datasett.map(
        (x) =>
          egne.get(x.slug) ?? { slug: x.slug, meta: x.meta, organer: x.organer, prosesser: [] },
      );
      for (const seg of ix.segmenter)
        if (!s.segmenter.has(seg.kode)) s.segmenter.set(seg.kode, seg);
      d = lagLokal(s, { region: kilde.region, aggregater: ix.aggregater });
      samlinger.set(nokkel, d);
    }
    return d;
  }

  // Indeksen er vanlige objekter fra JSON. Et oppslag på en nøkkel fra
  // adressen må sjekke egne egenskaper: `constructor` og `__proto__` finnes på
  // alle objekter og ga 500 i stedet for 404.
  const egen = <T>(o: Record<string, T>, k: string): T | undefined =>
    Object.hasOwn(o, k) ? o[k] : undefined;
  const slugFor = (ix: Dataindeks, kommunenr: string) =>
    ix.datasett.find((d) => d.meta.kommunenr === kommunenr)?.slug ?? null;
  const kommunefiler = (kommunenr: string) => (ix: Dataindeks) => {
    const slug = slugFor(ix, kommunenr);
    return slug === null ? null : (egen(ix.kommune, slug) ?? [slug]);
  };
  const organfiler = (key: string) => (ix: Dataindeks) => {
    const her = egen(ix.organ, key);
    if (her) return her;
    const forste = ix.datasett.find((d) => d.organer.includes(key));
    return forste ? [forste.slug] : null;
  };
  const ingen = () => [] as string[];

  /** Kaller `f` over samlingen svaret trenger, eller gir `tom` når det ikke finnes. */
  async function med<T>(
    finn: (ix: Dataindeks) => string[] | null,
    f: (d: LokalDatalag) => Promise<T>,
    tom: T,
  ): Promise<T> {
    const d = await over(finn);
    return d ? f(d) : tom;
  }

  return {
    kommuner: () => med(ingen, (d) => d.kommuner(), []),
    kommune_oversikt: (nr) => med(kommunefiler(nr), (d) => d.kommune_oversikt(nr), null),
    beslutningskjede: (nr, p) => med(kommunefiler(nr), (d) => d.beslutningskjede(nr, p), null),
    organkart: (nr) => med(kommunefiler(nr), (d) => d.organkart(nr), null),
    organ_profil: (key) => med(organfiler(key), (d) => d.organ_profil(key), null),
    eierskap: (nr) => med(kommunefiler(nr), (d) => d.eierskap(nr), null),
    nettverk: (nr) => med(kommunefiler(nr), (d) => d.nettverk(nr), null),
    endringer: (nr) => med(kommunefiler(nr), (d) => d.endringer(nr), null),
    organer_for_segment: (seg, nr) =>
      med(kommunefiler(nr), (d) => d.organer_for_segment(seg, nr), null),
    hull: (nr) => med(kommunefiler(nr), (d) => d.hull(nr), null),
    kommune_grader: (nr) => med(kommunefiler(nr), (d) => d.kommune_grader(nr), null),
    region_oversikt: async () => (await over(ingen))!.region_oversikt(),
    fylke_oversikt: (fylkesnr) =>
      med(
        (ix) => egen(ix.fylke, fylkesnr) ?? [],
        (d) => d.fylke_oversikt(fylkesnr),
        null,
      ),
    // Søket går over alt. Første søk laster derfor alle datasettene; i
    // Supabase er det én spørring.
    sok: async (sporring, limit) => (await over(() => slugs))!.sok(sporring, limit),
    sokegrunnlag: async () => (await over(() => slugs))!.sokegrunnlag(),
    lastet: () => [...lastede.keys()].sort(tekst),
  };
}
