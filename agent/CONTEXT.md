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
- **Canonical Supabase Staging Project**: `ourzapkjykzlwsjunzmd` (`https://ourzapkjykzlwsjunzmd.supabase.co`)
- **Deployed DEV Preview**: `https://horecamodular-git-dev-vegen-s-projects.vercel.app/`

## 4. Strict Operating Rules
1. **Language**: All documentation, commit messages, and reports must be in **ENGLISH**.
2. **Fail-Closed Security**: NEVER weaken RLS policies, bypass database security, or introduce client-side fallback authorization.
3. **No Secrets**: NEVER print, commit, or log plain-text passwords or secret keys.
4. **HORECA Test Fixture Standard**: All test fixtures must be explicitly HORECA-owned (`HORECA_TEST_ORG_A`, `HORECA_TEST_ORG_B`, `horeca-security-*@test.invalid`). Zero reuse of unrelated DEV users or MICA artifacts.
5. **No Scope Creep**: Perform work package tasks strictly within the defined WP boundaries.
