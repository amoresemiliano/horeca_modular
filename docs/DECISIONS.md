# ARCHITECTURAL DECISIONS RECORD (ADR) — HORECA MODULAR

## ADR-001: Adoption of Modular Monolith Architecture
- **Status**: Approved
- **Context**: Need a cohesive, easily manageable codebase for HORECA Modular without premature microservice overhead.
- **Decision**: Structure application as a Modular Monolith in React/Vite with isolated feature directories in `src/modules/*`.

## ADR-002: Native Supabase Auth with PKCE and Strict DB Membership
- **Status**: Approved
- **Context**: Firebase Auth was legacy and did not integrate directly with Supabase Postgres RLS.
- **Decision**: Replace Firebase with native Supabase Auth (`auth.users`), implementing `eco_user_profiles` and `eco_organization_members` for multi-tenant identity and authorization.

## ADR-003: Fail-Closed Security Model & Removal of Client Fallbacks
- **Status**: Approved
- **Context**: Previous implementations allowed dangerous client-side role fallbacks (e.g. `profData.role || 'SUPERADMIN'`).
- **Decision**: Enforce strict fail-closed state in `AuthContext.jsx`. If profile or membership fails to resolve, user state is set to `null` and access is denied.

## ADR-004: Standardized Multi-Tenant RLS via `get_auth_user_org_id()`
- **Status**: Approved
- **Context**: Legacy tables relied on `private.org_id()` or hardcoded defaults.
- **Decision**: Standardize all RLS policies to evaluate `get_auth_user_org_id()`, which derives tenant ownership strictly from `auth.uid() -> eco_user_profiles -> eco_organization_members`.

## ADR-005: Support for Modern Supabase Publishable Keys
- **Status**: Approved
- **Context**: Supabase introduced modern publishable keys (`sb_publishable_...`) replacing legacy JWT anon keys.
- **Decision**: Update `src/lib/supabase.js` to prefer `VITE_SUPABASE_PUBLISHABLE_KEY` with fallback to `VITE_SUPABASE_ANON_KEY`.

## ADR-006: Isolated Private Storage for Import Files
- **Status**: Approved
- **Context**: Bank statement files contain sensitive financial data.
- **Decision**: Store all raw files in private bucket `eco-imports-private-staging` (`public = false`), enforcing RLS on `storage.objects` based on tenant folder paths.
