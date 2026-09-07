# DATABASE DRIFT REPORT — HORECA MODULAR

## 1. Audit Overview
This report details the schema, RLS policy, and function drift between the version-controlled repository migration files (`supabase/migrations/*.sql`) and the live canonical database `ourzapkjykzlwsjunzmd`.

- **Repository Migration Files**: 1 file (`supabase/migrations/20260903000000_supabase_auth_rls.sql`).
- **Unmerged Branch Migrations**: 1 file (`supabase/migrations/20260901000000_init_escandallos.sql` on branch `origin/feature/escandallos-2485206073148743544`).
- **Live Database Schemas**: 34 public tables, 8 storage tables in `ourzapkjykzlwsjunzmd`.

---

## 2. Table Classification & Drift Breakdown

| Table Name | Live Row Count | In Repo Migration? | Status / Classification | Notes |
| :--- | :---: | :---: | :--- | :--- |
| `eco_organizations` | 4 | YES | **SAFE** | Primary tenant table. Matches domain contract. |
| `eco_user_profiles` | 4 | YES | **SAFE** | Global user profiles mapped to `auth.users`. |
| `eco_organization_members` | 2 | YES | **SAFE** | Maps profiles to orgs with roles. |
| `eco_auth_bootstrap_allowlist` | 2 | YES | **SAFE** | Bootstrap role provision allowlist. |
| `eco_financial_accounts` | 5 | YES | **SAFE** | Bank account registry. |
| `eco_source_files` | 5 | YES | **SAFE** | Bank import file metadata. |
| `eco_source_imports` | 5 | YES | **SAFE** | Bank import job logs. |
| `eco_import_rows` | 571 | YES | **SAFE** | Parsed raw statement rows. |
| `eco_financial_movements` | 0 | YES | **SAFE** | Standardized movement entries. |
| `eco_movement_allocations` | 0 | YES | **SAFE** | Editable economic allocations. |
| `eco_classification_rules` | 0 | YES | **SAFE** | Deterministic category matching rules. |
| `eco_counterparties` | 0 | YES | **SAFE** | Counterparty vendor/customer registry. |
| `eco_tax_categories` | 55 | YES | **SAFE** | Tax and chart of account categories. |
| `eco_tax_subcategories` | 20 | YES | **SAFE** | Subcategories. |
| `empleados` | 0 | YES | **SAFE** | Personnel master list. |
| `fichajes` | 0 | YES | **SAFE** | Time clock entries. |
| `incidencias` | 0 | YES | **SAFE** | HR absences and incidents. |
| `produccion_registros` | 0 | YES | **SAFE** | Production batch logs. |
| `eco_audit_events` | 59 | NO | **SCHEMA_DRIFT** | Created via console/early script. Needs repo migration file. Uses legacy RLS policy (`private.org_id()`). |
| `eco_capabilities` | 42 | NO | **SCHEMA_DRIFT** | Granular permission registry. Needs repo migration file. |
| `eco_economic_activities` | 958 | NO | **SCHEMA_DRIFT** | ARCA economic activity catalog. Needs repo migration file. |
| `eco_import_issues` | 128 | NO | **SCHEMA_DRIFT** | Statement import error logs. Uses legacy RLS policy (`private.org_id()`). |
| `eco_normalized_records` | 564 | NO | **SCHEMA_DRIFT** | Intermediate normalized records. Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_activity_iibb_rates` | 0 | NO | **SCHEMA_DRIFT** | IIBB tax rates per org. Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_economic_activities` | 0 | NO | **SCHEMA_DRIFT** | Org assigned activities. Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_tax_categories` | 41 | NO | **SCHEMA_DRIFT** | Org assigned tax categories. Uses legacy RLS policy (`private.org_id()`). |
| `eco_platform_role_org_capabilities` | 20 | NO | **SCHEMA_DRIFT** | Platform role capability mapping. |
| `eco_review_actions` | 0 | NO | **SCHEMA_DRIFT** | Import issue review log. Uses legacy RLS policy (`private.has_issue_access()`). |
| `eco_role_template_capabilities` | 106 | NO | **SCHEMA_DRIFT** | Role template capability mapping. |
| `eco_role_templates` | 8 | NO | **SCHEMA_DRIFT** | Default role templates. |
| `eco_user_active_context` | 0 | NO | **SCHEMA_DRIFT** | Session active context. |
| `eco_user_platform_capability_overrides` | 0 | NO | **SCHEMA_DRIFT** | User capability overrides. |
| `eco_user_platform_role` | 0 | NO | **SCHEMA_DRIFT** | User platform roles. |

---

## 3. RLS Function & Security Policy Drift
- **AS-IS Single-Org Helper**: `get_auth_user_org_id()` evaluates `auth.uid() -> eco_user_profiles -> eco_organization_members` with `LIMIT 1`. This serves as an initial bootstrap helper.
- **TARGET Multi-CIF Standard**: The target RLS policy model will evaluate `organization_id IN (SELECT organization_id FROM eco_organization_members WHERE ...)` or active context resolution to support multi-CIF tenant access.
- **Legacy Function Drift**: Older tables (`eco_audit_events`, `eco_import_issues`, `eco_normalized_records`, `eco_org_tax_categories`) have RLS policies evaluating legacy helper `private.org_id()`.
- **Unmerged Escandallos Security Flaw**: Migration `20260901000000_init_escandallos.sql` on branch `origin/feature/escandallos-2485206073148743544` enforces `USING (true)` across all 5 tables. Detailed in [`ESCANDALLOS_BRANCH_AUDIT.md`](file:///c:/Users/Emiliano/Documents/1.%20Sistemas/El%20Criollo/el-criollo-ecosistema/el_criollo_modular/docs/ESCANDALLOS_BRANCH_AUDIT.md).
- **Remediation Plan**: In WP-001 and WP-005, refactor all RLS policies to evaluate multi-tenant membership checks.

---

## 4. Storage Policy Drift
- **Storage Bucket**: `eco-imports-private-staging` (`public = false`).
- **Policy Drift**: Current storage RLS policy evaluates `(storage.foldername(name))[1] = (private.org_id())::text`.
- **Remediation Plan**: Update storage policy to evaluate tenant folder ownership against `eco_organization_members`.

---

## 5. Related Forensic Audit References
- Escandallos Branch Audit: [`/docs/ESCANDALLOS_BRANCH_AUDIT.md`](file:///c:/Users/Emiliano/Documents/1.%20Sistemas/El%20Criollo/el-criollo-ecosistema/el_criollo_modular/docs/ESCANDALLOS_BRANCH_AUDIT.md)
- Purchases Legacy Audit: [`/docs/PURCHASES_LEGACY_AUDIT.md`](file:///c:/Users/Emiliano/Documents/1.%20Sistemas/El%20Criollo/el-criollo-ecosistema/el_criollo_modular/docs/PURCHASES_LEGACY_AUDIT.md)
- Sales / Last.app Asset Audit: [`/docs/SALES_LAST_ASSET_AUDIT.md`](file:///c:/Users/Emiliano/Documents/1.%20Sistemas/El%20Criollo/el-criollo-ecosistema/el_criollo_modular/docs/SALES_LAST_ASSET_AUDIT.md)
