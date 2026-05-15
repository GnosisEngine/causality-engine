// src/math/diffusion/degroot.ts

import { round } from '@/common/decimal/index.js'

const DEFAULT_MAX_STEPS = 100
const DEFAULT_CONVERGE_DELTA = 0.001

/**
 * Runs the DeGroot influence diffusion model to convergence.
 * Each agent's belief at step t+1 is a weighted average of its neighbours' beliefs at step t.
 * Converges to a stable belief distribution determined by the graph topology.
 *
 * @param beliefs     Initial belief values per entity id. Values in [0, 1].
 * @param matrix      Row-normalised trust matrix from buildTrustMatrix().
 * @param config      Convergence configuration.
 * @returns           Converged belief values per entity id.
 */
export function deGroot(
  beliefs: Map<string, number>,
  matrix: TrustMatrix,
  config: DiffusionConfig = {},
): Map<string, number> {
  const maxSteps = config.maxSteps ?? DEFAULT_MAX_STEPS
  const convergeDelta = config.convergeDelta ?? DEFAULT_CONVERGE_DELTA
  const { entityIds, rows } = matrix
  const n = entityIds.length

  let current = entityIds.map(id => beliefs.get(id) ?? 0)

  for (let step = 0; step < maxSteps; step++) {
    const next = new Array<number>(n)
    let maxChange = 0

    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) sum += rows[i][j] * current[j]
      next[i] = round(sum)
      maxChange = Math.max(maxChange, Math.abs(next[i] - current[i]))
    }

    current = next
    if (maxChange <= convergeDelta) break
  }

  return new Map(entityIds.map((id, i) => [id, current[i]]))
}

/**
 * Friedkin-Johnsen extension of DeGroot.
 * Each agent is partially anchored to their initial belief by a stubbornness parameter λ ∈ [0, 1].
 * λ = 1.0 → fully stubborn (ignores all neighbours).
 * λ = 0.0 → fully persuadable (standard DeGroot).
 *
 * @param beliefs          Current belief values per entity id.
 * @param initialBeliefs   Anchor belief values (unchanging across iterations).
 * @param stubbornness     Stubbornness λ per entity id. Defaults to 0.5 if not provided.
 * @param matrix           Row-normalised trust matrix.
 * @param config           Convergence configuration.
 */
export function friedkinJohnsen(
  beliefs: Map<string, number>,
  initialBeliefs: Map<string, number>,
  stubbornness: Map<string, number>,
  matrix: TrustMatrix,
  config: DiffusionConfig = {},
): Map<string, number> {
  const maxSteps = config.maxSteps ?? DEFAULT_MAX_STEPS
  const convergeDelta = config.convergeDelta ?? DEFAULT_CONVERGE_DELTA
  const { entityIds, rows } = matrix
  const n = entityIds.length

  const lambda = entityIds.map(id => stubbornness.get(id) ?? 0.5)
  const anchor = entityIds.map(id => initialBeliefs.get(id) ?? 0)
  let current = entityIds.map(id => beliefs.get(id) ?? 0)

  for (let step = 0; step < maxSteps; step++) {
    const next = new Array<number>(n)
    let maxChange = 0

    for (let i = 0; i < n; i++) {
      let neighbourInfluence = 0
      for (let j = 0; j < n; j++) neighbourInfluence += rows[i][j] * current[j]
      next[i] = round(lambda[i] * anchor[i] + (1 - lambda[i]) * neighbourInfluence)
      maxChange = Math.max(maxChange, Math.abs(next[i] - current[i]))
    }

    current = next
    if (maxChange <= convergeDelta) break
  }

  return new Map(entityIds.map((id, i) => [id, current[i]]))
}
