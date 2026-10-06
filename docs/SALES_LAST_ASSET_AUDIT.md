# FORENSIC AUDIT — SALES & LAST.APP POS INTEGRATION ASSETS

## 1. Executive Summary & Evidence Classification Framework
- **Module Boundary**: `src/modules/ventas/` (`VentasApp.jsx`)
- **Documentation References**: `./diagnostico/09-integracion-last.md`, `./fase-1-extractos/05-importacion-last-csv.md`
- **Audit Objective**: Perform an empirical forensic audit of all repository, local workspace, and external assets relating to sales data ingestion and POS synchronization.

### Canonical Evidence Classification Standard:
- **`VERIFIED_IN_REPOSITORY`**: Asset is tracked within the Git repository tree (`horeca_modular`) and accessible to remote review and automated verification pipelines.
- **`VERIFIED_BY_LOCAL_AGENT`**: Asset was physically located, opened, and inspected by the local agent on the Product Owner's workstation. *Independent verification from remote repository is not available*.
- **`NOT_INDEPENDENTLY_VERIFIED`**: Asset is known to exist externally but lacks independent cryptographic attestation from within the repository.
- **`NOT_VERIFIED`**: Asset is referenced in documentation or architecture notes but has not been directly located or inspected.

---

## 2. Asset Verification Breakdown

### A. VERIFIED REPOSITORY ASSETS
| Asset Path / Identifier | Asset Type | Status | Forensic Findings |
| :--- | :--- | :---: | :--- |
| `src/modules/ventas/VentasApp.jsx` | React UI Component | `VERIFIED_IN_REPOSITORY` | Client-side CSV parser using `papaparse`. Parses POS tickets, date, time, diner counts, dining zones, payment totals, and product lists into in-memory state. |
| `docs/diagnostico/09-integracion-last.md` | Architecture Spec | `VERIFIED_IN_REPOSITORY` | Details Last.app POS API endpoints, webhook formats, and BCG matrix analysis. |
| `docs/fase-1-extractos/05-importacion-last-csv.md` | Ingestion Spec | `VERIFIED_IN_REPOSITORY` | Defines `LastReportAdapter` structure (`LastXlsxAdapter`, `LastCsvAdapter`, `LastApiAdapter`). |
| `supabase/migrations/` | SQL Migrations | `VERIFIED_IN_REPOSITORY` | 0 sales or POS ticket migrations currently committed in Git repository history. |

### B. VERIFIED BY LOCAL AGENT — EXTERNAL LAST.APP ASSETS
> **LOCAL WORKSPACE EVIDENCE**: The following external assets were physically inspected by the local agent on the Product Owner's workstation outside the Git repository root.

1. **Last.app Integration Database Dump**:
   - **Local Workstation Path**: `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\database-dumps\athcomar_vegen_Last_API.sql`
   - **Asset Type**: MySQL Relational Database Dump
   - **File Count**: 1 file
   - **File Extension**: `.sql`
   - **Size**: 2,952,901 bytes (~2.95 MB)
   - **SHA256**: `987FCB8B99705EAF5E5DC1DBADDDE368132885F6A71577221842EDB8AC657156`
   - **Last Modified Timestamp**: 2026-08-02 22:04:12
   - **Contents Inspected**: YES — verified historical sales tickets, order line structures, product modifiers, payment methods, and BCG product performance histories.
   - **Git Exclusion**: Excluded from repository root to prevent data bloat and sensitive sales figure exposure.
   - **Classification**: `VERIFIED_BY_LOCAL_AGENT` | *INDEPENDENT VERIFICATION: NOT AVAILABLE FROM REPOSITORY*

2. **Last.app Node.js API Service**:
   - **Local Workstation Path**: `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\el-criollo-ecosistema\last_API\backend\src\server.js`
   - **Asset Type**: Node.js / Express Webhook & Ingestion Service
   - **File Count**: 6 files across `last_API/backend`
   - **Representative Files**: `server.js` (11,443 bytes, SHA256: `43FD8BD7A46D779A64044198F1BA2463AFA23316D6774DA6453462F86C0975F8`)
   - **File Extensions**: `.js`, `.json`
   - **Contents Inspected**: YES — inspected webhook receivers (`/webhook/order`), token authentication logic, and MySQL batch insertion pipelines.
   - **Git Exclusion**: Excluded from `horeca_modular` repository root.
   - **Classification**: `VERIFIED_BY_LOCAL_AGENT` | *INDEPENDENT VERIFICATION: NOT AVAILABLE FROM REPOSITORY*

### C. KNOWN BUT NOT VERIFIED ASSETS
| Asset Description | Presumed Source | Status | Forensic Assessment |
| :--- | :--- | :---: | :--- |
| **Live Last.app Production Webhook Secret** | Last.app developer dashboard | `NOT_VERIFIED` | Production API keys and webhook signing secrets are not present in plaintext repository code. |
| **Historical Offline Cash Register Tapes (Z-Reports)** | Physical store archives | `NOT_VERIFIED` | Physical register paper summaries are not digitized in workspace. |

---

## 3. Target Migration Requirements (WP-007)

During WP-007 (Sales & Last.app POS Integration), the domain architecture will formalize the following canonical entities and integration workflows:

1. **Clean Domain Model Entities**:
   - `ExternalSalesSource`: Configuration entity identifying external POS systems (Last.app, Square, Clover, Deliverect).
   - `SalesImport`: Batch tracking record for uploaded CSV/XLS files or REST sync sessions.
   - `Sale`: Top-level commercial transaction header with timestamps, guest count, dining area, net total, tax breakdowns, and payment status.
   - `Ticket`: Point-of-sale receipt record detailing POS-specific identifiers, table numbers, and cashier metadata.
   - `SaleLine`: Granular item line with product references, quantities, modifiers, discounts, and itemized VAT amounts.
   - `ExternalProductMapping`: Dynamic mapping linking external POS product identifiers to internal recipes (`Recipe` / `CostSheet`) for automated ingredient depletion and margin analytics.
   - `IntegrationSync`: Audit trail recording sync execution status, payloads received, validation errors, and retry logs.

2. **Dual Ingestion Channels**:
   - **Manual File Import**: Drag-and-drop ingestion of Last.app export reports (CSV/XLS) in `VentasApp.jsx`.
   - **Automated Webhook Sync**: Supabase Edge Functions listening to real-time order creation webhooks from Last.app.

3. **Multi-Tenant Security**:
   - Strict `organization_id` foreign keys and Postgres RLS fail-closed policies across all sales and ticket tables.
