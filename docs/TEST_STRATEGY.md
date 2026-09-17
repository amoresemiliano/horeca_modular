# TEST STRATEGY & QUALITY GATES — HORECA MODULAR

> **Status**: APPROVED TEST STRATEGY (WP-001 & WP-002)  
> **Test Runner**: Vitest (`v5.0.0`)  
> **CI Integration**: GitHub Actions `.github/workflows/ci.yml`

---

## 1. Defined Testing Layers & Honest Classification

### A. DOMAIN / APPLICATION TESTS
- **Scope**: Pure domain logic, value objects, error containers (`Result<T, E>`), environment parsing, capability resolution (`can()`), and tenancy use cases.
- **Tooling**: Vitest (`tests/unit/`, `tests/integration/security_isolation.test.ts`).
- **Suites**:
  - `tests/unit/env.test.ts`: Environment validation and masking.
  - `tests/unit/errors.test.ts`: AppError classification and Result mapping.
  - `tests/unit/authorization.test.ts`: Canonical role and capability resolution.
  - `tests/unit/useCases.test.ts`: Use case port invocation and Result handling.
  - `tests/unit/tenancy_usecases.test.ts`: Organization & unit switching, capability resolution, active context.
  - `tests/integration/security_isolation.test.ts`: 10 canonical domain isolation scenarios (`SEC-01` through `SEC-10`).

### B. MOCKED INTEGRATION-LIKE TESTS
- **Scope**: Application pipeline and repository adapter integration testing using mocked repository interfaces (`IOrganizationMembershipRepository`).
- **Tooling**: Vitest (`tests/integration/real_rls_security.test.ts`).
- **Suites**:
  - `tests/integration/real_rls_security.test.ts`: 27 application-level scenarios (`SEC-RLS-01` to `12`, `SEC-CONTRACT-01` to `10`) validating domain authorization pipelines, fine-grained capability checks, operational-unit scopes, human-gate separation, and fail-closed legacy role fallback.

### C. TRUE DATABASE / POSTGRES RLS TESTS
- **Scope**: Direct database row-level security (RLS) enforcement against live PostgreSQL/Supabase engine (`ourzapkjykzlwsjunzmd`).
- **Tooling**: Vitest & PostgreSQL security test runner (`tests/integration/true_postgres_rls.test.ts`).
- **Environment Execution Policy**: Requires valid environment configuration (`VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` or `SUPABASE_URL` & `SUPABASE_ANON_KEY`). Without live database credentials (e.g. standard PR CI runner), `describe.runIf(isConfigured)` gracefully skips live DB tests to prevent false positive PASS results.
- **Suites**:
  - `tests/integration/true_postgres_rls.test.ts`: Authentic `SEC-RLS-DB-01` through `SEC-RLS-DB-09` test suite with positive controls and negative denials:
    - `SEC-RLS-DB-01`: Authenticated user in Org A cannot SELECT tenant-owned business record from Org B [Positive Control + Negative Denial].
    - `SEC-RLS-DB-02`: Authenticated user in Org A cannot INSERT tenant-owned business record into Org B [Positive Control + Negative Denial].
    - `SEC-RLS-DB-03`: Authenticated user in Org A cannot UPDATE tenant-owned business record in Org B [Positive Control + Negative Denial].
    - `SEC-RLS-DB-04`: Inactive membership denies access [Admin Control + Negative Denial].
    - `SEC-RLS-DB-05`: Unknown / NULL canonical role denies capability-based operation [Membership Control + Negative Denial].
    - `SEC-RLS-DB-06`: Missing OperationalUnit scope denies scoped operation [Unit A1 Scope Control + Unit A2 Denial].
    - `SEC-RLS-DB-07`: Disabled module entitlement does not become authorized merely because capability exists [Capability Control + Entitlement Guard].
    - `SEC-RLS-DB-08`: `VEGEN_PLATFORM_ADMIN` without tenant OrganizationMembership cannot read tenant business records [Platform Role Control + Tenant Data Denial].
    - `SEC-RLS-DB-09`: Reading `eco_role_template_capabilities` does not grant tenant business-data access [Metadata Control + Tenant Isolation].

### D. CONTRACT LAYER
- **Scope**: Bank statement file formats (BBVA, Sabadell CSV/XLS) and external integrations.
- **Suites**:
  - `tests/extractos.test.js`: Validates 9 bank parser contract scenarios for BBVA and Sabadell statements.

---

## 2. Test Runner Scripts & Quality Gates

| Script | Purpose | CI Gate? |
| :--- | :--- | :---: |
| `npm run typecheck` | Validates TypeScript types across `src/` and `tests/`. | **YES (Blocking)** |
| `npm run lint` | ESLint static code analysis for code quality & formatting. | **YES (Blocking)** |
| `npm run test` | Starts Vitest in interactive watch mode for local development. | NO |
| `npm run test:run` | Single-pass test execution of all unit and integration suites. | **YES (Blocking)** |
| `npm run build` | Compiles production bundle with Vite. | **YES (Blocking)** |
