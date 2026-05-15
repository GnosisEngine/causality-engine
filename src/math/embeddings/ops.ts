// src/math/embeddings/ops.ts

/**
 * Geometric operations on embedding vectors for the query interface.
 *
 * score()   — TransE scoring for a (source, relation, target) triple.
 * nearest() — Naive O(n × d) nearest-neighbour scan.
 *             Used directly for small graphs and as the fallback path
 *             when the HNSW index is warming up post-restart.
 */

/**
 * Computes the TransE score for a (source, relation, target) triple.
 * Returns a value in [0, 1]: higher means stronger evidence the triple holds.
 *
 * Score = 1 / (1 + ‖h + r − t‖₂)
 * Normalised from raw L2 distance to a value in (0, 1].
 */
export function score(
  source: Float32Array,
  relation: Float32Array,
  target: Float32Array,
): number {
  const dim = source.length
  if (relation.length !== dim || target.length !== dim) {
    throw new RangeError('Embedding dimension mismatch in score()')
  }

  let distSq = 0
  for (let i = 0; i < dim; i++) {
    const diff = source[i] + relation[i] - target[i]
    distSq += diff * diff
  }

  return 1 / (1 + Math.sqrt(distSq))
}

/**
 * Returns the k candidates with the highest TransE scores against the query vector.
 * The query vector is (source.embedding + relation.embedding) pre-computed by the caller.
 *
 * O(n × d) — acceptable for graphs with fewer than ~10,000 entities.
 * Above that threshold, the query router delegates to the HNSW index.
 *
 * @param query       Pre-computed (source + relation) query vector.
 * @param candidates  Array of target embeddings to score against.
 * @param k           Number of top results to return.
 */
export function nearest(
  query: Float32Array,
  candidates: Float32Array[],
  k: number,
): NearestResult[] {
  const dim = query.length
  const scored: NearestResult[] = candidates.map((candidate, index) => {
    let distSq = 0
    for (let i = 0; i < dim; i++) {
      const diff = query[i] - candidate[i]
      distSq += diff * diff
    }
    return { index, score: 1 / (1 + Math.sqrt(distSq)) }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

/**
 * Computes the (source + relation) query vector used for nearest-neighbour searches.
 * The result is passed directly to nearest() or to the HNSW index query.
 */
export function buildQueryVector(source: Float32Array, relation: Float32Array): Float32Array {
  const dim = source.length
  if (relation.length !== dim) throw new RangeError('Embedding dimension mismatch in buildQueryVector()')
  const query = new Float32Array(dim)
  for (let i = 0; i < dim; i++) query[i] = source[i] + relation[i]
  return query
}
