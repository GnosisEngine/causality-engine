// src/runtime/tests/fixtures/tasks.ts
// Simple structured-cloneable tasks used by worker-pool tests.
// Must use only ESM-importable, serialisable operations.

export async function add(a: number, b: number): Promise<number> {
  return a + b
}

export async function multiply(a: number, b: number): Promise<number> {
  return a * b
}

export async function throwError(message: string): Promise<never> {
  throw new Error(message)
}

export async function delay(ms: number): Promise<string> {
  return new Promise(resolve => setTimeout(() => resolve(`done:${ms}`), ms))
}
