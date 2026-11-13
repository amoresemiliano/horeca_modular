# HORECA Modular production foundation

Date: 2026-11-13, Europe/Madrid. Start SHA
`ba9b2d9c16bb3a582526512c21374fefe4c1111b`; DEV base
`89ae0e826d16f129526244719db7ed6a08d017f3`. Module branch only. No cloud project,
production Auth account, deployment, alias, remote configuration or remote data
was created or changed. Prior recovery working-tree edits remain separate.

Closing fetch: remote DEV independently advanced to
`58eb3fec94c43cec5c0fe15fd6ad69ba9e6c2cb6` (global favicon only: index.html and
public/horeca-favicon.png). The delta has no shared-config, schema, auth or
Personnel overlap. It is preserved on DEV and not merged/rebased here; this
foundation remains based on the stated module start. Remote main remains
`04cfc8238c0a7a2cf310e3bbccdd565bd9d072b3`.

**Repository foundation prepared; live foundation BLOCKED by the uncreated
production project, real identity bindings/secrets and Core/Master integration.**
No Personnel deployment is authorized by this document.

## Infrastructure actually inspected

Supabase CLI inventory exposes `horeca_modular_staging`, project
`vmxjqwlfwnphorthhcwu`, ACTIVE_HEALTHY, and no separate HORECA production project.
This conclusion is limited to the authenticated account's visible inventory.
The canonical staging unit remains Palencia 06. Read-only evidence is in
`evidence/production-foundation/infrastructure.json`.

Vercel project `horeca_modular` has verified production domain
**https://horecamodular.vercel.app**, with main deployment
`04cfc8238c0a7a2cf310e3bbccdd565bd9d072b3`. This hostname exists; it has not been
assigned a new app or database here. Intended Personnel path on that existing
origin is `/personal/fichaje/`; it is not a claim of a working production release.
The current working PWA remains DEV/UAT:
<https://horecamodular-git-dev-vegen-s-projects.vercel.app/personal/fichaje/>.

