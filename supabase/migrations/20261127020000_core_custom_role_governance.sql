-- WP-CORE-ROLE-001B: reusable tenant role templates, platform-governed.
BEGIN;
INSERT INTO public.eco_role_templates(code,name,description,tier) VALUES
 ('MANAGER_READ_OPERATIONAL','Gerente','Supervisión general del tenant con visibilidad amplia y permisos operativos explícitamente autorizados, sin administración de usuarios, roles, módulos ni plataforma.','ORGANIZATION');
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
 SELECT r.id,c.id FROM public.eco_role_templates r JOIN public.eco_capabilities c ON c.code=ANY(ARRAY[
  'org.config.read','org.users.view','org.roles.view','org.audit.view',
  'banks.consolidated.view','banks.summary.view','banks.metrics.view','sensitivedata.banking.read',
  'personnel.employees.view','personnel.attendance.view','personnel.schedules.view','personnel.schedules.manage',
  'sales.view','sales.tickets.read','catalog.products.read','recipes.view','costsheets.view',
  'inventory.stock.view','production.view','reporting.operational.view'])
 WHERE r.code='MANAGER_READ_OPERATIONAL' AND c.is_active AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.eco_role_template_capabilities rc JOIN public.eco_role_templates r ON r.id=rc.role_template_id WHERE r.code='MANAGER_READ_OPERATIONAL') <> 20 THEN RAISE EXCEPTION 'Gerente requires the complete reviewed capability set'; END IF;
END $$;

