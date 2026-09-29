# WP-FIN-001 Master deployment and readiness review

Date: 2026-09-29. Technical hosted verification: **PASS**. Product Owner access:
**BLOCKED pending human Auth activation**. PR #2 is technically **READY_FOR_REVIEW**
through the normal integration gate; it remains draft and unmerged.

## Reviewed source and deployment

- GitHub `origin/dev` was verified at approved Core
  `a83f4040e43a10e0510efbf3954edb7e17d3c763`; the Finance target contains this ancestor.
- GitHub PR #2 was inspected directly: draft, open, unmerged, base `dev`, head
  `module/finance` at `c3838c54624f184c18b132d6c5d6bdeae5113947`.
- Master published the Core runtime correction as
  `9ddba38f70f2ecd5355631b2fed04498ccc5d8b8` before hosted Finance verification.
  The subsequent small context cleanup clears stale profile/organization selections
  while a new resolution is pending and removes the ref-cleanup lint warning.
- CLI link and every hosted script enforce HORECA DEV `vmxjqwlfwnphorthhcwu`.
  No production, main, MICA or Finance branch write was performed.
- Preflight found the ten Finance tables absent, Core prerequisites and the CCR gate
  present, and exactly the two approved Core history entries. Nine legacy tables were
  fingerprinted before deployment.
- The isolated deployment package contains the three active SQL files extracted
  byte-for-byte from the Finance review SHA. The obsolete 20260919 draft is archived
  and was not applied or marked applied. The Finance SQL contains no MICA reference,
  does not alter Core tables/grants, and calls the canonical organization gate.
- Dry-run showed exactly `20260928010000_finance_atomic_bank_import.sql` pending.
  Master applied it successfully. SQL SHA-256:
  `86e1f113321703bf4a48247a4723f2fa552b5122340d67120e0c49dda2e7976a`.

The post-deployment history is Core baseline, CCR, then Finance. Deployment-package
dry-run reports no pending migrations, seeds or roles. The root `dev` migration
directory intentionally still contains only Core until Finance passes its normal
integration gate; do not repair history or deploy the older root queue to undo this.

## Core runtime acceptance

AuthContext no longer selects or maps `holding_id`, invents capabilities for legacy
`SUPERADMIN`, or enables absent entitlements. Role-template grants and member grants
are candidate capabilities; the deployed `can_execute_capability_for_org` gate checks
each candidate for active role/membership, scope, entitlement and revoke precedence.
Authorization query errors fail closed. Context transitions clear authority and stale
async results cannot restore a superseded context. Auth reads run outside the Supabase
Auth event callback lock.

One active organization may auto-select. Multiple organizations require an explicit
selection, with a visible selector placeholder; no first-member or privileged-role
fallback applies. Organization switching remains available, with backend write checks
authoritative. The module entitlement helper requires an explicit enabled row without
changing the public application shell.

Normal browser password login with a genuine temporary Auth user resolved profile,
membership, El Criollo, role capabilities and enabled bancos; Finance received its
explicit organization ID and successfully called the confirmation RPC. Both browser
runs recorded zero page errors; the import run recorded zero failed Supabase responses.
No `holding_id` PostgREST error or cross-project fallback occurred.

## Hosted behavior, separate from local tests

Actual Supabase Auth password sessions and authenticated PostgREST clients exercised:

- OWNER, MANAGER and ADMINISTRATIVE confirmation allowed; default accountant,
  consultant, inactive membership, foreign organization, explicit revoke and disabled
  bancos denied. A genuine platform role with no tenant membership saw no organizations
  and could not confirm. The temporary entitlement change was restored in `finally`.
- Direct authenticated INSERT into imports, files, rows, movements and allocations
  denied with SQLSTATE 42501; direct allocation UPDATE and DELETE also denied.
  Anonymous confirmation denied. Service role was used only for fixture provisioning,
  inspection and cleanup, never as the identity proving business authorization.
- A valid first row followed by malformed money in the second row failed the entire
  hosted transaction. Import/file/row/movement/allocation counts were unchanged and
  the new SHA had no import, partial or completed.
- Exact reimport returned the same import ID and persistedCount 0, with all counts
  unchanged.
- Two separately authenticated clients released from one barrier confirmed the same
  fresh SHA concurrently, repeated three times. Each pair returned counts 2 and 0 and
  the same import ID. Each result had one import, one file, two rows, two movements and
  two allocations. This was actual hosted HTTP concurrency, not embedded PostgreSQL.
- Reload preserved tenant, account/import IDs, dates, decimal amount, currency,
  direction, description, balance, source row, fingerprint, native/reference IDs,
  minimized provenance and overlap status. SQL NULL valueDate reloaded as NULL.
