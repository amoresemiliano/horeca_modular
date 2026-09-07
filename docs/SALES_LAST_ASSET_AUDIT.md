# FORENSIC AUDIT — SALES & LAST.APP POS INTEGRATION ASSETS

## 1. Executive Summary
- **Current Module Path**: `src/modules/ventas/` (`VentasApp.jsx`)
- **Documentation References**: `docs/diagnostico/09-integracion-last.md`, `docs/fase-1-extractos/05-importacion-last-csv.md`
- **Audit Objective**: Inventory existing CSV parsing logic, product mapping rules, and POS integration specs to prepare for WP-007 implementation.

---

## 2. Analysis of Current Frontend Code (`src/modules/ventas/VentasApp.jsx`)
- **Implementation Status**: Client-side CSV file reader using `papaparse`.
- **Parsing Capabilities**: Parses uploaded POS ticket CSV files and maps fields:
  - `ticket` (Ticket ID)
  - `fecha` / `hora` (Date & Time)
  - `productos` (Item names/descriptions)
  - `comensales` (Guest count)
  - `tiempo` (Duration)
  - `zona` (Seating area / Dining room / Terrace)
  - `total` (Total ticket amount in EUR)
- **Database Integration**: Current UI renders parsed CSV rows in transient React state without database persistence.

---

## 3. Last.app POS Integration Specifications

### A. Data Channels
1. **File Import Channel (CSV/XLS)**: Manual upload of exported daily sales reports from Last.app back-office.
2. **API Integration Channel (Webhook / REST)**: Automated REST API synchronization connecting Last.app POS webhooks to Supabase Edge Functions.

### B. Core Data Model Requirements for WP-007:
1. `eco_pos_tickets`: Header table storing sales tickets (`id`, `organization_id`, `external_ticket_id`, `pos_source` (`last_app`), `opened_at`, `closed_at`, `diners_count`, `zone_name`, `subtotal`, `tax_amount`, `total_amount`, `payment_method`).
2. `eco_pos_ticket_items`: Itemized sales lines (`id`, `organization_id`, `ticket_id`, `external_product_id`, `product_name`, `quantity`, `unit_price`, `total_price`).
3. `eco_external_product_mapping`: Maps `external_product_id` from Last.app to internal recipe IDs (`recipes.id` / `escandallos`) for automated stock depletion and recipe cost tracking.

---

## 4. WP-007 Implementation Roadmap
1. Create persistent multi-tenant tables (`eco_pos_tickets`, `eco_pos_ticket_items`, `eco_external_product_mapping`) with strict RLS policies.
2. Refactor `VentasApp.jsx` to upload CSV sales reports directly to `eco_pos_tickets` via Supabase JS Client.
3. Build Last.app POS webhook endpoint using a Supabase Edge Function to process real-time ticket sales.
4. Integrate sales ticket items with Escandallos to automatically update ingredient consumption and food cost metrics.
