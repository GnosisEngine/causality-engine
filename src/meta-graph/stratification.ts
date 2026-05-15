// src/meta-graph/stratification.ts

/**
 * Stratification of inference rules.
 *
 * Rules are sorted into strata such that:
 *   - Rules in stratum N may only use negation of predicates derived by rules in strata < N
 *   - Rules within the same stratum have no negated inter-dependencies
 *
 * A cycle through negation (rule A negates predicate P, which is derived by a rule
 * that depends on something derived by A) is unstratifiable and rejected.
 *
 * Non-negated dependencies impose no stratum constraint — the fixed-point evaluator
 * handles them by iterating until convergence.
 *
 * Algorithm: Kahn's topological sort over a negation dependency graph.
 *   Nodes  = inference rules
 *   Edges  = R1 → R2 if R1 negates a predicate that R2 derives (R1 must come after R2)
 */

/**
 * Assigns strata to inference rules.
 * Returns a StratificationResult with ok:true and a strata map on success,
 * or ok:false with the detected cycle on failure.
 */
export function stratify(rules: InferenceRule[]): StratificationResult {
  // Map: derivesVerbId → rule ids that derive it
  const derivedBy = new Map<string, string[]>()
  for (const rule of rules) {
    const existing = derivedBy.get(rule.derivesVerbId) ?? []
    existing.push(rule.id)
    derivedBy.set(rule.derivesVerbId, existing)
  }

  // Build negation dependency graph: ruleId → set of ruleIds that must precede it
  // R1 depends on R2 if R1 has a negated condition for a verb that R2 derives.
  const mustFollow = new Map<string, Set<string>>()
  for (const rule of rules) {
    mustFollow.set(rule.id, new Set())
  }

  for (const rule of rules) {
    for (const cond of rule.conditions) {
      if (!cond.negated) continue
      const predecessors = derivedBy.get(cond.verbId) ?? []
      for (const predId of predecessors) {
        if (predId !== rule.id) {
          mustFollow.get(rule.id)!.add(predId)
        }
      }
    }
  }

  // Kahn's algorithm over the negation graph
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, Set<string>>() // pred → rules that depend on pred

  for (const rule of rules) {
    inDegree.set(rule.id, mustFollow.get(rule.id)!.size)
    for (const pred of mustFollow.get(rule.id)!) {
      if (!dependents.has(pred)) dependents.set(pred, new Set())
      dependents.get(pred)!.add(rule.id)
    }
  }

  const strata = new Map<string, number>()
  const queue: string[] = []

  for (const rule of rules) {
    if (inDegree.get(rule.id) === 0) queue.push(rule.id)
  }

  let processed = 0

  while (queue.length > 0) {
    const ruleId = queue.shift()!
    processed++

    // Compute this rule's stratum: max(predecessors' strata) + 1, or 0 if no predecessors
    const preds = mustFollow.get(ruleId)!
    const stratum = preds.size === 0
      ? 0
      : Math.max(...[...preds].map(p => strata.get(p) ?? 0)) + 1
    strata.set(ruleId, stratum)

    for (const dependent of dependents.get(ruleId) ?? []) {
      const remaining = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, remaining)
      if (remaining === 0) queue.push(dependent)
    }
  }

  if (processed < rules.length) {
    // Cycle exists — find and report it
    const cycle = detectCycle(rules, mustFollow)
    return { ok: false, cycle }
  }

  return { ok: true, strata }
}

/** Traces one cycle in the negation dependency graph for error reporting. */
function detectCycle(rules: InferenceRule[], mustFollow: Map<string, Set<string>>): string[] {
  const visited = new Set<string>()
  const path: string[] = []

  function dfs(ruleId: string): boolean {
    if (path.includes(ruleId)) {
      const cycleStart = path.indexOf(ruleId)
      path.push(ruleId)
      path.splice(0, cycleStart)
      return true
    }
    if (visited.has(ruleId)) return false
    visited.add(ruleId)
    path.push(ruleId)
    for (const pred of mustFollow.get(ruleId) ?? []) {
      if (dfs(pred)) return true
    }
    path.pop()
    return false
  }

  for (const rule of rules) {
    if (!visited.has(rule.id)) {
      if (dfs(rule.id)) return [...path]
    }
  }

  return []
}
