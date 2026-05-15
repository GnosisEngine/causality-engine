// src/math/diffusion/types.d.ts

/**
 * A square influence matrix derived from weighted edges.
 * rows[i][j] = weight of influence from entity j onto entity i.
 * Row-normalised so that Σⱼ rows[i][j] = 1 for each i.
 */
interface TrustMatrix {
  /** Ordered list of entity ids corresponding to matrix rows and columns. */
  entityIds: string[]
  /** Row-normalised influence weights. rows[i] is the influence distribution for entity i. */
  rows: Float64Array[]
}

/** Configuration for a diffusion run. */
interface DiffusionConfig {
  /** Maximum number of DeGroot iterations before forced termination. Default: 100. */
  maxSteps?: number
  /** Convergence threshold. Stop when max belief change per step < this. Default: 0.001. */
  convergeDelta?: number
}
