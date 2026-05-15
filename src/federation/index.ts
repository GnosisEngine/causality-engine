// src/federation/index.ts

export { createGraphDAG } from './dag.js'
export type { GraphDAG, DAGValidationResult } from './dag.js'

export { createBoundaryRegistry } from './boundary-registry.js'
export type { BoundaryVerb, BoundaryRegistry } from './boundary-registry.js'

export { qualify, parseRef, resolveRef, validateCrossGraphRef } from './id-resolver.js'
export type { ParsedRef, EntityLookup } from './id-resolver.js'

export { createPendingQueue } from './pending-queue.js'
export type { PendingBoundaryWrite, PendingQueue, DeliverFn } from './pending-queue.js'
