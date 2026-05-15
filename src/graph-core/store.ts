// src/graph-core/store.ts

/**
 * In-memory storage for entities and edges within a single graph instance.
 * All access is synchronous. Paging of cold entities is handled externally
 * by runtime/hot-zone.ts — the store itself holds whatever is currently hot.
 *
 * Indexes maintained:
 *   entities     — entityId → EntityNode
 *   edges        — edgeId → VerbEdge
 *   bySource     — sourceId → Set<edgeId>
 *   byTarget     — targetId → Set<edgeId>
 *   byVerbType   — verbType → Set<edgeId>
 */

export interface GraphStore {
  // ── Entities ─────────────────────────────────────────────────────────────
  getEntity(id: string): EntityNode | null
  hasEntity(id: string): boolean
  putEntity(entity: EntityNode): void
  removeEntity(id: string): void
  entityCount(): number
  allEntities(): IterableIterator<EntityNode>

  // ── Edges ─────────────────────────────────────────────────────────────────
  getEdge(id: string): VerbEdge | null
  hasEdge(id: string): boolean
  putEdge(edge: VerbEdge): void
  removeEdge(id: string): void
  edgeCount(): number
  allEdges(): IterableIterator<VerbEdge>
  /** All edges where sourceId === id. */
  edgesFrom(sourceId: string): VerbEdge[]
  /** All edges where targetId === id. */
  edgesTo(targetId: string): VerbEdge[]
  /** All edges of a specific verb type. */
  edgesByVerb(verbType: string): VerbEdge[]
  /** All edges between source and target of a specific verb type. */
  edgesBetween(sourceId: string, targetId: string, verbType?: string): VerbEdge[]
}

export function createGraphStore(): GraphStore {
  const entities = new Map<string, EntityNode>()
  const edges = new Map<string, VerbEdge>()
  const bySource = new Map<string, Set<string>>()
  const byTarget = new Map<string, Set<string>>()
  const byVerbType = new Map<string, Set<string>>()

  function indexEdge(edge: VerbEdge): void {
    if (!bySource.has(edge.sourceId)) bySource.set(edge.sourceId, new Set())
    bySource.get(edge.sourceId)!.add(edge.id)

    if (!byTarget.has(edge.targetId)) byTarget.set(edge.targetId, new Set())
    byTarget.get(edge.targetId)!.add(edge.id)

    if (!byVerbType.has(edge.verbType)) byVerbType.set(edge.verbType, new Set())
    byVerbType.get(edge.verbType)!.add(edge.id)
  }

  function deindexEdge(edge: VerbEdge): void {
    bySource.get(edge.sourceId)?.delete(edge.id)
    byTarget.get(edge.targetId)?.delete(edge.id)
    byVerbType.get(edge.verbType)?.delete(edge.id)
  }

  return {
    getEntity: (id) => entities.get(id) ?? null,
    hasEntity: (id) => entities.has(id),
    putEntity: (entity) => { entities.set(entity.id, entity) },
    removeEntity: (id) => { entities.delete(id) },
    entityCount: () => entities.size,
    allEntities: () => entities.values(),

    getEdge: (id) => edges.get(id) ?? null,
    hasEdge: (id) => edges.has(id),
    putEdge(edge) {
      const existing = edges.get(edge.id)
      if (existing) deindexEdge(existing)
      edges.set(edge.id, edge)
      indexEdge(edge)
    },
    removeEdge(id) {
      const edge = edges.get(id)
      if (edge) { deindexEdge(edge); edges.delete(id) }
    },
    edgeCount: () => edges.size,
    allEdges: () => edges.values(),

    edgesFrom: (sourceId) =>
      [...(bySource.get(sourceId) ?? [])].map(id => edges.get(id)!),

    edgesTo: (targetId) =>
      [...(byTarget.get(targetId) ?? [])].map(id => edges.get(id)!),

    edgesByVerb: (verbType) =>
      [...(byVerbType.get(verbType) ?? [])].map(id => edges.get(id)!),

    edgesBetween: (sourceId, targetId, verbType) => {
      const fromSource = bySource.get(sourceId) ?? new Set<string>()
      return [...fromSource]
        .map(id => edges.get(id)!)
        .filter(e => e.targetId === targetId && (!verbType || e.verbType === verbType))
    },
  }
}
