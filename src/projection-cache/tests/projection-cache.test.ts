// src/projection-cache/tests/projection-cache.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createComponentTypeRegistry } from '../registry.js'
import { createDirtyFlagStore } from '../dirty-flags.js'
import { createProjectionCache } from '../deriver.js'
import { createGraphStore } from '@/graph-core/index.js'
import { createHotZone } from '@/runtime/hot-zone.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntity(id: string): EntityNode {
  return {
    id, graphId: 'g', type: 'npc', properties: {},
    embedding: new Float32Array(4), embeddingVer: 0,
    memoryBundle: null, logSeqNum: 1, version: 0,
  }
}

function makeEdge(id: string, src: string, tgt: string, verb = 'isAlliedWith'): VerbEdge {
  return {
    id, sourceId: src, targetId: tgt, verbType: verb,
    weight: 0.8, tNorm: null, authority: 'player', confidence: 1,
    assertedBy: null, properties: {}, expiresAt: null,
    graphId: 'g', logSeqNum: 1,
  }
}

// ─── ComponentTypeRegistry ────────────────────────────────────────────────────

describe('ComponentTypeRegistry', () => {
  it('registers and retrieves a component type', () => {
    const reg = createComponentTypeRegistry()
    reg.register({
      id: 'AttitudeScore',
      dependsOn: ['isAlliedWith', 'isHostileToward'],
      dirtyIntervalMs: 1000,
      derive: () => 0,
    })
    expect(reg.get('AttitudeScore')).not.toBeNull()
  })

  it('throws on duplicate id', () => {
    const reg = createComponentTypeRegistry()
    reg.register({ id: 'A', dependsOn: [], dirtyIntervalMs: 0, derive: () => 0 })
    expect(() => reg.register({ id: 'A', dependsOn: [], dirtyIntervalMs: 0, derive: () => 0 })).toThrow()
  })

  it('returns null for unregistered type', () => {
    expect(createComponentTypeRegistry().get('ghost')).toBeNull()
  })

  it('ids() returns all registered ids', () => {
    const reg = createComponentTypeRegistry()
    reg.register({ id: 'A', dependsOn: [], dirtyIntervalMs: 0, derive: () => 0 })
    reg.register({ id: 'B', dependsOn: [], dirtyIntervalMs: 0, derive: () => 0 })
    expect(reg.ids()).toEqual(expect.arrayContaining(['A', 'B']))
  })

  it('affectedBy returns component types whose dependsOn includes the verb', () => {
    const reg = createComponentTypeRegistry()
    reg.register({ id: 'Attitude', dependsOn: ['isAlliedWith', 'isHostileToward'], dirtyIntervalMs: 0, derive: () => 0 })
    reg.register({ id: 'Trust', dependsOn: ['isTrustedBy'], dirtyIntervalMs: 0, derive: () => 0 })

    expect(reg.affectedBy(['isAlliedWith'])).toContain('Attitude')
    expect(reg.affectedBy(['isAlliedWith'])).not.toContain('Trust')
    expect(reg.affectedBy(['isTrustedBy'])).toContain('Trust')
  })

  it('affectedBy returns no results for unrelated verb types', () => {
    const reg = createComponentTypeRegistry()
    reg.register({ id: 'A', dependsOn: ['isAlliedWith'], dirtyIntervalMs: 0, derive: () => 0 })
    expect(reg.affectedBy(['isHostileToward'])).toHaveLength(0)
  })
})

// ─── DirtyFlagStore ───────────────────────────────────────────────────────────

