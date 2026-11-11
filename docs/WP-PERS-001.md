# WP-PERS-001 — Attendance MVP and installable Personnel PWA

Date: 2026-11-10, Europe/Madrid. Branch: `module/personnel`.
Inspected source: `45ca49ad9680701e55ef3b17e9be3ba2ba92cfcb`.
Fetched/verified current origin/dev: `e9423023a656244fb2d30b65920c6091fd48784f`.
No dev/main merge was required or performed.

During implementation the remote module branch advanced through four upload commits
to `adcf24372b0fa85667fc99d17480ba047b98de2a`. They add only the
`personnel-ai-studio/` reference tree; root runtime/configuration/schema files are
unchanged. Publication preserves those commits unchanged by rebasing the unpublished
WP commit onto that module head. The reference tree is not imported by either root
production entry, and its separate dependencies are not installed or deployed here.
Tailwind's automatic scanner initially picked up classes from that reference tree.
`src/index.css` explicitly excludes only `../personnel-ai-studio` from class detection,
preserving the pre-upload application stylesheet without modifying the reference files.
Reference: [Tailwind source exclusions](https://tailwindcss.com/docs/detecting-classes-in-source-files#ignoring-specific-paths).

## Delivered boundary

Production adapters cover employees (not application users), versioned employment,
multiple unit assignments, expected schedules, generated/reset PINs, authorized
devices, immutable IN/OUT facts, optional observations, attributed corrections,
Today and bounded attendance history. The same existing Core shell and authorization
presentation select the production administration workspace only when explicitly enabled.

The published prototype remains available with its synthetic services and future
HR journeys. Payroll, medical/identity documents, absence/incident workflows,
notifications and Bluehost have no production adapter in this WP. The live workspace
marks these areas pending and never passes synthetic fixtures into persistence.

## Source map

- `supabase/migrations/20261110090000_personnel_attendance_foundation.sql`: one
  unapplied, transactional migration, private secrets/attempts/audit and public facts.
- `server/personnel/`: Node-runtime scrypt, token hashing, fail-closed configuration,
  strict same-origin validation, trusted/caller client construction and safe RPC errors.
- `api/personnel.ts`: authenticated administration; Core rechecked in each DB command.
- `api/personnel-punch.ts`: separate device-only HTTP boundary, never app authorization.
- `src/modules/personnel-live/`: HTTP adapters, production admin workspace, editors,
  standalone punch UI. No client-side employee credential map.
- `personal/fichaje/index.html`, `public/personal/fichaje/`: second Vite entry,
  install manifest/icons, narrowly scoped offline fallback.
- `tests/integration/personnel_attendance_postgres.test.ts`: real ephemeral PostgreSQL
  tests; `tests/unit/personnel_*`: crypto, HTTP and projection/artifact contracts.
- `tests/personal/`: retained prototype browser suite plus PWA and production-admin
  synthetic browser harnesses. Test aliases are never application entry points.

## Migration order and rollout

1. Master verifies canonical Core baseline and `can_execute_capability_for_org`,
   module entitlement metadata, `core_can_read_unit` and current identities/scopes.
   This branch inherits the already versioned Core migrations; it does not alter them.
2. Review/apply **only** `20261110090000_personnel_attendance_foundation.sql` through
   the Master process, after a rollback/backup and ownership review. No tenant seeds,
   Core grants/capabilities, real employees, devices or PINs are included.
3. Set backend-only `PERSONNEL_BACKEND_ENABLED=true`, exact HTTPS `PERSONNEL_ORIGIN`,
   canonical `SUPABASE_URL`, server role/anon keys and a random secret
   `PERSONNEL_PIN_PEPPER` of at least 32 characters. Provision secrets externally;
   no secrets are supplied here. Changing the pepper requires resetting all PINs.
4. Set `VITE_PERSONNEL_ATTENDANCE_ENABLED=true` only for the reviewed integration.
   Both flags default off. Keep the existing `personal` entitlement and effective
   Core capabilities; these flags grant no authority.
5. Verify with synthetic HORECA DEV LAB fixtures and a reviewed HTTPS preview.
   Master separately authorizes production deployment, employee onboarding and devices.

`git.deploymentEnabled["module/personnel"]=false` is retained. No deploy command,
shared Supabase command, real employee creation, or migration application occurred.

See [domain](PERSONNEL-ATTENDANCE-DOMAIN.md), [security](PERSONNEL-PUNCH-SECURITY.md),
[PWA](PERSONNEL-PWA.md) and [readiness](PERSONNEL-PRODUCTION-READINESS.md).
