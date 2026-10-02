# WP-SALES-002 — Last.app v2 canonical ingestion

## Delivery and evidence

Sales was resynchronized from `fa8069219375508b6c74d73c0a92c5c1d4516bf9` with
`origin/dev` at `026274e2aef21e94c6afe972f3c19674af3510e5` (2 ahead / 16 behind before preserving the five pending WP-SALES-001 correction files).
The Core hosted-test conflict follows current dev. AuthContext supplies explicit `organizationId`; tenantContext and Core capabilities are unchanged.

No Sales migration was applied to shared DEV. Master must review and deploy
`20261002000000_canonical_sales_schema.sql` followed by `20261002010000_lastapp_sales_ingestion.sql`, after the current Core/Finance prerequisites.
The unapplied pre-Core Sales migration was replaced. No merge into dev/main occurred.

Read-only discovery found a historical Express/MySQL prototype at sibling `last_API/backend`, with a private `.env` containing `LAST_TOKEN`. This is discovery evidence, not product architecture. No sibling files were changed or copied into Git. A minimal live GET `/organizations` using that local credential returned **401**, so successful live reads were not verified. Prerequisite: a valid integrator v2 token, authorized for the mapped source location, configured securely as server `LAST_APP_TOKEN`.

## Authority and discrepancies

