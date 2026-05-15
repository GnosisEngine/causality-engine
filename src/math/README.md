A few things that came up during this phase worth flagging before Phase 3:

The DeGroot aperiodicity issue is a design note that belongs in the spec and in the buildTrustMatrix docs — any caller constructing influence matrices for the political graph needs to know that purely mutual influence without any self-weight oscillates rather than converges. The Friedkin-Johnsen model (which includes stubbornness) sidesteps this entirely, so for the political graph that's probably the default path anyway.

The hnswlib-node situation is clean — the NaiveANNIndex in hnsw.ts is correct at all scales and the factory function is the single swap point for when native compilation is available. Nothing else in the codebase needs to change.

The tsconfig "types": ["node"] fix is notable — Husky's pre-commit runs tsc --noEmit which is stricter than Vitest's transform pipeline. Worth keeping that in mind for Phase 3 onwards: always check tsc passes before considering a phase done, not just the test suit