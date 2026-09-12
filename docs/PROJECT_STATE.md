# PROJECT STATE — HORECA MODULAR

## 1. Current Verified Environments Matrix

| Environment | Git Branch | Git SHA | Vercel URL | Supabase Project Ref | Status | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEV** | `dev` | `98aed82c5153691412d21f9f995e0f295cd5386a` (canonical baseline) | `https://horecamodular-git-dev-vegen-s-projects.vercel.app/` | `ourzapkjykzlwsjunzmd` | **ACTIVE** | `VERIFIED_BY_LOCAL_AGENT` |
| **UAT** | *None* | *None* | *None* | *None* | **NOT PROVISIONED** | `NOT PROVISIONED` |
| **PROD** | `main` | `8a1fcb1a502a291165aff53dcd3005048c01cd65` | `https://horecamodular.vercel.app/` | *Unproven* | **ACTIVE (FRONTEND ONLY)** | `NOT VERIFIED (BACKEND)` |

---

## 2. Infrastructure & Repository Snapshot
- **Canonical Repository**: `https://github.com/amoresemiliano/horeca_modular`
- **Default Branch**: `main`
- **Active Development Branch**: `dev`
- **Active Working Package Branch**: `wp/002-canonical-tenancy-auth`
- **Staging Database Project**: `ourzapkjykzlwsjunzmd` (`https://ourzapkjykzlwsjunzmd.supabase.co`)
- **Key Fingerprint (Publishable)**: `sb_publishable_...Smhggsu`
- **Storage Bucket**: `eco-imports-private-staging` (1 private bucket in staging)
- **Active Database Tables**: 34 public tables in staging

---

## 3. Work Package Status

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
