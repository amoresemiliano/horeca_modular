# Personnel production readiness — WP-PERS-001

Code/contract delivery for Domain Review and Master integration; **not enabled or deployed**.
Final validation evidence is dated 2026-11-11 (Europe/Madrid).
Shared Supabase `vmxjqwlfwnphorthhcwu` remains canonical for DEV/PROD by PO decision.
No connection, migration application, real employee, PIN, device or production datum was
created during this WP. PostgreSQL checks run in disposable local PGlite fixtures only.

## Review gates

| Area | Delivery / gate |
| --- | --- |
| Employee foundation | Organization-scoped employees separate from Auth; employment history, multiple unit assignments, optimistic revision and deactivation. |
| Schedules | Versioned future edits, historical lockout, overlap serialization, overnight instants/zone snapshots, DST gap/repeated-hour rejection. |
| PIN | Backend scrypt + server pepper, tenant-bound private HMAC lookup, reset revision invalidation, one-time plaintext response. |
| Devices | Ten-minute single-use activation, separate random HttpOnly cookie, unit scope, 90-day expiry and revocation. |
| Punch command | One-use verification permit, atomic revalidation/commit, immutable facts, generic rejection, distributed counters, duplicate/idempotent behavior. |
| Projection | Derived minutes/variances, explicit stored schedule instants, Today, bounded date-range history, attributed correction overlay. |
| PWA | Separate multipage entry, manifest/icons, standalone/iOS metadata, no roster/admin, explicit offline failure, scoped static fallback. |
| Core | Existing employees.manage / fichajes.audit / salaries.read only. No capability/role/entitlement mutation, no CCR required for this org-admin MVP. |
| RLS | All new relations RLS-enabled; table writes/secret reads denied to browsers; Core-gated definer RPCs; composite tenant/unit constraints. |
| Quality | Logs and synthetic browser screenshots in `docs/evidence/wp-pers-001/`; retained prototype tests remain required. |

## Master-owned remaining actions

Review/apply the versioned migration (order in WP-PERS-001), provision server secrets and
explicit flags, review the unit-timezone inheritance policy, tune matching/attempt budgets,
define retention/monitoring, run DEV LAB HTTPS end-to-end verification and real mobile install
checks, then separately authorize deployment and real onboarding. Existing capabilities are
organization-scoped: unit-limited HR administration remains fail-closed and is not silently
expanded. The hourly-cost field is optional and not required to onboard attendance.

Employment edits close a prior assignment and append a successor; this is an MVP record
history, not a complete backdated contract amendment engine. Attendance UI assumes one
effective interval per scheduled shift; advanced breaks/split shifts and multi-session
aggregation are explicitly deferred. Schedule association uses a documented ±4-hour window;
original unscheduled events remain facts. Long-open sessions are never silently closed.

Payroll, documents/Bluehost, medical/absence/incident workflows and notifications remain
prototype-only/pending. This branch neither enables those persistence paths nor deletes
the validated design. The synthetic prototype SHA and its previous publication evidence
are preserved in history and `docs/evidence/personnel-publication/`.
The concurrently uploaded `personnel-ai-studio/` tree is preserved as an upstream
reference only; this WP neither adopts its standalone app nor adds it to root build inputs.

`READY_FOR_MASTER_INTEGRATION` means reviewable source and unapplied contracts are ready
for the next controlled integration step. It does not certify live infrastructure, a
mobile store release, real HR data readiness, or permission to apply migrations/deploy.
