# WP-SALES-002-R2 — repository reconciliation

Authoritative DEV incorporated: `d5a555e21b57d4df4cafd6e6293f9aa5cbf7a07a` (newer than the requested `543a957`). The reviewed Sales commit `4fe9b13b7f02c56ac6e1e984c6d9c276d22142fd` remains in history. DEV merged without conflicts; no Sales business behavior or Core contract was changed.

## Current deployment order

Apply all current Core/Finance prerequisites first, including Core tenant administration, secure provisioning, and legacy fail-closed migrations. The three never-applied Sales migrations now follow them:

1. `20261002100000_canonical_sales_schema.sql`
2. `20261002110000_lastapp_sales_ingestion.sql`
3. `20261002120000_sales_resumable_sync.sql`

The old colliding Sales versions are SUPERSEDED. Their active files and execution references have been replaced. Both Sales PostgreSQL harnesses load the complete current shared migration chain before Sales.

## Compatibility and boundaries

Sales continues to authorize authenticated server requests through `can_execute_capability_for_org` and explicit organization context. The Core primitive retains active membership, capability overrides, operational-unit scopes, and module entitlement checks. Current Core provisioning creates memberships through its trusted boundary; Sales does not provision identities or add capabilities. Sales RLS continues to use the same primitive, and trusted persistence/checkpoint RPCs remain unavailable to browsers. Current Core administration and legacy fail-closed changes are incorporated unchanged.

CSV, canonical Last.app Tab identity, corrections, mapping, Bill provenance, inbox leases/replay, and bounded resumable synchronization retain their reviewed implementation. Only migration filenames, the migration header, documentation, and PostgreSQL setup references change in R2.

This task performs no hosted database deployment or mutation. Master owns first Sales migration application. PR #6 must remain open and draft. Live Last.app remains `PENDING_TOKEN`; live Bill monetary verification is required before production activation. Automatic inbox draining remains an Integrations responsibility.

## Validation

Lint passed with eight existing warnings; typecheck and build passed. The complete suite passed 490 tests across 42 files, with one hosted test skipped. Focused Sales integration passed all 63 tests across six files, including CSV fixture/idempotency, synthetic Last.app semantics, trusted PostgreSQL persistence, webhook behavior, and resumable 235-Tab execution. Embedded PostgreSQL ran the current shared migrations before renamed Sales migrations. No live Last.app or hosted Sales verification is claimed.

The migration bodies match the reviewed Sales SHA byte-for-byte after line-ending normalization and the canonical migration header filename replacement. All ten active migration versions are unique. No old active Sales filename references remain.
