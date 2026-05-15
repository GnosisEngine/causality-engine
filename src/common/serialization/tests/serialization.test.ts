// src/common/serialization/tests/serialization.test.ts
import { describe, it, expect } from 'vitest'
import {
  encodeFloat32Array, decodeFloat32Array,
  encodeInt8Array, decodeInt8Array,
  encodeMap, decodeMap,
  encodePropertyBag, decodePropertyBag,
} from '../index.js'

describe('Float32Array round-trip', () => {
  it('encodes and decodes an empty array', () => {
    const arr = new Float32Array(0)
    expect(decodeFloat32Array(encodeFloat32Array(arr))).toEqual(arr)
  })

  it('encodes and decodes a populated array', () => {
    const arr = new Float32Array([0.1, 0.5, 0.9, -1.0, 1.0, 0.0])
    const result = decodeFloat32Array(encodeFloat32Array(arr))
    expect(result.length).toBe(arr.length)
    for (let i = 0; i < arr.length; i++) {
      expect(result[i]).toBeCloseTo(arr[i], 5)
    }
  })

  it('produces a string', () => {
    const arr = new Float32Array([1, 2, 3])
    expect(typeof encodeFloat32Array(arr)).toBe('string')
  })
})

describe('Int8Array round-trip', () => {
  it('encodes and decodes an empty array', () => {
    const arr = new Int8Array(0)
    expect(decodeInt8Array(encodeInt8Array(arr))).toEqual(arr)
  })

  it('encodes and decodes values including -1 and +1', () => {
    const arr = new Int8Array([1, -1, 1, -1, 1, 1, -1])
    expect(decodeInt8Array(encodeInt8Array(arr))).toEqual(arr)
  })

  it('preserves length across round-trip', () => {
    const arr = new Int8Array(8192).fill(1)
    expect(decodeInt8Array(encodeInt8Array(arr)).length).toBe(8192)
  })
})

describe('Map round-trip', () => {
  it('encodes and decodes an empty map', () => {
    const m: Map<string, number> = new Map()
    expect(decodeMap(encodeMap(m))).toEqual(m)
  })

  it('encodes and decodes a string-keyed map', () => {
    const m = new Map([['a', 1], ['b', 2], ['c', 3]])
    expect(decodeMap(encodeMap(m))).toEqual(m)
  })

  it('preserves insertion order', () => {
    const m = new Map([['z', 1], ['a', 2], ['m', 3]])
    const keys = [...decodeMap(encodeMap(m)).keys()]
    expect(keys).toEqual(['z', 'a', 'm'])
  })
})

describe('PropertyBag round-trip', () => {
  it('round-trips a bag with mixed value types', () => {
    const bag: PropertyBag = { name: 'Aldric', level: 5, active: true, alias: null }
    expect(decodePropertyBag(encodePropertyBag(bag))).toEqual(bag)
  })

  it('round-trips an empty bag', () => {
    expect(decodePropertyBag(encodePropertyBag({}))).toEqual({})
  })
})