Contract inspected 2026-10-02: [official Last.app v2 documentation and embedded OpenAPI](https://developers.last.app/docs/index.html).
The downloaded document's embedded `__redoc_state.spec.data` is OpenAPI 3.0, API version 2.0.0; it is the same published contract, not a separate older checked-in schema.

The official schema explicitly describes product `price` and modifier `priceImpact` as integers in the currency's smallest denomination (`addTabProducts`); delivery fees are documented in cents (`createTab.delivery.fee`), and payment-request `amount`/`tip` are documented in cents (`paymentRequest-2`). This adapter accepts only explicitly configured EUR locations, uses one `sourceMoney` boundary (integer minor units / 100) for API money and leaves percentage/quantity values unchanged. It rejects strings and fractional minor units. It does not use CSV parsing for numeric JSON.
Read-model descriptions for Bill totals/tax/payment amounts say “number” without independently repeating the unit. This is a documentation precision limitation; the implementation applies the common API monetary convention, rather than treating sample numbers as its authority. Successful live billing validation is still required before production activation.

Other discrepancies: bill example numbers are numeric although their schema is string; both representations are retained. Bill response examples contain `tabProductId` and `originalPrice`, while the complete Bill schema omits them and instead lists `fullPrice`/`finalPrice`; these optional documented-example fields are preserved only when actually supplied. Combo arrays lack a complete item schema: structured children are accepted only when they carry the same explicit identity/name/quantity facts; malformed children reject the Sale safely. Unknown shapes are not manufactured. The documented endDate description says “after” despite being an interval endpoint; requests pass the caller's explicit bounds and no undocumented updated-since semantics are used.

## Canonical boundary and governance

Both permanent CSV ingestion and API ingestion construct the existing `Sale`/`SaleLine` model and call `TrustedSalesRepository` → `sales_persist_canonical`. CSV remains available in the UI with its Spanish parser, classifier and fixtures. Historical CSV identity algorithms remain unchanged. API identity uses tenant + LAST_APP + location UUID + Tab UUID; external UUIDs are stored directly. CSV/API rows with no proven shared Tab identity are not automatically merged: a future explicit historical crosswalk is needed to deduplicate cross-channel backfills. Do not ingest the same source history through both channels without that crosswalk.

The atomic RPC serializes per canonical identity, writes the Sale, replaces explicitly supplied lines, writes Bill source facts, and publishes an internal Sales change in one transaction. `undefined` lines preserve current lines; `[]` removes all lines. Repeated API facts refresh observation provenance without generating another analytical change. Earlier observation timestamps cannot overwrite later observations. Database unique constraints handle concurrent API observations.

Source organization/location UUIDs belong in `sales_location_mappings`, scoped to the HORECA organization and a consistent active OperationalUnit. No first-unit/name/hardcoded tenant fallback exists. Canonical API observations remain isolated even when the same external Tab/location is configured in different tenants. Webhook ingress fails closed when a location has multiple tenant mappings; a future trusted routing context is required before enabling that ambiguous subscription. `sales_product_mappings` provides MAPPED/UNMAPPED/IGNORED; unmapped lines ingest safely and create no downstream Inventory/Finance mutations. Canonical Catalog references are supplied by Catalog governance, not invented by Sales.

### Field assessment

| Source field | Classification | Interpretation |
|---|---|---|
| Tab id, locationId | CANONICAL | External Sale/location identity |
| creationTime | CANONICAL | occurredAt and source creation evidence |
| source, code | CANONICAL | Source channel and human ticket reference |
| closeTime, cancelTime | CANONICAL | CONFIRMED/VOIDED lifecycle with timestamps |
| activationTime, schedulingTime, pickupType, locationBrandId, seats | SOURCE_ONLY / OPTIONAL | Minimized source facts when present |
| tableName | SOURCE_ONLY / OPTIONAL | Assessed but deliberately omitted; source names may contain customer text |
| customerId/customerInfo/notes/delivery/company/customerCompany | SOURCE_ONLY | Excluded as unnecessary PII |
| Bill id, number, rectifiedBillNumber, creationTime, finalizingTime | CANONICAL / OPTIONAL | Multiple invoice references within one Sale |
| total, tax, taxableBase, taxPercentage, discountTotal | CANONICAL / OPTIONAL | Source financial facts; no statutory allocation invented |
| deliveryFee, minimumBasketSurcharge, terraceSurcharge, terraceSurchargePercentage | SOURCE_ONLY / OPTIONAL | Converted money; percentage unchanged |
| preferredPaymentMethod | SOURCE_ONLY / OPTIONAL | Tender preference, not proof of actual payment |
| product id/catalogProductId/tabProductId/name/quantity | CANONICAL / OPTIONAL | Structured source IDs, source names, optional Catalog mapping |
| price/originalPrice, modifier priceImpact | SOURCE_ONLY / OPTIONAL | Source financial facts; no inferred VAT per line |
| modifiers/comboProducts | CANONICAL / OPTIONAL | Parent hierarchy; stable source IDs required |
| payment id/billId/type/amount/tip/creationTime/deleted | CANONICAL / OPTIONAL | Tender facts; deleted payments excluded from paid amount |
| source updated timestamp/business day/per-line tax allocation | UNAVAILABLE | Not invented |

Bill products preserve their own IDs, Tab-product references and minimized hierarchy in source Bill facts. Operational SaleLines use Tab products once, so split invoices do not double sold quantities. Multiple Bills sum source totals for the one Tab. Cancelled Tabs retain financial evidence with VOIDED status and are excluded from confirmed revenue/products. Open Tabs are OPEN. Rectified invoice references use REVIEW_REQUIRED and are excluded from confirmed revenue until an evidenced rectification rule is approved. No partial-refund or deleted-Bill netting is invented; deleted payment facts remain available for reconciliation. Discounts and fees are source facts rather than Spanish accounting policy.

## Server and authorization

Vercel server routes: `POST /api/sales` (csv, sync, health, replay) and `POST /api/sales-webhook` (durable receipt). Server-only configuration: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LAST_APP_TOKEN`; no VITE-prefixed Last.app credentials. Ordinary UI sends only the authenticated user's Supabase session and explicit organization/window. The endpoint validates the user through Supabase Auth and evaluates current Core `can_execute_capability_for_org` for the requested organization: upload+process for CSV, integrations.sync.trigger for sync/replay, sales.view for health. RLS read gates use existing Sales/config capabilities. No browser mutation grants or trusted-RPC grants exist. Service-role mutations follow server authorization, or authenticated source webhook receipt plus configured tenant routing.

Master provisions source mappings using the trusted configuration mechanism; no generic connector registry or Core schema changes were introduced. Invalid/missing locations fail closed. Missing server credentials show an honest unavailable state. Local Vite alone cannot serve these server routes; use the Vercel server runtime for an integrated preview. No hosted deployment was requested or performed.

Only safe GETs are used against Last.app, with LocationID/OrganizationID and the documented location query parameter. Pagination uses offset and limit 5–100, max 365-day source intervals and bounded pages. UI/server operations accept at most 31 days. [WP-SALES-002-R1](WP-SALES-002-R1.md) replaces the original failing window guard with durable resumable slices: at most 100 Tabs/two list pages and a 30-second application deadline per invocation. Healthy bounds return CONTINUABLE; the client continues the same logical window. Transport retries/timeouts remain bounded. 429/5xx/network failures are bounded; Retry-After is honored or the operation stops if it exceeds the execution budget. No tokens or response bodies enter errors/logs.

## Webhook foundation, replay and reconciliation

| Topic | Evidence |
|---|---|
| Registration | DOCUMENTED: Developer Portal subscription/URL configuration |
| Authentication | DOCUMENTED: same integrator Bearer token as REST |
| Event identity/type/timestamp/data | DOCUMENTED: id/type/created/data |
| Location headers | DOCUMENTED: locationId/organizationId context headers |
| Signature/signing secret | UNKNOWN; no signature scheme invented |
| Replay protection | UNKNOWN as a provider protocol; local UNIQUE event identity prevents duplicate effects |
| Success acknowledgement | DOCUMENTED: empty HTTP 200 |
| Retry/delivery ordering/retention guarantees | UNKNOWN |

Supported Tab events: created/closed/cancelled/updated. Ingress checks the official bearer token in constant time, verifies location consistency, resolves a unique configured tenant, and persists only event metadata/hash (not the customer payload) before HTTP 200. Unknown/malformed events are not applied. The inbox uses RECEIVED/PROCESSING/PROCESSED/FAILED, attempts and a reclaimable lease. Duplicate receipts never reset a processed event. Trusted replay claims one event, fetches authoritative Tab/Bill state, atomically refreshes canonical Sales, then finalizes the event. If the refresh fails, the durable receipt remains retryable. If a process stops after Sale persistence, replay sees the same stable Tab identity, avoiding duplication. Out-of-order events refresh current state rather than trusting old event payloads.

This WP prepares durable ingress and processing, with a manual oldest-event recovery action. **Automatic worker scheduling and webhook registration are deployment prerequisites**, not enabled by this module branch. Integrations can invoke the authorized replay operation; do not enable production subscriptions until a trusted drain trigger is deployed. Bill/payment-specific events are not yet targeted at Tabs because the published response does not establish a sufficient Tab reference; bounded Tab reconciliation repairs them. Provider resend guarantees are unknown, so receipts cannot replace reconciliation.

Backfill design: explicitly choose tenant/location/from/to and chunk history into caller-selected windows at most 31 days (smaller for dense history), paginate, inspect each durable run, and rerun failed/overlapping windows safely. No production history was downloaded. There is no invented update checkpoint. Reconciliation uses bounded overlapping windows plus stable UUID updates. Late changes outside an activation-date window need targeted Tab refresh or explicit older-window recovery; window selection is a deployment/business policy. No aggressive/full-history polling is configured.

## Internal analytics and extraction

Dashboard/overview/product queries use HORECA persistence only. External outages do not trigger live reads when a chart opens. `sales_changes` is a durable Sales-local propagation feed for Analytics consumption; transactional Sales and source evidence are separate from the future cross-domain OLAP projections. Analytics owns facts/dimensions/aggregate refresh and can consume the sequence without calling Last.app. This WP does not build the full Analytics domain or write InventoryMovement/BankMovement/P&L.

Health exposes configured locations, recent run status/counts, last successful sync and pending/retryable events without source payloads or secrets. Existing bounded Sales overview aggregation remains operational; heavy cross-domain projections belong to Analytics.

Extraction candidates for 09 Integrations: Last.app HTTP adapter, secure credentials, ingress, inbox-drain triggers, transport retry and reconciliation scheduling. Sales source DTO contract, lifecycle interpretation, canonical ingestion, atomic persistence and downstream Sales change feed remain Sales-owned.

## Validation

Focused fixture tests cover API errors/auth/config, pagination, timeout, 429/Retry-After/bounded retry; source mapping, monetary conversion, multiple Bills, hierarchy, product mapping states, identity, lifecycle and PII exclusion. Embedded PostgreSQL executes both real Sales migrations after the real Core baseline/authorization and checks atomic corrections, duplicate observations, stale observation protection, line clearing, rollback, tenant constraints, RLS/no-browser-write grants, event deduplication/claims/replay. Embedded Auth is only a uid contract stub; no hosted Auth identity is created.

CSV regression retains the 799-row / 14,980.70 EUR invariant. Final full-suite verification passed 37 files / 432 tests with one hosted test skipped by configuration; the subsequent PostgreSQL tenant-isolation addition passed its focused 8-test suite and typecheck. Lint passed with eight existing warnings; production build passed. Live verification remains unsuccessful (401 prerequisite above). Shared DEV migration/application and automatic webhook operation are intentionally not asserted.
