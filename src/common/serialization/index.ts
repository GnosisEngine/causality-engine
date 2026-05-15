// src/common/serialization/index.ts
/**
 * Shared serialisation utilities for typed arrays, Maps, and property bags.
 *
 * Used by persistence/ for event log encoding and checkpoint serialisation,
 * and by math/embeddings and math/hdc for packing array data into log entries.
 *
 * All functions are pure and stateless. Encoding is base64 via Buffer (Node.js built-in).
 */

/** Encodes a Float32Array to a base64 string. */
export function encodeFloat32Array(arr: Float32Array): EncodedArray {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64')
}

/** Decodes a base64 string back to a Float32Array. */
export function decodeFloat32Array(encoded: EncodedArray): Float32Array {
  const buf = Buffer.from(encoded, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / Float32Array.BYTES_PER_ELEMENT)
}

/** Encodes an Int8Array to a base64 string. */
export function encodeInt8Array(arr: Int8Array): EncodedArray {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64')
}

/** Decodes a base64 string back to an Int8Array. */
export function decodeInt8Array(encoded: EncodedArray): Int8Array {
  const buf = Buffer.from(encoded, 'base64')
  return new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

/** Encodes a Map to a serialisable array of key-value pairs. */
export function encodeMap<K, V>(map: Map<K, V>): EncodedMap<K, V> {
  return [...map.entries()]
}

/** Reconstructs a Map from a previously encoded array of key-value pairs. */
export function decodeMap<K, V>(entries: EncodedMap<K, V>): Map<K, V> {
  return new Map(entries)
}

/** Encodes a PropertyBag to a plain JSON-serialisable object. */
export function encodePropertyBag(bag: PropertyBag): PropertyBag {
  return { ...bag }
}

/** Decodes a PropertyBag from a plain object (identity — validates shape in future). */
export function decodePropertyBag(raw: unknown): PropertyBag {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('Expected a plain object for PropertyBag decoding')
  }
  return raw as PropertyBag
}
