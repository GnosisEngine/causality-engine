// src/math/hdc/tests/hdc.test.ts

import { describe, it, expect } from 'vitest'
import { createBaseVector, createEmptyBundle } from '../vectors.js'
import { bind, remember, binarize } from '../bundle.js'
import { recall } from '../recall.js'

describe('createBaseVector', () => {
  it('returns an Int8Array of the correct dimension', () => {
    const v = createBaseVector('entity-1', 42, 1024)
    expect(v).toBeInstanceOf(Int8Array)
    expect(v.length).toBe(1024)
  })

  it('contains only +1 and -1 values', () => {
    const v = createBaseVector('entity-1', 42, 512)
    for (const val of v) expect(Math.abs(val)).toBe(1)
  })

  it('is deterministic for the same id, seed, and dim', () => {
    const a = createBaseVector('faction-x', 99, 512)
    const b = createBaseVector('faction-x', 99, 512)
    expect(a).toEqual(b)
  })

  it('produces different vectors for different ids', () => {
    const a = createBaseVector('npc-1', 42, 512)
    const b = createBaseVector('npc-2', 42, 512)
    let diff = 0
    for (let i = 0; i < 512; i++) if (a[i] !== b[i]) diff++
    expect(diff).toBeGreaterThan(100)
  })

  it('produces different vectors for different seeds', () => {
    const a = createBaseVector('npc-1', 1, 512)
    const b = createBaseVector('npc-1', 2, 512)
    let diff = 0
    for (let i = 0; i < 512; i++) if (a[i] !== b[i]) diff++
    expect(diff).toBeGreaterThan(100)
  })
})

describe('bind', () => {
  it('returns an Int8Array of the same dimension', () => {
    const a = createBaseVector('a', 1, 256)
    const b = createBaseVector('b', 1, 256)
    expect(bind(a, b).length).toBe(256)
  })

  it('contains only +1 and -1 values', () => {
    const a = createBaseVector('a', 1, 256)
    const b = createBaseVector('b', 1, 256)
    for (const v of bind(a, b)) expect(Math.abs(v)).toBe(1)
  })

  it('is its own inverse — bind(bind(a, b), b) ≈ a', () => {
    const a = createBaseVector('a', 1, 512)
    const b = createBaseVector('b', 1, 512)
    const recovered = bind(bind(a, b), b)
    expect(recovered).toEqual(a)
  })

  it('throws on dimension mismatch', () => {
    const a = createBaseVector('a', 1, 256)
    const b = createBaseVector('b', 1, 512)
    expect(() => bind(a, b)).toThrow(RangeError)
  })
})

describe('remember and recall', () => {
  const DIM = 4096
  const SEED = 7

  it('a remembered experience has higher recall than chance', () => {
    const src  = createBaseVector('src',  SEED, DIM)
    const verb = createBaseVector('verb', SEED, DIM)
    const tgt  = createBaseVector('tgt',  SEED, DIM)

    const experience = bind(bind(src, verb), tgt)
    const bundle = remember(createEmptyBundle(DIM), experience, 1.0)
    const similarity = recall(bundle, experience)

    expect(similarity).toBeGreaterThan(0.6)
  })

  it('an unremembered experience scores near 0.5', () => {
    const src  = createBaseVector('src',  SEED, DIM)
    const verb = createBaseVector('verb', SEED, DIM)
    const tgt  = createBaseVector('tgt',  SEED, DIM)
    const other = createBaseVector('other', SEED, DIM)

    const remembered = bind(bind(src, verb), tgt)
    const bundle = remember(createEmptyBundle(DIM), remembered, 1.0)

    const noise = bind(bind(src, verb), other)
    const similarity = recall(bundle, noise)
    expect(similarity).toBeLessThan(0.65)
  })

  it('higher weight produces higher recall fidelity than lower weight', () => {
    const src  = createBaseVector('src',  SEED, DIM)
    const verb = createBaseVector('verb', SEED, DIM)
    const tgt  = createBaseVector('tgt',  SEED, DIM)
    const experience = bind(bind(src, verb), tgt)

    const highBundle = remember(createEmptyBundle(DIM), experience, 1.0)
    const lowBundle  = remember(createEmptyBundle(DIM), experience, 0.1)

    expect(recall(highBundle, experience)).toBeGreaterThanOrEqual(recall(lowBundle, experience))
  })

  it('recall degrades after many interfering experiences', () => {
    const DIM_SMALL = 1024
    const src  = createBaseVector('src',  SEED, DIM_SMALL)
    const verb = createBaseVector('verb', SEED, DIM_SMALL)
    const tgt  = createBaseVector('tgt',  SEED, DIM_SMALL)
    const target = bind(bind(src, verb), tgt)

    let bundle = remember(createEmptyBundle(DIM_SMALL), target, 1.0)
    const freshRecall = recall(bundle, target)

    for (let i = 0; i < 100; i++) {
      const noise = createBaseVector(`noise-${i}`, SEED, DIM_SMALL)
      bundle = remember(bundle, noise, 1.0)
    }
    const degradedRecall = recall(bundle, target)

    expect(degradedRecall).toBeLessThan(freshRecall)
  })

  it('throws on dimension mismatch', () => {
    const bundle = createEmptyBundle(256)
    const exp = createBaseVector('x', 1, 512)
    expect(() => remember(bundle, exp, 1.0)).toThrow(RangeError)
  })
})

describe('binarize', () => {
  it('maps positive values to +1 and negative to -1', () => {
    const acc = new Int32Array([5, -3, 0, -1, 10])
    const result = binarize(acc)
    expect(Array.from(result)).toEqual([1, -1, 1, -1, 1])
  })

  it('ties (0) resolve to +1', () => {
    const acc = new Int32Array([0, 0])
    expect(Array.from(binarize(acc))).toEqual([1, 1])
  })
})
