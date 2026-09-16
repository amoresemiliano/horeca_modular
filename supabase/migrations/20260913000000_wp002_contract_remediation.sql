-- ==============================================================================
-- MIGRATION: 20260913000000_wp002_contract_remediation.sql
-- DESCRIPTION: WP-002 Contract Remediation (Security, OpUnit Taxonomy, Multi-Unit Scopes, Full Capability Registry)
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & Replayable Fresh Scratch DB
-- ==============================================================================

-- 1. DEFECT 1 REMEDIATION: SECURITY — PREVENT UNMAPPED ROLES FROM BECOMING OWNER
-- ------------------------------------------------------------------------------

-- Ensure role_template_id mapping is strictly deterministic and never guesses
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE (
    (m.role = 'SUPERADMIN' AND t.code = 'OWNER') OR
    (m.role = 'ADMIN' AND t.code = 'ADMINISTRATIVE') OR
    (m.role = 'GERENTE' AND t.code = 'MANAGER') OR
    (m.role = 'OPERADOR' AND t.code = 'PRODUCTION') OR
    (m.role = 'CONSULTA' AND t.code = 'CONSULTANT')
);

-- Revert any unintended OWNER promotions where legacy role was not explicitly SUPERADMIN/OWNER
UPDATE public.eco_organization_members m
SET role_template_id = NULL
WHERE m.role NOT IN ('SUPERADMIN', 'ADMIN', 'GERENTE', 'OPERADOR', 'CONSULTA', 'OWNER')
  AND m.role_template_id = (SELECT id FROM public.eco_role_templates WHERE code = 'OWNER');

-- 2. DEFECT 2 REMEDIATION: OPERATIONAL UNIT CANONICAL TAXONOMY
-- ------------------------------------------------------------------------------

-- Add unit_subtype column to support specific room/function designations
ALTER TABLE public.eco_operational_units
    ADD COLUMN IF NOT EXISTS unit_subtype TEXT;

-- Drop old check constraint if present
DO $$
BEGIN
    ALTER TABLE public.eco_operational_units DROP CONSTRAINT IF EXISTS eco_operational_units_unit_type_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Migrate any noncanonical types into canonical primary type + subtype
UPDATE public.eco_operational_units
SET 
    unit_type = CASE 
        WHEN unit_type IN ('SALON', 'BAR', 'DELIVERY_HUB') THEN 'LOCAL'
        WHEN unit_type IN ('KITCHEN') THEN 'PRODUCTION_CENTER'
        WHEN unit_type IN ('CENTRAL_OFFICE') THEN 'OTHER'
        WHEN unit_type IN ('WAREHOUSE') THEN 'WAREHOUSE'
        WHEN unit_type IN ('LOCAL', 'PRODUCTION_CENTER', 'OTHER') THEN unit_type
        ELSE 'OTHER'
    END,
    unit_subtype = CASE
        WHEN unit_type IN ('SALON', 'BAR', 'DELIVERY_HUB', 'KITCHEN', 'CENTRAL_OFFICE') THEN unit_type
        ELSE COALESCE(unit_subtype, 'GENERAL')
    END
WHERE unit_type NOT IN ('LOCAL', 'WAREHOUSE', 'PRODUCTION_CENTER', 'OTHER');

-- Apply canonical unit_type check constraint
ALTER TABLE public.eco_operational_units
    ADD CONSTRAINT eco_operational_units_unit_type_check 
    CHECK (unit_type IN ('LOCAL', 'WAREHOUSE', 'PRODUCTION_CENTER', 'OTHER'));

-- 3. DEFECT 3 REMEDIATION: MULTI-UNIT MEMBERSHIP SCOPES
-- ------------------------------------------------------------------------------

-- Add is_organization_wide flag to eco_organization_members
ALTER TABLE public.eco_organization_members
    ADD COLUMN IF NOT EXISTS is_organization_wide BOOLEAN NOT NULL DEFAULT true;

