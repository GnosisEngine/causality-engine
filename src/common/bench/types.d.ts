// src/common/bench/types.d.ts
/** A single benchmark scenario definition. */
interface BenchScenario {
  /** Display name for reporting. Should be unique within a suite. */
  name: string
  /** Target p99 latency in milliseconds. The scenario fails if p99 exceeds this. */
  thresholdMs: number
  /** Number of iterations to run. Default: 1000. */
  iterations?: number
  /** Optional setup to run once before iterations begin. Not included in timing. */
  setup?: () => void | Promise<void>
  /** The function under measurement. Sync or async both supported. */
  fn: () => void | Promise<void>
}

/** The result of running a single benchmark scenario. */
interface BenchResult {
  name: string
  passed: boolean
  thresholdMs: number
  p50Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
  iterations: number
}

/** Options for the benchmark runner. */
interface BenchRunnerOptions {
  /** If true, runner exits the process with code 1 on any failure. Default: true. */
  exitOnFailure?: boolean
  /** If true, suppresses console output. Useful for testing the runner itself. */
  silent?: boolean
}
