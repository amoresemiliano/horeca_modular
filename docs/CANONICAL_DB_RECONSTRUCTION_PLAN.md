# CANONICAL DATABASE RECONSTRUCTION PLAN — HORECA MODULAR

> **Status**: APPROVED TECHNICAL PLAN (WP-001)  
> **Target Database Baseline**: Supabase Project `ourzapkjykzlwsjunzmd`  
> **Execution Scope**: Non-destructive inventory & ordering in WP-001; execution phased across WPs 002–008.

---

## 1. Executive Summary & Objective

The forensic audit in WP-000 and WP-001 confirmed that the repository migrations prior to WP-001 could not reconstruct the live database schema from a clean state (`scratch/` / empty database). Foundational tables (e.g. `eco_organizations`, `eco_user_profiles`, `eco_capabilities`, `eco_tax_categories`) pre-existed in Supabase staging without source-controlled DDL definitions.

This document establishes the **machine-readable table disposition inventory**, **dependency graph**, **seed/reference groups**, and **step-by-step reconstruction roadmap** to allow any future environment (DEV, UAT, PROD) to be built reproducibly from zero without data loss or schema drift.

---

## 2. Comprehensive Table Disposition Matrix

Every table in the live staging database (`ourzapkjykzlwsjunzmd`, 34 public tables) is cataloged below with its canonical disposition:
- `KEEP`: Retain schema structure with multi-tenant RLS hardening.
- `MIGRATE`: Transition schema with data migration scripts to target multi-tenant model.
- `REBUILD`: Recreate table cleanly from target DDL specification.
- `REMOVE`: Deprecate and drop obsolete/orphaned legacy tables.
- `HOLD_FOR_AUDIT`: Retain read-only snapshot pending historical data verification.

