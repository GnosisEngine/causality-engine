// src/persistence/event-log.ts

import { appendFile, mkdir, open } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

/** Flush strategy for an event log. */
export type FlushStrategy = 'immediate' | 'batched' | 'none'

export interface EventLogOptions {
  flushStrategy: FlushStrategy
  /** For 'batched': auto-flush when buffer reaches this size. Default: 50. */
  batchSize?: number
}

export interface EventLog {
  /** Buffers an entry. May flush automatically depending on strategy. */
  append(entry: EventLogEntry): void
  /** Explicitly flushes the buffer to disk. */
  flush(): Promise<void>
  /** Number of entries currently buffered but not yet written. */
  readonly buffered: number
  /** Total entries appended (including flushed). */
  readonly total: number
  /** Reads all entries from disk (flushes buffer first). */
  readAll(): AsyncGenerator<EventLogEntry>
  /** Reads entries with seq >= fromSeq (flushes buffer first). */
  readFrom(fromSeq: number): AsyncGenerator<EventLogEntry>
  /** Flushes and closes the log. No further appends after this. */
  close(): Promise<void>
}

export async function createEventLog(
  graphId: string,
  dataDir: string,
  options: EventLogOptions = { flushStrategy: 'batched', batchSize: 50 },
): Promise<EventLog> {
  const logDir = join(dataDir, 'logs')
  await mkdir(logDir, { recursive: true })
  const logPath = join(logDir, `${graphId}.ndjson`)

  const buffer: string[] = []
  let total = 0
  let closed = false

  async function writeBuffer(): Promise<void> {
    if (buffer.length === 0) return
    const chunk = buffer.join('\n') + '\n'
    buffer.length = 0
    await appendFile(logPath, chunk, 'utf8')
    if (options.flushStrategy === 'immediate') {
      // fsync to guarantee durability before returning
      const fh = await open(logPath, 'a')
      try { await fh.datasync() } finally { await fh.close() }
    }
  }

  function tryAutoFlush(): void {
    const batchSize = options.batchSize ?? 50
    if (
      options.flushStrategy === 'immediate' ||
      (options.flushStrategy === 'batched' && buffer.length >= batchSize)
    ) {
      writeBuffer().catch(err => {
        console.error(`[EventLog:${graphId}] flush error:`, err)
      })
    }
  }

  async function* readAllEntries(): AsyncGenerator<EventLogEntry> {
    await writeBuffer()
    let fileExists = true
    try {
      const stream = createReadStream(logPath, { encoding: 'utf8' })
      const rl = createInterface({ input: stream, crlfDelay: Infinity })
      for await (const line of rl) {
        const trimmed = line.trim()
        if (trimmed) yield JSON.parse(trimmed) as EventLogEntry
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      // File doesn't exist yet — log is empty, yield nothing
    }
  }

  return {
    append(entry: EventLogEntry): void {
      if (closed) throw new Error(`EventLog for "${graphId}" is closed`)
      buffer.push(JSON.stringify(entry))
      total++
      tryAutoFlush()
    },

    async flush(): Promise<void> {
      await writeBuffer()
    },

    get buffered(): number { return buffer.length },
    get total(): number { return total },

    readAll(): AsyncGenerator<EventLogEntry> {
      return readAllEntries()
    },

    async *readFrom(fromSeq: number): AsyncGenerator<EventLogEntry> {
      for await (const entry of readAllEntries()) {
        if (entry.seq >= fromSeq) yield entry
      }
    },

    async close(): Promise<void> {
      closed = true
      await writeBuffer()
    },
  }
}

/** Returns the filesystem path for a graph's event log. */
export function eventLogPath(graphId: string, dataDir: string): string {
  return join(dataDir, 'logs', `${graphId}.ndjson`)
}