- Category/subcategory/counterparty persisted; balanced split totaled exactly -1025
  cents while source facts stayed byte-for-byte equal. Unbalanced split rejected
  atomically. Deterministic rule suggestions remained editable, left reconciliation
  UNMATCHED and did not alter the source BankMovement.

## Browser and fixture readiness

The browser ran a local, isolated copy of Finance SHA `c3838c5` with the Master Core
runtime overlaid, against hosted HORECA DEV. This is a composed review build, not a
claim that the unmerged Finance branch or deployed Vercel UI already contains Core.
The existing `VITE_DEV_PASSWORD_AUTH=true` flag was enabled only for this local build.

Through normal UI controls the temporary user created BBVA A/B accounts, BBVA card,
Sabadell account/card, income and expense categories, subcategories and a counterparty.
Synthetic last4 `0000` was used only for disposable test accounts; no actual Product
Owner account identifiers were invented. Each sanitized source passed file selection,
preview, explicit target-account choice, confirmation and reload:

| Fixture | Persisted rows | Rejected |
| --- | ---: | ---: |
| BBVA Account A | 149 | 0 |
| BBVA Account B | 234 | 0 |
| BBVA Card | 84 | 0 |
| Sabadell Account | 2 | 0 |
| Sabadell Card | 7 | 0 |

Browser exact reimport added zero movements. UI classification of income/expense,
subcategory and counterparty survived reload. A UI split balanced exactly. A UI-created
rule produced SUGGESTED classification, was edited normally, then reloaded with unchanged
source facts and UNMATCHED reconciliation. No Product Owner real bank file was used.

Nonblocking review observation: the reviewed Finance toolbar renders `Cuentas y categor?as`;
its modal renders the correct label. This encoding detail did not prevent the workflow.

## Drift, cleanup and real tenant

A fresh embedded replay of the exact three SQL files was compared with hosted catalog
data: 21 tables, columns, constraints, RLS, grants, Core/Finance function bodies and ACLs,
role registry, capabilities and default bindings matched. Comparison normalized CRLF/LF
and reproduced Supabase's existing service_role default function EXECUTE grant locally;
it did not remove an authorization difference from the check. All nine legacy table
counts and full-row content hashes matched before deployment and after cleanup.

Every tracked temporary import, movement, allocation, account, catalog, rule, membership,
profile and Auth identity was removed in dependency order. The temporary Auth user was
deleted through Auth Admin API and absence verified. All ten Finance tables contain zero
rows for El Criollo after cleanup, so technical fixtures do not pollute real UAT.

The legitimate tenant retained is `EL_CRIOLLO`, display name El Criollo, trade name
Taquería El Criollo, country ES and currency EUR. Legal name and tax ID are NULL.
No legal address or operational unit was fabricated. The existing schema's tax_id_type
default is only a type label, not a confirmed tax identity.

`emilianodirosa1+horeca-dev@gmail.com` did not previously exist in HORECA DEV. It was
created through Auth Admin API without a password and without marking email verified.
It has an active profile, active OWNER membership with organization-wide scope, enabled
bancos entitlement and no platform assignment. No direct Auth-table writes or MICA
identity reuse occurred.

**Minimum human action:** in the HORECA DEV Supabase Auth dashboard, send this user a
password recovery/setup email with the intended DEV application redirect and complete
the email/password setup. No recovery email or secret link was sent or exposed by this
task. The reviewed Finance + Core UI must then follow its normal integration/preview
gate; PR #2 has not been merged. Do not use its old preview as evidence of Core readiness.

## Quality and evidence

- Core: lint zero errors (14 existing warnings), TypeScript and build pass; 152 tests
  pass, one opt-in hosted test skipped.
- Composed Finance + Core: lint zero errors, TypeScript and build pass; 251 tests pass,
  one opt-in hosted test skipped. The initial composed lint included the subsequently
  removed Core cleanup warning, plus 11 existing warnings.
- Sandbox process restrictions required elevated reruns. An initial parallel local
  run timed out; the final serial runs passed. These local results are not hosted proof.
- Hosted security/atomicity/idempotency/concurrency, browser evidence, fixture hashes,
  drift and cleanup are separately recorded in
  [WP-FIN-001-HOSTED-EVIDENCE.json](WP-FIN-001-HOSTED-EVIDENCE.json).

Result: Master technical prerequisites are verified and Finance PR #2 is ready for
normal review. Product Owner access remains pending human Auth activation and delivery
of the reviewed UI through that gate. Real-file UAT has not been performed or signed off.
