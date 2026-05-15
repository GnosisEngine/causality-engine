// src/math/dempster-shafer/combination.ts

import { round } from '@/common/decimal/index.js'

/**
 * Computes the Dempster conflict measure K for two belief functions.
 * K = m1(T)·m2(F) + m1(F)·m2(T)
 * K near 1 indicates near-total contradiction between the two sources.
 * K = 1 means total conflict — combination is undefined without a resolution policy.
 */
export function computeK(b1: BeliefFunction, b2: BeliefFunction): number {
  return round(b1.mTrue * b2.mFalse + b1.mFalse * b2.mTrue)
}

/**
 * Applies Dempster's rule of combination to two belief functions over the same proposition.
 * Requires K < 1 (non-total conflict). Throws if K === 1.
 *
 * The combined mass assignment is:
 *   m({true})  = (m1T·m2T + m1T·m2Ω + m1Ω·m2T) / (1 - K)
 *   m({false}) = (m1F·m2F + m1F·m2Ω + m1Ω·m2F) / (1 - K)
 *   m({Ω})     = (m1Ω·m2Ω) / (1 - K)
 */
export function dempsterCombine(
  b1: BeliefFunction,
  b2: BeliefFunction,
  updatedAt: number,
): BeliefFunction {
  const K = computeK(b1, b2)
  if (K >= 1) throw new RangeError(`Total conflict (K=${K}) — use a ConflictPolicy before combining`)

  const norm = 1 - K
  const mTrue  = round((b1.mTrue  * b2.mTrue  + b1.mTrue    * b2.mUnknown + b1.mUnknown * b2.mTrue)  / norm)
  const mFalse = round((b1.mFalse * b2.mFalse + b1.mFalse   * b2.mUnknown + b1.mUnknown * b2.mFalse) / norm)
  const mUnknown = round(Math.max(0, 1 - mTrue - mFalse))

  return { proposition: b1.proposition, mTrue, mFalse, mUnknown, bel: mTrue, pl: round(mTrue + mUnknown), updatedAt }
}
