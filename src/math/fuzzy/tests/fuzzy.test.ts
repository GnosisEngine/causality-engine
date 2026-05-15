// src/math/fuzzy/tests/fuzzy.test.ts

import { describe, it, expect } from 'vitest'
import { minimum, product, lukasiewicz, drastic, getTNorm } from '../t-norms.js'
import { composePath } from '../composition.js'
import { resolveExclusion } from '../exclusion.js'

describe('t-norms', () => {
  describe('minimum', () => {
    it('returns the smaller value', () => {
      expect(minimum(0.7, 0.5)).toBe(0.5)
      expect(minimum(0.3, 0.9)).toBe(0.3)
    })
    it('is commutative', () => {
      expect(minimum(0.4, 0.6)).toBe(minimum(0.6, 0.4))
    })
    it('returns 1 when both inputs are 1', () => {
      expect(minimum(1, 1)).toBe(1)
    })
    it('returns 0 when either input is 0', () => {
      expect(minimum(0, 0.9)).toBe(0)
    })
  })

  describe('product', () => {
    it('multiplies the two values', () => {
      expect(product(0.7, 0.5)).toBe(0.35)
    })
    it('is commutative', () => {
      expect(product(0.4, 0.8)).toBe(product(0.8, 0.4))
    })
    it('returns 0 when either input is 0', () => {
      expect(product(0, 0.9)).toBe(0)
    })
    it('is always <= minimum t-norm', () => {
      expect(product(0.6, 0.7)).toBeLessThanOrEqual(minimum(0.6, 0.7))
    })
  })

  describe('lukasiewicz', () => {
    it('returns max(0, a+b-1)', () => {
      expect(lukasiewicz(0.7, 0.5)).toBe(0.2)
      expect(lukasiewicz(0.3, 0.5)).toBe(0)
    })
    it('never goes below 0', () => {
      expect(lukasiewicz(0.1, 0.1)).toBe(0)
    })
    it('is commutative', () => {
      expect(lukasiewicz(0.6, 0.8)).toBe(lukasiewicz(0.8, 0.6))
    })
    it('is always <= product t-norm', () => {
      expect(lukasiewicz(0.6, 0.7)).toBeLessThanOrEqual(product(0.6, 0.7))
    })
  })

  describe('drastic', () => {
    it('returns b when a is exactly 1', () => {
      expect(drastic(1, 0.5)).toBe(0.5)
    })
    it('returns a when b is exactly 1', () => {
      expect(drastic(0.5, 1)).toBe(0.5)
    })
    it('returns 0 when neither input is 1', () => {
      expect(drastic(0.8, 0.9)).toBe(0)
    })
    it('returns 1 when both are 1', () => {
      expect(drastic(1, 1)).toBe(1)
    })
  })

  describe('getTNorm', () => {
    it('returns the correct function for each registered id', () => {
      expect(getTNorm('minimum')(0.4, 0.6)).toBe(0.4)
      expect(getTNorm('product')(0.5, 0.5)).toBe(0.25)
      expect(getTNorm('lukasiewicz')(0.8, 0.5)).toBe(0.3)
      expect(getTNorm('drastic')(1, 0.7)).toBe(0.7)
    })
    it('throws for an unknown id', () => {
      expect(() => getTNorm('unknown' as TNormId)).toThrow(RangeError)
    })
  })
})

describe('composePath', () => {
  it('returns 0 for an empty weight array', () => {
    expect(composePath([], 'product')).toBe(0)
  })

  it('returns the single weight unchanged for a one-hop path', () => {
    expect(composePath([0.7], 'product')).toBe(0.7)
  })

  it('composes a multi-hop path using the specified t-norm', () => {
    expect(composePath([0.8, 0.5, 0.9], 'product')).toBeCloseTo(0.36, 5)
    expect(composePath([0.8, 0.5, 0.9], 'minimum')).toBe(0.5)
  })

  it('terminates early and returns 0 when accumulated weight crosses epsilon', () => {
    expect(composePath([0.1, 0.1, 0.1], 'product', 0.001)).toBe(0)
  })

  it('uses the provided epsilon for early termination', () => {
    // 0.5 * 0.5 = 0.25, which is above 0.1 epsilon
    expect(composePath([0.5, 0.5], 'product', 0.1)).toBeGreaterThan(0)
    // 0.05 * 0.05 = 0.0025, which is below 0.1 epsilon
    expect(composePath([0.05, 0.05], 'product', 0.1)).toBe(0)
  })
})

describe('resolveExclusion', () => {
  describe('reject policy', () => {
    it('preserves the existing weight and provides no incoming weight', () => {
      const result = resolveExclusion(0.8, 0.5, 'reject')
      expect(result.action).toBe('reject')
      expect(result.existingWeight).toBe(0.8)
      expect(result.incomingWeight).toBeUndefined()
    })
  })

  describe('overwrite policy', () => {
    it('provides the incoming weight and removes the existing edge', () => {
      const result = resolveExclusion(0.8, 0.5, 'overwrite')
      expect(result.action).toBe('overwrite')
      expect(result.incomingWeight).toBe(0.5)
      expect(result.existingWeight).toBeUndefined()
    })
  })

  describe('weaken policy', () => {
    it('reduces both weights by the incoming weight', () => {
      const result = resolveExclusion(0.8, 0.3, 'weaken')
      expect(result.action).toBe('weaken')
      expect(result.existingWeight).toBeCloseTo(0.5, 5)
      expect(result.incomingWeight).toBe(0)
    })

    it('clamps weakened weights to 0', () => {
      const result = resolveExclusion(0.2, 0.9, 'weaken')
      expect(result.existingWeight).toBe(0)
      expect(result.incomingWeight).toBeGreaterThanOrEqual(0)
    })
  })
})
