// src/persistence/replay.ts

import {
  decodeFloat32Array,
  decodeInt8Array,
} from '@/common/serialization/index.js'
import type { GraphStore } from '@/graph-core/index.js'
import type { EventLog } from './event-log.js'
import type { CheckpointData } from './checkpoint.js'
import { restoreCheckpoint } from './checkpoint.js'

export interface ReplayResult {
  /** The log sequence number of the last event applied. */
  finalSeq: number
  /** Number of events replayed from the log (after the checkpoint). */
  eventsReplayed: number
  /** The rngState from the checkpoint, or '' if replaying from scratch. */
  rngState: string
}

/**
 * Replays an event log into a graph store.
 *
 * If a checkpoint is provided, the store is first populated from it and only
 * log entries after checkpoint.seq are replayed. Without a checkpoint, all log
 * entries are replayed from seq 0.
 *
 * Math-derived state (embeddings, HDC bundles) is restored directly from the
 * log's embedding:update and hdc:update events rather than being recomputed.
 * This makes replay fast and deterministic regardless of PRNG state.
 *
 * The store is mutated in place. The caller is responsible for providing an
 * empty (or freshly checkpointed) store.
 */
export async function replayLog(
  log: EventLog,
  store: GraphStore,
  instance: GraphInstance,
  checkpoint: CheckpointData | null = null,
): Promise<ReplayResult> {
  let finalSeq = 0
  let eventsReplayed = 0
  let rngState = ''

  if (checkpoint) {
    restoreCheckpoint(checkpoint, store)
    finalSeq = checkpoint.seq
    rngState = checkpoint.rngState
  }

  const startSeq = checkpoint ? checkpoint.seq + 1 : 0

  for await (const entry of log.readFrom(startSeq)) {
    applyEvent(entry, store, instance)
    finalSeq = entry.seq
    eventsReplayed++
  }

  return { finalSeq, eventsReplayed, rngState }
}

/** Applies a single EventLogEntry to the store. Pure dispatch — no math side effects. */
function applyEvent(entry: EventLogEntry, store: GraphStore, instance: GraphInstance): void {
  const p = entry.payload

  switch (entry.type) {
    case 'entity:create': {
      const entity: EntityNode = {
        id: p.id as string,
        graphId: entry.graphId,
        type: p.type as string,
        properties: (p.properties as PropertyBag) ?? {},
        embedding: new Float32Array(instance.embeddingDim),
        embeddingVer: 0,
        memoryBundle: instance.hdcDim !== null ? new Int8Array(instance.hdcDim).fill(1) : null,
        logSeqNum: entry.seq,
        version: 0,
      }
      store.putEntity(entity)
      break
    }

    case 'entity:remove': {
      store.removeEntity(p.id as string)
      break
    }

    case 'edge:add':
    case 'edge:infer': {
      const edge: VerbEdge = {
        id: p.id as string,
        sourceId: p.sourceId as string,
        targetId: p.targetId as string,
        verbType: p.verbType as string,
        weight: p.weight as number,
        tNorm: (p.tNorm as TNormId | null) ?? null,
        authority: p.authority as Authority,
        confidence: p.confidence as number,
        assertedBy: (p.assertedBy as string | null) ?? null,
        properties: (p.properties as PropertyBag) ?? {},
        expiresAt: (p.expiresAt as number | null) ?? null,
        graphId: entry.graphId,
        logSeqNum: entry.seq,
      }
      store.putEdge(edge)
      break
    }

    case 'edge:update': {
      const existing = store.getEdge(p.id as string)
      if (existing) {
        const delta = p.delta as Partial<VerbEdge>
        store.putEdge({ ...existing, ...delta })
      }
      break
    }

    case 'edge:remove': {
      store.removeEdge(p.id as string)
      break
    }

    case 'embedding:update': {
      const entity = store.getEntity(p.entityId as string)
      if (entity) {
        store.putEntity({
          ...entity,
          embedding: decodeFloat32Array(p.embedding as string),
          embeddingVer: entity.embeddingVer + 1,
        })
      }
      break
    }

    case 'hdc:update': {
      const entity = store.getEntity(p.entityId as string)
      if (entity) {
        store.putEntity({
          ...entity,
          memoryBundle: decodeInt8Array(p.memoryBundle as string),
        })
      }
      break
    }
  }
}
