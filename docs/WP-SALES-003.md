# WP-SALES-003 — Last.app TEST read-only validation

Date: 2026-10-07. Baseline module/sales SHA 3deeb5900cb9eb0ab6db7581abfd5406eb58bf65; PR #6 remains open to dev. This TEST resume supersedes the previous missing-credential blocker. Production El Criollo is excluded.

## Authentication and scope

The supplied server-only lastapp.env is outside the repository; LAST_APP_TOKEN exists with no literal angle brackets or whitespace wrappers. No token value or headers were logged, copied, or committed. GET /organizations returned 200. Its sole organization is ec6394c7-6609-4b8a-815c-3cac25ca87d0, Vegen Digital Location. GET /locations and GET /locations/{id} returned 200. The sole matching TEST location is f7408208-75c8-4547-8862-f8748e2afac1, owned by that organization. Currency, timezone and status were not exposed in the queried location fields; no values were invented. No HORECA mapping was created.

## Official contract and live shapes

[Official v2 documentation](https://developers.last.app/docs/index.html) was rechecked on 2026-10-07. Host https://api.last.app/v2 uses Bearer authentication plus OrganizationID or LocationID context. Organization/location lists return arrays. Tabs/Bills/payments use bounded ISO startDate/endDate, explicit locationId and offset/limit; maximum interval 365 days, Tab limit 5–100. List records are simpler than detail records. The existing transport is compatible with the observed arrays and detail objects.

GET /tabs used open=false, limit=5, offset=0 and 2026-09-30T15:43:09.540Z through 2026-10-07T15:43:09.540Z; HTTP 200 returned three closed, non-cancelled Tabs. GET /tabs/01a11703-576e-7029-9519-e29d0baf85ec, /bills/01a11703-6d11-7711-890a-88a3b4ab3069 and /payments/01a11703-722d-7408-a0be-e84dee1ca2d1 each returned 200. Only one Tab's financial details were sampled.

Tab id/locationId/code/creationTime/closeTime/source are strings, open is boolean, products and bills are arrays. cancelTime is absent for this non-cancelled sample. Four products have distinct string line IDs, catalogProductId strings, numeric quantity=1 and numeric price; deleted=false, modifiers/comboProducts empty arrays. Nonempty modifiers/combos and cancellation were not observed live and remain covered by existing local tests. virtualBrandId is present instead of the adapter's optional locationBrandId: SAFE_COMPATIBLE for current identity/location/revenue paths, but optional brand provenance is not populated; future brand use needs explicit contract work. Bill number is a string (already accepted), monetary fields are numbers, taxPercentage=10, rectifiedBillNumber=null; payments include string id/billId/type/creationTime, numeric amount/tip, boolean deleted. No adapter correction was required for these tested financial paths.

## Reconciliation and mandatory monetary gate

Tab R003, Bill LS283-3: one Bill, four sold units, line prices 200+210+180+180=770. Bill total=770, taxableBase=700, tax=70, discountTotal=0. Embedded Bill agrees with its direct read. One cash payment has amount=770, tip=0, deleted=false and the matching billId; the direct payment agrees. Non-deleted payment sum equals Bill total exactly. No duplicate quantities or Bill aggregation are needed.

MONEY SEMANTICS: VERIFIED_MINOR for the validated Last.app TEST read path. On 2026-10-07 the Product Owner independently confirmed that the TEST POS displayed 7.70 EUR for Tab R003 / Bill LS283-3. Its API total and payment amount are both 770, establishing 770 API units = 7.70 EUR. The reconciled monetary facts convert as total/payment 770 -> 7.70 EUR, taxableBase 700 -> 7.00 EUR and tax 70 -> 0.70 EUR. The existing sourceMoney /100 conversion is correct for these validated Bill/payment fields and remains unchanged. The factor-of-100 gate is closed for this sample; this conclusion does not claim validation of every optional monetary field or authorize live ingestion. A new demo sale is not required.

## Local safety validation

The committed candidate fixture retains only technical IDs, lifecycle and necessary financial facts. Product names are replaced with neutral labels. Customer names, phone, address, notes, customerInfo, company payloads and raw responses are excluded. Three focused tests invoke the real mapper in memory: actual closed shape/reconciliation and quantity count; duplicate Bill rejection/deleted tender exclusion; cancelled lifecycle=VOIDED. Their synthetic HORECA context is DEV LAB with a clearly local-only unit, not a persisted or proposed mapping.

No adapter or CSV code was modified. ZERO canonical writes, ZERO Supabase reads/writes, no migrations, mappings, webhooks, deployments, production integrator activation or PR merge. El Criollo and MICA untouched.

Validation: npm run lint PASS (0 errors; 5 existing warnings), typecheck PASS, test:run PASS (44 files; 524 passed, 1 skipped), build PASS, test:csv-performance PASS. 5000-row samples: 730.83, 762.54, 855.95 ms; maximum 855.95 ms < 5000 ms. git diff --check PASS.

## Repeat validation on 2026-10-07

Resume started from actual branch module/sales HEAD 275b1968520bedfe62973696f7cdf73bfd5833b0, which already contains the preceding TEST evidence and regression fixture. The supplied baseline 3deeb590 was not checked out over that work. The working tree was initially clean.

The same server-only credential file was checked again without printing its value: present, LAST_APP_TOKEN configured, no literal angle brackets or whitespace inside the parsed credential. Git confirmed the absolute secret path is outside this Sales repository, so it cannot be tracked here. All provider requests were GET requests; redirects were rejected. No authentication failure or rate limit occurred and no retry was needed.

Fresh GET /organizations, /locations, /locations/{id}, /tabs, /tabs/{id}, /bills/{id} and /payments/{id} all returned HTTP 200. Organization and location UUIDs remain those recorded above. The single bounded Tab page used limit=5, offset=0, open=false and window 2026-09-30T20:16:00.421Z to 2026-10-07T20:16:00.421Z. It returned three closed, non-cancelled Tabs. One Tab was inspected in detail: R003 / LS283-3. Its four quantities remain one each; prices sum to 770, taxableBase=700, tax=70, total=770, and the sole non-deleted cash payment amount=770 with tip=0. Direct Bill and payment reads agree with embedded facts. No new fixture or adapter change was necessary.

The [official v2 contract](https://developers.last.app/docs/index.html) was rechecked for authentication, organizations, locations, Tab/Bill/payment reads, offset/limit pagination and ISO date windows. The documentation describes the list windows using activation time; its endDate description says "after endDate", so upper-bound semantics are not independently proven by this sample. Monetary units explicitly described for promotion fields do not establish the units of Bill total or payment amount. MONEY SEMANTICS is now VERIFIED_MINOR: the subsequent Product Owner confirmation of the displayed 7.70 EUR for R003 / LS283-3 supplies the independent evidence needed to close the factor-of-100 gate for the validated Bill/payment path. No controlled demo sale is needed because closed samples already exist.

Fresh validation: npm run lint PASS (0 errors, 5 existing warnings), npm run typecheck PASS, npm run test:run PASS (44 files, 524 passed, 1 skipped), npm run build PASS, npm run test:csv-performance PASS (one benchmark passed, optional profiling test skipped). The benchmark measured 5000 accepted rows and samples of 2966.21, 3110.62 and 3682.12 ms, maximum 3682.12 ms below 5000 ms. Build reports existing Browserslist age and bundle-size warnings. Source adapter, mapper and CSV implementation remain unchanged.

This repeat performed ZERO live canonical writes and ZERO Supabase calls. No Sales migrations, mapping, webhooks, merge, deployment, historical sync or production activation occurred. El Criollo data was not accessed. The former independent monetary-unit blocker is resolved by the Product Owner confirmation recorded above. Deployment remains controlled by Master; no ingestion or migration execution is authorized by this validation task.

## Money gate finalization and Master handoff

The Product Owner's independent TEST POS confirmation closes WP-SALES-003: MONEY SEMANTICS VERIFIED_MINOR; SOURCE MONEY CONVERSION CONFIRMED. No adapter, mapper, canonical Sale/SaleLine contract, payment filtering, cancellation behavior, duplicate Bill protection or CSV implementation changed.

Finalization validation on 2026-10-07: lint PASS (0 errors, 5 existing warnings); typecheck PASS; test:run PASS (44 files, 524 passed, 1 skipped); build PASS (existing Browserslist and bundle-size warnings); test:csv-performance PASS (benchmark passed, optional profiling skipped). The isolated 5000-row CSV benchmark measured 779.44, 1130.93 and 706.81 ms, maximum 1130.93 ms < 5000 ms. git diff --check PASS.

READY FOR MASTER SALES DEPLOYMENT: YES. Sales is ready for the Master-controlled first deployment of these existing migrations, in order:

- 20261003100000_canonical_sales_schema.sql
- 20261003110000_lastapp_sales_ingestion.sql
- 20261003120000_sales_resumable_sync.sql

Master retains control of deployment prerequisites and execution. None of these migrations was applied in this task. Live canonical writes remain ZERO, El Criollo data remains untouched, and PR #6 was not merged. No source mapping, live sync or production integrator activation was performed. BLOCKERS: none for this WP's validated read path and monetary gate.
