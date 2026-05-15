// src/math/embeddings/transE.ts

import { round, clamp } from '@/common/decimal/index.js'

const DEFAULT_LEARNING_RATE = 0.01

/**
 * Applies the TransE update rule to the source, relation, and target embeddings.
 * Mutates all three arrays in place.
 *
 * The update pushes the target embedding toward (source + relation) proportional
 * to the edge weight and learning rate. This encodes the TransE invariant:
 *   h + r ≈ t  for a true triple (h, r, t)
 *
 * All updated values are rounded and clamped to [-1, 1] to prevent drift.
 *
 * @param source       Embedding of the source entity. Mutated in place.
 * @param relation     Embedding of the verb type. Mutated in place.
 * @param target       Embedding of the target entity. Mutated in place.
 * @param weight       Edge weight in [0, 1]. Scales the update magnitude.
 * @param learningRate Step size. Default: 0.01.
 */
export function updateEmbedding(
  source: Float32Array,
  relation: Float32Array,
  target: Float32Array,
  weight: number,
  learningRate = DEFAULT_LEARNING_RATE,
): void {
  const dim = source.length
  if (relation.length !== dim || target.length !== dim) {
    throw new RangeError('Embedding dimension mismatch in updateEmbedding()')
  }

  const scale = weight * learningRate

  for (let i = 0; i < dim; i++) {
    const error = source[i] + relation[i] - target[i]
    const delta = round(scale * error)
    target[i]   = clamp(round(target[i]   + delta),      -1, 1)
    source[i]   = clamp(round(source[i]   - delta * 0.5), -1, 1)
    relation[i] = clamp(round(relation[i] - delta * 0.5), -1, 1)
  }
}

/**
 * Computes the L2 norm of a Float32Array embedding.
 */
export function norm(v: Float32Array): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  return Math.sqrt(sum)
}

/**
 * Normalises a Float32Array embedding to unit length in place.
 * No-op if the norm is zero.
 */
export function normalise(v: Float32Array): void {
  const n = norm(v)
  if (n === 0) return
  for (let i = 0; i < v.length; i++) v[i] = round(v[i] / n)
}
