// src/math/policy/tests/policy.test.ts

import { describe, it, expect } from 'vitest'
import { geometric, harmonic, cutoff } from '../built-in.js'
import { verifyPolicy } from '../verifier.js'

describe('geometric', () => {
  it('produces an id that includes the discount factor', () => {
    expect(geometric(0.5).id).toBe('geometric(0.5)')
  })

  it('decays weight multiplicatively by discount^(hop+1)', () => {
    const p = geometric(0.5)
    expect(p.apply(1.0, 0)).toBeCloseTo(0.5, 5)
    expect(p.apply(1.0, 1)).toBeCloseTo(0.25, 5)
    expect(p.apply(1.0, 2)).toBeCloseTo(0.125, 5)
  })

  it('verify returns true for valid discount in (0, 1)', () => {
    expect(geometric(0.5).verify()).toBe(true)
    expect(geometric(0.9).verify()).toBe(true)
  })

  it('verify returns false for discount >= 1 or <= 0', () => {
    expect(geometric(1).verify()).toBe(false)
    expect(geometric(0).verify()).toBe(false)
    expect(geometric(1.5).verify()).toBe(false)
  })

  it('converges and passes verifyPolicy', () => {
    expect(verifyPolicy(geometric(0.5))).toBe(true)
    expect(verifyPolicy(geometric(0.99))).toBe(true)
  })
})

describe('harmonic', () => {
  it('has id "harmonic"', () => {
    expect(harmonic().id).toBe('harmonic')
  })

  it('decays as weight / (hop + 2)', () => {
    const p = harmonic()
    expect(p.apply(1.0, 0)).toBeCloseTo(0.5, 5)
    expect(p.apply(1.0, 8)).toBeCloseTo(0.1, 5)
  })

  it('verify always returns true', () => {
    expect(harmonic().verify()).toBe(true)
  })

  it('converges and passes verifyPolicy', () => {
    expect(verifyPolicy(harmonic())).toBe(true)
  })
})

describe('cutoff', () => {
  it('produces an id that includes maxHops', () => {
    expect(cutoff(3).id).toBe('cutoff(3)')
  })

  it('returns the original weight for hops below maxHops', () => {
    const p = cutoff(3)
    expect(p.apply(0.8, 0)).toBe(0.8)
    expect(p.apply(0.8, 2)).toBe(0.8)
  })

  it('returns 0 at and beyond maxHops', () => {
    const p = cutoff(3)
    expect(p.apply(0.8, 3)).toBe(0)
    expect(p.apply(0.8, 10)).toBe(0)
  })

  it('verify returns true for positive integer maxHops', () => {
    expect(cutoff(1).verify()).toBe(true)
    expect(cutoff(100).verify()).toBe(true)
  })

  it('verify returns false for non-integer or non-positive maxHops', () => {
    expect(cutoff(0).verify()).toBe(false)
    expect(cutoff(1.5).verify()).toBe(false)
  })

  it('converges and passes verifyPolicy', () => {
    expect(verifyPolicy(cutoff(3))).toBe(true)
  })
})

describe('verifyPolicy', () => {
  it('rejects a policy whose verify() returns false', () => {
    const bad: PolicyFn = { id: 'bad', apply: (w) => w, epsilon: 0.001, verify: () => false }
    expect(verifyPolicy(bad)).toBe(false)
  })

  it('rejects a policy that never converges', () => {
    const flat: PolicyFn = { id: 'flat', apply: (w) => w, epsilon: 0.001, verify: () => true }
    expect(verifyPolicy(flat)).toBe(false)
  })
})
