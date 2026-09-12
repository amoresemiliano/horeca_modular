-- ==============================================================================
-- MIGRATION: 20260912000000_canonical_tenancy_and_auth_core.sql
-- DESCRIPTION: Canonical Tenancy, Identity & Authorization Core (WP-002)
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & Replayable Fresh Scratch DB
-- ==============================================================================

-- 1. CANONICAL TENANCY HIERARCHY: HOLDINGS & OPERATIONAL UNITS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.eco_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    legal_name TEXT,
    tax_id TEXT,
    country_code VARCHAR(2) NOT NULL DEFAULT 'ES',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure eco_organizations has holding_id and canonical fields
ALTER TABLE public.eco_organizations 
    ADD COLUMN IF NOT EXISTS holding_id UUID REFERENCES public.eco_holdings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trade_name TEXT,
    ADD COLUMN IF NOT EXISTS tax_id_type TEXT DEFAULT 'CIF',
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'ES',
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.eco_operational_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('KITCHEN', 'SALON', 'BAR', 'WAREHOUSE', 'CENTRAL_OFFICE', 'DELIVERY_HUB', 'OTHER')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_eco_operational_units_org_code UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS public.eco_holding_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_id UUID NOT NULL REFERENCES public.eco_holdings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.eco_user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('HOLDING_OWNER', 'HOLDING_ADMIN')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_eco_holding_members_holding_user UNIQUE (holding_id, user_id)
);

