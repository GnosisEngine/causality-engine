// src/common/serialization/types.d.ts
/** A base64-encoded string representation of a typed array. */
type EncodedArray = string

/** A serialisable representation of a Map as an array of key-value pairs. */
type EncodedMap<K, V> = [K, V][]
