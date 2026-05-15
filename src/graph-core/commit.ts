// src/graph-core/commit.ts

import { clamp, round } from '@/common/decimal/index.js'
import { createPRNG } from '@/common/prng/index.js'
import { updateEmbedding } from '@/math/embeddings/index.js'
import { bind, remember, createBaseVector } from '@/math/hdc/index.js'
import type { MetaGraphRegistry } from '@/meta-graph/index.js'
import type { GraphStore } from './store.js'
import {
  validateCreateEntity,
  validateAddEdge,
  validateUpdateEdge,
  validateRemoveEntity,
} from './validator.js'

/**
 * Dependencies injected into the commit pipeline.
 * Kept as a plain object so tests can supply minimal fakes.
 */
export interface CommitDeps {
  store: GraphStore
  registry: MetaGraphRegistry
  instance: GraphInstance
  /** Current log sequence number. Incremented by each commit. */
  getSeq: () => number
  advanceSeq: () => number
  /** Serialised PRNG state at commit time. */
  getRngState: () => string
  /** Called with the completed log entry. Implementation provided by persistence layer. */
  appendLog: (entry: EventLogEntry) => void
  /** HDC seed for base vector generation. */
  hdcSeed: number
}

export type CommitResult =
  | { ok: true;  seq: number }
  | { ok: false; errors: string[] }

// ── Entity operations ────────────────────────────────────────────────────────

export function commitCreateEntity(
  input: CreateEntityInput,
  deps: CommitDeps,
): CommitResult {
  const { store, instance, getSeq, advanceSeq, getRngState, appendLog } = deps
  const errors = validateCreateEntity(input, instance.id, store)
  if (errors.length > 0) return { ok: false, errors }

  const seq = advanceSeq()
  const entity: EntityNode = {
    id: input.id,
    graphId: instance.id,
    type: input.type,
    properties: input.properties ?? {},
    embedding: new Float32Array(instance.embeddingDim),
    embeddingVer: 0,
    memoryBundle: instance.hdcDim !== null ? new Int8Array(instance.hdcDim).fill(1) : null,
    logSeqNum: seq,
    version: 0,
  }

  appendLog({
    seq,
    graphId: instance.id,
    type: 'entity:create',
    payload: {
      id: entity.id,
      type: entity.type,
      properties: entity.properties,
    },
    rngState: getRngState(),
    wallMs: Date.now(),
  })

  store.putEntity(entity)
  return { ok: true, seq }
}

export function commitRemoveEntity(
  id: string,
  deps: CommitDeps,
): CommitResult {
  const { store, instance, advanceSeq, getRngState, appendLog } = deps
  const errors = validateRemoveEntity(id, store)
  if (errors.length > 0) return { ok: false, errors }

  const seq = advanceSeq()
  appendLog({
    seq,
    graphId: instance.id,
    type: 'entity:remove',
    payload: { id },
    rngState: getRngState(),
    wallMs: Date.now(),
  })

  store.removeEntity(id)
  return { ok: true, seq }
}

// ── Edge operations ──────────────────────────────────────────────────────────

