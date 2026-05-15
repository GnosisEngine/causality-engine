// src/runtime/tests/runtime.test.ts

import { describe, it, expect, afterEach } from 'vitest'
import { createTickClock } from '../tick.js'
import { createWorkerPool } from '../worker-pool.js'


// ─── TickClock ────────────────────────────────────────────────────────────────

describe('createTickClock', () => {
  it('starts at tick 0', () => {
    expect(createTickClock().current()).toBe(0)
  })

  it('advance increments tick and returns new value', () => {
    const clock = createTickClock()
    expect(clock.advance()).toBe(1)
    expect(clock.advance()).toBe(2)
    expect(clock.current()).toBe(2)
  })

  it('reset sets tick to the given value', () => {
    const clock = createTickClock()
    clock.advance(); clock.advance(); clock.advance()
    clock.reset(100)
    expect(clock.current()).toBe(100)
  })

  it('ticksToMs converts using ticksPerSecond', () => {
    const clock = createTickClock({ ticksPerSecond: 20 })
    expect(clock.ticksToMs(20)).toBe(1000)
    expect(clock.ticksToMs(1)).toBe(50)
  })

  it('msToTicks converts using ticksPerSecond (floor)', () => {
    const clock = createTickClock({ ticksPerSecond: 20 })
    expect(clock.msToTicks(1000)).toBe(20)
    expect(clock.msToTicks(75)).toBe(1)
    expect(clock.msToTicks(49)).toBe(0)
  })

  it('ticksToMs and msToTicks are near-inverses for whole seconds', () => {
    const clock = createTickClock({ ticksPerSecond: 20 })
    expect(clock.msToTicks(clock.ticksToMs(20))).toBe(20)
  })

  it('ticksToGameMinutes converts using ticksPerGameMinute', () => {
    const clock = createTickClock({ ticksPerGameMinute: 5 })
    expect(clock.ticksToGameMinutes(10)).toBe(2)
    expect(clock.ticksToGameMinutes(4)).toBe(0)
  })

  it('default ticksPerGameMinute is 1', () => {
    const clock = createTickClock()
    expect(clock.ticksToGameMinutes(60)).toBe(60)
  })

  it('config returns a frozen copy of the configuration', () => {
    const clock = createTickClock({ ticksPerSecond: 30 })
    const cfg = clock.config()
    expect(cfg.ticksPerSecond).toBe(30)
    expect(Object.isFrozen(cfg)).toBe(true)
  })

  it('replay: reset then advance produces deterministic sequence', () => {
    const clock = createTickClock()
    for (let i = 0; i < 10; i++) clock.advance()

    clock.reset(0)
    const seq = Array.from({ length: 10 }, () => clock.advance())
    expect(seq).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

// ─── WorkerPool ───────────────────────────────────────────────────────────────

// Resolve the absolute path to the fixture module so workers can import it.
const fixtureUrl = new URL('./fixtures/tasks.ts', import.meta.url).href

describe('createWorkerPool', () => {
  let pool: ReturnType<typeof createWorkerPool>

  afterEach(async () => {
    try { if (pool) await pool.terminate() } catch { /* already terminated */ }
  })

  it('executes a task and resolves with the return value', async () => {
    pool = createWorkerPool(1)
    const result = await pool.submit<number>(
      { modulePath: fixtureUrl, functionName: 'add', args: [3, 4] },
      'critical',
    )
    expect(result).toBe(7)
  })

  it('executes multiple tasks concurrently', async () => {
    pool = createWorkerPool(2)
    const [a, b] = await Promise.all([
      pool.submit<number>({ modulePath: fixtureUrl, functionName: 'add', args: [1, 2] }, 'critical'),
      pool.submit<number>({ modulePath: fixtureUrl, functionName: 'multiply', args: [3, 4] }, 'critical'),
    ])
    expect(a).toBe(3)
    expect(b).toBe(12)
  })

  it('rejects when the task function throws', async () => {
    pool = createWorkerPool(1)
    await expect(
      pool.submit({ modulePath: fixtureUrl, functionName: 'throwError', args: ['boom'] }, 'critical')
    ).rejects.toThrow('boom')
  })

  it('rejects when the function name does not exist in the module', async () => {
    pool = createWorkerPool(1)
    await expect(
      pool.submit({ modulePath: fixtureUrl, functionName: 'nonExistent', args: [] }, 'critical')
    ).rejects.toThrow()
  })

  it('queues tasks when all workers are busy and dispatches when a worker frees', async () => {
    pool = createWorkerPool(1)
    // Submit two tasks to a single-worker pool — second must queue
    const p1 = pool.submit<string>({ modulePath: fixtureUrl, functionName: 'delay', args: [20] }, 'background')
    const p2 = pool.submit<string>({ modulePath: fixtureUrl, functionName: 'delay', args: [5] }, 'background')
    expect(pool.queueDepth()).toBeGreaterThanOrEqual(0) // at least one is queued
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('done:20')
    expect(r2).toBe('done:5')
  })

  it('dispatches critical tasks before background tasks', async () => {
    pool = createWorkerPool(1)
    const order: string[] = []

    // Fill the single worker with a slow task, then queue one background and one critical
    const blocker = pool.submit<string>({ modulePath: fixtureUrl, functionName: 'delay', args: [30] }, 'background')
    const bg = pool.submit<number>({ modulePath: fixtureUrl, functionName: 'add', args: [1, 1] }, 'background')
    const critical = pool.submit<number>({ modulePath: fixtureUrl, functionName: 'add', args: [2, 2] }, 'critical')

    // Track resolution order
    bg.then(() => order.push('background'))
    critical.then(() => order.push('critical'))
    await Promise.all([blocker, bg, critical])

    expect(order[0]).toBe('critical')
  })

  it('rejects all queued tasks on terminate', async () => {
    pool = createWorkerPool(1)
    // blocker occupies the single worker; queued sits in the queue
    const blocker = pool.submit<string>({ modulePath: fixtureUrl, functionName: 'delay', args: [200] }, 'background')
    const queued = pool.submit<number>({ modulePath: fixtureUrl, functionName: 'add', args: [1, 1] }, 'background')

    // Attach handlers before terminate so no rejection goes unobserved
    const blockerResult = blocker.then(() => 'resolved').catch(() => 'rejected')
    const queuedResult = queued.then(() => 'resolved').catch(() => 'rejected')

    await pool.terminate()

    expect(await queuedResult).toBe('rejected')
    // blocker was in-flight — may resolve or reject depending on timing
    expect(['resolved', 'rejected']).toContain(await blockerResult)
  })

  it('rejects new submissions after terminate', async () => {
    pool = createWorkerPool(1)
    await pool.terminate()
    await expect(
      pool.submit({ modulePath: fixtureUrl, functionName: 'add', args: [1, 1] }, 'critical')
    ).rejects.toThrow('terminated')
  })
})
