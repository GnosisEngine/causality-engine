// src/common/bench/runner.ts
/**
 * Benchmark runner for the Causality Engine.
 *
 * Operates like a test runner: scenarios declare a p99 threshold,
 * the runner measures actual p99, and fails any scenario that exceeds it.
 * Exits with code 1 on failure when run as a CLI script.
 *
 * Usage as a module:
 *   const results = await runBenchmarks(scenarios, { silent: true, exitOnFailure: false })
 *
 * Usage as a CLI script (each .bench.ts imports and calls runBenchmarks):
 *   npx tsx src/path/to/file.bench.ts
 */

import { report } from './reporter.js'

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function runScenario(scenario: BenchScenario): Promise<BenchResult> {
  const iterations = scenario.iterations ?? 1000

  if (scenario.setup) await scenario.setup()

  const timings: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await scenario.fn()
    timings.push(performance.now() - start)
  }

  timings.sort((a, b) => a - b)

  const p50Ms = percentile(timings, 50)
  const p99Ms = percentile(timings, 99)

  return {
    name: scenario.name,
    passed: p99Ms <= scenario.thresholdMs,
    thresholdMs: scenario.thresholdMs,
    p50Ms,
    p99Ms,
    minMs: timings[0],
    maxMs: timings[timings.length - 1],
    iterations,
  }
}

export async function runBenchmarks(
  scenarios: BenchScenario[],
  options: BenchRunnerOptions = {},
): Promise<BenchResult[]> {
  const { exitOnFailure = true, silent = false } = options

  const results: BenchResult[] = []
  for (const scenario of scenarios) {
    const result = await runScenario(scenario)
    results.push(result)
    if (!silent) report(result)
  }

  const anyFailed = results.some(r => !r.passed)
  if (anyFailed && exitOnFailure) process.exit(1)

  return results
}
