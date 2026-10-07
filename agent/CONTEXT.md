# AGENT CONTEXT — HORECA MODULAR

## 1. System Identity & Mission
- **Product Name**: HORECA Modular
- **Product Domain**: HORECA / Restaurant / Hospitality operations
- **Target Market**: Spain (initially)
- **Reference Customer / Initial Business Tenant**: El Criollo
- **Product Purpose**: Multi-tenant operational and financial SaaS platform for restaurants, cafés, and hospitality groups.
- **Project Boundary Rule**: **THIS PROJECT IS NOT MICA.** MICA is a separate accounting/administrative project for Argentina. No MICA tenant, user, email, organization, fixture, business rule, or domain assumption (CUIT, IIBB, AFIP/ARCA, percepciones) may be used as a HORECA baseline.

## 2. Canonical Tenancy & Authorization Model
- **Hierarchy**:
  `Holding / Group` → `Organization (legal entity / CIF)` → `Operational Unit (LOCAL, WAREHOUSE, PRODUCTION_CENTER, OTHER)`
- **Runtime Authorization Stack**:
  `User` + `OrganizationMembership` + `Capability` + `OperationalUnit Scope` + `Module Entitlement` + `ActiveContext`
- **Core Ownership**: The Master / Development Captain owns Core Tenancy and Authorization foundations (`User`, `UserProfile`, `Holding`, `Organization`, `OperationalUnit`, `OrganizationMembership`, `HoldingMembership`, `RoleTemplate`, `Capability`, `ModuleEntitlement`, `ActiveContext`, `Subscription`). Module stream agents must never redefine or bypass core authorization.

## 3. Core Repository & Infrastructure Map
- **Repository**: `https://github.com/amoresemiliano/horeca_modular`
- **Active Branch**: `dev`
- **Canonical Supabase Staging Project**: `vmxjqwlfwnphorthhcwu` (`https://vmxjqwlfwnphorthhcwu.supabase.co`)
- **Deployed DEV Preview**: `https://horecamodular-git-dev-vegen-s-projects.vercel.app/`

- **Core DEV deployment state (2026-09-28)**: Core baseline and CCR-FIN-001 deployed to the canonical HORECA DEV target. Hosted grants, RLS and authorization scenarios verified. Active migration chain: `20260926000000` then `20260927000000`; historical migrations are archived, not marked applied. Tenant bootstrap is intentionally empty. See `docs/CORE_DEV_BASELINE_RESTORATION.md`.

## 4. Strict Operating Rules
1. **Language**: All documentation, commit messages, and reports must be in **ENGLISH**.
2. **Fail-Closed Security**: NEVER weaken RLS policies, bypass database security, or introduce client-side fallback authorization.
3. **No Secrets**: NEVER print, commit, or log plain-text passwords or secret keys.
4. **HORECA Test Fixture Standard**: All test fixtures must be explicitly HORECA-owned (`HORECA_TEST_ORG_A`, `HORECA_TEST_ORG_B`, `horeca-security-*@test.invalid`). Zero reuse of unrelated DEV users or MICA artifacts.
5. **No Scope Creep**: Perform work package tasks strictly within the defined WP boundaries.

## Shared database safety — effective 2026-10-06

HORECA DEV and PROD share Supabase `vmxjqwlfwnphorthhcwu`. **El Criollo REAL DATA MODE is ACTIVE** (`f84168ef-2b78-451b-b0a9-39c1c381e59b`). NEVER load synthetic fixtures into it, globally sanitize/reset it, or target it with automated destructive tests. Future Sales synthetic/hosted tests must target **HORECA DEV LAB** (`HORECA_DEV_LAB`, `f7f6da70-f7dc-4b1a-aa23-f5612174dcbc`), which has separate OWNER membership and Banks-only entitlement until Master enables Sales. Do not apply Sales migrations, configure real Last.app credentials or call live Last.app as part of branch reconciliation. Historical DEV-only infrastructure notes above are superseded by this shared-model rule. See `docs/SALES-DEV-RESYNC.md`.