export function commitAddEdge(
  input: AddEdgeInput,
  deps: CommitDeps,
): CommitResult {
  const { store, registry, instance, advanceSeq, getRngState, appendLog, hdcSeed } = deps
  const errors = validateAddEdge(input, instance.id, store, registry)
  if (errors.length > 0) return { ok: false, errors }

  const metaVerb = registry.getVerb(input.verbType)!
  const seq = advanceSeq()
  const weight = clamp(input.weight)

  const edge: VerbEdge = {
    id: input.id,
    sourceId: input.sourceId,
    targetId: input.targetId,
    verbType: input.verbType,
    weight,
    tNorm: input.tNorm ?? null,
    authority: input.authority ?? 'player',
    confidence: clamp(input.confidence ?? 1.0),
    assertedBy: input.assertedBy ?? null,
    properties: input.properties ?? {},
    expiresAt: input.expiresAt ?? null,
    graphId: instance.id,
    logSeqNum: seq,
  }

  appendLog({
    seq,
    graphId: instance.id,
    type: 'edge:add',
    payload: { ...edge, embedding: undefined },
    rngState: getRngState(),
    wallMs: Date.now(),
  })

  store.putEdge(edge)

  // ── Math updates ────────────────────────────────────────────────────────
  const source = store.getEntity(input.sourceId)
  const target = store.getEntity(input.targetId)

  if (source && target) {
    // Relation embedding: deterministic Float32Array derived from verb type id
    const relationVec = verbTypeToFloat32(input.verbType, instance.embeddingDim, hdcSeed)
    updateEmbedding(source.embedding, relationVec, target.embedding, weight)

    source.embeddingVer++
    target.embeddingVer++

    bumpVersion(store, input.sourceId)
    bumpVersion(store, input.targetId)

    // HDC: encode this relationship into source entity's memory bundle
    if (instance.hdcDim !== null && source.memoryBundle !== null) {
      const srcVec = createBaseVector(input.sourceId, hdcSeed, instance.hdcDim)
      const verbVec = createBaseVector(input.verbType, hdcSeed, instance.hdcDim)
      const tgtVec  = createBaseVector(input.targetId, hdcSeed, instance.hdcDim)
      const experience = bind(bind(srcVec, verbVec), tgtVec)
      source.memoryBundle = remember(source.memoryBundle, experience, weight)
    }

    // If verb is symmetric, auto-assert the reverse edge
    if (metaVerb.symmetric) {
      const reverseId = `${input.id}:sym`
      if (!store.hasEdge(reverseId)) {
        const reverseSeq = advanceSeq()
        const reverseEdge: VerbEdge = {
          ...edge,
          id: reverseId,
          sourceId: input.targetId,
          targetId: input.sourceId,
          authority: 'inference',
          confidence: round(edge.confidence * 0.99),
          logSeqNum: reverseSeq,
        }
        appendLog({
          seq: reverseSeq,
          graphId: instance.id,
          type: 'edge:infer',
          payload: { ...reverseEdge, derivedFrom: [input.id] },
          rngState: getRngState(),
          wallMs: Date.now(),
        })
        store.putEdge(reverseEdge)
        bumpVersion(store, input.targetId)
        bumpVersion(store, input.sourceId)
      }
    }
  }

  return { ok: true, seq }
}

export function commitUpdateEdge(
  edgeId: string,
  input: UpdateEdgeInput,
  deps: CommitDeps,
): CommitResult {
  const { store, instance, advanceSeq, getRngState, appendLog } = deps
  const errors = validateUpdateEdge(edgeId, input, store)
  if (errors.length > 0) return { ok: false, errors }

  const existing = store.getEdge(edgeId)!
  const seq = advanceSeq()

  const delta: Partial<VerbEdge> = {}
  if (input.weight    !== undefined) delta.weight     = clamp(input.weight)
  if (input.confidence !== undefined) delta.confidence = clamp(input.confidence)
  if (input.properties !== undefined) delta.properties = input.properties
  if (input.expiresAt  !== undefined) delta.expiresAt  = input.expiresAt

  const updated: VerbEdge = { ...existing, ...delta }

  appendLog({
    seq,
    graphId: instance.id,
    type: 'edge:update',
    payload: { id: edgeId, delta },
    rngState: getRngState(),
    wallMs: Date.now(),
  })

  store.putEdge(updated)
  bumpVersion(store, existing.sourceId)
  bumpVersion(store, existing.targetId)
  return { ok: true, seq }
}

export function commitRemoveEdge(
  edgeId: string,
  deps: CommitDeps,
): CommitResult {
  const { store, instance, advanceSeq, getRngState, appendLog } = deps
  const edge = store.getEdge(edgeId)
  if (!edge) return { ok: false, errors: [`Edge "${edgeId}" does not exist`] }

  const seq = advanceSeq()
  appendLog({
    seq,
    graphId: instance.id,
    type: 'edge:remove',
    payload: { id: edgeId },
    rngState: getRngState(),
    wallMs: Date.now(),
  })

  store.removeEdge(edgeId)
  bumpVersion(store, edge.sourceId)
  bumpVersion(store, edge.targetId)
  return { ok: true, seq }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function bumpVersion(store: GraphStore, entityId: string): void {
  const entity = store.getEntity(entityId)
  if (entity) store.putEntity({ ...entity, version: entity.version + 1 })
}

/**
 * Derives a deterministic Float32Array relation embedding from a verb type id and seed.
 * Uses the same djb2 hash as HDC base vectors but produces Float32 values in [-1, 1].
 */
function verbTypeToFloat32(verbType: string, dim: number, seed: number): Float32Array {
  let hash = 5381
  for (let i = 0; i < verbType.length; i++) {
    hash = Math.imul(hash, 33) ^ verbType.charCodeAt(i)
  }
  hash = (hash >>> 0) ^ seed
  const rng = createPRNG(hash)
  const vec = new Float32Array(dim)
  for (let i = 0; i < dim; i++) vec[i] = rng.nextFloat() * 2 - 1
  return vec
}
