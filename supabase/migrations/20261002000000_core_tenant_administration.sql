-- WP-CORE-003. Core-owned, forward-only authorization change; no business-data DML.
BEGIN;
INSERT INTO public.eco_capabilities(code,scope,description,required_module_key) VALUES
 ('banks.consolidated.view','ORGANIZATION','Ver Consolidado','bancos'),
 ('banks.summary.view','ORGANIZATION','Ver Resumen','bancos'),
 ('banks.metrics.view','ORGANIZATION','Ver Métricas','bancos'),
 ('banks.accounts.manage','ORGANIZATION','Gestionar cuentas y tarjetas','bancos'),
 ('banks.categories.manage','ORGANIZATION','Gestionar categorías y subcategorías','bancos'),
 ('banks.counterparties.manage','ORGANIZATION','Gestionar proveedores y contrapartes','bancos'),
 ('banks.rules.manage','ORGANIZATION','Gestionar y aplicar reglas','bancos'),
 ('banks.transfers.review','ORGANIZATION','Revisar pares de transferencias','bancos');
-- New grants belong to OWNER only. MANAGER and the other canonical templates are unchanged.
INSERT INTO public.eco_role_template_capabilities(role_template_id,capability_id)
 SELECT r.id,c.id FROM public.eco_role_templates r CROSS JOIN public.eco_capabilities c
 WHERE r.code='OWNER' AND c.code LIKE 'banks.%';
UPDATE public.eco_capabilities SET required_module_key='bancos'
 WHERE code LIKE 'statements.%' OR code LIKE 'financial.%' OR code='sensitivedata.banking.read';

CREATE TABLE public.eco_access_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor uuid NOT NULL,
 action text NOT NULL, organization_id uuid REFERENCES public.eco_organizations(id),
 target_membership_id uuid, change jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.eco_access_audit(organization_id,created_at DESC);
ALTER TABLE public.eco_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eco_access_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.eco_access_audit TO service_role;

CREATE FUNCTION public.core_platform_can(capability text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.eco_user_profiles p JOIN public.eco_user_platform_role a ON a.user_profile_id=p.id
 JOIN public.eco_role_templates r ON r.id=a.role_template_id
 JOIN public.eco_role_template_capabilities rc ON rc.role_template_id=r.id
 JOIN public.eco_capabilities c ON c.id=rc.capability_id
 WHERE p.auth_user_id=auth.uid() AND p.is_active AND a.is_active AND r.is_active
 AND r.code='VEGEN_PLATFORM_ADMIN' AND r.tier='PLATFORM' AND c.scope='PLATFORM' AND c.is_active AND c.code=capability);
$$;

-- Administrative reads return metadata only, never operational tables or Auth secrets.
CREATE FUNCTION public.core_admin_snapshot(requested_organization_id uuid DEFAULT NULL, platform boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF platform THEN
  IF NOT public.core_platform_can('platform.tenants.provision') THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501'; END IF;
 ELSE
  IF requested_organization_id IS NULL OR NOT (
   public.can_execute_capability_for_org(requested_organization_id,'membership.roles.assign') OR
   public.can_execute_capability_for_org(requested_organization_id,'membership.users.invite') OR
   public.can_execute_capability_for_org(requested_organization_id,'membership.users.remove') OR
   public.can_execute_capability_for_org(requested_organization_id,'org.config.write')) THEN
   RAISE EXCEPTION 'Tenant administration denied' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT jsonb_build_object(
  'organizations',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.name) FROM public.eco_organizations o WHERE platform OR o.id=requested_organization_id),'[]'),
  'members',coalesce((SELECT jsonb_agg(to_jsonb(m)||jsonb_build_object('display_name',p.display_name,'role_code',r.code)) FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id LEFT JOIN public.eco_role_templates r ON r.id=m.role_template_id WHERE m.organization_id=requested_organization_id),'[]'),
  'roles',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.eco_role_templates r WHERE r.tier='ORGANIZATION' AND r.is_active),'[]'),
  'capabilities',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.eco_capabilities c WHERE c.scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND c.is_active),'[]'),
  'role_grants',coalesce((SELECT jsonb_agg(to_jsonb(rc)) FROM public.eco_role_template_capabilities rc JOIN public.eco_role_templates r ON r.id=rc.role_template_id WHERE r.tier='ORGANIZATION'),'[]'),
  'overrides',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.eco_member_capability_overrides v WHERE v.organization_id=requested_organization_id),'[]'),
  'scopes',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.eco_membership_operational_unit_scopes s WHERE s.organization_id=requested_organization_id),'[]'),
  'units',coalesce((SELECT jsonb_agg(to_jsonb(u)) FROM public.eco_operational_units u WHERE u.organization_id=requested_organization_id),'[]'),
  'entitlements',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.eco_organization_module_entitlements e WHERE e.organization_id=requested_organization_id),'[]'),
  'audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT * FROM public.eco_access_audit WHERE organization_id=requested_organization_id ORDER BY created_at DESC LIMIT 100) a),'[]')
 ) INTO result;
 RETURN result;
