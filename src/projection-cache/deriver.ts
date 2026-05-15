// src/projection-cache/deriver.ts

import type { GraphStore } from '@/graph-core/index.js'
import type { ComponentTypeRegistry } from './registry.js'
import type { DirtyFlagStore } from './dirty-flags.js'

/**
 * The ProjectionCache.
 *
 * The public face of the projection cache layer. Wraps the registry and dirty
 * flags into a single get/invalidate API that the tick loop and game systems use.
 *
 * get() is the primary read path:
 *   1. If the component is clean, return the cached value immediately.
 *   2. If the component is dirty but dirtyIntervalMs has not elapsed since the
 *      last derivation, return the (possibly stale) cached value.
 *   3. If the component is dirty and dirtyIntervalMs has elapsed (or this is the
 *      first derivation), call derive() and cache the result.
 *
 * This makes frequently-requested but slowly-changing components cheap to read
 * while preventing thrashing from repeated re-derivation under high write load.
 */
export interface ProjectionCache {
  /**
   * Returns the current value of a derived component for an entity.
   * Re-derives if dirty and the dirty interval has elapsed.
   * Returns null if the component type is not registered or the entity is unknown.
   */
  get<T>(entityId: string, graphId: string, componentTypeId: string, store: GraphStore): T | null
  /**
   * Explicitly invalidates a component for an entity.
   * Forces re-derivation on the next get() regardless of interval.
   */
  invalidate(entityId: string, componentTypeId: string): void
  /**
   * Re-derives all currently dirty components whose interval has elapsed.
   * Called by the game loop on a slow cadence (e.g. every 500ms).
   * Returns the number of components re-derived.
   */
  flush(store: GraphStore, graphId: string): number
}

interface CacheEntry {
  value: unknown
  derivedAtMs: number
}

export function createProjectionCache(
  registry: ComponentTypeRegistry,
  flags: DirtyFlagStore,
): ProjectionCache {
  // Map: `entityId::componentTypeId` → CacheEntry
  const cache = new Map<string, CacheEntry>()

  function cacheKey(entityId: string, componentTypeId: string): string {
    return `${entityId}::${componentTypeId}`
  }

  function shouldRederive(entityId: string, componentTypeId: string): boolean {
    if (!flags.isDirty(entityId, componentTypeId)) return false
    const entry = cache.get(cacheKey(entityId, componentTypeId))
    if (!entry) return true
    const type = registry.get(componentTypeId)
    if (!type) return false
    const elapsed = Date.now() - entry.derivedAtMs
    return elapsed >= type.dirtyIntervalMs
  }

  return {
    get<T>(entityId: string, graphId: string, componentTypeId: string, store: GraphStore): T | null {
      const type = registry.get(componentTypeId)
      if (!type) return null

      const key = cacheKey(entityId, componentTypeId)

      if (shouldRederive(entityId, componentTypeId)) {
        const value = type.derive(entityId, graphId, store)
        cache.set(key, { value, derivedAtMs: Date.now() })
        flags.markClean(entityId, componentTypeId)
        return value as T
      }

      return (cache.get(key)?.value ?? null) as T | null
    },

    invalidate(entityId: string, componentTypeId: string): void {
      flags.markDirty(entityId, componentTypeId)
      // Delete cached entry so next get() forces immediate re-derivation
      // regardless of dirtyIntervalMs
      cache.delete(cacheKey(entityId, componentTypeId))
    },

    flush(store: GraphStore, graphId: string): number {
      const dirty = flags.allDirty()
      let count = 0
      for (const { entityId, componentTypeId } of dirty) {
        if (shouldRederive(entityId, componentTypeId)) {
          const type = registry.get(componentTypeId)
          if (!type) continue
          const value = type.derive(entityId, graphId, store)
          cache.set(cacheKey(entityId, componentTypeId), { value, derivedAtMs: Date.now() })
          flags.markClean(entityId, componentTypeId)
          count++
        }
      }
      return count
    },
  }
}
