// src/persistence/tests/persistence.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

import { createEventLog } from '../event-log.js'
import {
  saveCheckpoint, loadLatestCheckpoint,
  restoreCheckpoint, listCheckpoints,
} from '../checkpoint.js'
import { replayLog } from '../replay.js'
import { createGraphStore } from '@/graph-core/index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tmpDataDir(): string {
  return join(tmpdir(), 'causality-test-' + randomBytes(6).toString('hex'))
}

function makeInstance(overrides: Partial<GraphInstance> = {}): GraphInstance {
  return {
    id: 'test-graph',
    label: 'Test',
    mutable: true,
    temporalIndex: false,
    persistenceMode: 'full',
    embeddingDim: 8,
    hdcDim: 64,
    defaultTNorm: 'product',
    epsilon: 0.001,
    ...overrides,
  }
}

function makeEntry(seq: number, type: EventType = 'entity:create', payload: Record<string, unknown> = {}): EventLogEntry {
  return {
    seq,
    graphId: 'test-graph',
    type,
    payload: { id: `e${seq}`, type: 'npc', properties: {}, ...payload },
    rngState: 'rng-' + seq,
    wallMs: Date.now(),
  }
}

function makeEntity(id: string, dim = 8): EntityNode {
  const embedding = new Float32Array(dim)
  embedding[0] = 0.5; embedding[1] = -0.3
  return {
    id, graphId: 'test-graph', type: 'npc', properties: { name: id },
    embedding, embeddingVer: 1,
    memoryBundle: new Int8Array(64).fill(1),
    logSeqNum: 1, version: 0,
  }
}

function makeEdge(id: string, src: string, tgt: string): VerbEdge {
  return {
    id, sourceId: src, targetId: tgt, verbType: 'isAlliedWith',
    weight: 0.8, tNorm: null, authority: 'player', confidence: 1.0,
    assertedBy: null, properties: {}, expiresAt: null,
    graphId: 'test-graph', logSeqNum: 2,
  }
}

// ─── EventLog ────────────────────────────────────────────────────────────────

describe('EventLog', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = tmpDataDir()
    await mkdir(dataDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('appends and reads back entries', async () => {
    const log = await createEventLog('test-graph', dataDir)
    log.append(makeEntry(1))
    log.append(makeEntry(2))
    await log.flush()

    const entries: EventLogEntry[] = []
    for await (const e of log.readAll()) entries.push(e)

    expect(entries).toHaveLength(2)
    expect(entries[0].seq).toBe(1)
    expect(entries[1].seq).toBe(2)
    await log.close()
  })

  it('readFrom returns only entries at or after the given seq', async () => {
    const log = await createEventLog('test-graph', dataDir)
    log.append(makeEntry(1))
    log.append(makeEntry(2))
    log.append(makeEntry(3))
    await log.flush()

    const entries: EventLogEntry[] = []
    for await (const e of log.readFrom(2)) entries.push(e)

    expect(entries.map(e => e.seq)).toEqual([2, 3])
    await log.close()
  })

  it('total tracks appended count', async () => {
    const log = await createEventLog('test-graph', dataDir)
    expect(log.total).toBe(0)
    log.append(makeEntry(1))
    log.append(makeEntry(2))
    expect(log.total).toBe(2)
    await log.close()
  })

  it('buffered reflects unflushed entries', async () => {
    const log = await createEventLog('test-graph', dataDir, { flushStrategy: 'none' })
    log.append(makeEntry(1))
    log.append(makeEntry(2))
    expect(log.buffered).toBe(2)
    await log.flush()
    expect(log.buffered).toBe(0)
    await log.close()
  })

  it('readAll on empty log yields nothing', async () => {
    const log = await createEventLog('test-graph', dataDir)
    const entries: EventLogEntry[] = []
    for await (const e of log.readAll()) entries.push(e)
    expect(entries).toHaveLength(0)
    await log.close()
  })

  it('preserves all payload fields through serialisation round-trip', async () => {
    const log = await createEventLog('test-graph', dataDir)
    const entry = makeEntry(1, 'edge:add', {
      id: 'edge-1', sourceId: 'e1', targetId: 'e2',
      verbType: 'isAlliedWith', weight: 0.75,
    })
    log.append(entry)
    await log.flush()

    const entries: EventLogEntry[] = []
    for await (const e of log.readAll()) entries.push(e)
    expect(entries[0].payload.weight).toBe(0.75)
    expect(entries[0].payload.verbType).toBe('isAlliedWith')
    await log.close()
  })

  it('throws after close', async () => {
    const log = await createEventLog('test-graph', dataDir)
    await log.close()
    expect(() => log.append(makeEntry(1))).toThrow()
  })

  it('batched strategy flushes at batchSize', async () => {
    const log = await createEventLog('test-graph', dataDir, { flushStrategy: 'batched', batchSize: 3 })
    log.append(makeEntry(1))
    log.append(makeEntry(2))
    log.append(makeEntry(3)) // triggers auto-flush

    // Give the async flush a moment to complete
    await new Promise(r => setTimeout(r, 20))
    expect(log.buffered).toBe(0)
    await log.close()
  })
})

