// src/math/hdc/bundle.ts

/**
 * Binds two HDC vectors together using element-wise multiplication.
 * bind(A, B) produces a vector dissimilar to both A and B,
 * but from which either can be recovered by binding with the other.
 * Preserves the ±1 property.
 */
export function bind(v1: HDCVector, v2: HDCVector): HDCVector {
  if (v1.length !== v2.length) throw new RangeError('HDC vector dimension mismatch in bind()')
  const result = new Int8Array(v1.length)
  for (let i = 0; i < v1.length; i++) {
    result[i] = (v1[i] * v2[i]) as -1 | 1
  }
  return result
}

/**
 * Superposes an experience triple (source, verb, target) into an existing bundle.
 * The experience is bound into a single vector and added to the bundle's integer accumulator.
 * Higher-weight experiences are added multiple times, giving them stronger recall fidelity.
 *
 * The bundle is re-binarised after superposition. This is lossy by design —
 * older and lower-weight memories gradually lose retrieval fidelity as new
 * experiences are added. This is the correct behaviour for NPC cognitive limits.
 *
 * @param bundle     The current binarised bundle (±1).
 * @param experience The bound experience vector (bind(bind(src, verb), tgt)).
 * @param weight     Edge weight in [0, 1]. Determines superposition repetitions.
 * @param scale      Repetition scale factor. weight × scale = number of times added. Default: 10.
 */
export function remember(
  bundle: HDCBundle,
  experience: HDCVector,
  weight: number,
  scale = 10,
): HDCBundle {
  if (bundle.length !== experience.length) {
    throw new RangeError('HDC dimension mismatch in remember()')
  }

  const dim = bundle.length
  const repetitions = Math.max(1, Math.floor(weight * scale))
  const acc = new Int32Array(dim)

  for (let i = 0; i < dim; i++) acc[i] = bundle[i]
  for (let r = 0; r < repetitions; r++) {
    for (let i = 0; i < dim; i++) acc[i] += experience[i]
  }

  return binarize(acc)
}

/** Binarises a signed integer accumulator into a ±1 Int8Array. Ties resolve to +1. */
export function binarize(acc: Int32Array | Int16Array): HDCBundle {
  const result = new Int8Array(acc.length)
  for (let i = 0; i < acc.length; i++) {
    result[i] = acc[i] >= 0 ? 1 : -1
  }
  return result
}
