// src/math/embeddings/tests/embeddings.test.ts

import { describe, it, expect } from 'vitest'
import { updateEmbedding, norm, normalise } from '../transE.js'
import { score, nearest, buildQueryVector } from '../ops.js'
import { createANNIndex, queryIndex } from '../hnsw.js'
import { createUpdateQueue } from '../update-queue.js'

function makeVec(dim: number, fill = 0): Float32Array {
  return new Float32Array(dim).fill(fill)
}

function randomVec(dim: number): Float32Array {
  const v = new Float32Array(dim)
  for (let i = 0; i < dim; i++) v[i] = (Math.random() * 2 - 1)
  return v
}

describe('transE — updateEmbedding', () => {
  it('throws on dimension mismatch', () => {
    expect(() => updateEmbedding(makeVec(4), makeVec(8), makeVec(4), 1)).toThrow(RangeError)
  })

  it('reduces the TransE error (‖h + r − t‖) over time', () => {
    const h = randomVec(64)
    const r = randomVec(64)
    const t = makeVec(64, 0)

    const before = score(h, r, t)
    for (let i = 0; i < 50; i++) updateEmbedding(h, r, t, 1.0)
    const after = score(h, r, t)

    expect(after).toBeGreaterThan(before)
  })

  it('clamps updated values to [-1, 1]', () => {
    const h = new Float32Array([0.9, 0.9])
    const r = new Float32Array([0.9, 0.9])
    const t = new Float32Array([-0.9, -0.9])
    updateEmbedding(h, r, t, 1.0, 1.0)
    for (const v of [...h, ...r, ...t]) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('norm and normalise', () => {
  it('norm of a zero vector is 0', () => {
    expect(norm(makeVec(8, 0))).toBe(0)
  })

  it('norm of a unit vector is 1', () => {
    const v = new Float32Array([1, 0, 0, 0])
    expect(norm(v)).toBeCloseTo(1, 5)
  })

  it('normalise produces a unit vector', () => {
    const v = new Float32Array([3, 4])
    normalise(v)
    expect(norm(v)).toBeCloseTo(1, 4)
  })

  it('normalise is a no-op on a zero vector', () => {
    const v = makeVec(4, 0)
    normalise(v)
    expect(Array.from(v)).toEqual([0, 0, 0, 0])
  })
})

describe('score', () => {
  it('returns 1 for a perfect triple (h + r = t)', () => {
    const h = new Float32Array([0.5, 0])
    const r = new Float32Array([0.5, 0])
    const t = new Float32Array([1.0, 0])
    expect(score(h, r, t)).toBeCloseTo(1, 1)
  })

  it('returns a lower score for a poor triple', () => {
    const h = new Float32Array([0, 0])
    const r = new Float32Array([0, 0])
    const t = new Float32Array([1, 1])
    expect(score(h, r, t)).toBeLessThan(0.5)
  })

  it('throws on dimension mismatch', () => {
    expect(() => score(makeVec(4), makeVec(4), makeVec(8))).toThrow(RangeError)
  })
})

describe('nearest', () => {
  it('returns the k highest-scoring candidates', () => {
    const query = new Float32Array([1, 0])
    const candidates = [
      new Float32Array([0, 1]),
      new Float32Array([1, 0]),
      new Float32Array([-1, 0]),
    ]
    const results = nearest(query, candidates, 1)
    expect(results[0].index).toBe(1)
  })

  it('returns at most k results', () => {
    const query = new Float32Array([1, 0])
    const candidates = Array.from({ length: 10 }, () => randomVec(2))
    expect(nearest(query, candidates, 3)).toHaveLength(3)
  })

  it('results are sorted by score descending', () => {
    const query = randomVec(32)
    const candidates = Array.from({ length: 20 }, () => randomVec(32))
    const results = nearest(query, candidates, 5)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })
})

describe('ANNIndex (NaiveANNIndex)', () => {
  it('is immediately ready', () => {
    expect(createANNIndex(64).ready).toBe(true)
  })

  it('upsert and query return the inserted entity', () => {
    const index = createANNIndex(4)
    const embedding = new Float32Array([1, 0, 0, 0])
    index.upsert('entity-a', embedding)
    const results = index.query(new Float32Array([1, 0, 0, 0]), 1)
    expect(results).toContain('entity-a')
  })

  it('remove excludes the entity from query results', () => {
    const index = createANNIndex(4)
    index.upsert('entity-a', new Float32Array([1, 0, 0, 0]))
    index.remove('entity-a')
    const results = index.query(new Float32Array([1, 0, 0, 0]), 5)
    expect(results).not.toContain('entity-a')
  })
})

describe('UpdateQueue', () => {
  it('pending count increments with each enqueue', () => {
    const index = createANNIndex(4)
    const queue = createUpdateQueue(index)
    queue.enqueue({ type: 'add', entityId: 'e1', embedding: new Float32Array(4) })
    queue.enqueue({ type: 'add', entityId: 'e2', embedding: new Float32Array(4) })
    expect(queue.pending).toBe(2)
  })

  it('flush drains all messages and applies them to the index', () => {
    const index = createANNIndex(4)
    const queue = createUpdateQueue(index)
    queue.enqueue({ type: 'add', entityId: 'e1', embedding: new Float32Array([1, 0, 0, 0]) })
    queue.flush()
    expect(queue.pending).toBe(0)
    expect(index.query(new Float32Array([1, 0, 0, 0]), 1)).toContain('e1')
  })

  it('flush processes remove messages', () => {
    const index = createANNIndex(4)
    const queue = createUpdateQueue(index)
    index.upsert('e1', new Float32Array([1, 0, 0, 0]))
    queue.enqueue({ type: 'remove', entityId: 'e1' })
    queue.flush()
    expect(index.query(new Float32Array([1, 0, 0, 0]), 5)).not.toContain('e1')
  })
})

describe('queryIndex', () => {
  it('returns entity ids nearest to (source + relation)', () => {
    const DIM = 4
    const index = createANNIndex(DIM)
    const target = new Float32Array([1, 1, 0, 0])
    index.upsert('close', target)
    index.upsert('far', new Float32Array([-1, -1, 0, 0]))

    const source = new Float32Array([0.5, 0.5, 0, 0])
    const relation = new Float32Array([0.5, 0.5, 0, 0])

    const results = queryIndex(index, source, relation, 1)
    expect(results[0]).toBe('close')
  })
})
