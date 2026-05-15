// src/common/decimal/types.d.ts
/** Number of decimal places used for all write-path rounding. */
declare const WEIGHT_PRECISION: 6

/** A value that has been rounded to WEIGHT_PRECISION decimal places. Nominally a number. */
type Rounded = number

/** A fuzzy weight value guaranteed to be in [0, 1] and rounded to WEIGHT_PRECISION. */
type Weight = number
