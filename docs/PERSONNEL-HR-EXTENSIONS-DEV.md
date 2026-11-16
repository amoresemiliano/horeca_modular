# Personnel HR Extensions — DEV acceptance

Branch: `feature/personnel-hr-extensions`.
Start: `32c15f0cb71c35e3b65ede1ac419394c889a84ee`.
Isolated worktree: `08_horeca_personnel_hr_dev`.
Target: DEV/UAT `vmxjqwlfwnphorthhcwu` only.
Review origin: https://horecamodular-git-dev-vegen-s-projects.vercel.app

## Functional slice

Incidencias supports organization-configured types and severity, employee/date,
description/objective, open/follow-up/closed status, append-only dated manager
entries, employee-profile history and downloadable text PDF. No business types or
policies are seeded. Managers configure the catalogs through their administration
modal before use. PDF generation runs locally on the server without a document
provider; Helvetica/WinAnsi supports Spanish text and visibly replaces unsupported
characters. Documents include manager display names, not system UUIDs.

Email and WhatsApp open the manager's application with a neutral message and the
PWA origin. They do not send automatically, attach PDFs automatically, certify
delivery, or embed incident text/tokens in URLs. A protected sharing event records
channel, contact destination, manager, time and immutable communication revision.
Employee receipt is PIN-confirmed through the activated PWA. It explicitly means
receipt, not agreement. Manager-only follow-up entries are excluded from employee
responses. The PWA uses a scoped action, rather than introducing bearer share links.

Nóminas supports private PDF upload (2 MB), employee/month, duplicate rejection,
explicit replacement with retained old PDF and review metadata, 60-second signed
downloads and auditable manual review of the requested payroll fields. Blank fields
remain missing. Provenance is assigned by the database. No approved local PDF text
extraction/OCR tooling exists in this package: automatic extraction is **BLOCKED**;
manual structured entry works. No PDF or payroll text is sent to external services.
Only PDF header/size checks are performed, not malware analysis or OCR.

Permisos supports configured types, own PIN-confirmed PWA requests, manager
approval/rejection/proposal, employee accept/decline and pending-request cancellation.
The complete before/after audit is retained. Manager notes are excluded from PWA
responses. PWA consultations, notes and PINs clear on hide/lock/timeout; each action
requires its own PIN verification and consumes an existing bounded proof attempt.
No new login, employee identity or phone authorization is introduced.

## Integration and security

All HR tables are private, RLS-enabled, with no direct anon/authenticated table
access. Admin RPCs use existing `personnel_admin_allowed(org,unit)`. Employee RPCs
are service-role-only and validate the existing activated cookie, PIN proof,
credential revision, active employee, unit assignment and Personnel entitlement.
No change to roles, Core capabilities, tenant memberships or activation rules.
The API also refuses non-DEV Supabase targets; HR navigation is excluded from
production builds pending a separate promotion review.

Approved leave is a read-only overlay in schedules/attendance. It marks approved
leave instead of unexplained missing entry when no punch/correction exists.
Original shifts, recurrence, punches and corrections are retained. A narrow wrapper
around existing reminder eligibility suppresses reminders for approved leave;
underlying timing, punch rechecks and subscription rules remain intact.

Manager decisions enqueue private push events and use existing opted-in, scoped
employee subscriptions. The send path revalidates active devices/employees and
entitlements, records provider status, prevents duplicate claims and handles
404/410 cleanup. Notification text is neutral and contains no HR details. Decision
persistence is independent of provider success; failures are reported to managers.
There is no new external messaging/AI provider or automatic outbox retry scheduler.

## Migrations and DEV verification

Only these additive migrations are applied, individually and transactionally:

- `20261116090000_personnel_hr_extensions.sql`
- `20261116091000_personnel_hr_private_storage.sql`
- `20261116092000_personnel_hr_push_bridge.sql`

The private Storage bucket has a restrictive deny policy for anon/authenticated,
including protection against inherited permissive policies. Caller-scoped commands
authorize every short-lived signed download. Prior file versions retain the same
protection. The service role remains server-only.

Live DEV checks exercise synthetic incident/follow-up/share/receipt, payroll review,
leave proposal/acceptance and employee response privacy inside a rolled-back
transaction. Existing employees, schedules, punches, devices and PIN fingerprints
are unchanged. A separate synthetic PDF is uploaded, checked against public/anon
read denial, downloaded through a 60-second signed URL, then fully deleted.
No test business records are retained. Catalogs are intentionally empty initially.

Focused Personnel unit/integration suite: 13 files / 103 tests passed. Coverage
includes RLS/private grants, tenant/unit/employee boundaries, proof replay and
revocation, immutable incident audit, acknowledgement, payroll versions/provenance,
storage restrictive policy and leave workflows/push claim/invalid-provider cleanup.
Lint/typecheck/build pass; six existing unrelated lint warnings remain.
The HR browser suite and existing density/exact-context/acceptance browser suites
pass with isolated fixtures. Responsive HR checks: 360/390/768/1024/1440 px.
Evidence is ignored under `.local-data/hr-evidence/` and `.local-data/hr-dev-*.json`.

The live Preview check caught prototype-backed Node request headers being lost
when the upload guard copied the request with object spread. The handler now
forwards method/headers explicitly; a transport regression covers this case.

DEV still lacks recurring schedule tables/RPCs. This package does not install the
inherited recurrence migration. HR leave context works independently of recurrence;
recurrence interactions remain covered by unchanged ephemeral regression tests.
Actual push delivery to a real opted-in DEV handset is not certified by the mocked
provider/browser tests; no new employee subscription is created for testing.

Production deployment, production database/storage changes, and the unrelated
Platform invitation/Edge Function issue are outside this package and not performed.