-- Create canonical membership operational unit scopes table
CREATE TABLE IF NOT EXISTS public.eco_membership_operational_unit_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.eco_organization_members(id) ON DELETE CASCADE,
    operational_unit_id UUID NOT NULL REFERENCES public.eco_operational_units(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_membership_op_unit_scope UNIQUE (membership_id, operational_unit_id)
);

-- Enable RLS on operational unit scopes
ALTER TABLE public.eco_membership_operational_unit_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_membership_scopes" ON public.eco_membership_operational_unit_scopes;
CREATE POLICY "org_members_read_membership_scopes"
    ON public.eco_membership_operational_unit_scopes FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.eco_organization_members m
        WHERE m.id = public.eco_membership_operational_unit_scopes.membership_id
          AND public.user_has_org_membership(m.organization_id)
    ));

-- Migrate legacy single operational_unit_id into scopes table if set
INSERT INTO public.eco_membership_operational_unit_scopes (membership_id, operational_unit_id)
SELECT id, operational_unit_id
FROM public.eco_organization_members
WHERE operational_unit_id IS NOT NULL
ON CONFLICT (membership_id, operational_unit_id) DO NOTHING;

-- If a member had a specific operational_unit_id set, default their organization-wide access to false
UPDATE public.eco_organization_members
SET is_organization_wide = false
WHERE operational_unit_id IS NOT NULL;

-- 4. DEFECT 4 REMEDIATION: COMPREHENSIVE CANONICAL CAPABILITY REGISTRY
-- ------------------------------------------------------------------------------

