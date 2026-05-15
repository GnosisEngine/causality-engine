// src/math/embeddings/update-queue.ts

/**
 * Update queue for asynchronous embedding propagation to the ANN index.
 *
 * Embedding updates occur synchronously during graph commit on the main thread.
 * The ANN index update is enqueued here and applied asynchronously, keeping
 * the index eventually consistent with the embedding store.
 *
 * The lag is at most one commit cycle — acceptable because nearest() queries
 * are already classified as 'worker' freshness tier (non-realtime).
 *
 * Usage:
 *   const queue = createUpdateQueue(index)
 *   queue.enqueue({ type: 'update', entityId, embedding })  // called on each commit
 *   await queue.flush()  // called by the worker pool between query servicing cycles
 */

export interface UpdateQueue {
  enqueue(message: EmbeddingUpdateMessage): void
  /** Drains all queued messages and applies them to the index. */
  flush(): void
  readonly pending: number
}

export function createUpdateQueue(index: ANNIndex): UpdateQueue {
  const messages: EmbeddingUpdateMessage[] = []

  return {
    enqueue(message: EmbeddingUpdateMessage): void {
      messages.push(message)
    },

    flush(): void {
      while (messages.length > 0) {
        const msg = messages.shift()!
        if (msg.type === 'remove') {
          index.remove(msg.entityId)
        } else if (msg.embedding) {
          index.upsert(msg.entityId, msg.embedding)
        }
      }
    },

    get pending(): number {
      return messages.length
    },
  }
}