// ─── Checkpoint ───────────────────────────────────────────────────────────────

describe('Checkpoint', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = tmpDataDir()
    await mkdir(dataDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('saveCheckpoint and loadLatestCheckpoint round-trip store state', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    store.putEntity(makeEntity('e2'))
    store.putEdge(makeEdge('edge1', 'e1', 'e2'))

    await saveCheckpoint(store, 42, 'rng-state-abc', 'test-graph', dataDir)

    const checkpoint = await loadLatestCheckpoint('test-graph', dataDir)
    expect(checkpoint).not.toBeNull()
    expect(checkpoint!.seq).toBe(42)
    expect(checkpoint!.rngState).toBe('rng-state-abc')
    expect(checkpoint!.entities).toHaveLength(2)
    expect(checkpoint!.edges).toHaveLength(1)
  })

  it('restores embedding values accurately', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))

    await saveCheckpoint(store, 1, 'rng', 'test-graph', dataDir)
    const checkpoint = await loadLatestCheckpoint('test-graph', dataDir)

    const restored = createGraphStore()
    restoreCheckpoint(checkpoint!, restored)

    const entity = restored.getEntity('e1')!
    expect(entity.embedding[0]).toBeCloseTo(0.5, 5)
    expect(entity.embedding[1]).toBeCloseTo(-0.3, 5)
  })

  it('restores memoryBundle values', async () => {
    const store = createGraphStore()
    const entity = makeEntity('e1')
    entity.memoryBundle = new Int8Array([1, -1, 1, -1])
    store.putEntity(entity)

    await saveCheckpoint(store, 1, 'rng', 'test-graph', dataDir)
    const checkpoint = await loadLatestCheckpoint('test-graph', dataDir)

    const restored = createGraphStore()
    restoreCheckpoint(checkpoint!, restored)
    expect(Array.from(restored.getEntity('e1')!.memoryBundle!)).toEqual([1, -1, 1, -1])
  })

  it('returns null when no checkpoints exist', async () => {
    const result = await loadLatestCheckpoint('no-such-graph', dataDir)
    expect(result).toBeNull()
  })

  it('loads the most recent checkpoint when multiple exist', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))

    await saveCheckpoint(store, 100, 'rng-100', 'test-graph', dataDir)
    store.putEntity(makeEntity('e2'))
    await saveCheckpoint(store, 200, 'rng-200', 'test-graph', dataDir)

    const checkpoint = await loadLatestCheckpoint('test-graph', dataDir)
    expect(checkpoint!.seq).toBe(200)
    expect(checkpoint!.rngState).toBe('rng-200')
  })

  it('listCheckpoints returns sorted sequence numbers', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    await saveCheckpoint(store, 50, 'rng', 'test-graph', dataDir)
    await saveCheckpoint(store, 100, 'rng', 'test-graph', dataDir)

    const seqs = await listCheckpoints('test-graph', dataDir)
    expect(seqs).toEqual([50, 100])
  })

  it('throws on checksum mismatch', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    await saveCheckpoint(store, 1, 'rng', 'test-graph', dataDir)

    // Corrupt the checkpoint file
    const { join } = await import('node:path')
    const { readFile, writeFile } = await import('node:fs/promises')
    const dir = join(dataDir, 'checkpoints', 'test-graph')
    const files = (await import('node:fs/promises')).readdir(dir)
    const file = (await files)[0]
    const raw = JSON.parse(await readFile(join(dir, file), 'utf8'))
    raw.entities[0].type = 'CORRUPTED'
    await writeFile(join(dir, file), JSON.stringify(raw))

    await expect(loadLatestCheckpoint('test-graph', dataDir)).rejects.toThrow('checksum')
  })
})

