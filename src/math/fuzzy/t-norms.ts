// src/math/fuzzy/t-norms.ts

import { clamp } from '@/common/decimal/index.js'

/**
 * Minimum t-norm. Chain strength equals the weakest link.
 * Use for authority delegation chains, where the chain is only as strong as its weakest member.
 */
export const minimum: TNormFn = (a, b) => clamp(Math.min(a, b))

/**
 * Product t-norm. Strength erodes multiplicatively with each hop.
 * Use for trust and political influence chains.
 */
export const product: TNormFn = (a, b) => clamp(a * b)

/**
 * Łukasiewicz t-norm. Aggressive decay with a hard zero floor.
 * Use for fear, debt, and coercive relationship chains.
 */
export const lukasiewicz: TNormFn = (a, b) => clamp(Math.max(0, a + b - 1))

/**
 * Drastic t-norm. Returns min(a,b) only when one of the inputs is 1.0; otherwise 0.
 * Use for strict obligations requiring one perfect link (e.g. direct kinship, treaty enforcement).
 */
export const drastic: TNormFn = (a, b) => {
  if (a === 1) return clamp(b)
  if (b === 1) return clamp(a)
  return 0
}

const TNORM_MAP: Record<TNormId, TNormFn> = {
  minimum,
  product,
  lukasiewicz,
  drastic,
}

/**
 * Returns the TNormFn for a registered TNormId.
 * Throws if the id is not registered.
 */
export function getTNorm(id: TNormId): TNormFn {
  const fn = TNORM_MAP[id]
  if (!fn) throw new RangeError(`Unknown TNormId: "${id}"`)
  return fn
}
