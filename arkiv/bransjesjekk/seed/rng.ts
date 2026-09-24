/** Deterministisk PRNG (mulberry32). Samme frø gir samme seed hver kjøring. */
export interface Rng {
  next(): number;
  range(lo: number, hi: number): number;
  jitter(pct: number): number;
  pick<T>(arr: T[]): T;
  chance(p: number): boolean;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Uniformt tall i [lo, hi). */
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    /** Multiplikativ støy rundt 1, f.eks. jitter(0.06) -> 0.94..1.06 */
    jitter: (pct: number) => 1 + (next() * 2 - 1) * pct,
    pick: <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)]!,
    /** true med sannsynlighet p */
    chance: (p: number) => next() < p,
  };
}
