# FORENSIC AUDIT — SALES & LAST.APP POS INTEGRATION ASSETS

## 1. Executive Summary
- **Module Path**: `src/modules/ventas/` (`VentasApp.jsx`)
- **Documentation References**: `docs/diagnostico/09-integracion-last.md`, `docs/fase-1-extractos/05-importacion-last-csv.md`
- **Audit Objective**: Perform an empirical forensic audit distinguishing **PHYSICALLY VERIFIED REPOSITORY ASSETS** from **LOCAL WORKSPACE ASSETS** and **UNVERIFIED / UNTRACKED DATABASE ASSETS**.

---

## 2. Asset Verification Breakdown

| Asset Category | Asset Location / Description | Verification Status | Forensic Findings |
| :--- | :--- | :---: | :--- |
| **Repository UI Component** | `src/modules/ventas/VentasApp.jsx` | **VERIFIED IN REPO** | Frontend component containing client-side CSV parsing using `papaparse`. Parses ticket ID, date, time, products, guest count, dining zone, and amount. Rendered in transient state. |
| **Repository Design Specifications** | `docs/diagnostico/09-integracion-last.md`, `docs/fase-1-extractos/05-importacion-last-csv.md` | **VERIFIED IN REPO** | Architectural specifications for Last.app CSV structure, column definitions, and product mapping rules. |
| **Repository DB Migrations** | `supabase/migrations/` | **NOT PRESENT IN REPO** | 0 database migration files for sales tickets, POS items, or Last.app product mappings exist in Git. |
| **Live Database Tables** | Supabase Project `ourzapkjykzlwsjunzmd` | **NOT PRESENT IN DB** | Querying `information_schema.tables` confirms 0 sales or POS tables exist in the live database. |
| **Local Workspace Last.app API Assets** | `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\last_API\` | **VERIFIED IN LOCAL WORKSPACE (EXTERNAL TO REPO)** | Present on local developer filesystem outside Git repository root `el_criollo_modular`. Contains Last.app API documentation, sample JSON payloads, and integration notes. |

---

## 3. Target Architecture & WP-007 Roadmap

### A. Data Channels for Sales Ingestion:
1. **File Import Channel (CSV/XLS)**: Manual upload of exported daily sales reports from Last.app back-office via `VentasApp.jsx`.
2. **API Integration Channel (Webhook / REST)**: Automated REST API synchronization connecting Last.app POS webhooks to Supabase Edge Functions.

### B. Core Data Model Provisions for WP-007:
1. `eco_pos_tickets`: Header table storing sales tickets (`id`, `organization_id`, `external_ticket_id`, `pos_source`, `opened_at`, `closed_at`, `diners_count`, `zone_name`, `subtotal`, `tax_amount`, `total_amount`, `payment_method`).
2. `eco_pos_ticket_items`: Itemized sales lines (`id`, `organization_id`, `ticket_id`, `external_product_id`, `product_name`, `quantity`, `unit_price`, `total_price`).
3. `eco_external_product_mapping`: Maps `external_product_id` from Last.app to internal recipe IDs (`recipes.id` / `escandallos`) for automated stock depletion and recipe cost tracking.
