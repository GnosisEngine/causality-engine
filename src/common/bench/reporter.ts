// src/common/bench/reporter.ts
/**
 * Console reporter for benchmark results.
 * Produces human-readable output and a CI-parseable summary line.
 */

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function fmt(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(1)}μs` : `${ms.toFixed(3)}ms`
}

export function report(result: BenchResult): void {
  const icon = result.passed ? PASS : FAIL
  const threshold = result.passed
    ? `${DIM}(threshold: ${fmt(result.thresholdMs)})${RESET}`
    : `\x1b[31m(threshold: ${fmt(result.thresholdMs)} EXCEEDED)\x1b[0m`

  console.log(`${icon} ${result.name}`)
  console.log(
    `  ${DIM}p50: ${fmt(result.p50Ms)}  p99: ${fmt(result.p99Ms)}  ` +
    `min: ${fmt(result.minMs)}  max: ${fmt(result.maxMs)}  ` +
    `n=${result.iterations}${RESET}  ${threshold}`
  )
}

export function reportSummary(results: BenchResult[]): void {
  const passed = results.filter(r => r.passed).length
  const total = results.length
  const icon = passed === total ? PASS : FAIL
  console.log(`\n${icon} ${passed}/${total} benchmarks passed`)
}
