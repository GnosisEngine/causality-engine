// src/common/types/index.d.ts
/**
 * Cross-system type declarations for the Causality Engine.
 * These types are referenced across multiple systems and belong to no single one.
 * Per-system types live in each system's own types.d.ts.
 */

/** Provenance authority for VerbEdge assertions. Ordered lowest to highest: world < inference < player < system. */
type Authority = 'world' | 'inference' | 'player' | 'system';

/** Registered t-norm identifiers for fuzzy edge composition. */
type TNormId = 'minimum' | 'product' | 'lukasiewicz' | 'drastic';

/** Policy function identifier. Kebab-case with optional parameters, e.g. 'geometric(0.5)', 'cutoff(3)'. */
type PolicyFnId = string;

/** Graph instance persistence strategy. */
type PersistenceMode = 'full' | 'log-only' | 'ephemeral';

/** Query freshness tier for two-tier routing in the query interface. */
type FreshnessTier = 'cached' | 'graph' | 'worker';

/** Conflict resolution policy for Dempster-Shafer combination near K=0. */
type ConflictPolicy = 'retain-authority' | 'blend' | 'escalate';

/** Directionality of a boundary verb between graph instances. */
type BoundaryDirection = 'one-way' | 'both';

/** All mutation event types recorded in the event log. */
type EventType =
  | 'entity:create'
  | 'entity:remove'
  | 'edge:add'
  | 'edge:update'
  | 'edge:remove'
  | 'edge:infer'
  | 'embedding:update'
  | 'hdc:update';

/** Serialisable key-value properties bag used on EntityNode and VerbEdge. */
type PropertyBag = Record<string, string | number | boolean | null>;
