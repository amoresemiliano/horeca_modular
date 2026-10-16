# Master Production foundation integration

Date: 2026-10-16. Owner: Master/Core. Scope: WP-PROD-001 + CCR-PROD-001, shared HORECA Supabase `vmxjqwlfwnphorthhcwu`. This is a foundation integration, not operational Production activation.

## Source and reconciliation

Requested source: `61ddc8f29a9ee6847243ff3193bf0d6d0c78a168`. Requested DEV base: `6c36175a69a43efb5b25e14c23b12e3d8d0acb0b`. Both remote refs matched on initial fetch. Production merged that DEV without conflicts. During execution another session advanced DEV to `980e41ac61588d75e571eda94a5aa97926aa43fa` with approved access-portal hover/layout changes; these were also merged without conflicts. Login/access sources and Sales runtime remain identical to that newer DEV. Finance and existing Core security changes are preserved. Main is excluded from this integration.

## Ownership and approval

Production owns batches, planning intent, immutable executions, output/declared-consumption/waste facts, correction chains, commands and outbox. Catalog owns product/package/conversion masters, Inventory owns stock and locations, and Escandallos owns recipes/yields/costing. There are no cross-domain business writes, owner adapters, Inventory delivery workers or legacy imports.

Master approves the proposed least-privilege capability matrix:

| Capability | Organization role templates |
| --- | --- |
| production.view | OWNER, MANAGER, PRODUCTION, COOK_COST_SHEET_MANAGER, CONSULTANT |
| production.plan.manage | OWNER, MANAGER, COOK_COST_SHEET_MANAGER |
| production.batch.confirm | OWNER, MANAGER |
| production.batch.correct | OWNER, MANAGER |
| production.waste.confirm | OWNER, MANAGER |

All seven Production capabilities, including the two existing logging capabilities, are `OPERATIONAL_UNIT` scoped and require `produccion`. Existing logging grants are unchanged. Registration, confirmation, correction, waste logging and waste confirmation retain distinct capability identities. Platform/holding roles receive no Production grant. CONSULTANT gains only Production read access. Explicit member revocation still wins.

Core owns the new migration, constants, role metadata, navigation and client authorization alignment. The client requires explicit Production entitlement and a selected unit with organization-wide membership or an explicit matching unit scope. Server mutations and reads continue using the unchanged canonical SQL evaluator; client metadata never grants server access. The legacy Production screen is not replaced here, and legacy table denial is preserved. WP-PROD-002 must implement canonical read/history UX before operational use.

## Migration review and application

Applied exactly once, in this order:

1. `20261015090000_core_production_capabilities.sql`
2. `20261015100000_production_execution_foundation.sql`

The Core migration is a canonical forward migration, not an execution of `supabase/ccr/CCR-PROD-001.sql`. It checks active canonical role/logging prerequisites, rejects unexpected preexisting new capabilities and adds only approved registry grants. The proposal is retained as historical review material.

Hosted history contained 14 migrations through `20261008110000_lastapp_location_lifecycle`; no Production tables or new Production capabilities existed. The new versions therefore append in chronological order without modifying an applied migration. The Production migration was reviewed unchanged from the approved source: it creates only Production structures/functions, scoped RLS, append-only protections and the unavailable reference adapter. No existing canonical table is dropped/renamed/reset/reseeded.

Deployment used a separate linked staging directory containing the exact applied history plus these two reviewed files. Immediately before mutation, history, migration hashes, existing logging grants and protected fingerprints were rechecked. CLI dry-run selected exactly these two migrations with empty seeds/roles lists. After application, history contained exactly 16 expected entries. The original 14 entries and old migration files remain unchanged.

## Hosted authorization and fail-closed evidence

`tests/integration/production_hosted_authorization.sql` ran against hosted PostgreSQL and passed 68 checks. The test uses transaction-local session claims and `SET LOCAL ROLE authenticated` to exercise actual deployed SQL/RLS under browser privileges; it does not claim signed end-user login coverage.

Coverage includes the seven-capability matrix for OWNER, MANAGER, PRODUCTION, COOK_COST_SHEET_MANAGER, CONSULTANT and platform-only identity; foreign organization, wrong/missing unit, inactive membership/profile/unit, missing entitlement, revoke-over-grant, denied commands and all ten Production tables' RLS/SELECT-only grants. Actual default INSERT attempts fail with `42501`. Every read policy is verified to be exclusively the scoped `production.view` predicate. No synthetic Production facts are inserted to demonstrate cross-tenant reads; predicate/gate verification complements empty-table reads, and populated cross-tenant isolation remains covered by embedded integration tests.

