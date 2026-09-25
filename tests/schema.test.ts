// Skjemaet: migrasjonene, sikkerhetsreglene for funksjoner og views,
// verdilistene og constraintene som bærer invariantene i CLAUDE.md.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ENHETER,
  HENDELSESTYPER,
  KILDETYPER,
  MYNDIGHETER,
  NIVAAER,
  NOKKELTALLTYPER,
  ORGANTYPER,
  ORGSTATUSER,
  PRESISJONER,
  REKKEVIDDER,
  RELASJONSTYPER,
  ROLLESTATUSER,
  ROLLETYPER,
  VERIFISERINGER,
} from "@/lib/data/kontrakt";
import { migrasjonsfiler, seedetDb, stoppetAv } from "./helpers/db";

let db: PGlite;

beforeAll(async () => {
  db = await seedetDb();
});

const RPCER = [
  "beslutningskjede",
  "eierskap",
  "endringer",
  "fylke_oversikt",
  "hull",
  "kommune_grader",
  "kommune_oversikt",
  "kommuner",
  "nettverk",
  "organ_profil",
  "organer_for_segment",
  "organkart",
  "region_oversikt",
  "sok",
];

/** Tabellene med belegg: hver rad er en påstand om verden. */
const PASTANDSTABELLER = [
  "organisasjon",
  "rolleinnehav",
  "relasjon",
  "nokkeltall",
  "hendelse",
  "prosess_steg",
];

