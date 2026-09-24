// Genererer supabase/seed/seed.sql fra kommunedatasettene i src/data/*.json.
//
//   npm run seed:build
//
// Seed-en er deterministisk og idempotent:
//
// - Samme JSON gir byte-lik SQL. Radene sorteres på nøkkel, og ingenting
//   avhenger av klokka eller av rekkefølgen filene leses i.
// - Id-er avledes av naturlige nøkler med intern.nokkel_id(), aldri av
//   gen_random_uuid(). I Bransjesjekk flyttet en tilfeldig id alle avledede
//   tall mellom kjøringer mens kildedataene var byte-identiske.
// - Påstander upsertes på `key`. Kjøres seed-en to ganger, er basen lik etter
//   begge. En rad pipelinen har satt til `verifisert`, overskrives ikke.
// - Det datasettene eier alene (hvilke organer en kommune har, segmentene
//   organene påvirker, stegene i en prosess), erstattes i sin helhet.
//
// Samlingen og valideringen er de samme som lokal.ts bruker (samle.ts), så
// seed-en og siden ser de samme radene.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Belegg, Kommunedatasett } from "../src/data/types";
import { nokkel, samle, valider, type Samling } from "../src/lib/data/samle";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATAMAPPE = join(ROT, "src", "data");
export const SEEDFIL = join(ROT, "supabase", "seed", "seed.sql");

/** Alle `src/data/*.json`, sortert på filnavn, med slug fra filnavnet. */
export function lesDatasett(mappe = DATAMAPPE): { slug: string; data: Kommunedatasett }[] {
  return readdirSync(mappe)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({
      slug: f.replace(/\.json$/, ""),
      data: JSON.parse(readFileSync(join(mappe, f), "utf8")) as Kommunedatasett,
    }));
}

// ---------------------------------------------------------------------------
// SQL-literaler
// ---------------------------------------------------------------------------

type Verdi = string | number | boolean | null | undefined;

const tekst = (v: string | null | undefined): string =>
  v === null || v === undefined ? "null" : `'${v.replaceAll("'", "''")}'`;

