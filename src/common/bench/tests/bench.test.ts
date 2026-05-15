// src/common/bench/tests/bench.test.ts
import { describe, it, expect } from 'vitest'
import { runBenchmarks } from '../index.js'

describe('runBenchmarks', () => {
  it('returns a passing result when fn completes under threshold', async () => {
    const results = await runBenchmarks([{
      name: 'fast-op',
      thresholdMs: 100,
      iterations: 10,
      fn: () => { /* no-op */ },
    }], { silent: true, exitOnFailure: false })

    expect(results).toHaveLength(1)
    expect(results[0].passed).toBe(true)
    expect(results[0].name).toBe('fast-op')
  })

  it('returns a failing result when p99 exceeds threshold', async () => {
    const results = await runBenchmarks([{
      name: 'slow-op',
      thresholdMs: 0.001,
      iterations: 10,
      fn: () => new Promise(r => setTimeout(r, 5)),
    }], { silent: true, exitOnFailure: false })

    expect(results[0].passed).toBe(false)
    expect(results[0].p99Ms).toBeGreaterThan(0.001)
  })

  it('runs setup once before timing iterations', async () => {
    let setupCount = 0
    let fnCount = 0
    await runBenchmarks([{
      name: 'setup-test',
      thresholdMs: 100,
      iterations: 5,
      setup: () => { setupCount++ },
      fn: () => { fnCount++ },
    }], { silent: true, exitOnFailure: false })

    expect(setupCount).toBe(1)
    expect(fnCount).toBe(5)
  })

  it('reports correct iteration count', async () => {
    const results = await runBenchmarks([{
      name: 'iter-count',
      thresholdMs: 100,
      iterations: 42,
      fn: () => {},
    }], { silent: true, exitOnFailure: false })

    expect(results[0].iterations).toBe(42)
  })

  it('computes p50 <= p99', async () => {
    const results = await runBenchmarks([{
      name: 'percentiles',
      thresholdMs: 100,
      iterations: 100,
      fn: () => {},
    }], { silent: true, exitOnFailure: false })

    expect(results[0].p50Ms).toBeLessThanOrEqual(results[0].p99Ms)
  })

  it('handles multiple scenarios and returns one result per scenario', async () => {
    const results = await runBenchmarks([
      { name: 'a', thresholdMs: 100, iterations: 5, fn: () => {} },
      { name: 'b', thresholdMs: 100, iterations: 5, fn: () => {} },
      { name: 'c', thresholdMs: 100, iterations: 5, fn: () => {} },
    ], { silent: true, exitOnFailure: false })

    expect(results).toHaveLength(3)
    expect(results.map(r => r.name)).toEqual(['a', 'b', 'c'])
  })
})