describe('DirtyFlagStore', () => {
  let reg: ReturnType<typeof createComponentTypeRegistry>
  let flags: ReturnType<typeof createDirtyFlagStore>

  beforeEach(() => {
    reg = createComponentTypeRegistry()
    reg.register({ id: 'Attitude', dependsOn: ['isAlliedWith'], dirtyIntervalMs: 0, derive: () => 0 })
    reg.register({ id: 'Fear', dependsOn: ['isFearfulOf'], dirtyIntervalMs: 0, derive: () => 0 })
    flags = createDirtyFlagStore(reg)
  })

  it('starts with no dirty flags', () => {
    expect(flags.isDirty('e1', 'Attitude')).toBe(false)
  })

  it('notifyEdgeChange marks source and target dirty for affected components', () => {
    flags.notifyEdgeChange('isAlliedWith', 'e1', 'e2')
    expect(flags.isDirty('e1', 'Attitude')).toBe(true)
    expect(flags.isDirty('e2', 'Attitude')).toBe(true)
  })

  it('does not mark unrelated components dirty', () => {
    flags.notifyEdgeChange('isAlliedWith', 'e1', 'e2')
    expect(flags.isDirty('e1', 'Fear')).toBe(false)
  })

  it('markClean clears a dirty flag', () => {
    flags.notifyEdgeChange('isAlliedWith', 'e1', 'e2')
    flags.markClean('e1', 'Attitude')
    expect(flags.isDirty('e1', 'Attitude')).toBe(false)
  })

  it('markDirty explicitly sets a flag', () => {
    flags.markDirty('e3', 'Attitude')
    expect(flags.isDirty('e3', 'Attitude')).toBe(true)
  })

  it('allDirty returns all dirty pairs', () => {
    flags.notifyEdgeChange('isAlliedWith', 'e1', 'e2')
    const all = flags.allDirty()
    expect(all.some(d => d.entityId === 'e1' && d.componentTypeId === 'Attitude')).toBe(true)
    expect(all.some(d => d.entityId === 'e2' && d.componentTypeId === 'Attitude')).toBe(true)
  })

  it('clear removes all dirty flags', () => {
    flags.notifyEdgeChange('isAlliedWith', 'e1', 'e2')
    flags.clear()
    expect(flags.allDirty()).toHaveLength(0)
  })

  it('verb type with no registered dependents marks no flags', () => {
    flags.notifyEdgeChange('unknownVerb', 'e1', 'e2')
    expect(flags.allDirty()).toHaveLength(0)
  })
})

// ─── ProjectionCache ──────────────────────────────────────────────────────────

describe('ProjectionCache', () => {
  let reg: ReturnType<typeof createComponentTypeRegistry>
  let flags: ReturnType<typeof createDirtyFlagStore>
  let cache: ReturnType<typeof createProjectionCache>
  let store: ReturnType<typeof createGraphStore>
  let deriveCallCount: number

  beforeEach(() => {
    deriveCallCount = 0
    store = createGraphStore()
    store.putEntity(makeEntity('e1'))

    reg = createComponentTypeRegistry()
    reg.register({
      id: 'Score',
      dependsOn: ['isAlliedWith'],
      dirtyIntervalMs: 0,   // always re-derive when dirty
      derive: (entityId) => {
        deriveCallCount++
        return entityId === 'e1' ? 0.75 : 0
      },
    })

    flags = createDirtyFlagStore(reg)
    cache = createProjectionCache(reg, flags)
  })

  it('returns null for unregistered component type', () => {
    expect(cache.get('e1', 'g', 'ghost', store)).toBeNull()
  })

  it('derives and caches a value on first get', () => {
    flags.markDirty('e1', 'Score')
    const value = cache.get<number>('e1', 'g', 'Score', store)
    expect(value).toBe(0.75)
    expect(deriveCallCount).toBe(1)
  })

  it('returns cached value on second get when clean', () => {
    flags.markDirty('e1', 'Score')
    cache.get('e1', 'g', 'Score', store)
    cache.get('e1', 'g', 'Score', store)
    expect(deriveCallCount).toBe(1)
  })

  it('re-derives when dirty again after being clean', () => {
    flags.markDirty('e1', 'Score')
    cache.get('e1', 'g', 'Score', store)
    flags.markDirty('e1', 'Score')
    cache.get('e1', 'g', 'Score', store)
    expect(deriveCallCount).toBe(2)
  })

  it('respects dirtyIntervalMs — does not re-derive before interval elapses', () => {
    reg.register({
      id: 'SlowScore',
      dependsOn: ['isAlliedWith'],
      dirtyIntervalMs: 60_000,   // 1 minute
      derive: () => { deriveCallCount++; return 1 },
    })
    flags.markDirty('e1', 'SlowScore')
    cache.get('e1', 'g', 'SlowScore', store)  // derives (first time)
    flags.markDirty('e1', 'SlowScore')
    cache.get('e1', 'g', 'SlowScore', store)  // should NOT re-derive yet
    expect(deriveCallCount).toBe(1)
  })

  it('invalidate forces re-derivation regardless of interval', () => {
    reg.register({
      id: 'IntervalScore',
      dependsOn: [],
      dirtyIntervalMs: 60_000,
      derive: () => { deriveCallCount++; return 1 },
    })
    flags.markDirty('e1', 'IntervalScore')
    cache.get('e1', 'g', 'IntervalScore', store)
    cache.invalidate('e1', 'IntervalScore')
    cache.get('e1', 'g', 'IntervalScore', store)
    expect(deriveCallCount).toBe(2)
  })

  it('flush re-derives all dirty components whose interval has elapsed', () => {
    flags.markDirty('e1', 'Score')
    const count = cache.flush(store, 'g')
    expect(count).toBe(1)
    expect(deriveCallCount).toBe(1)
    // Now clean — flush again should derive nothing
    const count2 = cache.flush(store, 'g')
    expect(count2).toBe(0)
  })
})

