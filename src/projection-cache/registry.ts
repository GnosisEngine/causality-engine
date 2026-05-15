// src/projection-cache/registry.ts

import type { GraphStore } from '@/graph-core/index.js'

/**
 * A derived component type definition.
 *
 * Derived components are pre-computed projections of graph-relational state
 * that the tick loop can read without graph traversal. They are invalidated
 * when graph edges matching their dependency manifest change.
 *
 * The derive function receives the entity id and the store, and returns the
 * current component value. It is called lazily when a dirty component is read.
 */
export interface ComponentType<T = unknown> {
  /** Unique identifier for this component type. */
  id: string
  /**
   * Verb types that trigger invalidation. When an edge of any of these verb
   * types changes (for any entity), this component is marked dirty on the
   * source and target entities of that edge.
   */
  dependsOn: string[]
  /**
   * How many milliseconds a dirty component may remain un-re-derived.
   * 0 = re-derive on every read when dirty (fully lazy).
   * Higher values allow brief staleness in exchange for fewer re-derivations.
   * Default: 1000.
   */
  dirtyIntervalMs: number
  /**
   * Produces the component value from current graph state.
   * Called when the component is dirty and dirtyIntervalMs has elapsed.
   */
  derive: (entityId: string, graphId: string, store: GraphStore) => T
}

export interface ComponentTypeRegistry {
  /** Registers a component type. Throws on duplicate id. */
  register<T>(type: ComponentType<T>): void
  /** Returns a registered component type, or null. */
  get(id: string): ComponentType | null
  /** All registered component type ids. */
  ids(): string[]
  /**
   * Returns the ids of all component types that depend on any of the given verb types.
   * Used by dirty-flags to identify which components to invalidate.
   */
  affectedBy(verbTypes: string[]): string[]
}

export function createComponentTypeRegistry(): ComponentTypeRegistry {
  const types = new Map<string, ComponentType>()
  // Inverted index: verbType → Set<componentTypeId>
  const verbIndex = new Map<string, Set<string>>()

  return {
    register<T>(type: ComponentType<T>): void {
      if (types.has(type.id)) {
        throw new Error(`Component type "${type.id}" is already registered`)
      }
      types.set(type.id, type as ComponentType)
      for (const verbType of type.dependsOn) {
        if (!verbIndex.has(verbType)) verbIndex.set(verbType, new Set())
        verbIndex.get(verbType)!.add(type.id)
      }
    },

    get: (id) => types.get(id) ?? null,
    ids: () => [...types.keys()],

    affectedBy(verbTypes: string[]): string[] {
      const result = new Set<string>()
      for (const vt of verbTypes) {
        for (const compId of verbIndex.get(vt) ?? []) result.add(compId)
      }
      return [...result]
    },
  }
}