| # | Table Name | Live Rows | Primary Domain / Module | Target Disposition | Target Migration Group | Target Schema / Model |
| :- | :--- | :-: | :--- | :---: | :---: | :--- |
| 1 | `eco_organizations` | 4 | Tenancy / Platform | **KEEP** | `01_tenancy_core` | Foundational tenant entity (Multi-CIF). |
| 2 | `eco_user_profiles` | 4 | Auth / Identity | **KEEP** | `01_tenancy_core` | Profile linked to `auth.users(id)`. |
| 3 | `eco_organization_members` | 2 | Tenancy / Auth | **KEEP** | `01_tenancy_core` | Core membership with role & status. |
| 4 | `eco_auth_bootstrap_allowlist` | 2 | Platform Bootstrap | **KEEP** | `01_tenancy_core` | First-user setup allowlist. |
| 5 | `eco_capabilities` | 42 | Tenancy / Auth | **KEEP** | `01_reference_data` | Canonical atomic capability catalog. |
| 6 | `eco_role_templates` | 8 | Tenancy / Auth | **KEEP** | `01_reference_data` | 13 approved VEGEN role templates. |
| 7 | `eco_role_template_capabilities`| 106 | Tenancy / Auth | **KEEP** | `01_reference_data` | Default role-to-capability mappings. |
| 8 | `eco_membership_capability_overrides` | 0 | Tenancy / Auth | **KEEP** | `01_tenancy_core` | Per-membership grant/revoke overrides. |
| 9 | `eco_user_platform_role` | 0 | Platform Admin | **KEEP** | `01_tenancy_core` | VEGEN platform operators (system-level). |
| 10 | `eco_platform_role_org_capabilities` | 20 | Platform Admin | **KEEP** | `01_tenancy_core` | Platform operator tenant delegations. |
| 11 | `eco_user_platform_capability_overrides` | 0 | Platform Admin | **KEEP** | `01_tenancy_core` | Granular platform operator overrides. |
| 12 | `eco_user_active_context` | 0 | Session / UX | **REBUILD** | `01_tenancy_core` | Ephemeral UX focus tracking (non-authoritative). |
| 13 | `eco_audit_events` | 59 | Security / Audit | **KEEP** | `01_tenancy_core` | Immutable security and domain audit log. |
| 14 | `eco_tax_categories` | 55 | Financial / Master | **KEEP** | `02_financial_reference` | Master tax categories. |
| 15 | `eco_tax_subcategories` | 20 | Financial / Master | **KEEP** | `02_financial_reference` | Subcategory breakdowns. |
| 16 | `eco_economic_activities` | 958 | Financial / ARCA | **KEEP** | `02_financial_reference` | Official ARCA economic activity catalog. |
| 17 | `eco_org_tax_categories` | 41 | Financial / Tenant | **KEEP** | `02_financial_core` | Per-tenant active tax categories. |
| 18 | `eco_org_economic_activities` | 0 | Financial / Tenant | **KEEP** | `02_financial_core` | Per-tenant economic activities. |
| 19 | `eco_org_activity_iibb_rates` | 0 | Financial / Tax | **KEEP** | `02_financial_core` | IIBB tax rates per organization. |
| 20 | `eco_financial_accounts` | 5 | Financial / Extractos | **KEEP** | `02_financial_core` | Bank and cash accounts per tenant. |
| 21 | `eco_counterparties` | 0 | Financial / Extractos | **KEEP** | `02_financial_core` | Identified financial counterparties. |
| 22 | `eco_classification_rules` | 0 | Financial / Extractos | **KEEP** | `02_financial_core` | Automated bank movement rule engine. |
| 23 | `eco_source_files` | 5 | Financial / Extractos | **KEEP** | `02_financial_data` | Uploaded raw statement files & checksums. |
| 24 | `eco_source_imports` | 5 | Financial / Extractos | **KEEP** | `02_financial_data` | Import batches & status tracking. |
| 25 | `eco_import_rows` | 571 | Financial / Extractos | **KEEP** | `02_financial_data` | Raw parsed statement line items. |
| 26 | `eco_normalized_records` | 564 | Financial / Extractos | **KEEP** | `02_financial_data` | Normalized extracto line items. |
| 27 | `eco_financial_movements` | 0 | Financial / Extractos | **KEEP** | `02_financial_data` | Reconciled financial journal movements. |
| 28 | `eco_movement_allocations` | 0 | Financial / Extractos | **KEEP** | `02_financial_data` | Multi-category movement split allocations. |
| 29 | `eco_import_issues` | 128 | Financial / Extractos | **KEEP** | `02_financial_data` | Import anomaly & validation issue logs. |
| 30 | `eco_review_actions` | 0 | Financial / Extractos | **KEEP** | `02_financial_data` | Human review actions on import issues. |
| 31 | `empleados` | 0 | Personal / HR | **MIGRATE** | `03_hr_personal` | Target schema `eco_employees` + `org_id`. |
| 32 | `fichajes` | 0 | Personal / HR | **MIGRATE** | `03_hr_personal` | Target schema `eco_time_entries` + `org_id`. |
| 33 | `incidencias` | 0 | Personal / HR | **MIGRATE** | `03_hr_personal` | Target schema `eco_hr_incidents` + `org_id`. |
| 34 | `produccion_registros` | 0 | Producción | **REBUILD** | `04_production` | Replaced by normalized recipe batch runs. |

---

## 3. Dependency Ordering for Clean Reconstruction

Reconstructing a blank database instance requires running migrations in strict topological order to satisfy Foreign Key constraints:

```mermaid
graph TD
    subgraph Group 1: Tenancy & Auth Foundation
        G1_1[eco_organizations] --> G1_2[eco_user_profiles]
        G1_1 --> G1_3[eco_organization_members]
        G1_2 --> G1_3
        G1_4[eco_capabilities] --> G1_5[eco_role_template_capabilities]
        G1_6[eco_role_templates] --> G1_5
        G1_3 --> G1_7[eco_membership_capability_overrides]
        G1_4 --> G1_7
        G1_1 --> G1_8[eco_audit_events]
    end

    subgraph Group 2: Financial Master & Reference Data
        G2_1[eco_tax_categories] --> G2_2[eco_tax_subcategories]
        G2_3[eco_economic_activities]
    end

    subgraph Group 3: Financial & Extractos Core
        G1_1 --> G3_1[eco_org_tax_categories]
        G2_1 --> G3_1
        G1_1 --> G3_2[eco_financial_accounts]
        G1_1 --> G3_3[eco_source_files]
        G3_3 --> G3_4[eco_source_imports]
        G3_4 --> G3_5[eco_import_rows]
        G3_5 --> G3_6[eco_normalized_records]
        G3_6 --> G3_7[eco_financial_movements]
        G3_7 --> G3_8[eco_movement_allocations]
        G3_5 --> G3_9[eco_import_issues]
    end

    subgraph Group 4: Operational Modules (HR, Escandallos, Inventario)
        G1_1 --> G4_1[eco_employees]
        G4_1 --> G4_2[eco_time_entries]
        G4_1 --> G4_3[eco_hr_incidents]
    end
```

