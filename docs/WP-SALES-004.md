# WP-SALES-004 — Real El Criollo Last.app activation readiness

Date: 2026-10-08, Europe/Madrid. Role: Sales Domain Lead. Authoritative DEV baseline: efcb7c4544979c22107371099032ea9804412a65. PR #6 is merged. The clean module/sales worktree was fast-forwarded to origin/dev; all merged Sales behavior is preserved. This is HORECA Modular, not MICA.

## Provider prerequisite

INTEGRATOR STATUS: TEST, as supplied by the Product Owner. The queried organization/location endpoints do not expose integrator status; no Developer Portal status transition was performed.

PROVIDER ACTIVATION: MANUAL_INSTALLATION_REQUIRED. The Product Owner independently confirmed in this WP that the same Developer Portal user can access the real El Criollo Admin.

The current [Last.app API v2 documentation](https://developers.last.app/docs/index.html) permits TEST/Pending integrators in developer-created dummy locations and real locations accessible to that developer user. Production makes the integration generally available in the Admin Marketplace; approval is requested through integrations@last.app with the integrator ID. Organization/location discovery lists installed integrations, not every restaurant the developer can access. Production approval is therefore not established as a prerequisite for this specific accessible restaurant.

Minimum Product Owner action: sign into the **real El Criollo Last.app Admin with that developer user**, open **Apps y Hardware → Integraciones → Marketplace**, and install the integrator associated with the existing HORECA Modular TEST token. Identify that integrator by its Developer Portal identity; do not select the dummy restaurant. The official [Marketplace instructions](https://help.last.app/lastadmin/solicitar-integraciones.html) describe the installation flow. If the eligible integrator is absent, provide its ID to Last.app integrations support to resolve visibility; this WP does not assert that a Production transition is then mandatory. No email or installation was executed by Codex.

After installation, repeat GET-only discovery and independently verify the real organization/location UUIDs before any HORECA mapping. No real UUID is known yet. Any requested integration name/external identifier must use approved existing identifiers; this WP neither invents an OperationalUnit nor authorizes ingestion.

## Live GET-only discovery

The existing LAST_APP_TOKEN was read directly from the supplied private file outside Git. It was not printed, persisted in evidence, committed or added to a Production environment. All three provider calls returned HTTP 200: GET /organizations, GET /locations with OrganizationID and organizationId, and GET /locations/{id} with LocationID.

| Entity | UUID | Name |
| --- | --- | --- |
| Only accessible Last.app organization | ec6394c7-6609-4b8a-815c-3cac25ca87d0 | Vegen Digital Location |
| Only accessible Last.app location | f7408208-75c8-4547-8862-f8748e2afac1 | Vegen Digital Location |

Currency, timezone, status and dummy/test flags were not exposed in the queried scalar metadata; no values were inferred. These UUIDs match the independently established WP-SALES-003 TEST POS identity and the existing DEV LAB mapping. They are **the TEST location, not an established real El Criollo identity**. They must never be reused as El Criollo's production location.

REAL EL CRIOLLO ORGANIZATION: NOT_VISIBLE. REAL EL CRIOLLO LOCATION: NOT_VISIBLE. REAL LOCATION UUID: N/A. No identity was inferred from partial names. The API returned only the known TEST pair; it cannot establish an uninstalled restaurant's IDs or actual developer-user permissions.

REAL LIVE READ: NOT_RUN. No real Tabs, Bill or Payment were requested, and no customer data was retained. Real-source compatibility, lifecycle fields, EUR and minor-unit semantics remain unvalidated until an independently identified real location is accessible. The existing validated TEST sourceMoney /100 behavior remains unchanged.

## Hosted Core/Sales state

Shared Supabase project vmxjqwlfwnphorthhcwu was verified. Remote migration history contains all three versions: 20261003100000_canonical_sales_schema.sql, 20261003110000_lastapp_sales_ingestion.sql and 20261003120000_sales_resumable_sync.sql. No migration was applied in this WP.

El Criollo organization f84168ef-2b78-451b-b0a9-39c1c381e59b, code EL_CRIOLLO, is active. **EL CRIOLLO OPERATIONAL UNIT: MISSING**: the SELECT of eco_operational_units returned zero units for that organization. There are no existing candidates to select. Core/Master must establish an approved physical restaurant unit in a separate authorized task before real Sales routing; no unit was invented or created here.

HORECA DEV LAB organization f7f6da70-f7dc-4b1a-aa23-f5612174dcbc is active. Its existing DEV LAB Location unit d8c0455d-165c-402c-bc9d-5c8778641b97 remains active. Exactly one active Last.app location mapping routes the TEST pair above exclusively to this DEV LAB unit, currency EUR. Canonical Sale 8649ef30-f850-4591-830b-041be08c24cb remains the sole Sales record, total 7.70 EUR. El Criollo has zero canonical Sales and zero sales_location_mappings.

## Validation and boundaries

All five required commands passed: lint (zero errors, five existing warnings), typecheck, test:run with one worker (45 files, 525 passed, one skipped), build (existing warnings), and test:csv-performance (5,000 rows; samples 754.10, 768.56 and 717.87 ms; maximum 768.56 ms below the unchanged 5,000 ms budget). No assertion, fixture hash, timeout, adapter or business rule changed.

DEV SALES UI: PASS on the deployed DEV alias at the baseline SHA. A headless Chrome session with the real authorized Product Owner opened DEV LAB Sales, read its TEST mapping, displayed the sole R003 ticket at 7.70 EUR and opened its details without persistence errors. Both health calls returned 200, configured=true, one mapped location; there were no browser runtime or Supabase HTTP errors. Switching to El Criollo removed R003 and the TEST location selector. The browser blocked mutation routes and performed no sync or CSV upload.

Observed startup limitation: the first lazy opening of Sales reset navigation while authentication context refreshed; reopening Sales after context stabilization passed the checks above. This initial navigation reset is recorded rather than hidden by the successful second opening. The separate Sales and shell Supabase clients are a suspected cause from code inspection, not a confirmed Core root cause. Track a Core/Sales client-lifecycle review before user UAT; this read-only WP does not alter protected Core authentication.

ZERO provider writes; ZERO canonical writes; ZERO El Criollo mappings; no backfill, webhooks, scheduled sync, schema changes, Core mutations, dev merge or main/Production promotion. DEV LAB TEST routing is preserved. Local sanitized evidence is ignored by Git; private sessions and Preview-access cookies are not documentation artifacts.

## Next gate

The readiness investigation is complete; real activation remains blocked by the missing provider installation/real UUID verification and missing El Criollo Core OperationalUnit. Once those prerequisites are independently resolved, the separate **CONTROLLED REAL EL CRIOLLO SALES ACTIVATION** WP may authorize the real mapping, bounded sync, amount/line checks, idempotency, user UAT and subsequent Master-controlled Production/main promotion. None of that sequence was executed here.
