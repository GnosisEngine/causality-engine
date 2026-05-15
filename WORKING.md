# Causality Engine — Working State

## Conventions (always apply)
- Language: TypeScript strict mode, ESM, Node >= 22
- Imports: path alias `@/` → `src/`, always use `.js` extension on imports
- Barrel files (`index.ts`) cannot use path aliases — use relative `./` imports only
- Each system folder: `index.ts` (barrel), `types.d.ts`, source files, `tests/`, `benchmarks/` (if needed)
- Cross-system types live in `common/types/index.d.ts`
- All disk writes go through `src/data/` — owned exclusively by `persistence/`
- Test runner: Vitest (globals on). Run `npm test` to verify.
- Benchmark runner: `common/bench`. Run scenarios with `npx tsx src/path/to/bench.ts`.
- PRNG: always use `@/common/prng/index.js` — never `Math.random()` in any write path
- Write-path arithmetic: always use `@/common/decimal/index.js` — never raw float ops on weights/embeddings

## Implementation Order
Phase 1  — Common utilities:     `common/types`, `common/prng`, `common/decimal`, `common/serialization`, `common/bench`
Phase 2  — Math primitives:      `math/fuzzy`, `math/policy`, `math/dempster-shafer`, `math/hdc`, `math/embeddings`, `math/diffusion`, `math/index.ts`
Phase 3  — Meta-graph:           `meta-graph/validator`, `taxonomy`, `stratification`, `registry`, `index.ts`
Phase 4  — Graph core:           `graph-core/store`, `validator`, `commit`, `index.ts`
Phase 5  — Runtime utilities:    `runtime/worker-pool`, `runtime/tick`
Phase 6  — Persistence:          `persistence/event-log`, `checkpoint`, `replay`, `index.ts`
Phase 7  — Federation:           `federation/dag`, `boundary-registry`, `id-resolver`, `pending-queue`, `index.ts`
Phase 8  — Projection cache:     `projection-cache/registry`, `dirty-flags`, `deriver`, `runtime/hot-zone`, `index.ts`
Phase 9  — Query interface:      `query/traversal`, `scoring`, `nearest`, `belief`, `router`, `index.ts`
Phase 10 — Top-level wiring:     `runtime/index.ts`, `src/index.ts`

## Current Phase
**Phase 4 — Graph core** — NOT STARTED

## Completed
**Phase 1 — Common utilities** ✓ 41/41 tests passing
- `common/types/index.d.ts` — cross-system type declarations
- `common/prng/` — xoshiro128** seeded PRNG, serialisable state
- `common/decimal/` — write-path rounding, WEIGHT_PRECISION=6
- `common/serialization/` — Float32Array, Int8Array, Map, PropertyBag encode/decode
- `common/bench/` — benchmark runner with p99 threshold pass/fail

**Phase 2 — Math primitives** ✓ 110/110 tests passing
- `math/fuzzy/` — minimum, product, lukasiewicz, drastic t-norms; composePath (epsilon uses <=); resolveExclusion
- `math/policy/` — geometric, harmonic, cutoff policy functions; verifyPolicy simulation
- `math/dempster-shafer/` — createBelief, unknownBelief, discountBelief; dempsterCombine, computeK; retainAuthority, blend, escalate
- `math/hdc/` — createBaseVector (djb2+PRNG), bind (element-wise multiply), remember (superpose+binarize), recall (cosine similarity)
- `math/embeddings/` — updateEmbedding (TransE, mutates in place); score, nearest, buildQueryVector; NaiveANNIndex (hnswlib-node deferred); createUpdateQueue
- `math/diffusion/` — buildTrustMatrix (row-normalised, self-weight for isolated nodes); deGroot, friedkinJohnsen
- `math/index.ts` — namespace barrel (Fuzzy, Policy, DS, HDC, Embeddings, Diffusion)

**Phase 3 — Meta-graph** ✓ 44/44 tests passing
- `meta-graph/types.d.ts` — MetaVerb, MetaTaxonomyEdge, InferenceRule, InferenceCondition, StratificationResult
- `meta-graph/validator.ts` — validateMetaVerb, validateTaxonomyEdge, validateInferenceRule (pure, stateless)
- `meta-graph/taxonomy.ts` — getSubtypes (transitive BFS), isSubtypeOf, getInverse, getExclusions, getImplications, impliesEdgesToRules
- `meta-graph/stratification.ts` — Kahn's topological sort over negation dependency graph; cycle detection
- `meta-graph/registry.ts` — createMetaGraphRegistry: stateful store, transaction-per-registration, re-stratifies on every change

## Open Decisions
- OQ-05 (HNSW): use `hnswlib-node`. Files: `math/embeddings/hnsw.ts`, `math/embeddings/update-queue.ts`. Naive scan fallback during index warm-up.
- OQ-06: dirty cycle intervals declared per component type; undeclared types flagged by linter; conservative 1s default fallback.
- Benchmark thresholds (OQ-01, OQ-02): empirically validated via bench suite, not hardcoded.
- Replay determinism (OQ-08): `toFixed(6)` rounding in all write-path arithmetic; validated by `persistence/benchmarks/replay-determinism.bench.ts`.
- DS conflict resolution (OQ-03): `retain-authority`, `blend`, `escalate` — extensible registry.
- Temporal offset (OQ-04): expressed in ticks. 1 log seq = 1 tick.
- Vitest config: updated to discover tests in both `tests/` and `src/**/tests/`.
- DeGroot aperiodicity: pure symmetric cycles without self-weight oscillate — callers must include self-edges. Document in buildTrustMatrix JSDoc before Phase 4.

## Next Session Starting Point
Begin Phase 4 — Graph core.
`graph-core/store.ts` first: in-memory entity and edge storage (Map-backed).
Then: `graph-core/validator.ts` (write-time checks against MetaGraphRegistry), `graph-core/commit.ts` (atomic commit: validate → log append → mutate → embedding update → HDC update), `graph-core/index.ts`.

## Architectural Convention (added Phase 5)
**Types crossing module boundaries must be concrete module exports.**
Do NOT put in types.d.ts any type that another module will import.
- types.d.ts: internal-only types, documentation, ambient augmentation
- Source .ts files: all exported interfaces and type aliases
- Reason: NodeNext resolution treats ambient globals and module exports of the same
  name as incompatible types. This caused a multi-iteration debugging session in Phase 5.
