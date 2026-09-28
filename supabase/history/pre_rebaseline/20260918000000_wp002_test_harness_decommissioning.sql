-- ==============================================================================
-- MIGRATION: 20260918000000_wp002_test_harness_decommissioning.sql
-- DESCRIPTION: Decommission public RPC test harness from application database surface
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & All Environments
-- ==============================================================================

-- Completely drop test harness RPC from public schema to eliminate public attack surface
DROP FUNCTION IF EXISTS public.verify_authenticated_rls_security_suite() CASCADE;
