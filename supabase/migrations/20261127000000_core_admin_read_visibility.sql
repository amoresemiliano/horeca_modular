-- CCR-CORE-ROLE-READ: tenant-scoped, capability-gated administrative reads.
BEGIN;
INSERT INTO public.eco_capabilities(code,scope,description) VALUES
 ('org.users.view','ORGANIZATION','Ver usuarios'),
 ('org.roles.view','ORGANIZATION','Ver roles y permisos'),
 ('org.audit.view','ORGANIZATION','Ver auditoría');
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
 SELECT r.id,c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
 WHERE r.code='OWNER' AND r.tier='ORGANIZATION'
 AND c.code IN ('org.users.view','org.roles.view','org.audit.view');

CREATE FUNCTION public.core_admin_read_snapshot(requested_organization_id uuid, section text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE needed text; result jsonb;
BEGIN
 needed:=CASE section WHEN 'users' THEN 'org.users.view' WHEN 'roles' THEN 'org.roles.view' WHEN 'audit' THEN 'org.audit.view' ELSE NULL END;
 IF auth.uid() IS NULL OR needed IS NULL OR requested_organization_id IS NULL
    OR NOT public.can_execute_capability_for_org(requested_organization_id,needed) THEN
  RAISE EXCEPTION 'Tenant read denied' USING ERRCODE='42501';
 END IF;
 IF section='users' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'display_name',p.display_name,
   'role_code',r.code,'role_name',r.name,'is_active',m.is_active,'is_organization_wide',m.is_organization_wide,
   'units',coalesce((SELECT jsonb_agg(u.name ORDER BY u.name) FROM public.eco_membership_operational_unit_scopes s
     JOIN public.eco_operational_units u ON u.id=s.operational_unit_id AND u.organization_id=m.organization_id
     WHERE s.membership_id=m.id),'[]'::jsonb)) ORDER BY p.display_name NULLS LAST),'[]'::jsonb)
  INTO result FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id
   LEFT JOIN public.eco_role_templates r ON r.id=m.role_template_id AND r.tier='ORGANIZATION'
   WHERE m.organization_id=requested_organization_id;
 ELSIF section='roles' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('code',r.code,'name',r.name,'description',r.description,
   'capabilities',coalesce((SELECT jsonb_agg(jsonb_build_object('code',c.code,'description',c.description) ORDER BY c.code)
    FROM public.eco_role_template_capabilities rc JOIN public.eco_capabilities c ON c.id=rc.capability_id
    WHERE rc.role_template_id=r.id AND c.scope='ORGANIZATION' AND c.is_active),'[]'::jsonb)) ORDER BY r.name),'[]'::jsonb)
  INTO result FROM public.eco_role_templates r WHERE r.tier='ORGANIZATION' AND r.is_active;
 ELSE
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'created_at',a.created_at,
   'actor_name',(SELECT p.display_name FROM public.eco_user_profiles p WHERE p.auth_user_id=a.actor),
   'target_name',(SELECT p.display_name FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id
     WHERE m.id=a.target_membership_id AND m.organization_id=requested_organization_id)) ORDER BY a.created_at DESC),'[]'::jsonb)
  INTO result FROM (SELECT id,action,created_at,actor,target_membership_id FROM public.eco_access_audit
   WHERE organization_id=requested_organization_id ORDER BY created_at DESC LIMIT 100) a;
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.core_admin_read_snapshot(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.core_admin_read_snapshot(uuid,text) TO authenticated;
COMMIT;
