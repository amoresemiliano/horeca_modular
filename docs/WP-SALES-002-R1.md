# WP-SALES-002-R1 — Resumable Last.app synchronization

## Scope and baseline

The accepted WP-SALES-002 architecture remains intact. Sales fetched and merged current `origin/dev` (`c66db32`, two commits beyond the previous dev resync) into `module/sales`; current shared UI changes were preserved. No changes were merged into dev/main, and no shared DEV migrations were applied. Core authorization/schema, API money interpretation, CSV ingestion, webhook authenticity/inbox/replay, canonical identity and internal analytical change feed are unchanged.

Master must deploy `20261002120000_sales_resumable_sync.sql` after the two reviewed Sales migrations. This migration adds only Sales-owned checkpoint/lease state and trusted Sales RPCs. It extends the existing status convention with `CONTINUABLE`. Browser mutations and checkpoint RPC execution remain denied.

## Logical run and bounded slices

`POST /api/sales`, action `sync`, starts one immutable tenant/location/OperationalUnit/date-window/mode run. The existing maximum 31-day UI/server interval remains. Each execution slice processes at most 100 Tabs and fetches at most two list pages, with a 30-second application deadline and the existing bounded read timeouts/retries. Reaching a healthy slice bound returns `CONTINUABLE`, not `FAILED`.

Continuation uses the same documented Last.app `offset`/`limit` contract. The checkpoint stores the next offset, a bounded list of pending Tab IDs from the fetched page, whether the source returned a short/empty final page, cumulative processing counters and a monotonic continuation version. A page is durably saved before its Tabs are processed. An interruption midway through a page resumes its saved IDs rather than skipping them or calculating an offset from money or mutable ticket fields.

For each Tab, `sales_commit_sync_tab` verifies the leased run and observation's tenant/location/unit/Tab identity, calls the accepted atomic canonical write, and advances the pending list/cumulative counters in the **same PostgreSQL transaction**. A failed child write rolls back both canonical changes and checkpoint advancement. A lost HTTP acknowledgement after commit cannot duplicate Sales or processing counters when retried. Invalid mapping facts advance as a rejected observation; transport/persistence errors retain the current Tab for recovery.

Whole-window completion requires an exhausted source and no pending IDs. A full 100-element last page requires a subsequent bounded empty-page observation before completion is asserted. A completed window with rejected records remains terminal `PARTIAL`, with `continuationRequired: false`; ordinary completion is `COMPLETED`. Actual errors produce `FAILED` with the exact checkpoint intact, so an explicit retry can resume.

Claiming a slice requires organization + logical run + expected continuation version. A stale/repeated request returns current public progress without executing another slice. An active five-minute lease prevents concurrent execution; abandoned leases can be reclaimed. Every page, Tab commit and finalization verifies the lease, fencing off an old worker after reclaim. Run scope is immutable at the database boundary. Current Core `integrations.sync.trigger` authorization is re-evaluated on every server continuation; the server loads the saved window/location, checks the active tenant mapping and never accepts client offsets or scope overrides. A changed OperationalUnit mapping fails closed.

Pre-R1 runs have no trustworthy checkpoint: their existing evidence is preserved and `checkpoint_enabled` is false. They cannot be silently continued from an invented offset. Restart their explicit window as a new logical run; canonical idempotency prevents duplicate Sales. New R1 runs have checkpoints enabled by default.

Offset pagination is not a source snapshot: Last.app does not document a stable snapshot/cursor or updated-since guarantee. Saved in-page IDs prevent loss from a local interruption; externally inserted/deleted/reordered list entries can still move across later page boundaries. Overlapping reconciliation and targeted authoritative refresh remain necessary. No unsupported cursor or ordering guarantee is asserted.

## Client behavior and recovery

The client transparently invokes action `continue` with only `{ organizationId, runId, version }` while the user-triggered operation remains active. Public results contain run ID, status, cumulative counters, continuation version and `continuationRequired`; lease tokens, pending IDs, raw offsets and page mechanics are not returned. An occupied lease advises a five-second wait without making Last.app calls. Actual failures stop automatic continuation and offer a resume action. Leaving the component/changing tenant stops further client continuation; the current server slice still finishes or becomes reclaimable.

The UI shows processing count and continuing/completed/pending states and offers `Reanudar sincronización pendiente` after a reload or failure. If the start response is lost, health retrieves the existing server-owned run for recovery. Health reads only public run fields, excluding internal lease/checkpoint details. CSV remains a separate permanent UI action and uses the same canonical model/write boundary.

Future historical backfill uses the same primitive: choose an explicit historical interval/location, start the logical run, then continue/recover bounded slices until terminal completion. Larger histories can use multiple explicit windows. No production history or live Last.app request was executed for R1.

## INTEGRATION CHANGE REQUEST — automatic inbox worker

No reusable automatic inbox drain trigger was found in the current dev server surface. Automatic triggering/scheduling remains a runtime/09 Integrations deployment prerequisite; this WP introduces no scheduler framework.

The extraction contract is:

1. A trusted Integrations runtime selects the oldest retryable Sales Last.app inbox receipt within its explicit organization (RECEIVED, FAILED, or PROCESSING with an expired lease), bounded by its own work/time budget.
2. Invoke existing authenticated `POST /api/sales` action `replay` with `{ organizationId, eventId }` under an identity authorized by current Core `integrations.sync.trigger`.
3. Sales claims the event through `sales_claim_lastapp_event`, refreshes authoritative Tab/Bill details, applies canonical idempotency and finalizes PROCESSED/FAILED. Integrations must not claim the event separately before replay: replay owns that lease.
4. Repeat within the runtime budget; on failure defer to its bounded retry policy. Another worker or a duplicate invocation cannot apply a processed event again. A stopped worker's lease remains reclaimable.

Sales retains inbox states/identity/claim, interpretation, replay and canonical persistence. Integrations may own discovery of pending work, trigger, scheduling and orchestration. A service-role key alone does not substitute for the existing caller authorization contract; a future unattended actor must be explicitly provisioned/authorized through Core. Webhook Bearer validation, unique source event identity, tenant/location routing, receipt acknowledgement and authoritative refresh are preserved.

## Deployment prerequisites and money limitation

The historical token previously returned 401 and was **not retried**. Production activation requires a current server-side Last.app v2 integrator/Reporting token, tenant-scoped mappings and Master-controlled migration deployment. Never paste credentials into chat or client configuration. Preserve the documented WP-SALES-002 limitation: successful live Bill verification is required before activation. The single API minor-unit conversion boundary and financial interpretation remain unchanged; no Spanish CSV parsing is used for API numbers.

## Verification

Tests exercise a 235-Tab logical window over three bounded slices, exact offsets 0/100/200, terminal completion, cumulative counts, stale/repeated requests, pending-page recovery, actual failure restart, interrupted lease reclaim, old-worker fencing, tenant/scope immutability and browser RPC denial. The client orchestration is checked for transparent continuation and stopping on failure/navigation. Existing API/webhook, PostgreSQL and CSV 799-row / 14,980.70 EUR tests remain part of validation.

The full suite passed 39 files / 461 tests, with one hosted test skipped by configuration. The subsequent two additional atomic-rollback/time-bound regressions passed the focused seven-test R1 suite. Lint passes with eight existing warnings; typecheck and production build pass. No live API success is claimed.
