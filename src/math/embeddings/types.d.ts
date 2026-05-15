// src/math/embeddings/types.d.ts

/** A scored entity returned from a nearest-neighbour query. */
interface NearestResult {
  /** Index of the entity in the candidate array supplied to nearest(). */
  index: number
  /** TransE score in [0, 1]. Higher = stronger evidence the triple holds. */
  score: number
}

/**
 * An embedding update message queued from the main thread to the HNSW worker.
 * Carries only the entity id and its new embedding — no graph structures.
 */
interface EmbeddingUpdateMessage {
  type: 'add' | 'update' | 'remove'
  entityId: string
  /** Present for 'add' and 'update'. Absent for 'remove'. */
  embedding?: Float32Array
}

/** The abstract contract for an approximate nearest-neighbour index. */
interface ANNIndex {
  /** Adds or updates an entity's embedding in the index. */
  upsert(entityId: string, embedding: Float32Array): void
  /** Removes an entity from the index. */
  remove(entityId: string): void
  /** Returns the k nearest entity ids to the query vector. */
  query(queryEmbedding: Float32Array, k: number): string[]
  /** Returns true when the index has been loaded and is ready to serve queries. */
  readonly ready: boolean
}
