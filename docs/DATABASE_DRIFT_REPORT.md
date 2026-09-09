# DATABASE DRIFT REPORT — HORECA MODULAR

## 1. Audit Overview
This report details the exact schema, RLS policy, and migration drift between repository migration SQL files (`supabase/migrations/*.sql`) and the live canonical database `ourzapkjykzlwsjunzmd`.

> **CRITICAL RECONSTRUCTION NOTICE**: Repository migrations committed to date (`supabase/migrations/20260903000000_supabase_auth_rls.sql`) **cannot** reconstruct the live database schema from an empty state (`scratch/` / fresh database). Several foundational tables pre-existed in the live database and are only referenced by foreign keys or RLS policies, while other tables remain completely untracked in Git.

- **Repository Migration Files**: 1 file (`supabase/migrations/20260903000000_supabase_auth_rls.sql`).
- **Unmerged Branch Migration Files**: 1 file (`supabase/migrations/20260901000000_init_escandallos.sql` on branch `origin/feature/escandallos-2485206073148743544`).
- **Live Database Schemas**: 34 public tables, 8 storage tables in `ourzapkjykzlwsjunzmd`.

---

## 2. Factually Accurate Table Migration Classification

| Table Name | Live Row Count | Created in Repo Migration? | Referenced in Repo Migration? | Status / Classification | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `eco_organization_members` | 2 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `eco_auth_bootstrap_allowlist` | 2 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `empleados` | 0 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `fichajes` | 0 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `incidencias` | 0 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `produccion_registros` | 0 | **YES** | YES | **CREATED_IN_REPO** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `eco_organizations` | 4 | **NO** | YES | **REFERENCED_ONLY** | Table pre-existed in DB; referenced by FK in `20260903000000_supabase_auth_rls.sql`. `CREATE TABLE` missing from repo. |
| `eco_user_profiles` | 4 | **NO** | YES | **REFERENCED_ONLY** | Table pre-existed in DB; referenced by FK in `20260903000000_supabase_auth_rls.sql`. `CREATE TABLE` missing from repo. |
| `eco_financial_movements` | 0 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_source_imports` | 5 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_source_files` | 5 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_import_rows` | 571 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_movement_allocations` | 0 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_financial_accounts` | 5 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_classification_rules` | 0 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_counterparties` | 0 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_tax_subcategories` | 20 | **NO** | YES | **REFERENCED_ONLY** | Referenced in RLS policy; `CREATE TABLE` missing from repo. |
| `eco_audit_events` | 59 | **NO** | NO | **UNTRACKED_DRIFT** | Unreferenced & uncreated in migrations. Uses legacy RLS policy (`private.org_id()`). |
| `eco_capabilities` | 42 | **NO** | NO | **UNTRACKED_DRIFT** | Unreferenced & uncreated in migrations. |
| `eco_economic_activities` | 958 | **NO** | NO | **UNTRACKED_DRIFT** | ARCA catalog. Unreferenced & uncreated in migrations. |
| `eco_import_issues` | 128 | **NO** | NO | **UNTRACKED_DRIFT** | Statement import error logs. Uses legacy RLS policy (`private.org_id()`). |
| `eco_membership_capability_overrides` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Membership overrides table. |
| `eco_normalized_records` | 564 | **NO** | NO | **UNTRACKED_DRIFT** | Intermediate normalized records. Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_activity_iibb_rates` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_economic_activities` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Uses legacy RLS policy (`private.org_id()`). |
| `eco_org_tax_categories` | 41 | **NO** | NO | **UNTRACKED_DRIFT** | Uses legacy RLS policy (`private.org_id()`). |
| `eco_platform_role_org_capabilities` | 20 | **NO** | NO | **UNTRACKED_DRIFT** | Platform role capability mapping. |
| `eco_review_actions` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Import review logs. |
| `eco_role_template_capabilities` | 106 | **NO** | NO | **UNTRACKED_DRIFT** | Role template capability mapping. |
| `eco_role_templates` | 8 | **NO** | NO | **UNTRACKED_DRIFT** | Default role templates. |
| `eco_tax_categories` | 55 | **NO** | NO | **UNTRACKED_DRIFT** | Tax category master list. |
| `eco_user_active_context` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Session active context. |
| `eco_user_platform_capability_overrides` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | User capability overrides. |
| `eco_user_platform_role` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | User platform roles. |

---

## 3. Security Policy Drift & Remediation Roadmap
- **AS-IS Bootstrap Helper**: `get_auth_user_org_id()` evaluates `auth.uid() -> eco_user_profiles -> eco_organization_members` with `LIMIT 1`. Suitable for single-tenant bootstrap operations.
- **TARGET Multi-CIF Standard**: In WP-001 canonical migration scripts, RLS policies will be updated to validate `organization_id IN (SELECT organization_id FROM eco_organization_members WHERE ...)` supporting multi-CIF memberships.
- **Legacy Function Cleanup**: RLS policies evaluating `private.org_id()` will be systematically updated in WP-001.

---

## 4. Related Forensic Audit References
- Escandallos Branch Audit: [`./ESCANDALLOS_BRANCH_AUDIT.md`](./ESCANDALLOS_BRANCH_AUDIT.md)
- Purchases Legacy Audit: [`./PURCHASES_LEGACY_AUDIT.md`](./PURCHASES_LEGACY_AUDIT.md)
- Sales / Last.app Asset Audit: [`./SALES_LAST_ASSET_AUDIT.md`](./SALES_LAST_ASSET_AUDIT.md)
