// src/runtime/index.ts
// Phase 5 + Phase 8 exports. Full wiring (Phase 10) added later.

export { createWorkerPool } from './worker-pool.js'
export type { TaskPriority, PoolTaskDescriptor, WorkerPool } from './worker-pool.js'
export { createTickClock } from './tick.js'
export type { TickClock, TickConfig } from './tick.js'
export { createHotZone } from './hot-zone.js'
export type { HotZone } from './hot-zone.js'