describe("migrasjonene", () => {
  it("er nummerert fortløpende fra 0001 med små bokstaver i navnet", async () => {
    const filer = await migrasjonsfiler();
    expect(filer.length).toBeGreaterThan(0);
    filer.forEach((f, i) =>
      expect(f).toMatch(new RegExp(`^${String(i + 1).padStart(4, "0")}_[a-z0-9_]+\\.sql$`)),
    );
  });

  it("lar seg kjøre på en tom base (seedetDb lyktes)", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from organisasjon`);
    expect(r.rows[0]!.n).toBeGreaterThan(0);
  });

  it("bruker aldri gen_random_uuid() som standard for seedede tabeller", async () => {
    const r = await db.query<{ tabell: string }>(`
      select c.table_name as tabell from information_schema.columns c
      where c.table_schema = 'public' and c.column_default ilike '%random%'
      order by 1
    `);
    // Bare tabellene publikum skriver til, som aldri seedes.
    expect(r.rows.map((x) => x.tabell)).toEqual(["innsigelse", "venteliste"]);
  });
});

describe("sikkerhet", () => {
  it("har RLS på for hver eneste tabell i public", async () => {
    // Uten fast antall: en ny tabell uten RLS skal feile her, ikke gli forbi
    // fordi en test teller til 16.
    const r = await db.query<{ tabell: string }>(`
      select c.relname as tabell from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
      order by 1
    `);
    expect(r.rows).toEqual([]);
  });

  it("har ingen security definer-funksjon", async () => {
    const r = await db.query<{ navn: string }>(`
      select n.nspname || '.' || p.proname as navn from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'intern') and p.prosecdef
    `);
    expect(r.rows).toEqual([]);
  });

  it("setter search_path på hver funksjon", async () => {
    const r = await db.query<{ navn: string }>(`
      select n.nspname || '.' || p.proname as navn from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'intern')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    `);
    expect(r.rows).toEqual([]);
  });

  it("kjører hvert view med security_invoker", async () => {
    const r = await db.query<{ navn: string }>(`
      select n.nspname || '.' || c.relname as navn from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'intern') and c.relkind in ('v', 'm')
        and not coalesce(c.reloptions @> array['security_invoker=true'], false)
    `);
    expect(r.rows).toEqual([]);
  });

  it("eksponerer nøyaktig RPC-ene i public, og anon kan kalle hver av dem", async () => {
    const r = await db.query<{ navn: string; anon: boolean; public_: boolean }>(`
      select p.proname as navn,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             exists (
               select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE'
             ) as public_
      from pg_proc p where p.pronamespace = 'public'::regnamespace
      order by 1
    `);
    expect(r.rows.map((x) => x.navn)).toEqual(RPCER);
    expect(r.rows.filter((x) => !x.anon)).toEqual([]);
    // Ikke gitt til PUBLIC: hver rolle som kan kalle, er gitt eksplisitt.
    expect(r.rows.filter((x) => x.public_)).toEqual([]);
  });
});

describe("verdilistene", () => {
  it("er de samme, i samme rekkefølge, i basen og i kontrakt.ts", async () => {
    const r = await db.query<{ typ: string; verdier: string[] }>(`
      select t.typname as typ, array_agg(e.enumlabel order by e.enumsortorder) as verdier
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
      group by t.typname
    `);
    const i = Object.fromEntries(r.rows.map((x) => [x.typ, x.verdier]));
    expect(i["kildetype"]).toEqual([...KILDETYPER]);
    expect(i["verifisering"]).toEqual([...VERIFISERINGER]);
    expect(i["presisjon"]).toEqual([...PRESISJONER]);
    expect(i["nivaa"]).toEqual([...NIVAAER]);
    expect(i["organtype"]).toEqual([...ORGANTYPER]);
    expect(i["myndighet"]).toEqual([...MYNDIGHETER]);
    expect(i["rekkevidde"]).toEqual([...REKKEVIDDER]);
    expect(i["orgstatus"]).toEqual([...ORGSTATUSER]);
    expect(i["rolletype"]).toEqual([...ROLLETYPER]);
    expect(i["rollestatus"]).toEqual([...ROLLESTATUSER]);
    expect(i["relasjonstype"]).toEqual([...RELASJONSTYPER]);
    expect(i["nokkeltalltype"]).toEqual([...NOKKELTALLTYPER]);
    expect(i["enhet"]).toEqual([...ENHETER]);
    expect(i["hendelsestype"]).toEqual([...HENDELSESTYPER]);
  });
});

describe("påstandstabellene", () => {
  it("har belegg på hver rad: kilde, verifisering, per, merknad og hentet", async () => {
    for (const t of PASTANDSTABELLER) {
      const r = await db.query<{ column_name: string; is_nullable: string; udt_name: string }>(
        `select column_name, is_nullable, udt_name from information_schema.columns
         where table_schema = 'public' and table_name = $1`,
        [t],
      );
      const k = Object.fromEntries(r.rows.map((x) => [x.column_name, x]));
      expect(k["kilde_id"]?.is_nullable, t).toBe("NO");
      expect(k["verifisering"]?.udt_name, t).toBe("verifisering");
      expect(k["verifisering"]?.is_nullable, t).toBe("NO");
      expect(k["per"], t).toBeDefined();
      expect(k["merknad"], t).toBeDefined();
      expect(k["hentet"]?.udt_name, t).toBe("timestamptz");
    }
  });

  it("har fremmednøkkel til kilde, tidsstempelkrav for verifisert og sekundærkilde-triggeren", async () => {
    for (const t of PASTANDSTABELLER) {
      const fk = await db.query(
        `select 1 from pg_constraint c
         where c.conrelid = $1::regclass and c.contype = 'f' and c.confrelid = 'kilde'::regclass`,
        [t],
      );
      expect(fk.rows.length, t).toBe(1);
      const ck = await db.query(
        `select 1 from pg_constraint where conrelid = $1::regclass and conname = $2`,
        [t, `${t}_verifisert_har_tid`],
      );
      expect(ck.rows.length, t).toBe(1);
      const tg = await db.query(
        `select 1 from pg_trigger g join pg_proc p on p.oid = g.tgfoid
         where g.tgrelid = $1::regclass and p.proname = 'sjekk_belegg'`,
        [t],
      );
      expect(tg.rows.length, t).toBe(1);
    }
  });

  it("har en unik nøkkel og en id som er avledet av den", async () => {
    for (const t of [
      ...PASTANDSTABELLER.filter((x) => x !== "prosess_steg"),
      "kilde",
      "person",
      "hull",
    ]) {
      const r = await db.query<{ n: number }>(
        `select count(*)::int as n from ${t} where id <> intern.nokkel_id($1, key)`,
        [t],
      );
      expect(r.rows[0]!.n, t).toBe(0);
    }
  });
});

describe("constraintene", () => {
  const org = (endring: string) => `
    insert into organisasjon (id, key, navn, nivaa, organtype, status, sensitiv, beskrivelse, kilde_id, verifisering, per, hentet)
    select intern.nokkel_id('organisasjon', 'x-test'), 'x-test', 'Test', 'kommune', 'utvalg', 'aktiv', false, 'Test.',
           intern.nokkel_id('kilde', 'tromso-kommune-no'), 'oppgitt', '2026-09', null
    ${endring}`;

  it("godtar en gyldig rad (kontroll for testene under)", async () => {
    expect(await stoppetAv(db, org(""))).toBeNull();
  });

  it("avviser verifisert uten tidsstempel, og godtar det med", async () => {
    expect(
      await stoppetAv(
        db,
        `${org("")}; update organisasjon set verifisering = 'verifisert' where key = 'x-test'`,
      ),
    ).toBe("organisasjon_verifisert_har_tid");
    expect(
      await stoppetAv(
        db,
        `${org("")}; update organisasjon set verifisering = 'verifisert', hentet = now() where key = 'x-test'`,
      ),
    ).toBeNull();
  });

  it("avviser en påstand fra Purehelp som er mer enn maa_verifiseres", async () => {
    expect(
      await stoppetAv(
        db,
        `update nokkeltall set verifisering = 'oppgitt' where kilde_id = intern.nokkel_id('kilde', 'purehelp')`,
      ),
    ).toBe("nokkeltall_sekundaerkilde");
  });

  it("avviser en id som ikke er avledet av nøkkelen", async () => {
    expect(
      await stoppetAv(
        db,
        `${org("")}; update organisasjon set id = gen_random_uuid() where key = 'x-test'`,
      ),
    ).toBe("organisasjon_id_fra_key");
  });

  it("avviser en dato som ikke er ISO", async () => {
    expect(
      await stoppetAv(
        db,
        `${org("")}; update organisasjon set per = '24.09.2026' where key = 'x-test'`,
      ),
    ).toBe("organisasjon_per_check");
  });

  it("avviser parti på en rolle utenfor folkevalgte organer", async () => {
    expect(
      await stoppetAv(
        db,
        `update rolleinnehav set parti = 'Ap' where org_id = intern.nokkel_id('organisasjon', 'troms-kraft')`,
      ),
    ).toBe("rolleinnehav_parti_bare_folkevalgte");
  });

  it("avviser samme rolle for samme person i overlappende perioder", async () => {
    const key = "tromso-kommunestyre|gunnar-wilhelmsen|politisk_leder|2025";
    expect(
      await stoppetAv(
        db,
        `insert into rolleinnehav (id, key, org_id, person_id, tittel, rolletype, status, fra, kilde_id, verifisering)
         values (intern.nokkel_id('rolleinnehav', '${key}'), '${key}',
                 intern.nokkel_id('organisasjon', 'tromso-kommunestyre'), intern.nokkel_id('person', 'gunnar-wilhelmsen'),
                 'Ordfører', 'politisk_leder', 'fast', '2025', intern.nokkel_id('kilde', 'tromso-kommune-no'), 'oppgitt')`,
      ),
    ).toBe("rolleinnehav_ingen_overlapp");
  });

  it("avviser et nøkkeltall uten år", async () => {
    expect(await stoppetAv(db, `update nokkeltall set aar = null`)).toMatch(/aar.*null|null.*aar/);
  });

  it("avviser eierandel over 100 og andel på en relasjon som ikke er eierskap", async () => {
    expect(
      await stoppetAv(
        db,
        `update relasjon set andel = 101 where type = 'eier' and andel is not null`,
      ),
    ).toBe("relasjon_andel_check");
    expect(await stoppetAv(db, `update relasjon set andel = 10 where type = 'overordnet'`)).toBe(
      "relasjon_andel_bare_eier",
    );
  });

  it("avviser en hendelse med presisjon som ikke passer datoen", async () => {
    expect(
      await stoppetAv(db, `update hendelse set presisjon = 'dag' where length(dato) = 4`),
    ).toBe("hendelse_presisjon_passer");
  });

  it("avviser en hendelse eller et hull som nevner en person som ikke finnes", async () => {
    expect(
      await stoppetAv(
        db,
        `update hendelse set personer = array[intern.nokkel_id('person', 'finnes-ikke')]`,
      ),
    ).toBe("hendelse_personer_finnes");
    expect(
      await stoppetAv(
        db,
        `update hull set personer = array[intern.nokkel_id('person', 'finnes-ikke')]`,
      ),
    ).toBe("hull_personer_finnes");
  });
});
