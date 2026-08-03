import { createHash } from 'node:crypto';

/** Fast namespace for Bransjeindeks-seed. Vilkårlig, men må aldri endres. */
const NS = '6f9b1f2c-3a4d-5e6f-8a9b-0c1d2e3f4a5b';

/**
 * Deterministisk UUID v5 fra en naturlig nøkkel. Gjør at seed.sql kan skrive
 * eksplisitte id-er og referere dem direkte, uten oppslag under innlasting.
 */
export function uuid5(name: string): string {
  const nsBytes = Buffer.from(NS.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export const industryId = (naceCode: string): string => uuid5(`industry:${naceCode}`);
export const regionId = (code: string, validFrom: number): string => uuid5(`region:${code}:${validFrom}`);
