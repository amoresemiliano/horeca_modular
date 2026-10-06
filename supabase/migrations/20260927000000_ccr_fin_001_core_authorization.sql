-- CCR-FIN-001: Core authorization only. No Finance tables, policies or RPCs are changed.
BEGIN;

-- The 20260903 FOR ALL browser policies on profiles/memberships otherwise permit
-- identity/role escalation before evaluating this gate. Restrictive policies combine
-- with existing read policies without replacing them. Trusted Core provisioning
-- runs under its existing privileged server context, not a browser database role.
ALTER TABLE public.eco_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS core_profiles_no_browser_insert ON public.eco_user_profiles;
CREATE POLICY core_profiles_no_browser_insert ON public.eco_user_profiles AS RESTRICTIVE
  FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS core_profiles_no_browser_update ON public.eco_user_profiles;
CREATE POLICY core_profiles_no_browser_update ON public.eco_user_profiles AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS core_profiles_no_browser_delete ON public.eco_user_profiles;
CREATE POLICY core_profiles_no_browser_delete ON public.eco_user_profiles AS RESTRICTIVE
  FOR DELETE TO authenticated, anon USING (false);
DROP POLICY IF EXISTS core_memberships_no_browser_insert ON public.eco_organization_members;
CREATE POLICY core_memberships_no_browser_insert ON public.eco_organization_members AS RESTRICTIVE
  FOR INSERT TO authenticated, anon WITH CHECK (false);
DROP POLICY IF EXISTS core_memberships_no_browser_update ON public.eco_organization_members;
CREATE POLICY core_memberships_no_browser_update ON public.eco_organization_members AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS core_memberships_no_browser_delete ON public.eco_organization_members;
CREATE POLICY core_memberships_no_browser_delete ON public.eco_organization_members AS RESTRICTIVE
  FOR DELETE TO authenticated, anon USING (false);

-- Entitlement requirements are trusted registry metadata, never a caller-selected bypass.
ALTER TABLE public.eco_capabilities
  ADD COLUMN IF NOT EXISTS required_module_key text
  CHECK (required_module_key IS NULL OR required_module_key ~ '^[a-z][a-z0-9_]*$');

INSERT INTO public.eco_capabilities (code, scope, description, is_active, required_module_key)
VALUES ('STATEMENTS_IMPORT_CONFIRM', 'ORGANIZATION',
        'Human confirmation of a bank statement import; independent of upload, processing and reconciliation', true, 'bancos')
ON CONFLICT (code) DO UPDATE SET scope = EXCLUDED.scope, description = EXCLUDED.description,
  is_active = EXCLUDED.is_active, required_module_key = EXCLUDED.required_module_key;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.eco_role_templates
      WHERE code IN ('OWNER', 'MANAGER', 'ADMINISTRATIVE') AND is_active) <> 3 THEN
    RAISE EXCEPTION 'CCR-FIN-001 requires the three active canonical confirmation role templates';
  END IF;
END;
$$;

-- Limit this change to the new gate; preserve all other capabilities and member overrides.
DELETE FROM public.eco_role_template_capabilities rc
USING public.eco_capabilities c, public.eco_role_templates r
WHERE rc.capability_id = c.id AND rc.role_template_id = r.id
  AND c.code = 'STATEMENTS_IMPORT_CONFIRM'
  AND r.code NOT IN ('OWNER', 'MANAGER', 'ADMINISTRATIVE');

INSERT INTO public.eco_role_template_capabilities (role_template_id, capability_id)
SELECT r.id, c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
WHERE r.code IN ('OWNER', 'MANAGER', 'ADMINISTRATIVE') AND r.is_active
  AND c.code = 'STATEMENTS_IMPORT_CONFIRM'
ON CONFLICT (role_template_id, capability_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_execute_capability_for_org(
  requested_organization_id uuid,
  required_capability_code text,
  requested_operational_unit_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND requested_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.eco_capabilities c
      JOIN public.eco_organizations o ON o.id = requested_organization_id AND o.is_active IS TRUE
      WHERE c.code = required_capability_code AND c.is_active IS TRUE
        AND c.scope IN ('ORGANIZATION', 'OPERATIONAL_UNIT')
        AND (
          (c.scope = 'ORGANIZATION' AND requested_operational_unit_id IS NULL)
          OR (c.scope = 'OPERATIONAL_UNIT' AND EXISTS (
            SELECT 1 FROM public.eco_operational_units u
            WHERE u.id = requested_operational_unit_id AND u.organization_id = o.id AND u.is_active IS TRUE
          ))
        )
        AND (c.required_module_key IS NULL OR EXISTS (
          SELECT 1 FROM public.eco_organization_module_entitlements e
          WHERE e.organization_id = o.id AND e.module_key = c.required_module_key AND e.is_enabled IS TRUE
        ))
        -- Explicit applicable REVOKE always wins, even over another grant/membership.
        AND NOT EXISTS (
          SELECT 1 FROM public.eco_member_capability_overrides ov
          JOIN public.eco_organization_members rm ON rm.id = ov.membership_id
          JOIN public.eco_user_profiles rp ON rp.id = coalesce(rm.user_id, rm.user_profile_id)
          WHERE rp.auth_user_id = auth.uid() AND rp.is_active IS TRUE
            AND rm.organization_id = o.id AND rm.is_active IS TRUE
            AND ov.capability_id = c.id AND ov.effect = 'REVOKE'
            AND (c.scope = 'ORGANIZATION' OR ov.operational_unit_id IS NULL
                 OR ov.operational_unit_id = requested_operational_unit_id)
        )
        AND EXISTS (
          SELECT 1 FROM public.eco_organization_members m
          JOIN public.eco_user_profiles p ON p.id = coalesce(m.user_id, m.user_profile_id)
          JOIN public.eco_role_templates r ON r.id = m.role_template_id AND r.is_active IS TRUE
          WHERE p.auth_user_id = auth.uid() AND p.is_active IS TRUE
            AND m.organization_id = o.id AND m.is_active IS TRUE
            -- Transitional identity columns must not point at different users.
            AND (m.user_id IS NULL OR m.user_profile_id IS NULL OR m.user_id = m.user_profile_id)
            AND (m.is_organization_wide IS TRUE OR (
              c.scope = 'OPERATIONAL_UNIT' AND EXISTS (
                SELECT 1 FROM public.eco_membership_operational_unit_scopes s
                WHERE s.membership_id = m.id AND s.operational_unit_id = requested_operational_unit_id
              )
            ))
            AND (
              EXISTS (SELECT 1 FROM public.eco_role_template_capabilities rc
                      WHERE rc.role_template_id = r.id AND rc.capability_id = c.id)
              OR EXISTS (
                SELECT 1 FROM public.eco_member_capability_overrides ov
                WHERE ov.membership_id = m.id AND ov.capability_id = c.id AND ov.effect = 'GRANT'
                  AND (ov.operational_unit_id IS NULL OR
                    (c.scope = 'OPERATIONAL_UNIT' AND ov.operational_unit_id = requested_operational_unit_id))
              )
            )
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_execute_capability_for_org(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_execute_capability_for_org(uuid, text, uuid) TO authenticated;
COMMENT ON FUNCTION public.can_execute_capability_for_org(uuid, text, uuid) IS
  'Core CCR-FIN-001: evaluates auth.uid(), requested organization, effective capability, revoke precedence, entitlement and scope. No active-context/first-membership fallback. Read-only authorization; call inside trusted operations.';

COMMIT;