INSERT INTO public.eco_capabilities (code, scope, description) VALUES
    -- Platform Administration
    ('PLATFORM_TENANTS_PROVISION', 'PLATFORM', 'Provision new tenant organizations'),
    ('PLATFORM_SYSTEM_MONITOR', 'PLATFORM', 'View global platform health metrics'),
    ('PLATFORM_MIGRATIONS_APPLY', 'PLATFORM', 'Apply database migrations'),
    ('PLATFORM_MANAGE', 'PLATFORM', 'Manage system-wide configuration'),
    ('GLOBAL_USER_MANAGE', 'PLATFORM', 'Manage platform users globally'),
    ('GLOBAL_CATALOG_MANAGE', 'PLATFORM', 'Manage global tax and activity catalogs'),
    ('GLOBAL_CATALOG_VIEW', 'PLATFORM', 'View global catalogs'),
    ('ORGANIZATION_CREATE', 'PLATFORM', 'Create tenant organizations'),
    ('ORGANIZATION_UPDATE', 'PLATFORM', 'Update tenant organization metadata'),
    ('ORGANIZATION_ARCHIVE', 'PLATFORM', 'Archive tenant organizations'),
    ('PLAN_MANAGE', 'PLATFORM', 'Manage subscription plans and billing tiers'),
    ('SAAS_ANALYTICS_VIEW', 'PLATFORM', 'View SaaS analytics and operational metrics'),
    ('AUDIT_PLATFORM_VIEW', 'PLATFORM', 'View global platform audit logs'),
    ('SUPPORT_IMPERSONATE', 'PLATFORM', 'Impersonate tenant sessions for troubleshooting'),
    ('HARD_DELETE_EXCEPTIONAL', 'PLATFORM', 'Exceptional permanent data deletion'),

    -- Organization & Membership
    ('ORG_VIEW', 'ORGANIZATION', 'View organization profile and dashboard'),
    ('ORG_SETTINGS_VIEW', 'ORGANIZATION', 'View organization configuration settings'),
    ('ORG_SETTINGS_MANAGE', 'ORGANIZATION', 'Modify organization settings'),
    ('ORG_MEMBER_VIEW', 'ORGANIZATION', 'View organization members list'),
    ('ORG_MEMBER_INVITE', 'ORGANIZATION', 'Invite new members to organization'),
    ('ORG_MEMBER_MANAGE', 'ORGANIZATION', 'Update member profiles and status'),
    ('ORG_MEMBER_PERMISSION_MANAGE', 'ORGANIZATION', 'Manage member role templates and overrides'),

    -- Operational Units
    ('OPUNIT_VIEW', 'ORGANIZATION', 'View operational units list'),
    ('OPUNIT_MANAGE', 'ORGANIZATION', 'Create and modify operational units'),
    ('OPUNIT_ASSIGN_SCOPE', 'ORGANIZATION', 'Assign operational unit scopes to members'),

    -- Sales & POS
    ('SALES_VIEW', 'ORGANIZATION', 'View sales overview and dashboards'),
    ('SALES_TICKETS_READ', 'ORGANIZATION', 'Read individual POS ticket details'),
    ('SALES_IMPORT_UPLOAD', 'ORGANIZATION', 'Upload sales POS extract files'),
    ('SALES_IMPORT_PROCESS', 'ORGANIZATION', 'Process sales import batches'),

    -- Purchases & Suppliers
    ('SUPPLIERS_VIEW', 'ORGANIZATION', 'View supplier directory'),
    ('SUPPLIERS_MANAGE', 'ORGANIZATION', 'Create and edit supplier profiles'),
    ('PURCHASES_ORDER_CREATE', 'ORGANIZATION', 'Create purchase orders for suppliers'),
    ('PURCHASES_ORDER_APPROVE', 'ORGANIZATION', 'Human Gate: Approve purchase orders'),
    ('PURCHASES_RECEPTION_CONFIRM', 'ORGANIZATION', 'Confirm goods intake and delivery'),
    ('PURCHASES_INVOICES_MANAGE', 'ORGANIZATION', 'Register and match supplier invoices'),

    -- Catalog & Products
    ('CATALOG_PRODUCTS_READ', 'ORGANIZATION', 'Read master product catalog'),
    ('CATALOG_PRODUCTS_WRITE', 'ORGANIZATION', 'Create and modify catalog items'),
    ('CATALOG_PRICING_MANAGE', 'ORGANIZATION', 'Manage product selling and purchase prices'),
    ('CATALOG_ORG_VIEW', 'ORGANIZATION', 'View organization-assigned catalog categories'),
    ('CATALOG_ASSIGN_ANY_ORG', 'PLATFORM', 'Assign global catalogs to organizations'),

    -- Recipes & Cost Sheets
    ('RECIPES_VIEW', 'ORGANIZATION', 'View dish recipes and preparation instructions'),
    ('RECIPES_MANAGE', 'ORGANIZATION', 'Create and edit recipes and sub-recipes'),
    ('COSTSHEETS_VIEW', 'ORGANIZATION', 'View ingredient costing and margin sheets'),
    ('COSTSHEETS_EDIT', 'ORGANIZATION', 'Edit ingredient cost breakdown and pricing targets'),

    -- Production
    ('PRODUCTION_VIEW', 'ORGANIZATION', 'View production schedules and batches'),
    ('PRODUCTION_BATCH_LOG', 'ORGANIZATION', 'Log production batches in kitchens/centers'),
    ('PRODUCTION_WASTE_LOG', 'ORGANIZATION', 'Log production and prep waste'),
    ('PRODUCTION_RUN_CONFIRM', 'ORGANIZATION', 'Confirm completed production runs'),

    -- Inventory & Stock
    ('INVENTORY_STOCK_VIEW', 'ORGANIZATION', 'View stock levels across units'),
    ('INVENTORY_MOVE_LOG', 'ORGANIZATION', 'Log inventory transfers between units'),
    ('INVENTORY_COUNT_RUN', 'ORGANIZATION', 'Human Gate: Initiate and execute physical count'),
    ('INVENTORY_ADJUSTMENT_CONFIRM', 'ORGANIZATION', 'Human Gate: Confirm inventory adjustments'),

    -- Financial & Statements
    ('BANK_IMPORT', 'ORGANIZATION', 'Upload and parse bank statement files'),
    ('PAYROLL_IMPORT', 'ORGANIZATION', 'Upload and parse payroll files'),
    ('PERCEPTION_IMPORT', 'ORGANIZATION', 'Upload tax perceptions files'),
    ('IMPORT_VIEW', 'ORGANIZATION', 'View import history'),
    ('IMPORT_CREATE', 'ORGANIZATION', 'Create statement import batches'),
    ('IMPORT_REVIEW', 'ORGANIZATION', 'Review import issues and line items'),
    ('IMPORT_RETRY', 'ORGANIZATION', 'Retry failed statement imports'),
    ('ISSUE_RESOLVE', 'ORGANIZATION', 'Resolve import line exceptions'),
    ('RECORD_VIEW', 'ORGANIZATION', 'View normalized financial records'),
    ('RECORD_CLASSIFY', 'ORGANIZATION', 'Classify financial records'),
    ('FINANCIAL_ALLOCATION_EDIT', 'ORGANIZATION', 'Edit movement allocations'),
    ('FINANCIAL_RECONCILIATION_REVIEW', 'ORGANIZATION', 'Human Gate: Review bank reconciliation'),
    ('FINANCIAL_RECONCILIATION_CONFIRM', 'ORGANIZATION', 'Human Gate: Confirm bank reconciliation'),

    -- Documents & OCR
    ('DOCUMENTS_UPLOAD', 'ORGANIZATION', 'Upload raw financial and invoice documents'),
    ('DOCUMENTS_OCR_PROCESS', 'ORGANIZATION', 'Trigger OCR processing on documents'),
    ('DOCUMENTS_OCR_VERIFY', 'ORGANIZATION', 'Verify OCR extracted invoice data'),

    -- Personnel & HR
    ('PERSONNEL_EMPLOYEES_MANAGE', 'ORGANIZATION', 'Manage staff records and contracts'),
    ('PERSONNEL_FICHAJES_WRITE', 'ORGANIZATION', 'Record employee clock-in/out shifts'),
    ('PERSONNEL_FICHAJES_AUDIT', 'ORGANIZATION', 'Audit and adjust employee shift records'),
    ('PERSONNEL_INCIDENCIAS_MANAGE', 'ORGANIZATION', 'Manage employee leaves and absences'),

    -- Reporting, P&L & Metrics
    ('REPORT_VIEW', 'ORGANIZATION', 'View standard organization reports'),
    ('REPORT_EXPORT', 'ORGANIZATION', 'Export reports in CSV/PDF format'),
    ('REPORT_PNL_VIEW', 'ORGANIZATION', 'View P&L and financial performance reports'),
    ('REPORT_TAX_SUMMARY_VIEW', 'ORGANIZATION', 'View tax summaries and IIBB reports'),
    ('REPORT_CONSOLIDATED_SCOPED_ORGS', 'HOLDING', 'View consolidated reports across holding orgs'),
    ('REPORT_COMPARE_SCOPED_ORGS', 'HOLDING', 'Compare financial metrics across scoped orgs'),

    -- Integrations
    ('INTEGRATIONS_CONFIG_MANAGE', 'ORGANIZATION', 'Configure POS and accounting integrations'),
    ('INTEGRATIONS_SYNC_TRIGGER', 'ORGANIZATION', 'Trigger on-demand data synchronizations'),

    -- Deletion & Recovery
    ('RECORD_SOFT_DELETE', 'ORGANIZATION', 'Soft delete normalized records'),
    ('RECORD_RESTORE', 'ORGANIZATION', 'Restore soft-deleted records'),

    -- Sensitive Data
    ('SENSITIVEDATA_SALARIES_READ', 'ORGANIZATION', 'View salary and compensation details'),
    ('SENSITIVEDATA_BANKING_READ', 'ORGANIZATION', 'View bank account IBANs and balances'),

    -- Support & Audit
    ('TICKET_CREATE', 'ORGANIZATION', 'Create support tickets'),
    ('TICKET_VIEW_ORG', 'ORGANIZATION', 'View organization support tickets'),
    ('AUDIT_VIEW_ORG', 'ORGANIZATION', 'View organization audit log events'),

    -- Canonical Human Gate Alias Codes
    ('REVIEW_RECONCILIATION', 'ORGANIZATION', 'Human Gate: Review bank reconciliation candidate matches'),
    ('CONFIRM_RECONCILIATION', 'ORGANIZATION', 'Human Gate: Confirm and commit bank reconciliation ledger allocations'),
    ('CREATE_PURCHASE_ORDER', 'ORGANIZATION', 'Create purchase orders for suppliers'),
    ('APPROVE_PURCHASE_ORDER', 'ORGANIZATION', 'Human Gate: Approve purchase orders'),
    ('RUN_STOCK_COUNT', 'ORGANIZATION', 'Human Gate: Initiate and execute physical count'),
    ('CONFIRM_STOCK_ADJUSTMENT', 'ORGANIZATION', 'Human Gate: Confirm inventory adjustments')