END; $$;

CREATE FUNCTION public.core_admin_mutate(action text, requested_organization_id uuid, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE needed text; target public.eco_organization_members%ROWTYPE; previous jsonb;
 result jsonb; role_id uuid; cap public.eco_capabilities%ROWTYPE; unit uuid; org uuid:=requested_organization_id; grants text[];
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 IF action IN('tenant.create','tenant.active','entitlement.set') THEN
  IF NOT public.core_platform_can('platform.tenants.provision') THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501'; END IF;
 ELSE
  needed:=CASE action WHEN 'member.role' THEN 'membership.roles.assign' WHEN 'member.override' THEN 'membership.roles.assign' WHEN 'member.preset' THEN 'membership.roles.assign'
    WHEN 'member.scope' THEN 'opunit.assign_scope' WHEN 'member.active' THEN 'membership.users.remove' ELSE NULL END;
  IF needed IS NULL OR NOT public.can_execute_capability_for_org(org,needed) THEN RAISE EXCEPTION 'Tenant action denied' USING ERRCODE='42501'; END IF;
 END IF;
 IF action='tenant.create' THEN
  IF length(btrim(payload->>'name')) NOT BETWEEN 1 AND 200 OR length(btrim(payload->>'code')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Name and unique code required'; END IF;
  INSERT INTO public.eco_organizations(code,name,trade_name,country_code,currency,timezone)
   VALUES(btrim(payload->>'code'),btrim(payload->>'name'),nullif(btrim(payload->>'trade_name'),''),'ES','EUR','Europe/Madrid') RETURNING id,to_jsonb(eco_organizations.*) INTO org,result;
 ELSE
  PERFORM 1 FROM public.eco_organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable'; END IF;
  IF action='tenant.active' THEN
   SELECT to_jsonb(o) INTO previous FROM public.eco_organizations o WHERE id=org;
   UPDATE public.eco_organizations SET is_active=(payload->>'active')::boolean,updated_at=now() WHERE id=org RETURNING to_jsonb(eco_organizations.*) INTO result;
  ELSIF action='entitlement.set' THEN
   IF payload->>'module' NOT IN('bancos','ventas','compras','inventario','produccion','escandallos','personal','reporting','prediccion','documentos','integraciones') THEN RAISE EXCEPTION 'Unknown module'; END IF;
   SELECT to_jsonb(e) INTO previous FROM public.eco_organization_module_entitlements e WHERE organization_id=org AND module_key=payload->>'module';
   INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES(org,payload->>'module',(payload->>'enabled')::boolean)
   ON CONFLICT(organization_id,module_key) DO UPDATE SET is_enabled=excluded.is_enabled,updated_at=now() RETURNING to_jsonb(eco_organization_module_entitlements.*) INTO result;
  ELSE
   SELECT * INTO target FROM public.eco_organization_members WHERE id=(payload->>'membership_id')::uuid AND organization_id=org FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Membership unavailable' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM public.eco_user_profiles WHERE id=target.user_id AND auth_user_id=auth.uid()) THEN RAISE EXCEPTION 'Another authorized administrator must change your own access' USING ERRCODE='42501'; END IF;
   previous:=to_jsonb(target);
   IF action='member.preset' THEN
    grants:=ARRAY['banks.consolidated.view','sensitivedata.banking.read'];
    IF payload->>'preset'='BANKS_FULL' THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view','banks.accounts.manage','banks.categories.manage','banks.counterparties.manage','banks.rules.manage','banks.transfers.review','statements.import.upload','statements.import.process','STATEMENTS_IMPORT_CONFIRM','financial.allocation.edit','financial.reconciliation.review','financial.reconciliation.confirm'];
    ELSIF payload->>'preset'='BANKS_IMPORT' THEN grants:=grants||ARRAY['statements.import.upload','statements.import.process','STATEMENTS_IMPORT_CONFIRM'];
    ELSIF payload->>'preset'='BANKS_READ' THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view'];
    ELSIF payload->>'preset'='FINANCE_REVIEW' THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view','financial.allocation.edit','financial.reconciliation.review'];
    ELSE RAISE EXCEPTION 'Unknown preset'; END IF;
    previous:=previous||jsonb_build_object('overrides',(SELECT jsonb_agg(to_jsonb(v)) FROM public.eco_member_capability_overrides v WHERE membership_id=target.id));
    UPDATE public.eco_organization_members SET role='CONSULTANT',role_template_id=(SELECT id FROM public.eco_role_templates WHERE code='CONSULTANT' AND is_active),updated_at=now() WHERE id=target.id;
    DELETE FROM public.eco_member_capability_overrides WHERE membership_id=target.id;
    INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect)
     SELECT target.id,org,c.id,CASE WHEN c.code=ANY(grants) THEN 'GRANT' ELSE 'REVOKE' END FROM public.eco_capabilities c WHERE c.scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND c.is_active;
   ELSIF action='member.role' THEN
    SELECT id INTO role_id FROM public.eco_role_templates WHERE code=payload->>'role' AND tier='ORGANIZATION' AND is_active;
    IF role_id IS NULL THEN RAISE EXCEPTION 'Tenant role required' USING ERRCODE='42501'; END IF;
    UPDATE public.eco_organization_members SET role_template_id=role_id,role=payload->>'role',updated_at=now() WHERE id=target.id;
   ELSIF action='member.active' THEN
    UPDATE public.eco_organization_members SET is_active=(payload->>'active')::boolean,updated_at=now() WHERE id=target.id;
   ELSIF action='member.override' THEN
    SELECT * INTO cap FROM public.eco_capabilities WHERE code=payload->>'capability' AND scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND is_active;
    IF cap.id IS NULL OR coalesce(payload->>'effect','') NOT IN('GRANT','REVOKE','INHERIT') THEN RAISE EXCEPTION 'Tenant capability and effect required' USING ERRCODE='42501'; END IF;
    unit:=nullif(payload->>'unit_id','')::uuid;
    IF unit IS NOT NULL AND (cap.scope<>'OPERATIONAL_UNIT' OR NOT EXISTS(SELECT 1 FROM public.eco_operational_units WHERE id=unit AND organization_id=org AND is_active)) THEN RAISE EXCEPTION 'Invalid scope' USING ERRCODE='42501'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') INTO previous FROM public.eco_member_capability_overrides v WHERE membership_id=target.id AND capability_id=cap.id AND operational_unit_id IS NOT DISTINCT FROM unit;
    DELETE FROM public.eco_member_capability_overrides WHERE membership_id=target.id AND capability_id=cap.id AND operational_unit_id IS NOT DISTINCT FROM unit;
    IF payload->>'effect'<>'INHERIT' THEN INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect,operational_unit_id) VALUES(target.id,org,cap.id,payload->>'effect',unit); END IF;
   ELSIF action='member.scope' THEN
    IF jsonb_typeof(payload->'units') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Units required'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'units') x WHERE NOT EXISTS(SELECT 1 FROM public.eco_operational_units u WHERE u.id=x::uuid AND u.organization_id=org AND u.is_active)) THEN RAISE EXCEPTION 'Foreign or inactive unit' USING ERRCODE='42501'; END IF;
    previous:=previous||jsonb_build_object('scopes',(SELECT jsonb_agg(operational_unit_id) FROM public.eco_membership_operational_unit_scopes WHERE membership_id=target.id));
    DELETE FROM public.eco_membership_operational_unit_scopes WHERE membership_id=target.id;
    UPDATE public.eco_organization_members SET is_organization_wide=(payload->>'organization_wide')::boolean,operational_unit_id=NULL,updated_at=now() WHERE id=target.id;
    INSERT INTO public.eco_membership_operational_unit_scopes(membership_id,organization_id,operational_unit_id) SELECT target.id,org,x::uuid FROM jsonb_array_elements_text(payload->'units') x;
   END IF;
   -- Preserve a usable tenant owner, independent of platform assignments.
   IF NOT EXISTS(SELECT 1 FROM public.eco_organization_members m JOIN public.eco_role_templates r ON r.id=m.role_template_id JOIN public.eco_user_profiles p ON p.id=m.user_id WHERE m.organization_id=org AND m.is_active AND m.is_organization_wide AND p.is_active AND r.code='OWNER') THEN RAISE EXCEPTION 'At least one active organization-wide OWNER is required'; END IF;
   result:=payload;
  END IF;
 END IF;
 INSERT INTO public.eco_access_audit(actor,action,organization_id,target_membership_id,change) VALUES(auth.uid(),action,org,target.id,jsonb_build_object('before',previous,'after',result));
 RETURN jsonb_build_object('organization_id',org,'result',result);
