// src/federation/boundary-registry.ts

/**
 * Boundary verb registry.
 *
 * The whitelist of permitted cross-graph edge types. Any attempted cross-graph
 * write using a verb type not registered for the given source→target graph pair
 * is rejected at commit time.
 *
 * Boundary verbs have two additional properties beyond regular verb edges:
 *   - transmissionFidelity: how much of the original belief mass is preserved
 *     when the edge is delivered to the target graph (1.0 = no loss)
 *   - temporalOffset: ticks to wait before delivering the write to the target
 *     graph. null means immediate delivery. Non-null values feed the pending queue.
 */

export interface BoundaryVerb {
  verbType: string
  sourceGraphId: string
  targetGraphId: string
  /** [0, 1]. Scales mTrue and mFalse in DS belief on receipt. 1.0 = full fidelity. */
  transmissionFidelity: number
  /** Ticks before the target graph receives this write. null = immediate. */
  temporalOffset: number | null
  directionality: BoundaryDirection
}

export interface BoundaryRegistry {
  /** Registers a boundary verb. Throws on duplicate (same verbType + source + target). */
  register(verb: BoundaryVerb): void
  /** Returns true if the verbType is permitted for this source→target pair. */
  isAllowed(verbType: string, sourceGraphId: string, targetGraphId: string): boolean
  /** Returns the BoundaryVerb entry, or null if not registered. */
  get(verbType: string, sourceGraphId: string, targetGraphId: string): BoundaryVerb | null
  /** All registered boundary verbs. */
  all(): BoundaryVerb[]
  /**
   * Write-time validation. Returns error strings for a cross-graph edge.
   * Returns an empty array when the edge is permitted.
   */
  validate(verbType: string, sourceGraphId: string, targetGraphId: string): string[]
}

function key(verbType: string, src: string, tgt: string): string {
  return `${verbType}::${src}::${tgt}`
}

export function createBoundaryRegistry(): BoundaryRegistry {
  const entries = new Map<string, BoundaryVerb>()

  return {
    register(verb: BoundaryVerb): void {
      if (verb.transmissionFidelity < 0 || verb.transmissionFidelity > 1) {
        throw new RangeError(`transmissionFidelity must be in [0, 1], got ${verb.transmissionFidelity}`)
      }
      if (verb.temporalOffset !== null && verb.temporalOffset < 0) {
        throw new RangeError(`temporalOffset must be null or a non-negative integer`)
      }

      const k = key(verb.verbType, verb.sourceGraphId, verb.targetGraphId)
      if (entries.has(k)) {
        throw new Error(
          `Boundary verb "${verb.verbType}" from "${verb.sourceGraphId}" to "${verb.targetGraphId}" is already registered`
        )
      }
      entries.set(k, { ...verb })

      // For bidirectional verbs, register the reverse automatically
      if (verb.directionality === 'both') {
        const reverseKey = key(verb.verbType, verb.targetGraphId, verb.sourceGraphId)
        if (!entries.has(reverseKey)) {
          entries.set(reverseKey, {
            ...verb,
            sourceGraphId: verb.targetGraphId,
            targetGraphId: verb.sourceGraphId,
          })
        }
      }
    },

    isAllowed(verbType, sourceGraphId, targetGraphId): boolean {
      return entries.has(key(verbType, sourceGraphId, targetGraphId))
    },

    get(verbType, sourceGraphId, targetGraphId): BoundaryVerb | null {
      return entries.get(key(verbType, sourceGraphId, targetGraphId)) ?? null
    },

    all(): BoundaryVerb[] {
      return [...entries.values()]
    },

    validate(verbType, sourceGraphId, targetGraphId): string[] {
      const errors: string[] = []
      if (!entries.has(key(verbType, sourceGraphId, targetGraphId))) {
        errors.push(
          `Cross-graph edge with verbType "${verbType}" from graph "${sourceGraphId}" to graph "${targetGraphId}" is not in the boundary verb registry`
        )
      }
      return errors
    },
  }
}
