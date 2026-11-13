# CCR-CORE-ENV-001 — independent production environment and initial bootstrap

Date: 2026-11-13, Europe/Madrid. Owner: Core / Master, with Personnel consumer.
Status: IMPLEMENTATION_PREPARED_FOR_REVIEW. Not integrated, deployed, or a claim of
Core/Master design acceptance. PO authorized preparation of repository changes in
this work package; production creation and release remain separate decisions.

## Requested contract change

Replace the former shared DEV/PROD Supabase project invariant with explicit,
independent production identity. Non-production continues to accept only
`vmxjqwlfwnphorthhcwu`. Production requires a supplied non-staging project ref,
exact project URL and HTTPS origin. No production URL/key fallback to staging.
Hosted production/preview environment mismatches must fail before deployment
artifact emission and before Personnel client creation. Legacy JWT project/role
claims are checked for consistency, not treated as cryptographic verification;
opaque keys still require target-side validation at release.

Shared implementation: `src/shared/config/environmentBoundary.ts`,
`src/shared/config/env.ts`, `vite.config.ts`. Personnel consumes the same boundary
in `server/personnel/runtime.ts`. Existing environment boundary tests are updated
because they encoded the superseded single-project decision. No auth callback,
scope evaluator, RLS policy, role template or global capability grant is changed.

The shared `server/supabaseEnvironment.ts` guard also covers the two existing
Supabase client constructors in `server/salesRuntime.ts`. Otherwise a deployed
non-Personnel API could still accept staging credentials. This is configuration
hardening only: no Sales commands, contracts, grants, entitlements or data change.
The Sales authorization test uses the canonical staging URL instead of an unrelated
mock hostname. Sales-owner review is included in this CCR's integration boundary.

## Initial canonical bootstrap

Offline plan/compiler under `scripts/production-foundation/`; no apply command,
network client, Auth creation, cloud provisioning or deployment. A checksum-pinned
manifest selects the existing Core schema/reference migrations and Personnel
foundation, excluding Sales/Production schemas and optional push. Two existing
Finance schema migrations are mandatory dependencies: Core administration rewrites
their policies and function bodies. They are included unchanged with no business
data or Finance enablement; historical migrations are not split or rewritten.

One-time trusted initial bindings to existing, verified production Auth identities
create profiles/platform authority and an explicitly configured tenant OWNER.
Platform role never implies tenant membership. Canonical `core_admin_mutate` and
invitation completion create the tenant, entitlements and Personnel membership;
the unit uses the existing canonical table because there is no unit-creation RPC.
No new public function, alternate tenant model, browser write grant or bypass is
introduced. These trusted bootstrap DML operations require Core/Master review
and a separately verified production target before execution.

The initial Personnel administrator policy uses existing `member.override`:
GRANT employees.manage, fichajes.write and fichajes.audit; REVOKE every other
active organization/unit capability. This resolves the HR_PERSONNEL inheritance
risk even if unrelated module entitlements are later enabled. It applies to the
configured membership, not an email/name/user-ID exception. Future role/capability
catalog changes require revalidation; no immutable permission boundary across
arbitrary future migrations is claimed.

## Acceptance

- Clean selected migration chain and bootstrap work in ephemeral PostgreSQL.
- Rerun produces no duplicate customer or authority records; drift fails closed.
- Platform, tenant OWNER and Personnel administrator authorities stay distinct.
- Other organizations/units, unrelated modules and trusted RPCs fail closed.
- Direct browser writes/private credentials remain denied; RLS remains enabled.
- Staging references, credentials and origins are rejected by production config.
- No staging operational or Auth data is included in the generated package.

No new migration is proposed. Integration belongs to Core/Master; this module
branch is a review artifact and must not be promoted on the strength of local tests.
