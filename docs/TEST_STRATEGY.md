# TEST STRATEGY & QUALITY GATES — HORECA MODULAR

> **Status**: APPROVED TEST STRATEGY (WP-001 & WP-002)  
> **Test Runner**: Vitest (`v5.0.0`)  
> **CI Integration**: GitHub Actions `.github/workflows/ci.yml`

---

## 1. Defined Testing Layers & Honest Classification

### A. DOMAIN / APPLICATION
- **Scope**: Pure domain logic, value objects, error containers (`Result<T, E>`), environment parsing, capability resolution (`can()`), and tenancy use cases.
- **Tooling**: Vitest (`tests/unit/`, `tests/integration/security_isolation.test.ts`).
- **Suites**:
  - `tests/unit/env.test.ts`: Environment validation and masking.
  - `tests/unit/errors.test.ts`: AppError classification and Result mapping.
  - `tests/unit/authorization.test.ts`: Canonical role and capability resolution.
  - `tests/unit/useCases.test.ts`: Use case port invocation and Result handling.
  - `tests/unit/tenancy_usecases.test.ts`: Organization & unit switching, capability resolution, active context.
  - `tests/integration/security_isolation.test.ts`: 10 canonical domain isolation scenarios (`SEC-01` through `SEC-10`).

### B. MOCKED INTEGRATION-LIKE
- **Scope**: Application pipeline and repository adapter integration testing using mocked repository interfaces (`IOrganizationMembershipRepository`).
- **Tooling**: Vitest (`tests/integration/real_rls_security.test.ts`).
- **Suites**:
  - `tests/integration/real_rls_security.test.ts`: 27 application-level scenarios (`SEC-RLS-01` to `12`, `SEC-CONTRACT-01` to `10`) validating domain authorization pipelines, fine-grained capability checks, operational-unit scopes, human-gate separation, and fail-closed legacy role fallback.

### C. LIVE CONNECTIVITY
- **Scope**: HTTP and PostgREST endpoint accessibility, project credentials validation, live Supabase project ping, and application surface exposure checks.
- **Tooling**: Vitest & Supabase JS client (`tests/integration/true_postgres_rls.test.ts`).
- **Suites**:
  - `tests/integration/true_postgres_rls.test.ts` (Live Application Database Surface Cleanliness Gate): Confirms 0 public RPC backdoor exposure over HTTP/PostgREST.

### D. TRUE POSTGRES RLS
- **Scope**: Direct PostgreSQL engine Row-Level Security policy enforcement (`USING` / `WITH CHECK`) against live PostgreSQL database.
- **Tooling**: Version-controlled SQL security test harness (`supabase/tests/00_verify_authenticated_rls.sql`).
- **Invariants**: ZERO direct writes to Supabase Auth internal tables (`auth.*`), zero public RPC endpoint exposure, isolated temporary test fixtures.
- **Executed Scenarios**:
  - `SEC-RLS-DB-01`: Cross-Tenant SELECT Boundary (`eco_counterparties`) [Positive Control + Negative Denial] -> **EXECUTED PASS**
  - `SEC-RLS-DB-02`: Cross-Tenant INSERT Denial into foreign tenant (`eco_counterparties`) [Insert Exception] -> **EXECUTED PASS**
  - `SEC-RLS-DB-03`: Cross-Tenant UPDATE Denial on foreign tenant (`eco_counterparties`) [Update Row Count = 0] -> **EXECUTED PASS**
  - `SEC-RLS-DB-04`: Inactive Member Access Denial (`eco_counterparties`) [Inactive User Query = 0 rows] -> **EXECUTED PASS**
  - `SEC-RLS-DB-05`: Unknown / NULL Role Template Capability Denial [Schema & Policy] -> **EXECUTED PASS**
  - `SEC-RLS-DB-08`: `VEGEN_PLATFORM_ADMIN` Without Tenant Membership Denial [Tenant Data Isolation] -> **EXECUTED PASS**
  - `SEC-RLS-DB-09`: Global Capability Metadata Read Does NOT Grant Tenant Access [Metadata vs Business Data] -> **EXECUTED PASS**

### E. AUTHORIZATION CONTRACT / APPLICATION ENFORCEMENT
- **Scope**: Scopes and module entitlements whose enforcement layer is schema contracts or application auth engine rather than direct PostgreSQL table RLS policies.
- **Suites**:
  - `SEC-RLS-DB-06`: Operational Unit Scope Access Boundary -> **AUTHORIZATION CONTRACT TEST / NOT YET DB-ENFORCEABLE** (OperationalUnit-scoped business resource tables in WP-003+ such as inventory/orders will close DB-level proof).
  - `SEC-RLS-DB-07`: Disabled Module Entitlement Guard -> **APPLICATION AUTHORIZATION / ENTITLEMENT TEST** (Enforced by application authorization engine, not Postgres table RLS).
  - `tests/extractos.test.js`: Bank statement file formats contract validation (BBVA, Sabadell).

---

## 2. Test Runner Scripts & Quality Gates

| Script | Purpose | CI Gate? |
| :--- | :--- | :---: |
| `npm run typecheck` | Validates TypeScript types across `src/` and `tests/`. | **YES (Blocking)** |
| `npm run lint` | ESLint static code analysis for code quality & formatting. | **YES (Blocking)** |
| `npm run test` | Starts Vitest in interactive watch mode for local development. | NO |
| `npm run test:run` | Single-pass test execution of all unit and integration suites. | **YES (Blocking)** |
| `npm run build` | Compiles production bundle with Vite. | **YES (Blocking)** |
