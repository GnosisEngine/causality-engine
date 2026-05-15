// src/common/prng/tests/prng.test.ts
import { describe, it, expect } from 'vitest'
import { createPRNG } from '../index.js'

describe('createPRNG', () => {
  it('produces the same sequence from the same numeric seed', () => {
    const a = createPRNG(42)
    const b = createPRNG(42)
    for (let i = 0; i < 100; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32())
    }
  })

  it('produces the same sequence from the same string seed', () => {
    const a = createPRNG('hello')
    const b = createPRNG('hello')
    for (let i = 0; i < 100; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32())
    }
  })

  it('produces different sequences from different seeds', () => {
    const a = createPRNG(1)
    const b = createPRNG(2)
    const results = Array.from({ length: 20 }, () => [a.nextUint32(), b.nextUint32()])
    const allEqual = results.every(([x, y]) => x === y)
    expect(allEqual).toBe(false)
  })

  it('nextFloat returns values in [0, 1)', () => {
    const rng = createPRNG(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('nextInt returns values within [min, max] inclusive', () => {
    const rng = createPRNG(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('nextInt covers the full range', () => {
    const rng = createPRNG(123)
    const seen = new Set<number>()
    for (let i = 0; i < 10000; i++) seen.add(rng.nextInt(0, 4))
    expect(seen.size).toBe(5)
  })

  it('getState and setState restore sequence exactly', () => {
    const rng = createPRNG(55)
    rng.nextUint32(); rng.nextUint32(); rng.nextUint32()
    const state = rng.getState()
    const snapshot = Array.from({ length: 20 }, () => rng.nextUint32())
    rng.setState(state)
    const replayed = Array.from({ length: 20 }, () => rng.nextUint32())
    expect(replayed).toEqual(snapshot)
  })

  it('state is a non-empty string', () => {
    const rng = createPRNG(1)
    expect(typeof rng.getState()).toBe('string')
    expect(rng.getState().length).toBeGreaterThan(0)
  })
})
