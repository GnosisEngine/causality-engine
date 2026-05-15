// src/math/policy/built-in.ts

/**
 * Built-in convergent policy functions for transitive inference weight decay.
 * All satisfy: lim(hop → ∞) apply(w₀, hop) = 0 for all w₀ ∈ (0, 1].
 */

const DEFAULT_EPSILON = 0.001

/**
 * Geometric decay. Weight is multiplied by discount^hop.
 * The most common choice — use when influence should erode steadily with social distance.
 * discount must be in (0, 1).
 */
export function geometric(discount: number): PolicyFn {
  return {
    id: `geometric(${discount})`,
    apply: (weight, hop) => weight * Math.pow(discount, hop + 1),
    epsilon: DEFAULT_EPSILON,
    verify: () => discount > 0 && discount < 1,
  }
}

/**
 * Harmonic decay. Weight is divided by (hop + 2), giving a 1/n fall-off.
 * Slower than geometric — use for cultural influence or inherited reputation
 * that persists across many hops but never reaches full strength.
 */
export function harmonic(): PolicyFn {
  return {
    id: 'harmonic',
    apply: (weight, hop) => weight / (hop + 2),
    epsilon: DEFAULT_EPSILON,
    verify: () => true,
  }
}

/**
 * Hard cutoff. Returns the original weight for hops below maxHops, zero thereafter.
 * Use when a designer wants an explicit hop limit without fighting the convergent model.
 * maxHops must be a positive integer.
 */
export function cutoff(maxHops: number): PolicyFn {
  return {
    id: `cutoff(${maxHops})`,
    apply: (weight, hop) => hop < maxHops ? weight : 0,
    epsilon: DEFAULT_EPSILON,
    verify: () => Number.isInteger(maxHops) && maxHops > 0,
  }
}
