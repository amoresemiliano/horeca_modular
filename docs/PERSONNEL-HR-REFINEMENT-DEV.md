# Personnel HR refinement — DEV acceptance

Date: 2026-11-16 (Europe/Madrid).
Branch: `feature/personnel-hr-extensions`.
Start SHA: `cd3cf083883cf460ae591c3bf591582582b323fa`.
DEV: https://horecamodular-git-dev-vegen-s-projects.vercel.app
Supabase: `vmxjqwlfwnphorthhcwu`.

## Authorized database boundary

Exactly one migration was applied to DEV:
`20261116110000_personnel_hr_manager_create_and_payroll_delivery.sql`.
It extends `personnel_hr_admin` with manager `leave.create` and
`payroll.delivery.initiate`. Existing function body, identity and ACL are
preserved. No tables, grants, RLS, other RPCs or existing operational records
changed. Manager initial decisions reuse the existing decision workflow.
Delivery audit records initiation, never recipient delivery or receipt.

## Refinements

Payroll has accessible open/download/send icons. Downloads retain the original
private PDF. Sharing prepares a file, supports native file sharing, and provides
manual email/WhatsApp attachment handoff with initiation audit. Signed links
are short-lived and never inserted into external application intents.

Incidents retain their existing actions in a compact row and denser modal.
The generated PDF includes authorized tenant branding, summary, description,
objective, chronological follow-ups, scoped communication/receipt information,
and generated Madrid time. Other tenants never inherit El Criollo's logo.
A trusted canonical branding lookup runs only after incident authorization.

Permissions have manager creation and consistent filters/modal structure.
The single page-level refresh updates Personnel and HR. No attendance,
scheduling, PIN, activation, push, authorization or tenant behavior is changed.

## Sender limitation

No usable application mail transport or verified sender credentials were found
for `administracion@el-criollo.com`. Supabase Auth SMTP is not an application
payroll sender. Application sender/domain verification and securely provisioned
approved-provider access remain required before direct sending. No new provider,
spoofed sender, email or WhatsApp message was introduced or dispatched.
Native/manual handoff requires the user to attach/send and verify the recipient;
it does not assert delivery. Existing incident email/WhatsApp remain app intents.

## Verification

- Focused Personnel/HR suite: 14 files, 116 tests passed before final branding
  hardening; the final transport/refinement rerun passed all 17 tests, including
  the additional authorization-before-branding regression.
- Existing attendance/recurrence/PIN/activation/push security regressions passed.
- Live DEV manager creation, decision and payroll audit checks passed inside a
  rolled-back transaction; all synthetic records were removed and existing
  Personnel/HR data hashes remained unchanged.
- Private storage regression passed: anonymous/public access denied, scoped
  signed download worked, temporary PDF fully removed.
- HR browser fixtures passed 45 actions; context/density and acceptance browser
  regressions passed. Widths: 360, 390, 768, 1024, 1440; actual coarse-pointer
  icon targets reach 44px. No horizontal overflow.
- Branded PDF rendered and visually inspected in the local browser viewer.
- Lint/typecheck/build passed; six pre-existing unrelated lint warnings remain.

Evidence is ignored under `.local-data/hr-evidence/` and
`.local-data/hr-refinement-*.json`. Browser fixture acceptance is local; hosted
checks validate deployed routes and unauthenticated security boundaries, without
creating production credentials. Production deployment, data, storage and
configuration remain unchanged. Deployment is Preview/DEV only; the release
report records the exact final commit and deployment ID.
