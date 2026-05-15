// src/federation/dag.ts

/**
 * Inter-graph dependency DAG.
 *
 * Tracks which graph instances depend on which others. A graph B depends on A
 * if B may contain cross-graph edges that reference entities in A. Circular
 * inter-graph dependencies are rejected — the ordering must be a strict DAG.
 *
 * The canonical ordering for the three standard instances is:
 *   static-rules → dynamic-world → political
 *
 * static-rules has no dependencies. dynamic-world depends on static-rules.
 * political may depend on both. This ordering also determines load order at boot.
 */

export interface GraphDAG {
  /** Registers a graph instance with its declared dependencies. */
  register(graphId: string, dependsOn?: string[]): void
  /** Returns true if graphId is registered. */
  has(graphId: string): boolean
  /**
   * Validates the DAG and returns a topological sort (dependencies first).
   * Returns ok:false with the detected cycle if a cycle exists.
   */
  validate(): DAGValidationResult
  /** Returns registered graph ids in dependency order (dependencies first). */
  topologicalOrder(): string[]
}

export interface DAGValidationResult {
  ok: boolean
  order?: string[]
  cycle?: string[]
}

export function createGraphDAG(): GraphDAG {
  const deps = new Map<string, Set<string>>()

  function topSort(): DAGValidationResult {
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, Set<string>>()

    for (const id of deps.keys()) {
      if (!inDegree.has(id)) inDegree.set(id, 0)
      for (const dep of deps.get(id)!) {
        if (!deps.has(dep)) {
          return { ok: false, cycle: [dep, id] }
        }
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
        if (!dependents.has(dep)) dependents.set(dep, new Set())
        dependents.get(dep)!.add(id)
      }
    }

    const queue = [...inDegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id)
    const order: string[] = []

    while (queue.length > 0) {
      const id = queue.shift()!
      order.push(id)
      for (const dependent of dependents.get(id) ?? []) {
        const remaining = (inDegree.get(dependent) ?? 1) - 1
        inDegree.set(dependent, remaining)
        if (remaining === 0) queue.push(dependent)
      }
    }

    if (order.length < deps.size) {
      const inCycle = [...deps.keys()].filter(id => !order.includes(id))
      return { ok: false, cycle: inCycle }
    }

    return { ok: true, order }
  }

  return {
    register(graphId: string, dependsOn: string[] = []): void {
      if (deps.has(graphId)) {
        throw new Error(`Graph "${graphId}" is already registered in the DAG`)
      }
      deps.set(graphId, new Set(dependsOn))
    },

    has: (graphId) => deps.has(graphId),

    validate(): DAGValidationResult {
      return topSort()
    },

    topologicalOrder(): string[] {
      const result = topSort()
      if (!result.ok) {
        throw new Error(`Graph DAG contains a cycle: ${result.cycle?.join(' → ')}`)
      }
      return result.order!
    },
  }
}
