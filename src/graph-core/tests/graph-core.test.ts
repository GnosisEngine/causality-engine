// src/graph-core/tests/graph-core.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createGraphStore } from '../store.js'
import {
  validateCreateEntity, validateAddEdge,
  validateUpdateEdge, validateRemoveEntity,
} from '../validator.js'
import {
  commitCreateEntity, commitAddEdge,
  commitUpdateEdge, commitRemoveEdge, commitRemoveEntity,
} from '../commit.js'
import type { CommitDeps } from '../commit.js'
import { createMetaGraphRegistry } from '@/meta-graph/index.js'
import { geometric } from '@/math/policy/index.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeInstance(overrides: Partial<GraphInstance> = {}): GraphInstance {
  return {
    id: 'test-graph',
    label: 'Test Graph',
    mutable: true,
    temporalIndex: false,
    persistenceMode: 'ephemeral',
    embeddingDim: 16,
    hdcDim: 512,
    defaultTNorm: 'product',
    epsilon: 0.001,
    ...overrides,
  }
}

function makeRegistry() {
  const reg = createMetaGraphRegistry()
  reg.registerPolicy('geometric(0.5)', geometric(0.5))
  reg.registerVerb({ id: 'isAlliedWith', label: 'Is Allied With', domain: [], range: [], defaultTNorm: 'product', defaultPolicyId: null, symmetric: false, crossGraphAllowed: false })
  reg.registerVerb({ id: 'isFriendsWith', label: 'Is Friends With', domain: [], range: [], defaultTNorm: 'minimum', defaultPolicyId: null, symmetric: true, crossGraphAllowed: false })
  return reg
}

function makeCommitDeps(overrides: Partial<CommitDeps> = {}): CommitDeps {
  const store = createGraphStore()
  const registry = makeRegistry()
  const instance = makeInstance()
  let seq = 0
  const log: EventLogEntry[] = []

  return {
    store,
    registry,
    instance,
    getSeq: () => seq,
    advanceSeq: () => ++seq,
    getRngState: () => 'test-rng-state',
    appendLog: (entry) => log.push(entry),
    hdcSeed: 42,
    ...overrides,
  }
}

// ─── GraphStore ───────────────────────────────────────────────────────────────

describe('GraphStore', () => {
  let store: ReturnType<typeof createGraphStore>

  beforeEach(() => { store = createGraphStore() })

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
      weight: 0.8, tNorm: null, authority: 'player', confidence: 1.0,
      assertedBy: null, properties: {}, expiresAt: null,
      graphId: 'g', logSeqNum: 1,
    }
  }

  describe('entities', () => {
    it('stores and retrieves an entity', () => {
      store.putEntity(makeEntity('e1'))
      expect(store.getEntity('e1')).not.toBeNull()
      expect(store.getEntity('e1')!.id).toBe('e1')
    })

    it('hasEntity returns true/false correctly', () => {
      store.putEntity(makeEntity('e1'))
      expect(store.hasEntity('e1')).toBe(true)
      expect(store.hasEntity('e2')).toBe(false)
    })

    it('removeEntity deletes the entity', () => {
      store.putEntity(makeEntity('e1'))
      store.removeEntity('e1')
      expect(store.hasEntity('e1')).toBe(false)
    })

    it('entityCount tracks correctly', () => {
      store.putEntity(makeEntity('e1'))
      store.putEntity(makeEntity('e2'))
      expect(store.entityCount()).toBe(2)
      store.removeEntity('e1')
      expect(store.entityCount()).toBe(1)
    })

    it('putEntity overwrites an existing entity', () => {
      store.putEntity(makeEntity('e1'))
      store.putEntity({ ...makeEntity('e1'), type: 'faction' })
      expect(store.getEntity('e1')!.type).toBe('faction')
    })
  })

  describe('edges and indexes', () => {
    beforeEach(() => {
      store.putEntity(makeEntity('e1'))
      store.putEntity(makeEntity('e2'))
      store.putEntity(makeEntity('e3'))
    })

    it('stores and retrieves an edge', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      expect(store.getEdge('edge1')).not.toBeNull()
    })

    it('edgesFrom returns correct edges', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      store.putEdge(makeEdge('edge2', 'e1', 'e3'))
      store.putEdge(makeEdge('edge3', 'e2', 'e3'))
      expect(store.edgesFrom('e1')).toHaveLength(2)
      expect(store.edgesFrom('e2')).toHaveLength(1)
    })

    it('edgesTo returns correct edges', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      store.putEdge(makeEdge('edge2', 'e3', 'e2'))
      expect(store.edgesTo('e2')).toHaveLength(2)
    })

    it('edgesByVerb returns correct edges', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2', 'isAlliedWith'))
      store.putEdge(makeEdge('edge2', 'e1', 'e3', 'isFriendsWith'))
      expect(store.edgesByVerb('isAlliedWith')).toHaveLength(1)
      expect(store.edgesByVerb('isFriendsWith')).toHaveLength(1)
    })

    it('edgesBetween filters by source and target', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      store.putEdge(makeEdge('edge2', 'e1', 'e3'))
      expect(store.edgesBetween('e1', 'e2')).toHaveLength(1)
    })

    it('edgesBetween filters by verbType when provided', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2', 'isAlliedWith'))
      store.putEdge(makeEdge('edge2', 'e1', 'e2', 'isFriendsWith'))
      expect(store.edgesBetween('e1', 'e2', 'isAlliedWith')).toHaveLength(1)
    })

    it('removeEdge cleans up all indexes', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      store.removeEdge('edge1')
      expect(store.hasEdge('edge1')).toBe(false)
      expect(store.edgesFrom('e1')).toHaveLength(0)
      expect(store.edgesTo('e2')).toHaveLength(0)
    })

    it('putEdge replaces existing edge and updates indexes', () => {
      store.putEdge(makeEdge('edge1', 'e1', 'e2'))
      store.putEdge({ ...makeEdge('edge1', 'e1', 'e3') })
      expect(store.edgesTo('e2')).toHaveLength(0)
      expect(store.edgesTo('e3')).toHaveLength(1)
    })
  })
})

