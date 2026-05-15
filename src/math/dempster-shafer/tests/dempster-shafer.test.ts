// src/math/dempster-shafer/tests/dempster-shafer.test.ts

import { describe, it, expect } from 'vitest'
import { createBelief, unknownBelief, discountBelief } from '../belief.js'
import { computeK, dempsterCombine } from '../combination.js'
import { retainAuthority, blend, escalate } from '../conflict.js'

describe('createBelief', () => {
  it('creates a valid belief function with correct bel and pl', () => {
    const b = createBelief('(A,isAlliedWith,B)', 0.6, 0.1, 0.3)
    expect(b.mTrue).toBe(0.6)
    expect(b.mFalse).toBe(0.1)
    expect(b.mUnknown).toBe(0.3)
    expect(b.bel).toBe(0.6)
    expect(b.pl).toBeCloseTo(0.9, 5)
  })

  it('throws when masses do not sum to 1', () => {
    expect(() => createBelief('P', 0.5, 0.5, 0.5)).toThrow(RangeError)
  })

  it('stores the proposition string', () => {
    const b = createBelief('(X,kills,Y)', 1, 0, 0)
    expect(b.proposition).toBe('(X,kills,Y)')
  })
})

describe('unknownBelief', () => {
  it('creates a belief with full ignorance mass', () => {
    const b = unknownBelief('P')
    expect(b.mTrue).toBe(0)
    expect(b.mFalse).toBe(0)
    expect(b.mUnknown).toBe(1)
    expect(b.bel).toBe(0)
    expect(b.pl).toBe(1)
  })
})

describe('discountBelief', () => {
  it('scales mTrue and mFalse by fidelity and redistributes remainder to mUnknown', () => {
    const b = createBelief('P', 0.8, 0.2, 0)
    const discounted = discountBelief(b, 0.5)
    expect(discounted.mTrue).toBeCloseTo(0.4, 5)
    expect(discounted.mFalse).toBeCloseTo(0.1, 5)
    expect(discounted.mUnknown).toBeCloseTo(0.5, 5)
  })

  it('fidelity 1.0 leaves the belief unchanged', () => {
    const b = createBelief('P', 0.7, 0.2, 0.1)
    const d = discountBelief(b, 1.0)
    expect(d.mTrue).toBeCloseTo(b.mTrue, 5)
    expect(d.mFalse).toBeCloseTo(b.mFalse, 5)
  })

  it('fidelity 0.0 produces total ignorance', () => {
    const b = createBelief('P', 0.7, 0.2, 0.1)
    const d = discountBelief(b, 0)
    expect(d.mTrue).toBe(0)
    expect(d.mFalse).toBe(0)
    expect(d.mUnknown).toBe(1)
  })
})

describe('computeK', () => {
  it('returns 0 when beliefs do not conflict', () => {
    const b1 = createBelief('P', 1, 0, 0)
    const b2 = createBelief('P', 1, 0, 0)
    expect(computeK(b1, b2)).toBe(0)
  })

  it('returns a positive value for conflicting beliefs', () => {
    const b1 = createBelief('P', 0.8, 0.1, 0.1)
    const b2 = createBelief('P', 0.1, 0.8, 0.1)
    expect(computeK(b1, b2)).toBeGreaterThan(0)
  })

  it('returns 1 for total conflict', () => {
    const b1 = createBelief('P', 1, 0, 0)
    const b2 = createBelief('P', 0, 1, 0)
    expect(computeK(b1, b2)).toBe(1)
  })
})

describe('dempsterCombine', () => {
  it('combines two supporting beliefs into a stronger belief', () => {
    const b1 = createBelief('P', 0.5, 0, 0.5)
    const b2 = createBelief('P', 0.5, 0, 0.5)
    const combined = dempsterCombine(b1, b2, 1)
    expect(combined.mTrue).toBeGreaterThan(0.5)
  })

  it('throws on total conflict (K=1)', () => {
    const b1 = createBelief('P', 1, 0, 0)
    const b2 = createBelief('P', 0, 1, 0)
    expect(() => dempsterCombine(b1, b2, 1)).toThrow(RangeError)
  })

  it('preserves the proposition from b1', () => {
    const b1 = createBelief('(A,trusts,B)', 0.6, 0.1, 0.3)
    const b2 = createBelief('(A,trusts,B)', 0.5, 0.1, 0.4)
    expect(dempsterCombine(b1, b2, 1).proposition).toBe('(A,trusts,B)')
  })

  it('combined masses sum to 1', () => {
    const b1 = createBelief('P', 0.6, 0.1, 0.3)
    const b2 = createBelief('P', 0.3, 0.2, 0.5)
    const c = dempsterCombine(b1, b2, 1)
    expect(c.mTrue + c.mFalse + c.mUnknown).toBeCloseTo(1, 4)
  })
})

describe('retainAuthority', () => {
  it('returns b1 when a1 has higher authority', () => {
    const b1 = createBelief('P', 0.9, 0, 0.1)
    const b2 = createBelief('P', 0.1, 0.8, 0.1)
    const result = retainAuthority(b1, 'system', b2, 'world', 1)
    expect(result.mTrue).toBe(b1.mTrue)
  })

  it('returns b2 when a2 has higher authority', () => {
    const b1 = createBelief('P', 0.9, 0, 0.1)
    const b2 = createBelief('P', 0.1, 0.8, 0.1)
    const result = retainAuthority(b1, 'world', b2, 'system', 1)
    expect(result.mFalse).toBe(b2.mFalse)
  })
})

describe('blend', () => {
  it('produces a weighted average of the two mass assignments', () => {
    const b1 = createBelief('P', 1, 0, 0)
    const b2 = createBelief('P', 0, 0, 1)
    const result = blend(b1, 0.5, b2, 0.5, 1)
    expect(result.mTrue).toBeCloseTo(0.5, 5)
    expect(result.mUnknown).toBeCloseTo(0.5, 5)
  })

  it('throws when both weights are zero', () => {
    const b = createBelief('P', 1, 0, 0)
    expect(() => blend(b, 0, b, 0, 1)).toThrow(RangeError)
  })
})

describe('escalate', () => {
  it('returns an EscalatedConflict with both beliefs and the K value', () => {
    const b1 = createBelief('P', 0.8, 0.1, 0.1)
    const b2 = createBelief('P', 0.1, 0.8, 0.1)
    const k = computeK(b1, b2)
    const conflict = escalate(b1, b2, k)
    expect(conflict.proposition).toBe('P')
    expect(conflict.b1).toBe(b1)
    expect(conflict.b2).toBe(b2)
    expect(conflict.conflictK).toBeCloseTo(k, 5)
  })
})
