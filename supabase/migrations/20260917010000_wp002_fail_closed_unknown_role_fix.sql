-- ==============================================================================
-- MIGRATION: 20260917010000_wp002_fail_closed_unknown_role_fix.sql
-- DESCRIPTION: WP-002 Fail-Closed Authorization Remediation for Unknown & Obsolete Roles
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: DEV (ourzapkjykzlwsjunzmd) & Replayable Fresh Scratch DB
-- ==============================================================================

-- 1. STRICT DETERMINISTIC MAPPING FOR KNOWN EXPLICIT LEGACY ROLES ONLY
UPDATE public.eco_organization_members m
SET role_template_id = t.id
FROM public.eco_role_templates t
WHERE t.is_active = true
  AND (
    (m.role = 'SUPERADMIN' AND t.code = 'OWNER') OR
    (m.role = 'ADMIN' AND t.code = 'ADMINISTRATIVE') OR
    (m.role = 'GERENTE' AND t.code = 'MANAGER') OR
    (m.role = 'OPERADOR' AND t.code = 'PRODUCTION') OR
    (m.role = 'CONSULTA' AND t.code = 'CONSULTANT') OR
    (m.role = 'OWNER' AND t.code = 'OWNER')
);

-- 2. FAIL-CLOSED REMEDIATION FOR UNKNOWN / UNMAPPED / OBSOLETE ROLES
-- Any membership with an unknown legacy role string (not in approved list)
-- OR whose referenced role template is inactive/noncanonical without an explicit deterministic match
-- MUST resolve to canonical role_template_id = NULL (DENY by default, 0 capabilities).
UPDATE public.eco_organization_members
SET role_template_id = NULL
WHERE (role NOT IN ('SUPERADMIN', 'ADMIN', 'GERENTE', 'OPERADOR', 'CONSULTA', 'OWNER') OR role IS NULL)
   OR role_template_id IN (
       SELECT id FROM public.eco_role_templates WHERE is_active = false
   );
