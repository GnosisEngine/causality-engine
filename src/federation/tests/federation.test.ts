// src/federation/tests/federation.test.ts

import { describe, it, expect } from 'vitest'
import { createGraphDAG } from '../dag.js'
import { createBoundaryRegistry } from '../boundary-registry.js'
import type { BoundaryVerb } from '../boundary-registry.js'
import { qualify, parseRef, resolveRef, validateCrossGraphRef } from '../id-resolver.js'
import { createPendingQueue } from '../pending-queue.js'

// ─── GraphDAG ─────────────────────────────────────────────────────────────────

describe('GraphDAG', () => {
  it('registers graphs and validates a simple linear dependency chain', () => {
    const dag = createGraphDAG()
    dag.register('static-rules')
    dag.register('dynamic-world', ['static-rules'])
    dag.register('political', ['dynamic-world'])

    const result = dag.validate()
    expect(result.ok).toBe(true)
    expect(result.order).toBeDefined()
  })

  it('topologicalOrder puts dependencies before dependents', () => {
    const dag = createGraphDAG()
    dag.register('static-rules')
    dag.register('dynamic-world', ['static-rules'])
    dag.register('political', ['dynamic-world'])

    const order = dag.topologicalOrder()
    expect(order.indexOf('static-rules')).toBeLessThan(order.indexOf('dynamic-world'))
    expect(order.indexOf('dynamic-world')).toBeLessThan(order.indexOf('political'))
  })

  it('validates a graph with no dependencies', () => {
    const dag = createGraphDAG()
    dag.register('standalone')
    expect(dag.validate().ok).toBe(true)
  })

  it('detects a direct cycle (A depends on B, B depends on A)', () => {
    const dag = createGraphDAG()
    dag.register('A', ['B'])
    dag.register('B', ['A'])
    const result = dag.validate()
    expect(result.ok).toBe(false)
    expect(result.cycle).toBeDefined()
  })

  it('detects an indirect cycle (A → B → C → A)', () => {
    const dag = createGraphDAG()
    dag.register('A', ['C'])
    dag.register('B', ['A'])
    dag.register('C', ['B'])
    const result = dag.validate()
    expect(result.ok).toBe(false)
  })

  it('rejects a dependency on an unregistered graph', () => {
    const dag = createGraphDAG()
    dag.register('A', ['ghost'])
    const result = dag.validate()
    expect(result.ok).toBe(false)
  })

  it('throws on duplicate registration', () => {
    const dag = createGraphDAG()
    dag.register('A')
    expect(() => dag.register('A')).toThrow()
  })

  it('topologicalOrder throws when there is a cycle', () => {
    const dag = createGraphDAG()
    dag.register('A', ['B'])
    dag.register('B', ['A'])
    expect(() => dag.topologicalOrder()).toThrow()
  })

  it('has() returns true for registered graphs only', () => {
    const dag = createGraphDAG()
    dag.register('A')
    expect(dag.has('A')).toBe(true)
    expect(dag.has('B')).toBe(false)
  })
})

// ─── BoundaryRegistry ────────────────────────────────────────────────────────

