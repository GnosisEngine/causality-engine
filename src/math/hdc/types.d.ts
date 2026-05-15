// src/math/hdc/types.d.ts

/**
 * A binary hyperdimensional vector. Values are strictly +1 or -1.
 * Length equals the hdcDim configured for the graph instance.
 */
type HDCVector = Int8Array

/**
 * A superposed HDC bundle representing an entity's accumulated relational memory.
 * Stored binarised (±1) on EntityNode.memoryBundle.
 * Retrieval fidelity degrades as more experiences are superposed — this is correct behaviour.
 */
type HDCBundle = Int8Array
