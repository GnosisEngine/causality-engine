// src/meta-graph/registry.ts

import { verifyPolicy } from '@/math/policy/index.js'
import { validateMetaVerb, validateTaxonomyEdge, validateInferenceRule } from './validator.js'
import { impliesEdgesToRules, getSubtypes, getInverse, getExclusions, getImplications, isSubtypeOf } from './taxonomy.js'
import { stratify } from './stratification.js'

/**
 * The MetaGraph registry. Maintains all registered verb types, taxonomy edges,
 * inference rules, and policy functions.
 *
 * All mutations go through a transaction. If any step of a transaction fails,
 * nothing is committed to the store.
 *
 * This is the single source of truth for what verbs and rules exist.
 * The graph-core system consults it at write-time for validation.
 */
export interface MetaGraphRegistry {
  // ── Registration ──────────────────────────────────────────────────────────
  registerPolicy(id: PolicyFnId, fn: PolicyFn): void
  registerVerb(verb: Omit<MetaVerb, 'inferenceStratum'>): void
  registerTaxonomyEdge(edge: MetaTaxonomyEdge): void
  registerInferenceRule(rule: InferenceRule): void

  // ── Lookups ───────────────────────────────────────────────────────────────
  hasVerb(verbId: string): boolean
  getVerb(verbId: string): MetaVerb | null
  getPolicy(policyId: PolicyFnId): PolicyFn | null
  getSubtypes(verbId: string): Set<string>
  isSubtypeOf(candidateVerbId: string, ancestorVerbId: string): boolean
  getInverse(verbId: string): string | null
  getExclusions(verbId: string): Array<{ verbId: string; resolutionPolicy: ExclusionResolutionPolicy }>
  getImplications(verbId: string): Array<{ verbId: string; factor: number }>
  getAllVerbs(): MetaVerb[]
  getAllRules(): InferenceRule[]
}

export function createMetaGraphRegistry(): MetaGraphRegistry {
  const verbs   = new Map<string, MetaVerb>()
  const policies = new Map<string, PolicyFn>()
  const edges: MetaTaxonomyEdge[] = []
  const rules   = new Map<string, InferenceRule>()

  function verbIds(): Set<string> { return new Set(verbs.keys()) }
  function policyIds(): Set<string> { return new Set(policies.keys()) }
  function ruleIds(): Set<string> { return new Set(rules.keys()) }

  function reStratify(candidateRules: InferenceRule[]): Map<string, number> {
    const result = stratify(candidateRules)
    if (!result.ok) {
      throw new Error(
        `Unstratifiable inference rules — cycle through negation detected: ${result.cycle?.join(' → ')}`
      )
    }
    return result.strata!
  }

  return {
    registerPolicy(id, fn) {
      if (!verifyPolicy(fn)) {
        throw new Error(`PolicyFn "${id}" failed convergence verification`)
      }
      policies.set(id, { ...fn, id })
    },

    registerVerb(verbDef) {
      const errors = validateMetaVerb(verbDef, verbIds(), policyIds())
      if (errors.length > 0) throw new Error(`MetaVerb registration failed:\n${errors.join('\n')}`)

      // Check symmetric ↔ isInverseOf conflict
      if (verbDef.symmetric) {
        const selfInverse = edges.find(
          e => e.type === 'isInverseOf' && e.sourceVerbId === verbDef.id
        )
        if (selfInverse) {
          throw new Error(`Symmetric verb "${verbDef.id}" cannot have an isInverseOf edge`)
        }
      }

      verbs.set(verbDef.id, { ...verbDef, inferenceStratum: 0 })

      // Re-run stratification with any existing implies rules
      const allRules = [
        ...[...rules.values()],
        ...impliesEdgesToRules(edges),
      ]
      const strata = reStratify(allRules)
      applyStrata(strata)
    },

    registerTaxonomyEdge(edge) {
      const errors = validateTaxonomyEdge(edge, verbIds(), policyIds(), edges)
      if (errors.length > 0) throw new Error(`Taxonomy edge registration failed:\n${errors.join('\n')}`)

      // Symmetric + isInverseOf conflict check
      if (edge.type === 'isInverseOf') {
        const sourceVerb = verbs.get(edge.sourceVerbId)
        if (sourceVerb?.symmetric) {
          throw new Error(`Symmetric verb "${edge.sourceVerbId}" cannot have an isInverseOf edge`)
        }
      }

      edges.push(edge)

      // Re-stratify to account for any new implies rules
      const allRules = [[...rules.values()], impliesEdgesToRules(edges)].flat()
      const strata = reStratify(allRules)
      applyStrata(strata)
    },

    registerInferenceRule(rule) {
      const errors = validateInferenceRule(rule, verbIds(), policyIds(), ruleIds())
      if (errors.length > 0) throw new Error(`InferenceRule registration failed:\n${errors.join('\n')}`)

      // Validate policy if this is a transitive rule
      if (rule.policyId !== null) {
        const fn = policies.get(rule.policyId)
        if (!fn) throw new Error(`policyId "${rule.policyId}" not found`)
        if (!verifyPolicy(fn)) throw new Error(`PolicyFn "${rule.policyId}" failed convergence verification`)
      }

      // Tentatively add the rule and re-stratify
      const candidateRules = [
        ...[...rules.values()],
        ...impliesEdgesToRules(edges),
        rule,
      ]
      const strata = reStratify(candidateRules)

      // Commit
      rules.set(rule.id, rule)
      applyStrata(strata)
    },

    hasVerb: (verbId) => verbs.has(verbId),
    getVerb: (verbId) => verbs.get(verbId) ?? null,
    getPolicy: (policyId) => policies.get(policyId) ?? null,
    getSubtypes: (verbId) => getSubtypes(verbId, edges),
    isSubtypeOf: (c, a) => isSubtypeOf(c, a, edges),
    getInverse: (verbId) => getInverse(verbId, edges),
    getExclusions: (verbId) => getExclusions(verbId, edges),
    getImplications: (verbId) => getImplications(verbId, edges),
    getAllVerbs: () => [...verbs.values()],
    getAllRules: () => [
      ...[...rules.values()],
      ...impliesEdgesToRules(edges),
    ],
  }

  function applyStrata(strata: Map<string, number>): void {
    // Update inferenceStratum on each verb based on the rules that derive it
    for (const [verbId, verb] of verbs) {
      let maxStratum = 0
      for (const [ruleId, stratum] of strata) {
        // Find the rule that derives this verb
        const allRules = [[...rules.values()], impliesEdgesToRules(edges)].flat()
        const rule = allRules.find(r => r.id === ruleId)
        if (rule?.derivesVerbId === verbId) {
          maxStratum = Math.max(maxStratum, stratum)
        }
      }
      verbs.set(verbId, { ...verb, inferenceStratum: maxStratum })
    }
  }
}