The current Vercel project supports separate Development, branch-specific Preview
and Production variable scopes. Existing variable names/targets were inspected,
not secret values. No environment variable was installed or overwritten. Public
production routing still points to the existing main release. Branch auto-deploy
for module/personnel remains disabled. No new domain is needed for this plan.
Vercel references: [environment scopes](https://vercel.com/docs/environment-variables),
[system deployment metadata](https://vercel.com/docs/environment-variables/system-environment-variables).

## Environment contract

[CCR-CORE-ENV-001](CCR-CORE-ENV-001.md) records the change to Core's former
shared-project policy. It is prepared for Core/Master review, not an assertion
of integration/design acceptance. No role templates, authorization evaluator,
RLS policies or migrations are modified.

| Setting | Development / Preview | Production |
| --- | --- | --- |
| Application identity | development or uat | production, required on Vercel Production |
| Supabase project | staging ref only | explicit independent 20-letter ref, never staging |
| URL | exact canonical staging URL; browser-only fallback allowed | explicit exact URL matching the supplied production ref; no fallback |
| Keys | staging only | newly provisioned production keys; server and browser must target the same project |
| Origins | current approved DEV/UAT origin | explicit canonical HTTPS origin; no preview/local origin |
| Deployment metadata | Production config rejected in Preview | Development/UAT config rejected in Production |

`environmentBoundary.ts` is shared by Core browser configuration and all current
server-side Supabase client constructors, including the existing Sales API. The
Sales change is solely a target/credential guard, not a domain feature or permission
change. `server/supabaseEnvironment.ts` requires production frontend/server identity
alignment. Personnel additionally requires matching APP_ORIGIN/PERSONNEL_ORIGIN,
backend enablement and a private PIN pepper. Its request Origin comparison,
POST-only boundary, no-store responses and Secure cookie semantics remain intact.
No permissive CORS was added.

Vercel system metadata must be exposed; an identified hosted runtime/build without
VERCEL_ENV is rejected. Vite validates hosted configuration before emitting a deployment artifact and
embeds trusted VERCEL_ENV metadata for the browser guard. Production back-office
execution also checks its actual browser origin. Local `vite build` without hosted
metadata is not proof of a production configuration; no local build is deployed.

Legacy JWT credentials are checked for the expected project ref and role; a
service key cannot be used as a public key. This check does not verify JWT
signatures. Supabase remains the authority. New opaque publishable/secret keys
cannot reveal their project locally, so an actual target-side Auth/API check is
mandatory after provisioning. No unverified claim of live credential isolation
is made while production does not exist.

`.env.production.example` is an intentionally incomplete, non-secret checklist.
Never copy staging credentials or `.env.local`. Real `.env*` files are ignored;
only templates are eligible for Git. New required configuration:

- Frontend: VITE_APP_ENV, VITE_SUPABASE_PROJECT_REF, VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY (or the existing public anon-key fallback),
  VITE_APP_ORIGIN and a reviewed VITE_RELEASE_SHA.
- Server: APP_ENV, SUPABASE_PROJECT_REF, SUPABASE_URL, SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, APP_ORIGIN, PERSONNEL_ORIGIN,
  PERSONNEL_PIN_PEPPER and PERSONNEL_BACKEND_ENABLED.
- Auth: explicit provider/password policy, production Site URL and exact allowed
  callback origins/routes. Existing callbacks derive from window.location.origin;
  configure the production root and `/reset-password` as needed, without DEV or
  wildcard redirects. VITE_DEV_PASSWORD_AUTH must remain false in Production.
- Keep VAPID/cron/LAST_APP_TOKEN unconfigured for the attendance-only release.
  Do not copy DEV cron, provider tokens, service keys or PIN pepper.

## Four distinct bootstrap layers

1. **Schema and canonical references:** checksum-pinned existing migrations create
   Core schema, canonical roles/capabilities and Personnel schema. Reference grants
   stay exactly as authored; no tenant or runtime record is imported.
2. **Initial trusted platform bootstrap:** production Auth accounts must already
   exist and be verified through the official Auth UI/Admin API. One-time privileged
   bootstrap binds the configured platform profile/role and an explicitly configured
   tenant OWNER. These are separate grants, even if the PO chooses the same person.
3. **Customer provisioning:** canonical Core RPCs create El Criollo, Personal-only
   entitlements, the invited/completed Personnel membership and explicit capability
   overrides. Palencia 06 uses the existing OperationalUnit table; no unit-creation
   RPC exists. No alternate Personnel tenant structure or public bypass is added.
4. **Runtime onboarding:** employees, employment details, unit assignments, new PINs,
   new device activations and actual punches are intentionally absent from bootstrap.
   The administrator creates them after production acceptance/authorization.

### Exact migration package

`scripts/production-foundation/migrations.json` pins filenames and SHA-256 digests
of canonical UTF-8/LF text. CRLF Windows checkouts are normalized to Git's LF text
before hashing and packaging; original files are not modified. This makes the
same package/checksums reproducible on Windows and Linux:

| Order | Existing migration |
| --- | --- |
| 1 | 20260926000000_horeca_core_baseline.sql |
| 2 | 20260927000000_ccr_fin_001_core_authorization.sql |
| 3 | 20260928010000_finance_atomic_bank_import.sql |
| 4 | 20261001000000_finance_classification_workflow.sql |
| 5 | 20261002000000_core_tenant_administration.sql |
| 6 | 20261002010000_core_secure_provisioning.sql |
| 7 | 20261002020000_core_legacy_fail_closed.sql |
| 8 | 20261002030000_core_module_entitlement_registry.sql |
| 9 | 20261003000000_core_saas_ux.sql |
| 10 | 20261110090000_personnel_attendance_foundation.sql |

Finance schema migrations 3–4 are unavoidable dependencies of the existing Core
administration migration, which rewrites their policies and function definitions.
The clean-database test exposed this dependency. They create empty schema, not
Finance business data or enablement. Splitting/editing historical migrations would
produce a different canonical history and is not done. Sales/Production execution
and optional Personnel push migrations are excluded. No migration is added or edited.

### Offline reproducible package

Copy `scripts/production-foundation/customer.example.json` to a private local
working location. Supply the newly approved production ref and verified production
Auth user IDs/emails for platformAdmin, tenantOwner and personnelAdmin. The example
deliberately contains nulls; Eduardo's email or production identity is not guessed.
No password, key or credential is accepted in this configuration shape.

```text
node scripts/production-foundation/plan.mjs <local-config.json> <new-local-review-directory>
```

The command validates configuration and checksums and writes an **unlinked**
isolated `supabase/migrations` workdir, bootstrap.sql, verify.sql and manifest.json.
It performs no network call and has no apply/deploy/Auth-create mode. It refuses
an existing output directory and any extra flag such as --apply. No `.temp`
staging project link is copied. Tests exercise this real command with synthetic
configuration and no credentials.

For a separately authorized execution, review the generated package, link only
that isolated workdir to the approved new project, and inspect its `.temp/project-ref`
and target migration history. Use the installed Supabase CLI's `--workdir` on every
command; never use this checkout's existing staging link. Dry-run must list exactly
the ten pinned migrations on a new database before any apply. Do not repair history
or reset databases to force a match. Official reference:
[Supabase migration deployment](https://supabase.com/docs/guides/deployment/database-migrations).

Only after independent connection/project verification, a trusted operator may set
`horeca.bootstrap_project_ref` to the reviewed ref **in the same database session**
and execute the reviewed bootstrap transaction. The setting is an explicit operator
guard, not discovery/cryptographic proof of database identity. SQL additionally
checks verified Auth ID/email bindings and clean initial customer/runtime state.
Bootstrap is not exposed as a public function or given browser write privileges.
Reruns verify exact authority/metadata and do not duplicate or silently repair drift.
Use the read-only verify.sql for subsequent checks. None of these live steps ran here.

## Exact initial production records

- Two or three verified Auth identities: platform administrator, tenant OWNER
  (may explicitly be the same identity), and a distinct Personnel administrator
  (Eduardo, once his identity is confirmed). No employee Auth account is required.
- Their canonical active profiles; one VEGEN_PLATFORM_ADMIN assignment.
- One organization: code EL_CRIOLLO, name El Criollo, ES/EUR/Europe/Madrid.
  Do not invent fiscal, address or contact facts.
- One LOCAL operational unit: code PALENCIA_06, name Palencia 06.
- Explicit organization-wide OWNER membership for the selected tenant owner.
- Explicit organization-wide HR_PERSONNEL membership for the selected Personnel
  administrator, with a completed canonical invitation/audit trail.
- Eleven explicit module entitlement rows: personal enabled; bancos, ventas,
  compras, inventario, produccion, escandallos, reporting, prediccion, documentos
  and integraciones disabled.
- Per-membership overrides: GRANT personnel.employees.manage,
  personnel.fichajes.write and personnel.fichajes.audit; REVOKE every other active
  tenant/unit capability, including reporting, documents and salary access.
- Canonical access-audit records, including the explicit initial owner binding
  in the bootstrap audit; no global role/default-grant mutation.

Platform role alone still grants no tenant business-data authority. The separate
tenant OWNER binding is deliberate, not inferred. The Personnel administrator
cannot gain platform authority, other organizations, tenant access administration
or unrelated modules when other module entitlements are enabled. Future capability
catalog/role changes require policy verification and a separately reviewed update.

## Staging data recommendation

Automatic operational migration: **NONE**. Read-only candidate IDs/counts are in
`evidence/production-foundation/staging-data-inventory.json`; no names, salary,
contact fields, PIN hashes or activation secrets were exported. These IDs are
review references, not production IDs or seed inputs.

If the PO later approves the existing El Criollo employee setup for real use,
prefer recreating only confirmed employees from the authoritative onboarding
source. Required dependencies are a production employee, approved employment
assignment and valid Palencia 06 unit assignment, with new production UUIDs and
new PIN/device provisioning. Validate spelling/identity, status, effective dates,
unit/timezone and employment fields with the PO before creating records. Keep an
explicit staging→production reconciliation mapping outside runtime identity logic
only if later selective migration is separately approved.

Do not copy staging Auth users/passwords, profiles/memberships/grants, PIN hashes/
lookup digests, pepper, devices/cookies, activation tokens, attempts, subscriptions,
cron/Vault state, attendance/corrections/observations or DEV LAB records. No staging
schedule, employment or attendance record is presumed production-authoritative.

## Security and acceptance boundary

Ephemeral PostgreSQL tests run the actual selected migrations and compiled
bootstrap. They check no-duplicate reruns, drift rejection, explicit Auth bindings,
exact effective Personnel capabilities even with every entitlement enabled,
foreign organization/unit denial, platform versus tenant authority, browser RLS,
private-schema denial and trusted device-RPC denial. Existing Personnel tests cover
IN/OUT without schedules, device activation/revoke, PIN security and immutable facts.

The PWA still has no back-office Auth provider/roster, fetches only device-scoped
context, and uses device/PIN authority. Its manifest start/scope stay relative
`/personal/fichaje/`; the same worker caches only a static offline explanation.
No origin rewrite or service-worker widening is needed for the existing production
hostname. Browser install, installed-context activation persistence and real HTTPS
IN/OUT must be accepted on the new production project before enabling real staff.
No RLS weakening, public insert policy or service key in VITE variables is allowed.
Storage is not used by initial attendance; no production bucket or storage policy
is required or provisioned. Future documents/uploads are outside this package.

## Minimal external actions and release gates

1. PO authorizes the billable independent project in the chosen Supabase organization
   and approved EU region. In Supabase Dashboard → New project, choose the production
   project name (proposed: horeca_modular_production), store its new database password
   privately and record the resulting project ref. No repository policy or instruction
   currently authorizes creating billable resources automatically, so creation was
   deliberately not attempted; staging is not a substitute.
2. Confirm the production platform/tenant-owner identities and Eduardo's verified
   email, create/verify them through the official Auth UI/Admin API under approved
   onboarding, and record their new production Auth IDs. Choose the production login
   policy and exact redirect URLs. Do not send invitations or notifications from this
   preparation task. No test password or account is reused.
3. Core/Master reviews CCR-CORE-ENV-001, the ten-migration dependency package and
   trusted initial bindings; a separately authorized operator executes it only against
   the verified new project. Provision fresh secrets in Vercel Production scope using
   the non-secret template; validate actual key/project pairing and origin isolation.
4. A separate release authorization integrates the reviewed artifact and permits a
   production deployment and HTTPS/device acceptance. No promotion or PWA deployment
   is part of this work package.

Only items 1–2 require missing external project/identity decisions now. Code review,
bootstrap execution and deployment are subsequent controlled delivery steps.

## Final verification and file scope

- Full suite: `node node_modules/vitest/vitest.mjs run --maxWorkers=1` — 61 files
  passed, 759 tests passed, one existing hosted check skipped. Focused checks:
  23 files / 288 tests passed.
- Final packaging review corrected Windows CRLF versus canonical Git LF hashing;
  all ten checksums match Git blobs, and the affected bootstrap/package suites
  passed again after that correction: two files / eleven tests. No SQL migration
  source was changed or re-authored.
- Typecheck, lint and build passed on the final source. Lint has the same six
  pre-existing warnings; build retains the existing bundle-size/Browserslist notices.
- Earlier broad runs encountered timing limits in existing scrypt/Sales checks
  and in the new external-process tests. Existing test limits were not changed.
  The new CLI/build process tests use an explicit bounded 15-second limit; the
  final single-worker full run passes. No assertion was weakened.
- `git diff --check` passed. Existing migration files are unchanged; no migration
  was applied remotely. Evidence/logs: `evidence/production-foundation/quality.json`
  and the adjacent typecheck/lint/build logs. No live production validation is claimed.

Changed file groups: environment templates/ignore rules; shared environment
boundary and Core browser configuration/types; Vite build guard; shared server
target guard and Personnel/Sales client configuration; offline bootstrap compiler,
plan command, customer example and pinned migration manifest; environment/bootstrap/
plan tests plus the existing Sales URL fixture; this runbook, CCR and prior-review
cross-link; read-only inventory and quality evidence. The prior recovery documents,
scheduler SQL edit and old WP-PERS-002 evidence are intentionally excluded from this
commit. No remote deployment configuration, alias, user, entitlement or secret
was changed in either environment.

Recommended next action: authorize creation of the independent production Supabase
project in the selected Supabase organization/region.
