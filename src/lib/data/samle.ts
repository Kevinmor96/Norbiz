// Slår sammen kommunedatasettene til én samling, slik basen ser dem.
//
// Organisasjoner, personer, kilder og segmenter er felles for hele landet og
// identifiseres med `key`. Statsforvalteren er det samme organet i Tromsø og
// Balsfjord. Roller, relasjoner, nøkkeltall, hendelser og hull har ingen key i
// datasettet og identifiseres med en naturlig nøkkel satt sammen av feltene som
// gjør dem unike. Prosesser hører til én kommune.
//
// Står den samme enheten i to datasett, må den være lik i begge. Er den ikke
// det, stopper samlingen. Det er bedre enn at den siste fila vinner i stillhet.
//
// Modulen er ren: ingen filsystem, ingen Vite. Både `lokal.ts` (i nettleseren
// og på serveren) og `scripts/seed-build.ts` (i Node) bruker den, og det er
// derfor seed-en og siden ser de samme radene.

import type {
  Belegg,
  Hendelse,
  Hull,
  Kilde,
  Kommunedatasett,
  Nokkeltall,
  Organisasjon,
  OrgSegment,
  Person,
  Prosess,
  Relasjon,
  Rolleinnehav,
  Segment,
} from "../../data/types";

export interface KommuneIDatasett {
  slug: string;
  meta: Kommunedatasett["meta"];
  /** `Organisasjon.key` for organene i kommunens datasett. */
  organer: string[];
  prosesser: Prosess[];
}

/** En hendelse uten organ hører til kommunen den kom fra. */
export interface SamletHendelse extends Hendelse {
  kommunenr?: string;
}

export interface Samling {
  /** Sortert på slug. */
  kommuner: KommuneIDatasett[];
  kilder: Map<string, Kilde>;
  organisasjoner: Map<string, Organisasjon>;
  personer: Map<string, Person>;
  segmenter: Map<string, Segment>;
  /** Nøkkel: `nokkel.rolle(...)`. */
  roller: Map<string, Rolleinnehav>;
  relasjoner: Map<string, Relasjon>;
  nokkeltall: Map<string, Nokkeltall>;
  hendelser: Map<string, SamletHendelse>;
  /** Nøkkel: `org|segment`. */
  org_segment: Map<string, OrgSegment>;
  hull: Map<string, Hull>;
}

/**
 * Naturlige nøkler. Seed-en bruker dem som `key`-kolonne og avleder UUID-en
 * fra dem, så de må være stabile: endres en av delene, er det en ny rad.
 */
export const nokkel = {
  rolle: (r: Rolleinnehav) => [r.org, r.person, r.rolletype, r.fra ?? ""].join("|"),
  relasjon: (r: Relasjon) => [r.fra, r.type, r.til, r.fra_dato ?? ""].join("|"),
  nokkeltall: (n: Nokkeltall) =>
    [
      n.org,
      String(n.aar),
      n.periode ?? "",
      n.type,
      n.konsern === undefined ? "" : String(n.konsern),
    ].join("|"),
  hendelse: (h: SamletHendelse) =>
    [h.dato, h.type, h.org ?? `kommune:${h.kommunenr ?? ""}`, h.tittel].join("|"),
  hull: (h: Hull) => [h.gjelder, h.hva].join("|"),
  orgSegment: (s: OrgSegment) => [s.org, s.segment].join("|"),
  prosessSteg: (kommuneSlug: string, prosessKey: string, nr: number) =>
    [kommuneSlug, prosessKey, String(nr)].join("|"),
};

