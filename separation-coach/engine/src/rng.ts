// ---------------------------------------------------------------------------
// Deterministic randomness.
//
// The protocol REQUIRES randomised increments — the dog must not be able to
// predict the duration. But "randomised" and "unit-testable" only coexist if
// the randomness is seeded and reproducible. So we never touch Math.random.
// The engine derives a seed from the dog's own history; the same history always
// produces the same plan. Tests can also pass an explicit seed to force a
// specific branch.
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, well-distributed 32-bit seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic string hash (FNV-1a, 32-bit). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Seed drawn from the history itself. Every completed rep shifts the seed, so
 * consecutive days don't reuse the same draw, yet a given history is always
 * reproducible.
 */
export function seedFromHistory(
  parts: ReadonlyArray<string | number>,
): number {
  return hashString(parts.join('|'));
}

/** Uniform float in [min, max) from a [0,1) source. */
export function uniform(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}
