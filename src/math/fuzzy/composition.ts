// src/math/fuzzy/composition.ts

import { getTNorm } from './t-norms.js'

/**
 * Composes an ordered sequence of fuzzy edge weights along a path using the specified t-norm.
 * Terminates early if the accumulated weight drops below epsilon — paths that weak
 * are treated as non-existent for query purposes.
 *
 * Returns 0 if weights is empty or if any weight is exactly 0.
 */
export function composePath(
  weights: number[],
  tNormId: TNormId,
  epsilon = 0.001,
): number {
  if (weights.length === 0) return 0

  const tNorm = getTNorm(tNormId)
  let accumulated = weights[0]

  for (let i = 1; i < weights.length; i++) {
    accumulated = tNorm(accumulated, weights[i])
    if (accumulated <= epsilon) return 0
  }

  return accumulated
}
