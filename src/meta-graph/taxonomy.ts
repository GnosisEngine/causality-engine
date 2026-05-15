// src/meta-graph/taxonomy.ts

/**
 * Taxonomy resolution — operates on a snapshot of registered verbs and edges.
 * All functions are pure: they take the current registry state and return results.
 * No mutation occurs here.
 */

/**
 * Returns the set of all verb ids that are subtypes of the given verb id,
 * including transitive subtypes. Does not include the verb itself.
 */
export function getSubtypes(
  verbId: string,
  edges: MetaTaxonomyEdge[],
): Set<string> {
  const subtypeEdges = edges.filter(e => e.type === 'isSubtypeOf')
  const result = new Set<string>()
  const queue = [verbId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of subtypeEdges) {
      if (edge.targetVerbId === current && !result.has(edge.sourceVerbId)) {
        result.add(edge.sourceVerbId)
        queue.push(edge.sourceVerbId)
      }
    }
  }

  return result
}

/**
 * Returns true if candidateVerbId is the same as or a subtype of ancestorVerbId.
 * Used by the query interface to match edges polymorphically.
 */
export function isSubtypeOf(
  candidateVerbId: string,
  ancestorVerbId: string,
  edges: MetaTaxonomyEdge[],
): boolean {
  if (candidateVerbId === ancestorVerbId) return true
  return getSubtypes(ancestorVerbId, edges).has(candidateVerbId)
}

/**
 * Returns the inverse verb id for the given verb, or null if no isInverseOf edge exists.
 */
export function getInverse(
  verbId: string,
  edges: MetaTaxonomyEdge[],
): string | null {
  const edge = edges.find(
    e => e.type === 'isInverseOf' && e.sourceVerbId === verbId
  )
  return edge?.targetVerbId ?? null
}

/**
 * Returns all exclusion relationships for a given verb id.
 * Each entry is the excluded verb id and the resolution policy to apply on conflict.
 */
export function getExclusions(
  verbId: string,
  edges: MetaTaxonomyEdge[],
): Array<{ verbId: string; resolutionPolicy: ExclusionResolutionPolicy }> {
  return edges
    .filter(e => e.type === 'excludes' && e.sourceVerbId === verbId)
    .map(e => ({
      verbId: e.targetVerbId,
      resolutionPolicy: e.resolutionPolicy ?? 'reject',
    }))
}

/**
 * Returns all implication relationships for a given verb id.
 * Each entry is the implied verb id and the weight multiplier factor.
 */
export function getImplications(
  verbId: string,
  edges: MetaTaxonomyEdge[],
): Array<{ verbId: string; factor: number }> {
  return edges
    .filter(e => e.type === 'implies' && e.sourceVerbId === verbId)
    .map(e => ({ verbId: e.targetVerbId, factor: e.factor ?? 1 }))
}

/**
 * Compiles all 'implies' taxonomy edges into InferenceRules.
 * Called internally by the registry during registration to keep the rule set consistent.
 */
export function impliesEdgesToRules(edges: MetaTaxonomyEdge[]): InferenceRule[] {
  return edges
    .filter(e => e.type === 'implies')
    .map(e => ({
      id: `__implies:${e.sourceVerbId}:${e.targetVerbId}`,
      derivesVerbId: e.targetVerbId,
      conditions: [{ verbId: e.sourceVerbId, negated: false }],
      policyId: null,
    }))
}