// ─── Replay ───────────────────────────────────────────────────────────────────

describe('replayLog', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = tmpDataDir()
    await mkdir(dataDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('replays entity:create events into the store', async () => {
    const log = await createEventLog('test-graph', dataDir)
    log.append(makeEntry(1, 'entity:create', { id: 'e1', type: 'npc', properties: {} }))
    log.append(makeEntry(2, 'entity:create', { id: 'e2', type: 'faction', properties: {} }))
    await log.flush()

    const store = createGraphStore()
    const result = await replayLog(log, store, makeInstance())

    expect(store.hasEntity('e1')).toBe(true)
    expect(store.hasEntity('e2')).toBe(true)
    expect(result.finalSeq).toBe(2)
    expect(result.eventsReplayed).toBe(2)
    await log.close()
  })

  it('replays edge:add events', async () => {
    const log = await createEventLog('test-graph', dataDir)
    log.append(makeEntry(1, 'entity:create', { id: 'e1', type: 'npc', properties: {} }))
    log.append(makeEntry(2, 'entity:create', { id: 'e2', type: 'npc', properties: {} }))
    log.append({
      seq: 3, graphId: 'test-graph', type: 'edge:add', payload: {
        id: 'edge1', sourceId: 'e1', targetId: 'e2', verbType: 'isAlliedWith',
        weight: 0.8, tNorm: null, authority: 'player', confidence: 1,
        assertedBy: null, properties: {}, expiresAt: null, graphId: 'test-graph', logSeqNum: 3,
      }, rngState: 'r', wallMs: 0
    })
    await log.flush()

    const store = createGraphStore()
    await replayLog(log, store, makeInstance())

    expect(store.hasEdge('edge1')).toBe(true)
    expect(store.getEdge('edge1')!.weight).toBe(0.8)
    await log.close()
  })

  it('replays entity:remove events', async () => {
    const log = await createEventLog('test-graph', dataDir)
    log.append(makeEntry(1, 'entity:create', { id: 'e1', type: 'npc', properties: {} }))
    log.append(makeEntry(2, 'entity:remove', { id: 'e1' }))
    await log.flush()

    const store = createGraphStore()
    await replayLog(log, store, makeInstance())

    expect(store.hasEntity('e1')).toBe(false)
    await log.close()
  })

  it('replays from checkpoint — only applies events after checkpoint.seq', async () => {
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    await saveCheckpoint(store, 5, 'rng', 'test-graph', dataDir)
    const checkpoint = await loadLatestCheckpoint('test-graph', dataDir)

    const log = await createEventLog('test-graph', dataDir)
    // Events at seq 1-5 are covered by checkpoint — should be skipped
    log.append(makeEntry(6, 'entity:create', { id: 'e2', type: 'npc', properties: {} }))
    await log.flush()

    const replayStore = createGraphStore()
    const result = await replayLog(log, replayStore, makeInstance(), checkpoint)

    expect(replayStore.hasEntity('e1')).toBe(true)   // from checkpoint
    expect(replayStore.hasEntity('e2')).toBe(true)   // from log replay
    expect(result.eventsReplayed).toBe(1)
    expect(result.rngState).toBe('rng')
    await log.close()
  })

  it('empty log returns zero eventsReplayed', async () => {
    const log = await createEventLog('test-graph', dataDir)
    const store = createGraphStore()
    const result = await replayLog(log, store, makeInstance())
    expect(result.eventsReplayed).toBe(0)
    expect(result.finalSeq).toBe(0)
    await log.close()
  })
})
