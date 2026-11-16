# Personnel HR Extensions — production promotion

Date: 2026-11-16 (Europe/Madrid).
Validated source: `399b76fc6262fdc8cccc33c7f2645674cccfb8ad`.
Release branch: `release/personnel-hr-production`.
Production: https://horecamodular.vercel.app
Supabase: `cznauyzhtbqvqtwmfeki`.
Previous production source: `32c15f0cb71c35e3b65ede1ac419394c889a84ee`.

## Scope and release adjustments

Promotes only the validated Incidencias, Nominas and Permisos/Vacaciones package.
The three temporary DEV restrictions are lifted: HR sections are exposed inside
the existing authorized Personnel module; the API permits the known production
project after shared deployment/origin/key validation; payroll files must use the
current validated environment's storage origin. Production rejects DEV file URLs.
Caller JWT/RPC authorization and device/PIN verification remain mandatory.
No new feature, provider, dependency, authentication shortcut or unrelated module
change is included. Source branch and DEV deployment remain unchanged.

## Approved database promotion

Exactly these unchanged source migrations are promoted in order:

1. `20261116090000_personnel_hr_extensions.sql`
2. `20261116091000_personnel_hr_private_storage.sql`
3. `20261116092000_personnel_hr_push_bridge.sql`
4. `20261116110000_personnel_hr_manager_create_and_payroll_delivery.sql`

SHA-256 checksums are checked against the validated Git source and installed
migration records. Production preflight found no conflicting HR schema, bucket,
functions or migration records. All four migrations and synthetic workflows
passed a transaction rehearsal followed by rollback before application.
Existing Personnel data fingerprints, functions, ACLs and RLS were preserved.
The approved push bridge retains the original reminder eligibility function
behind an approved-leave suppression wrapper. The scheduler is unchanged.
No DEV database state or tenant seed is copied.

## Acceptance boundaries

Lint, typecheck and build passed, with six existing lint warnings. Focused tests
cover existing Personnel/security regressions and HR PostgreSQL, PDF, private-file
sharing and production environment boundaries. Local browser suites cover HR,
exact context, density and responsive behavior at 360/390/768/1024/1440 pixels,
including actual coarse-pointer targets. These browser workflows use fixtures.
Live production database acceptance uses isolated synthetic records inside a
transaction that rolls back. Storage acceptance uses one synthetic PDF with full
cleanup. Hosted checks verify the exact deployed SHA, assets and anonymous,
foreign-origin and unactivated-device denial. No production login credentials
are created; signed-in manual acceptance on a real account is not represented by
fixture checks. No real employee/HR record is edited for acceptance.

Payroll and incident native/external handoffs preserve initiation-only auditing;
recipient delivery is not claimed. Direct email from
`administracion@el-criollo.com` remains DOMAIN-VERIFICATION-REQUIRED and is not a
release blocker. No automatic extraction or separate Platform invitation fix.

Ignored evidence under `.local-data/hr-production/` records preflight checksums,
protected-data fingerprints, applied migrations, live acceptance, private storage
cleanup, exact deployment metadata and hosted checks. Deployment uses an archive
of the clean committed release source and existing production environment; no
project environment/VAPID changes or DEV alias changes are required.
