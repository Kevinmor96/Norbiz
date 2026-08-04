import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, actAsAnon, endAct, rejects } from './helpers/db.js';

/**
 * Nyhetsbrevlista er den ene tabellen i basen som ikke er offentlig
 * informasjon. Resten er SSB- og Brreg-tall som allerede er publisert; en
 * liste over e-postadresser er ikke det. Testene her handler derfor mest om
 * hva anon IKKE kan gjøre.
 */
describe('nyhetsbrev', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });

  it('lar anon melde seg på', async () => {
    // endAct ruller tilbake, så raden kan ikke telles etterpå. At innsettingen
    // ikke kaster er hele påstanden — og anon kan ikke lese den selv, som er
    // nettopp poenget med tabellen.
    await actAsAnon(db);
    try {
      await expect(
        db.exec(`insert into newsletter_signups (epost) values ('kari@eksempel.no')`),
      ).resolves.not.toThrow();
    } finally {
      await endAct(db);
    }
  });

  it('lar aldri anon lese, endre eller slette lista', async () => {
    await actAsAnon(db);
    try {
      // Med select-rett kunne hvem som helst lastet ned abonnentlista med
      // anon-nøkkelen, som ligger i frontend-bundelen.
      await expect(db.query(`select epost from newsletter_signups`)).rejects.toThrow();
      await expect(
        db.query(`update newsletter_signups set epost = 'kapret@eksempel.no'`),
      ).rejects.toThrow();
      await expect(db.query(`delete from newsletter_signups`)).rejects.toThrow();
    } finally {
      await endAct(db);
    }
  });

  it('behandler samme adresse med ulike store bokstaver som én abonnent', async () => {
    await db.exec(`insert into newsletter_signups (epost) values ('Ola@Eksempel.NO')`);
    expect(
      await rejects(
        db,
        `insert into newsletter_signups (epost) values ('  ola@eksempel.no  ')`,
        'newsletter_signups_epost_norm_key',
      ),
    ).toBe(true);
  });

  it('avviser adresser som ikke kan være e-post', async () => {
    for (const ugyldig of ['ikke-en-epost', 'to@apenstett@no', 'mangler@domene', 'a@b.c d']) {
      expect(
        await rejects(
          db,
          `insert into newsletter_signups (epost) values ('${ugyldig}')`,
          'newsletter_epost_format',
        ),
      ).toBe(true);
    }
  });
});
