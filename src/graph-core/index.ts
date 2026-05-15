// src/graph-core/index.ts

export { createGraphStore } from './store.js'
export type { GraphStore } from './store.js'
export {
  validateCreateEntity, validateAddEdge,
  validateUpdateEdge, validateRemoveEntity,
} from './validator.js'
export {
  commitCreateEntity, commitAddEdge,
  commitUpdateEdge, commitRemoveEdge, commitRemoveEntity,
} from './commit.js'
export type { CommitDeps, CommitResult } from './commit.js'
