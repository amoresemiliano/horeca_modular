# ARCHITECTURAL DECISIONS RECORD (ADR) — HORECA MODULAR

## ADR-001: Adoption of Modular Monolith Architecture
- **Status**: Approved
- **Context**: Need a cohesive, easily manageable codebase for HORECA Modular without premature microservice overhead.
- **Decision**: Structure application as a Modular Monolith in React/Vite with isolated feature directories in `src/modules/*` and canonical layered core (`src/domain/`, `src/application/`, `src/infrastructure/`, `src/shared/`).

## ADR-002: Native Supabase Auth with PKCE and Strict DB Membership
- **Status**: Approved
- **Context**: Firebase Auth was legacy and did not integrate directly with Supabase Postgres RLS.
- **Decision**: Replace Firebase with native Supabase Auth (`auth.users`), implementing `eco_user_profiles` and `eco_organization_members` for multi-tenant identity and authorization.

## ADR-003: Fail-Closed Security Model & Removal of Client Fallbacks
- **Status**: Approved
- **Context**: Previous implementations allowed dangerous client-side role fallbacks (e.g. `profData.role || 'SUPERADMIN'`).
- **Decision**: Enforce strict fail-closed state in `AuthContext.jsx`. If profile or membership fails to resolve, user state is set to `null` and access is denied.

## ADR-004: Standardized Multi-Tenant RLS via `get_auth_user_org_id()` & Multi-CIF Evolution
- **Status**: Approved
- **Context**: Legacy tables relied on `private.org_id()` or hardcoded defaults.
- **Decision**: Standardize all RLS policies to evaluate database memberships, transitioning from single-tenant bootstrap helpers to multi-CIF membership validation (`organization_id IN (SELECT organization_id FROM eco_organization_members WHERE ...)`).

## ADR-005: Support for Modern Supabase Publishable Keys
- **Status**: Approved
- **Context**: Supabase introduced modern publishable keys (`sb_publishable_...`) replacing legacy JWT anon keys.
- **Decision**: Update Supabase clients to prefer `VITE_SUPABASE_PUBLISHABLE_KEY` with fallback to `VITE_SUPABASE_ANON_KEY`.

## ADR-006: Isolated Private Storage for Import Files
- **Status**: Approved
- **Context**: Bank statement files contain sensitive financial data.
- **Decision**: Store all raw files in private bucket `eco-imports-private-staging` (`public = false`), enforcing RLS on `storage.objects` based on tenant folder paths.

## ADR-007: Adoption of TypeScript Engineering Foundation (Strict Incremental Coexistence)
- **Status**: Approved (WP-001)
- **Context**: The codebase required end-to-end type safety and compile-time verification without risking destabilization from a reckless full rewrite of existing working JSX components.
- **Decision**: Introduce TypeScript 5.8 with strict compiler settings for all new core architecture (`src/domain/`, `src/application/`, `src/infrastructure/`, `src/shared/`), allowing controlled temporary coexistence with legacy `.jsx` modules.

## ADR-008: Adoption of Vitest as Canonical Automated Test Runner
- **Status**: Approved (WP-001)
- **Context**: The project lacked a standard automated test execution pipeline and quality gates.
- **Decision**: Adopt Vitest (`v5.0.0`) configured with `@` path aliases, integrating unit tests, multi-tenant security isolation tests, and legacy bank statement parser tests into unified `npm run test:run` and `npm run test` scripts.

## ADR-009: Separation of ActiveContext (UX Focus) from Authorization Authority
- **Status**: Approved (WP-001)
- **Context**: Client-side context selection could be spoofed if treated as an authorization token.
- **Decision**: Formally define `ActiveContext` strictly as a UX view navigation state. Authorization decisions are governed solely by atomic capabilities verified against database memberships (`can(ctx)` evaluator returning fail-closed `DENY`).

## ADR-010: Standardized Result<T, E> Container & AppError Classification
- **Status**: Approved (WP-001)
- **Context**: Unhandled exceptions and silent empty arrays masked infrastructure errors and security failures.
- **Decision**: Enforce functional `Result<T, AppError>` return types across all new domain, use case, and repository boundaries, categorizing errors into 7 discrete codes (`AUTHENTICATION`, `AUTHORIZATION`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `INFRASTRUCTURE`, `UNEXPECTED`).

## ADR-011: Complete Sanitization and Removal of Legacy Firebase Dependencies
- **Status**: Approved (WP-001)
- **Context**: Firebase package remained in `package.json` despite the full migration to Supabase Auth.
- **Decision**: Uninstall `firebase` package, remove obsolete configs and environment references, and verify 0 runtime regressions in Supabase Auth.
