# CCR-FIN-001 — Core contract for Finance confirmation

Core implementation: `supabase/migrations/20260927000000_ccr_fin_001_core_authorization.sql`.
Status (2026-09-28): deployed and hosted-verified on `vmxjqwlfwnphorthhcwu` after consolidated Core baseline restoration. See [deployment evidence](CORE_DEV_BASELINE_RESTORATION.md).
This contract supersedes the proposed literal `CONFIRM_BANK_STATEMENT_IMPORT` in the Finance
recovery document. The latter remains the semantic human gate, not a second registry code.
The original implementation task did not deploy either migration. Master subsequently deployed
the clean Core baseline and this exact CCR migration to canonical HORECA DEV; Finance migrations remain separate.

## Capability and scope

The sole new canonical wire/SQL/TypeScript value is **STATEMENTS_IMPORT_CONFIRM**.
The TypeScript constant is `Capability.STATEMENTS_IMPORT_CONFIRM`; unlike older dotted
TypeScript codes it intentionally equals its SQL code. There is no dotted alias or parallel
`CONFIRM_BANK_STATEMENT_IMPORT` capability. Upload, processing, reconciliation review and
reconciliation confirmation never imply this permission, nor does this permission imply them.

Default grants: **OWNER, MANAGER, ADMINISTRATIVE** only. No default grant for EXTERNAL_ACCOUNTANT,
CONSULTANT, VEGEN_PLATFORM_ADMIN, HOLDING_OWNER, HOLDING_ADMIN or operational roles. A later
explicitly approved member override remains possible; a REVOKE always takes precedence.
Platform authority alone is never considered by the organization authorization primitive.

Confirmation is ORGANIZATION scoped. A membership must explicitly be organization-wide.
A unit-only grant cannot authorize importing statements for an organization bank account.
Any unit-specific revoke of this organization-wide permission blocks the whole operation;
it cannot be evaded by omitting the unit. Unit-only operators need an explicitly approved
organization-wide membership/grant to confirm. This does not broaden their other capabilities.

The existing deployed module entitlement key is **bancos**, from the 20260912 Core migration;
Finance is the domain name, not a new entitlement alias. An explicit enabled `bancos` row
is required. Missing, disabled, differently named or unavailable entitlement evidence denies.
No new tenant entitlements are provisioned or enabled by this change.

## Server organization authorization

```sql
public.can_execute_capability_for_org(
  requested_organization_id uuid,
  required_capability_code text,
  requested_operational_unit_id uuid DEFAULT NULL
) RETURNS boolean
```

Finance must call the following **inside** its future atomic transaction, before writing:

```sql
IF NOT public.can_execute_capability_for_org(
  requested_organization_id, 'STATEMENTS_IMPORT_CONFIRM'
) THEN
  RAISE EXCEPTION 'Bank import confirmation denied' USING ERRCODE = '42501';
END IF;
```

Use `requested_organization_id` from the submitted operation, not the frontend's claimed
membership, capability list, user ID or role. `auth.uid()` supplies the authenticated subject.
An optional browser preview check may call the same primitive through PostgREST, using named
arguments `requested_organization_id` and `required_capability_code`, but is not a persistence
authorization token. Finance must check again in its transaction. Missing function, RPC error
or a result other than true blocks the operation; there is no legacy fallback.

The primitive checks active organization, active profile, active matching membership, active
role and active registered capability. Transitional `user_id` and `user_profile_id` must not
conflict. Role defaults and applicable GRANT overrides supply authority; applicable REVOKE
overrides defeat all grants. It checks explicit membership scopes and active units belonging
to the requested organization for OPERATIONAL_UNIT capabilities. Such capabilities require
a unit; ORGANIZATION capabilities reject a supplied unit. PLATFORM/HOLDING scopes are not
accepted by this organization operation. Unknown/null codes, organizations and subjects deny.

`eco_capabilities.required_module_key` is new trusted Core registry metadata, nullable for
capabilities without a registered module requirement. It is `bancos` for this gate. A caller
cannot choose or omit the required entitlement. Future capabilities must register any
applicable module requirement explicitly instead of relying on string-prefix guessing.

The function is read-only, STABLE and SECURITY DEFINER so that it can inspect Core authority
without relying on the caller's SELECT policies or a first-membership helper. Its search_path
is fixed to `pg_catalog`; all application relations and `auth.uid()` are schema-qualified.
It contains no dynamic SQL or caller-selected user identity. PUBLIC/anon execution is revoked;
authenticated execution is explicitly granted. The migration must run as the trusted Core
owner, never as a browser role. A trusted Finance DEFINER operation retains the same auth.uid()
and must not replace it with a service/owner identity or accept an actor ID from the request.

