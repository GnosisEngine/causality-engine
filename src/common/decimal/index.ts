// src/common/decimal/index.ts
/**
 * Write-path arithmetic utilities with consistent fixed-precision rounding.
 *
 * All operations that affect edge weights or embedding values in the graph
 * must use these functions rather than raw JavaScript float arithmetic.
 * This ensures deterministic replay across hardware and V8 versions.
 *
 * The precision is fixed at 6 decimal places. toFixed(6) is specified by
 * the ECMAScript standard and produces consistent results across compliant
 * runtimes. The replay-determinism benchmark validates this empirically.
 */

export const WEIGHT_PRECISION = 6 as const

const FACTOR = 10 ** WEIGHT_PRECISION

/**
 * Rounds a value to WEIGHT_PRECISION decimal places.
 * Use on every value before it enters the graph store or event log.
 */
export function round(value: number): Rounded {
  return Math.round(value * FACTOR) / FACTOR
}

/**
 * Clamps a value to [0, 1] then rounds.
 * Use on all fuzzy weight values.
 */
export function clamp(value: number, min = 0, max = 1): Weight {
  return round(Math.min(max, Math.max(min, value)))
}

/** Adds two values and rounds. */
export function add(a: number, b: number): Rounded {
  return round(a + b)
}

/** Subtracts b from a and rounds. */
export function subtract(a: number, b: number): Rounded {
  return round(a - b)
}

/** Multiplies two values and rounds. */
export function multiply(a: number, b: number): Rounded {
  return round(a * b)
}

/** Divides a by b and rounds. Throws on division by zero. */
export function divide(a: number, b: number): Rounded {
  if (b === 0) throw new RangeError('Division by zero in write-path arithmetic')
  return round(a / b)
}
