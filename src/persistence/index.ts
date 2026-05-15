// src/persistence/index.ts

export { createEventLog, eventLogPath } from './event-log.js'
export type { EventLog, FlushStrategy, EventLogOptions } from './event-log.js'

export {
  saveCheckpoint, loadLatestCheckpoint,
  restoreCheckpoint, listCheckpoints,
} from './checkpoint.js'
export type { CheckpointData, SerializedEntity, SerializedEdge } from './checkpoint.js'

export { replayLog } from './replay.js'
export type { ReplayResult } from './replay.js'