// ─── HotZone ─────────────────────────────────────────────────────────────────

describe('HotZone', () => {
  it('starts with no tracked entities', () => {
    expect(createHotZone().trackedCount).toBe(0)
  })

  it('touch makes an entity hot', () => {
    const hz = createHotZone()
    hz.touch('e1')
    expect(hz.isHot('e1', 60_000)).toBe(true)
  })

  it('untouched entity is not hot', () => {
    expect(createHotZone().isHot('e1', 60_000)).toBe(false)
  })

  it('pinned entity is always hot regardless of age', () => {
    const hz = createHotZone()
    hz.pin('e1')
    // Even with 0ms maxAge, pinned entity is hot
    expect(hz.isHot('e1', 0)).toBe(true)
  })

  it('unpin makes entity subject to normal aging', () => {
    const hz = createHotZone()
    hz.pin('e1')
    hz.unpin('e1')
    expect(hz.isHot('e1', 0)).toBe(false)
  })

  it('evict removes cold isolated entities from store', () => {
    const hz = createHotZone()
    const store = createGraphStore()
    store.putEntity(makeEntity('cold'))
    store.putEntity(makeEntity('hot'))
    hz.pin('hot')  // pinned entities are never evicted

    const evicted = hz.evict(store, 0)

    expect(evicted).toBe(1)
    expect(store.hasEntity('cold')).toBe(false)
    expect(store.hasEntity('hot')).toBe(true)
  })

  it('evict does not remove entities with connected edges', () => {
    const hz = createHotZone()
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    store.putEntity(makeEntity('e2'))
    store.putEdge(makeEdge('edge1', 'e1', 'e2'))

    // Both are cold (never touched)
    const evicted = hz.evict(store, 0)
    // Neither should be evicted — they have edges
    expect(evicted).toBe(0)
    expect(store.hasEntity('e1')).toBe(true)
    expect(store.hasEntity('e2')).toBe(true)
  })

  it('evict does not remove pinned entities', async () => {
    const hz = createHotZone()
    const store = createGraphStore()
    store.putEntity(makeEntity('e1'))
    hz.pin('e1')

    await new Promise(r => setTimeout(r, 10))
    const evicted = hz.evict(store, 0)
    expect(evicted).toBe(0)
    expect(store.hasEntity('e1')).toBe(true)
  })

  it('trackedCount reflects number of touched entities', () => {
    const hz = createHotZone()
    hz.touch('e1')
    hz.touch('e2')
    hz.touch('e3')
    expect(hz.trackedCount).toBe(3)
  })
})