ON CONFLICT (code) DO UPDATE SET 
    scope = EXCLUDED.scope,
    description = EXCLUDED.description;

-- 5. RE-BUNDLE 13 CANONICAL ROLE TEMPLATES WITH ACCURATE DOMAIN CAPABILITIES
-- ------------------------------------------------------------------------------

-- Clear prior mappings to ensure clean idempotent assignment
TRUNCATE TABLE public.eco_role_template_capabilities;

DO $$
DECLARE
    v_template_id UUID;
BEGIN
    -- 1. VEGEN_PLATFORM_ADMIN (Platform concerns only — strictly zero automatic tenant business-data access)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'VEGEN_PLATFORM_ADMIN';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'PLATFORM_TENANTS_PROVISION', 'PLATFORM_SYSTEM_MONITOR', 'PLATFORM_MIGRATIONS_APPLY',
        'PLATFORM_MANAGE', 'GLOBAL_USER_MANAGE', 'GLOBAL_CATALOG_MANAGE', 'GLOBAL_CATALOG_VIEW',
        'ORGANIZATION_CREATE', 'ORGANIZATION_UPDATE', 'ORGANIZATION_ARCHIVE',
        'PLAN_MANAGE', 'SAAS_ANALYTICS_VIEW', 'AUDIT_PLATFORM_VIEW',
        'SUPPORT_IMPERSONATE', 'HARD_DELETE_EXCEPTIONAL', 'CATALOG_ASSIGN_ANY_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 2. HOLDING_OWNER (Executive group ownership and cross-org analytics)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HOLDING_OWNER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_SETTINGS_MANAGE',
        'ORG_MEMBER_VIEW', 'ORG_MEMBER_MANAGE', 'OPUNIT_VIEW',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_PNL_VIEW', 'REPORT_TAX_SUMMARY_VIEW',
        'REPORT_CONSOLIDATED_SCOPED_ORGS', 'REPORT_COMPARE_SCOPED_ORGS',
        'SALES_VIEW', 'SENSITIVEDATA_SALARIES_READ', 'SENSITIVEDATA_BANKING_READ', 'AUDIT_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 3. HOLDING_ADMIN (Executive group administration and monitoring)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HOLDING_ADMIN';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'OPUNIT_VIEW',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_PNL_VIEW',
        'REPORT_CONSOLIDATED_SCOPED_ORGS', 'REPORT_COMPARE_SCOPED_ORGS',
        'SALES_VIEW', 'AUDIT_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 4. OWNER (Tenant Organization Owner — broad CIF operational authority, no platform power)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'OWNER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE scope IN ('ORGANIZATION', 'OPERATIONAL_UNIT')
    ON CONFLICT DO NOTHING;

    -- 5. MANAGER (General & Operations Manager)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'MANAGER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'OPUNIT_VIEW',
        'SALES_VIEW', 'SALES_TICKETS_READ', 'SALES_IMPORT_UPLOAD', 'SALES_IMPORT_PROCESS',
        'SUPPLIERS_VIEW', 'SUPPLIERS_MANAGE', 'PURCHASES_ORDER_CREATE', 'PURCHASES_ORDER_APPROVE', 'PURCHASES_RECEPTION_CONFIRM',
        'CATALOG_PRODUCTS_READ', 'CATALOG_PRODUCTS_WRITE', 'RECIPES_VIEW', 'COSTSHEETS_VIEW',
        'PRODUCTION_VIEW', 'PRODUCTION_BATCH_LOG', 'PRODUCTION_RUN_CONFIRM',
        'INVENTORY_STOCK_VIEW', 'INVENTORY_MOVE_LOG', 'INVENTORY_COUNT_RUN', 'INVENTORY_ADJUSTMENT_CONFIRM',
        'BANK_IMPORT', 'IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY',
        'PERSONNEL_EMPLOYEES_MANAGE', 'PERSONNEL_FICHAJES_WRITE', 'PERSONNEL_FICHAJES_AUDIT', 'PERSONNEL_INCIDENCIAS_MANAGE',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_PNL_VIEW', 'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE', 'TICKET_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 6. ADMINISTRATIVE (Financial administration & statement imports)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'ADMINISTRATIVE';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'OPUNIT_VIEW',
        'SUPPLIERS_VIEW', 'PURCHASES_INVOICES_MANAGE',
        'BANK_IMPORT', 'PAYROLL_IMPORT', 'PERCEPTION_IMPORT',
        'IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_RETRY', 'ISSUE_RESOLVE',
        'RECORD_VIEW', 'RECORD_CLASSIFY', 'FINANCIAL_ALLOCATION_EDIT',
        'FINANCIAL_RECONCILIATION_REVIEW',
        'DOCUMENTS_UPLOAD', 'DOCUMENTS_OCR_PROCESS', 'DOCUMENTS_OCR_VERIFY',
        'PERSONNEL_FICHAJES_WRITE', 'PERSONNEL_INCIDENCIAS_MANAGE',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_TAX_SUMMARY_VIEW', 'CATALOG_ORG_VIEW', 'TICKET_CREATE', 'TICKET_VIEW_ORG'
    ) ON CONFLICT DO NOTHING;

    -- 7. PURCHASING (Purchasing & supplier management)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'PURCHASING';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'OPUNIT_VIEW',
        'SUPPLIERS_VIEW', 'SUPPLIERS_MANAGE',
        'PURCHASES_ORDER_CREATE', 'PURCHASES_RECEPTION_CONFIRM', 'PURCHASES_INVOICES_MANAGE',
        'CATALOG_PRODUCTS_READ', 'CATALOG_PRODUCTS_WRITE', 'CATALOG_PRICING_MANAGE',
        'INVENTORY_STOCK_VIEW', 'DOCUMENTS_UPLOAD', 'REPORT_VIEW', 'CATALOG_ORG_VIEW', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 8. RECEPTION_FLOOR (Floor reception & intake)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'RECEPTION_FLOOR';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'OPUNIT_VIEW',
        'PURCHASES_RECEPTION_CONFIRM', 'INVENTORY_STOCK_VIEW', 'INVENTORY_MOVE_LOG',
        'SALES_VIEW', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 9. PRODUCTION (Kitchen & production floor)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'PRODUCTION';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'OPUNIT_VIEW',
        'RECIPES_VIEW', 'PRODUCTION_VIEW', 'PRODUCTION_BATCH_LOG', 'PRODUCTION_WASTE_LOG', 'PRODUCTION_RUN_CONFIRM',
        'INVENTORY_STOCK_VIEW', 'INVENTORY_MOVE_LOG', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 10. COOK_COST_SHEET_MANAGER (Chef & menu costing)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'COOK_COST_SHEET_MANAGER';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'OPUNIT_VIEW',
        'CATALOG_PRODUCTS_READ', 'CATALOG_PRODUCTS_WRITE', 'CATALOG_PRICING_MANAGE',
        'RECIPES_VIEW', 'RECIPES_MANAGE', 'COSTSHEETS_VIEW', 'COSTSHEETS_EDIT',
        'PRODUCTION_VIEW', 'PRODUCTION_BATCH_LOG', 'INVENTORY_STOCK_VIEW', 'REPORT_VIEW', 'CATALOG_ORG_VIEW', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 11. HR_PERSONNEL (Human resources & clock-ins)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'HR_PERSONNEL';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_MEMBER_VIEW', 'OPUNIT_VIEW',
        'PERSONNEL_EMPLOYEES_MANAGE', 'PERSONNEL_FICHAJES_WRITE', 'PERSONNEL_FICHAJES_AUDIT', 'PERSONNEL_INCIDENCIAS_MANAGE',
        'PAYROLL_IMPORT', 'REPORT_VIEW', 'SENSITIVEDATA_SALARIES_READ', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 12. EXTERNAL_ACCOUNTANT (Gestoría & tax advisor — read/review biased)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'EXTERNAL_ACCOUNTANT';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'OPUNIT_VIEW',
        'BANK_IMPORT', 'PAYROLL_IMPORT', 'PERCEPTION_IMPORT',
        'IMPORT_VIEW', 'IMPORT_REVIEW', 'RECORD_VIEW', 'RECORD_CLASSIFY',
        'FINANCIAL_RECONCILIATION_REVIEW',
        'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_PNL_VIEW', 'REPORT_TAX_SUMMARY_VIEW',
        'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;

    -- 13. CONSULTANT (Read-only auditor & advisor)
    SELECT id INTO v_template_id FROM public.eco_role_templates WHERE code = 'CONSULTANT';
    INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
    SELECT v_template_id, id FROM public.eco_capabilities
    WHERE code IN (
        'ORG_VIEW', 'ORG_SETTINGS_VIEW', 'ORG_MEMBER_VIEW', 'OPUNIT_VIEW',
        'SALES_VIEW', 'RECIPES_VIEW', 'COSTSHEETS_VIEW', 'INVENTORY_STOCK_VIEW',
        'IMPORT_VIEW', 'RECORD_VIEW', 'REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_PNL_VIEW',
        'CATALOG_ORG_VIEW', 'AUDIT_VIEW_ORG', 'TICKET_CREATE'
    ) ON CONFLICT DO NOTHING;
