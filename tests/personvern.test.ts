// Personvernet håndheves i basen. Testene kjører som `anon`, altså med den
// offentlige nøkkelen, og prøver å komme forbi reglene.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import type { Kommunedatasett } from "@/data/types";
import { datasett } from "@/lib/data/lokal";
import { rpc, seedetDb, som, stoppetAv } from "./helpers/db";

let db: PGlite;
const tromso = datasett.find((d) => d.slug === "tromso")!.data as Kommunedatasett;
const NR = tromso.meta.kommunenr;

beforeAll(async () => {
  db = await seedetDb();
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

/** Alle offentlige svar for kommunen, som én tekst. `organer` avgrenser organprofilene. */
async function alleSvar(
  organer: string[] = tromso.organisasjoner.map((o) => o.key),
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
    expect(n).toBe(tromso.personer.length);
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
      const roller = await db.query<{ tittel: string }>(
        `select tittel from rolleinnehav where org_id = intern.nokkel_id('organisasjon', '${TINGRETT}')`,
      );
      expect(roller.rows.map((r) => r.tittel)).toEqual(["Sorenskriver"]);
      const alt = await alleSvar();
      expect(alt).toContain("Testine Dommerleder");
      expect(alt).not.toContain("Testolf Saksbehandler");
      expect(alt).not.toContain('"test-saksbehandler"');
    });
  });

  it("viser begge for service_role, så det er RLS som skjuler, ikke at raden mangler", async () => {
    await iTransaksjon(async () => {
      await leggTilTingrettsroller();
      await db.exec("set local role service_role;");
      const r = await db.query(
        `select 1 from rolleinnehav where org_id = intern.nokkel_id('organisasjon', '${TINGRETT}')`,
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
      const foer = await som(db, "anon", () => alleSvar());
      expect(foer, "kontroll: navnet skal finnes før sperringen").toContain(navn(key));

      await iTransaksjon(async () => {
        await sperr(key);
        await db.exec("set local role anon;");
        const etter = await alleSvar();
        expect(etter).not.toContain(navn(key));
        expect(etter).not.toContain(`"${key}"`);
      });
    });
  }

  it("hver person i datasettet: fra kommunesvarene og profilene til organene hun er knyttet til", async () => {
    for (const p of tromso.personer) {
      await iTransaksjon(async () => {
        await sperr(p.key);
        await db.exec("set local role anon;");
        const etter = await alleSvar(organerFor(p.key));
        expect(etter.includes(p.navn), p.key).toBe(false);
        expect(etter.includes(`"${p.key}"`), p.key).toBe(false);
      });
    }
  });

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
      const { readFile } = await import("node:fs/promises");
      const { SEED } = await import("./helpers/db");
      // Seed-en har sin egen begin/commit; innenfor denne transaksjonen blir
      // de en advarsel og en commit. Kjør den uten dem.
      const sql = (await readFile(SEED, "utf8")).replace(/^begin;$/m, "").replace(/^commit;$/m, "");
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