-- 2. CANONICAL CAPABILITY REGISTRY & 13 CANONICAL ROLE TEMPLATES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.eco_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL CHECK (scope IN ('PLATFORM', 'HOLDING', 'ORGANIZATION', 'OPERATIONAL_UNIT')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.eco_role_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT NOT NULL CHECK (tier IN ('PLATFORM', 'HOLDING', 'ORGANIZATION')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.eco_role_template_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_template_id UUID NOT NULL REFERENCES public.eco_role_templates(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES public.eco_capabilities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_eco_role_template_capabilities UNIQUE (role_template_id, capability_id)
);

CREATE TABLE IF NOT EXISTS public.eco_member_capability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.eco_organization_members(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES public.eco_capabilities(id) ON DELETE CASCADE,
    effect TEXT NOT NULL CHECK (effect IN ('GRANT', 'REVOKE')),
    operational_unit_id UUID REFERENCES public.eco_operational_units(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_eco_member_capability_overrides UNIQUE (membership_id, capability_id, operational_unit_id)
);

CREATE TABLE IF NOT EXISTS public.eco_organization_module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.eco_organizations(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    plan_tier TEXT NOT NULL DEFAULT 'transitional',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_eco_org_module_entitlement UNIQUE (organization_id, module_key)
);

-- Ensure eco_organization_members has canonical foreign keys and transitional role preserved
ALTER TABLE public.eco_organization_members
    ADD COLUMN IF NOT EXISTS role_template_id UUID REFERENCES public.eco_role_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS operational_unit_id UUID REFERENCES public.eco_operational_units(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. REGISTER 42 ATOMIC CAPABILITIES
-- ------------------------------------------------------------------------------

INSERT INTO public.eco_capabilities (code, scope, description) VALUES
    ('ACCESS_ANY_ORG', 'PLATFORM', 'Future entitlement for elevated platform-wide tenant access'),
    ('AUDIT_PLATFORM_VIEW', 'PLATFORM', 'View global platform audit logs'),
    ('AUDIT_VIEW_ORG', 'ORGANIZATION', 'View organization audit log events'),
    ('BANK_IMPORT', 'ORGANIZATION', 'Execute bank statement file import'),
    ('CATALOG_ASSIGN_ANY_ORG', 'PLATFORM', 'Assign global catalog categories/activities to any tenant organization'),
    ('CATALOG_ORG_VIEW', 'ORGANIZATION', 'View organization assigned catalog categories'),
    ('GLOBAL_CATALOG_MANAGE', 'PLATFORM', 'Manage global tax and economic activity catalogs'),
    ('GLOBAL_CATALOG_VIEW', 'PLATFORM', 'View global tax and economic activity catalogs'),
    ('GLOBAL_USER_MANAGE', 'PLATFORM', 'Manage platform users globally across all tenants'),
    ('HARD_DELETE_EXCEPTIONAL', 'PLATFORM', 'Perform exceptional hard deletion of system data'),
    ('IMPORT_CREATE', 'ORGANIZATION', 'Create new import batch'),
    ('IMPORT_RETRY', 'ORGANIZATION', 'Request retry for failed import'),
    ('IMPORT_REVIEW', 'ORGANIZATION', 'Review import issues and status'),
    ('IMPORT_VIEW', 'ORGANIZATION', 'View import history and details'),
    ('ISSUE_RESOLVE', 'ORGANIZATION', 'Resolve import validation issues'),
    ('ORG_MEMBER_INVITE', 'ORGANIZATION', 'Invite new members to organization'),
    ('ORG_MEMBER_MANAGE', 'ORGANIZATION', 'Manage existing organization members'),
    ('ORG_MEMBER_PERMISSION_MANAGE', 'ORGANIZATION', 'Manage member role templates and capability overrides'),
    ('ORG_MEMBER_VIEW', 'ORGANIZATION', 'View organization members list'),
    ('ORG_SETTINGS_MANAGE', 'ORGANIZATION', 'Modify organization configuration settings'),
    ('ORG_SETTINGS_VIEW', 'ORGANIZATION', 'View organization configuration settings'),
    ('ORG_VIEW', 'ORGANIZATION', 'View organization details and dashboard'),
    ('ORGANIZATION_ARCHIVE', 'PLATFORM', 'Archive or deactivate tenant organizations'),
    ('ORGANIZATION_CREATE', 'PLATFORM', 'Create new tenant organizations'),
    ('ORGANIZATION_UPDATE', 'PLATFORM', 'Update tenant organization settings and details'),
    ('PAYROLL_IMPORT', 'ORGANIZATION', 'Execute payroll file import'),
    ('PERCEPTION_IMPORT', 'ORGANIZATION', 'Execute tax perceptions file import'),
    ('PLAN_MANAGE', 'PLATFORM', 'Manage subscription plans and billing tiers'),
    ('PLATFORM_MANAGE', 'PLATFORM', 'Manage system-wide configuration and platform settings'),
    ('RATE_MANAGE_ANY_ORG', 'PLATFORM', 'Manage IIBB rates for any tenant organization'),
    ('RECORD_CLASSIFY', 'ORGANIZATION', 'Classify normalized accounting records'),
    ('RECORD_RESTORE', 'ORGANIZATION', 'Restore soft-deleted normalized accounting records'),
    ('RECORD_SOFT_DELETE', 'ORGANIZATION', 'Soft delete normalized accounting records'),
    ('RECORD_VIEW', 'ORGANIZATION', 'View normalized accounting records'),
    ('REPORT_COMPARE_SCOPED_ORGS', 'PLATFORM', 'Access cross-organizational comparative reports'),
    ('REPORT_CONSOLIDATED_SCOPED_ORGS', 'PLATFORM', 'Access consolidated financial reports across scoped organizations'),
    ('REPORT_EXPORT', 'ORGANIZATION', 'Export organization financial reports'),
    ('REPORT_VIEW', 'ORGANIZATION', 'View organization financial reports'),
    ('SAAS_ANALYTICS_VIEW', 'PLATFORM', 'View SaaS platform usage analytics and operational metrics'),
    ('SUPPORT_IMPERSONATE', 'PLATFORM', 'Support access to impersonate user sessions for troubleshooting'),
    ('TICKET_CREATE', 'ORGANIZATION', 'Create support tickets for organization'),
    ('TICKET_VIEW_ORG', 'ORGANIZATION', 'View support tickets for organization')
ON CONFLICT (code) DO UPDATE SET 
    scope = EXCLUDED.scope,
    description = EXCLUDED.description;

-- 4. REGISTER 13 CANONICAL ROLE TEMPLATES
-- ------------------------------------------------------------------------------

INSERT INTO public.eco_role_templates (code, name, description, tier) VALUES
    ('VEGEN_PLATFORM_ADMIN', 'VEGEN Platform Administrator', 'Platform-level administrator managing global system, catalog and tenancy setup (no automatic tenant business-data access)', 'PLATFORM'),
    ('HOLDING_OWNER', 'Holding Owner', 'Executive owner across holding group organizations', 'HOLDING'),
    ('HOLDING_ADMIN', 'Holding Administrator', 'Executive management across holding group organizations', 'HOLDING'),
    ('OWNER', 'Organization Owner', 'Full legal and administrative authority within an organization', 'ORGANIZATION'),
    ('MANAGER', 'General / Operations Manager', 'Operational and financial management authority within an organization', 'ORGANIZATION'),
    ('ADMINISTRATIVE', 'Administrative Staff', 'Administrative and accounting operations authority within an organization', 'ORGANIZATION'),
    ('PURCHASING', 'Purchasing Agent', 'Suppliers, product catalogs, and invoice management authority', 'ORGANIZATION'),
    ('RECEPTION_FLOOR', 'Reception & Floor Staff', 'Receiving deliveries, stock intake, and operational incident ticketing', 'ORGANIZATION'),
    ('PRODUCTION', 'Production Staff', 'Kitchen and production batch management authority', 'ORGANIZATION'),
    ('COOK_COST_SHEET_MANAGER', 'Chef / Cost Sheet Manager', 'Recipe formulation, ingredient cost sheet, and margin management authority', 'ORGANIZATION'),
    ('HR_PERSONNEL', 'Human Resources Manager', 'Personnel, clock-in management, and payroll imports authority', 'ORGANIZATION'),
    ('EXTERNAL_ACCOUNTANT', 'External Accountant / Gestoría', 'Financial statements, tax classifications, and accounting reports authority', 'ORGANIZATION'),
    ('CONSULTANT', 'Auditor / Business Consultant', 'Read-only audit, reports, and advisory analysis access', 'ORGANIZATION')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier;

-- Associate Capabilities with the 13 Canonical Role Templates
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    -- 1. VEGEN_PLATFORM_ADMIN (Platform concerns only - no automatic business data access)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'VEGEN_PLATFORM_ADMIN';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'GLOBAL_USER_MANAGE', 'GLOBAL_CATALOG_MANAGE', 'GLOBAL_CATALOG_VIEW',
        'ORGANIZATION_CREATE', 'ORGANIZATION_UPDATE', 'ORGANIZATION_ARCHIVE',
        'PLAN_MANAGE', 'PLATFORM_MANAGE', 'SAAS_ANALYTICS_VIEW', 'AUDIT_PLATFORM_VIEW',
        'SUPPORT_IMPERSONATE', 'HARD_DELETE_EXCEPTIONAL'
    ) ON CONFLICT DO NOTHING;

    -- 2. HOLDING_OWNER
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HOLDING_OWNER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_SETTINGS_MANAGE', 'ORG_MEMBER_VIEW', 'ORG_MEMBER_MANAGE',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_CONSOLIDATED_SCOPED_ORGS', 'REPORT_COMPARE_SCOPED_ORGS',
        'AUDIT_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 3. HOLDING_ADMIN
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HOLDING_ADMIN';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_CONSOLIDATED_SCOPED_ORGS', 'REPORT_COMPARE_SCOPED_ORGS',
        'AUDIT_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 4. OWNER (Tenant Organization Owner)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'OWNER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE scope = 'ORGANIZATION'
    ON CONFLICT DO NOTHING;

    -- 5. MANAGER
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'MANAGER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'BANK_IMPORT',
        'IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_RETRY', 'ISSUE_RESOLVE',
        'RECORD_VIEW', 'RECORD_CLASSIFY', 'REPORT_VIEW', 'REPORT_EXPORT',
        'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE', 'TICKET_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 6. ADMINISTRATIVE
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'ADMINISTRATIVE';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'BANK_IMPORT', 'PAYROLL_IMPORT', 'PERCEPTION_IMPORT',
        'IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY',
        'REPORT_VIEW', 'REPORT_EXPORT', 'CATALOG_ORG_VIEW', 'TICKET_CREATE', 'TICKET_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 7. PURCHASING
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'PURCHASING';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW',
        'RECORD_VIEW', 'RECORD_CLASSIFY', 'REPORT_VIEW', 'CATALOG_ORG_VIEW', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 8. RECEPTION_FLOOR
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'RECEPTION_FLOOR';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN ('ORG_VIEW', 'RECORD_VIEW', 'TICKET_CREATE')
    ON CONFLICT DO NOTHING;

    -- 9. PRODUCTION
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'PRODUCTION';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN ('ORG_VIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY', 'TICKET_CREATE')
    ON CONFLICT DO NOTHING;

    -- 10. COOK_COST_SHEET_MANAGER
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'COOK_COST_SHEET_MANAGER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN ('ORG_VIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY', 'REPORT_VIEW', 'CATALOG_ORG_VIEW', 'TICKET_CREATE')
    ON CONFLICT DO NOTHING;

    -- 11. HR_PERSONNEL
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HR_PERSONNEL';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN ('ORG_VIEW', 'ORG_MEMBER_VIEW', 'PAYROLL_IMPORT', 'IMPORT_VIEW', 'REPORT_VIEW', 'TICKET_CREATE')
    ON CONFLICT DO NOTHING;

    -- 12. EXTERNAL_ACCOUNTANT
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'EXTERNAL_ACCOUNTANT';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'BANK_IMPORT', 'PAYROLL_IMPORT', 'PERCEPTION_IMPORT',
        'IMPORT_VIEW', 'IMPORT_REVIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY',
        'REPORT_VIEW', 'REPORT_EXPORT', 'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 13. CONSULTANT
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'CONSULTANT';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'IMPORT_VIEW',
        'RECORD_VIEW', 'REPORT_VIEW', 'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;
END $$;

-- 5. MAPPING LEGACY ROLE VALUES TO CANONICAL ROLE TEMPLATES
-- ------------------------------------------------------------------------------
-- Preserve legacy role text while setting canonical role_template_id
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE m.role_template_id IS NULL
AND (
    (m.role = 'SUPERADMIN' AND t.code = 'OWNER') OR
    (m.role = 'ADMIN' AND t.code = 'ADMINISTRATIVE') OR
    (m.role = 'GERENTE' AND t.code = 'MANAGER') OR
    (m.role = 'OPERADOR' AND t.code = 'PRODUCTION') OR
    (m.role = 'CONSULTA' AND t.code = 'CONSULTANT')
);

-- Default fallback to OWNER if legacy role is unmapped to ensure fail-closed deterministic state
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE m.role_template_id IS NULL AND t.code = 'OWNER';

-- 6. MULTI-CIF POSTGRESQL HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_org_membership(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.eco_organization_members m
        JOIN public.eco_user_profiles p ON p.id = m.user_id
        WHERE p.auth_user_id = auth.uid()
          AND m.organization_id = target_org_id
          AND m.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_holding_membership(target_holding_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.eco_holding_members hm
        JOIN public.eco_user_profiles p ON p.id = hm.user_id
        WHERE p.auth_user_id = auth.uid()
          AND hm.holding_id = target_holding_id
          AND hm.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_org_ids()
RETURNS TABLE (organization_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT m.organization_id
    FROM public.eco_organization_members m
    JOIN public.eco_user_profiles p ON p.id = m.user_id
    WHERE p.auth_user_id = auth.uid()
      AND m.is_active = true;
$$;

-- 7. ROW-LEVEL SECURITY POLICIES FOR CANONICAL TENANCY CORE
-- ------------------------------------------------------------------------------

ALTER TABLE public.eco_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_holding_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_operational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_role_template_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_member_capability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_organization_module_entitlements ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "holding_members_read_holdings" ON public.eco_holdings;
DROP POLICY IF EXISTS "holding_members_read_holding_members" ON public.eco_holding_members;
DROP POLICY IF EXISTS "org_members_read_orgs" ON public.eco_organizations;
DROP POLICY IF EXISTS "org_members_read_operational_units" ON public.eco_operational_units;
DROP POLICY IF EXISTS "org_members_read_memberships" ON public.eco_organization_members;
DROP POLICY IF EXISTS "authenticated_read_role_templates" ON public.eco_role_templates;
DROP POLICY IF EXISTS "authenticated_read_capabilities" ON public.eco_capabilities;
DROP POLICY IF EXISTS "authenticated_read_role_template_capabilities" ON public.eco_role_template_capabilities;
DROP POLICY IF EXISTS "org_members_read_capability_overrides" ON public.eco_member_capability_overrides;
DROP POLICY IF EXISTS "org_members_read_module_entitlements" ON public.eco_organization_module_entitlements;

-- Policies
CREATE POLICY "holding_members_read_holdings"
    ON public.eco_holdings FOR SELECT TO authenticated
    USING (public.user_has_holding_membership(id));

CREATE POLICY "holding_members_read_holding_members"
    ON public.eco_holding_members FOR SELECT TO authenticated
    USING (public.user_has_holding_membership(holding_id));

CREATE POLICY "org_members_read_orgs"
    ON public.eco_organizations FOR SELECT TO authenticated
    USING (public.user_has_org_membership(id) OR (holding_id IS NOT NULL AND public.user_has_holding_membership(holding_id)));

CREATE POLICY "org_members_read_operational_units"
    ON public.eco_operational_units FOR SELECT TO authenticated
    USING (public.user_has_org_membership(organization_id));

CREATE POLICY "org_members_read_memberships"
    ON public.eco_organization_members FOR SELECT TO authenticated
    USING (public.user_has_org_membership(organization_id));

CREATE POLICY "authenticated_read_role_templates"
    ON public.eco_role_templates FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "authenticated_read_capabilities"
    ON public.eco_capabilities FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "authenticated_read_role_template_capabilities"
    ON public.eco_role_template_capabilities FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "org_members_read_capability_overrides"
    ON public.eco_member_capability_overrides FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.eco_organization_members m
        WHERE m.id = public.eco_member_capability_overrides.membership_id
          AND public.user_has_org_membership(m.organization_id)
    ));

CREATE POLICY "org_members_read_module_entitlements"
    ON public.eco_organization_module_entitlements FOR SELECT TO authenticated
    USING (public.user_has_org_membership(organization_id));

-- 8. PROVISION DEV TRANSITIONAL MODULE ENTITLEMENTS BASELINE
-- ------------------------------------------------------------------------------

INSERT INTO public.eco_organization_module_entitlements (organization_id, module_key, is_enabled, plan_tier)
SELECT org.id, mod.key, true, 'transitional'
FROM public.eco_organizations org
CROSS JOIN (
    VALUES 
        ('dashboard'), ('bancos'), ('ventas'), ('kpis'), ('inventario'),
        ('escandallos'), ('compras'), ('produccion'), ('personal'),
        ('prediccion'), ('configuracion')
) AS mod(key)
ON CONFLICT (organization_id, module_key) DO NOTHING;
