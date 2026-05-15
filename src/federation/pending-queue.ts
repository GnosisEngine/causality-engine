// src/federation/pending-queue.ts

/**
 * Pending boundary write queue.
 *
 * When a cross-graph edge has a non-null temporalOffset, the write is not
 * delivered to the target graph immediately. Instead it is enqueued here with
 * a deliverAt tick. On each server tick, processTick() is called and any
 * writes whose deliverAt <= currentTick are delivered via the applyWrite callback.
 *
 * The queue is serialisable so it can be included in checkpoints and survive
 * server restarts. Undelivered writes are never lost.
 *
 * One tick = one log sequence number (per the Phase 4 decision).
 * temporalOffset is expressed in ticks.
 */

/** A write that has been deferred for future delivery to a target graph. */
export interface PendingBoundaryWrite {
  /** The edge to be written when deliverAt is reached. */
  edgePayload: VerbEdge
  /** The global tick at which this write should be delivered. */
  deliverAt: number
  /** Transmission fidelity from the BoundaryVerb. Used to discount DS beliefs on delivery. */
  fidelity: number
}

/** Called when a pending write is ready to deliver. */
export type DeliverFn = (write: PendingBoundaryWrite) => void

export interface PendingQueue {
  /**
   * Enqueues a write for future delivery.
   * deliverAt = currentTick + temporalOffset.
   */
  enqueue(edgePayload: VerbEdge, currentTick: number, temporalOffset: number, fidelity: number): void
  /**
   * Delivers all writes whose deliverAt <= currentTick.
   * Calls deliver for each in ascending deliverAt order.
   */
  processTick(currentTick: number, deliver: DeliverFn): void
  /** Total number of writes waiting to be delivered. */
  readonly size: number
  /** Serialises the queue for checkpoint storage. */
  serialize(): PendingBoundaryWrite[]
  /** Restores queue state from a checkpoint. */
  restore(writes: PendingBoundaryWrite[]): void
}

export function createPendingQueue(): PendingQueue {
  // Sorted ascending by deliverAt for efficient processing
  let queue: PendingBoundaryWrite[] = []

  function insertSorted(write: PendingBoundaryWrite): void {
    let i = queue.length
    while (i > 0 && queue[i - 1].deliverAt > write.deliverAt) i--
    queue.splice(i, 0, write)
  }

  return {
    enqueue(edgePayload, currentTick, temporalOffset, fidelity): void {
      if (temporalOffset < 0) throw new RangeError('temporalOffset must be non-negative')
      insertSorted({
        edgePayload: { ...edgePayload },
        deliverAt: currentTick + temporalOffset,
        fidelity,
      })
    },

    processTick(currentTick, deliver): void {
      while (queue.length > 0 && queue[0].deliverAt <= currentTick) {
        deliver(queue.shift()!)
      }
    },

    get size(): number { return queue.length },

    serialize(): PendingBoundaryWrite[] {
      return queue.map(w => ({ ...w, edgePayload: { ...w.edgePayload } }))
    },

    restore(writes: PendingBoundaryWrite[]): void {
      queue = []
      for (const w of writes) insertSorted({ ...w, edgePayload: { ...w.edgePayload } })
    },
  }
}