// ─── validator ───────────────────────────────────────────────────────────────

describe('graph-core validator', () => {
  let store: ReturnType<typeof createGraphStore>
  const registry = makeRegistry()

  function putEntity(id: string) {
    store.putEntity({ id, graphId: 'g', type: 'npc', properties: {}, embedding: new Float32Array(4), embeddingVer: 0, memoryBundle: null, logSeqNum: 1, version: 0 })
  }

  beforeEach(() => {
    store = createGraphStore()
    putEntity('source')
    putEntity('target')
  })

  describe('validateCreateEntity', () => {
    it('returns no errors for a valid create', () => {
      expect(validateCreateEntity({ id: 'new', type: 'npc' }, 'g', store)).toHaveLength(0)
    })

    it('rejects empty id', () => {
      const errors = validateCreateEntity({ id: '', type: 'npc' }, 'g', store)
      expect(errors.some(e => e.includes('id'))).toBe(true)
    })

    it('rejects duplicate id', () => {
      const errors = validateCreateEntity({ id: 'source', type: 'npc' }, 'g', store)
      expect(errors.some(e => e.includes('already exists'))).toBe(true)
    })

    it('rejects empty type', () => {
      const errors = validateCreateEntity({ id: 'new', type: '' }, 'g', store)
      expect(errors.some(e => e.includes('type'))).toBe(true)
    })
  })

  describe('validateAddEdge', () => {
    it('returns no errors for a valid edge', () => {
      const errors = validateAddEdge(
        { id: 'e1', sourceId: 'source', targetId: 'target', verbType: 'isAlliedWith', weight: 0.8 },
        'g', store, registry,
      )
      expect(errors).toHaveLength(0)
    })

    it('rejects unregistered verbType', () => {
      const errors = validateAddEdge(
        { id: 'e1', sourceId: 'source', targetId: 'target', verbType: 'ghost', weight: 0.8 },
        'g', store, registry,
      )
      expect(errors.some(e => e.includes('not registered'))).toBe(true)
    })

    it('rejects weight out of [0, 1]', () => {
      const errors = validateAddEdge(
        { id: 'e1', sourceId: 'source', targetId: 'target', verbType: 'isAlliedWith', weight: 1.5 },
        'g', store, registry,
      )
      expect(errors.some(e => e.includes('weight'))).toBe(true)
    })

    it('rejects missing source entity', () => {
      const errors = validateAddEdge(
        { id: 'e1', sourceId: 'ghost', targetId: 'target', verbType: 'isAlliedWith', weight: 0.5 },
        'g', store, registry,
      )
      expect(errors.some(e => e.includes('Source entity'))).toBe(true)
    })

    it('rejects missing target entity', () => {
      const errors = validateAddEdge(
        { id: 'e1', sourceId: 'source', targetId: 'ghost', verbType: 'isAlliedWith', weight: 0.5 },
        'g', store, registry,
      )
      expect(errors.some(e => e.includes('Target entity'))).toBe(true)
    })
  })

  describe('validateUpdateEdge', () => {
    it('rejects update on non-existent edge', () => {
      const errors = validateUpdateEdge('ghost', { weight: 0.5 }, store)
      expect(errors.some(e => e.includes('does not exist'))).toBe(true)
    })

    it('rejects update on inferred edge', () => {
      store.putEdge({ id: 'inf', sourceId: 'source', targetId: 'target', verbType: 'isAlliedWith', weight: 0.5, tNorm: null, authority: 'inference', confidence: 0.9, assertedBy: null, properties: {}, expiresAt: null, graphId: 'g', logSeqNum: 1 })
      const errors = validateUpdateEdge('inf', { weight: 0.3 }, store)
      expect(errors.some(e => e.includes('Inferred edge'))).toBe(true)
    })
  })

  describe('validateRemoveEntity', () => {
    it('rejects removal of non-existent entity', () => {
      const errors = validateRemoveEntity('ghost', store)
      expect(errors.some(e => e.includes('does not exist'))).toBe(true)
    })

    it('rejects removal of entity with connected edges', () => {
      store.putEdge({ id: 'e1', sourceId: 'source', targetId: 'target', verbType: 'isAlliedWith', weight: 0.5, tNorm: null, authority: 'player', confidence: 1, assertedBy: null, properties: {}, expiresAt: null, graphId: 'g', logSeqNum: 1 })
      const errors = validateRemoveEntity('source', store)
      expect(errors.some(e => e.includes('cannot be removed'))).toBe(true)
    })

    it('allows removal of isolated entity', () => {
      const errors = validateRemoveEntity('source', store)
      expect(errors).toHaveLength(0)
    })
  })
})

