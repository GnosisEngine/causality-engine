// src/math/dempster-shafer/conflict.ts

import { round, clamp } from '@/common/decimal/index.js'
import { createBelief } from './belief.js'

const AUTHORITY_RANK: Record<Authority, number> = {
  world: 0,
  inference: 1,
  player: 2,
  system: 3,
}

/**
 * retain-authority: the source with the higher Authority level wins outright.
 * Ties are broken in favour of b1. The losing belief is discarded.
 */
export function retainAuthority(
  b1: BeliefFunction,
  a1: Authority,
  b2: BeliefFunction,
  a2: Authority,
  updatedAt: number,
): BeliefFunction {
  const winner = AUTHORITY_RANK[a1] >= AUTHORITY_RANK[a2] ? b1 : b2
  return { ...winner, updatedAt }
}

/**
 * blend: produces a weighted average of the two mass assignments.
 * w1 and w2 are the relative weights for b1 and b2 respectively.
 * They are normalised internally so they do not need to sum to 1.
 */
export function blend(
  b1: BeliefFunction,
  w1: number,
  b2: BeliefFunction,
  w2: number,
  updatedAt: number,
): BeliefFunction {
  const total = w1 + w2
  if (total === 0) throw new RangeError('blend weights must not both be zero')
  const n1 = w1 / total
  const n2 = w2 / total

  const mTrue    = round(clamp(b1.mTrue    * n1 + b2.mTrue    * n2))
  const mFalse   = round(clamp(b1.mFalse   * n1 + b2.mFalse   * n2))
  const mUnknown = round(clamp(b1.mUnknown * n1 + b2.mUnknown * n2))

  return createBelief(b1.proposition, mTrue, mFalse, mUnknown, updatedAt)
}

/**
 * escalate: leaves both belief functions unchanged and records the conflict
 * as an EscalatedConflict for external resolution (GM tools, game systems).
 */
export function escalate(
  b1: BeliefFunction,
  b2: BeliefFunction,
  conflictK: number,
): EscalatedConflict {
  return { proposition: b1.proposition, b1, b2, conflictK }
}
