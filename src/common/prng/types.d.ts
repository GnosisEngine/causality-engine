// src/common/prng/types.d.ts
/** Serialisable PRNG state string. Hex-encoded internal registers. */
type PRNGState = string;

/** A seeded, stateful, deterministic pseudo-random number generator. */
interface PRNG {
  /** Returns the next unsigned 32-bit integer. */
  nextUint32(): number;
  /** Returns the next float in [0, 1). */
  nextFloat(): number;
  /** Returns the next integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number;
  /** Serialises internal state for checkpointing. */
  getState(): PRNGState;
  /** Restores internal state from a prior getState() call. */
  setState(state: PRNGState): void;
}
