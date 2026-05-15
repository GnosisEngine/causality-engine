// src/math/embeddings/hnsw.ts

import { nearest as naiveScan, buildQueryVector } from './ops.js'

/**
 * Approximate Nearest-Neighbour index abstraction.
 *
 * Production target: hnswlib-node (https://github.com/yoshoku/hnswlib-node)
 * Requires native compilation — run `npm install hnswlib-node` in an environment
 * with node-gyp and build tools available, then replace NaiveANNIndex with
 * an HNSWLibIndex implementation that wraps HierarchicalNSW from that package.
 *
 * Development / fallback: NaiveANNIndex delegates to the O(n × d) scan in ops.ts.
 * Correct at all scales; replace with hnswlib-node when entity counts exceed ~10,000.
 *
 * The query/ router selects the index via createANNIndex(). Swap the implementation
 * there without touching any other system.
 */

/**
 * Naive ANNIndex implementation backed by the ops.ts linear scan.
 * Always correct; suitable for development and graphs with < 10,000 entities.
 */
class NaiveANNIndex implements ANNIndex {
  private readonly store = new Map<string, Float32Array>()
  readonly ready = true

  upsert(entityId: string, embedding: Float32Array): void {
    this.store.set(entityId, embedding)
  }

  remove(entityId: string): void {
    this.store.delete(entityId)
  }

  query(queryEmbedding: Float32Array, k: number): string[] {
    const ids = [...this.store.keys()]
    const embeddings = ids.map(id => this.store.get(id)!)
    const results = naiveScan(queryEmbedding, embeddings, k)
    return results.map(r => ids[r.index])
  }
}

/**
 * Creates an ANNIndex for a graph instance.
 * Returns NaiveANNIndex in all environments until hnswlib-node is available.
 * Swap this factory to return HNSWLibIndex once native compilation is confirmed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createANNIndex(_dim: number): ANNIndex {
  return new NaiveANNIndex()
}

/**
 * Convenience wrapper: builds the query vector and runs a nearest-neighbour query
 * against the provided index in a single call.
 */
export function queryIndex(
  index: ANNIndex,
  source: Float32Array,
  relation: Float32Array,
  k: number,
): string[] {
  const query = buildQueryVector(source, relation)
  return index.query(query, k)
}
