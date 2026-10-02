-- ==============================================================================
-- MIGRATION: 20261002000000_canonical_sales_schema.sql
-- DESCRIPTION: Canonical Sales & Revenue Domain Schema (WP-SALES-001)
-- AUTHOR: Antigravity / Vegen Digital (05 - Sales & Revenue)
-- NOTICE: SHARED DEV MIGRATIONS MUST NOT BE APPLIED BY MODULE AGENT.
--         THIS MIGRATION IS VERSION-CONTROLLED AND MASTER-CONTROLLED.
-- ==============================================================================

-- 1. SALES IMPORTS TABLE (PROVENANCE & AUDIT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'lastapp',
    export_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_hash TEXT,
    status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL', 'REJECTED')),
    rows_attempted INTEGER NOT NULL DEFAULT 0,
    rows_accepted INTEGER NOT NULL DEFAULT 0,
    rows_duplicate INTEGER NOT NULL DEFAULT 0,
    rows_rejected INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    error_summary TEXT,
    diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sales_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_imports_tenant_isolation" ON public.sales_imports
    FOR SELECT TO authenticated USING (public.can_execute_capability_for_org(organization_id, 'sales.view'));
REVOKE ALL ON public.sales_imports FROM anon, authenticated;
GRANT SELECT ON public.sales_imports TO authenticated;
GRANT ALL ON public.sales_imports TO service_role;

CREATE INDEX IF NOT EXISTS idx_sales_imports_org_created 
    ON public.sales_imports (organization_id, created_at DESC);

-- 2. CANONICAL SALES TABLE (OPERATIONAL TICKETS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    operational_unit_id UUID REFERENCES public.eco_operational_units(id) ON DELETE SET NULL,
    sales_import_id UUID REFERENCES public.sales_imports(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'lastapp',
    export_type TEXT NOT NULL DEFAULT 'INDIVIDUAL_SALES_EXPORT',
    source_location TEXT NOT NULL,
    external_ticket_code TEXT NOT NULL,
    external_invoice_number TEXT,
    external_identity_key TEXT NOT NULL,
    external_identity_algorithm TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    source_channel TEXT,
    source_payment_method TEXT,
    total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'VOIDED', 'REFUNDED', 'OPEN', 'REVIEW_REQUIRED')),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sales_org_identity UNIQUE (organization_id, external_identity_key)
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_tenant_isolation" ON public.sales
    FOR SELECT TO authenticated USING (public.can_execute_capability_for_org(organization_id, 'sales.view'));
REVOKE ALL ON public.sales FROM anon, authenticated;
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

CREATE INDEX IF NOT EXISTS idx_sales_org_occurred 
    ON public.sales (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_org_import 
    ON public.sales (organization_id, sales_import_id);

CREATE INDEX IF NOT EXISTS idx_sales_org_code 
    ON public.sales (organization_id, external_ticket_code);

-- 3. CANONICAL SALE LINES TABLE (TICKET DETAILS & MODIFIERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    line_index INTEGER NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    parent_line_id UUID REFERENCES public.sale_lines(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    display_text TEXT NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    item_type TEXT NOT NULL DEFAULT 'PRODUCT' CHECK (item_type IN ('PRODUCT', 'MODIFIER', 'UNKNOWN', 'COMBO_COMPONENT')),
    notes TEXT,
    catalog_product_id UUID, -- reference to future Catalog Product
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sale_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_lines_tenant_isolation" ON public.sale_lines
    FOR SELECT TO authenticated USING (public.can_execute_capability_for_org(organization_id, 'sales.tickets.read'));
REVOKE ALL ON public.sale_lines FROM anon, authenticated;
GRANT SELECT ON public.sale_lines TO authenticated;
GRANT ALL ON public.sale_lines TO service_role;

CREATE INDEX IF NOT EXISTS idx_sale_lines_sale_order 
    ON public.sale_lines (sale_id, line_index ASC);

CREATE INDEX IF NOT EXISTS idx_sale_lines_org_display 
    ON public.sale_lines (organization_id, display_text);

-- 4. SALES MAPPINGS TABLE (SOURCE LOCATIONS & PRODUCT REFERENCES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    mapping_type TEXT NOT NULL CHECK (mapping_type IN ('LOCATION_TO_OPUNIT', 'PRODUCT_TO_CATALOG')),
    source_value TEXT NOT NULL,
    target_id UUID NOT NULL,
    target_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sales_mappings_org_type_source UNIQUE (organization_id, mapping_type, source_value)
);

ALTER TABLE public.sales_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_mappings_tenant_isolation" ON public.sales_mappings
    FOR SELECT TO authenticated USING (public.can_execute_capability_for_org(organization_id, 'integrations.config.manage'));
REVOKE ALL ON public.sales_mappings FROM anon, authenticated;
GRANT SELECT ON public.sales_mappings TO authenticated;
GRANT ALL ON public.sales_mappings TO service_role;

CREATE INDEX IF NOT EXISTS idx_sales_mappings_org_type 
    ON public.sales_mappings (organization_id, mapping_type, is_active);
