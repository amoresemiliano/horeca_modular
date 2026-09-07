# CURRENT TO TARGET GAP ANALYSIS — HORECA MODULAR

## 1. Executive Summary
This document analyzes the technical and architectural discrepancies between the current repository state of `horeca_modular` and the approved VEGEN target architecture.

## 2. Comprehensive Gap Inventory

| Category | Target Architecture | Current State | Remediation Strategy (WP Roadmap) |
| :--- | :--- | :--- | :--- |
| **Authentication** | Native Supabase Auth only | Native Supabase Auth implemented on `dev`. Legacy Firebase dependencies still present in `package.json` and `.env.local`. | WP-001: Remove legacy Firebase packages and sanitize environment variables. |
| **Fail-Closed Security** | 100% fail-closed authorization via `get_auth_user_org_id()` | Implemented in `AuthContext.jsx` and `MainLayout.jsx`. Legacy database functions (`private.org_id()`) remain on older tables. | WP-001: Migrate legacy RLS policies referencing `private.org_id()` to `get_auth_user_org_id()`. |
| **Database Schema Drift** | All application tables version-controlled in `supabase/migrations` | Migration `20260903000000_supabase_auth_rls.sql` exists in repo. Live DB `ourzapkjykzlwsjunzmd` contains 34 tables, including 15 legacy tables created via console without migration files. | WP-001 & WP-002: Consolidate DB schema into clean, version-controlled migration files. |
| **Escandallos Module** | Recipe costing module integrated in core application | Escandallos code and migration `20260901000000_init_escandallos.sql` reside on unmerged branch `origin/feature/escandallos-2485206073148743544`. | WP-005: Audit, refactor RLS policies to `get_auth_user_org_id()`, and merge branch. |
| **Purchases / Pedidos** | Production-ready purchases module with historical data preservation | Current UI uses prototype/mock state. Real historical purchases data exists in external spreadsheets/dumps. | WP-006: Data ingestion pipeline & persistent database tables for Purchases. |
| **Sales / Last.app** | POS sales adapter for ticket ingestion and revenue reconciliation | Basic UI module exists in `src/modules/ventas`. Full API/CSV integration pending. | WP-007: Implement Last.app sales import adapter. |
| **Storage Security** | RLS on `storage.objects` evaluating `get_auth_user_org_id()` | Bucket `eco-imports-private-staging` exists, but its RLS policy uses legacy `private.org_id()`. | WP-001: Update storage RLS policies to use `get_auth_user_org_id()`. |
| **Publishable Key Standard** | Support modern `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) | Supported in `src/lib/supabase.js` and `.env.local`. Verified. | Completed in WP-000 preflight. |
