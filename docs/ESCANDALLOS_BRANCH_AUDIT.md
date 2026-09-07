# FORENSIC AUDIT — ESCANDALLOS FEATURE BRANCH

## 1. Executive Summary
- **Branch Name**: `origin/feature/escandallos-2485206073148743544` (Local tracking branch: `feature/escandallos`)
- **HEAD Commit SHA**: [`eb1644c9fc8499b3ea6c22a8fb94250d9ea1913e`](https://github.com/amoresemiliano/horeca_modular/commit/eb1644c9fc8499b3ea6c22a8fb94250d9ea1913e)
- **Commit Author**: `amoresemiliano` (Co-authored-by `google-labs-jules[bot]`)
- **Commit Date**: Wed Sep 2 14:39:20 2026 +0000
- **Status**: UNMERGED & UNAPPLIED. Must NOT be merged or applied to production without refactoring.

---

## 2. Inventory of Branch Assets

| Asset Path | Asset Category | Lines of Code | Description / Functionality |
| :--- | :--- | :---: | :--- |
| `supabase/migrations/20260901000000_init_escandallos.sql` | Database Migration | 88 | Schema definition for 5 tables (`ingredients`, `recipes`, `recipe_items`, `cost_history`, `external_product_mapping`) and RLS policies. |
| `src/modules/escandallos/services/costCalculator.js` | Business Logic | 113 | Client-side cost calculation utility handling circular dependency detection (`detectCycle`), waste (merma) calculations, gross quantities, packaging costs, and food cost percentages. |
| `src/modules/escandallos/services/IngredientCostProvider.js` | Service Adapter | 49 | Abstraction layer for fetching ingredient costs (supports strategy pattern: `LAST_PURCHASE` vs `MANUAL`). |
| `src/modules/escandallos/__tests__/costCalculator.test.js` | Unit Tests | 75 | Jest/Vitest unit tests covering circular dependency detection, merma percentage calculations, and recipe costing. |
| `docs/PRODUCT_OPERATING_CHARTER.md` | Product Documentation | 790 | Detailed business specification for recipe costing, yield, wastage, and Last.app POS mappings. |
| `report.txt` | Build Log Artifact | 32 | Temporary build output log. |

---

## 3. Database Schema Audit (`20260901000000_init_escandallos.sql`)

### Tables Introduced:
1. `public.ingredients`: Master list of raw ingredients, base units, cost strategies (`LAST_PURCHASE`, `MANUAL`), and current cost (`NUMERIC(10,4)`).
2. `public.recipes`: Master list of elaborations and final dishes, type (`FINAL_PRODUCT` vs `PREPARATION`), versioning, produced quantity/unit, waste percentage (`merma_percentage`), packaging cost, total cost, unit cost, and selling price (`pvp_manual`).
3. `public.recipe_items`: Bill of Materials (BOM) mapping `recipes` to raw `ingredients` or nested `child_recipe_id`, net quantity, merma percentage, and computed item cost. Enforces `CHECK (ingredient_id IS NOT NULL OR child_recipe_id IS NOT NULL)`.
4. `public.cost_history`: Audit history table tracking cost changes over time for ingredients and recipes.
5. `public.external_product_mapping`: Maps recipe IDs to external POS product IDs (e.g. Last.app external IDs).

---

## 4. CRITICAL SECURITY FINDINGS & RISKS

> [!CAUTION]
> **CRITICAL RLS SECURITY DEFECT IN MIGRATION FILE**
> All RLS policies defined in `20260901000000_init_escandallos.sql` enforce `USING (true)`:
> ```sql
> CREATE POLICY "Allow all on ingredients" ON public.ingredients FOR ALL USING (true);
> CREATE POLICY "Allow all on recipes" ON public.recipes FOR ALL USING (true);
> CREATE POLICY "Allow all on recipe_items" ON public.recipe_items FOR ALL USING (true);
> CREATE POLICY "Allow all on cost_history" ON public.cost_history FOR ALL USING (true);
> CREATE POLICY "Allow all on external_product_mapping" ON public.external_product_mapping FOR ALL USING (true);
> ```
> This grants **public unrestricted read/write access** across all tenants to all proprietary recipes, ingredient costs, and POS mappings.

---

## 5. Prerequisites for Merging (WP-005 Roadmap)
Before branch `origin/feature/escandallos-2485206073148743544` can be merged into `dev`:
1. **RLS Refactoring**: Replace all `USING (true)` policies with strict multi-tenant RLS validating `organization_id` against `eco_organization_members`.
2. **Naming Harmonization**: Ensure table names (`ingredients`, `recipes`) align with naming conventions (`eco_ingredients`, `eco_recipes`) or prefix conventions.
3. **Database Migration Verification**: Test migration execution in isolation on Supabase Staging (`ourzapkjykzlwsjunzmd`).
4. **Clean Build**: Remove non-production build artifacts (`report.txt`) before final PR.
