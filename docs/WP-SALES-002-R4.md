# WP-SALES-002-R4 — finalized Core SaaS UX reconciliation

Authoritative DEV base: `3e85031e4258c1c9e7a19279bacbb8a4b6f0e149`. Reviewed Sales SHA `35c337e6de557a55d69d482dccc18ad434126e7f` remains in history. This document is the current migration/deployment reference; R2 and R3 validation records are historical snapshots.

## Current migration queue

Apply the nine current shared Core/Finance migrations first, ending with `20261003000000_core_saas_ux.sql`. The exactly three never-applied Sales migrations now follow it:

1. `20261003100000_canonical_sales_schema.sql`
2. `20261003110000_lastapp_sales_ingestion.sql`
3. `20261003120000_sales_resumable_sync.sql`

Earlier Sales migration versions are superseded and have no active files or execution references. Both Sales PostgreSQL harnesses load finalized Core SaaS UX before Sales. Migration bodies retain reviewed behavior; only the canonical migration filename header changes.

## Compatibility and merge resolution

Finalized Core adds organization contact/address metadata, validated tenant create/update operations and richer audit metadata. Its administrative RPCs remain capability/platform gated, while platform authority does not grant tenant Sales access. Sales continues to use explicit organization/unit mappings and current membership, scope, capability, override and module entitlement gates. Core provisioning does not implicitly supply a Last.app location or operational unit; Sales still requires an active tenant-owned unit and explicit location mapping, failing closed when absent. Sales creates no identities, entitlements, units or Core capabilities.

Shared Core UI, onboarding, tenant administration and Finance changes were incorporated unchanged. The only merge conflict was `vercel.json`: retained DEV's schema and explicit password-reset rewrite, plus Sales API function durations and existing SPA fallback that excludes API paths. The password-reset route remains explicit and API requests are not rewritten to HTML.

CSV ingestion, Last.app semantics, canonical identity/corrections, structured lines, mappings, Bill facts, inbox/replay, change feed, bounded continuation and lease/checkpoint fencing remain unchanged. No Sales redesign or direct mutation of other modules was introduced.

## Deployment boundaries

Repository reconciliation only. No hosted migrations/history/data were modified. Master owns first Sales deployment. PR #6 stays open and draft. Live Last.app remains `PENDING_TOKEN`; a current token, successful live read and Bill monetary verification remain production prerequisites. Automatic inbox draining remains Integrations responsibility.

## Validation and remaining finding

Lint passed with five existing warnings; typecheck and build passed. Focused Sales and Core SaaS UX/authorization/entitlement suites passed 123 tests across 14 files, including the unchanged CSV performance test. All functional CSV assertions passed in the complete suite, including 5,000 accepted rows, zero duplicates/rejections, and EUR 95,823.36.

Full-suite validation remains non-green: the unchanged CSV wall-clock assertion requires less than five seconds and exceeded that threshold in repeated full runs (10.640 s, 5.081 s, 5.458 s, and over five seconds in a direct Vitest run). The first full run also hit the five-second configuration-import timeout; subsequent runs passed that test. Full npm reruns reported 497 passing tests, one CSV timing failure and one skipped hosted test across 42 files. No test limit or Sales implementation was changed to suppress this finding. Master review must assess the timing failure before declaring the deployment gate clean.

The direct diagnostic run used `--no-isolate`. That mode is incompatible with this suite's per-file Finance mocks: it additionally produced thirteen Finance mock failures (`Invalid API key`), alongside the CSV timing failure at 7.093 s (484 passed, fourteen failed, one skipped). It is not accepted as standard validation evidence; the isolated full runs passed those Finance tests. Do not disable isolation for the deployment gate.

Migration-body equality, unique versions, execution order, absent superseded active files/references, and the resolved password-reset/API routes were checked independently. Finalized Core migration/UI/authorization sources match DEV unchanged.
