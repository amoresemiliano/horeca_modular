# Personnel attendance — presentation and production review

Subsequent repository preparation (2026-11-13): see
[Production foundation](PRODUCTION-FOUNDATION.md) and
[CCR-CORE-ENV-001](CCR-CORE-ENV-001.md). The staging-only guards documented below
are the inspected baseline; separation changes are prepared locally for review,
not integrated or deployed. The independent project remains uncreated.

Date: 2026-11-12, Europe/Madrid. Scope: three approved presentation changes and
production inspection. No production deployment or infrastructure creation.

## Baseline and delivery

Fetched origin before editing. `module/personnel` HEAD and `origin/dev` both began
at `89ae0e826d16f129526244719db7ed6a08d017f3`; `origin/main` was
`04cfc8238c0a7a2cf310e3bbccdd565bd9d072b3`. Earlier recovery documentation,
evidence and scheduler SQL edits were already dirty and are excluded from this
presentation commit. No merge or push is included in this task.

PWA: `src/modules/personnel-live/PunchApp.jsx`, separate Vite entry
`personal/fichaje/index.html`, route `/personal/fichaje/`.

Changes:

- Red in-app header and matching HTML/manifest theme `#df1733` for installed browser
  chrome. Product title remains HORECA Personal. Existing product launcher icons
  remain unchanged; the in-app customer logo is separate from the product identity.
- Original El Criollo red-on-white JPEG artwork, matching the supplied reference,
  copied from the local archived logo to `public/personal/fichaje/el-criollo-logo.jpg`.
  No redraw, crop or distortion; proportional 112px header image with useful alt text.
- The label remains entirely server-resolved. `personnel_device_command('session')`
  reads `eco_organizations.name` and `eco_operational_units.name` for the authorized
  device. Corrected only the existing DEV/UAT unit display name from El Criollo to
  Palencia 06 through the supported Supabase data API. Unit ID
  `4ef1c8e2-8abe-407b-b6f0-a5c0ffe2f7ce`, code `EL_CRIOLLO_LOCAL`, organization,
  timezone and all other unit fields are unchanged. Public Personnel and Core
  authorization/profile data fingerprints were unchanged across this correction.
  No employee/device was created or replaced; one existing El Criollo employee
  was observed and preserved. Reload the PWA to refresh its session label.

The visual source changes are local/committed only until a separately chosen
preview/release deployment. No deployment was performed here. The unit display
correction is already effective in DEV/UAT.

## Current installation and distribution

Exact existing public DEV/UAT PWA URL:
<https://horecamodular-git-dev-vegen-s-projects.vercel.app/personal/fichaje/>

This is a DEV branch alias, not the intended stable production address. No new
production PWA URL has been assigned or validated; none is invented here.

The public route, manifest, scoped service worker and 192/512 PNG icons were
checked over HTTPS. Manifest id/start/scope are `/personal/fichaje/`, name is
HORECA Personal, short name Personal, display standalone. iOS metadata and touch
icon are present. The worker caches only a static offline explanation, never
attendance requests, credentials or API responses. No offline punch queue exists.

