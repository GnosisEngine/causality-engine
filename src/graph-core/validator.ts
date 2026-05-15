// src/graph-core/validator.ts

import { clamp } from '@/common/decimal/index.js'
import type { MetaGraphRegistry } from '@/meta-graph/index.js'

/**
 * Write-time validation for entity and edge operations.
 * All functions are pure — no state mutations. Returns error message arrays.
 * An empty array means the operation is valid.
 *
 * Called by commit.ts before any mutation is applied.
 */

export function validateCreateEntity(
  input: CreateEntityInput,
  graphId: string,
  store: { hasEntity: (id: string) => boolean },
): string[] {
  const errors: string[] = []

  if (!input.id || input.id.trim() === '') {
    errors.push('Entity id must be a non-empty string')
  }

  if (store.hasEntity(input.id)) {
    errors.push(`Entity "${input.id}" already exists in graph "${graphId}"`)
  }

  if (!input.type || input.type.trim() === '') {
    errors.push('Entity type must be a non-empty string')
  }

  return errors
}

export function validateAddEdge(
  input: AddEdgeInput,
  graphId: string,
  store: { hasEdge: (id: string) => boolean; hasEntity: (id: string) => boolean },
  registry: MetaGraphRegistry,
): string[] {
  const errors: string[] = []

  if (!input.id || input.id.trim() === '') {
    errors.push('Edge id must be a non-empty string')
  }

  if (store.hasEdge(input.id)) {
    errors.push(`Edge "${input.id}" already exists in graph "${graphId}"`)
  }

  if (!store.hasEntity(input.sourceId)) {
    errors.push(`Source entity "${input.sourceId}" does not exist in graph "${graphId}"`)
  }

  if (!store.hasEntity(input.targetId)) {
    errors.push(`Target entity "${input.targetId}" does not exist in graph "${graphId}"`)
  }

  if (!registry.hasVerb(input.verbType)) {
    errors.push(`Verb type "${input.verbType}" is not registered in the meta-graph`)
  } else {
    const verb = registry.getVerb(input.verbType)!

    // Domain/range checks (only when verb has restrictions)
    if (verb.domain.length > 0 && store.hasEntity(input.sourceId)) {
      // Domain check deferred to commit where full entity is available
    }

    if (!verb.crossGraphAllowed) {
      // Cross-graph validation is handled by federation/boundary-registry
    }
  }

  const w = input.weight
  if (typeof w !== 'number' || w < 0 || w > 1 || !isFinite(w)) {
    errors.push(`Edge weight must be a number in [0, 1], got ${w}`)
  }

  const confidence = input.confidence ?? 1.0
  if (confidence < 0 || confidence > 1 || !isFinite(confidence)) {
    errors.push(`Edge confidence must be in [0, 1], got ${confidence}`)
  }

  return errors
}

export function validateUpdateEdge(
  edgeId: string,
  input: UpdateEdgeInput,
  store: { hasEdge: (id: string) => boolean; getEdge: (id: string) => VerbEdge | null },
): string[] {
  const errors: string[] = []

  const edge = store.getEdge(edgeId)
  if (!edge) {
    errors.push(`Edge "${edgeId}" does not exist`)
    return errors
  }

  if (edge.authority === 'inference') {
    errors.push(`Inferred edge "${edgeId}" cannot be directly updated — update the source conditions instead`)
  }

  if (input.weight !== undefined) {
    const w = input.weight
    if (typeof w !== 'number' || w < 0 || w > 1 || !isFinite(w)) {
      errors.push(`Edge weight must be a number in [0, 1], got ${w}`)
    }
  }

  if (input.confidence !== undefined) {
    const c = input.confidence
    if (c < 0 || c > 1 || !isFinite(c)) {
      errors.push(`Edge confidence must be in [0, 1], got ${c}`)
    }
  }

  return errors
}

export function validateRemoveEntity(
  id: string,
  store: { hasEntity: (id: string) => boolean; edgesFrom: (id: string) => VerbEdge[]; edgesTo: (id: string) => VerbEdge[] },
): string[] {
  const errors: string[] = []

  if (!store.hasEntity(id)) {
    errors.push(`Entity "${id}" does not exist`)
    return errors
  }

  const incoming = store.edgesTo(id)
  const outgoing = store.edgesFrom(id)

  if (incoming.length > 0 || outgoing.length > 0) {
    errors.push(
      `Entity "${id}" cannot be removed while it has ${incoming.length} incoming and ${outgoing.length} outgoing edges — remove edges first`
    )
  }

  return errors
}
