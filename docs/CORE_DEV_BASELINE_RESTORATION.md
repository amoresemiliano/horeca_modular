# Core DEV baseline restoration

Target: `vmxjqwlfwnphorthhcwu` (`horeca_modular_staging`). Master-owned `dev` only.
HORECA is not MICA. No data, credentials, identities or database definitions were copied
from MICA. Source definitions are the repository contracts reviewed below.

## Migration review and canonical replay

| Original version | Classification | Reason / replacement |
| --- | --- | --- |
| 20260903000000 | HISTORICAL ONLY | Assumes missing profile/organization and Finance tables, seeds an environment-specific allowlist, installs an Auth trigger and modifies operational tables. Not a safe HORECA bootstrap. |
| 20260912000000 | NEEDS ADAPTATION | Contains incomplete DDL, missing prerequisites, legacy role-to-OWNER fallback and blanket tenant entitlement provisioning. Extract design intent only. |
| 20260913000000 | NEEDS ADAPTATION | Repairs an assumed existing schema, truncates role bindings, contains legacy tax-perception codes and aliases. Retain canonical unit taxonomy, scope relationships and deny principles only. |
| 20260917000000 | SUPERSEDED | Existing-data role normalization is unnecessary on empty Core tables; no fallback role is seeded. |
| 20260917010000 | SUPERSEDED | Unknown roles already fail closed via nullable role FK and active-role authorization checks. |
| 20260917020000 | SUPERSEDED | No obsolete bindings exist; active role/capability SELECT policies are established in the baseline. |
| 20260918000000 | HISTORICAL ONLY | No test RPC is created; absence is checked without replaying historical DROP CASCADE. |
| 20260926000000 | SAFE TO APPLY | Clean consolidated HORECA baseline, authored 2026-09-28; version intentionally sorts before its existing CCR dependency. Not a claim of deployment on September 26. |
| 20260927000000 | SAFE TO APPLY AFTER BASELINE | Exact previously approved CCR-FIN-001 SQL, unchanged from `20d41e17266f4085d520909159d736977e791d9b`. |

The seven original SQL files are preserved byte-for-byte under
`supabase/history/pre_rebaseline/`. They are removed from the active migration queue,
not marked as applied. Older documentation paths refer to these archived files.
The active replay chain is baseline, then CCR. CLI `db push` records only migrations
actually executed; no `migration repair` or fabricated historical rows are used.
The first push uses an ignored isolated workdir containing only the baseline; CCR is
added only after baseline schema verification. The final active chain matches the root
repository migration directory.

## Resulting schema and security design

The ten requested Core relations have PKs, identity/tenant FKs, unique constraints and
explicit grants/RLS. One additional table, `eco_user_platform_role`, represents platform
assignment independently so platform authority can be tested without tenant membership.
No holdings, Finance/domain tables, Auth trigger or real-tenant bootstrap is introduced.

Profiles reference genuine Auth identities. Membership `user_profile_id` is a generated
alias of `user_id`, so the two identity fields cannot disagree. Composite role-tier FKs
prevent platform/holding roles from being assigned as organization roles. Null or inactive
roles fail closed. Composite membership/unit FKs prevent cross-organization scopes and
overrides. Organization-wide scope and enabled entitlements both default to false.

All eleven tables enable RLS. Authenticated browsers have SELECT only; anon/PUBLIC have
no table privileges. Profile and membership visibility is limited to the active caller;
organization/entitlement reads require explicit active membership. Unit reads also enforce
the member's explicit unit scope. Platform assignments grant no tenant visibility.
Registry reads require active catalog rows. Trusted service provisioning has explicit
table privileges; it is not exposed as a browser bootstrap operation.

Two read-only SECURITY DEFINER membership/scope helpers use fixed `pg_catalog` search paths,
qualified relations and `auth.uid()`. Only authenticated callers may execute them. No
first-membership helper or public test harness is created. CCR supplies the separate
capability + override + entitlement authorization primitive and restrictive write policies.

The registry uses the exact 53 wire codes in current `capabilities.ts`, rather than the
contaminated historical SQL aliases. The baseline seeds 52; CCR adds the confirmation gate.
All 13 canonical roles and their defaults match `roles.ts` (170 baseline bindings, three
additional CCR bindings). Platform administration and hard purge are PLATFORM capabilities;
production/inventory operations are OPERATIONAL_UNIT capabilities; the remaining tenant
capabilities are ORGANIZATION scoped. Holding roles have no implicit tenant membership.
No organization, CIF, operational-unit name, entitlement, user or membership is seeded.
Real-tenant bootstrap remains a separately authorized action with verified legal details.

