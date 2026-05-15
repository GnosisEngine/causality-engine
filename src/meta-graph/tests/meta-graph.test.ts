// src/meta-graph/tests/meta-graph.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createMetaGraphRegistry } from '../registry.js'
import { validateMetaVerb, validateTaxonomyEdge, validateInferenceRule } from '../validator.js'
import { getSubtypes, isSubtypeOf, getInverse, getExclusions, getImplications } from '../taxonomy.js'
import { stratify } from '../stratification.js'
import { geometric } from '@/math/policy/index.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVerb(id: string, overrides: Partial<Omit<MetaVerb, 'inferenceStratum'>> = {}): Omit<MetaVerb, 'inferenceStratum'> {
  return {
    id,
    label: id,
    domain: [],
    range: [],
    defaultTNorm: 'product',
    defaultPolicyId: null,
    symmetric: false,
    crossGraphAllowed: false,
    ...overrides,
  }
}

function makeRegistry() {
  const reg = createMetaGraphRegistry()
  reg.registerPolicy('geometric(0.5)', geometric(0.5))
  return reg
}

// ─── validator ───────────────────────────────────────────────────────────────

describe('validateMetaVerb', () => {
  const registered = new Set(['existing'])
  const policies = new Set(['geometric(0.5)'])

  it('returns no errors for a valid verb', () => {
    const errors = validateMetaVerb(makeVerb('newVerb'), registered, policies)
    expect(errors).toHaveLength(0)
  })

  it('rejects an empty id', () => {
    const errors = validateMetaVerb(makeVerb(''), registered, policies)
    expect(errors.some(e => e.includes('id'))).toBe(true)
  })

  it('rejects a duplicate id', () => {
    const errors = validateMetaVerb(makeVerb('existing'), registered, policies)
    expect(errors.some(e => e.includes('already registered'))).toBe(true)
  })

  it('rejects an unknown TNormId', () => {
    const errors = validateMetaVerb(makeVerb('v', { defaultTNorm: 'unknown' as TNormId }), registered, policies)
    expect(errors.some(e => e.includes('TNormId'))).toBe(true)
  })

  it('rejects an unregistered defaultPolicyId', () => {
    const errors = validateMetaVerb(makeVerb('v', { defaultPolicyId: 'nope' }), registered, policies)
    expect(errors.some(e => e.includes('defaultPolicyId'))).toBe(true)
  })

  it('accepts a null defaultPolicyId', () => {
    const errors = validateMetaVerb(makeVerb('v', { defaultPolicyId: null }), registered, policies)
    expect(errors).toHaveLength(0)
  })
})

