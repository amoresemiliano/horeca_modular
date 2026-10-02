# WP-SALES-002-R3 — final DEV resync

DEV base incorporated: `9784b9b8a50b3413f1757a39404dceb9b8b14774`. Reviewed Sales SHA `9bdc74fe1bcd6b9b3a629ec90d815ed121141bde` remains in history. The merge completed without conflicts and preserves the shared MainLayout and Core authorization UAT changes.

Core migration `20261002030000_core_module_entitlement_registry.sql` assigns `ventas` to Sales capabilities and `integraciones` to integration capabilities. Sales server actions and read policies continue to use `can_execute_capability_for_org`, whose membership, explicit organization, active-state, scope, override, and entitlement checks remain authoritative. CSV requires upload/process capabilities; health requires Sales view; sync/replay requires integration sync. Sales navigation still requires the enabled Sales module and a Sales read capability. No Core semantics or Sales business behavior were changed.

Both Sales PostgreSQL harnesses now apply the new Core migration before Sales. The unchanged Sales queue remains:

1. `20261002100000_canonical_sales_schema.sql`
2. `20261002110000_lastapp_sales_ingestion.sql`
3. `20261002120000_sales_resumable_sync.sql`

Repository reconciliation only: no migrations were applied and no hosted DEV, production, or MICA data was mutated. Live Last.app remains `PENDING_TOKEN`; live Bill monetary verification remains a production prerequisite. PR #6 must remain open and draft, pending Master deployment/review.

## Validation

Lint passed with eight existing warnings; typecheck and build passed. Full validation passed 492 tests across 42 files, with one hosted test skipped. Focused Sales/Core authorization and navigation suites passed 85 tests across eight files. The initial full run had one CSV performance threshold failure (5.96 seconds versus five seconds), with all functional assertions passing; the focused run and complete rerun passed without changes to that test or Sales implementation.

Reviewed Sales runtime/domain/application/infrastructure/UI and all three Sales migration bodies are unchanged relative to R2. MainLayout and navigation match current DEV. The eleven active migration versions are unique, and the old colliding Sales files/references remain absent. No hosted Sales or live Last.app verification is claimed.