## Evidence and status

Preflight: CLI link and GitHub `dev` verified; ten Core tables and migration history absent.
The nine existing tables are **legacy HORECA operational data**, not Core tenancy tables.
Content fingerprints are computed server-side by `supabase/audits/horeca_legacy_preservation.sql`;
row contents are never exported. Before counts: categorias 12, subcategorias 13; empleados,
extractos, fichajes, incidencias, produccion_registros, proveedores and recetas each 0.

Local embedded PostgreSQL replay validates the actual baseline plus approved CCR. The
data-free `supabase/audits/horeca_core_contract.sql` captures columns, constraints, RLS,
grants, function definitions and registry defaults for comparison with hosted Supabase.
Hosted deployment, transaction-based behavioral verification and post-deployment evidence
are recorded below after execution. A temporary Auth identity is provisioned/deleted using
the supported Auth Admin API only; no SQL writes to Auth internals are permitted.

Deployment status: **VERIFIED** on canonical HORECA DEV.

- CLI applied baseline first; its schema, RLS, constraints, grants and registry were
  compared against the embedded replay before CCR was applied.
- CLI then applied the unchanged approved CCR migration. Remote history contains only
  `20260926000000_horeca_core_baseline` and `20260927000000_ccr_fin_001_core_authorization`.
  Root-repository `migration list --linked` matches both; `db push --dry-run` reports
  up to date with no migrations, roles or seeds pending.
- Final hosted contract equals the local replay: 11 relations, 13 roles, 53 capabilities,
  173 default bindings, matching columns/nullability, PK/FK/unique/CHECK constraints,
  RLS policies, table grants and function definitions. The audit explicitly normalizes
  PG18 NOT NULL catalog rows (nullability is independently compared) against hosted PG17,
  and uses C collation for deterministic mixed-case capability ordering.
- Hosted SQL executes under `authenticated` with JWT claims for a real temporary Auth
  user. OWNER, MANAGER and ADMINISTRATIVE allow confirmation with enabled `bancos`;
  accountant, nonmember organization, inactive membership, disabled entitlement,
  explicit revoke and unit-only confirmation deny. An authorized second organization
  works independently of the first membership. Assigned unit access allows; unassigned
  and foreign unit access deny. Cross-tenant scope and platform-as-tenant FKs reject writes.
- Hosted RLS limits tenant visibility and browser profile/membership/registry writes fail.
  A genuine platform assignment with no tenant memberships sees zero organizations and
  cannot confirm. Required default grants and authenticated/anon/PUBLIC function ACLs pass.
- Auth Admin API creates the temporary identity; password sign-in succeeds. After the SQL
  fixture transaction rolls back, an actual authenticated PostgREST call executes and
  returns false for the nonmember subject. Anonymous PostgREST execution returns HTTP 401.
  The Auth Admin API deletes the identity; a follow-up lookup confirms HTTP 404.
- All fixture changes rolled back. Final counts: auth.users, profiles, organizations,
  memberships and entitlements each zero. No public test function was created.
- All nine legacy row counts **and full-row content fingerprints** exactly match preflight.
  No legacy DDL, grants, policies, adoption or domain migrations were included.

Machine-readable nonsecret evidence: [CORE_DEV_BASELINE_EVIDENCE.json](CORE_DEV_BASELINE_EVIDENCE.json).
Existing unversioned legacy operational schema is intentionally outside this Core replay;
its future domain adoption remains documented work, not fabricated migration history.

## Quality and Finance handoff

`npm run lint`: zero errors, 14 existing warnings. `npm run typecheck`: passed.
`npm run test:run`: 147 passed, one opt-in hosted test skipped, across 13 files.
This includes the six new full-baseline embedded PostgreSQL checks and the existing
41 CCR embedded PostgreSQL checks. `npm run build`: passed with existing bundle-size and
Browserslist warnings. Hosted SQL/API evidence above is separate from these local tests.

**CCR-FIN-001 DEV VERIFIED.** Finance may depend on
`public.can_execute_capability_for_org(uuid,text,uuid)` in `vmxjqwlfwnphorthhcwu`, passing
the requested organization and exact `STATEMENTS_IMPORT_CONFIRM` code inside its future
trusted atomic operation. An enabled `bancos` entitlement and authorized active membership
remain mandatory. Finance still owns its business-schema adoption, persistence RPC and
write-path tests. No Finance branch change or PR #2 merge was made. Real tenant/user/bootstrap
and entitlement provisioning require a separate explicit step with verified business details.
