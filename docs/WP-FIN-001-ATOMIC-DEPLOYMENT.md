# WP-FIN-001 — Finance implementation and Master deployment request

Status on 2026-09-29: implemented locally; **PARTIAL, not hosted verified or UAT ready**.
Draft PR #2 remains the only delivery PR (`module/finance` -> `dev`).
Approved Core `a83f4040e43a10e0510efbf3954edb7e17d3c763` was merged without rewriting
Finance history. CCR-FIN-001 is resolved and consumed, not a pending authorization design.

## Deployment request to Master

Please review and apply only `supabase/migrations/20260928010000_finance_atomic_bank_import.sql`
from the reviewed Finance commit after the two approved Core migrations. Shared migration
execution belongs to the Development Captain under `.agents/skills/horeca-delivery/SKILL.md`.
No Finance deployment or hosted Finance test was performed by this module task.

Target: **vmxjqwlfwnphorthhcwu**, **horeca_modular_staging**, HORECA shared DEV.
Do not use MICA (`ourzapkjykzlwsjunzmd`), main, or production. Before application, verify
the linked project and migration history. The read-only hosted Finance audit confirmed all ten
Finance tables absent; the migration therefore deliberately fails if any already exists.
Re-run `supabase/audits/ccr_fin_001_finance_schema.sql` immediately before deployment.
Use a deployment workdir containing only the approved Core history and this Finance migration;
inspect the dry run and stop on any unexpected pending migration. Do not mark archived history applied.
After application, check migration drift and run the hosted matrix below.

The previous 20260919 Finance draft is retained unchanged under `supabase/history/finance_drafts/`
for audit, outside the active migration directory. It must never be executed.

## Implemented contract

The atomic confirmation RPC authorizes the authenticated caller and explicit organization
through `can_execute_capability_for_org(...,'STATEMENTS_IMPORT_CONFIRM')`, which enforces bancos.
It locks and validates the final account (tenant, active, institution, product), reserves the
exact SHA-256 under a tenant unique constraint, and persists import/file/rows/movements/initial
allocations in one transaction. A failed row rolls everything back. Concurrent exact-file
reservations wait on the unique index; after the winner commits the loser returns the same import
with zero persisted movements. This algorithm still requires the real two-session hosted test.

Money crosses the RPC as decimal strings and is stored as NUMERIC(14,2); missing/malformed values
raise errors. Null value dates stay SQL NULL. The server computes the fingerprint from the final
account and canonical values. Fingerprints have a nonunique index: matching movements in another
file remain present as potential overlaps. Level B suppression is not enabled without a proven identity.
Rejected rows store only row number, controlled error code, static reason and parser type.
Original private filenames and raw banking rows are not persisted.

Authenticated browsers have no INSERT/UPDATE/DELETE privilege on canonical imports, files, rows,
movements or allocations. Tenant catalogs use Core-controlled RLS. Classification and splits use
separate `financial.allocation.edit` RPCs and bancos entitlement. Composite tenant foreign keys
prevent foreign category/subcategory/counterparty references. Splits require exact decimal balance
and preserve source facts. Rules use priority/creation/id ordering, produce editable SUGGESTED
allocations, and never confirm reconciliation. Privileged RPCs pin search_path to pg_catalog,
reject unauthenticated callers and deny PUBLIC/anon execution; no generic SQL/test harness exists.

The UI supports account/card creation with last four digits only, income/expense categories,
subcategories, counterparties, allocation selection, balanced splits and rule application.
Canonical imports use one RPC; the obsolete multi-request writer was removed. Historical reload
paginates and propagates errors instead of reporting an empty successful result.

## Verification boundaries

Local embedded PostgreSQL executes the approved Core SQL and actual Finance migration. Only the
external auth FK target is replaced by a local test identity table; no auth.users writes occur.
Tests cover the three authorized roles, missing grant, explicit revoke, disabled entitlement,
inactive membership, foreign tenant/account, wrong institution/product, RPC ACL, denied direct
writes, atomic rollback, exact reimport, retained fingerprint overlaps, final account identity,
null valueDate, decimal money, minimized rejections, classification, splits and rules. All five
synthetic BBVA/Sabadell source fixtures parse and persist. Repository/UI-service tests are mocked
and never access live Supabase. PGlite is not a hosted or concurrent-backend proof.

