// src/projection-cache/dirty-flags.ts

import type { ComponentTypeRegistry } from './registry.js'

/**
 * Dirty flag store.
 *
 * Tracks which (entity, componentType) pairs are stale and need re-derivation.
 * When an edge changes, the affected source and target entity ids are marked dirty
 * for all component types whose dependency manifests include that edge's verb type.
 *
 * Version counter approach:
 *   Each (entity, component) pair stores the entity version at last derivation.
 *   isDirty checks whether the stored version is behind the entity's current version.
 *   This avoids explicit clearing — stale flags age out automatically as entities update.
 */
export interface DirtyFlagStore {
  /**
   * Called when an edge is added, updated, or removed.
   * Marks the source and target entities dirty for all affected component types.
   */
  notifyEdgeChange(verbType: string, sourceId: string, targetId: string): void
  /** Returns true if the component is dirty for the given entity. */
  isDirty(entityId: string, componentTypeId: string): boolean
  /** Marks a component clean for an entity (called after successful re-derivation). */
  markClean(entityId: string, componentTypeId: string): void
  /** Marks a component dirty for an entity (explicit invalidation). */
  markDirty(entityId: string, componentTypeId: string): void
  /** Returns all (entityId, componentTypeId) pairs that are currently dirty. */
  allDirty(): Array<{ entityId: string; componentTypeId: string }>
  /** Clears all dirty flags. Useful for testing and full-cache resets. */
  clear(): void
}

export function createDirtyFlagStore(registry: ComponentTypeRegistry): DirtyFlagStore {
  // Map: `entityId::componentTypeId` → true (dirty)
  const dirty = new Map<string, boolean>()

  function flagKey(entityId: string, componentTypeId: string): string {
    return `${entityId}::${componentTypeId}`
  }

  return {
    notifyEdgeChange(verbType, sourceId, targetId): void {
      const affected = registry.affectedBy([verbType])
      for (const compId of affected) {
        dirty.set(flagKey(sourceId, compId), true)
        dirty.set(flagKey(targetId, compId), true)
      }
    },

    isDirty(entityId, componentTypeId): boolean {
      return dirty.get(flagKey(entityId, componentTypeId)) === true
    },

    markClean(entityId, componentTypeId): void {
      dirty.delete(flagKey(entityId, componentTypeId))
    },

    markDirty(entityId, componentTypeId): void {
      dirty.set(flagKey(entityId, componentTypeId), true)
    },

    allDirty(): Array<{ entityId: string; componentTypeId: string }> {
      return [...dirty.entries()]
        .filter(([, v]) => v)
        .map(([k]) => {
          const [entityId, componentTypeId] = k.split('::')
          return { entityId, componentTypeId }
        })
    },

    clear(): void {
      dirty.clear()
    },
  }
}
