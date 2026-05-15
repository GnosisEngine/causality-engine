// src/math/dempster-shafer/index.ts

export { createBelief, unknownBelief, discountBelief } from './belief.js'
export { computeK, dempsterCombine } from './combination.js'
export { retainAuthority, blend, escalate } from './conflict.js'
