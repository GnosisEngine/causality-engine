// src/math/fuzzy/exclusion.ts

import { clamp } from '@/common/decimal/index.js'

/**
 * Resolves a conflict between an existing edge and an incoming edge write
 * when an exclusion relationship exists between their verb types.
 *
 * - 'reject':    The incoming write is abandoned. The existing edge is unchanged.
 * - 'overwrite': The existing edge is removed. The incoming edge is written at full weight.
 * - 'weaken':    Both edges have their weights reduced by the incoming edge's weight.
 *               Weights that reach zero are treated as removed.
 */
export function resolveExclusion(
  existingWeight: number,
  incomingWeight: number,
  policy: ExclusionResolutionPolicy,
): ExclusionResult {
  switch (policy) {
    case 'reject':
      return { action: 'reject', existingWeight }

    case 'overwrite':
      return { action: 'overwrite', incomingWeight }

    case 'weaken': {
      const newExisting = clamp(existingWeight - incomingWeight)
      const newIncoming = clamp(incomingWeight - existingWeight)
      return {
        action: 'weaken',
        existingWeight: newExisting,
        incomingWeight: newIncoming,
      }
    }
  }
}
