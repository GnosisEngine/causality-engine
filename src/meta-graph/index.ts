// src/meta-graph/index.ts

export { createMetaGraphRegistry } from './registry.js'
export type { MetaGraphRegistry } from './registry.js'
export { validateMetaVerb, validateTaxonomyEdge, validateInferenceRule } from './validator.js'
export {
  getSubtypes, isSubtypeOf, getInverse,
  getExclusions, getImplications, impliesEdgesToRules,
} from './taxonomy.js'
export { stratify } from './stratification.js'