Legacy `FOR ALL` policies permit profile/membership writes. Six restrictive write policies
close this authority self-escalation path while preserving existing read policies. Browser
INSERT/UPDATE/DELETE of these Core records is denied, including profile edits. Current frontend
Core adapters read these tables; privileged bootstrap/provisioning continues under its trusted
server context. Future self-service profile or membership mutations require narrow authorized
Core operations. This is a required protection of the primitive's inputs, not Finance logic.

## ActiveContext and classification preservation

ActiveContext selects runtime UI context; it conveys no authority. Frontend submits an explicit
organization; the server checks that organization against auth.uid(). There is no call to
`get_auth_user_org_id()`, earliest membership, hardcoded organization or hidden fallback.

Finance owns immutable bank facts separately from editable MovementClassification. Preserve
category, subcategory, optional counterparty, optional splits and deterministic rule behavior.
**eco_movement_allocations must remain supported**, including historical rows and the existing
Extractos joins. No tables, UI flows, classification data or rule code are changed by this CCR.
Import confirmation does not authorize editing classifications or confirming reconciliation.

## Direct-write contract and Finance handoff

1. Consume this Core change on the Finance branch and replace its containment error with the
   primitive above; change the UI gate to STATEMENTS_IMPORT_CONFIRM. Core does not edit that branch.
2. Follow the [ownership/schema audit](CCR-FIN-001-FINANCE-SCHEMA-AUDIT.md). Finance owns its
   baseline adoption, table migrations and persistence RPC; missing historical DDL is not
   permission to guess constraints or move Finance tables into Core.
3. Implement the atomic import under Finance ownership. Check caller capability in-transaction,
   validate account organization/bank/product/activity, use final account identity, record source
   hash/provenance, and enforce exact-file uniqueness/concurrent duplicate handling transactionally.
4. Deny ordinary browser direct INSERT of canonical BankMovement/import provenance. A permissive
   membership `FOR ALL` policy is insufficient, even when the same browser can execute the RPC.
   Finance must audit table **and column** privileges, all permissive/restrictive policies and
   other write RPCs. Use a restricted trusted-operation role/DEFINER design or an equivalent
   server-only write boundary. Merely adding a capability check to an INSERT policy still
   lets authorized callers bypass the atomic operation and its invariants.
5. Keep reads tenant scoped. Separately protect classification/allocation writes using the
   existing applicable classification capabilities, server org validation and tenant-consistent
   FKs. Preserve historical joins and splits; do not blanket-revoke allocation editing to fix
   canonical movement creation. Replacement requires an explicit Finance migration.
6. Master applies the validated Core migration before Finance deploys a dependency on the
   primitive. Core application alone does not make old Finance direct writes secure. Finance
   must replace its write paths/policies and pass rollback, concurrency, direct-write-denial,
   classification preservation and persist/reload tests before claiming WP-FIN-001 complete.

See the schema audit for the exact review of the untouched Finance draft migration. No Finance
RPC, parser, reconciliation, accounting, P&L, Sales or production deployment belongs to this CCR.

## Evidence classification

- Unit/application tests exercise the canonical TypeScript grant matrix and mocked repository
  evaluation, including entitlement lookup failure and requested second-organization selection.
- `tests/integration/ccr_fin_001_postgres.test.ts` executes the **actual Core migration twice**,
  function, grants and authority-protection RLS in ephemeral PostgreSQL via
  [PGlite](https://pglite.dev/docs/). It exercises authenticated/anon SQL roles, active/inactive
  subjects and memberships, explicit overrides, scopes, entitlements, cross-tenant calls,
  nested trusted calls and blocked self-escalation.
- The fixture supplies only the consumed Core schema and an auth.uid() JWT-setting stub. It
  neither reconstructs the unversioned production schema nor verifies hosted Supabase Auth,
  PostgREST, hosted Finance RLS or Finance transaction behavior. There are no auth-table writes
  or shared-database mutations. Hosted behavior was subsequently exercised during the controlled baseline deployment; see the linked restoration evidence.

Validation performed: `npm run test:run` — 138 passed across 11 files, including 41 embedded
PostgreSQL checks; `npm run typecheck` — passed; `npm run lint` — 0 errors and 14 pre-existing
warnings outside changed code; `npm run build` — passed with existing bundle-size/Browserslist
warnings. `git diff --check` passed. The Finance worktree remained clean at its blocked SHA.


Hosted deployment update (2026-09-28): canonical HORECA DEV now exposes the primitive.
The consolidated baseline and unchanged CCR were deployed with truthful CLI history;
transaction-scoped hosted SQL scenarios and authenticated/anonymous PostgREST execution
were checked. Finance must use current canonical capability wire codes from TypeScript,
not historical SQL aliases, and still owns its separate business schema/RPC deployment.
