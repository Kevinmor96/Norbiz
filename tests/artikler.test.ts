import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { actAsAnon, endAct, sharedDb } from './helpers/db.js';

/**
 * Artikkeltabellen fra migrasjon 0032. Skrives kun av generate-artikkel med
 * service-rollen; her testes lesesiden — at kladd aldri lekker ut, og at anon
 * ikke kan skrive.
 */
describe('artikler', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await sharedDb();
    await db.exec(`
      insert into articles
        (slug, tittel, ingress, brodtekst, seo_beskrivelse, status,
         referanser, kilder, model, prompt_version)
      values
        ('publisert-artikkel', 'T', 'I', 'B', 'S', 'publisert',
         '[{"kilde":"serie"}]', '[{"navn":"SSB"}]', 'test', 'v1'),
        ('kladd-artikkel', 'T', 'I', 'B', 'S', 'kladd',
         '[{"kilde":"serie"}]', '[{"navn":"SSB"}]', 'test', 'v1')`);
  });

  it('viser anon bare publiserte artikler', async () => {
    await actAsAnon(db);
    try {
      const r = await db.query<{ slug: string }>(`select slug from articles`);
      expect(r.rows.map((x) => x.slug)).toEqual(['publisert-artikkel']);
    } finally {
      await endAct(db);
    }
  });

  it('lar ikke anon skrive artikler', async () => {
    await actAsAnon(db);
    try {
      await expect(
        db.query(`insert into articles
          (slug, tittel, ingress, brodtekst, seo_beskrivelse, referanser, kilder, model, prompt_version)
          values ('inntrenger', 'T', 'I', 'B', 'S', '[{}]', '[{}]', 'x', 'v1')`),
      ).rejects.toThrow();
    } finally {
      await endAct(db);
    }
  });

  it('avviser artikler uten referanser eller kilder', async () => {
    await expect(
      db.query(`insert into articles
        (slug, tittel, ingress, brodtekst, seo_beskrivelse, referanser, kilder, model, prompt_version)
        values ('uten-referanser', 'T', 'I', 'B', 'S', '[]', '[{"navn":"SSB"}]', 'x', 'v1')`),
    ).rejects.toThrow();
    await expect(
      db.query(`insert into articles
        (slug, tittel, ingress, brodtekst, seo_beskrivelse, referanser, kilder, model, prompt_version)
        values ('uten-kilder', 'T', 'I', 'B', 'S', '[{"kilde":"serie"}]', '[]', 'x', 'v1')`),
    ).rejects.toThrow();
  });
});
