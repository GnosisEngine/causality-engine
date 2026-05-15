// src/common/decimal/tests/decimal.test.ts
import { describe, it, expect } from 'vitest'
import { round, clamp, add, subtract, multiply, divide, WEIGHT_PRECISION } from '../index.js'

describe('WEIGHT_PRECISION', () => {
  it('is 6', () => {
    expect(WEIGHT_PRECISION).toBe(6)
  })
})

describe('round', () => {
  it('eliminates classic float representation error', () => {
    expect(round(0.1 + 0.2)).toBe(0.3)
  })

  it('rounds to 6 decimal places', () => {
    expect(round(1.0000001)).toBe(1.0)
    expect(round(0.1234567)).toBe(0.123457)
  })

  it('is idempotent on already-rounded values', () => {
    expect(round(round(0.123456))).toBe(round(0.123456))
  })

  it('handles zero and one exactly', () => {
    expect(round(0)).toBe(0)
    expect(round(1)).toBe(1)
  })
})

describe('clamp', () => {
  it('clamps values below 0 to 0', () => {
    expect(clamp(-0.1)).toBe(0)
    expect(clamp(-100)).toBe(0)
  })

  it('clamps values above 1 to 1', () => {
    expect(clamp(1.1)).toBe(1)
    expect(clamp(100)).toBe(1)
  })

  it('passes through values in [0, 1] unchanged', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(0.5)).toBe(0.5)
    expect(clamp(1)).toBe(1)
  })

  it('rounds the result', () => {
    expect(clamp(0.1 + 0.2)).toBe(0.3)
  })
})

describe('add', () => {
  it('adds two values and rounds', () => {
    expect(add(0.1, 0.2)).toBe(0.3)
  })

  it('is deterministic', () => {
    expect(add(0.123456789, 0.000000111)).toBe(add(0.123456789, 0.000000111))
  })
})

describe('subtract', () => {
  it('subtracts and rounds', () => {
    expect(subtract(0.3, 0.1)).toBe(0.2)
  })
})

describe('multiply', () => {
  it('multiplies and rounds', () => {
    expect(multiply(0.7, 0.5)).toBe(0.35)
  })

  it('product of two weights stays in [0, 1]', () => {
    const result = multiply(0.999999, 0.999999)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(1)
  })
})

describe('divide', () => {
  it('divides and rounds', () => {
    expect(divide(1, 3)).toBe(0.333333)
  })

  it('throws on division by zero', () => {
    expect(() => divide(1, 0)).toThrow()
  })
})
