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
  - `tests/integration/real_rls_security.test.ts`: 12 security scenarios (SEC-RLS-01 through SEC-RLS-12) with explicit layer classification:
    - **Scenarios SEC-RLS-01 to SEC-RLS-08 (Database RLS & Membership Boundary)**: Validates database row-level security boundary conditions, unauthenticated rejections, multi-tenant isolation, cross-holding isolation, and multi-CIF membership evaluations.
    - **Scenarios SEC-RLS-09 to SEC-RLS-12 (Domain / Application Authorization Pipeline)**: Validates fine-grained capability checks, explicit overrides, operational-unit scoped permissions, and module entitlement enforcement in the domain `can(...)` evaluation engine.

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
