# FORENSIC AUDIT — PURCHASES (PEDIDOS) LEGACY ASSETS & DATA

## 1. Executive Summary
- **Module Path**: `src/modules/pedidos/` (`PedidosApp.jsx`, `pedidos.css`)
- **Audit Objective**: Perform an empirical forensic audit distinguishing **PHYSICALLY VERIFIED REPOSITORY ASSETS** from **LOCAL WORKSPACE ASSETS** and **UNVERIFIED / UNTRACKED DATABASE ASSETS**.

---

## 2. Asset Verification Breakdown

| Asset Category | Asset Location / Description | Verification Status | Forensic Findings |
| :--- | :--- | :---: | :--- |
| **Repository UI Component** | `src/modules/pedidos/PedidosApp.jsx` | **VERIFIED IN REPO** | Prototype / Mock UI state. Uses hardcoded seed arrays (`Carnicería Carlos`, `Bebidas Premium`). Zero Supabase DB integration. |
| **Repository Stylesheet** | `src/modules/pedidos/pedidos.css` | **VERIFIED IN REPO** | Pure CSS styling rules for purchase order forms and table layouts. |
| **Repository DB Migrations** | `supabase/migrations/` | **NOT PRESENT IN REPO** | No purchase schema, supplier tables, or purchase order migrations exist in Git. |
| **Live Database Tables** | Supabase Project `ourzapkjykzlwsjunzmd` | **NOT PRESENT IN DB** | Querying `information_schema.tables` confirms 0 purchase-related tables exist in the live staging database. |
| **Local Workspace Dump Assets** | `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\database-dumps\` | **VERIFIED IN LOCAL WORKSPACE (EXTERNAL TO REPO)** | Present on local developer filesystem outside Git repository root `el_criollo_modular`. Contains raw SQL dumps of legacy databases. |
| **Local Workspace Sample Files** | `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\input-samples\` | **VERIFIED IN LOCAL WORKSPACE (EXTERNAL TO REPO)** | Present on local developer filesystem outside Git repository root. Contains supplier invoices, CSV statement exports, and sample order files. |

---

## 3. Data Preservation Requirements for WP-006
1. **Repository Boundary Safety**: Physical sample files and database dumps in the parent workspace directory (`el-criollo-ecosistema`) MUST be ingested during WP-006 into canonical migration scripts rather than checked directly into application Git history.
2. **Historical Cost Evaluation**: Historical purchase records are required by the Escandallos module (`IngredientCostProvider.js`) for `LAST_PURCHASE` ingredient pricing.
3. **Database Schema Provisions**: WP-006 will introduce version-controlled migration files for `eco_suppliers`, `eco_purchase_orders`, and `eco_purchase_order_items` with strict multi-tenant RLS policies.
