// src/math/dempster-shafer/belief.ts

import { round, clamp } from '@/common/decimal/index.js'

const MASS_TOLERANCE = 0.0001

/**
 * Creates a new BeliefFunction. Validates that masses sum to 1.0 within tolerance.
 * All three mass values are clamped to [0, 1] and rounded before use.
 */
export function createBelief(
  proposition: string,
  mTrue: number,
  mFalse: number,
  mUnknown: number,
  updatedAt = 0,
): BeliefFunction {
  const t = clamp(mTrue)
  const f = clamp(mFalse)
  const u = clamp(mUnknown)
  const sum = round(t + f + u)

  if (Math.abs(sum - 1.0) > MASS_TOLERANCE) {
    throw new RangeError(
      `BeliefFunction masses must sum to 1.0, got ${sum} (mTrue=${t}, mFalse=${f}, mUnknown=${u})`
    )
  }

  return { proposition, mTrue: t, mFalse: f, mUnknown: u, bel: t, pl: round(t + u), updatedAt }
}

/**
 * Creates a BeliefFunction representing total ignorance — no evidence either way.
 */
export function unknownBelief(proposition: string, updatedAt = 0): BeliefFunction {
  return createBelief(proposition, 0, 0, 1, updatedAt)
}

/**
 * Discounts a BeliefFunction by a fidelity factor in [0, 1].
 * Fidelity 1.0 = no change. Fidelity 0.0 = total ignorance.
 * Used when belief crosses a graph boundary with a transmissionFidelity < 1.
 * Mass is redistributed: mTrue *= fidelity, mFalse *= fidelity, mUnknown gets the remainder.
 */
export function discountBelief(belief: BeliefFunction, fidelity: number): BeliefFunction {
  const f = clamp(fidelity)
  const mTrue = round(belief.mTrue * f)
  const mFalse = round(belief.mFalse * f)
  const mUnknown = round(1 - mTrue - mFalse)
  return createBelief(belief.proposition, mTrue, mFalse, mUnknown, belief.updatedAt)
}