CREATE FUNCTION public.core_role_is_reserved(role_code text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT role_code=ANY(ARRAY['VEGEN_PLATFORM_ADMIN','HOLDING_OWNER','HOLDING_ADMIN','OWNER','MANAGER','ADMINISTRATIVE','PURCHASING','RECEPTION_FLOOR','PRODUCTION','COOK_COST_SHEET_MANAGER','HR_PERSONNEL','EXTERNAL_ACCOUNTANT','CONSULTANT']);
$$;
REVOKE ALL ON FUNCTION public.core_role_is_reserved(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.core_role_admin_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.core_platform_can('platform.tenants.provision') THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'description',r.description,'is_active',r.is_active,'reserved',public.core_role_is_reserved(r.code),
   'users_count',(SELECT count(*) FROM public.eco_organization_members m WHERE m.role_template_id=r.id AND m.is_active),
   'capabilities',coalesce((SELECT jsonb_agg(c.code ORDER BY c.code) FROM public.eco_role_template_capabilities rc JOIN public.eco_capabilities c ON c.id=rc.capability_id WHERE rc.role_template_id=r.id AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT') AND c.is_active),'[]'::jsonb)) ORDER BY r.name) FROM public.eco_role_templates r WHERE r.tier='ORGANIZATION'),'[]'::jsonb),
  'capabilities',coalesce((SELECT jsonb_agg(jsonb_build_object('code',c.code,'description',c.description,'scope',c.scope) ORDER BY c.code) FROM public.eco_capabilities c WHERE c.is_active AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT')),'[]'::jsonb));
END $$;

CREATE FUNCTION public.core_role_admin_command(action text, role_id uuid, payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target public.eco_role_templates%ROWTYPE; source public.eco_role_templates%ROWTYPE; code_value text; name_value text; description_value text; codes text[]; previous jsonb; result jsonb; assigned integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.core_platform_can('platform.tenants.provision') THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501'; END IF;
 IF action NOT IN ('create','update','clone','deactivate') OR jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid action'; END IF;
 IF action IN ('update','deactivate','clone') THEN
  SELECT * INTO source FROM public.eco_role_templates WHERE id=role_id AND tier='ORGANIZATION' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization role required' USING ERRCODE='42501'; END IF;
  IF action IN ('update','deactivate') AND public.core_role_is_reserved(source.code) THEN RAISE EXCEPTION 'Reserved role' USING ERRCODE='42501'; END IF;
  IF NOT source.is_active THEN RAISE EXCEPTION 'Inactive role'; END IF;
 END IF;
 IF action='deactivate' THEN
  SELECT count(*) INTO assigned FROM public.eco_organization_members WHERE role_template_id=source.id AND is_active;
  IF payload->>'expected_users' IS DISTINCT FROM assigned::text THEN RAISE EXCEPTION 'Active membership count changed; refresh required'; END IF;
  IF assigned>0 AND (payload->>'confirm_assigned') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Active memberships require confirmation'; END IF;
  UPDATE public.eco_role_templates SET is_active=false,updated_at=now() WHERE id=source.id RETURNING * INTO target;
  INSERT INTO public.eco_access_audit(actor,action,change) VALUES(auth.uid(),'role.deactivated',jsonb_build_object('role_id',target.id,'code',target.code,'active_memberships',assigned));
  RETURN jsonb_build_object('id',target.id);
 END IF;
 IF action IN ('create','clone') THEN
  code_value:=upper(btrim(payload->>'code'));
  IF code_value IS NULL OR code_value !~ '^[A-Z][A-Z0-9_]{2,79}$' THEN RAISE EXCEPTION 'Invalid role code'; END IF;
 END IF;
 name_value:=btrim(payload->>'name');
 IF name_value IS NULL OR length(name_value) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid role name'; END IF;
 description_value:=CASE WHEN action='clone' THEN source.description ELSE nullif(btrim(payload->>'description'),'') END;
 IF length(description_value)>1000 THEN RAISE EXCEPTION 'Description too long'; END IF;
 IF action='clone' THEN
  SELECT coalesce(array_agg(c.code),ARRAY[]::text[]) INTO codes FROM public.eco_role_template_capabilities rc JOIN public.eco_capabilities c ON c.id=rc.capability_id WHERE rc.role_template_id=source.id AND c.is_active AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT');
 ELSE
  IF jsonb_typeof(payload->'capabilities') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'capabilities') x WHERE jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'Capability array required'; END IF;
  SELECT coalesce(array_agg(DISTINCT x),ARRAY[]::text[]) INTO codes FROM jsonb_array_elements_text(payload->'capabilities') x;
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(codes) x WHERE NOT EXISTS(SELECT 1 FROM public.eco_capabilities c WHERE c.code=x AND c.is_active AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT'))) THEN RAISE EXCEPTION 'Invalid tenant capability' USING ERRCODE='42501'; END IF;
 IF action='update' THEN
  previous:=to_jsonb(source)||jsonb_build_object('capabilities',(SELECT coalesce(jsonb_agg(c.code ORDER BY c.code),'[]') FROM public.eco_role_template_capabilities rc JOIN public.eco_capabilities c ON c.id=rc.capability_id WHERE rc.role_template_id=source.id));
  UPDATE public.eco_role_templates SET name=name_value,description=description_value,updated_at=now() WHERE id=source.id RETURNING * INTO target;
  DELETE FROM public.eco_role_template_capabilities WHERE role_template_id=target.id;
 ELSE
  INSERT INTO public.eco_role_templates(code,name,description,tier) VALUES(code_value,name_value,description_value,'ORGANIZATION') RETURNING * INTO target;
 END IF;
 INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id) SELECT target.id,c.id FROM public.eco_capabilities c WHERE c.code=ANY(codes);
 result:=to_jsonb(target)||jsonb_build_object('capabilities',to_jsonb(codes));
 INSERT INTO public.eco_access_audit(actor,action,change) VALUES(auth.uid(),CASE action WHEN 'create' THEN 'role.created' WHEN 'clone' THEN 'role.cloned' ELSE 'role.updated' END,jsonb_build_object('before',previous,'after',result,'source_role_id',CASE WHEN action='clone' THEN source.id ELSE NULL END));
 IF action='update' THEN INSERT INTO public.eco_access_audit(actor,action,change) VALUES(auth.uid(),'role.capabilities.updated',jsonb_build_object('role_id',target.id,'before',previous->'capabilities','after',to_jsonb(codes))); END IF;
 RETURN jsonb_build_object('id',target.id);
END $$;
REVOKE ALL ON FUNCTION public.core_role_admin_snapshot(),public.core_role_admin_command(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.core_role_admin_snapshot(),public.core_role_admin_command(text,uuid,jsonb) TO authenticated;

-- Serialize assignment against deactivation and record role changes without replacing Core's owner protections.
CREATE FUNCTION public.core_role_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.role_template_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.role_template_id IS DISTINCT FROM OLD.role_template_id OR (NEW.is_active AND NOT OLD.is_active)) THEN
  PERFORM 1 FROM public.eco_role_templates WHERE id=NEW.role_template_id AND tier='ORGANIZATION' AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active tenant role required' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND NEW.role_template_id IS DISTINCT FROM OLD.role_template_id AND auth.uid() IS NOT NULL THEN INSERT INTO public.eco_access_audit(actor,action,organization_id,target_membership_id,change) VALUES(auth.uid(),'member.role.changed',NEW.organization_id,NEW.id,jsonb_build_object('before',OLD.role_template_id,'after',NEW.role_template_id)); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.core_role_assignment_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER core_role_assignment_guard BEFORE INSERT OR UPDATE OF role_template_id,is_active ON public.eco_organization_members FOR EACH ROW EXECUTE FUNCTION public.core_role_assignment_guard();
CREATE OR REPLACE FUNCTION public.core_admin_read_snapshot(requested_organization_id uuid, section text)
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
    WHERE rc.role_template_id=r.id AND c.scope IN ('ORGANIZATION','OPERATIONAL_UNIT') AND c.is_active),'[]'::jsonb)) ORDER BY r.name),'[]'::jsonb)
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
COMMIT;
