// src/math/embeddings/index.ts

export { updateEmbedding, norm, normalise } from './transE.js'
export { score, nearest, buildQueryVector } from './ops.js'
export { createANNIndex, queryIndex } from './hnsw.js'
export { createUpdateQueue } from './update-queue.js'
export type { UpdateQueue } from './update-queue.js'