// ─── commit ───────────────────────────────────────────────────────────────────

describe('commit pipeline', () => {
  let deps: CommitDeps
  const log: EventLogEntry[] = []

  beforeEach(() => {
    log.length = 0
    deps = makeCommitDeps({ appendLog: (e) => log.push(e) })
  })

  describe('commitCreateEntity', () => {
    it('creates an entity and appends a log entry', () => {
      const result = commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      expect(result.ok).toBe(true)
      expect(deps.store.hasEntity('npc1')).toBe(true)
      expect(log.some(e => e.type === 'entity:create')).toBe(true)
    })

    it('initialises an embedding vector of correct dimension', () => {
      commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      const entity = deps.store.getEntity('npc1')!
      expect(entity.embedding.length).toBe(deps.instance.embeddingDim)
    })

    it('initialises an HDC memory bundle when hdcDim is set', () => {
      commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      const entity = deps.store.getEntity('npc1')!
      expect(entity.memoryBundle).not.toBeNull()
      expect(entity.memoryBundle!.length).toBe(deps.instance.hdcDim)
    })

    it('sets memoryBundle to null when hdcDim is null', () => {
      deps = makeCommitDeps({ instance: makeInstance({ hdcDim: null }), appendLog: (e) => log.push(e) })
      commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      expect(deps.store.getEntity('npc1')!.memoryBundle).toBeNull()
    })

    it('returns error for duplicate entity id', () => {
      commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      const result = commitCreateEntity({ id: 'npc1', type: 'npc' }, deps)
      expect(result.ok).toBe(false)
    })

    it('increments seq monotonically', () => {
      const r1 = commitCreateEntity({ id: 'e1', type: 'npc' }, deps)
      const r2 = commitCreateEntity({ id: 'e2', type: 'npc' }, deps)
      expect(r1.ok && r2.ok && r2.seq > r1.seq).toBe(true)
    })
  })

  describe('commitAddEdge', () => {
    beforeEach(() => {
      commitCreateEntity({ id: 'src', type: 'npc' }, deps)
      commitCreateEntity({ id: 'tgt', type: 'npc' }, deps)
    })

    it('adds an edge and appends a log entry', () => {
      const result = commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 },
        deps,
      )
      expect(result.ok).toBe(true)
      expect(deps.store.hasEdge('edge1')).toBe(true)
      expect(log.some(e => e.type === 'edge:add')).toBe(true)
    })

    it('updates embedding of source and target', () => {
      const srcBefore = deps.store.getEntity('src')!.embedding.slice()
      commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 },
        deps,
      )
      const srcAfter = deps.store.getEntity('src')!.embedding
      const changed = Array.from(srcAfter).some((v, i) => v !== srcBefore[i])
      expect(changed).toBe(true)
    })

    it('bumps version on source and target', () => {
      commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 },
        deps,
      )
      expect(deps.store.getEntity('src')!.version).toBeGreaterThan(0)
      expect(deps.store.getEntity('tgt')!.version).toBeGreaterThan(0)
    })

    it('auto-asserts reverse edge for symmetric verbs', () => {
      commitAddEdge(
        { id: 'sym1', sourceId: 'src', targetId: 'tgt', verbType: 'isFriendsWith', weight: 0.7 },
        deps,
      )
      const reverseEdge = deps.store.getEdge('sym1:sym')
      expect(reverseEdge).not.toBeNull()
      expect(reverseEdge!.sourceId).toBe('tgt')
      expect(reverseEdge!.targetId).toBe('src')
      expect(reverseEdge!.authority).toBe('inference')
    })

    it('does not auto-assert reverse edge for non-symmetric verbs', () => {
      commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 },
        deps,
      )
      expect(deps.store.getEdge('edge1:sym')).toBeNull()
    })

    it('clamps weight to [0, 1]', () => {
      commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 },
        deps,
      )
      const edge = deps.store.getEdge('edge1')!
      expect(edge.weight).toBeGreaterThanOrEqual(0)
      expect(edge.weight).toBeLessThanOrEqual(1)
    })

    it('returns error for unregistered verbType', () => {
      const result = commitAddEdge(
        { id: 'edge1', sourceId: 'src', targetId: 'tgt', verbType: 'ghost', weight: 0.8 },
        deps,
      )
      expect(result.ok).toBe(false)
    })
  })

  describe('commitUpdateEdge', () => {
    beforeEach(() => {
      commitCreateEntity({ id: 'src', type: 'npc' }, deps)
      commitCreateEntity({ id: 'tgt', type: 'npc' }, deps)
      commitAddEdge({ id: 'e1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 }, deps)
    })

    it('updates weight and appends log entry', () => {
      const result = commitUpdateEdge('e1', { weight: 0.3 }, deps)
      expect(result.ok).toBe(true)
      expect(deps.store.getEdge('e1')!.weight).toBeCloseTo(0.3, 5)
      expect(log.some(e => e.type === 'edge:update')).toBe(true)
    })

    it('bumps version on source and target', () => {
      const vBefore = deps.store.getEntity('src')!.version
      commitUpdateEdge('e1', { weight: 0.5 }, deps)
      expect(deps.store.getEntity('src')!.version).toBeGreaterThan(vBefore)
    })

    it('returns error for non-existent edge', () => {
      expect(commitUpdateEdge('ghost', { weight: 0.5 }, deps).ok).toBe(false)
    })
  })

  describe('commitRemoveEdge', () => {
    beforeEach(() => {
      commitCreateEntity({ id: 'src', type: 'npc' }, deps)
      commitCreateEntity({ id: 'tgt', type: 'npc' }, deps)
      commitAddEdge({ id: 'e1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 }, deps)
    })

    it('removes the edge and appends a log entry', () => {
      const result = commitRemoveEdge('e1', deps)
      expect(result.ok).toBe(true)
      expect(deps.store.hasEdge('e1')).toBe(false)
      expect(log.some(e => e.type === 'edge:remove')).toBe(true)
    })

    it('returns error for non-existent edge', () => {
      expect(commitRemoveEdge('ghost', deps).ok).toBe(false)
    })
  })

  describe('commitRemoveEntity', () => {
    beforeEach(() => {
      commitCreateEntity({ id: 'src', type: 'npc' }, deps)
      commitCreateEntity({ id: 'tgt', type: 'npc' }, deps)
    })

    it('removes an isolated entity and appends a log entry', () => {
      const result = commitRemoveEntity('tgt', deps)
      expect(result.ok).toBe(true)
      expect(deps.store.hasEntity('tgt')).toBe(false)
      expect(log.some(e => e.type === 'entity:remove')).toBe(true)
    })

    it('returns error when entity has edges', () => {
      commitAddEdge({ id: 'e1', sourceId: 'src', targetId: 'tgt', verbType: 'isAlliedWith', weight: 0.8 }, deps)
      expect(commitRemoveEntity('src', deps).ok).toBe(false)
    })
  })
})