/** JSON med sorterte nøkler, så to like objekter gir lik tekst. */
function kanonisk(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(kanonisk).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonisk(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function leggTil<T>(
  kart: Map<string, T>,
  key: string,
  verdi: T,
  hvor: Map<string, string>,
  slug: string,
  hva: string,
): void {
  const fra = kart.get(key);
  if (fra === undefined) {
    kart.set(key, verdi);
    hvor.set(`${hva}:${key}`, slug);
    return;
  }
  if (kanonisk(fra) !== kanonisk(verdi)) {
    throw new Error(
      `${hva} «${key}» står ulikt i ${hvor.get(`${hva}:${key}`)}.json og ${slug}.json. ` +
        "En felles enhet må være lik i alle datasett.",
    );
  }
}

/** `datasett` er kommunedatasett med slug (filnavnet uten .json). */
export function samle(datasett: { slug: string; data: Kommunedatasett }[]): Samling {
  const s: Samling = {
    kommuner: [],
    kilder: new Map(),
    organisasjoner: new Map(),
    personer: new Map(),
    segmenter: new Map(),
    roller: new Map(),
    relasjoner: new Map(),
    nokkeltall: new Map(),
    hendelser: new Map(),
    org_segment: new Map(),
    hull: new Map(),
  };
  const hvor = new Map<string, string>();
  const sortert = [...datasett].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  for (const { slug, data } of sortert) {
    if (s.kommuner.some((k) => k.meta.kommunenr === data.meta.kommunenr)) {
      throw new Error(`Kommunenummer ${data.meta.kommunenr} finnes i to datasett (${slug}.json).`);
    }
    s.kommuner.push({
      slug,
      meta: data.meta,
      organer: data.organisasjoner.map((o) => o.key),
      prosesser: data.prosesser,
    });
    for (const x of data.kilder) leggTil(s.kilder, x.key, x, hvor, slug, "Kilde");
    for (const x of data.organisasjoner)
      leggTil(s.organisasjoner, x.key, x, hvor, slug, "Organisasjon");
    for (const x of data.personer) leggTil(s.personer, x.key, x, hvor, slug, "Person");
    for (const x of data.segmenter) leggTil(s.segmenter, x.kode, x, hvor, slug, "Segment");
    for (const x of data.roller) leggTil(s.roller, nokkel.rolle(x), x, hvor, slug, "Rolle");
    for (const x of data.relasjoner)
      leggTil(s.relasjoner, nokkel.relasjon(x), x, hvor, slug, "Relasjon");
    for (const x of data.nokkeltall)
      leggTil(s.nokkeltall, nokkel.nokkeltall(x), x, hvor, slug, "Nøkkeltall");
    for (const x of data.hendelser) {
      const h: SamletHendelse = x.org === undefined ? { ...x, kommunenr: data.meta.kommunenr } : x;
      leggTil(s.hendelser, nokkel.hendelse(h), h, hvor, slug, "Hendelse");
    }
    for (const x of data.org_segment)
      leggTil(s.org_segment, nokkel.orgSegment(x), x, hvor, slug, "Org-segment");
    for (const x of data.hull) leggTil(s.hull, nokkel.hull(x), x, hvor, slug, "Hull");
  }
  return s;
}

/**
 * Referanse- og formsjekk. Returnerer feilene som tekst. Seed-byggeren nekter
 * å skrive seed-en hvis lista ikke er tom, og `tests/datasett.test.ts` krever
 * at den er tom.
 */
export function valider(s: Samling): string[] {
  const feil: string[] = [];
  const org = (key: string | undefined, hvor: string) => {
    if (key !== undefined && !s.organisasjoner.has(key))
      feil.push(`${hvor}: ukjent organisasjon «${key}»`);
  };
  const person = (key: string, hvor: string) => {
    if (!s.personer.has(key)) feil.push(`${hvor}: ukjent person «${key}»`);
  };
  const belegg = (b: Belegg, hvor: string) => {
    if (!s.kilder.has(b.kilde)) feil.push(`${hvor}: ukjent kilde «${b.kilde}»`);
  };

  for (const o of s.organisasjoner.values()) {
    org(o.overordnet, `organisasjon ${o.key}.overordnet`);
    belegg(o.belegg, `organisasjon ${o.key}`);
    for (const seg of o.segmenter) {
      if (!s.segmenter.has(seg)) feil.push(`organisasjon ${o.key}: ukjent segment «${seg}»`);
    }
  }
  for (const [k, r] of s.roller) {
    org(r.org, `rolle ${k}`);
    person(r.person, `rolle ${k}`);
    belegg(r.belegg, `rolle ${k}`);
  }
  for (const [k, r] of s.relasjoner) {
    org(r.fra, `relasjon ${k}`);
    org(r.til, `relasjon ${k}`);
    belegg(r.belegg, `relasjon ${k}`);
  }
  for (const [k, n] of s.nokkeltall) {
    org(n.org, `nøkkeltall ${k}`);
    belegg(n.belegg, `nøkkeltall ${k}`);
  }
  for (const [k, h] of s.hendelser) {
    org(h.org, `hendelse ${k}`);
    for (const p of h.personer ?? []) person(p, `hendelse ${k}`);
    belegg(h.belegg, `hendelse ${k}`);
  }
  for (const [k, x] of s.org_segment) {
    org(x.org, `org_segment ${k}`);
    if (!s.segmenter.has(x.segment)) feil.push(`org_segment ${k}: ukjent segment «${x.segment}»`);
  }
  for (const [k, h] of s.hull) {
    org(h.gjelder, `hull ${k}`);
    for (const p of h.personer ?? []) person(p, `hull ${k}`);
  }
  for (const kommune of s.kommuner) {
    const egne = new Set(kommune.organer);
    for (const p of kommune.prosesser) {
      p.steg.forEach((steg, i) => {
        const hvor = `prosess ${kommune.slug}/${p.key} steg ${i + 1}`;
        if (!egne.has(steg.org))
          feil.push(`${hvor}: organet «${steg.org}» er ikke i kommunens datasett`);
        belegg(steg.belegg, hvor);
      });
    }
    if (new Set(kommune.prosesser.map((p) => p.key)).size !== kommune.prosesser.length) {
      feil.push(`kommune ${kommune.slug}: to prosesser har samme key`);
    }
  }
  return feil;
}
