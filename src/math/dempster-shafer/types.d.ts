// src/math/dempster-shafer/types.d.ts

/**
 * A Dempster-Shafer basic probability assignment (BPA) over a two-element frame {true, false}.
 * Represents what an agent knows, suspects, and is explicitly ignorant of regarding a proposition.
 *
 * Invariant: mTrue + mFalse + mUnknown === 1.0 (within rounding tolerance)
 */
interface BeliefFunction {
  /** The proposition this belief function is about. Serialised graph pattern, e.g. '(A,isAlliedWith,B)'. */
  proposition: string
  /** Mass assigned to {true}. Direct evidence in favour. */
  mTrue: number
  /** Mass assigned to {false}. Direct evidence against. */
  mFalse: number
  /** Mass assigned to {true, false}. Explicit ignorance — not distributed to either side. */
  mUnknown: number
  /** Derived lower bound on belief: equal to mTrue. */
  bel: number
  /** Derived upper bound on plausibility: equal to mTrue + mUnknown. */
  pl: number
  /** Log sequence number of the last update to this belief. */
  updatedAt: number
}

/** Describes a conflict that could not be automatically resolved and requires external action. */
interface EscalatedConflict {
  proposition: string
  b1: BeliefFunction
  b2: BeliefFunction
  /** Dempster conflict measure K. High K (near 1) indicates near-total contradiction. */
  conflictK: number
}
