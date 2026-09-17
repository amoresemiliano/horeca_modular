# DATABASE DRIFT REPORT — HORECA MODULAR

## 1. Audit Overview
This report details the exact schema, RLS policy, and migration drift between repository migration SQL files (`supabase/migrations/*.sql`) and the live canonical database `ourzapkjykzlwsjunzmd`.

- **Repository Migration Files**: 4 files:
  1. `supabase/migrations/20260903000000_supabase_auth_rls.sql` (WP-001 Auth foundation)
  2. `supabase/migrations/20260912000000_canonical_tenancy_and_auth_core.sql` (WP-002 Canonical Tenancy, 13 Role Templates & Auth Core)
  3. `supabase/migrations/20260913000000_wp002_contract_remediation.sql` (WP-002 Security, OpUnit taxonomy & scopes)
  4. `supabase/migrations/20260917000000_wp002_role_templates_reconciliation.sql` (WP-002 Final Role Templates & Membership Reference Reconciliation)
- **Live Database Schemas**: 34 public tables, 8 storage tables in `ourzapkjykzlwsjunzmd`.

---

## 2. Factually Accurate Table Migration Classification

| Table Name | Live Row Count | Created in Repo Migration? | Referenced in Repo Migration? | Status / Classification | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `eco_holdings` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260912000000`. Clean baseline (0 fixture rows). |
| `eco_holding_members` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260912000000`. Clean baseline (0 fixture rows). |
| `eco_operational_units` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260912000000` & remediated in `20260913000000`. |
| `eco_organization_module_entitlements` | 44 | **YES** | YES | **APPLIED_LIVE** | Created in `20260912000000`. 11 modules provisioned across 4 organizations. |
| `eco_organization_members` | 7 | **YES** | YES | **APPLIED_LIVE** | Enhanced in `20260912000000`, `20260913000000` & `20260917000000` (1 OWNER + 6 CONSULTANT). |
| `eco_membership_operational_unit_scopes` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260913000000`. Clean baseline (0 fixture rows). |
| `eco_capabilities` | 95 | **YES** | YES | **APPLIED_LIVE** | Registered 95 canonical capabilities including 6 human gates. |
| `eco_role_templates` | 21 | **YES** | YES | **APPLIED_LIVE** | 13 Active Canonical role templates + 8 Inactive Legacy templates. |
| `eco_role_template_capabilities` | 396 | **YES** | YES | **APPLIED_LIVE** | Re-bundled across all canonical role templates. |
| `eco_member_capability_overrides` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260912000000`. Clean baseline (0 fixture rows). |
| `eco_auth_bootstrap_allowlist` | 3 | **YES** | YES | **APPLIED_LIVE** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `empleados` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `fichajes` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `incidencias` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `produccion_registros` | 0 | **YES** | YES | **APPLIED_LIVE** | Created in `20260903000000_supabase_auth_rls.sql`. |
| `eco_organizations` | 4 | **NO** | YES | **APPLIED_LIVE** | Enhanced with `holding_id`, `legal_name`, `tax_id`, etc. (1 MICA + 3 Demo). |
| `eco_user_profiles` | 6 | **NO** | YES | **APPLIED_LIVE** | Pre-existed in DB (5 MICA + 1 global); referenced by FK in repo migrations. |
| `eco_financial_movements` | 0 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_source_imports` | 5 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_source_files` | 5 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_import_rows` | 571 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_movement_allocations` | 0 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_financial_accounts` | 5 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_classification_rules` | 0 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_counterparties` | 0 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_tax_subcategories` | 20 | **NO** | YES | **TARGET REMAINING** | Business module under WP-003+ migration scope. |
| `eco_audit_events` | 59 | **NO** | NO | **UNTRACKED_DRIFT** | Uses legacy RLS policy (`private.org_id()`). |
| `eco_economic_activities` | 958 | **NO** | NO | **UNTRACKED_DRIFT** | ARCA catalog. |
| `eco_import_issues` | 128 | **NO** | NO | **TARGET REMAINING** | Statement import error logs. |
| `eco_normalized_records` | 564 | **NO** | NO | **TARGET REMAINING** | Intermediate normalized records. |
| `eco_org_activity_iibb_rates` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Legacy rate table. |
| `eco_org_economic_activities` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Legacy catalog table. |
| `eco_org_tax_categories` | 41 | **NO** | NO | **UNTRACKED_DRIFT** | Legacy catalog table. |
| `eco_platform_role_org_capabilities` | 20 | **NO** | NO | **UNTRACKED_DRIFT** | Platform role capability mapping. |
| `eco_review_actions` | 0 | **NO** | NO | **TARGET REMAINING** | Import review logs. |
| `eco_tax_categories` | 55 | **NO** | NO | **UNTRACKED_DRIFT** | Tax category master list. |
| `eco_user_active_context` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | Session active context. |
| `eco_user_platform_capability_overrides` | 0 | **NO** | NO | **UNTRACKED_DRIFT** | User capability overrides. |
| `eco_user_platform_role` | 2 | **NO** | NO | **UNTRACKED_DRIFT** | User platform roles. |

---

## 3. Security Policy Drift & Remediation Roadmap
- **AS-IS Bootstrap Helper**: `get_auth_user_org_id()` evaluates `auth.uid() -> eco_user_profiles -> eco_organization_members` with `LIMIT 1`.
- **WP-002 Multi-CIF Canonical Helpers**: Added `user_has_org_membership(org_id)`, `user_has_holding_membership(holding_id)`, and `get_auth_user_org_ids()` in `20260912000000_canonical_tenancy_and_auth_core.sql`.
- **Target Remaining Business Modules**: Legacy business module tables (`eco_financial_*`, `eco_source_*`, `eco_import_*`) remain on transitional RLS and will be migrated in subsequent work packages (WP-003+).
