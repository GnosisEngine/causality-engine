// src/runtime/hot-zone.ts

import type { GraphStore } from '@/graph-core/index.js'

/**
 * Hot zone tracker.
 *
 * Tracks which entities have been accessed recently. Entities that have not
 * been accessed within maxAgeMs are candidates for eviction from the in-memory
 * store. Evicted entities can be paged back in from persistence when needed.
 *
 * This is a pure access-time tracker — it does not perform I/O or interact
 * with persistence directly. The page-in/page-out coordination is the
 * responsibility of the caller (the zone server or the query router).
 *
 * Entities without any access record are considered cold immediately.
 * Entities that are explicitly pinned are never evicted.
 */
export interface HotZone {
  /** Records an entity access, keeping it in the hot zone. */
  touch(entityId: string): void
  /** Pins an entity so it is never evicted. Useful for player entities, zone anchors. */
  pin(entityId: string): void
  /** Removes a pin, allowing the entity to age out normally. */
  unpin(entityId: string): void
  /** Returns true if the entity is currently considered hot. */
  isHot(entityId: string, maxAgeMs: number): boolean
  /**
   * Removes cold entities from the provided store.
   * Returns the number of entities evicted.
   */
  evict(store: GraphStore, maxAgeMs: number): number
  /** Number of entities currently tracked (hot + recently touched). */
  readonly trackedCount: number
}

export function createHotZone(): HotZone {
  const lastAccess = new Map<string, number>()   // entityId → timestamp ms
  const pinned     = new Set<string>()

  return {
    touch(entityId: string): void {
      lastAccess.set(entityId, Date.now())
    },

    pin(entityId: string): void {
      pinned.add(entityId)
      lastAccess.set(entityId, Date.now())
    },

    unpin(entityId: string): void {
      pinned.delete(entityId)
      lastAccess.delete(entityId)  // clear access time so entity ages naturally from now
    },

    isHot(entityId: string, maxAgeMs: number): boolean {
      if (pinned.has(entityId)) return true
      const last = lastAccess.get(entityId)
      if (last === undefined) return false
      return Date.now() - last <= maxAgeMs
    },

    evict(store: GraphStore, maxAgeMs: number): number {
      const now = Date.now()
      let count = 0

      for (const entity of store.allEntities()) {
        if (pinned.has(entity.id)) continue
        const last = lastAccess.get(entity.id)
        const age = last !== undefined ? now - last : Infinity
        if (age > maxAgeMs) {
          // Only evict if the entity has no connected edges (safe eviction)
          const hasEdges =
            store.edgesFrom(entity.id).length > 0 ||
            store.edgesTo(entity.id).length > 0
          if (!hasEdges) {
            store.removeEntity(entity.id)
            lastAccess.delete(entity.id)
            count++
          }
        }
      }

      return count
    },

    get trackedCount(): number {
      return lastAccess.size
    },
  }
}