function lit(v: Verdi): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Ugyldig tall: ${v}`);
    return String(v);
  }
  return tekst(v);
}

const id = (tabell: string, key: string) => `intern.nokkel_id(${tekst(tabell)}, ${tekst(key)})`;
const idOrNull = (tabell: string, key: string | undefined) =>
  key === undefined ? "null" : id(tabell, key);
const enumListe = (verdier: readonly string[], type: string) =>
  verdier.length === 0 ? `'{}'::${type}[]` : `array[${verdier.map(tekst).join(", ")}]::${type}[]`;
const idListe = (tabell: string, keys: readonly string[] | undefined) =>
  !keys || keys.length === 0
    ? `'{}'::uuid[]`
    : `array[${keys.map((k) => id(tabell, k)).join(", ")}]::uuid[]`;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortertPaa = <T>(kart: Map<string, T>): [string, T][] =>
  [...kart].sort(([a], [b]) => cmp(a, b));

const BELEGG_KOLONNER = ["kilde_id", "verifisering", "per", "merknad"];
const belegg = (b: Belegg) => [
  id("kilde", b.kilde),
  tekst(b.verifisering),
  tekst(b.per),
  tekst(b.merknad),
];

/**
 * Én insert med alle radene og `on conflict ... do update` for alt unntatt
 * id og nøkkel. `vern` er et vilkår som hindrer oppdatering (brukt for å
 * aldri overskrive det pipelinen har verifisert).
 */
function upsert(
  tabell: string,
  kolonner: string[],
  rader: string[][],
  konflikt: string[],
  vern?: string,
): string {
  if (rader.length === 0) return `-- ${tabell}: ingen rader\n`;
  const oppdater = kolonner.filter((k) => k !== "id" && !konflikt.includes(k));
  return [
    `insert into ${tabell} (${kolonner.join(", ")}) values`,
    rader.map((r) => `  (${r.join(", ")})`).join(",\n"),
    `on conflict (${konflikt.join(", ")}) do update set`,
    oppdater.map((k) => `  ${k} = excluded.${k}`).join(",\n") +
      (vern ? `\nwhere ${vern}` : "") +
      ";",
    "",
  ].join("\n");
}

function insert(tabell: string, kolonner: string[], rader: string[][]): string {
  if (rader.length === 0) return `-- ${tabell}: ingen rader\n`;
  return [
    `insert into ${tabell} (${kolonner.join(", ")}) values`,
    rader.map((r) => `  (${r.join(", ")})`).join(",\n") + ";",
    "",
  ].join("\n");
}

const ikkeVerifisert = (tabell: string) => `${tabell}.verifisering <> 'verifisert'`;

// ---------------------------------------------------------------------------
// Seed-en
// ---------------------------------------------------------------------------

export function byggSeed(s: Samling): string {
  const feil = valider(s);
  if (feil.length > 0) {
    throw new Error(`Datasettet har ${feil.length} feil:\n  ${feil.join("\n  ")}`);
  }

  const kommuneSlug = new Map(s.kommuner.map((k) => [k.meta.kommunenr, k.slug]));
  const deler: string[] = [];
  const del = (overskrift: string, sql: string) => deler.push(`-- ${overskrift}\n${sql}`);

  del(
    "Kilder",
    upsert(
      "kilde",
      ["id", "key", "navn", "url", "type", "lisens"],
      sortertPaa(s.kilder).map(([key, k]) => [
        id("kilde", key),
        tekst(key),
        tekst(k.navn),
        tekst(k.url),
        tekst(k.type),
        tekst(k.lisens),
      ]),
      ["key"],
    ),
  );

  del(
    "Kommuner",
    upsert(
      "kommune",
      [
        "id",
        "slug",
        "kommunenr",
        "navn",
        "fylkesnr",
        "fylke",
        "sammenstilt",
        "grunnlag",
        "merknad",
      ],
      s.kommuner.map((k) => [
        id("kommune", k.slug),
        tekst(k.slug),
        tekst(k.meta.kommunenr),
        tekst(k.meta.kommune),
        tekst(k.meta.fylkesnr),
        tekst(k.meta.fylke),
        tekst(k.meta.sammenstilt),
        tekst(k.meta.grunnlag),
        tekst(k.meta.merknad),
      ]),
      ["slug"],
    ),
  );

  del(
    "Organisasjoner",
    upsert(
      "organisasjon",
      [
        "id",
        "key",
        "orgnr",
        "navn",
        "kortnavn",
        "nivaa",
        "organtype",
        "overordnet_id",
        "kommunenr",
        "fylkesnr",
        "rekkevidde",
        "myndighet",
        "antall_medlemmer",
        "gyldig_fra",
        "gyldig_til",
        "status",
        "sensitiv",
        "beskrivelse",
        ...BELEGG_KOLONNER,
      ],
      sortertPaa(s.organisasjoner).map(([key, o]) => [
        id("organisasjon", key),
        tekst(key),
        tekst(o.orgnr),
        tekst(o.navn),
        tekst(o.kortnavn),
        tekst(o.nivaa),
        tekst(o.organtype),
        idOrNull("organisasjon", o.overordnet),
        tekst(o.kommunenr),
        tekst(o.fylkesnr),
        tekst(o.rekkevidde),
        enumListe(o.myndighet, "myndighet"),
        lit(o.antall_medlemmer),
        tekst(o.gyldig_fra),
        tekst(o.gyldig_til),
        tekst(o.status),
        lit(o.sensitiv),
        tekst(o.beskrivelse),
        ...belegg(o.belegg),
      ]),
      ["key"],
      ikkeVerifisert("organisasjon"),
    ),
  );

  // Hvilke organer hver kommune har. Eies av datasettet og erstattes helt.
  del(
    "Organene i hver kommune",
    `delete from kommune_org where kommune_id in (${s.kommuner.map((k) => id("kommune", k.slug)).join(", ")});\n` +
      insert(
        "kommune_org",
        ["kommune_id", "org_id"],
        s.kommuner.flatMap((k) =>
          [...k.organer].sort(cmp).map((o) => [id("kommune", k.slug), id("organisasjon", o)]),
        ),
      ),
  );

  del(
    "Segmenter",
    upsert(
      "segment",
      ["id", "kode", "navn"],
      sortertPaa(s.segmenter).map(([kode, x]) => [id("segment", kode), tekst(kode), tekst(x.navn)]),
      ["kode"],
    ),
  );

  // Vår egen klassifisering. Eies av datasettene og erstattes for organene her.
  del(
    "Segmentene organene påvirker",
    `delete from org_segment where org_id in (select id from organisasjon where key in (${sortertPaa(
      s.organisasjoner,
    )
      .map(([k]) => tekst(k))
      .join(", ")}));\n` +
      insert(
        "org_segment",
        ["org_id", "segment_id", "styrke"],
        sortertPaa(s.org_segment).map(([, x]) => [
          id("organisasjon", x.org),
          id("segment", x.segment),
          lit(x.styrke),
        ]),
      ),
  );

  // Bare navn. brreg_person_hash og innsigelse_status røres ikke, så en
  // ny seed opphever aldri en sperring.
  del(
    "Personer",
    upsert(
      "person",
      ["id", "key", "navn"],
      sortertPaa(s.personer).map(([key, p]) => [id("person", key), tekst(key), tekst(p.navn)]),
      ["key"],
    ),
  );

  del(
    "Roller",
    upsert(
      "rolleinnehav",
      [
        "id",
        "key",
        "org_id",
        "person_id",
        "tittel",
        "rolletype",
        "status",
        "parti",
        "fra",
        "til",
        "til_forventet",
        ...BELEGG_KOLONNER,
      ],
      sortertPaa(s.roller).map(([key, r]) => [
        id("rolleinnehav", key),
        tekst(key),
        id("organisasjon", r.org),
        id("person", r.person),
        tekst(r.tittel),
        tekst(r.rolletype),
        tekst(r.status),
        tekst(r.parti),
        tekst(r.fra),
        tekst(r.til),
        tekst(r.til_forventet),
        ...belegg(r.belegg),
      ]),
      ["key"],
      ikkeVerifisert("rolleinnehav"),
    ),
  );

  del(
    "Relasjoner",
    upsert(
      "relasjon",
      [
        "id",
        "key",
        "fra_org_id",
        "til_org_id",
        "type",
        "andel",
        "belop_nok",
        "fra_dato",
        "til_dato",
        ...BELEGG_KOLONNER,
      ],
      sortertPaa(s.relasjoner).map(([key, r]) => [
        id("relasjon", key),
        tekst(key),
        id("organisasjon", r.fra),
        id("organisasjon", r.til),
        tekst(r.type),
        lit(r.andel),
        lit(r.belop_nok),
        tekst(r.fra_dato),
        tekst(r.til_dato),
        ...belegg(r.belegg),
      ]),
      ["key"],
      ikkeVerifisert("relasjon"),
    ),
  );

  del(
    "Nøkkeltall",
    upsert(
      "nokkeltall",
      [
        "id",
        "key",
        "org_id",
        "aar",
        "periode",
        "type",
        "verdi",
        "enhet",
        "konsern",
        ...BELEGG_KOLONNER,
      ],
      sortertPaa(s.nokkeltall).map(([key, n]) => [
        id("nokkeltall", key),
        tekst(key),
        id("organisasjon", n.org),
        lit(n.aar),
        tekst(n.periode),
        tekst(n.type),
        lit(n.verdi),
        tekst(n.enhet),
        lit(n.konsern),
        ...belegg(n.belegg),
      ]),
      ["key"],
      ikkeVerifisert("nokkeltall"),
    ),
  );

  del(
    "Hendelser",
    upsert(
      "hendelse",
      [
        "id",
        "key",
        "dato",
        "presisjon",
        "type",
        "tittel",
        "tekst",
        "org_id",
        "kommune_id",
        "personer",
        ...BELEGG_KOLONNER,
      ],
      sortertPaa(s.hendelser).map(([key, h]) => {
        const slug = h.kommunenr === undefined ? undefined : kommuneSlug.get(h.kommunenr);
        return [
          id("hendelse", key),
          tekst(key),
          tekst(h.dato),
          tekst(h.presisjon),
          tekst(h.type),
          tekst(h.tittel),
          tekst(h.tekst),
          idOrNull("organisasjon", h.org),
          h.org === undefined ? idOrNull("kommune", slug) : "null",
          idListe("person", h.personer),
          ...belegg(h.belegg),
        ];
      }),
      ["key"],
      ikkeVerifisert("hendelse"),
    ),
  );

  // Prosessene hører til én kommune, og stegene eies av datasettet.
  const prosesser = s.kommuner.flatMap((k) =>
    [...k.prosesser].sort((a, b) => cmp(a.key, b.key)).map((p) => ({ slug: k.slug, p })),
  );
  del(
    "Beslutningskjeder",
    upsert(
      "prosess",
      ["id", "kommune_id", "key", "tittel", "sporsmal"],
      prosesser.map(({ slug, p }) => [
        id("prosess", `${slug}|${p.key}`),
        id("kommune", slug),
        tekst(p.key),
        tekst(p.tittel),
        tekst(p.sporsmal),
      ]),
      ["kommune_id", "key"],
    ) +
      (prosesser.length > 0
        ? `delete from prosess_steg where prosess_id in (${prosesser
            .map(({ slug, p }) => id("prosess", `${slug}|${p.key}`))
            .join(", ")});\n`
        : "") +
      insert(
        "prosess_steg",
        ["id", "key", "prosess_id", "nr", "org_id", "myndighet", "hva", ...BELEGG_KOLONNER],
        prosesser.flatMap(({ slug, p }) =>
          p.steg.map((st, i) => {
            const key = nokkel.prosessSteg(slug, p.key, i + 1);
            return [
              id("prosess_steg", key),
              tekst(key),
              id("prosess", `${slug}|${p.key}`),
              lit(i + 1),
              id("organisasjon", st.org),
              tekst(st.myndighet),
              tekst(st.hva),
              ...belegg(st.belegg),
            ];
          }),
        ),
      ),
  );

  del(
    "Hull",
    upsert(
      "hull",
      ["id", "key", "org_id", "hva", "hvorfor", "personer"],
      sortertPaa(s.hull).map(([key, h]) => [
        id("hull", key),
        tekst(key),
        id("organisasjon", h.gjelder),
        tekst(h.hva),
        tekst(h.hvorfor),
        idListe("person", h.personer),
      ]),
      ["key"],
    ),
  );

  return [
    "-- Generert av scripts/seed-build.ts fra src/data/*.json. Ikke rediger for hånd:",
    "-- endre datasettet og kjør `npm run seed:build`.",
    "--",
    `-- Kommuner: ${s.kommuner.map((k) => `${k.meta.kommune} (${k.meta.kommunenr})`).join(", ")}.`,
    "-- Deterministisk (id-er fra naturlige nøkler) og idempotent (upsert på key).",
    "-- Kjøres som postgres eller service_role, ikke med den offentlige nøkkelen.",
    "",
    "begin;",
    "",
    deler.join("\n"),
    "commit;",
    "",
  ].join("\n");
}

function main(): void {
  const sql = byggSeed(samle(lesDatasett()));
  mkdirSync(dirname(SEEDFIL), { recursive: true });
  writeFileSync(SEEDFIL, sql);
  const linjer = sql.split("\n").length;
  console.log(`Skrev ${SEEDFIL.replace(ROT + "/", "")} (${linjer} linjer).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
