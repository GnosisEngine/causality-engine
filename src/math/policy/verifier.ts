// src/math/policy/verifier.ts

const SIMULATION_MAX_HOPS = 10_000
const SIMULATION_START_WEIGHT = 1.0

/**
 * Verifies that a PolicyFn converges to zero by running a simulation.
 * Starting at weight 1.0, applies the policy repeatedly until the weight
 * crosses the policy's epsilon threshold or the hop limit is reached.
 *
 * Returns true if convergence is confirmed, false if the policy fails to
 * cross epsilon within SIMULATION_MAX_HOPS iterations.
 *
 * Called automatically at rule registration time. Policies that fail
 * verification are rejected and the registration transaction is rolled back.
 */
export function verifyPolicy(policy: PolicyFn): boolean {
  if (!policy.verify()) return false

  let weight = SIMULATION_START_WEIGHT
  for (let hop = 0; hop < SIMULATION_MAX_HOPS; hop++) {
    weight = policy.apply(SIMULATION_START_WEIGHT, hop)
    if (weight <= policy.epsilon) return true
  }

  return false
}
