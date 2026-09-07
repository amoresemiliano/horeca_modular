# FORENSIC AUDIT — PURCHASES (PEDIDOS) LEGACY ASSETS & DATA

## 1. Executive Summary
- **Current Module Path**: `src/modules/pedidos/` (`PedidosApp.jsx`, `pedidos.css`)
- **Audit Objective**: Inventory the current UI state vs historical purchase data assets to define the WP-006 preservation and migration strategy.

---

## 2. Analysis of Current Frontend Code (`src/modules/pedidos/PedidosApp.jsx`)
- **Implementation Status**: Prototype / Mock UI state.
- **State Persistence**: Uses React in-memory `useState` with hardcoded seed items (`Carnicería Carlos`, `Bebidas Premium`, `Verduras Frescas`).
- **Database Integration**: 0 Supabase DB integration. Orders created via UI modal exist only in transient local state.
- **Mock Handlers**: Export button triggers browser alert (`Función de exportar a Excel en desarrollo`).

---

## 3. Historical Purchases Data Assets
Historical purchase records, supplier price catalogs, and delivery logs exist outside the current transient UI:
- **Historical Assets**: Legacy purchase spreadsheets, PDF invoice archives, and historical DB dumps stored in `/database-dumps/` and `/input-samples/`.
- **Business Criticality**: Historical purchase unit costs are REQUIRED by the Escandallos module (`IngredientCostProvider.js`) to evaluate `LAST_PURCHASE` ingredient pricing.
- **Preservation Mandatory Rule**: Historical purchase records MUST NOT be deleted, overwritten, or discarded.

---

## 4. Target Architecture & WP-006 Roadmap

### A. Database Schema Requirements for WP-006:
1. `eco_suppliers`: Master registry of suppliers (VAT number, business name, payment terms, contact info).
2. `eco_purchase_orders`: Header table tracking purchase orders (`id`, `organization_id`, `supplier_id`, `status` (`DRAFT`, `SENT`, `RECEIVED`, `CANCELLED`), `expected_delivery_date`, `total_amount`, timestamps).
3. `eco_purchase_order_items`: Line items mapping purchase orders to ingredients/products (`id`, `organization_id`, `purchase_order_id`, `ingredient_id`, `quantity_ordered`, `quantity_received`, `unit_price`, `subtotal`).

### B. Ingestion & Migration Strategy:
1. Create persistent multi-tenant schema with strict RLS policies.
2. Build bulk import pipeline to ingest historical purchase spreadsheets into `eco_purchase_orders` and `eco_purchase_order_items`.
3. Connect `IngredientCostProvider.js` in Escandallos to read latest unit price from `eco_purchase_order_items`.