Otherwise-authorized OWNER and PRODUCTION logging commands fail with `OWNER_CONTRACT_UNAVAILABLE`. Operator confirmation, platform-only execution, foreign tenant/unit execution and execution without entitlement are denied before reference resolution. No placeholder product, package, recipe or location master is created. The owner adapter remains unchanged, unavailable and inaccessible directly to browser roles. Legacy `produccion_registros`, `empleados` and `recetas` remain denied to authenticated browser reads.

Authorization-only synthetic state consists of six temporary Auth/profile identities, five memberships, two units, one DEV LAB entitlement setting, five unit scopes, a platform assignment and temporary overrides. All tenant-scoped state belongs exclusively to existing HORECA DEV LAB; platform identity has no tenant membership. These records and helper functions/tables exist only inside one transaction ending with `ROLLBACK`. Existing identities, tenant entitlements and other state were restored without cleanup deletes against persisted data. Auth-user fingerprints match before/after.

Separate anonymous REST verification denied both table SELECT and command RPC with `42501`. The final protected-data comparison passed. Sanitized results are committed in [the evidence artifact](master-production-foundation-evidence.json).

## Protected data and integration boundaries

El Criollo real-data mode was verified from the existing shared release record (`realDataMode: ACTIVE`) and the permanent shared-production operating rules. No Production entitlement was enabled for El Criollo. Fingerprints/counts of all 44 preexisting public tables outside the explicitly changed capability registry/grants were identical before deployment, afterward and after rollback authorization checks, including Finance, Sales, Core memberships/entitlements and legacy data. No business rows were exported into the repository. Detailed fingerprints remain in ignored local evidence; the committed evidence contains their aggregate digest.

All ten new Production tables remain empty across all organizations. El Criollo Production rows are zero, Finance/Sales are unchanged and no batch is created. The applied migration does not replace or map an owner adapter.

Outbox supports `OUTPUT_CONFIRMED`, `CONSUMPTION_DECLARED`, `STOCK_WASTE_CONFIRMED` and `EXECUTION_COMPENSATION_REQUIRED`. Delivery state is constrained to `PENDING`; delivery, acknowledgements and Inventory posting remain unimplemented. There are zero Inventory writes.

## Idempotency, concurrency and remaining work

Review confirms the scoped request UUID/advisory transaction lock, canonical JSONB fingerprint, actor binding, authorization-before-cache, row locks and expected revisions. Atomic confirmation persists immutable facts, command result and outbox together. Embedded tests cover same-payload retries, changed-payload conflicts, stale revisions, rollback and immutable correction/reversal chains. Multi-backend race validation: **PENDING FOR HOSTED HARDENING**. No independent-backend race PASS is claimed.

WP-PROD-002 may build the canonical mobile entry/read/history/planning UX with visible package conversion, effective date, explicit manual-output mode and pending posting. Execution must stay gated while owner contracts are unavailable; read-only navigation must not reactivate legacy browser access.

WP-PROD-003 requires approved scoped Catalog/product/package/conversion and Inventory/location contracts, optional immutable recipe/version references from Escandallos, fresh Inventory projections, atomic posting/compensation and delivery receipts, plus safe independent-backend concurrency hardening. No adapters or posting contracts are invented by this integration.

## Quality

Final validation: lint PASS (zero errors, five existing warnings); typecheck PASS; full `npm run test:run -- --maxWorkers=1` PASS (52 files, 681 tests passed, one skipped, 165.27 seconds); build PASS (27.32 seconds); CSV performance PASS (one passed, one skipped, 5.82 seconds total with its unchanged per-import budget). Windows `npm.cmd` preserves the worker argument correctly.

Existing warning baseline: five lint warnings in Configuracion, Inventory and Presence; stale Browserslist and a bundle over 500 kB. Vite also reports plugin timings on this machine. Sandbox process creation produced `spawn EPERM`; permitted reruns execute local tests/build only. An initial full suite exposed two existing Sales timeouts and a Core registry test that had not replayed the newly approved CCR. The registry fixture now loads the canonical Core migration. Test time limits and Sales source remain unchanged; the final complete rerun passes all three previously failing tests.
