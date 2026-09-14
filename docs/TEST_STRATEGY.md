# TEST STRATEGY & QUALITY GATES — HORECA MODULAR

> **Status**: APPROVED TEST STRATEGY (WP-001 & WP-002)  
> **Test Runner**: Vitest (`v5.0.0`)  
> **CI Integration**: GitHub Actions `.github/workflows/ci.yml`

---

## 1. Defined Testing Layers

### 1. UNIT Layer
- **Scope**: Pure domain functions, value objects, error containers (`Result<T, E>`), environment parsing, and capability resolution (`can()`).
- **Tooling**: Vitest (`tests/unit/`).
- **Current Suites**:
  - `tests/unit/env.test.ts`: Environment validation and masking.
  - `tests/unit/errors.test.ts`: AppError classification and Result mapping.
  - `tests/unit/authorization.test.ts`: Canonical role and capability resolution.
  - `tests/unit/useCases.test.ts`: Use case port invocation and Result handling.
  - `tests/unit/tenancy_usecases.test.ts`: Canonical tenancy use cases (organization & operational unit switching, capability resolution, active context validation).

### 2. INTEGRATION & SECURITY Layer
- **Scope**: Repository adapters, application use cases, and multi-tenant security isolation.
- **Tooling**: Vitest (`tests/integration/`).
- **Current Suites**:
  - `tests/integration/security_isolation.test.ts`: 10 canonical tenant-isolation scenarios (SEC-01 through SEC-10).
  - `tests/integration/real_rls_security.test.ts`: 22 security scenarios (SEC-RLS-01 through SEC-RLS-12, and SEC-CONTRACT-01 through SEC-CONTRACT-10) with explicit layer classification:
    - **Scenarios SEC-RLS-01 to SEC-RLS-08 (Database RLS & Membership Boundary)**: Validates database row-level security boundary conditions, unauthenticated rejections, multi-tenant isolation, cross-holding isolation, and multi-CIF membership evaluations.
    - **Scenarios SEC-RLS-09 to SEC-RLS-12 (Domain / Application Authorization Pipeline)**: Validates fine-grained capability checks, explicit overrides, operational-unit scoped permissions, and module entitlement enforcement in the domain `can(...)` evaluation engine.
    - **Scenarios SEC-CONTRACT-01 to SEC-CONTRACT-10 (Contract Remediation Tests)**:
      - `SEC-CONTRACT-01`: Unknown legacy role does NOT map to OWNER [Domain/DB Contract].
      - `SEC-CONTRACT-02`: Unknown legacy role fails capability authorization closed [Domain Auth].
      - `SEC-CONTRACT-03`: Membership scoped to Unit A cannot access Unit B [Domain Auth].
      - `SEC-CONTRACT-04`: Membership scoped to Unit A + Unit B can access both [Domain Auth].
      - `SEC-CONTRACT-05`: Organization-wide membership can access all Organization units [Domain Auth].
      - `SEC-CONTRACT-06`: ActiveContext cannot select an out-of-scope unit [Domain Auth].
      - `SEC-CONTRACT-07`: VEGEN_PLATFORM_ADMIN without OrganizationMembership does not gain tenant operational access [Domain Auth].
      - `SEC-CONTRACT-08`: CREATE_PURCHASE_ORDER does not imply APPROVE_PURCHASE_ORDER [Domain Auth / Human Gate].
      - `SEC-CONTRACT-09`: RUN_STOCK_COUNT does not imply CONFIRM_STOCK_ADJUSTMENT [Domain Auth / Human Gate].
      - `SEC-CONTRACT-10`: REVIEW_RECONCILIATION does not imply CONFIRM_RECONCILIATION [Domain Auth / Human Gate].

### 3. CONTRACT Layer
- **Scope**: Bank statement file formats (BBVA, Sabadell CSV/XLS) and external integrations.
- **Current Suites**:
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
