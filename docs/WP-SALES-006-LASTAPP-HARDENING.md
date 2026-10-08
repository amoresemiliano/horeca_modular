# WP-SALES-006 — Last.app preventive rate control and payment validation

Date: 2026-10-08. HORECA Modular, Sales & Revenue, branch `module/sales`. Baseline: `5d0d3eab8bd7668e373822cf92878aeccdfbd70b`. Scope: Reporting reads; B1 and B2 implementation only.

**B1 = CLOSED; B2 = CLOSED; B3 = OPEN. READY_TO_REQUEST_LASTAPP_PRODUCTION = NO.** Closure describes the tested implementation on this branch, not a hosted deployment. Master must deploy `20261008100000_lastapp_request_budgets.sql` before integrating/activating this code. This WP does not apply it or merge into DEV/main. Until then the new adapter fails closed if the coordinator RPC is unavailable.

## Preventive admission and runtime assumptions

Every HTTP attempt, including retries, first acquires an atomic PostgreSQL reservation through the service-role-only `sales_reserve_lastapp_request` RPC. All Vercel instances must use the same Supabase database and this coordinator. There is no process-local limiter fallback, browser state, queue table or provider-429-based admission. Missing configuration, unavailable RPC, exhausted admission attempts or expired permits prevent dispatch.

Buckets contain a SHA-256 token digest, context kind and entity key. Location reporting endpoints share the token/location bucket across Tabs, Bills and Payments; organization-context reads share token/organization; `/organizations` uses a distinct token-wide discovery bucket. Unrelated entities can progress independently. Raw credentials and provider payloads are not stored in rate state.

The database clock and row lock serialize reservations. Creation/eviction uses a bounded advisory lock; existing buckets use individual row locks. General admission spacing is **402 ms**; discovery spacing is **2,000 ms**. A permit expires less than **1,000 ms** after the caller started the reservation, including RPC latency, and is checked synchronously immediately before HTTP fetch. Late or unused reservations are never refunded.

This deliberately conservative pacing enforces **15 attempts/second and 1,500 attempts/rolling 10 minutes per token/entity**, rather than maximizing throughput. For a window of length W, dispatch jitter under 1,000 ms gives at most `ceil((W + 1000) / 402)` starts: at most **5/second** and **1,496/10 minutes**. Discovery reservations 2,000 ms apart, with less than 1,000 ms dispatch delay, yield starts at least 1,000 ms apart. The guarantee concerns outbound HTTP starts, not provider arrival timestamps; network transit is outside the runtime's control. It assumes a normally advancing authoritative database clock and the synchronous freshness-check/fetch boundary. Independent databases or an alternate client bypassing this coordinator are outside the guarantee.

Admission is bounded to eight claims, each RPC to at most one second or the remaining deadline. PostgreSQL lock wait is limited to 500 ms. Denials wait for the returned delay with cancellation/deadline bounds; impossible waits fail immediately. State is capped at 4,096 buckets; creation removes at most 128 buckets inactive longer than ten minutes and fails closed at capacity. No indefinite polling or growing local queue exists. Server sync supplies an absolute monotonic deadline; HTTP timeouts are capped by it. Existing retry count, exponential backoff and greater Retry-After remain in force, with each retry requiring a new permit.

## Payment validation and atomicity

Before computing totals or constructing the canonical Sale, validate every payment, including deleted entries:

- Nonempty stable string ID, without surrounding whitespace, maximum 200 characters; unique across the complete Bill observation.
- String `billId` equal to the containing Bill ID.
- Nonempty string type, maximum 100 characters.
- ISO creation timestamp with a valid calendar date/time.
- Explicit boolean `deleted`; missing, null and other types are rejected.
- Amount and optional tip are finite safe integer minor units. Supplied tip must also be nonnegative; null is invalid.

Identical and conflicting duplicate IDs both reject the entire observation. There is no deduplication guess, skipped foreign relationship or assumed deletion default. Deleted payments retain the existing minimized source fact and are excluded from paid amount; only `deleted === false` contributes. Existing single, distinct multiple and partial payments remain supported. Tip remains separate; no cash-change arithmetic is introduced. `sourceMoney` and its `/100` conversion are unchanged: 770 → 7.70 EUR; 300 + 470 → 7.70 EUR.

Invalid observation tests exercise the sync use case and assert that `persist` is never called. No canonical mutation begins. Existing transactional ingestion/correction/checkpoint rollback tests remain unchanged and run with the full regression suite. No payment metadata allowlist expansion, processor metadata, customer/cardholder data or raw payload persistence is added. Canonical Sale/SaleLine contracts, Tab identity, Bill duplicate protection, cancellation semantics, idempotency, resumability, routing, CSV and security boundaries remain intact.

## Validation evidence

Tests use sanitized existing fixtures, controlled clocks, mocked HTTP responses and local PGlite replay of the exact migration. The local replay substitutes only the database clock expression; production RPC accepts no caller-provided timestamp. Burst, 1,501-request sustained rolling windows, discovery spacing, separate shared callers, independent entities, retries, Retry-After, deadlines, stale permits, cancellation, coordinator failures and browser privilege denial are covered. No live provider request or hosted database mutation is used for these tests. Local SQL tests establish the admission algorithm; shared hosted deployment remains a Master release prerequisite, not a claimed multi-instance live probe.

All five required checks passed: `npm run lint` (zero errors, five existing warnings), `npm run typecheck`, `npm run test:run` (47 files, 570 passed, one skipped; one worker), `npm run build` (existing Browserslist/chunk warnings), and `npm run test:csv-performance` (unchanged performance budget; one passed, one skipped). No CSV fixture/hash, assertion budget or canonical schema contract was changed.

## Remaining gate and boundaries

B3 remains the sole open audit blocker: Product Owner/manual verification of Integrator ID, exact selected capabilities, enabled webhook events, callback URL, product name, logo, description and relevant support/contact metadata. For selected notifications verify envelope and publicly reachable authorized delivery; for polling-only operation verify subscriptions are disabled. No portal evidence is inferred from local tests.

No approval email, portal configuration, real webhook registration, live canonical ingestion, El Criollo write, migration application, mapping change, scheduled sync, DEV merge or main promotion occurs in this WP. Master must deploy the prepared coordinator migration and integrate this branch before using its safeguards in hosted runtime. Restaurant activation gates from WP-SALES-004 remain separate.
