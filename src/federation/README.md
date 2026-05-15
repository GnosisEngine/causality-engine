A few design notes. The pending-queue keeps its internal array sorted on every insert via insertSorted, making processTick an O(k) shift operation where k is the number of due writes rather than requiring a sort pass on each tick. For typical game cadences where writes are rare relative to ticks, this is the right trade-off. If the queue grows large the binary search variant of insertSorted is a straightforward upgrade.

The boundary-registry stores bidirectional verbs as two separate entries keyed by direction — this means isAllowed is always an O(1) map lookup and there's no directional logic in the hot path. The BoundaryVerb type lives as a concrete module export following the Phase 5 convention, not in types.d.ts.

The id-resolver intentionally does no caching. Resolution is called at query time and the lookup function is injected, so callers (the query layer in Phase 9) control the lookup strategy — direct store access for hot entities, page-in for cold ones.

Ready for Phase 8 — projection cache and runtime/hot-zone.