describe('BoundaryRegistry', () => {
  function makeVerb(overrides: Partial<BoundaryVerb> = {}): BoundaryVerb {
    return {
      verbType: 'influencesPolicy',
      sourceGraphId: 'dynamic-world',
      targetGraphId: 'political',
      transmissionFidelity: 0.9,
      temporalOffset: 100,
      directionality: 'one-way',
      ...overrides,
    }
  }

  it('registers a verb and allows matching cross-graph edges', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb())
    expect(reg.isAllowed('influencesPolicy', 'dynamic-world', 'political')).toBe(true)
  })

  it('rejects unregistered verb types', () => {
    const reg = createBoundaryRegistry()
    expect(reg.isAllowed('ghost', 'dynamic-world', 'political')).toBe(false)
  })

  it('rejects wrong source graph', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb())
    expect(reg.isAllowed('influencesPolicy', 'static-rules', 'political')).toBe(false)
  })

  it('validate returns empty array for permitted verb', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb())
    expect(reg.validate('influencesPolicy', 'dynamic-world', 'political')).toHaveLength(0)
  })

  it('validate returns error for unpermitted verb', () => {
    const reg = createBoundaryRegistry()
    const errors = reg.validate('ghost', 'dynamic-world', 'political')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('boundary verb registry')
  })

  it('get returns the registered BoundaryVerb', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb())
    const v = reg.get('influencesPolicy', 'dynamic-world', 'political')
    expect(v).not.toBeNull()
    expect(v!.transmissionFidelity).toBe(0.9)
    expect(v!.temporalOffset).toBe(100)
  })

  it('bidirectional verb auto-registers the reverse direction', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb({ directionality: 'both' }))
    expect(reg.isAllowed('influencesPolicy', 'dynamic-world', 'political')).toBe(true)
    expect(reg.isAllowed('influencesPolicy', 'political', 'dynamic-world')).toBe(true)
  })

  it('throws on duplicate registration', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb())
    expect(() => reg.register(makeVerb())).toThrow()
  })

  it('throws when fidelity is out of [0, 1]', () => {
    const reg = createBoundaryRegistry()
    expect(() => reg.register(makeVerb({ transmissionFidelity: 1.5 }))).toThrow(RangeError)
  })

  it('throws when temporalOffset is negative', () => {
    const reg = createBoundaryRegistry()
    expect(() => reg.register(makeVerb({ temporalOffset: -1 }))).toThrow(RangeError)
  })

  it('all() returns all registered entries', () => {
    const reg = createBoundaryRegistry()
    reg.register(makeVerb({ verbType: 'A' }))
    reg.register(makeVerb({ verbType: 'B' }))
    expect(reg.all().length).toBeGreaterThanOrEqual(2)
  })
})

// ─── ID Resolver ─────────────────────────────────────────────────────────────

describe('qualify and parseRef', () => {
  it('qualify produces graphId:entityId', () => {
    expect(qualify('abc-123', 'dynamic-world')).toBe('dynamic-world:abc-123')
  })

  it('qualify throws when entity ID contains a colon', () => {
    expect(() => qualify('bad:id', 'g')).toThrow()
  })

  it('parseRef splits on the first colon', () => {
    const result = parseRef('dynamic-world:abc-123')
    expect(result.graphId).toBe('dynamic-world')
    expect(result.entityId).toBe('abc-123')
  })

  it('parseRef returns null graphId for unqualified ref', () => {
    const result = parseRef('abc-123')
    expect(result.graphId).toBeNull()
    expect(result.entityId).toBe('abc-123')
  })
})

describe('resolveRef', () => {
  function makeEntity(id: string, graphId: string): EntityNode {
    return {
      id, graphId, type: 'npc', properties: {},
      embedding: new Float32Array(4), embeddingVer: 0,
      memoryBundle: null, logSeqNum: 1, version: 0,
    }
  }

  it('resolves a qualified reference to the correct graph', () => {
    const entities: Record<string, EntityNode> = {
      'e1': makeEntity('e1', 'political'),
    }
    const lookup = (entityId: string, graphId: string) =>
      entities[entityId]?.graphId === graphId ? entities[entityId] : null

    const result = resolveRef('political:e1', 'dynamic-world', lookup)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('e1')
  })

  it('resolves an unqualified reference using context graph', () => {
    const entities: Record<string, EntityNode> = {
      'e1': makeEntity('e1', 'dynamic-world'),
    }
    const lookup = (entityId: string, graphId: string) =>
      entities[entityId]?.graphId === graphId ? entities[entityId] : null

    const result = resolveRef('e1', 'dynamic-world', lookup)
    expect(result).not.toBeNull()
    expect(result!.graphId).toBe('dynamic-world')
  })

  it('returns null for a reference to a non-existent entity', () => {
    const lookup = () => null
    expect(resolveRef('ghost', 'g', lookup)).toBeNull()
  })
})

