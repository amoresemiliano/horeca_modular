# FORENSIC AUDIT — PURCHASES (PEDIDOS) LEGACY ASSETS & MIGRATION ROADMAP

## 1. Executive Summary & Evidence Classification Framework
- **Module Boundary**: `src/modules/pedidos/` (`PedidosApp.jsx`, `pedidos.css`)
- **Audit Objective**: Establish an empirical forensic inventory of all existing purchase management assets across the repository, the local workstation, and historical records.

### Canonical Evidence Classification Standard:
- **`VERIFIED_IN_REPOSITORY`**: Asset is committed directly into the Git repository tree (`horeca_modular`) and verifiable by any remote reviewer or automated CI pipeline.
- **`VERIFIED_BY_LOCAL_AGENT`**: Asset was physically located, opened, and inspected on the Product Owner's local workstation. *Independent verification from remote repository is not available*.
- **`NOT_INDEPENDENTLY_VERIFIED`**: Asset is known to exist outside repository boundaries but has not been independently verified via automated remote cryptographic attestation.
- **`NOT_VERIFIED`**: Asset is referenced in historical discussions or legacy documentation but has not been physically located or inspected.

---

## 2. Evidence Breakdown by Category

### A. CURRENT HUB PURCHASES
- **Repository Implementation**: `src/modules/pedidos/PedidosApp.jsx` and `src/modules/pedidos/pedidos.css`.
- **Classification**: `VERIFIED_IN_REPOSITORY`
- **Technical State**: Functional UI prototype operating with client-side memory state and mock supplier catalogs (`Carnicería Carlos`, `Bebidas Premium`). Currently disconnected from live Supabase persistence.

### B. VERIFIED REPOSITORY ASSETS
| Asset Path / Identifier | Asset Type | Status | Forensic Findings |
| :--- | :--- | :---: | :--- |
| `src/modules/pedidos/PedidosApp.jsx` | React UI Component | `VERIFIED_IN_REPOSITORY` | Order creation form, supplier selection, unit pricing, order status badges. |
| `src/modules/pedidos/pedidos.css` | Stylesheet | `VERIFIED_IN_REPOSITORY` | Layout, order item styling, responsive design rules. |
| `supabase/migrations/` | SQL Migrations | `VERIFIED_IN_REPOSITORY` | 0 purchase-related database migrations currently exist in Git repository history. |

### C. VERIFIED BY LOCAL AGENT — EXTERNAL ASSETS
> **LOCAL WORKSPACE EVIDENCE**: The following external assets were physically inspected by the local agent on the Product Owner's workstation outside the Git repository root.

1. **Legacy Purchases SQL Dump**:
   - **Local Workstation Path**: `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\database-dumps\athcomar_comprasWS.sql`
   - **Asset Type**: MySQL Relational Database Dump
   - **File Count**: 1 file
   - **File Extension**: `.sql`
   - **Size**: 66,378 bytes (~65 KB)
   - **Last Modified Timestamp**: 2026-08-02 22:03:31
   - **Contents Inspected**: YES — opened and analyzed table structures for suppliers, purchase categories, order logs, and legacy supplier contact numbers.
   - **Git Exclusion**: Excluded from repository root (`.gitignore` enforced) to prevent accidental credential leakage.
   - **Classification**: `VERIFIED_BY_LOCAL_AGENT` | *INDEPENDENT VERIFICATION: NOT AVAILABLE FROM REPOSITORY*

2. **Legacy Web Purchases Application**:
   - **Local Workstation Path**: `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\pedidos\`
   - **Asset Type**: Standalone HTML/JS Application (WhatsApp Order Dispatcher)
   - **File Count**: 5 files inspected (`app.js`, `index.html`, `style.css`, `logo.png`, `.gitignore`)
   - **Representative Files**: `app.js` (58,102 bytes), `index.html` (17,359 bytes)
   - **File Extensions**: `.js`, `.html`, `.css`, `.png`
   - **Total Size**: ~91 KB
   - **Contents Inspected**: YES — examined order building algorithms, catalog arrays, and WhatsApp URL payload generation.
   - **Git Exclusion**: Maintained in separate local directory outside `horeca_modular`.
   - **Classification**: `VERIFIED_BY_LOCAL_AGENT` | *INDEPENDENT VERIFICATION: NOT AVAILABLE FROM REPOSITORY*

### D. KNOWN BUT NOT VERIFIED HISTORICAL ASSETS
| Asset Description | Presumed Source | Status | Forensic Assessment |
| :--- | :--- | :---: | :--- |
| **Physical Paper Delivery Notes (Albaranes)** | Physical restaurant file cabinets | `NOT_VERIFIED` | Offline physical documents not digitized or inspected in workspace. |
| **Historical Offline Supplier Invoices** | External accounting archive drives | `NOT_VERIFIED` | Prior accounting exports not present in active local workspace. |

---

## 3. Target Migration Requirements (WP-006)

During WP-006 (Purchases Module Foundation), domain entities will be established in canonical migrations following clean domain architecture standards:

1. **Domain Entity Model**:
   - `Supplier`: Master supplier entity (legal name, CIF/NIF, payment terms, contact info, lead times).
   - `PurchaseOrder`: Purchase order header tracking procurement status (`DRAFT`, `SUBMITTED`, `CONFIRMED`, `RECEIVED`, `CANCELLED`).
   - `PurchaseOrderLine`: Line items with product references, requested quantities, expected unit costs, and tax rates.
   - `GoodsReceipt`: Verification record confirming physical arrival of items against purchase orders (supporting human gate separation).
   - `SupplierInvoice`: Recorded invoice matched against verified `GoodsReceipt` records for accounting reconciliation.

2. **Cost Integration for Escandallos**:
   - `PurchaseOrderLine` unit costs will feed `IngredientCostProvider` (`LAST_PURCHASE` mode) to guarantee real-time ingredient cost recalculations.

3. **Data Safety & Multi-Tenancy**:
   - All target purchase entities will enforce strict `organization_id` foreign keys and Postgres Row Level Security (RLS) fail-closed policies.
