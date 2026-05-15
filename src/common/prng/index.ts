// src/common/prng/index.ts
/**
 * Seeded deterministic PRNG using xoshiro128** algorithm.
 * 128-bit state (four uint32 registers), serialisable as a hex string.
 * Seeding uses splitmix32 expansion so that integer and string seeds
 * both produce well-distributed initial states.
 *
 * This is the only sanctioned source of randomness for all write paths.
 * Never use Math.random() in any code that affects graph state.
 */

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

/** Splitmix32 — used only to expand a seed into the initial state. */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x9e3779b9) >>> 0
    let z = s
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
}

/** Converts a string seed to a numeric seed via djb2. */
function stringToSeed(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = Math.imul(hash, 33) ^ s.charCodeAt(i)
  }
  return hash >>> 0
}

function initState(seed: number | string): Uint32Array {
  const numeric = typeof seed === 'string' ? stringToSeed(seed) : seed >>> 0
  const sm = splitmix32(numeric)
  return new Uint32Array([sm(), sm(), sm(), sm()])
}

function xoshiroNext(s: Uint32Array): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0
  const t = (s[1] << 9) >>> 0
  s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]
  s[2] ^= t
  s[3] = rotl(s[3], 11)
  return result
}

function stateToHex(s: Uint32Array): string {
  return Array.from(s).map(n => n.toString(16).padStart(8, '0')).join('')
}

function hexToState(hex: string): Uint32Array {
  const s = new Uint32Array(4)
  for (let i = 0; i < 4; i++) {
    s[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0
  }
  return s
}

export function createPRNG(seed: number | string): PRNG {
  const s = initState(seed)

  return {
    nextUint32(): number {
      return xoshiroNext(s)
    },
    nextFloat(): number {
      return xoshiroNext(s) / 4294967296
    },
    nextInt(min: number, max: number): number {
      const range = (max - min + 1) >>> 0
      return min + (xoshiroNext(s) % range)
    },
    getState(): PRNGState {
      return stateToHex(s)
    },
    setState(state: PRNGState): void {
      const restored = hexToState(state)
      s[0] = restored[0]; s[1] = restored[1]; s[2] = restored[2]; s[3] = restored[3]
    },
  }
}