END; $$;

-- Banks reads need both a view capability and explicit sensitive-data authority.
CREATE OR REPLACE FUNCTION public.finance_can_read(org uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.can_execute_capability_for_org(org,'sensitivedata.banking.read') AND (
 public.can_execute_capability_for_org(org,'banks.consolidated.view') OR
 public.can_execute_capability_for_org(org,'banks.summary.view') OR
 public.can_execute_capability_for_org(org,'banks.metrics.view'));
$$;
CREATE OR REPLACE FUNCTION public.finance_can_classify(org uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT public.finance_can_read(org) AND public.can_execute_capability_for_org(org,'financial.allocation.edit');
$$;
CREATE FUNCTION public.core_banks_view(requested_organization_id uuid, section text) RETURNS boolean
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF section NOT IN('consolidated','summary','metrics') OR section IS NULL OR NOT public.finance_can_read(requested_organization_id)
 OR NOT public.can_execute_capability_for_org(requested_organization_id,'banks.'||section||'.view') THEN RAISE EXCEPTION 'Banks section denied' USING ERRCODE='42501'; END IF;
 RETURN true;
END; $$;

DO $$
DECLARE t text; code text; signature text; body text; old_gate text; new_gate text;
BEGIN
 FOR t,code IN SELECT * FROM (VALUES ('eco_financial_accounts','banks.accounts.manage'),('eco_tax_categories','banks.categories.manage'),('eco_tax_subcategories','banks.categories.manage'),('eco_counterparties','banks.counterparties.manage'),('eco_classification_rules','banks.rules.manage')) v(t,c) LOOP
  EXECUTE format('DROP POLICY finance_catalog_write ON public.%I',t);
  -- Separate commands: an ALL policy would also add an unintended SELECT path.
  EXECUTE format('CREATE POLICY core_catalog_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.finance_can_read(organization_id) AND public.can_execute_capability_for_org(organization_id,%L))',t,code);
  EXECUTE format('CREATE POLICY core_catalog_update ON public.%I FOR UPDATE TO authenticated USING(public.finance_can_read(organization_id) AND public.can_execute_capability_for_org(organization_id,%L)) WITH CHECK(public.finance_can_read(organization_id) AND public.can_execute_capability_for_org(organization_id,%L))',t,code,code);
  EXECUTE format('CREATE POLICY core_catalog_delete ON public.%I FOR DELETE TO authenticated USING(public.finance_can_read(organization_id) AND public.can_execute_capability_for_org(organization_id,%L))',t,code);
 END LOOP;
 FOR signature,code IN SELECT * FROM (VALUES ('public.rpc_update_finance_account(uuid,uuid,jsonb)','banks.accounts.manage'),('public.rpc_detect_finance_transfers(uuid)','banks.transfers.review'),('public.rpc_review_finance_transfer(uuid,uuid,text)','banks.transfers.review'),('public.rpc_apply_finance_rules(uuid)','banks.rules.manage')) v(s,c) LOOP
  body:=pg_get_functiondef(signature::regprocedure);
  old_gate:=CASE WHEN code='banks.accounts.manage' THEN 'public.can_execute_capability_for_org(requested_organization_id,''STATEMENTS_IMPORT_CONFIRM'')' ELSE 'public.finance_can_classify(requested_organization_id)' END;
  new_gate:='(public.finance_can_read(requested_organization_id) AND public.can_execute_capability_for_org(requested_organization_id,'||quote_literal(code)||'))';
  IF position(old_gate IN body)=0 THEN RAISE EXCEPTION 'Unexpected Finance function contract: %',signature; END IF;
  EXECUTE replace(body,old_gate,new_gate);
 END LOOP;
END; $$;
DROP POLICY finance_tenant_read ON public.eco_finance_match_candidates;
CREATE POLICY finance_tenant_read ON public.eco_finance_match_candidates FOR SELECT TO authenticated USING(public.finance_can_read(organization_id) AND public.can_execute_capability_for_org(organization_id,'banks.transfers.review'));

CREATE FUNCTION public.core_inspect_permissions(requested_organization_id uuid, membership_id uuid, unit_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.core_admin_snapshot(requested_organization_id,false);
 IF NOT EXISTS(SELECT 1 FROM public.eco_organization_members WHERE id=membership_id AND organization_id=requested_organization_id) THEN RAISE EXCEPTION 'Membership unavailable' USING ERRCODE='42501'; END IF;
 SELECT jsonb_agg(jsonb_build_object('code',c.code,'allowed',
  m.is_active AND p.is_active AND r.is_active AND o.is_active
  AND ((c.scope='ORGANIZATION' AND unit_id IS NULL) OR (c.scope='OPERATIONAL_UNIT' AND EXISTS(SELECT 1 FROM public.eco_operational_units u WHERE u.id=unit_id AND u.organization_id=o.id AND u.is_active)))
  AND (m.is_organization_wide OR (c.scope='OPERATIONAL_UNIT' AND EXISTS(SELECT 1 FROM public.eco_membership_operational_unit_scopes s WHERE s.membership_id=m.id AND s.operational_unit_id=unit_id)))
  AND (c.required_module_key IS NULL OR EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements e WHERE e.organization_id=o.id AND e.module_key=c.required_module_key AND e.is_enabled))
  AND NOT EXISTS(SELECT 1 FROM public.eco_member_capability_overrides v WHERE v.membership_id=m.id AND v.capability_id=c.id AND v.effect='REVOKE' AND (c.scope='ORGANIZATION' OR v.operational_unit_id IS NULL OR v.operational_unit_id=unit_id))
  AND (EXISTS(SELECT 1 FROM public.eco_role_template_capabilities rc WHERE rc.role_template_id=r.id AND rc.capability_id=c.id) OR EXISTS(SELECT 1 FROM public.eco_member_capability_overrides v WHERE v.membership_id=m.id AND v.capability_id=c.id AND v.effect='GRANT' AND (v.operational_unit_id IS NULL OR (c.scope='OPERATIONAL_UNIT' AND v.operational_unit_id=unit_id)))))) INTO result
 FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id JOIN public.eco_role_templates r ON r.id=m.role_template_id JOIN public.eco_organizations o ON o.id=m.organization_id
 CROSS JOIN public.eco_capabilities c WHERE m.id=membership_id AND m.organization_id=requested_organization_id AND c.is_active AND c.scope IN('ORGANIZATION','OPERATIONAL_UNIT');
 RETURN coalesce(result,'[]');
END; $$;
REVOKE ALL ON FUNCTION public.core_inspect_permissions(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.core_inspect_permissions(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.core_platform_can(text),public.core_admin_snapshot(uuid,boolean),public.core_admin_mutate(text,uuid,jsonb),public.core_banks_view(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.core_platform_can(text),public.core_admin_snapshot(uuid,boolean),public.core_admin_mutate(text,uuid,jsonb),public.core_banks_view(uuid,text) TO authenticated;
COMMIT;
