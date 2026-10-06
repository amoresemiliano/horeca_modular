# CURRENT WORK PACKAGE — WP-002: CANONICAL TENANCY, IDENTITY & AUTHORIZATION CORE (CROSS-PROJECT CONTAINMENT & REBASELINE COMPLETE)

## 1. Status Overview
- **Work Package**: WP-002 (Final Contract Remediation & HORECA Baseline Rebaselined)
- **Title**: Canonical Tenancy, Identity & Authorization Core
- **Status**: COMPLETE & VERIFIED (HORECA_REBASELINED_READY_FOR_JULES)
- **Target Branch**: `dev`
- **WP Branch**: `wp/002-contract-remediation`

## 2. Deliverables & Remediations Summary

- [x] **Cross-Project Contamination Containment & Rebaseline**:
  - Full audit across database, repository code, migrations, tests, and documentation.
  - Revoked all implicit reliance on MICA (Argentina accounting prototype) state, tenants, users, or tax rules.
  - Eliminated hardcoded MICA `DEFAULT_ORG_ID` (`59436df3-9f15-4f5e-b17e-37c55482521c`) from `src/lib/extractosService.js` and `ExtractosApp.jsx`.
- [x] **HORECA Test Fixture Standard & SEC-RLS-DB-08 Rebaseline**:
  - Established dedicated HORECA test fixtures (`HORECA_TEST_ORG_A`, `HORECA_TEST_ORG_B`).
  - Executed true PostgreSQL RLS 6-step proof for SEC-RLS-DB-08: Dedicated Platform Admin identity exists → Platform role active in `eco_user_platform_role` → Zero membership in target HORECA tenant → Tenant business record exists in `eco_counterparties` → Authenticated query returns 0 rows (PLATFORM ADMINISTRATION != TENANT BUSINESS DATA ACCESS).
- [x] **Defect 1 Remediated (Unknown Roles Security)**:
  - Eliminated automatic fallback to `OWNER`.
  - Unknown legacy roles strictly preserve legacy string and set `role_template_id = NULL`, failing closed on all capability evaluations.
  - Corrected legacy `SUPERADMIN` mapping: tenant membership maps to `OWNER`, with `VEGEN_PLATFORM_ADMIN` segregated as a separate platform grant.
- [x] **Defect 2 Remediated (Operational Unit Taxonomy)**:
  - Canonical primary types enforced: `LOCAL`, `WAREHOUSE`, `PRODUCTION_CENTER`, `OTHER`.
  - Added optional `unit_subtype` column (`KITCHEN`, `SALON`, `BAR`, `CENTRAL_OFFICE`, `DELIVERY_HUB`).
  - Safe data preservation and non-destructive mapping of legacy unit types.
- [x] **Defect 3 Remediated (Multi-Unit Membership Scoping)**:
  - Created `eco_membership_operational_unit_scopes` table for fine-grained multi-location access.
  - Added explicit `is_organization_wide` boolean flag with clear invariant (`true` = all units; `false` = scoped to assigned units).
  - Deprecated single `operational_unit_id` column on memberships.
  - Updated all application use cases, domain entities, and repository adapters.
- [x] **Defect 4 Remediated (Capability Registry & Mandatory Human Gates)**:
  - Full domain capability coverage (Platform, Org, OpUnits, Sales, Purchases, Catalog, Recipes, Production, Inventory, Financial, Documents, Personnel, Reporting, Integrations, Deletion, Sensitive Data).
  - Mandatory Human Gates strictly segregated (`REVIEW_RECONCILIATION` vs `CONFIRM_RECONCILIATION`, etc.).
  - Rebuilt all 13 canonical role template capability bundles.
- [x] **Database Remediation Migration**: Versioned SQL migration `20260913000000_wp002_contract_remediation.sql`.
- [x] **Product Owner Login Gate**: Verified `emilianodirosa1+horeca-dev@gmail.com` profile, active membership, primary org resolution, and logout/login cycle.
- [x] **Security & Contract Test Suites**: 70 automated tests across 9 suites (100% passing).
- [x] **Quality Gates**: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm run test:run` (70/70 PASS), `npm run build` (PASS).

## 3. Work Package Execution Gate

WP-002 — CANONICAL TENANCY, IDENTITY & AUTHORIZATION CORE  
STATUS: HORECA_REBASELINED_READY_FOR_JULES  

NEXT:  
Await Development Captain verification before Jules re-review. Do not start WP-003.
