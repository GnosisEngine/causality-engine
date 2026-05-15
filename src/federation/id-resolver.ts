// src/federation/id-resolver.ts

/**
 * Cross-graph entity ID resolution.
 *
 * Cross-graph references use qualified IDs of the form "graphId:entityId".
 * The colon separator is safe because entity IDs are UUID v4 strings
 * (hex + hyphens only — no colons).
 *
 * Resolution happens at query time, not write time. Write-time validation
 * only checks that the target graphId is registered in the DAG.
 */

/** A function that looks up an entity by id within a specific graph. */
export type EntityLookup = (entityId: string, graphId: string) => EntityNode | null

/** Parsed form of a (possibly qualified) entity reference. */
export interface ParsedRef {
  graphId: string | null   // null when the reference is unqualified
  entityId: string
}

/**
 * Produces a qualified reference string: "graphId:entityId".
 * Entity IDs must not contain colons.
 */
export function qualify(entityId: string, graphId: string): string {
  if (entityId.includes(':')) {
    throw new Error(`Entity ID "${entityId}" must not contain colons — use UUID v4`)
  }
  return `${graphId}:${entityId}`
}

/**
 * Parses a (possibly qualified) entity reference.
 * "graphId:entityId" → { graphId, entityId }
 * "entityId"         → { graphId: null, entityId }
 */
export function parseRef(ref: string): ParsedRef {
  const colonIdx = ref.indexOf(':')
  if (colonIdx === -1) return { graphId: null, entityId: ref }
  return {
    graphId: ref.slice(0, colonIdx),
    entityId: ref.slice(colonIdx + 1),
  }
}

/**
 * Resolves a (possibly qualified) entity reference using the provided lookup.
 * Unqualified references are resolved in the context graph.
 * Returns null if the entity does not exist.
 */
export function resolveRef(
  ref: string,
  contextGraphId: string,
  lookup: EntityLookup,
): EntityNode | null {
  const { graphId, entityId } = parseRef(ref)
  return lookup(entityId, graphId ?? contextGraphId)
}

/**
 * Validates a cross-graph edge at write time.
 * Checks that the source and target graph IDs are registered.
 * Returns an array of error strings (empty = valid).
 */
export function validateCrossGraphRef(
  sourceGraphId: string,
  targetGraphId: string,
  registeredGraphIds: Set<string>,
): string[] {
  const errors: string[] = []
  if (!registeredGraphIds.has(sourceGraphId)) {
    errors.push(`source graph "${sourceGraphId}" is not registered`)
  }
  if (!registeredGraphIds.has(targetGraphId)) {
    errors.push(`target graph "${targetGraphId}" is not registered`)
  }
  if (sourceGraphId === targetGraphId) {
    errors.push('Cross-graph edge source and target must be in different graphs')
  }
  return errors
}
