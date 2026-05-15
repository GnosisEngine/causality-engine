// src/persistence/checkpoint.ts

import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  encodeFloat32Array,
  decodeFloat32Array,
  encodeInt8Array,
  decodeInt8Array,
} from '@/common/serialization/index.js'
import type { GraphStore } from '@/graph-core/index.js'

/** Serialised form of an EntityNode for checkpoint storage. */
export interface SerializedEntity {
  id: string
  graphId: string
  type: string
  properties: PropertyBag
  embedding: string        // base64 Float32Array
  embeddingVer: number
  memoryBundle: string | null  // base64 Int8Array or null
  logSeqNum: number
  version: number
}

/** Serialised form of a VerbEdge for checkpoint storage. */
export interface SerializedEdge {
  id: string
  sourceId: string
  targetId: string
  verbType: string
  weight: number
  tNorm: TNormId | null
  authority: Authority
  confidence: number
  assertedBy: string | null
  properties: PropertyBag
  expiresAt: number | null
  graphId: string
  logSeqNum: number
}

export interface CheckpointData {
  seq: number
  graphId: string
  entities: SerializedEntity[]
  edges: SerializedEdge[]
  rngState: string
  checksum: string
}

// ── Serialisation helpers ────────────────────────────────────────────────────

function serializeEntity(entity: EntityNode): SerializedEntity {
  return {
    id: entity.id,
    graphId: entity.graphId,
    type: entity.type,
    properties: entity.properties,
    embedding: encodeFloat32Array(entity.embedding),
    embeddingVer: entity.embeddingVer,
    memoryBundle: entity.memoryBundle ? encodeInt8Array(entity.memoryBundle) : null,
    logSeqNum: entity.logSeqNum,
    version: entity.version,
  }
}

function deserializeEntity(s: SerializedEntity): EntityNode {
  return {
    id: s.id,
    graphId: s.graphId,
    type: s.type,
    properties: s.properties,
    embedding: decodeFloat32Array(s.embedding),
    embeddingVer: s.embeddingVer,
    memoryBundle: s.memoryBundle ? decodeInt8Array(s.memoryBundle) : null,
    logSeqNum: s.logSeqNum,
    version: s.version,
  }
}

function serializeEdge(edge: VerbEdge): SerializedEdge {
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    verbType: edge.verbType,
    weight: edge.weight,
    tNorm: edge.tNorm,
    authority: edge.authority,
    confidence: edge.confidence,
    assertedBy: edge.assertedBy,
    properties: edge.properties,
    expiresAt: edge.expiresAt,
    graphId: edge.graphId,
    logSeqNum: edge.logSeqNum,
  }
}

function computeChecksum(data: Omit<CheckpointData, 'checksum'>): string {
  const content = JSON.stringify(data)
  return createHash('sha256').update(content).digest('hex')
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Saves a checkpoint of the current store state to disk. */
export async function saveCheckpoint(
  store: GraphStore,
  seq: number,
  rngState: string,
  graphId: string,
  dataDir: string,
): Promise<void> {
  const checkpointDir = join(dataDir, 'checkpoints', graphId)
  await mkdir(checkpointDir, { recursive: true })

  const entities = [...store.allEntities()].map(serializeEntity)
  const edges    = [...store.allEdges()].map(serializeEdge)

  const body: Omit<CheckpointData, 'checksum'> = { seq, graphId, entities, edges, rngState }
  const checksum = computeChecksum(body)
  const checkpoint: CheckpointData = { ...body, checksum }

  const filename = String(seq).padStart(10, '0') + '.json'
  const filePath = join(checkpointDir, filename)
  await writeFile(filePath, JSON.stringify(checkpoint), 'utf8')
}

/**
 * Loads the most recent checkpoint for a graph.
 * Returns null if no checkpoints exist.
 * Throws if the checksum of the found checkpoint does not match.
 */
export async function loadLatestCheckpoint(
  graphId: string,
  dataDir: string,
): Promise<CheckpointData | null> {
  const checkpointDir = join(dataDir, 'checkpoints', graphId)

  let files: string[]
  try {
    files = await readdir(checkpointDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }

  const jsonFiles = files.filter(f => f.endsWith('.json')).sort()
  if (jsonFiles.length === 0) return null

  const latest = jsonFiles[jsonFiles.length - 1]
  const raw = await readFile(join(checkpointDir, latest), 'utf8')
  const checkpoint = JSON.parse(raw) as CheckpointData

  // Verify checksum
  const { checksum, ...body } = checkpoint
  const expected = computeChecksum(body)
  if (checksum !== expected) {
    throw new Error(
      `Checkpoint checksum mismatch for graph "${graphId}" seq ${checkpoint.seq}. ` +
      `File may be corrupted.`
    )
  }

  return checkpoint
}

/** Restores a checkpoint's entities and edges into the provided store. */
export function restoreCheckpoint(checkpoint: CheckpointData, store: GraphStore): void {
  for (const s of checkpoint.entities) {
    store.putEntity(deserializeEntity(s))
  }
  for (const s of checkpoint.edges) {
    store.putEdge(s as VerbEdge)
  }
}

/** Lists available checkpoint sequence numbers for a graph, ascending. */
export async function listCheckpoints(
  graphId: string,
  dataDir: string,
): Promise<number[]> {
  const checkpointDir = join(dataDir, 'checkpoints', graphId)
  try {
    const files = await readdir(checkpointDir)
    return files
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => parseInt(f.replace('.json', ''), 10))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}
