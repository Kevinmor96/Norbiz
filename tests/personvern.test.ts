// Personvernet håndheves i basen. Testene kjører som `anon`, altså med den
// offentlige nøkkelen, og prøver å komme forbi reglene.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import type { Kommunedatasett } from "@/data/types";
import { byggSeed, lesDatasett, lesRegion } from "../scripts/seed-build";
import { samle } from "@/lib/data/samle";
import { ferskDb, rpc, som, stoppetAv } from "./helpers/db";

let db: PGlite;
const datasett = lesDatasett();
const tromso = datasett.find((d) => d.slug === "tromso")!.data as Kommunedatasett;
const NR = tromso.meta.kommunenr;

beforeAll(async () => {
  db = await ferskDb();
});

/** Kjører `fn` i en transaksjon som alltid rulles tilbake. */
async function iTransaksjon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("begin;");
  try {
    return await fn();
  } finally {
    await db.exec("rollback;");
  }
}

/**
 * Alle offentlige svar for kommunen, som én tekst. `organer` avgrenser
 * organprofilene. `sporringer` er søk som også tas med: navnene testen ser
 * etter, så et søk på personen heller ikke finner henne. `fylket` tar med
 * fylkessiden, som viser lederne i fylkets organer. Den og søket går over alle
 * kommunene og er trege, så løkkene over mange personer lar dem være.
 */
async function alleSvar(
  organer: string[] = tromso.organisasjoner.map((o) => o.key),
  sporringer: string[] = [],
  fylket = sporringer.length > 0,
): Promise<string> {
  const svar: unknown[] = [
    await rpc(db, "kommuner"),
    await rpc(db, "kommune_oversikt", [NR]),
    await rpc(db, "organkart", [NR]),
    await rpc(db, "eierskap", [NR]),
    await rpc(db, "nettverk", [NR]),
    await rpc(db, "endringer", [NR]),
    await rpc(db, "hull", [NR]),
  ];
  if (fylket) svar.push(await rpc(db, "fylke_oversikt", [tromso.meta.fylkesnr]));
  // Fra søket tas bare nøklene med: et søk på et navn finner også navnebrødre
  // og lengre navn som inneholder det, og de er ikke personen som er sperret.
  for (const q of sporringer) {
    const s = await rpc<{ roller: { treff: { person: { key: string } }[] } }>(db, "sok", [q, 50]);
    svar.push(s.roller.treff.map((r) => `"${r.person.key}"`));
  }
  for (const p of tromso.prosesser) svar.push(await rpc(db, "beslutningskjede", [NR, p.key]));
  for (const s of tromso.segmenter) svar.push(await rpc(db, "organer_for_segment", [s.kode, NR]));
  for (const o of organer) svar.push(await rpc(db, "organ_profil", [o]));
  return JSON.stringify(svar);
}

/** Organene en person har med å gjøre i datasettet. */
function organerFor(personKey: string): string[] {
  return [
    ...new Set([
      ...tromso.roller.filter((r) => r.person === personKey).map((r) => r.org),
      ...tromso.hendelser
        .filter((h) => h.personer?.includes(personKey) && h.org)
        .map((h) => h.org!),
      ...tromso.hull.filter((h) => h.personer?.includes(personKey)).map((h) => h.gjelder),
    ]),
  ];
}

