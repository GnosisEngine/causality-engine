import { describe, it, expect } from 'vitest'
import { add } from '@/index.js'

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('handles negatives', () => {
    expect(add(-1, 1)).toBe(0)
  })
})