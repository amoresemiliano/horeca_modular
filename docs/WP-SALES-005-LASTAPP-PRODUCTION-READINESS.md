# WP-SALES-005 — Last.app v2 Production-readiness audit

Date: 2026-10-08, Europe/Madrid. Project/product: HORECA Modular, not MICA. Domain: Sales & Revenue. Role: Sales Domain Lead / Integration Compliance Reviewer. Audited module/sales SHA: 7a74a04f0b09f66abb0a2adb957f6ec6848ddcb7; deployed DEV/code baseline: efcb7c4544979c22107371099032ea9804412a65. This WP changes documentation only.

**Updated by [WP-SALES-006](WP-SALES-006-LASTAPP-HARDENING.md): B1 = CLOSED; B2 = CLOSED; B3 = OPEN. BLOCKING GAPS: 1. READY_TO_REQUEST_LASTAPP_PRODUCTION = NO.** B1/B2 closure describes the tested branch implementation. Master must deploy the prepared coordinator migration before activating this code; no hosted deployment is claimed. The original audit findings below remain historical evidence unless explicitly updated.

## Current official contract and reproducibility

The current [official Last.app documentation](https://developers.last.app/docs/index.html) was downloaded again in this WP, HTTP 200. Its embedded `__redoc_state.spec.data` OpenAPI was parsed without executing page scripts. API info.version is **2.0.0**; the specification format is **OpenAPI 3.0.0**; base URL is **https://api.last.app/v2**. Local ignored snapshots preserve the source and extracted contract. HTML SHA-256: 27d33da70fc113bb9aee2ea0b6d18d24448ec995a8316c46e72072919b0ccbec. Extracted OpenAPI, JSON.stringify(spec, null, 2), SHA-256: 511b48b30b4ff75bab062a984819132885963401f337f5c4b5c76d2e17068e2d.

Contract facts were checked directly against securitySchemes, paths, component schemas and x-webhooks, rather than inferred from prior WPs:

| Contract area | Current contract | Implementation/evidence |
| --- | --- | --- |
| Authentication | HTTP Bearer; one v2 integrator token covers its integrated organizations | Adapter sends Authorization: Bearer; credentials stay server-side |
| Context | /organizations uses Bearer alone; /locations also requires organizationID plus organizationId query; location/reporting detail uses locationID | HTTP header case is insensitive; code uses OrganizationID/LocationID appropriately |
| Hierarchy | Organization → Location → Brand → Catalog | HORECA routes Location UUID to tenant/unit; locationBrandId and catalog product references remain distinct |
| Limits | 15 requests/second and 1,500/10 minutes per token/entity; /organizations additionally 1/second per token | B1 closed by WP-SALES-006 preventive shared coordinator; Master deployment pending |
| Reporting | GET /tabs, /tabs/{tabId}, /bills, /bills/{billId}, /payments, /payments/{paymentId} | Read-only adapter and existing live TEST evidence |
| Pagination | Offset ≥0; limit 5–100, default 20; maximum interval 365 days | Adapter uses integer offsets/limits and max 365 days; defaults limit 100; server sync window ≤31 days |
| Tab filters | locationId/startDate/endDate required; optional open, tabName, tableId/tableName/customerId | Runtime requests all lifecycle states; no undocumented updated-since filter |
| List/detail | Simplified list schemas; complete detail schemas | Sync uses list only for Tab IDs, then reads Tab and each Bill detail; Bill detail embeds paymentList |
| Webhook | x-webhooks POST, JSON, Authorization, optional locationId/organizationId context; successful empty 200 | Implemented Tab subset reviewed; actual portal subscriptions/URL unverified: B3 |
| Lifecycle | TEST/Pending supports dummy/developer-accessible real locations; Production exposes the product generally in Admin Marketplace | TEST supplied by PO; no portal state change |
| Approval | Request review at integrations@last.app with integrator ID(s) | No request sent; ID not supplied in this WP |

The UI supplies ISO timestamps; adapter/server validate parseable dates and intervals, but do not strictly enforce or normalize ISO text at every entry point. Stricter boundary normalization is recommended. The endDate description incorrectly says “after”; interval handling uses an end boundary and does not reinterpret that wording as updated-since behavior.

## Portal evidence and applicability

Integrator ID: **NOT_SUPPLIED / NOT_VERIFIED**. Status TEST and product name HORECA Modular are user-supplied. Selected capability names, webhook subscriptions, callback URL, logo, description and support/contact fields are **NOT_VERIFIED**. An explicit request for these non-secret details was made during this WP; none was supplied before closure. Neither repository code nor successful reporting GETs proves the complete selected portal capability set.

The applicability matrix below describes the declared/implemented Reporting integration. NOT_APPLICABLE means outside that scope, **conditional on verifying that the capability is not enabled**; it is not a claim that the portal has disabled it. B3 prevents approval based on that assumption.

| Documentation area | Classification | Scope decision |
| --- | --- | --- |
| Bearer, context, rate/error rules, org/location discovery | APPLICABLE | Foundation for Reporting reads |
| Tabs, Bills, Payments reporting reads and money | APPLICABLE | Current Sales ingestion |
| Tab notifications | APPLICABLE to implemented webhook mode; optional in polling-only deployment | Only tab:created/closed/cancelled/updated are supported |
| Location install/uninstall notifications | OPTIONAL_FUTURE implementation; RECOMMENDED_BEFORE_PRODUCTION | Current handler/inbox cannot accept them |
| Bill/payment/product-change and tabs:merged notifications | OPTIONAL_FUTURE | Not supported by current ingress; do not select without implementation or explicit polling-only coverage |
| Catalog/brand reads for automated onboarding/product mapping | OPTIONAL_FUTURE | Current source product IDs may remain UNMAPPED; not catalog management |
| Loyalty customer lookup/promotions, customer writes/points, reviews | NOT_APPLICABLE to declared Reporting scope | No claim of implementation; verify unselected |
| Reservations/availability/schedules/temporal closures | NOT_APPLICABLE to declared Reporting scope | No reservation or scheduling product capability |
| Order/Tab creation, Bill/payment writes, payment requests/terminals | NOT_APPLICABLE to declared Reporting scope | Adapter performs GET only |
| Catalog mutations, delivery/order-status writes, kitchen/shipment operations | NOT_APPLICABLE to declared Reporting scope | No operational write integration |

The official introduction asks developers to complete name, logo and description and select capabilities/webhooks for discoverability. Support/contact metadata should be completed if available in the portal; the retrieved contract does not establish a universal mandatory support field or require every unrelated capability.

## Compliance matrix

PASS is limited to the stated implemented path and available evidence. A GAP is either demonstrated missing behavior or an explicitly unverified prerequisite.

| Area | Result | Evidence and limit |
| --- | --- | --- |
| AUTH | PASS | Bearer/context code; prior live 200s; invalid credential/missing-token tests fail closed; exact-token history scan clean |
| RATE LIMITS | PASS | B1 CLOSED: shared PostgreSQL preventive admission for every attempt; conservative token/entity pacing meets 15/s, 1,500/rolling 10min and organizations 1/s. Controlled-clock SQL regressions; Master deployment prerequisite documented in WP-SALES-006 |
| ORG/LOCATION | PASS | WP-SALES-004 GET organizations/list/detail all 200; distinct IDs and tenant routing verified. getLocation detail lives in the secure discovery helper, not a production adapter method |
| LIST/DETAIL | PASS | Mandatory authoritative Tab/Bill detail refresh; paymentList embeds the complete payment schema, so a second Payment detail GET is not assumed necessary for canonical sync |
| TABS | PASS | Correct context/query/offset/limit/window in normal UI sync; all states intentionally read; no invented updated-since semantics |
| BILLS | PASS | UUID checks, parent Tab.bills relationship, duplicate Bill rejection and required complete products/payments arrays; mapped fields detailed below |
| PAYMENTS | PASS | B2 CLOSED: duplicate IDs, foreign billId, invalid identity/type/time/money and absent/nonboolean deleted reject the whole observation before persistence. Valid deleted/partial/multiple payments preserved; WP-SALES-006 |
| MONEY | PASS | VERIFIED_MINOR for R003/LS283-3 total/base/tax/payment; safe-integer conversion; no /100 change |
| IDENTITIES/IDEMPOTENCY | PASS | tenant + LAST_APP + Location UUID + Tab UUID; two hosted observations produced one stable Sale/change; Bill lines do not double sold quantities |
| PAGINATION/RESUME | PASS | 100 records/2 pages per slice, offsets/pending IDs/exhaustion, continuation versions, lease fencing and durable checkpoint tests |
| ERROR HANDLING | PASS | 400/404 stop; 401/403 fail closed; 429/5xx bounded retry; timeout/network sanitized; Retry-After respected; failed runs remain resumable |
| WEBHOOK CONTRACT | GAP | Supported Tab event code is compatible with the schema, but enabled events, wrapper/URL and provider delivery configuration remain unverified under B3 |
| LOCATION EVENTS | GAP | RECOMMENDED_BEFORE_PRODUCTION, not asserted universally REQUIRED; current validator rejects them and inbox requires external_tab_id |
| PII MINIMIZATION | PASS | Explicit mapper allowlist omits customerInfo/customer IDs, contacts, address/delivery detail, notes, company/customerCompany, employee/waiter data and arbitrary payment metadata |
| TENANT ISOLATION | PASS | Existing hosted role/JWT positive/negative tests; TEST mapping exclusively DEV LAB; El Criollo Sales/mappings zero; UI switch removes TEST facts |
| CANONICAL WRITE SAFETY | PASS | Existing bounded DEV LAB ingestion/correction/checkpoint atomicity evidence; no downstream Inventory/Finance writes; Analytics-facing change facts only |
| SECURITY | PASS | Core authorization precedes user-triggered service-role operations; browser privileged RPCs denied; RLS authority; server-only credentials and clean bundle scan |
| TEST ENVIRONMENT | PASS | Independently validated Developer Portal dummy pair, installed integration/live GETs/TEST POS; no real access or Production token use claimed |
| PRODUCTION SUBMISSION | GAP | B3 remains open; B1/B2 implementation closed, coordinator deployment reserved for Master. No approval email, status change or Production webhook registration |

## Bill, Payment and money detail

| Source facts | Handling |
| --- | --- |
| Bill UUID / Tab relationship | Source Tab lists Bill IDs; each Bill detail ID must match; mapper rejects duplicate Bill IDs. Current Bill schema has no separate tabId property to invent |
| Number / rectifiedBillNumber | Accept string or number, accommodating schema string versus numeric examples; retain rectification reference; mark rectified observations REVIEW_REQUIRED |
| total / taxableBase / tax / discountTotal | Convert safe integer minor units through sourceMoney; retain minimized Bill facts |
| taxPercentage / surcharge percentage | Retain as percentages; do not divide percentages by 100 as currency |
| creationTime / finalizingTime | Retain source timestamps; finalizingTime may be null |
| Products | Tab hierarchy owns sold quantities; Bill product facts are retained separately, avoiding quantity duplication |
| Payments | Bill detail paymentList supplies ID, billId, type, amount, tip, creationTime and deleted; deleted=true excluded from paid amount; tip retained separately |
| Multiple/partial payments | Mock probes: partial amount 300 → paid 3.00; distinct payments 300+470 → paid 7.70; deleted payment → paid 0.00 |

The contract's Bill examples/schema differ on number types, some optional fields, and Bill product shapes; Tab detail example omits id despite its schema declaring it. The implementation does not invent missing authoritative Tab IDs or missing Bill products/payments: it rejects/stops those observations. Monetary floats/strings/unsafe integers are rejected. This is not complete runtime JSON-schema validation; B2 identifies concrete payment validation omissions. Payment change is documented but not modeled; clarify cash-change and tip reconciliation with the provider rather than inventing arithmetic from an example.

Established independent TEST POS evidence: Tab **R003**, Bill **LS283-3**, API total **770**, taxableBase **700**, tax **70**, payment **770**, POS total **7.70 EUR**. Converted amounts: **7.70 / 7.00 / 0.70 / 7.70 EUR**. This validates these observed read fields; it does not claim every optional monetary field or a real restaurant has been independently validated.

## Transport, resumability and webhook distinctions

Default adapter: maxAttempts=3 (allowed 1–5), request timeout 10s, maxPages=100; server sync uses maxAttempts=2 and timeout 4s. Requests are serial within a sync slice. Retries use bounded exponential delay; numeric/date Retry-After raises the delay; a requested delay over 10s stops rather than retrying early. No permanent auth/400/404 retry. Timers abort transport; sensitive response bodies/exceptions are not surfaced. Budgets are cooperative: an in-flight bounded request may complete after the slice deadline, so 30s is not a hard wall-clock cancellation guarantee. No unbounded historical fetch or background schedule was introduced.

The no-network audit probe completed **16 serial mocked reads in under 110ms**, proving that serial concurrency alone does not enforce 15 requests/second. Independent adapters/runs also lack a shared 10-minute budget; /organizations has no 1/second guard. Provider 429 responses are not a substitute for prevention.

**PROVIDER-DOCUMENTED:** POST JSON event fields id/type/created with event-specific data; context headers; global Bearer authentication; empty 200 on success. OpenAPI models the event fields at the top level, while prose describes an event wrapper. Current ingress accepts the schema-shaped top level only; confirm actual selected notification envelope before configuring delivery. No HMAC/signature scheme is claimed.

**LOCAL SAFETY MECHANISM:** timing-safe comparison of hashed Bearer strings, supported-event/timestamp/location checks, minimized metadata/hash, mapping-derived tenant, durable event-ID uniqueness, empty 200 after receipt, leased replay, authoritative source refresh and canonical idempotency. Hash comparison is local token checking, not a provider signature. Event ID is separate from Tab identity. No full customer/event payload is stored.

**UNKNOWN PROVIDER GUARANTEE:** no ordering, retry/backoff, retention, exactly-once delivery or recovery guarantee was established by the retrieved contract. Checkpoints and inbox leases are local guarantees. No synthetic POST was sent to a live inbox in this WP.

Location lifecycle events are **RECOMMENDED_BEFORE_PRODUCTION** because they support installation discovery and controlled deactivation. Minimal missing design: an onboarding/lifecycle receipt path that accepts location/organization payloads without a Tab ID, can durably receive an as-yet-unmapped location, and sends it for authorized mapping review. Merely adding event names to the Tab validator is insufficient: current ingress also requires an existing mapping and the inbox's external_tab_id is NOT NULL. Uninstallation must pause reviewed routing safely; never auto-create a tenant/unit or reuse the TEST route. No event was enabled here.

## Gaps and Production recommendation

| ID | Category | Required closure / acceptance evidence |
| --- | --- | --- |
| B1 | CLOSED — WP-SALES-006 | Every attempt requires shared atomic admission; deterministic burst/sustained/concurrent/retry tests pass. Prepared migration must be deployed by Master before hosted activation |
| B2 | CLOSED — WP-SALES-006 | Stable ID, containing Bill relationship, explicit boolean deletion, type/time/money validated before totals; all duplicate IDs reject. Regression tests assert no persistence begins |
| B3 | BLOCKING | Supply/verify Integrator ID, exact selected capabilities, enabled event names, callback URL and profile metadata. Ensure unsupported unrelated capabilities/events are disabled or separately implemented. For selected notifications verify the real envelope and publicly reachable authorized callback; DEV Preview protection is not evidence of provider delivery. If using polling only, verify subscriptions are actually disabled |
| R1 | RECOMMENDED | Implement and verify safe location:integrated/location:desintegrated onboarding receipt before enabling them; not a documented universal approval requirement |
| R2 | RECOMMENDED | Review the first Sales-open auth/context navigation reset from WP-SALES-004 before user UAT; no Core change in this audit |
| R3 | RECOMMENDED | Strict ISO boundary normalization and a documented automated location-detail discovery method if onboarding is automated |
| R4 | RECOMMENDED | Ask provider about schema/example discrepancies, cash change/tip semantics and notification delivery guarantees; do not invent guarantees |
| F1 | OPTIONAL_FUTURE | Broader Bill/payment/product/merge notifications, automated Catalog mapping, non-EUR currencies or unrelated capabilities only under separately approved scope |

Synthetic B2 evidence, using the sanitized TEST fixture solely in memory: missing deleted accepted with paid=7.70; foreign billId accepted with paid=7.70; repeated same payment accepted with paid=15.40. No canonical row was written by these probes. Sale identity/idempotency is separately correct; it does not repair invalid payment facts.

Do **not** email Last.app requesting Production approval until B3 closes and Master deploys/integrates the prepared safeguards. B1/B2 implementation closed in WP-SALES-006; the original negative probes are historical. Then submit the verified Integrator ID(s) to the documented integrations contact with the Reporting-only scope and truthful checklist. Last.app makes the approval decision. El Criollo's missing provider installation/real UUIDs and missing Core OperationalUnit remain separate **restaurant activation gates**, not invented mandatory prerequisites to the provider's integrator review.

## Provider-facing checklist — draft, not ready to send

- ✓ Bearer authentication and organization/location context validated with TEST reads.
- ✓ Tabs, Bills and Payments read endpoints validated.
- ✓ Bounded reporting windows, pagination and recovery validated.
- ✓ Currency conversion checked against independent TEST POS total (770 → 7.70 EUR).
- ✓ Repeated Sales observations remain idempotent.
- ✓ Tenant isolation and operational data minimization validated.
- ✓ Token remains server-side; invalid authentication fails closed.
- ✓ Bounded retries, timeouts and Retry-After behavior tested.
- Implemented/tested: preventive burst/sustained enforcement; Master coordinator deployment required before hosted activation.
- Implemented/tested: payment relationship/deletion/duplicate safeguards and pre-persistence rejection.
- Pending: exact portal scope, Integrator ID and profile verification.
- Pending if subscribed: webhook delivery/envelope/callback verification; location lifecycle events are not enabled by this audit.

The draft contains no credentials, customer data, internal RPC/lease implementation details or claim of real restaurant activation.

## Validation, evidence and boundaries

All five required commands passed on the audited branch: lint (zero errors, five existing warnings), typecheck, test:run with one worker (45 files, 525 passed, one skipped), build (existing warnings), and test:csv-performance (5,000 rows; max 717.84ms versus unchanged 5,000ms budget). No behavior, assertion, timeout, CSV hash, adapter, mapper or migration was altered.

Private scan of 99 reachable commits found zero occurrences of the supplied token. Tracked files contained zero service-role JWTs or VITE Last.app secret references; generated client bundles contained neither that token nor SUPABASE_SERVICE_ROLE_KEY references. This establishes the tested secret/bundle boundary, not a general claim that every possible historical credential was scanned.

Evidence reused explicitly: [WP-SALES-003](WP-SALES-003.md) live TEST detail/POS confirmation; [Master first deployment](MASTER-SALES-FIRST-DEPLOYMENT.md) bounded canonical ingestion, hosted role/JWT isolation and rollback-only correction/checkpoint/inbox tests; [WP-SALES-004](WP-SALES-004.md) fresh org/location discovery, deployed state and hosted UI. Hosted controlled ingestion created one Sale with four lines; replay preserved IDs/facts and yielded unchanged=1, created=0, updated=0. Protected Finance/Inventory/public rows were unchanged. Those hosted tests were not rerun or relabeled as new live evidence in this WP.

New ignored local evidence includes the official HTML/OpenAPI snapshots and hashes, no-network probes and count-only credential scan. No provider sales API call, canonical ingestion, Core mutation, mapping change, migration, backfill, scheduled sync, real webhook registration, approval email, DEV merge or main/Production promotion occurred. El Criollo remains untouched and the TEST → DEV LAB route is preserved.
