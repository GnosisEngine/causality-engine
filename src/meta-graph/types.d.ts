// src/meta-graph/types.d.ts

/**
 * A registered verb type in the meta-graph taxonomy.
 * inferenceStratum is assigned automatically during registration by the stratification pass.
 */
interface MetaVerb {
  id: string
  label: string
  /** Permitted source entity types. Empty array means unrestricted. */
  domain: string[]
  /** Permitted target entity types. Empty array means unrestricted. */
  range: string[]
  defaultTNorm: TNormId
  /** Id of the default PolicyFn for transitive rules on this verb type. Null if non-transitive. */
  defaultPolicyId: PolicyFnId | null
  /** Assigned by stratification pass. 0 = derived first. Read-only after registration. */
  inferenceStratum: number
  /** If true, asserting A→B also auto-asserts B→A with the same weight. */
  symmetric: boolean
  /** If true, this verb may appear in the boundary verb registry for cross-graph edges. */
  crossGraphAllowed: boolean
}

/** A taxonomy edge between two verb types in the meta-graph. */
interface MetaTaxonomyEdge {
  type: TaxonomyEdgeType
  sourceVerbId: string
  targetVerbId: string
  /** For 'implies' edges: weight multiplier applied to the derived edge weight. */
  factor?: number
  /** For 'excludes' edges: resolution policy when conflict is detected at write time. */
  resolutionPolicy?: ExclusionResolutionPolicy
}

/** All taxonomy edge types that may exist between verb types. */
type TaxonomyEdgeType = 'isSubtypeOf' | 'isInverseOf' | 'implies' | 'excludes' | 'requiresPolicy'

/**
 * An inference rule that derives edges of one verb type from conditions on other verb types.
 * Taxonomy 'implies' edges are compiled into InferenceRules automatically.
 * Custom transitive rules are registered explicitly.
 */
interface InferenceRule {
  id: string
  /** The verb type this rule produces derived edges for. */
  derivesVerbId: string
  /** Input conditions. All must be satisfied for the rule to fire. */
  conditions: InferenceCondition[]
  /** Required for transitive rules. Must reference a registered PolicyFn. */
  policyId: PolicyFnId | null
}

/** One condition in an InferenceRule. */
interface InferenceCondition {
  verbId: string
  /** If true, this condition requires the relationship to be ABSENT. */
  negated: boolean
}

/** Result of a stratification pass over the full inference rule set. */
interface StratificationResult {
  ok: boolean
  /** Populated on failure: the cycle that makes stratification impossible. */
  cycle?: string[]
  /** Populated on success: rule id → assigned stratum. */
  strata?: Map<string, number>
}
