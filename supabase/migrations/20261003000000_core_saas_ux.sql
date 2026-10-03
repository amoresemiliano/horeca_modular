-- Core SaaS UX closure. Forward-only metadata change; no operational data DML.
BEGIN;
ALTER TABLE public.eco_organizations ADD COLUMN business_address text,
 ADD COLUMN contact_email text, ADD COLUMN contact_phone text;

CREATE FUNCTION public.core_write_tenant_metadata(action text, org uuid, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old_row public.eco_organizations%ROWTYPE; next_row public.eco_organizations%ROWTYPE;
 previous jsonb; result jsonb; key text; value jsonb;
BEGIN
 IF auth.uid() IS NULL OR action NOT IN('tenant.create','tenant.update') OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
 OR NOT (public.core_platform_can('platform.tenants.provision') OR (action='tenant.update' AND public.can_execute_capability_for_org(org,'org.config.write'))) THEN
  RAISE EXCEPTION 'Tenant metadata denied' USING ERRCODE='42501'; END IF;
 FOR key,value IN SELECT * FROM jsonb_each(payload) LOOP
  IF key NOT IN('code','name','trade_name','legal_name','tax_id','tax_id_type','business_address','country_code','currency','timezone','contact_email','contact_phone')
   OR jsonb_typeof(value) NOT IN('string','null') THEN RAISE EXCEPTION 'Unknown or invalid tenant field: %',key; END IF;
  IF length(value#>>'{}')>(CASE WHEN key='business_address' THEN 1000 ELSE 200 END) THEN RAISE EXCEPTION 'Tenant field too long: %',key; END IF;
 END LOOP;
 IF action='tenant.update' THEN
  SELECT * INTO old_row FROM public.eco_organizations WHERE id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable'; END IF;
  previous:=to_jsonb(old_row);
 ELSE
  old_row.country_code:='ES'; old_row.currency:='EUR'; old_row.timezone:='Europe/Madrid'; old_row.tax_id_type:='CIF';
 END IF;
 SELECT * INTO next_row FROM jsonb_populate_record(old_row,payload);
 next_row.code:=btrim(next_row.code);next_row.name:=btrim(next_row.name);
 IF coalesce(length(next_row.name),0) NOT BETWEEN 1 AND 200 OR coalesce(length(next_row.code),0) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Name and unique code required'; END IF;
 IF next_row.country_code IS NULL OR next_row.country_code !~ '^[A-Z]{2}$' OR next_row.currency IS NULL OR next_row.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Country and currency codes required'; END IF;
 IF next_row.tax_id_type IS NULL OR next_row.tax_id_type NOT IN('CIF','NIF','NIE','VAT','OTHER') THEN RAISE EXCEPTION 'Invalid tax-id type'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=next_row.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 IF nullif(btrim(next_row.contact_email),'') IS NOT NULL AND next_row.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid contact email'; END IF;
 IF action='tenant.create' THEN
  INSERT INTO public.eco_organizations(code,name,trade_name,legal_name,tax_id,tax_id_type,business_address,country_code,currency,timezone,contact_email,contact_phone)
  VALUES(next_row.code,next_row.name,nullif(btrim(next_row.trade_name),''),nullif(btrim(next_row.legal_name),''),nullif(btrim(next_row.tax_id),''),next_row.tax_id_type,nullif(btrim(next_row.business_address),''),next_row.country_code,next_row.currency,next_row.timezone,nullif(btrim(next_row.contact_email),''),nullif(btrim(next_row.contact_phone),'')) RETURNING id,to_jsonb(eco_organizations.*) INTO org,result;
 ELSE
  UPDATE public.eco_organizations SET code=next_row.code,name=next_row.name,trade_name=nullif(btrim(next_row.trade_name),''),legal_name=nullif(btrim(next_row.legal_name),''),tax_id=nullif(btrim(next_row.tax_id),''),tax_id_type=next_row.tax_id_type,business_address=nullif(btrim(next_row.business_address),''),country_code=next_row.country_code,currency=next_row.currency,timezone=next_row.timezone,contact_email=nullif(btrim(next_row.contact_email),''),contact_phone=nullif(btrim(next_row.contact_phone),''),updated_at=now() WHERE id=org RETURNING to_jsonb(eco_organizations.*) INTO result;
 END IF;
 INSERT INTO public.eco_access_audit(actor,action,organization_id,change) VALUES(auth.uid(),action,org,jsonb_build_object('before',previous,'after',result));
 RETURN jsonb_build_object('organization_id',org,'result',result);
END; $$;
REVOKE ALL ON FUNCTION public.core_write_tenant_metadata(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.core_admin_mutate(action text, requested_organization_id uuid, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE needed text; target public.eco_organization_members%ROWTYPE; previous jsonb;
 result jsonb; role_id uuid; cap public.eco_capabilities%ROWTYPE; unit uuid; org uuid:=requested_organization_id; grants text[];
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 IF action IN('tenant.create','tenant.active','entitlement.set') THEN
  IF NOT public.core_platform_can('platform.tenants.provision') THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501'; END IF;
 ELSE
  needed:=CASE action WHEN 'tenant.update' THEN 'org.config.write' WHEN 'member.role' THEN 'membership.roles.assign' WHEN 'member.override' THEN 'membership.roles.assign' WHEN 'member.preset' THEN 'membership.roles.assign'
    WHEN 'member.scope' THEN 'opunit.assign_scope' WHEN 'member.active' THEN 'membership.users.remove' ELSE NULL END;
  IF needed IS NULL OR NOT (public.can_execute_capability_for_org(org,needed) OR (action='tenant.update' AND public.core_platform_can('platform.tenants.provision'))) THEN RAISE EXCEPTION 'Tenant action denied' USING ERRCODE='42501'; END IF;
 END IF;
 IF action IN('tenant.create','tenant.update') THEN
  RETURN public.core_write_tenant_metadata(action,org,payload);
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
    IF payload->>'preset' IN('BANKS_FULL','BANKS_ADMIN') THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view','banks.accounts.manage','banks.categories.manage','banks.counterparties.manage','banks.rules.manage','banks.transfers.review','statements.import.upload','statements.import.process','STATEMENTS_IMPORT_CONFIRM','financial.allocation.edit','financial.reconciliation.review','financial.reconciliation.confirm'];
    ELSIF payload->>'preset' IN('BANKS_IMPORT','BANKS_IMPORT_OPERATOR') THEN grants:=grants||ARRAY['statements.import.upload','statements.import.process','STATEMENTS_IMPORT_CONFIRM'];
    ELSIF payload->>'preset' IN('BANKS_READ','BANKS_VIEWER') THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view'];
    ELSIF payload->>'preset'='BANKS_RECONCILIATION_OPERATOR' THEN grants:=grants||ARRAY['banks.summary.view','banks.metrics.view','financial.allocation.edit','financial.reconciliation.review','financial.reconciliation.confirm'];
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


CREATE OR REPLACE FUNCTION public.core_admin_snapshot(requested_organization_id uuid DEFAULT NULL, platform boolean DEFAULT false)
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
  'audit',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('actor_name',(SELECT p.display_name FROM public.eco_user_profiles p WHERE p.auth_user_id=a.actor),'target_name',(SELECT p.display_name FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id WHERE m.id=a.target_membership_id AND m.organization_id=requested_organization_id))) FROM (SELECT * FROM public.eco_access_audit WHERE organization_id=requested_organization_id ORDER BY created_at DESC LIMIT 100) a),'[]')
 ) INTO result;
 RETURN result;
END; $$;


COMMIT;
