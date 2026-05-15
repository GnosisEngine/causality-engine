// src/runtime/worker-scripts/pool-worker.js
//
// Plain ESM JavaScript — intentionally NOT TypeScript.
// This file is the worker thread entry point. Node loads it as .js before any
// loader hook is active, so it must be syntax-valid JS. It then attempts to
// register the tsx ESM hook so that subsequent dynamic imports can load TypeScript
// modules. If tsx is already active (e.g. Vitest loaded it in the parent process
// via --loader), registration is skipped — .ts imports will work either way.

import { register } from 'node:module'

try {
  register('tsx/esm', import.meta.url)
} catch {
  // tsx already registered (Vitest environment) or not needed (compiled JS tasks).
  // Either way, continue — dynamic imports will work or fail on their own terms.
}

const { runWorkerLoop } = await import('./pool-worker-impl.ts')
runWorkerLoop()