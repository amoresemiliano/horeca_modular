# WP-PROD-001 — Canonical Production execution foundation

Date: 2026-10-15. Branch: `module/production`. Implementation for module review only; no hosted deployment or Inventory posting.

## Source and resync

The three October audit documents are preserved from audit commit `2f9506b9b4e9a60c5038b8a7e81592aa90de0f90`. Origin was fetched and verified: DEV `89abfb07c8d0fb2c45e6865da64515669c2d1057`, remote Production `b710bb9c89d2f2e9ca6573a88a2cbac23dae3b36`. The local branch had already fast-forwarded to the approved DEV base before this execution; reflog confirms that resync. Existing untracked foundation work was preserved and reviewed. No merge to DEV or main.

## Ownership and persistence

`20261015100000_production_execution_foundation.sql` adds Production-owned batches, policies, commands, executions, outputs, explicit consumptions, waste declarations, separate waste confirmations, append-only actions and durable outbox. All parents and children have scoped read RLS; authenticated clients receive SELECT only. Mutations use the single trusted RPC. Execution facts, commands, actions and events reject UPDATE/DELETE through triggers. Batch and policy headers are versioned projections; their previous states remain in actions. Draft lines live in validated batch JSON; confirmed lines become relational output facts.

Core owns identity, memberships, units and entitlements. Catalog owns products/packages/conversions; Inventory owns locations and all stock; Escandallos owns recipe definitions and versions. No legacy rows are imported, and no legacy table privileges are changed. This package adds no operational UX; simple package entry, visible kg, dates, planning intent, history and mobile acceptance remain requirements for WP-PROD-002.

## Commands and authorization

`ProductionService.execute` calls `production_execute_command(request)` with request UUID, organization/unit UUIDs, command, entity UUID, expected revision and body. The RPC derives actor from active session/profile and checks current `can_execute_capability_for_org` before any cache return. It inherits active membership/org/unit, unit scopes, entitlement and revoke precedence from Core. Platform role alone is insufficient.

| Commands | Capability |
| --- | --- |
| create_draft, update_draft, cancel_draft | production.batch.log |
| confirm_batch | production.batch.confirm |
| correct_batch, reverse_batch | production.batch.correct |
| save_policy | production.plan.manage |
| log_waste | production.waste.log |
| confirm_waste | production.waste.confirm |
| scoped table reads | production.view |

All capabilities are OPERATIONAL_UNIT scoped. `supabase/ccr/CCR-PROD-001.sql` is an isolated Core-owned proposal, outside the migration chain. Master must review grants and navigation alignment. Proposed grants give supervisors confirmation/correction, operators logging, planners policy management and consultants view only. No tenant entitlement is enabled. Protected Core source files are untouched.

## Quantities, references and recipes

Canonical persistence uses numeric(20,6); TypeScript helpers use decimal strings and bigint fixed-point arithmetic. Discrete count is a positive integer: 20 × 1.5 kg persists 30.000000 kg. Packages require a version and an owner-approved conversion matching the product base unit. No name parsing, fallback weight or volume-to-mass conversion. Loose output requires explicit owner permission. Confirmation revalidates references and requires equality with the saved normalized draft. Historical snapshots never recalculate after Catalog changes.

The migration deliberately installs `production_owner_reference` as a fail-closed unavailable adapter. Master and domain owners must supply an approved scoped resolver for PRODUCT, PACKAGE, LOCATION and optionally RECIPE. `production_require_reference` validates approved flag, identity, organization, kind, optional unit scope and requested version. Client data cannot supply authoritative conversion snapshots. No tenant can execute against invented masters. The embedded test adapter exists only in an ephemeral test database.

MANUAL_OUTPUT is explicit and records `ingredient_traceability=NOT_IMPLIED`; only declared actual inputs are persisted. RECIPE_REFERENCE requires an approved immutable version snapshot. There is no BOM calculation or theoretical-to-actual deduction. Missing recipe service permits manual output once Catalog/location references are available.

## Planning

Policies persist organization/unit/product, canonicalized location scope, min/max, base unit and revision. Require 0 <= min <= max. Requirements are pure projections, not reservations. Boundary is minimum + 0.25 × (maximum − minimum). Actual below min is CRITICAL; below boundary is NECESSARY; through maximum is OPTIMAL; above maximum is EXCESS. Only the first two suggest maximum − actual. Missing stock is UNKNOWN; negative stock remains visible. The helper compares multiplied integers to avoid boundary rounding. Inventory freshness/version acquisition belongs to WP-PROD-003.

