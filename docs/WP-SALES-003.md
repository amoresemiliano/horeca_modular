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

MONEY SEMANTICS: AMBIGUOUS until an independent amount/currency for this same POS invoice is confirmed. These integer API values and internally consistent equations do not distinguish 770 major units from 770 minor units. Under the existing minor-unit contract, the actual canonical mapper computes total=7.70 and paidAmount=7.70, base=7.00 and tax=0.70. That calculation is regression-tested, but does not itself prove /100 is correct. sourceMoney is unchanged; ingestion remains gated. Required next action: confirm only the displayed total and currency for R003 / LS283-3 in the TEST POS, or provide authoritative provider documentation explicitly binding these read fields to monetary units. A new demo sale is not required.

## Local safety validation

The committed candidate fixture retains only technical IDs, lifecycle and necessary financial facts. Product names are replaced with neutral labels. Customer names, phone, address, notes, customerInfo, company payloads and raw responses are excluded. Three focused tests invoke the real mapper in memory: actual closed shape/reconciliation and quantity count; duplicate Bill rejection/deleted tender exclusion; cancelled lifecycle=VOIDED. Their synthetic HORECA context is DEV LAB with a clearly local-only unit, not a persisted or proposed mapping.

No adapter or CSV code was modified. ZERO canonical writes, ZERO Supabase reads/writes, no migrations, mappings, webhooks, deployments, production integrator activation or PR merge. El Criollo and MICA untouched.

Validation: npm run lint PASS (0 errors; 5 existing warnings), typecheck PASS, test:run PASS (44 files; 524 passed, 1 skipped), build PASS, test:csv-performance PASS. 5000-row samples: 730.83, 762.54, 855.95 ms; maximum 855.95 ms < 5000 ms. git diff --check PASS.
