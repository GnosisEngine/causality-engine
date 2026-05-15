// src/graph-core/types.d.ts

/**
 * An entity node in the graph. All entities across all graph instances conform to this shape.
 * Type-specific data lives in `properties`. Math state (embedding, memoryBundle)
 * is managed by the commit pipeline and should not be written directly by callers.
 */
interface EntityNode {
  id: string
  graphId: string
  /** Registered entity type string. Used for domain/range checks on verb edges. */
  type: string
  properties: PropertyBag
  /** KG embedding vector. Length = GraphInstance.embeddingDim. Managed by commit pipeline. */
  embedding: Float32Array
  /** Incremented on each embedding recalculation. */
  embeddingVer: number
  /** HDC memory bundle. Null when GraphInstance.hdcDim is null. Managed by commit pipeline. */
  memoryBundle: Int8Array | null
  /** Log sequence number at creation. */
  logSeqNum: number
  /** Incremented whenever any edge in this entity's local neighbourhood changes. */
  version: number
}

/**
 * A directed, typed, weighted edge between two entities.
 * Source and target may live in different graph instances (cross-graph edge).
 */
interface VerbEdge {
  id: string
  sourceId: string
  targetId: string
  /** Registered verb type from the MetaGraphRegistry. */
  verbType: string
  /** Fuzzy membership value in [0, 1]. */
  weight: number
  /** T-norm to use for path composition. Inherits from MetaVerb.defaultTNorm if null. */
  tNorm: TNormId | null
  /** Provenance authority level. */
  authority: Authority
  /** Evidence confidence in [0, 1]. Asserted edges are 1.0. Inferred edges < 1.0. */
  confidence: number
  /** Entity id of the asserting agent. Null for system-asserted edges. */
  assertedBy: string | null
  properties: PropertyBag
  /** Log sequence number at which this edge expires. Null = no expiry. */
  expiresAt: number | null
  graphId: string
  logSeqNum: number
}

/**
 * Configuration for a graph instance. Immutable after registration.
 */
interface GraphInstance {
  id: string
  label: string
  mutable: boolean
  temporalIndex: boolean
  persistenceMode: PersistenceMode
  embeddingDim: number
  hdcDim: number | null
  defaultTNorm: TNormId
  epsilon: number
}

/**
 * A structured event log entry. Every graph mutation produces exactly one entry.
 * The log is the canonical persistence artifact — the graph is a projection of it.
 */
interface EventLogEntry {
  /** Monotonically increasing. Global across all graphs. */
  seq: number
  graphId: string
  type: EventType
  /** Type-specific payload. Must be fully JSON-serialisable. */
  payload: Record<string, unknown>
  /** Serialised PRNG state at write time, for deterministic replay. */
  rngState: string
  /** Wall-clock ms. For observability only — not used in replay. */
  wallMs: number
}

/** Input shape for creating an entity. Caller supplies id. */
interface CreateEntityInput {
  id: string
  type: string
  properties?: PropertyBag
}

/** Input shape for adding an edge. Caller supplies id. */
interface AddEdgeInput {
  id: string
  sourceId: string
  targetId: string
  verbType: string
  weight: number
  tNorm?: TNormId | null
  authority?: Authority
  confidence?: number
  assertedBy?: string | null
  properties?: PropertyBag
  expiresAt?: number | null
}

/** Input shape for updating mutable edge fields. */
interface UpdateEdgeInput {
  weight?: number
  confidence?: number
  properties?: PropertyBag
  expiresAt?: number | null
}