## Idempotency, concurrency and corrections

Commands serialize the scoped request UUID using a transaction advisory lock, hash canonical JSONB, and cache the result. Same request/payload/actor returns the persisted result; a changed payload or actor conflicts. Authorization is rechecked on retry. Row locks and expected revisions reject stale batch/policy updates. Confirmation atomically saves state, execution, outputs/inputs, actions, command result and events; any error rolls everything back.

Confirmed facts cannot be edited. Corrections append a new execution with original execution ID, reason, actor/time and replacement facts; the mutable header points to that execution and advances revision. Reversal appends an empty execution and compensation requirement. Draft cancellation requires a reason and has no output/stock effect. Correcting an execution invalidates confirmation of its outstanding waste declarations.

Waste logging and confirmation are distinct commands/capabilities. PROCESS_ALREADY_CONSUMED must reference an actual input and cannot specify a second removal location. OUTPUT_LOSS references an output and its destination. STOCK_REMOVAL is explicitly independent of process loss. Cumulative confirmed related waste cannot exceed the declared quantity. Only stock-impacting waste emits a removal request; process loss never causes a second deduction.

## Inventory outbox contract

Persisted envelope: event UUID, schema version 1, event type, organization/unit, batch/execution/revision, optional line UUID, command UUID, effective date, server occurrence time, actor, correlation UUID, JSON payload, optional supersedes event UUID and PENDING delivery state. IDs are generated once inside the command transaction; retry returns the same events.

OUTPUT_CONFIRMED carries validated product/package/count/quantity/conversion/destination. CONSUMPTION_DECLARED carries only explicit actuals and source. STOCK_WASTE_CONFIRMED carries classified confirmed waste. EXECUTION_COMPENSATION_REQUIRED identifies the previous execution, original output/input/stock-waste event IDs, reason and replacement execution. Consumers must process compensation and replacement as a coordinated correction, deduplicate by event ID and acknowledge canonical stock references before showing stock availability. This package implements no delivery, acknowledgement, worker, ledger write or successful-posting state. All events remain PENDING. The optional supersedes field is reserved; compensation relationships currently reside explicitly in payload.

## Master deployment and next work packages

Do not apply hosted migrations in this WP. Master must review Core CCR grants/navigation, schema compatibility and migration ordering, implement owner-approved reference adapters, and authorize isolated DEV LAB provisioning. DEV/PROD share Supabase; El Criollo and other real tenants are never fixtures. Do not replay history migrations, reset/reseed or enable real stock effects.

WP-PROD-002 needs reviewed read projections/history pagination and operational mobile UX. WP-PROD-003 needs Catalog/location/recipe contracts, fresh Inventory availability, atomic posting/compensation semantics and receipt/delivery lifecycle. Multi-backend concurrency testing remains a deployment hardening requirement: embedded PostgreSQL proves revision guards and transactional rollback, but cannot prove independent backend races. No production readiness is implied by module review readiness.

## Validation evidence

Isolated tests execute real Core authorization and Production SQL in PGlite with HORECA DEV LAB as the only seeded tenant. Coverage includes denied foreign organization/unit, inactive identities/membership/org/unit, entitlement/capability denial, explicit revoke, platform isolation, registration versus confirmation, retry conflicts, stale updates, atomic rollback, correction/reversal, waste gates and conversions. Unit tests cover exact decimals and all requested planning boundaries.

Initial concurrent quality execution exposed hook/CSV timeouts under load and a BOM in the new migration. The BOM was removed without changing applied migrations. Final quality results are recorded after reruns; existing build warnings include stale Browserslist data and a bundle exceeding 500 kB. No hosted mutations or business-data access occurred.

Final gates: lint PASS (0 errors, 5 existing warnings in Configuracion, Inventory charts/store and Presence); typecheck PASS; build PASS with the warnings above. Full suite rerun via `node node_modules/vitest/vitest.mjs run --maxWorkers=1`: 51 files PASS, 671 tests PASS, 1 skipped, 166.44 s. The explicit Vitest invocation was necessary because the attempted npm argument forwarding did not constrain workers in this environment. Isolated `npm run test:csv-performance`: PASS, 1 test passed / 1 skipped, 5.15 s total, unchanged per-import five-second budget. The full final run includes all 57 Production tests, including missing-session/scope and cross-owner-reference denials added after the earlier 55-test focused run. Vite required process-spawn permission outside the sandbox; all fixtures remained embedded and no hosted database was used.
