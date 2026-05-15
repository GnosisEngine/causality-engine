// src/math/fuzzy/types.d.ts

/** A t-norm composition function. Takes two fuzzy values in [0,1], returns a value in [0,1]. */
type TNormFn = (a: number, b: number) => number

/** Policy for resolving a write conflict when an exclusion edge exists between two verb types. */
type ExclusionResolutionPolicy = 'reject' | 'overwrite' | 'weaken'

/** Result of applying an exclusion resolution policy to a conflicting edge write. */
interface ExclusionResult {
  action: ExclusionResolutionPolicy
  /** Final weight of the existing edge. Undefined when action is 'overwrite' (edge is removed). */
  existingWeight?: number
  /** Final weight of the incoming edge. Undefined when action is 'reject' (write is abandoned). */
  incomingWeight?: number
}
