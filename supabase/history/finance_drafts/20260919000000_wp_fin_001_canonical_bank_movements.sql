-- ==============================================================================
-- MIGRATION: 20260919000000_wp_fin_001_canonical_bank_movements.sql
-- DESCRIPTION: WP-FIN-001 Bank Statement Ingestion & Canonical Bank Movement Foundation
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: NOT APPLIED TO SHARED DEV — Version Controlled in module/finance
-- ==============================================================================

BEGIN;

-- 1. ENHANCE CANONICAL FINANCIAL ACCOUNTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.eco_financial_accounts
    ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'BANK_ACCOUNT',
    ADD COLUMN IF NOT EXISTS institution TEXT,
    ADD COLUMN IF NOT EXISTS masked_identifier TEXT,
    ADD COLUMN IF NOT EXISTS external_reference TEXT,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    ALTER TABLE public.eco_financial_accounts DROP CONSTRAINT IF EXISTS eco_financial_accounts_product_type_check;
    ALTER TABLE public.eco_financial_accounts ADD CONSTRAINT eco_financial_accounts_product_type_check 
        CHECK (product_type IN ('BANK_ACCOUNT', 'CARD'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. ENHANCE SOURCE IMPORTS & SOURCE FILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.eco_source_imports
    ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.eco_financial_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS parser_name TEXT,
    ADD COLUMN IF NOT EXISTS parser_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS accepted_rows INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.eco_source_files
    ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
    ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Level A: Exact file uniqueness per organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_eco_source_files_org_sha256 
    ON public.eco_source_files (organization_id, sha256_hash) 
    WHERE sha256_hash IS NOT NULL;

-- 3. ENHANCE CANONICAL FINANCIAL MOVEMENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.eco_financial_movements
    ADD COLUMN IF NOT EXISTS financial_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS bank_native_id TEXT,
    ADD COLUMN IF NOT EXISTS source_row_number INTEGER,
    ADD COLUMN IF NOT EXISTS duplicate_status TEXT NOT NULL DEFAULT 'UNIQUE',
    ADD COLUMN IF NOT EXISTS raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    ALTER TABLE public.eco_financial_movements DROP CONSTRAINT IF EXISTS eco_financial_movements_duplicate_status_check;
    ALTER TABLE public.eco_financial_movements ADD CONSTRAINT eco_financial_movements_duplicate_status_check 
        CHECK (duplicate_status IN ('UNIQUE', 'POTENTIAL_OVERLAP', 'DEFINITE_DUPLICATE'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Index for Level C Fingerprint duplicate detection signal (NON-UNIQUE to avoid dropping legitimate movements)
CREATE INDEX IF NOT EXISTS idx_eco_financial_movements_org_fingerprint 
    ON public.eco_financial_movements (organization_id, financial_fingerprint)
    WHERE financial_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eco_financial_movements_org_account_fecha
    ON public.eco_financial_movements (organization_id, source_account_id, fecha);

-- 4. ROW-LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.eco_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_source_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_financial_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict RLS eco_financial_accounts" ON public.eco_financial_accounts;
CREATE POLICY "Strict RLS eco_financial_accounts" ON public.eco_financial_accounts
    FOR ALL TO authenticated
    USING (organization_id = public.get_auth_user_org_id())
    WITH CHECK (organization_id = public.get_auth_user_org_id());

DROP POLICY IF EXISTS "Strict RLS eco_source_imports" ON public.eco_source_imports;
CREATE POLICY "Strict RLS eco_source_imports" ON public.eco_source_imports
    FOR ALL TO authenticated
    USING (organization_id = public.get_auth_user_org_id())
    WITH CHECK (organization_id = public.get_auth_user_org_id());

DROP POLICY IF EXISTS "Strict RLS eco_source_files" ON public.eco_source_files;
CREATE POLICY "Strict RLS eco_source_files" ON public.eco_source_files
    FOR ALL TO authenticated
    USING (organization_id = public.get_auth_user_org_id())
    WITH CHECK (organization_id = public.get_auth_user_org_id());

DROP POLICY IF EXISTS "Strict RLS eco_financial_movements" ON public.eco_financial_movements;
CREATE POLICY "Strict RLS eco_financial_movements" ON public.eco_financial_movements
    FOR ALL TO authenticated
    USING (organization_id = public.get_auth_user_org_id())
    WITH CHECK (organization_id = public.get_auth_user_org_id());

COMMIT;