Android: open in a supported browser and use Install HORECA Personal when the
browser exposes its prompt, or the browser menu → Install app/Add to Home Screen.
iPhone/iPad: open in Safari → Share → Add to Home Screen → keep Open as Web App
enabled where offered. Physical Android/iOS installation still needs acceptance
on the actual devices. General installation references:
[Google installation guidance](https://web.dev/learn/pwa/installation),
[Apple Safari instructions](https://support.apple.com/en-ca/guide/iphone/iphea86e5236/ios).

There is no Supabase login or back-office prerequisite to load/install this PWA.
Operating the keypad requires a valid unit-bound device activation and employee
PIN. Sharing the base URL is safe but does not grant attendance authority. Each
tablet/mobile browser context needs its own authorized one-use activation link
(ten-minute validity); do not distribute one activation link to multiple people.
Treat that link as a temporary credential. The browser subsequently receives a
Secure HttpOnly SameSite cookie, valid at most 90 days and revocable server-side.
Confirm activation persistence in the actual installed iOS context: browser and
installed-app cookie continuity is not claimed from desktop automation.

Eduardo needs a separately provisioned back-office identity/membership to manage
employees/devices. Employees remain Personnel employees, not Auth users, and get
no administrator or other-module access from activation/PIN.

## Environment and schema inspection

The accessible Supabase project inventory contains `horeca_modular_staging`
(`vmxjqwlfwnphorthhcwu`, ACTIVE_HEALTHY) and no separate HORECA production project.
Other unrelated projects were not changed. This finding is limited to the account
visible to the authenticated CLI. The existing Vercel production deployment stays
on main SHA `04cfc82`; its existence does not establish database separation.

Staging migration history contains Core baseline/authorization/provisioning/module
registry/SaaS UX, existing business migrations and both Personnel versions:
`20261110090000_personnel_attendance_foundation` and
`20261111100000_personnel_push_reminders`. No migration changed or ran here.
The initial Core migration seeds canonical roles/capabilities, not tenants. Personnel
migrations create schema/functions without seeding employees or enabling tenants.
There is no checked-in general production tenant/employee seed to replay blindly.

The reviewed production bootstrap must create a clean project and apply the
dependency-ordered Core contracts (including canonical grants, entitlements and
provisioning) before Personnel. Review the migration graph rather than apply only
the Personnel SQL to an empty database or copy staging data wholesale. Existing
other-domain schema dependencies do not justify enabling those domains or importing
their operational data. Create only the approved El Criollo organization, Palencia
06 unit, timezone, Personnel entitlement and explicit owner/Eduardo identities and
memberships through canonical provisioning. Real employee onboarding is deliberate;
do not copy DEV LAB, Auth users, device cookies, PIN credentials, sample attendance,
staging grants or staging secrets into production.

## Actual production blockers

1. Separate HORECA production Supabase project is not present in the inspected
   inventory. Its approved bootstrap, backups/restore ownership and operational
   retention must be defined before real attendance data is accepted.
2. Both `server/personnel/runtime.ts:configuration()` and
   `src/shared/config/env.ts:resolveEnv()` explicitly pin Supabase to staging.
   The browser configuration also defaults a missing URL to staging, including
   when the environment is production; its existing boundary tests encode the
   old shared-project policy. A separately reviewed Core/Personnel change must
   enforce the correct explicit project per environment, remove the production
   fallback and update those tests. Merely changing credentials would leave
   production fail-closed. Do not remove guards without replacements.
3. Production needs its own server URL/service/anonymous keys, random PIN pepper,
   PERSONNEL_ORIGIN and backend enablement; frontend Supabase configuration must
   target the same new project. Private values stay server-only. Configure Auth
   site URL/redirect allowlist/providers for the chosen production HTTPS origin;
   DEV password flags are not a production login policy. No credentials changed here.
4. Eduardo's verified Auth identity, El Criollo membership and Personnel-only
   effective access must be provisioned/tested in that clean project. No Eduardo
   identity or permission was guessed or broadened. Preserve the platform owner's
   canonical platform access and existing explicit tenant access. Platform role and
   tenant data authority remain separate contracts.
5. Select/authorize the attendance release artifact and stable production HTTPS
   origin, then perform HTTPS end-to-end and actual tablet/mobile install,
   activation, revocation and IN/OUT acceptance against the new project. Current
   main predates the Personnel implementation. This task stops before deployment.

VAPID, reminder cron, recurring schedules, geofencing and future HR features are
not blockers to the initial stable attendance-only release. Leave optional push
disabled in production unless separately approved/configured; do not copy DEV cron.

## Security and existing behavior

PINs use salted scrypt (N=32768, r=8, p=1) plus a server pepper and tenant-bound
HMAC lookup. Existing rate budgets, one-use verification permits, atomic IN/OUT,
idempotency, revision checks and immutable events are unchanged. Device/session
authority is resolved server-side; tenant/unit/timestamps cannot be supplied as
authority by the punch UI. Core-gated admin RPCs, RLS, private credential tables
and organization/unit composite references remain intact. No grants were changed.

HR_PERSONNEL includes reporting.operational.view and sensitive salary capability
in its existing template. Personnel-only navigation currently also depends on
module entitlements; keep reporting/prediction and other unwanted domain access
disabled for the intended scope or use reviewed Core grants/revokes. Do not assign
a broad OWNER role to make Eduardo's screen work. Future changes to entitlements
require a fresh effective-access check; the template alone is not a universal
Personnel-only guarantee.

Unscheduled IN/OUT remains supported: schedule association can be null; events
remain immutable and visible in the administrator's unscheduled-punch section.
No schedule requirement or client geolocation was added. IP-derived HMAC keys
already support rate limiting, not proof of physical presence. The device record
identifies its assigned unit/label; GPS/coarse location or user-agent tracking is
not implemented. Remote punching is accepted for this first release.

## Approved future design — not implemented

Scheduling: weekday rules with valid-from, optional valid-to, indefinite recurrence
and dated overrides. Example: Mon–Fri 10:00–17:00 from date X indefinitely, with
2026-11-18 overridden to 12:00–19:00. Existing individual versioned shifts do not
implement recurrence/exception rules.

Push: entry/exit reminders must check actual attendance before each delivery;
suppress when the expected event exists. At most initial reminder, approximately
+15 minutes, approximately +30 minutes, then stop. Existing WP-PERS-002 foundation
has subscription persistence, VAPID transport and state-aware one-attempt claims
for ENTRY/START/EXIT; it does not implement this newly approved retry policy.
No push, absence, incident, documents or self-service code was added here.

## Evidence and handoff

Evidence: `docs/evidence/personnel-release-review/`. Browser regression uses the
actual local PWA with mocked APIs, explicitly labeled synthetic; screenshots are
not claims of a newly deployed preview. Live inspection and canonical unit-label
correction have separate JSON evidence. Earlier hosted WP-PERS-002 evidence remains
in its original directory. Presentation changes do not alter backend/PIN logic.

Verification: lint passed with six pre-existing warnings; typecheck and build
passed. Focused Personnel, environment-boundary, Finance wiring and Sales
LastAppRateBudget checks passed: nine files, 73 tests. The PWA browser regression
passed all eleven checks, including branding, original proportions, six widths,
activation/session, IN/OUT, observation, uncertain retry, offline and revoke.
Two full-suite attempts encountered existing timing limits (PGlite/Sales setup;
the second also scrypt and two unchanged boundary/wiring tests). All affected
suites passed in the focused run; no timeout or assertion was changed. The full
suite is therefore not reported as green for this task. `git diff --check` passed.

Recommended next action: approve one separate production-foundation work package
covering environment separation, canonical bootstrap/access and the explicit
backend project guard before any production release.
