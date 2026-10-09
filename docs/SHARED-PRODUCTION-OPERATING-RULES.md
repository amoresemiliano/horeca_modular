# Core + Banks shared production release

Approved source: `dev` at `78fb5127793767120e49170f254edbaa92af49f8`. Main retains its historical commits through a merge. Sales PR #6 and its migrations/runtime are excluded. This release adds only the shared-backend identity guard, exact DEV/PROD invitation-origin validation and production password-login presentation.

## Authoritative infrastructure

DEV and PROD intentionally share HORECA Supabase `vmxjqwlfwnphorthhcwu`, historically named `horeca_modular_staging`. MICA is a separate system and must never be used. The existing Vercel project is `vegen-s-projects/horeca_modular`, ID `prj_RaRsLmj1gvwxECThjesAeJQkxPhb`, with production branch `main` and URL `https://horecamodular.vercel.app/`.

Auth defaults to the production origin. Existing DEV redirects remain allowed alongside explicit production callbacks. Invitations validate the exact caller Origin against the two approved hosted app origins and return to that same origin's `/reset-password`; untrusted and missing origins are denied. Public browser credentials must belong to the canonical HORECA project; service keys remain server-side. Production password login uses the explicit `VITE_PASSWORD_AUTH` flag and hides DEV-only diagnostics.

## Permanent operational safety rule

**El Criollo is reserved for REAL PRODUCTION DATA ONLY.** Its organization is `f84168ef-2b78-451b-b0a9-39c1c381e59b`. Never load synthetic fixtures into it, globally sanitize/reset it, or target it with automated destructive tests. Shared DEV frontend access does not make El Criollo disposable.

**HORECA DEV LAB is SYNTHETIC / NON-PRODUCTION ONLY.** Its code is `HORECA_DEV_LAB`, organization ID `f7f6da70-f7dc-4b1a-aa23-f5612174dcbc`, and country/currency/timezone are ES/EUR/Europe/Madrid. It has a separate Product Owner organization-wide OWNER membership and only the `bancos` entitlement enabled. No legal identity, tax number, address or phone was invented. Its creation and purpose are recorded in Core audit. Future module streams may enable additional entitlements through controlled administration.

DEV/UAT fixtures and destructive validation must use DEV LAB or another explicitly disposable tenant. All reads and writes must carry their intended organization context; platform administration does not substitute for tenant business membership. Test fixtures must never be copied into El Criollo. DEV LAB also starts without Finance operational data.

Taquería Maravillas remains REAL and preserved. The 12 unowned legacy categories and 13 unowned legacy subcategories remain unchanged pending provenance review; they are not canonical tenant Finance catalogs.

No schema reset, migration replay, Auth wipe or automatic bank import is part of this release. The nine applied migrations remain authoritative. Before and after deployment, El Criollo accounts, imports, movements, allocations, catalogs, counterparties, rules and transfer candidates must remain empty. Exact production deployment SHA and smoke evidence are recorded separately from local quality checks. Real-data mode becomes ACTIVE only after the production smoke passes.

## Product Owner handoff

After production PASS, the Product Owner manually creates BBVA Account A, BBVA Account B, BBVA Card, Sabadell Account and Sabadell Card, then uploads real statements and creates real categories, subcategories and counterparties. Classification and totals must be checked against the bank/Excel sources. No data is loaded automatically.

## Next stream: 05 — Sales & Revenue

Finish the Sales integration cycle and integrate PR #6 into DEV separately. Obtain the current Last.app v2 Reporting/integrator credential, configure it server-side, map Last.app Organization/Location to HORECA tenant/OperationalUnit, perform a safe live read, verify Bill monetary semantics, run the first controlled real Sales sync, persist canonical Sales and verify idempotency. Sales production promotion is a separate release.

## Validation

Candidate lint: zero errors, five existing warnings. Typecheck and build pass. Full suite: 32 files passed, 424 tests passed, one existing opt-in test skipped. Origin tests reject missing and arbitrary callers; project-boundary tests accept the shared production project and reject foreign projects. Production smoke is a separate gate and must include both tenant contexts, empty Banks views/dialogs, actual login, foreign-tenant denial and unchanged RLS.
