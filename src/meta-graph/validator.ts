// src/meta-graph/validator.ts

import { getTNorm } from '@/math/fuzzy/index.js'

/**
 * Validates a MetaVerb definition before it enters the registration transaction.
 * All checks are pure — no state mutations. Returns a list of error messages.
 * An empty array means the verb is valid.
 */
export function validateMetaVerb(
  verb: Omit<MetaVerb, 'inferenceStratum'>,
  registeredVerbIds: Set<string>,
  registeredPolicyIds: Set<string>,
): string[] {
  const errors: string[] = []

  if (!verb.id || typeof verb.id !== 'string' || verb.id.trim() === '') {
    errors.push('MetaVerb id must be a non-empty string')
  }

  if (registeredVerbIds.has(verb.id)) {
    errors.push(`MetaVerb id "${verb.id}" is already registered`)
  }

  if (!verb.label || verb.label.trim() === '') {
    errors.push('MetaVerb label must be a non-empty string')
  }

  try {
    getTNorm(verb.defaultTNorm)
  } catch {
    errors.push(`Unknown TNormId "${verb.defaultTNorm}"`)
  }

  if (verb.defaultPolicyId !== null) {
    if (!registeredPolicyIds.has(verb.defaultPolicyId)) {
      errors.push(`defaultPolicyId "${verb.defaultPolicyId}" is not a registered PolicyFn`)
    }
  }

  return errors
}

/**
 * Validates a taxonomy edge before it enters the registration transaction.
 */
export function validateTaxonomyEdge(
  edge: MetaTaxonomyEdge,
  registeredVerbIds: Set<string>,
  registeredPolicyIds: Set<string>,
  existingEdges: MetaTaxonomyEdge[],
): string[] {
  const errors: string[] = []

  if (!registeredVerbIds.has(edge.sourceVerbId)) {
    errors.push(`Taxonomy edge source "${edge.sourceVerbId}" is not a registered verb`)
  }

  if (!registeredVerbIds.has(edge.targetVerbId)) {
    errors.push(`Taxonomy edge target "${edge.targetVerbId}" is not a registered verb`)
  }

  if (edge.type === 'isInverseOf') {
    // A symmetric verb cannot have an isInverseOf edge — it is its own inverse
    const sourceVerb = edge.sourceVerbId
    const hasSymmetric = existingEdges.some(
      e => e.type === 'isSubtypeOf' && e.sourceVerbId === sourceVerb
    )
    // Check will be done in registry with full verb data; flag if target === source
    if (edge.sourceVerbId === edge.targetVerbId) {
      errors.push('isInverseOf edge cannot be self-referential')
    }
  }

  if (edge.type === 'excludes' || edge.type === 'implies') {
    if (edge.sourceVerbId === edge.targetVerbId) {
      errors.push(`"${edge.type}" edge cannot be self-referential`)
    }
  }

  if (edge.type === 'implies') {
    if (edge.factor === undefined || edge.factor <= 0 || edge.factor > 1) {
      errors.push('implies edge must have a factor in (0, 1]')
    }
  }

  if (edge.type === 'excludes') {
    if (!edge.resolutionPolicy) {
      errors.push('excludes edge must specify a resolutionPolicy')
    }
  }

  if (edge.type === 'requiresPolicy') {
    if (!edge.factor || !registeredPolicyIds.has(String(edge.factor))) {
      // factor field repurposed as policy id string for requiresPolicy edges
      errors.push('requiresPolicy edge must reference a registered PolicyFn id via the factor field')
    }
  }

  return errors
}

/**
 * Validates an InferenceRule before registration.
 */
export function validateInferenceRule(
  rule: InferenceRule,
  registeredVerbIds: Set<string>,
  registeredPolicyIds: Set<string>,
  existingRuleIds: Set<string>,
): string[] {
  const errors: string[] = []

  if (!rule.id || rule.id.trim() === '') {
    errors.push('InferenceRule id must be a non-empty string')
  }

  if (existingRuleIds.has(rule.id)) {
    errors.push(`InferenceRule id "${rule.id}" is already registered`)
  }

  if (!registeredVerbIds.has(rule.derivesVerbId)) {
    errors.push(`derivesVerbId "${rule.derivesVerbId}" is not a registered verb`)
  }

  if (rule.conditions.length === 0) {
    errors.push('InferenceRule must have at least one condition')
  }

  for (const cond of rule.conditions) {
    if (!registeredVerbIds.has(cond.verbId)) {
      errors.push(`Condition verbId "${cond.verbId}" is not a registered verb`)
    }
  }

  if (rule.policyId !== null && !registeredPolicyIds.has(rule.policyId)) {
    errors.push(`policyId "${rule.policyId}" is not a registered PolicyFn`)
  }

  return errors
}
