# PROJECT STATE — HORECA MODULAR

> 2026-09-28 restoration: HORECA DEV Core baseline and CCR-FIN-001 are deployed and hosted-verified. Legacy operational data is preserved. No real tenants/users were seeded. Earlier product/login claims below remain historical. See [Core restoration](CORE_DEV_BASELINE_RESTORATION.md).

## 1. Current Verified Environments Matrix

| Environment | Git Branch | Git SHA | Vercel URL | Supabase Project Ref | Status | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEV** | `dev` | `20d41e17266f4085d520909159d736977e791d9b` (approved CCR; deployed with consolidated baseline) | `https://horecamodular-git-dev-vegen-s-projects.vercel.app/` | `vmxjqwlfwnphorthhcwu` | **CORE + CCR VERIFIED** | `HOSTED SCHEMA/AUTHORIZATION VERIFIED` |
| **UAT** | *None* | *None* | *None* | *None* | **NOT PROVISIONED** | `NOT PROVISIONED` |
| **PROD** | `main` | `8a1fcb1a502a291165aff53dcd3005048c01cd65` | `https://horecamodular.vercel.app/` | *Unproven* | **ACTIVE (FRONTEND ONLY)** | `NOT VERIFIED (BACKEND)` |

---

## 2. Infrastructure & Repository Snapshot
- **Canonical Repository**: `https://github.com/amoresemiliano/horeca_modular`
- **Default Branch**: `main`
- **Active Development Branch**: `dev`
- **Active Working Package Branch**: `wp/002-canonical-tenancy-auth`
- **Staging Database Project**: `vmxjqwlfwnphorthhcwu` (`https://vmxjqwlfwnphorthhcwu.supabase.co`)
- **Storage Bucket**: Not verified on the corrected HORECA DEV target.
- **Active Database Tables**: Nine preserved legacy operational tables plus eleven Core relations. Migration history records only the two executed canonical migrations.

---

## 3. Historical Work Package Status (hosted claims require revalidation)

- **WP-000**: CLOSED & APPROVED (SHA: `a90724d47b2a6aea2248187b1806bfd13bb8d9fa`)
- **WP-001 (Engineering Foundation & Canonical Core Preparation)**: CLOSED & APPROVED (SHA: `98aed82`)
- **WP-002 (Canonical Tenancy, Identity & Authorization Core)**:
  - Canonical 3-Tier Tenancy Hierarchy (Holdings / Organizations / Operational Units): **PASS**
  - Canonical 13 Role Templates & Platform Admin Segregation: **PASS**
  - Capability Registry (42 Capabilities) & Explicit Overrides: **PASS**
  - Organization Module Entitlements & Transitional Baseline: **PASS**
  - Fail-Closed `can(...)` Domain Evaluator & Use Cases: **PASS**
  - Multi-CIF Supabase Repository Adapter: **PASS**
  - Runtime `AuthContext.jsx` & Organization Switcher in `MainLayout.jsx`: **PASS**
  - Product Owner Clean DEV Login Path Gate (`emilianodirosa1+horeca-dev@gmail.com`): **PASS**
  - Automated Tests Suite (53 tests across 8 suites, 100% passing): **PASS**
  - SEC-RLS-01 through 12 Honest Classification: **PASS**
  - Status: **TECHNICALLY_READY_FOR_INDEPENDENT_REVIEW**

---

## 4. Local Documentation Synchronization

- **Sync Status**: `VERIFIED_BY_LOCAL_AGENT`
- **Local Root Path**: `c:\Users\Emiliano\Documents\1. Sistemas\El Criollo\documentación_procesos\`
- **Files Synchronized**: Canonical documentation markdown files in `/docs` and `/agent`