---

## 4. Target Migration Groups

### Group 01: `01_tenancy_and_auth`
- **Tables**: `eco_organizations`, `eco_user_profiles`, `eco_organization_members`, `eco_auth_bootstrap_allowlist`, `eco_capabilities`, `eco_role_templates`, `eco_role_template_capabilities`, `eco_membership_capability_overrides`, `eco_user_platform_role`, `eco_platform_role_org_capabilities`, `eco_user_platform_capability_overrides`, `eco_user_active_context`, `eco_audit_events`.
- **Functions & RLS**:
  - Multi-tenant helper function: `is_org_member(org_id uuid)`.
  - Capability evaluator function: `has_capability(org_id uuid, cap_name text)`.
  - Immutable audit trigger function.
  - Fail-closed RLS on all tables.

### Group 02: `02_reference_and_tax_master`
- **Tables**: `eco_tax_categories`, `eco_tax_subcategories`, `eco_economic_activities`.
- **Seeds**: Full ARCA 958 activities and Spanish tax categorization hierarchy.

### Group 03: `03_financial_and_extractos`
- **Tables**: `eco_org_tax_categories`, `eco_org_economic_activities`, `eco_org_activity_iibb_rates`, `eco_financial_accounts`, `eco_counterparties`, `eco_classification_rules`, `eco_source_files`, `eco_source_imports`, `eco_import_rows`, `eco_normalized_records`, `eco_financial_movements`, `eco_movement_allocations`, `eco_import_issues`, `eco_review_actions`.
- **Policies**: Multi-tenant RLS enforcing `organization_id IN (SELECT organization_id FROM eco_organization_members WHERE user_id = auth.uid() AND status = 'active')`.

### Group 04: `04_operational_hr_personal`
- **Tables**: `eco_employees`, `eco_time_entries`, `eco_hr_incidents`.
- **Data Migration**: DDL refactor from Spanish prototype tables (`empleados`, `fichajes`, `incidencias`) with foreign keys to `eco_organizations`.

### Group 05: `05_recipes_and_escandallos`
- **Branch Source**: `origin/feature/escandallos-2485206073148743544` migration `20260901000000_init_escandallos.sql`.
- **Tables**: `escandallos`, `escandallo_ingredientes`, `escandallo_versiones`.
- **Hardening**: Add missing `organization_id` column and multi-tenant RLS before merge in WP-005.

### Group 06: `06_inventory_and_production`
- **Tables**: `eco_inventory_items`, `eco_stock_levels`, `eco_stock_movements`, `eco_production_batches`.
- **Hardening**: Replaces in-memory prototype stores with hardened Supabase tables in WP-004.

---

## 5. Seed & Reference Data Groups

1. **Platform Catalog Seeds**:
   - `eco_capabilities`: 42 canonical atomic capabilities across 16 families.
   - `eco_role_templates`: 13 approved VEGEN role templates.
   - `eco_role_template_capabilities`: 106 initial capability bindings.
2. **Tax & Regulatory Seeds**:
   - `eco_tax_categories` (55 rows) and `eco_tax_subcategories` (20 rows).
   - `eco_economic_activities` (958 rows).
3. **Environment Seed Fixtures**:
   - Staging/UAT initial organization fixture (`El Criollo Holding` & subsidiaries).
   - Test account fixture for automated integration testing.

---

## 6. Preflight & Postcheck Verification Protocol

Before applying any reconstruction migration to DEV or UAT:
1. **Preflight Checklist**:
   - Verify active database target is non-production.
   - Run database schema diff against the Canonical Disposition Matrix.
   - Ensure backup snapshot exists in Supabase Storage or pg_dump artifact.
   - Check that no connections are holding table-exclusive locks.
2. **Postcheck Verification**:
   - Verify table row counts match expected seed/migration volumes.
   - Execute `tests/integration/security_isolation.test.ts` against target database.
   - Verify RLS is enabled on 100% of public tables:
     `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;` (must return 0 rows).
   - Verify zero unindexed Foreign Keys for optimal query performance.

---

## 7. WP-001 Verification Statement
- **Destructive Actions Taken**: NONE. Staging database `ourzapkjykzlwsjunzmd` was audited with zero destructive changes.
- **Artifact Status**: Machine-readable inventory complete and ready for execution in subsequent WPs.
