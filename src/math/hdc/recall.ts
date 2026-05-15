// src/math/hdc/recall.ts

/**
 * Queries an HDC bundle for the presence of a relationship triple.
 * Returns cosine similarity in [0, 1] between the bundle and the query vector.
 *
 * For binary ±1 vectors of dimension d:
 *   cosine(A, B) = dotProduct(A, B) / d
 *
 * Interpretation:
 *   > 0.5  — likely recall: the experience is present in the bundle
 *   ~ 0.5  — uncertain: noise or interference from many other experiences
 *   < 0.5  — likely absent
 *
 * Recall fidelity degrades as more experiences accumulate in the bundle.
 * This degradation is correct and intentional — it models cognitive capacity limits.
 */
export function recall(bundle: HDCBundle, query: HDCVector): number {
  if (bundle.length !== query.length) throw new RangeError('HDC dimension mismatch in recall()')
  const dim = bundle.length
  let dot = 0
  for (let i = 0; i < dim; i++) dot += bundle[i] * query[i]
  return (dot / dim + 1) / 2
}