describe('validateTaxonomyEdge', () => {
  const registered = new Set(['isAlliedWith', 'isHostileToward', 'hasAttitudeToward'])
  const policies = new Set(['geometric(0.5)'])

  it('rejects an edge with an unregistered source', () => {
    const edge: MetaTaxonomyEdge = { type: 'isSubtypeOf', sourceVerbId: 'unknown', targetVerbId: 'hasAttitudeToward' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('rejects an edge with an unregistered target', () => {
    const edge: MetaTaxonomyEdge = { type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'unknown' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('rejects a self-referential isInverseOf edge', () => {
    const edge: MetaTaxonomyEdge = { type: 'isInverseOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'isAlliedWith' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('rejects a self-referential implies edge', () => {
    const edge: MetaTaxonomyEdge = { type: 'implies', sourceVerbId: 'isAlliedWith', targetVerbId: 'isAlliedWith', factor: 0.5 }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('rejects an implies edge with missing factor', () => {
    const edge: MetaTaxonomyEdge = { type: 'implies', sourceVerbId: 'isAlliedWith', targetVerbId: 'isHostileToward' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('rejects an excludes edge without resolutionPolicy', () => {
    const edge: MetaTaxonomyEdge = { type: 'excludes', sourceVerbId: 'isAlliedWith', targetVerbId: 'isHostileToward' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(1)
  })

  it('accepts a valid isSubtypeOf edge', () => {
    const edge: MetaTaxonomyEdge = { type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward' }
    expect(validateTaxonomyEdge(edge, registered, policies, [])).toHaveLength(0)
  })
})

// ─── taxonomy ────────────────────────────────────────────────────────────────

describe('taxonomy — getSubtypes', () => {
  const edges: MetaTaxonomyEdge[] = [
    { type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward' },
    { type: 'isSubtypeOf', sourceVerbId: 'isHostileToward', targetVerbId: 'hasAttitudeToward' },
    { type: 'isSubtypeOf', sourceVerbId: 'isFriendlyWith', targetVerbId: 'isAlliedWith' },
  ]

  it('returns direct subtypes', () => {
    const result = getSubtypes('hasAttitudeToward', edges)
    expect(result.has('isAlliedWith')).toBe(true)
    expect(result.has('isHostileToward')).toBe(true)
  })

  it('returns transitive subtypes', () => {
    const result = getSubtypes('hasAttitudeToward', edges)
    expect(result.has('isFriendlyWith')).toBe(true)
  })

  it('returns empty set for a leaf verb', () => {
    expect(getSubtypes('isHostileToward', edges).size).toBe(0)
  })
})

describe('taxonomy — isSubtypeOf', () => {
  const edges: MetaTaxonomyEdge[] = [
    { type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward' },
  ]

  it('returns true for the same verb', () => {
    expect(isSubtypeOf('isAlliedWith', 'isAlliedWith', edges)).toBe(true)
  })

  it('returns true for a direct subtype', () => {
    expect(isSubtypeOf('isAlliedWith', 'hasAttitudeToward', edges)).toBe(true)
  })

  it('returns false for an unrelated verb', () => {
    expect(isSubtypeOf('hasAttitudeToward', 'isAlliedWith', edges)).toBe(false)
  })
})

describe('taxonomy — getInverse', () => {
  const edges: MetaTaxonomyEdge[] = [
    { type: 'isInverseOf', sourceVerbId: 'owns', targetVerbId: 'isOwnedBy' },
  ]

  it('returns the inverse verb id', () => {
    expect(getInverse('owns', edges)).toBe('isOwnedBy')
  })

  it('returns null when no inverse exists', () => {
    expect(getInverse('isOwnedBy', edges)).toBeNull()
  })
})

describe('taxonomy — getExclusions', () => {
  const edges: MetaTaxonomyEdge[] = [
    { type: 'excludes', sourceVerbId: 'isAlliedWith', targetVerbId: 'isAtWarWith', resolutionPolicy: 'overwrite' },
  ]

  it('returns exclusion entries with resolution policy', () => {
    const result = getExclusions('isAlliedWith', edges)
    expect(result).toHaveLength(1)
    expect(result[0].verbId).toBe('isAtWarWith')
    expect(result[0].resolutionPolicy).toBe('overwrite')
  })

  it('returns empty array for verbs with no exclusions', () => {
    expect(getExclusions('isAtWarWith', edges)).toHaveLength(0)
  })
})

describe('taxonomy — getImplications', () => {
  const edges: MetaTaxonomyEdge[] = [
    { type: 'implies', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward', factor: 0.8 },
  ]

  it('returns implication entries with factor', () => {
    const result = getImplications('isAlliedWith', edges)
    expect(result).toHaveLength(1)
    expect(result[0].verbId).toBe('hasAttitudeToward')
    expect(result[0].factor).toBe(0.8)
  })

  it('returns empty array for verbs with no implications', () => {
    expect(getImplications('hasAttitudeToward', edges)).toHaveLength(0)
  })
})

// ─── stratification ───────────────────────────────────────────────────────────

describe('stratify', () => {
  it('assigns stratum 0 to all rules with no negated dependencies', () => {
    const rules: InferenceRule[] = [
      { id: 'r1', derivesVerbId: 'A', conditions: [{ verbId: 'B', negated: false }], policyId: null },
      { id: 'r2', derivesVerbId: 'C', conditions: [{ verbId: 'A', negated: false }], policyId: null },
    ]
    const result = stratify(rules)
    expect(result.ok).toBe(true)
    expect(result.strata!.get('r1')).toBe(0)
    expect(result.strata!.get('r2')).toBe(0)
  })

  it('assigns higher stratum when a rule negates a derived predicate', () => {
    const rules: InferenceRule[] = [
      { id: 'derives-P', derivesVerbId: 'P', conditions: [{ verbId: 'Q', negated: false }], policyId: null },
      { id: 'negates-P', derivesVerbId: 'R', conditions: [{ verbId: 'P', negated: true }], policyId: null },
    ]
    const result = stratify(rules)
    expect(result.ok).toBe(true)
    expect(result.strata!.get('negates-P')).toBeGreaterThan(result.strata!.get('derives-P')!)
  })

  it('returns ok:false with a cycle when rules are unstratifiable', () => {
    // A negates P, B derives P but negates R, C derives R but negates what A derives
    const rules: InferenceRule[] = [
      { id: 'r-A', derivesVerbId: 'X', conditions: [{ verbId: 'P', negated: true }], policyId: null },
      { id: 'r-B', derivesVerbId: 'P', conditions: [{ verbId: 'X', negated: true }], policyId: null },
    ]
    const result = stratify(rules)
    expect(result.ok).toBe(false)
    expect(result.cycle).toBeDefined()
    expect(result.cycle!.length).toBeGreaterThan(0)
  })

  it('handles an empty rule set', () => {
    const result = stratify([])
    expect(result.ok).toBe(true)
    expect(result.strata!.size).toBe(0)
  })
})

// ─── registry ────────────────────────────────────────────────────────────────

describe('MetaGraphRegistry', () => {
  let reg: ReturnType<typeof createMetaGraphRegistry>

  beforeEach(() => {
    reg = makeRegistry()
    reg.registerVerb(makeVerb('hasAttitudeToward'))
    reg.registerVerb(makeVerb('isAlliedWith'))
    reg.registerVerb(makeVerb('isHostileToward'))
  })

  describe('registerVerb', () => {
    it('registers a verb and makes it findable', () => {
      expect(reg.hasVerb('hasAttitudeToward')).toBe(true)
      expect(reg.getVerb('hasAttitudeToward')).not.toBeNull()
    })

    it('throws on duplicate id', () => {
      expect(() => reg.registerVerb(makeVerb('hasAttitudeToward'))).toThrow()
    })

    it('throws on invalid TNormId', () => {
      expect(() => reg.registerVerb(makeVerb('bad', { defaultTNorm: 'nope' as TNormId }))).toThrow()
    })

    it('throws when symmetric verb gets isInverseOf edge registered first', () => {
      reg.registerVerb(makeVerb('owns'))
      reg.registerVerb(makeVerb('isOwnedBy'))
      reg.registerTaxonomyEdge({ type: 'isInverseOf', sourceVerbId: 'owns', targetVerbId: 'isOwnedBy' })
      // Now try to register a symmetric verb with same id — can't because owns is already registered
      // Test the symmetric + existing inverse conflict at edge registration
      reg.registerVerb(makeVerb('symVerb', { symmetric: true }))
      reg.registerVerb(makeVerb('otherVerb'))
      // isInverseOf on symmetric verb should throw
      expect(() =>
        reg.registerTaxonomyEdge({ type: 'isInverseOf', sourceVerbId: 'symVerb', targetVerbId: 'otherVerb' })
      ).toThrow()
    })
  })

  describe('registerPolicy', () => {
    it('registers a policy that can then be used in verbs', () => {
      reg.registerPolicy('harmonic', { id: 'harmonic', apply: (w, h) => w / (h + 2), epsilon: 0.001, verify: () => true })
      reg.registerVerb(makeVerb('influencedBy', { defaultPolicyId: 'harmonic' }))
      expect(reg.hasVerb('influencedBy')).toBe(true)
    })

    it('throws for a policy that fails convergence verification', () => {
      expect(() =>
        reg.registerPolicy('flat', { id: 'flat', apply: (w) => w, epsilon: 0.001, verify: () => true })
      ).toThrow()
    })
  })

  describe('registerTaxonomyEdge', () => {
    it('registers a subtype relationship', () => {
      reg.registerTaxonomyEdge({ type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward' })
      expect(reg.isSubtypeOf('isAlliedWith', 'hasAttitudeToward')).toBe(true)
    })

    it('registers an inverse relationship', () => {
      reg.registerVerb(makeVerb('isOwnedBy'))
      reg.registerVerb(makeVerb('owns'))
      reg.registerTaxonomyEdge({ type: 'isInverseOf', sourceVerbId: 'owns', targetVerbId: 'isOwnedBy' })
      expect(reg.getInverse('owns')).toBe('isOwnedBy')
    })

    it('registers an exclusion', () => {
      reg.registerTaxonomyEdge({ type: 'excludes', sourceVerbId: 'isAlliedWith', targetVerbId: 'isHostileToward', resolutionPolicy: 'overwrite' })
      const exclusions = reg.getExclusions('isAlliedWith')
      expect(exclusions[0].verbId).toBe('isHostileToward')
    })

    it('throws for an edge referencing an unregistered verb', () => {
      expect(() =>
        reg.registerTaxonomyEdge({ type: 'isSubtypeOf', sourceVerbId: 'ghost', targetVerbId: 'hasAttitudeToward' })
      ).toThrow()
    })
  })

  describe('registerInferenceRule', () => {
    it('registers a valid rule', () => {
      reg.registerInferenceRule({
        id: 'test-rule',
        derivesVerbId: 'isAlliedWith',
        conditions: [{ verbId: 'hasAttitudeToward', negated: false }],
        policyId: null,
      })
      expect(reg.getAllRules().some(r => r.id === 'test-rule')).toBe(true)
    })

    it('throws for an unstratifiable rule set', () => {
      reg.registerVerb(makeVerb('P'))
      reg.registerVerb(makeVerb('X'))
      reg.registerInferenceRule({
        id: 'derives-X',
        derivesVerbId: 'X',
        conditions: [{ verbId: 'P', negated: true }],
        policyId: null,
      })
      expect(() => reg.registerInferenceRule({
        id: 'derives-P',
        derivesVerbId: 'P',
        conditions: [{ verbId: 'X', negated: true }],
        policyId: null,
      })).toThrow()
    })

    it('throws for a rule referencing an unregistered verb', () => {
      expect(() => reg.registerInferenceRule({
        id: 'bad-rule',
        derivesVerbId: 'ghost',
        conditions: [{ verbId: 'hasAttitudeToward', negated: false }],
        policyId: null,
      })).toThrow()
    })
  })

  describe('getSubtypes', () => {
    it('returns all transitive subtypes', () => {
      reg.registerTaxonomyEdge({ type: 'isSubtypeOf', sourceVerbId: 'isAlliedWith', targetVerbId: 'hasAttitudeToward' })
      reg.registerTaxonomyEdge({ type: 'isSubtypeOf', sourceVerbId: 'isHostileToward', targetVerbId: 'hasAttitudeToward' })
      const subtypes = reg.getSubtypes('hasAttitudeToward')
      expect(subtypes.has('isAlliedWith')).toBe(true)
      expect(subtypes.has('isHostileToward')).toBe(true)
    })
  })

  describe('getAllVerbs', () => {
    it('returns all registered verbs', () => {
      const all = reg.getAllVerbs()
      expect(all.map(v => v.id)).toEqual(expect.arrayContaining(['hasAttitudeToward', 'isAlliedWith', 'isHostileToward']))
    })
  })
})

describe('validateInferenceRule', () => {
  const verbs = new Set(['isAlliedWith', 'hasAttitudeToward', 'isTrustedBy'])
  const policies = new Set(['geometric(0.5)'])
  const existingRules = new Set(['existing-rule'])

  function makeRule(overrides: Partial<InferenceRule> = {}): InferenceRule {
    return {
      id: 'test-rule',
      derivesVerbId: 'isAlliedWith',
      conditions: [{ verbId: 'hasAttitudeToward', negated: false }],
      policyId: null,
      ...overrides,
    }
  }

  it('returns no errors for a valid rule', () => {
    expect(validateInferenceRule(makeRule(), verbs, policies, existingRules)).toHaveLength(0)
  })

  it('rejects an empty id', () => {
    const errors = validateInferenceRule(makeRule({ id: '' }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('id'))).toBe(true)
  })

  it('rejects a whitespace-only id', () => {
    const errors = validateInferenceRule(makeRule({ id: '   ' }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('id'))).toBe(true)
  })

  it('rejects a duplicate rule id', () => {
    const errors = validateInferenceRule(makeRule({ id: 'existing-rule' }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('already registered'))).toBe(true)
  })

  it('rejects an unregistered derivesVerbId', () => {
    const errors = validateInferenceRule(makeRule({ derivesVerbId: 'ghost' }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('derivesVerbId'))).toBe(true)
  })

  it('rejects a rule with no conditions', () => {
    const errors = validateInferenceRule(makeRule({ conditions: [] }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('at least one condition'))).toBe(true)
  })

  it('rejects a condition referencing an unregistered verb', () => {
    const errors = validateInferenceRule(
      makeRule({ conditions: [{ verbId: 'ghost', negated: false }] }),
      verbs, policies, existingRules,
    )
    expect(errors.some(e => e.includes('Condition verbId'))).toBe(true)
  })

  it('reports one error per unregistered condition verb', () => {
    const errors = validateInferenceRule(
      makeRule({
        conditions: [
          { verbId: 'ghost-a', negated: false },
          { verbId: 'ghost-b', negated: true },
        ]
      }),
      verbs, policies, existingRules,
    )
    expect(errors.filter(e => e.includes('Condition verbId'))).toHaveLength(2)
  })

  it('rejects an unregistered policyId', () => {
    const errors = validateInferenceRule(makeRule({ policyId: 'nope' }), verbs, policies, existingRules)
    expect(errors.some(e => e.includes('policyId'))).toBe(true)
  })

  it('accepts a registered policyId', () => {
    const errors = validateInferenceRule(makeRule({ policyId: 'geometric(0.5)' }), verbs, policies, existingRules)
    expect(errors).toHaveLength(0)
  })

  it('accepts policyId: null for non-transitive rules', () => {
    const errors = validateInferenceRule(makeRule({ policyId: null }), verbs, policies, existingRules)
    expect(errors).toHaveLength(0)
  })

  it('accepts a negated condition referencing a registered verb', () => {
    const errors = validateInferenceRule(
      makeRule({ conditions: [{ verbId: 'isTrustedBy', negated: true }] }),
      verbs, policies, existingRules,
    )
    expect(errors).toHaveLength(0)
  })

  it('accepts multiple conditions, some negated', () => {
    const errors = validateInferenceRule(
      makeRule({
        conditions: [
          { verbId: 'hasAttitudeToward', negated: false },
          { verbId: 'isTrustedBy', negated: true },
        ]
      }),
      verbs, policies, existingRules,
    )
    expect(errors).toHaveLength(0)
  })

  it('accumulates multiple errors in a single pass', () => {
    const errors = validateInferenceRule(
      makeRule({ id: '', derivesVerbId: 'ghost', conditions: [] }),
      verbs, policies, existingRules,
    )
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})