describe('validateCrossGraphRef', () => {
  const registered = new Set(['A', 'B'])

  it('returns no errors for valid cross-graph refs', () => {
    expect(validateCrossGraphRef('A', 'B', registered)).toHaveLength(0)
  })

  it('rejects unregistered source', () => {
    const errors = validateCrossGraphRef('ghost', 'B', registered)
    expect(errors.some(e => e.includes('source'))).toBe(true)
  })

  it('rejects unregistered target', () => {
    const errors = validateCrossGraphRef('A', 'ghost', registered)
    expect(errors.some(e => e.includes('target'))).toBe(true)
  })

  it('rejects when source and target are the same graph', () => {
    const errors = validateCrossGraphRef('A', 'A', registered)
    expect(errors.some(e => e.includes('different'))).toBe(true)
  })
})

// ─── PendingQueue ─────────────────────────────────────────────────────────────

describe('PendingQueue', () => {
  function makeEdge(id: string): VerbEdge {
    return {
      id, sourceId: 'e1', targetId: 'e2', verbType: 'influencesPolicy',
      weight: 0.7, tNorm: null, authority: 'world', confidence: 0.9,
      assertedBy: null, properties: {}, expiresAt: null,
      graphId: 'dynamic-world', logSeqNum: 1,
    }
  }

  it('starts empty', () => {
    expect(createPendingQueue().size).toBe(0)
  })

  it('enqueue increases size', () => {
    const q = createPendingQueue()
    q.enqueue(makeEdge('e1'), 10, 5, 0.9)
    expect(q.size).toBe(1)
  })

  it('processTick delivers writes at or before currentTick', () => {
    const q = createPendingQueue()
    q.enqueue(makeEdge('edge1'), 10, 5, 1.0)  // deliverAt = 15
    q.enqueue(makeEdge('edge2'), 10, 10, 1.0) // deliverAt = 20

    const delivered: string[] = []
    q.processTick(15, w => delivered.push(w.edgePayload.id))

    expect(delivered).toEqual(['edge1'])
    expect(q.size).toBe(1)
  })

  it('processTick delivers in ascending deliverAt order', () => {
    const q = createPendingQueue()
    q.enqueue(makeEdge('late'),  0, 20, 1.0)
    q.enqueue(makeEdge('early'), 0, 5,  1.0)
    q.enqueue(makeEdge('mid'),   0, 10, 1.0)

    const order: string[] = []
    q.processTick(100, w => order.push(w.edgePayload.id))
    expect(order).toEqual(['early', 'mid', 'late'])
  })

  it('processTick delivers nothing when no writes are due', () => {
    const q = createPendingQueue()
    q.enqueue(makeEdge('edge1'), 0, 50, 1.0)
    const delivered: string[] = []
    q.processTick(10, w => delivered.push(w.edgePayload.id))
    expect(delivered).toHaveLength(0)
    expect(q.size).toBe(1)
  })

  it('throws on negative temporalOffset', () => {
    const q = createPendingQueue()
    expect(() => q.enqueue(makeEdge('e'), 0, -1, 1.0)).toThrow(RangeError)
  })

  it('serialize and restore preserves all pending writes', () => {
    const q1 = createPendingQueue()
    q1.enqueue(makeEdge('edge1'), 0, 10, 0.8)
    q1.enqueue(makeEdge('edge2'), 0, 20, 1.0)

    const q2 = createPendingQueue()
    q2.restore(q1.serialize())

    expect(q2.size).toBe(2)
    const delivered: string[] = []
    q2.processTick(100, w => delivered.push(w.edgePayload.id))
    expect(delivered).toEqual(['edge1', 'edge2'])
  })

  it('restore preserves sort order regardless of input order', () => {
    const q = createPendingQueue()
    q.restore([
      { edgePayload: makeEdge('late'), deliverAt: 30, fidelity: 1 },
      { edgePayload: makeEdge('early'), deliverAt: 5, fidelity: 1 },
    ])
    const order: string[] = []
    q.processTick(100, w => order.push(w.edgePayload.id))
    expect(order).toEqual(['early', 'late'])
  })

  it('fidelity is preserved through serialize/restore', () => {
    const q1 = createPendingQueue()
    q1.enqueue(makeEdge('e1'), 0, 10, 0.6)
    const q2 = createPendingQueue()
    q2.restore(q1.serialize())

    let fidelity = 0
    q2.processTick(100, w => { fidelity = w.fidelity })
    expect(fidelity).toBe(0.6)
  })
})
