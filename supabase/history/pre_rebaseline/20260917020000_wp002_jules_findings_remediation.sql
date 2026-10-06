-- ==============================================================================
-- MIGRATION: 20260917020000_wp002_jules_findings_remediation.sql
-- DESCRIPTION: WP-002 Jules Review Findings Remediation (Role Template Capability RLS, Legacy Binding Cleanup, Case-Insensitive Legacy Role Matching)
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & Replayable Fresh Scratch DB
-- ==============================================================================

-- 1. LEGACY ROLE TEMPLATE CAPABILITY BINDINGS CLEANUP (NON-DESTRUCTIVE TARGETED DELETION)
-- Cleanly remove capability bindings for deactivated legacy role templates without blanket TRUNCATE
DELETE FROM public.eco_role_template_capabilities
WHERE role_template_id IN (
    SELECT id FROM public.eco_role_templates WHERE is_active = false
);

-- 2. CASE-INSENSITIVE & TRIMMED FAIL-CLOSED LEGACY ROLE NORMALIZATION
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE t.is_active = true
  AND (
    (UPPER(TRIM(m.role)) = 'SUPERADMIN' AND t.code = 'OWNER') OR
    (UPPER(TRIM(m.role)) = 'ADMIN' AND t.code = 'ADMINISTRATIVE') OR
    (UPPER(TRIM(m.role)) = 'GERENTE' AND t.code = 'MANAGER') OR
    (UPPER(TRIM(m.role)) = 'OPERADOR' AND t.code = 'PRODUCTION') OR
    (UPPER(TRIM(m.role)) = 'CONSULTA' AND t.code = 'CONSULTANT') OR
    (UPPER(TRIM(m.role)) = 'OWNER' AND t.code = 'OWNER')
);

-- Fail-closed fallback: Any unmapped role or inactive role template reference resolves to NULL
UPDATE public.eco_organization_members
SET role_template_id = NULL
WHERE (UPPER(TRIM(role)) NOT IN ('SUPERADMIN', 'ADMIN', 'GERENTE', 'OPERADOR', 'CONSULTA', 'OWNER') OR role IS NULL)
   OR role_template_id IN (
       SELECT id FROM public.eco_role_templates WHERE is_active = false
   );

-- 3. HARDEN RLS POLICY FOR ROLE TEMPLATE CAPABILITIES TO ACTIVE TEMPLATES ONLY
DROP POLICY IF EXISTS "authenticated_read_role_template_capabilities" ON public.eco_role_template_capabilities;
CREATE POLICY "authenticated_read_role_template_capabilities"
    ON public.eco_role_template_capabilities FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.eco_role_templates t
        WHERE t.id = public.eco_role_template_capabilities.role_template_id
          AND t.is_active = true
    ));
