// src/math/diffusion/matrix.ts

import { round } from '@/common/decimal/index.js'

/**
 * Builds a row-normalised trust matrix from a set of directed weighted edges.
 * Each row i represents the influence distribution on entity i from its neighbours.
 *
 * Entities with no incoming edges receive a self-weight of 1.0 (they influence
 * only themselves), which is equivalent to infinite stubbornness and ensures
 * the matrix is always well-defined.
 *
 * @param edges     Directed edges: sourceId influences targetId with the given weight.
 * @param entityIds Ordered list of all entity ids to include in the matrix.
 */
export function buildTrustMatrix(
  edges: Array<{ sourceId: string; targetId: string; weight: number }>,
  entityIds: string[],
): TrustMatrix {
  const n = entityIds.length
  const idxMap = new Map(entityIds.map((id, i) => [id, i]))
  const raw: Float64Array[] = Array.from({ length: n }, () => new Float64Array(n))

  for (const { sourceId, targetId, weight } of edges) {
    const i = idxMap.get(targetId)
    const j = idxMap.get(sourceId)
    if (i === undefined || j === undefined) continue
    raw[i][j] += weight
  }

  const rows: Float64Array[] = raw.map((row, i) => {
    const total = row.reduce((s, v) => s + v, 0)
    if (total === 0) {
      const selfRow = new Float64Array(n)
      selfRow[i] = 1.0
      return selfRow
    }
    return row.map(v => round(v / total)) as Float64Array
  })

  return { entityIds: [...entityIds], rows }
}
