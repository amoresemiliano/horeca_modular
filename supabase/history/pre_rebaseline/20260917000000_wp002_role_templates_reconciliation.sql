-- ==============================================================================
-- MIGRATION: 20260917000000_wp002_role_templates_reconciliation.sql
-- DESCRIPTION: WP-002 Final Role Templates & Membership Reference Reconciliation
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & Replayable Fresh Scratch DB
-- ==============================================================================

-- 1. ENSURE USER_ID IS POPULATED FOR ALL MEMBERSHIPS
UPDATE public.eco_organization_members
SET user_id = user_profile_id
WHERE user_id IS NULL AND user_profile_id IS NOT NULL;

-- 2. RECONCILE ALL MEMBERSHIP ROLE TEMPLATE REFERENCES TO ACTIVE CANONICAL TEMPLATES
-- Map legacy role strings to active canonical role templates
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE (
    (m.role = 'SUPERADMIN' AND t.code = 'OWNER') OR
    (m.role = 'ADMIN' AND t.code = 'ADMINISTRATIVE') OR
    (m.role = 'GERENTE' AND t.code = 'MANAGER') OR
    (m.role = 'OPERADOR' AND t.code = 'PRODUCTION') OR
    (m.role = 'CONSULTA' AND t.code = 'CONSULTANT') OR
    (m.role = 'OWNER' AND t.code = 'OWNER')
);

-- Default fallback to CONSULTANT for any remaining unmapped CONSULTA memberships or legacy references
UPDATE public.eco_organization_members m
SET role_template_id = (SELECT id FROM public.eco_role_templates WHERE code = 'CONSULTANT')
WHERE m.role_template_id IS NULL 
   OR m.role_template_id IN (
       SELECT id FROM public.eco_role_templates 
       WHERE code NOT IN (
           'VEGEN_PLATFORM_ADMIN', 'HOLDING_OWNER', 'HOLDING_ADMIN', 'OWNER', 'MANAGER',
           'ADMINISTRATIVE', 'PURCHASING', 'RECEPTION_FLOOR', 'PRODUCTION',
           'COOK_COST_SHEET_MANAGER', 'HR_PERSONNEL', 'EXTERNAL_ACCOUNTANT', 'CONSULTANT'
       )
   );

-- 3. DEACTIVATE ALL LEGACY / OBSOLETE ROLE TEMPLATES (PRESERVE DATA FOR HISTORICAL INTEGRITY)
UPDATE public.eco_role_templates
SET is_active = false,
    updated_at = timezone('utc'::text, now())
WHERE code NOT IN (
    'VEGEN_PLATFORM_ADMIN', 'HOLDING_OWNER', 'HOLDING_ADMIN', 'OWNER', 'MANAGER',
    'ADMINISTRATIVE', 'PURCHASING', 'RECEPTION_FLOOR', 'PRODUCTION',
    'COOK_COST_SHEET_MANAGER', 'HR_PERSONNEL', 'EXTERNAL_ACCOUNTANT', 'CONSULTANT'
);
