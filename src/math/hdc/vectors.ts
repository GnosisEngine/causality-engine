// src/math/hdc/vectors.ts

import { createPRNG } from '@/common/prng/index.js'

/**
 * Generates a quasi-orthogonal base vector for a given id and seed.
 * The same (id, seed, dim) triple always produces the same vector —
 * this is required for deterministic recall across sessions.
 *
 * Uses djb2 to derive a numeric hash from the id string, then seeds
 * the PRNG with (hash XOR seed) to generate the ±1 values.
 */
export function createBaseVector(id: string, seed: number, dim: number): HDCVector {
  const hash = djb2(id)
  const rng = createPRNG(hash ^ seed)
  const vec = new Int8Array(dim)
  for (let i = 0; i < dim; i++) {
    vec[i] = rng.nextFloat() < 0.5 ? -1 : 1
  }
  return vec
}

/** Creates a zero-initialised bundle accumulator for a given dimension. */
export function createEmptyBundle(dim: number): HDCBundle {
  return new Int8Array(dim)
}

function djb2(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = Math.imul(hash, 33) ^ s.charCodeAt(i)
  }
  return hash >>> 0
}