describe("rettigheter på tabellene", () => {
  const OFFENTLIGE = [
    "fylke",
    "hendelse",
    "hull",
    "kilde",
    "kommune",
    "kommune_org",
    "nokkeltall",
    "org_segment",
    "organisasjon",
    "prosess",
    "prosess_steg",
    "region",
    "region_kommune",
    "relasjon",
    "rolleinnehav",
    "segment",
  ];

  for (const rolle of ["anon", "authenticated"] as const) {
    it(`${rolle}: select bare på det offentlige, insert bare på venteliste og innsigelse, ellers ingenting`, async () => {
      const r = await db.query<{
        tabell: string;
        privilegium: string;
        tabellniva: boolean;
        kolonner: string[];
      }>(
        `
        select c.relname as tabell, p.privilegium,
               has_table_privilege($1, c.oid, p.privilegium) as tabellniva,
               -- Kolonnerettigheter finnes bare for disse fire.
               array(
                 select a.attname::text from pg_attribute a
                 where p.privilegium in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
                   and a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                   and has_column_privilege($1, c.oid, a.attnum, p.privilegium)
                 order by a.attnum
               ) as kolonner
        from pg_class c
        cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p (privilegium)
        where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        order by 1, 2
        `,
        [rolle],
      );
      const har = r.rows.filter((x) => x.tabellniva || x.kolonner.length > 0);
      const faktisk = har.map(
        (x) => `${x.privilegium} ${x.tabell}${x.tabellniva ? "" : ` (${x.kolonner.join(", ")})`}`,
      );
      const forventet = [
        ...OFFENTLIGE.map((t) => `SELECT ${t}`),
        "SELECT person (id, key, navn)",
        "INSERT venteliste (kommunenr, epost)",
        "INSERT innsigelse (type, person_key, org_key, tekst, epost)",
      ];
      expect(faktisk.sort()).toEqual(forventet.sort());
    });
  }

  it("anon leser id, key og navn i person, men aldri brreg_person_hash eller innsigelse_status", async () => {
    const n = await som(
      db,
      "anon",
      async () => (await db.query(`select id, key, navn from person`)).rows.length,
    );
    expect(n).toBe(new Set(datasett.flatMap((d) => d.data.personer.map((p) => p.key))).size);
    for (const kolonne of ["brreg_person_hash", "innsigelse_status", "*"]) {
      await expect(
        som(db, "anon", () => db.query(`select ${kolonne} from person`)),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("anon kan ikke endre noe", async () => {
    for (const sql of [
      `update person set navn = 'X'`,
      `delete from rolleinnehav`,
      `insert into kilde (id, key, navn, type) values (gen_random_uuid(), 'x', 'x', 'register')`,
      `update organisasjon set verifisering = 'verifisert', hentet = now()`,
      `update person set innsigelse_status = 'ingen'`,
    ]) {
      expect(await stoppetAv(db, sql, "anon"), sql).toMatch(/permission denied/);
    }
  });
});

describe("sensitive organer", () => {
  const TINGRETT = "nord-troms-og-senja-tingrett";

  /** Legger til en dommerleder og en saksbehandler i tingretten. Kjøres som postgres. */
  async function leggTilTingrettsroller(): Promise<void> {
    await db.exec(`
      insert into person (id, key, navn) values
        (intern.nokkel_id('person', 'test-dommerleder'), 'test-dommerleder', 'Testine Dommerleder'),
        (intern.nokkel_id('person', 'test-saksbehandler'), 'test-saksbehandler', 'Testolf Saksbehandler');
      insert into rolleinnehav (id, key, org_id, person_id, tittel, rolletype, status, kilde_id, verifisering) values
        (intern.nokkel_id('rolleinnehav', 't1'), 't1', intern.nokkel_id('organisasjon', '${TINGRETT}'),
         intern.nokkel_id('person', 'test-dommerleder'), 'Sorenskriver', 'dommer_leder', 'fast',
         intern.nokkel_id('kilde', 'domstol-no'), 'oppgitt'),
        (intern.nokkel_id('rolleinnehav', 't2'), 't2', intern.nokkel_id('organisasjon', '${TINGRETT}'),
         intern.nokkel_id('person', 'test-saksbehandler'), 'Saksbehandler', 'seksjonsleder', 'fast',
         intern.nokkel_id('kilde', 'domstol-no'), 'oppgitt');
    `);
  }

  it("viser bare lederrollen, både i tabellen og i hver RPC", async () => {
    await iTransaksjon(async () => {
      await leggTilTingrettsroller();
      await db.exec("set local role anon;");
      // Bare radene testen la inn: tingretten kan ha sin egen leder fra Brreg.
      const roller = await db.query<{ tittel: string }>(
        `select tittel from rolleinnehav where org_id = intern.nokkel_id('organisasjon', '${TINGRETT}') and key in ('t1', 't2')`,
      );
      expect(roller.rows.map((r) => r.tittel)).toEqual(["Sorenskriver"]);
      const alt = await alleSvar(undefined, ["Testine Dommerleder", "Testolf Saksbehandler"]);
      expect(alt).toContain("Testine Dommerleder");
      expect(alt).not.toContain("Testolf Saksbehandler");
      expect(alt).not.toContain('"test-saksbehandler"');
      // Søket tar heller ikke med lederen: ingen roller i sensitive organer.
      const sok = await rpc<{ roller: { treff: { person: { key: string } }[] } }>(db, "sok", [
        "Testine Dommerleder",
        50,
      ]);
      expect(sok.roller.treff).toEqual([]);
    });
  });

  it("viser begge for service_role, så det er RLS som skjuler, ikke at raden mangler", async () => {
    await iTransaksjon(async () => {
      await leggTilTingrettsroller();
      await db.exec("set local role service_role;");
      const r = await db.query(
        `select 1 from rolleinnehav where org_id = intern.nokkel_id('organisasjon', '${TINGRETT}') and key in ('t1', 't2')`,
      );
      expect(r.rows.length).toBe(2);
    });
  });

  it("tar en person med rolle i et sensitivt organ helt ut av nettverket", async () => {
    const foer = await som(db, "anon", () =>
      rpc<{ personer: { person: { key: string } }[] }>(db, "nettverk", [NR]),
    );
    expect(foer.personer.map((p) => p.person.key)).toContain("kjell-are-vassmyr");
    await iTransaksjon(async () => {
      await db.exec(`
        insert into rolleinnehav (id, key, org_id, person_id, tittel, rolletype, status, kilde_id, verifisering) values
          (intern.nokkel_id('rolleinnehav', 't3'), 't3', intern.nokkel_id('organisasjon', '${TINGRETT}'),
           intern.nokkel_id('person', 'kjell-are-vassmyr'), 'Sorenskriver', 'dommer_leder', 'fast',
           intern.nokkel_id('kilde', 'domstol-no'), 'oppgitt');
        set local role anon;
      `);
      const n = await rpc<{
        noder: { key: string; sensitiv: boolean }[];
        personer: { person: { key: string } }[];
      }>(db, "nettverk", [NR]);
      expect(n.personer.map((p) => p.person.key)).not.toContain("kjell-are-vassmyr");
      expect(n.noder.filter((o) => o.sensitiv)).toEqual([]);
    });
  });
});

it("regionoversikten og gradene har ingen personer, bare tall", async () => {
  const svar = JSON.stringify([
    await som(db, "anon", () => rpc(db, "region_oversikt")),
    await som(db, "anon", () => rpc(db, "kommune_grader", [NR])),
  ]);
  const nevnt = datasett
    .flatMap((d) => d.data.personer)
    .filter((p) => svar.includes(`"${p.key}"`))
    .map((p) => p.key);
  expect(nevnt).toEqual([]);
});

describe("en sperret person forsvinner", () => {
  const sperr = (key: string) =>
    db.exec(`update person set innsigelse_status = 'sperret' where key = '${key}';`);
  const navn = (key: string) => tromso.personer.find((p) => p.key === key)!.navn;

  // Tre personer som til sammen dekker rolle, avsluttet rolle, hendelse, hull,
  // nettverk, ledere i kjeden og kartet. For dem sjekkes hvert eneste svar.
  for (const key of [
    "stig-tore-johnsen",
    "kjell-are-vassmyr",
    "kristina-torbergsen",
    "gunnar-wilhelmsen",
  ]) {
    it(`${key}: fra hver RPC, også hver organprofil`, async () => {
      const foer = await som(db, "anon", () => alleSvar(undefined, [navn(key)]));
      expect(foer, "kontroll: navnet skal finnes før sperringen").toContain(navn(key));

      await iTransaksjon(async () => {
        await sperr(key);
        await db.exec("set local role anon;");
        const etter = await alleSvar(undefined, [navn(key)]);
        expect(etter).not.toContain(navn(key));
        expect(etter).not.toContain(`"${key}"`);
      });
    });
  }

  // Personene grunnlaget viser til (roller fra andre kilder enn Brreg-importen,
  // hendelser og hull), én og én. Personene som bare finnes gjennom roller
  // hentet fra Brreg, er mange og går gjennom den samme RLS-regelen på
  // rolleinnehav; de sperres samlet.
  const fraBrreg = (key: string) =>
    tromso.roller.filter((r) => r.person === key).every((r) => r.belegg.kilde === "brreg-roller") &&
    !tromso.hendelser.some((h) => h.personer?.includes(key)) &&
    !tromso.hull.some((h) => h.personer?.includes(key));

  it("hver person i grunnlaget: fra kommunesvarene og profilene til organene hun er knyttet til", async () => {
    for (const p of tromso.personer.filter((x) => !fraBrreg(x.key))) {
      await iTransaksjon(async () => {
        await sperr(p.key);
        await db.exec("set local role anon;");
        const etter = await alleSvar(organerFor(p.key));
        expect(etter.includes(p.navn), p.key).toBe(false);
        expect(etter.includes(`"${p.key}"`), p.key).toBe(false);
      });
    }
  }, 120_000);

  it("hver person fra Brreg-importen: sperret samlet, borte fra hvert svar", async () => {
    const personer = tromso.personer.filter((x) => fraBrreg(x.key));
    const organer = [...new Set(personer.flatMap((p) => organerFor(p.key)))];
    await iTransaksjon(async () => {
      for (const p of personer) await sperr(p.key);
      await db.exec("set local role anon;");
      // Søket på hver tjuende person holder testen rask; regelen er den samme.
      const etter = await alleSvar(
        organer,
        personer.filter((_, i) => i % 20 === 0).map((p) => p.navn),
      );
      expect(personer.filter((p) => etter.includes(p.navn)).map((p) => p.key)).toEqual([]);
      expect(personer.filter((p) => etter.includes(`"${p.key}"`)).map((p) => p.key)).toEqual([]);
    });
  }, 120_000);

  it("fra tabellene direkte: person, rolleinnehav, hendelse og hull", async () => {
    const key = "stig-tore-johnsen";
    const tell = () =>
      db.query<{ p: number; r: number; h: number; hu: number }>(`
        select
          (select count(*)::int from person where key = '${key}') as p,
          (select count(*)::int from rolleinnehav where person_id = intern.nokkel_id('person', '${key}')) as r,
          (select count(*)::int from hendelse where intern.nokkel_id('person', '${key}') = any (personer)) as h,
          (select count(*)::int from hull where intern.nokkel_id('person', '${key}') = any (personer)) as hu
      `);
    const foer = (await som(db, "anon", tell)).rows[0]!;
    expect(foer.p).toBe(1);
    expect(foer.r).toBeGreaterThan(0);
    expect(foer.h).toBeGreaterThan(0);
    expect(foer.hu).toBeGreaterThan(0);
    await iTransaksjon(async () => {
      await sperr(key);
      await db.exec("set local role anon;");
      expect((await tell()).rows[0]).toEqual({ p: 0, r: 0, h: 0, hu: 0 });
    });
  });

  it("og en ny seed opphever ikke sperringen", async () => {
    await iTransaksjon(async () => {
      await sperr("kjell-are-vassmyr");
      // Seed-en har sin egen begin/commit; innenfor denne transaksjonen blir
      // de en advarsel og en commit. Kjør den uten dem.
      const sql = byggSeed(samle(datasett), lesRegion())
        .replace(/^begin;$/m, "")
        .replace(/^commit;$/m, "");
      await db.exec(sql);
      const r = await db.query<{ s: string }>(
        `select innsigelse_status as s from person where key = 'kjell-are-vassmyr'`,
      );
      expect(r.rows[0]!.s).toBe("sperret");
    });
  });
});

describe("venteliste og innsigelse", () => {
  it("anon kan melde seg på ventelista, men ikke lese den", async () => {
    await iTransaksjon(async () => {
      await db.exec(
        `set local role anon; insert into venteliste (kommunenr, epost) values ('1902', 'leser@example.no');`,
      );
      await expect(db.query(`select * from venteliste`)).rejects.toThrow(/permission denied/);
    });
    await iTransaksjon(async () => {
      await db.exec(
        `set local role anon; insert into venteliste (kommunenr, epost) values ('1902', 'leser@example.no'); reset role;`,
      );
      const r = await db.query<{ n: number }>(`select count(*)::int as n from venteliste`);
      expect(r.rows[0]!.n).toBe(1);
    });
  });

  it("avviser ugyldig kommunenummer og e-post, og felt anon ikke skal sette", async () => {
    const send = (sql: string) => stoppetAv(db, sql, "anon");
    expect(await send(`insert into venteliste (kommunenr, epost) values ('190', 'a@b.no')`)).toBe(
      "venteliste_kommunenr_check",
    );
    expect(
      await send(`insert into venteliste (kommunenr, epost) values ('1902', 'ikke-epost')`),
    ).toBe("venteliste_epost_check");
    expect(
      await send(
        `insert into venteliste (kommunenr, epost, opprettet) values ('1902', 'a@b.no', now())`,
      ),
    ).toMatch(/permission denied/);
  });

  it("anon kan sende en innsigelse, men ikke sette status eller lese den tilbake", async () => {
    const gyldig = `insert into innsigelse (type, person_key, tekst, epost)
                    values ('protest', 'kjell-are-vassmyr', 'Jeg protesterer.', 'meg@example.no')`;
    expect(await stoppetAv(db, gyldig, "anon")).toBeNull();
    expect(
      await stoppetAv(
        db,
        `insert into innsigelse (type, person_key, tekst, epost, status)
         values ('protest', 'x', 'y', 'meg@example.no', 'avsluttet')`,
        "anon",
      ),
    ).toMatch(/permission denied/);
    expect(
      await stoppetAv(
        db,
        `insert into innsigelse (type, tekst, epost) values ('retting', 'y', 'meg@example.no')`,
        "anon",
      ),
    ).toBe("innsigelse_gjelder_noe");
    expect(await stoppetAv(db, `select * from innsigelse`, "anon")).toMatch(/permission denied/);
  });
});
