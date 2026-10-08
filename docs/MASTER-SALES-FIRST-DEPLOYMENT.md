# Master Sales first deployment

Execution: 2026-10-07 to 2026-10-08, Europe/Madrid. Approved source: module/sales at 28dedab541e132b8169765a6031b62662be87ba6. Starting DEV: 78fb5127793767120e49170f254edbaa92af49f8. Production main remains 4ba2a1e1daec27339ec608dd8bc97511000cae38.

## Database deployment

Target verified as shared HORECA Supabase vmxjqwlfwnphorthhcwu, project horeca_modular_staging. The nine existing Core/Finance migration versions and full hosted schema contract matched the approved source. None of the Sales migrations was recorded or present before deployment.

A consistent single-statement snapshot of all 33 public tables was saved outside Git in the ignored local evidence directory, together with migration history, approved migration source and verified Core/Finance schema. Its backup SHA-256 is a023774959dadd5985a97782d3effa7fc7b106c4cbebbc8f6be58400fdb1ff41. Authentication and storage were outside the Sales migration scope. No reset or global sanitization occurred.

The following migrations were applied exactly once, in this order, with remote history verified after each:

1. 20261003100000_canonical_sales_schema.sql
2. 20261003110000_lastapp_sales_ingestion.sql
3. 20261003120000_sales_resumable_sync.sql

Hosted Sales tables, columns, constraints, policies, grants, indexes, triggers and RPC definitions match a local PostgreSQL replay of the same twelve migrations. All ten Sales tables have RLS enabled. Anonymous and authenticated roles cannot execute trusted canonical/checkpoint/inbox RPCs or write Sales directly. Service-role execution is confined to the server path after application authorization.

## DEV LAB routing and controlled ingestion

HORECA DEV LAB, code HORECA_DEV_LAB, organization f7f6da70-f7dc-4b1a-aa23-f5612174dcbc, is active. The Product Owner's active organization-wide OWNER membership was verified through a real Supabase login. Only DEV LAB received ventas and integraciones entitlements; the latter is required by the existing mapping/sync capabilities.

Created synthetic OperationalUnit d8c0455d-165c-402c-bc9d-5c8778641b97, code DEV_LAB_LOCATION, display name DEV LAB Location, without invented legal metadata. Exactly one active TEST route connects Last.app organization ec6394c7-6609-4b8a-815c-3cac25ca87d0 and location f7408208-75c8-4547-8862-f8748e2afac1, Vegen Digital Location, to that DEV LAB unit. No El Criollo mapping exists.

The actual approved server runtime performed two identical reconciliation syncs over 2026-10-07T15:37:36Z to 2026-10-07T15:37:38Z. The provider page was checked and guarded to contain only validated Tab R003. First run 208cd583-621f-4016-969e-7f34b06e712e created one Sale; second run d150f743-44c2-4299-a719-ae0b6f40b401 reported one unchanged observation and no creates/updates.

Stable canonical Sale 8649ef30-f850-4591-830b-041be08c24cb retains four lines and four sold units. Bill LS283-3 total=7.70 EUR, taxableBase=7.00 EUR, tax=0.70 EUR and paid amount=7.70 EUR. Bill and payment facts reconcile; sourceMoney /100 remains unchanged. Customer/contact/company/employee facts are excluded. Products remain UNMAPPED with no invented Catalog identities or Inventory mutations.

The second run preserved the Sale ID, line IDs and complete line/Bill/payment facts. There is exactly one canonical Sale and one sales_changes record. Observation/provenance refreshed according to the accepted contract. Both runs completed with next_offset=1, no pending IDs, source exhaustion=true, continuation_version=3 and released leases.

## Hosted safety and protected data

Hosted PostgreSQL role/JWT tests used a positive DEV LAB canary and proved DEV LAB/El Criollo/foreign-tenant isolation, anonymous denial and browser canonical-write denial. All security fixtures were transactionally rolled back, including the temporary DEV LAB membership adjustment used to isolate the existing dual-tenant OWNER. No El Criollo row was mutated by the tests.

Hosted rollback-only contract tests verified newer/stale observations, NULL-line preservation, explicit empty-line clearing, canonical and checkpoint atomic rollback, cancellation status, offsets/pending IDs/exhaustion, occupied/stale leases, stale continuation versions, immutable run scope, FAILED versus CONTINUABLE, inbox identity deduplication and exclusive claim. No automatic Sales cron jobs or production webhook subscriptions were enabled; replay remains authorization-gated.

Final comparison of all 33 preexisting tables confirms every original row is unchanged. The only Core additions are one DEV LAB unit, two DEV LAB entitlements and two DEV LAB access-audit entries. El Criollo canonical Sales count=0 unchanged; Sales mappings=0 unchanged; Last.app mapping=none. All Finance and legacy/Inventory rows are unchanged.

## Quality and release gate

Lint passed with the five accepted warnings; typecheck and build passed with existing build warnings. The full test suite passed with one worker: 44 files, 524 tests passed, one skipped. Initial concurrent runs hit test timeouts; no timeout or assertion was weakened. The isolated CSV performance gate passed with samples 1458.82, 1134.88 and 1271.41 ms, maximum 1458.82 ms below the unchanged 5000 ms budget.

Linux CI exposed a preexisting fixture checkout issue: Git normalized the CSV record CRLF separators to LF, changing the frozen file hashes. The fixtures also contain intentional LF within quoted multiline fields. The deployment follow-up marks these fixtures -text and stores their original reviewed bytes, preserving frozen hash vectors and all parsed records. Adapter, mapper, canonical contracts, CSV ingestion code and Sales migration bodies are unchanged.

CI passed for the fixture-byte correction and PR #6 was merged into dev at 4ca956308420b8edc132e86b1971216a64244861. The DEV deployment reached READY at that SHA. Server credentials were configured exclusively for Preview branch dev; Production environment values, deployment and main SHA remained unchanged.

An authenticated deployment smoke check then exposed a native Node ESM startup failure: the deployed Sales handler imported server/salesRuntime without a file extension. The follow-up adds explicit .js extensions throughout the two handlers' local TypeScript dependency graph. No adapter, money, ingestion, authorization or canonical business logic changes. A regression transpiles that graph and starts both handlers directly under native Node, with network access forbidden; the anonymous health request must return 403 DENIED. This covers the deployment resolution behavior that Vite/Vitest transformation had masked.

All five quality commands passed again for the runtime correction: lint, typecheck, test:run (45 files, 525 passed, one skipped), build and test:csv-performance. Existing warning counts, CSV hashes and performance budget remain unchanged.

Production/main promotion, real El Criollo mapping/sync and Production integrator activation remain outside this task. Next WP: SALES DEV UAT + REAL EL CRIOLLO ACTIVATION PREP.
