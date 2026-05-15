// src/math/policy/types.d.ts

/**
 * A convergent policy function governing weight decay in transitive inference rules.
 * All registered PolicyFns must satisfy: lim(hop → ∞) apply(w₀, hop) = 0 for all w₀ ∈ (0, 1].
 */
interface PolicyFn {
  /** Unique identifier, e.g. 'geometric(0.5)', 'harmonic', 'cutoff(3)'. */
  id: PolicyFnId
  /** Returns the decayed weight at the given hop count. Must converge to 0. */
  apply: (weight: number, hop: number) => number
  /** Weight at or below this value is treated as zero (inference halts). */
  epsilon: number
  /**
   * Called at registration time. Must return true for the policy to be accepted.
   * Should verify that the mathematical convergence guarantee holds.
   */
  verify: () => boolean
}
