# HORECA DEV Supabase rebaseline — 2026-09-28

## Authoritative project boundary

HORECA != MICA. The Product Owner corrected the previous infrastructure mapping:

| Project | Ref | Name | Use |
| --- | --- | --- | --- |
| HORECA DEV | `vmxjqwlfwnphorthhcwu` | `horeca_modular_staging` | Only authorized DEV target |
| MICA | `ourzapkjykzlwsjunzmd` | `Sistema Contable MICA` | Quarantine reference only; never a HORECA target |

The authenticated Supabase project listing independently confirmed the HORECA name/ref
and ACTIVE_HEALTHY status. Standard `supabase link --project-ref vmxjqwlfwnphorthhcwu`
completed from the Master repository. Local `supabase/.temp/project-ref` matches.
CLI state is ignored by Git. No MICA database queries or writes were performed in this task.

## Occurrence classification and correction

| Locations | Classification | Disposition |
| --- | --- | --- |
| `src/lib/supabase.js` | WRONG ACTIVE HORECA CONFIG | Removed hardcoded MICA URL and keys; shares the typed environment resolver. |
| `src/shared/config/env.ts` | WRONG ACTIVE HORECA CONFIG | HORECA DEV URL corrected; another DEV origin is rejected before client creation; missing browser key fails closed. |
| `src/components/Login.jsx` | WRONG ACTIVE HORECA CONFIG | Project display fallback corrected. |
| `.env.local` (ignored) | WRONG ACTIVE HORECA CONFIG | URL corrected; old keys removed; existing HORECA browser key retrieved through authenticated CLI and stored without logging its value. |
| `agent/CONTEXT.md`, `docs/RELEASE_WORKFLOW.md`, `docs/PROJECT_STATE.md` | LEGACY DOCUMENTATION | Active mapping corrected; unverified hosted claims qualified. |
| `tests/integration/true_postgres_rls.test.ts` | WRONG ACTIVE HORECA CONFIG / LEGACY DOCUMENTATION | Target corrected; hosted execution now requires `HORECA_RUN_HOSTED_TESTS=true` and the exact HORECA DEV URL. Client creation is deferred until the live test runs. |
| `docs/CANONICAL_DB_RECONSTRUCTION_PLAN.md`, `docs/CANONICAL_HUB_AUDIT.md`, `docs/CURRENT_TO_TARGET_GAP_ANALYSIS.md`, `docs/DATABASE_DRIFT_REPORT.md`, `docs/ESCANDALLOS_BRANCH_AUDIT.md` | HISTORICAL/INCIDENT REFERENCE | Original evidence retained beneath an explicit MICA-contamination notice; not a HORECA baseline or executable deployment plan. |
| Header comments in migrations `20260912000000`, `20260913000000`, `20260917000000`, `20260917010000`, `20260917020000`, `20260918000000` | SAFE TO KEEP AS QUARANTINE HISTORY | Incorrect historical environment comments retained to preserve versioned migration bytes. They do not select a connection. Only the verified CLI link may select DEV. |
| 22 ignored local scripts previously under `scratch/` | SAFE TO KEEP AS QUARANTINE HISTORY | Moved to `scratch/quarantine-mica/` with `.disabled` suffix; not repointed or executed. |

No old project ref remains in active source or local environment configuration. Historical
SQL comments and explicitly quarantined incident reports retain it intentionally.
Finance worktree, PR #2, main, production and global MICA MCP configuration are unchanged.
Hosted Vercel Preview variables were not inspected or changed; this is not hosted frontend
verification. A stale Preview DEV URL will now fail closed rather than connect to another project.

## Pre-migration audit and deployment blocker

GitHub `dev` was directly inspected at approved Core SHA
`20d41e17266f4085d520909159d736977e791d9b` before local corrections.
The approved CCR migration remains byte-equivalent to that commit (normalized LF SHA-256
`ee505cda98a3461cc4d3a12d61f53abc794e97fe63e9cc5be31b5ea32e3b8598`).

`supabase migration list --linked` showed all eight repository versions as local-only,
with no remote versions. A read-only catalog query showed only these public tables:
`categorias`, `empleados`, `extractos`, `fichajes`, `incidencias`, `produccion_registros`,
`proveedores`, `recetas`, `subcategorias`.

The read-only audit `supabase/audits/ccr_fin_001_core_prerequisites.sql` checks every Core
relation referenced by CCR-FIN-001 plus the migration history table. The ten Core relations
are absent, including `eco_user_profiles`, `eco_organization_members`, `eco_capabilities`
and `eco_role_templates`. The migration history table is also absent.

**CCR-FIN-001 was not applied.** Its first ALTER TABLE requires an absent Core table;
applying it cannot establish the missing baseline. No unrelated migration was applied,
no migration-history repair was performed, and no fixture/auth data was written.
The current remote state does not match the approved repository Core migration state.
There is no successful deployment or post-deployment drift clearance to certify.

Master must first prepare and approve a HORECA-owned Core baseline for this existing
schema, including its missing pre-WP002 prerequisites. Do not blindly push all pending
migrations, copy MICA data, or mark versions applied without schema evidence. Once that
baseline is deployed and verified, apply only the approved CCR migration and run the
hosted grants, execution privileges, entitlement and tenant-denial checks.

## Finance handoff

Finance must use `vmxjqwlfwnphorthhcwu`. It **cannot yet depend** on
`can_execute_capability_for_org(uuid,text,uuid)` in hosted DEV. Resume the shared DEV
authorization integration only after Master certifies the baseline and CCR-FIN-001
deployment. Local PostgreSQL policy tests do not substitute for hosted verification.

## Local verification

All 141 local tests pass; one explicitly gated hosted test is skipped. The production
build succeeds and contains no MICA project ref. Type checking succeeds;
lint reports zero errors and 14 existing warnings. Environment tests cover the canonical
DEV origin, foreign origins, deceptive hostname suffixes and missing browser credentials.
No hosted authorization ALLOW/DENY result is claimed: the required Core relations are absent.