Local results: full suite 246 passed, one hosted opt-in test skipped; TypeScript passed;
lint has no errors (11 existing warnings); production build passed with existing bundle-size
and Browserslist warnings. No browser UAT or live Finance success is claimed.

## Core follow-up required before UAT

`src/context/AuthContext.jsx` selects `eco_organizations.holding_id` (around line 110), but the
approved minimal Core baseline has no holding_id column. PostgREST rejects the membership query,
preventing active organization context. Master must reconcile this protected Core runtime/schema
contract in a Core-owned change. Finance does not add an invented hierarchy column or edit Core.
The deployed baseline also has no real tenant/user/membership/entitlement bootstrap; Master must
provision the intended UAT tenant and Product Owner identity using the approved Auth workflow.
No synthetic customer tenant or direct Auth-internal write was introduced.

## Hosted acceptance matrix for Master

Use explicitly provisioned disposable identities through Supabase Auth Admin API and minimized
public tenant fixtures. Never write auth.users or expose a SECURITY DEFINER test harness. Test as
actual authenticated callers, not service-role bypass. Track fixture IDs for dependency-ordered
cleanup; delete temporary Auth identities through the Auth API after public fixture cleanup.

1. OWNER, MANAGER and ADMINISTRATIVE + bancos each confirm a synthetic statement.
2. Missing confirmation grant, EXTERNAL_ACCOUNTANT, foreign organization, platform admin without
   tenant membership, inactive membership, explicit revoke and disabled bancos each deny.
3. Direct INSERT to movements/imports/files and direct allocation edits deny. Cross-tenant reads
   return no rows; foreign classification/catalog writes deny.
4. Import two rows with the second invalid: all import/file/row/movement/allocation counts remain
   unchanged and no COMPLETED import appears. Repeat with an invalid classification FK in a split.
5. Read the valid persisted movement: org/account/import, dates (including NULL), amount, currency,
   direction, description, balance, source row, fingerprint, native identity and provenance agree.
6. Reconfirm identical hash: same import ID, persistedCount=0, unchanged row counts.
7. **Two independent authenticated HTTP clients**, released together, confirm a new identical hash.
   Both responses complete: one persistedCount=N, the other 0 and same import ID. Query counts:
   exactly one completed import/file, N movements and N initial allocations, no partial rows.
   Repeat several times with fresh hashes; do not substitute sequential calls or one PGlite connection.
8. Different file with equal economic facts remains as overlap; distinct BBVA A/B accounts produce
   distinct fingerprints. Save category/subcategory/counterparty, balanced split and deterministic
   rule suggestion; reload all classifications; canonical facts remain unchanged.
9. Verify public/anon RPC denial, authenticated execution, table RLS and migration drift. Remove
   only tracked temporary test data. Record hosted evidence without tokens or raw statements.

## Product Owner UAT after Master prerequisites

1. Sign in to the provisioned tenant, open Finance / Extractos, use **Cuentas y categorías** to
   register separate BBVA A/B bank accounts, BBVA card, Sabadell account/card using names and last4.
   Add one income category, one expense category and their subcategories.
2. Import each real source privately. Review parser family, accepted/rejected counts and account;
   explicitly choose the correct account when ambiguous. Confirm and reload the page.
3. Reimport the same file: zero new movements. Confirm a different overlapping export and review
   potential overlaps rather than assuming they are duplicates.
4. Use **Clasificar** on one expense and one income; select category, subcategory and optional
   counterparty. Save, reload, and verify. Split another movement into exactly balanced allocations,
   then classify individual lines.
5. Create a rule from a movement, apply rules to pending allocations, review suggestions and edit
   one. Reload and verify persistence. Reconciliation requires its separate human action/capability.

Keep original real bank exports out of Git, logs and shared test artifacts.
