// src/runtime/worker-scripts/pool-worker-impl.ts

import { parentPort } from 'worker_threads'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../worker-pool.js'

export function runWorkerLoop(): void {
  if (!parentPort) throw new Error('pool-worker must run inside a worker thread')

  parentPort.on('message', async (msg: WorkerInboundMessage) => {
    const { taskId, descriptor } = msg
    try {
      const mod = await import(descriptor.modulePath) as Record<string, unknown>
      const fn = mod[descriptor.functionName]
      if (typeof fn !== 'function') {
        throw new TypeError(`"${descriptor.functionName}" is not a function in ${descriptor.modulePath}`)
      }
      const result = await (fn as (...args: unknown[]) => unknown)(...descriptor.args)
      parentPort!.postMessage({ taskId, ok: true, result } satisfies WorkerOutboundMessage)
    } catch (err) {
      parentPort!.postMessage({
        taskId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies WorkerOutboundMessage)
    }
  })
}