END $$;

-- 6. CANONICAL ROLE TEMPLATES RECONCILIATION & SAFE RETIREMENT OF LEGACY ROLES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_platform_admin_id UUID;
BEGIN
    SELECT id INTO v_platform_admin_id FROM public.eco_role_templates WHERE code = 'VEGEN_PLATFORM_ADMIN';
    
    -- Remap exploratory platform roles if existing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eco_user_platform_role') THEN
        UPDATE public.eco_user_platform_role
        SET role_template_id = v_platform_admin_id
        WHERE role_template_id NOT IN (
            SELECT id FROM public.eco_role_templates WHERE code IN (
                'VEGEN_PLATFORM_ADMIN', 'HOLDING_OWNER', 'HOLDING_ADMIN', 'OWNER', 'MANAGER',
                'ADMINISTRATIVE', 'PURCHASING', 'RECEPTION_FLOOR', 'PRODUCTION',
                'COOK_COST_SHEET_MANAGER', 'HR_PERSONNEL', 'EXTERNAL_ACCOUNTANT', 'CONSULTANT'
            )
        );
    END IF;

    -- Delete obsolete pre-WP-002 role templates to preserve the exact 13 canonical rows
    DELETE FROM public.eco_role_templates
    WHERE code NOT IN (
        'VEGEN_PLATFORM_ADMIN', 'HOLDING_OWNER', 'HOLDING_ADMIN', 'OWNER', 'MANAGER',
        'ADMINISTRATIVE', 'PURCHASING', 'RECEPTION_FLOOR', 'PRODUCTION',
        'COOK_COST_SHEET_MANAGER', 'HR_PERSONNEL', 'EXTERNAL_ACCOUNTANT', 'CONSULTANT'
    );
END $$;

