// src/math/diffusion/tests/diffusion.test.ts

import { describe, it, expect } from 'vitest'
import { buildTrustMatrix } from '../matrix.js'
import { deGroot, friedkinJohnsen } from '../degroot.js'

describe('buildTrustMatrix', () => {
  it('builds a matrix with the correct entity order', () => {
    const matrix = buildTrustMatrix([], ['a', 'b', 'c'])
    expect(matrix.entityIds).toEqual(['a', 'b', 'c'])
    expect(matrix.rows).toHaveLength(3)
  })

  it('gives a self-weight of 1 to entities with no incoming edges', () => {
    const matrix = buildTrustMatrix([], ['a', 'b'])
    expect(matrix.rows[0][0]).toBe(1)
    expect(matrix.rows[1][1]).toBe(1)
  })

  it('row-normalises incoming edge weights', () => {
    const edges = [
      { sourceId: 'b', targetId: 'a', weight: 0.3 },
      { sourceId: 'c', targetId: 'a', weight: 0.7 },
    ]
    const matrix = buildTrustMatrix(edges, ['a', 'b', 'c'])
    const row = matrix.rows[0]
    const sum = Array.from(row).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(1, 4)
  })

  it('ignores edges referencing unknown entity ids', () => {
    const edges = [{ sourceId: 'unknown', targetId: 'a', weight: 1.0 }]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])
    expect(matrix.rows[0][0]).toBe(1)
  })
})

describe('deGroot', () => {
  it('converges a two-node system with self-weight to consensus', () => {
    // Pure A↔B without self-weight oscillates; self-edges ensure aperiodicity.
    const edges = [
      { sourceId: 'a', targetId: 'b', weight: 1 },
      { sourceId: 'b', targetId: 'a', weight: 1 },
      { sourceId: 'a', targetId: 'a', weight: 1 },
      { sourceId: 'b', targetId: 'b', weight: 1 },
    ]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])
    const beliefs = new Map([['a', 1.0], ['b', 0.0]])
    const result = deGroot(beliefs, matrix)

    expect(result.get('a')).toBeCloseTo(result.get('b')!, 2)
  })

  it('leaves beliefs unchanged when all agents are fully self-referential', () => {
    const matrix = buildTrustMatrix([], ['a', 'b'])
    const beliefs = new Map([['a', 0.8], ['b', 0.3]])
    const result = deGroot(beliefs, matrix)

    expect(result.get('a')).toBeCloseTo(0.8, 4)
    expect(result.get('b')).toBeCloseTo(0.3, 4)
  })

  it('defaults missing belief entries to 0', () => {
    const matrix = buildTrustMatrix([], ['a', 'b'])
    const result = deGroot(new Map([['a', 0.5]]), matrix)
    expect(result.get('b')).toBe(0)
  })

  it('respects maxSteps and does not run indefinitely', () => {
    const edges = [
      { sourceId: 'a', targetId: 'b', weight: 1 },
      { sourceId: 'b', targetId: 'a', weight: 1 },
    ]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])
    const beliefs = new Map([['a', 1.0], ['b', 0.0]])
    const result = deGroot(beliefs, matrix, { maxSteps: 1 })
    expect(result.size).toBe(2)
  })
})

describe('friedkinJohnsen', () => {
  it('a fully stubborn agent retains its initial belief', () => {
    const edges = [{ sourceId: 'b', targetId: 'a', weight: 1 }]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])

    const beliefs = new Map([['a', 0.9], ['b', 0.1]])
    const initial = new Map([['a', 0.9], ['b', 0.1]])
    const stubbornness = new Map([['a', 1.0], ['b', 0.0]])

    const result = friedkinJohnsen(beliefs, initial, stubbornness, matrix)
    expect(result.get('a')).toBeCloseTo(0.9, 3)
  })

  it('a fully persuadable agent converges toward neighbours', () => {
    const edges = [{ sourceId: 'b', targetId: 'a', weight: 1 }]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])

    const beliefs = new Map([['a', 0.0], ['b', 1.0]])
    const initial = new Map([['a', 0.0], ['b', 1.0]])
    const stubbornness = new Map([['a', 0.0], ['b', 1.0]])

    const result = friedkinJohnsen(beliefs, initial, stubbornness, matrix)
    expect(result.get('a')).toBeGreaterThan(0.5)
  })

  it('stubbornness prevents full consensus', () => {
    const edges = [
      { sourceId: 'a', targetId: 'b', weight: 1 },
      { sourceId: 'b', targetId: 'a', weight: 1 },
    ]
    const matrix = buildTrustMatrix(edges, ['a', 'b'])
    const beliefs = new Map([['a', 1.0], ['b', 0.0]])
    const initial = new Map([['a', 1.0], ['b', 0.0]])
    const stubbornness = new Map([['a', 0.5], ['b', 0.5]])

    const result = friedkinJohnsen(beliefs, initial, stubbornness, matrix)
    expect(result.get('a')).toBeGreaterThan(result.get('b')!)
  })
})
