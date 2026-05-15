// src/runtime/worker-pool.ts

import { Worker } from 'worker_threads'
import { cpus } from 'os'

/** Priority lane for task submission. Critical tasks are dispatched before background tasks. */
export type TaskPriority = 'critical' | 'background'

/** A serialisable task descriptor submitted to the worker pool. */
export interface PoolTaskDescriptor {
  /** Absolute URL string of the module to import in the worker. */
  modulePath: string
  /** Name of the exported async function to call. */
  functionName: string
  /** Arguments to pass to the function. Must be structured-cloneable. */
  args: unknown[]
}

/** Message sent from pool to worker. */
export interface WorkerInboundMessage {
  taskId: number
  descriptor: PoolTaskDescriptor
}

/** Message sent from worker back to pool. */
export type WorkerOutboundMessage =
  | { taskId: number; ok: true; result: unknown }
  | { taskId: number; ok: false; error: string }

/** Public interface of the worker pool. */
export interface WorkerPool {
  submit<T = unknown>(descriptor: PoolTaskDescriptor, priority: TaskPriority): Promise<T>
  queueDepth(): number
  terminate(): Promise<void>
}

/**
 * Fixed-size worker thread pool with two priority lanes.
 *
 * Critical tasks (AI decisions, player-facing query results) are dispatched
 * before background tasks (diffusion evaluation, checkpoint writes) regardless
 * of submission order.
 *
 * Pool size defaults to max(2, cpuCount - 1) to leave one core for the main thread.
 *
 * Each worker is a persistent Node.js Worker thread running pool-worker.ts.
 * Workers dynamically import the target module and call the named function,
 * making all registered modules available as pool tasks without pre-registration.
 *
 * All task arguments and return values must be structured-cloneable.
 */

// Entry point is a plain .js file that registers tsx then imports the TS implementation.
// No execArgv needed — tsx is registered inside the worker via module.register().
const WORKER_SCRIPT = new URL('./worker-scripts/pool-worker.js', import.meta.url)
const DEFAULT_POOL_SIZE = Math.max(2, cpus().length - 1)

interface PendingTask {
  taskId: number
  descriptor: PoolTaskDescriptor
  priority: TaskPriority
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

interface WorkerSlot {
  worker: Worker
  busy: boolean
}

let nextTaskId = 1

export function createWorkerPool(size = DEFAULT_POOL_SIZE): WorkerPool {
  const slots: WorkerSlot[] = []
  const criticalQueue: PendingTask[] = []
  const backgroundQueue: PendingTask[] = []
  const pending = new Map<number, PendingTask>()
  let terminated = false

  // Initialise workers
  for (let i = 0; i < size; i++) {
    const worker = new Worker(WORKER_SCRIPT)
    const slot: WorkerSlot = { worker, busy: false }

    worker.on('message', (msg: WorkerOutboundMessage) => {
      const task = pending.get(msg.taskId)
      if (!task) return
      pending.delete(msg.taskId)
      slot.busy = false

      if (msg.ok) {
        task.resolve(msg.result)
      } else {
        task.reject(new Error(msg.error))
      }

      dispatch()
    })

    worker.on('error', (err: unknown) => {
      if (terminated) return
      slot.busy = false
      const error = err instanceof Error ? err : new Error(String(err))
      for (const [id, task] of pending) {
        task.reject(error)
        pending.delete(id)
      }
      dispatch()
    })

    slots.push(slot)
  }

  function dispatch(): void {
    if (terminated) return

    const freeSlot = slots.find(s => !s.busy)
    if (!freeSlot) return

    const task = criticalQueue.shift() ?? backgroundQueue.shift()
    if (!task) return

    freeSlot.busy = true
    pending.set(task.taskId, task)
    freeSlot.worker.postMessage({ taskId: task.taskId, descriptor: task.descriptor } satisfies WorkerInboundMessage)
  }

  return {
    submit<T>(descriptor: PoolTaskDescriptor, priority: TaskPriority): Promise<T> {
      if (terminated) return Promise.reject(new Error('WorkerPool has been terminated'))

      return new Promise<T>((resolve, reject) => {
        const taskId = nextTaskId++
        const task: PendingTask = {
          taskId,
          descriptor,
          priority,
          resolve: resolve as (value: unknown) => void,
          reject,
        }
        if (priority === 'critical') {
          criticalQueue.push(task)
        } else {
          backgroundQueue.push(task)
        }
        dispatch()
      })
    },

    queueDepth(): number {
      return criticalQueue.length + backgroundQueue.length
    },

    async terminate(): Promise<void> {
      terminated = true
      const rejection = new Error('WorkerPool terminated')
      for (const task of [...criticalQueue, ...backgroundQueue]) task.reject(rejection)
      for (const task of pending.values()) task.reject(rejection)
      criticalQueue.length = 0
      backgroundQueue.length = 0
      pending.clear()  // clear before terminating workers to prevent double-rejection from worker error events
      await Promise.all(slots.map(s => s.worker.terminate()))
    },
  }
}