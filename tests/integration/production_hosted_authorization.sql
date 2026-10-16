-- Master-only hosted verification. All synthetic authorization state rolls back.
-- No Production facts, owner adapters or business masters are created.
BEGIN;
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE production_probe_results (name text PRIMARY KEY, result text NOT NULL);
CREATE FUNCTION pg_temp.production_gate_probe(actor uuid, org uuid, opunit uuid, capability text, expected boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual boolean;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 actual:=public.can_execute_capability_for_org(org,capability,opunit);
 EXECUTE 'RESET ROLE';
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Gate probe failed: %',label; END IF;
 INSERT INTO production_probe_results VALUES(label,'PASS');
END $$;
CREATE FUNCTION pg_temp.production_command_probe(actor uuid, request jsonb, expected text, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE error_message text; error_code text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.production_execute_command(request);
  RAISE EXCEPTION 'Unexpected command success';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS error_message=MESSAGE_TEXT,error_code=RETURNED_SQLSTATE;
  IF error_message IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Command probe failed: % (%)',label,error_code; END IF;
 END;
 EXECUTE 'RESET ROLE';
 INSERT INTO production_probe_results VALUES(label,'PASS');
END $$;
DO $$
DECLARE lab uuid:='f7f6da70-f7dc-4b1a-aa23-f5612174dcbc'; real_org uuid:='f84168ef-2b78-451b-b0a9-39c1c381e59b';
 unit_a uuid:=gen_random_uuid(); unit_b uuid:=gen_random_uuid(); actor uuid; member uuid; role_code text;
 operator_id uuid; owner_id uuid; platform_id uuid; operator_member uuid; capability text; expected boolean;
 req jsonb; item record; n integer; error_code text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.eco_organizations WHERE id=lab AND code='HORECA_DEV_LAB' AND is_active) THEN
  RAISE EXCEPTION 'Active HORECA DEV LAB required';
 END IF;
 IF EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=real_org AND module_key='produccion' AND is_enabled) THEN
  RAISE EXCEPTION 'Unexpected real tenant Production enablement';
 END IF;
 INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES
  (unit_a,lab,'PROD_AUTH_'||unit_a::text,'Rollback-only authorization unit A','PRODUCTION_CENTER'),
  (unit_b,lab,'PROD_AUTH_'||unit_b::text,'Rollback-only authorization unit B','PRODUCTION_CENTER');
 INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES(lab,'produccion',true)
 ON CONFLICT(organization_id,module_key) DO UPDATE SET is_enabled=true;
 FOREACH role_code IN ARRAY ARRAY['OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER','CONSULTANT','VEGEN_PLATFORM_ADMIN'] LOOP
  actor:=gen_random_uuid();member:=gen_random_uuid();
  INSERT INTO auth.users(id,email,aud,role) VALUES(actor,'production-auth-'||actor::text||'@example.invalid','authenticated','authenticated');
  INSERT INTO public.eco_user_profiles(id,auth_user_id,display_name) VALUES(actor,actor,'Rollback-only Production authorization probe');
  IF role_code='VEGEN_PLATFORM_ADMIN' THEN
   platform_id:=actor;
   INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id,role_tier)
    SELECT actor,id,'PLATFORM' FROM public.eco_role_templates WHERE code=role_code;
  ELSE
   INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,is_organization_wide)
    SELECT member,lab,actor,id,false FROM public.eco_role_templates WHERE code=role_code;
   INSERT INTO public.eco_membership_operational_unit_scopes(membership_id,organization_id,operational_unit_id) VALUES(member,lab,unit_a);
  END IF;
  IF role_code='PRODUCTION' THEN operator_id:=actor;operator_member:=member; END IF;
  IF role_code='OWNER' THEN owner_id:=actor; END IF;
  FOREACH capability IN ARRAY ARRAY['production.view','production.plan.manage','production.batch.log','production.batch.confirm','production.batch.correct','production.waste.log','production.waste.confirm'] LOOP
   expected:=CASE
    WHEN capability='production.view' THEN role_code<>'VEGEN_PLATFORM_ADMIN'
    WHEN capability='production.plan.manage' THEN role_code IN ('OWNER','MANAGER','COOK_COST_SHEET_MANAGER')
    WHEN capability IN ('production.batch.log','production.waste.log') THEN role_code IN ('OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER')
    ELSE role_code IN ('OWNER','MANAGER') END;
   PERFORM pg_temp.production_gate_probe(actor,lab,unit_a,capability,expected,role_code||':'||capability);
  END LOOP;
 END LOOP;
 PERFORM pg_temp.production_gate_probe(operator_id,gen_random_uuid(),unit_a,'production.view',false,'foreign_tenant');
 PERFORM pg_temp.production_gate_probe(operator_id,lab,unit_b,'production.view',false,'wrong_unit');
 PERFORM pg_temp.production_gate_probe(operator_id,lab,NULL,'production.view',false,'missing_unit');
 UPDATE public.eco_organization_members SET is_active=false WHERE id=operator_member AND organization_id=lab;
 PERFORM pg_temp.production_gate_probe(operator_id,lab,unit_a,'production.view',false,'inactive_membership');
 UPDATE public.eco_organization_members SET is_active=true WHERE id=operator_member AND organization_id=lab;
 UPDATE public.eco_user_profiles SET is_active=false WHERE id=operator_id;
 PERFORM pg_temp.production_gate_probe(operator_id,lab,unit_a,'production.view',false,'inactive_profile');
 UPDATE public.eco_user_profiles SET is_active=true WHERE id=operator_id;
 UPDATE public.eco_operational_units SET is_active=false WHERE id=unit_a AND organization_id=lab;
 PERFORM pg_temp.production_gate_probe(operator_id,lab,unit_a,'production.view',false,'inactive_unit');
 UPDATE public.eco_operational_units SET is_active=true WHERE id=unit_a AND organization_id=lab;
 INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect,operational_unit_id)
  SELECT operator_member,lab,id,effect,unit_a FROM public.eco_capabilities CROSS JOIN (VALUES('GRANT'),('REVOKE')) e(effect) WHERE code='production.batch.log';
 PERFORM pg_temp.production_gate_probe(operator_id,lab,unit_a,'production.batch.log',false,'explicit_revoke_over_grant');
 req:=jsonb_build_object('request_id',gen_random_uuid(),'organization_id',lab,'operational_unit_id',unit_a,
  'command','create_draft','entity_id',gen_random_uuid(),'expected_revision',0,'body',jsonb_build_object('mode','MANUAL_OUTPUT','effective_date','2026-10-16',
  'outputs',jsonb_build_array(jsonb_build_object('line_id',gen_random_uuid(),'product_id',gen_random_uuid(),'mode','PACKAGED','count',20,'package_id',gen_random_uuid(),'package_version',gen_random_uuid(),'destination_location_id',gen_random_uuid())),'consumptions','[]'::jsonb));
 PERFORM pg_temp.production_command_probe(operator_id,req,'PRODUCTION_ACCESS_DENIED','revoked_command_denied');
 -- All referenced IDs above are rejected by the unavailable owner adapter; none persist.
 PERFORM pg_temp.production_command_probe(owner_id,req,'OWNER_CONTRACT_UNAVAILABLE','authorized_owner_contract_fail_closed');
 DELETE FROM public.eco_member_capability_overrides WHERE membership_id=operator_member AND organization_id=lab;
 PERFORM pg_temp.production_command_probe(operator_id,req,'OWNER_CONTRACT_UNAVAILABLE','operator_log_contract_fail_closed');
 PERFORM pg_temp.production_command_probe(operator_id,req||jsonb_build_object('command','confirm_batch'),'PRODUCTION_ACCESS_DENIED','operator_confirmation_denied');
 PERFORM pg_temp.production_command_probe(platform_id,req,'PRODUCTION_ACCESS_DENIED','platform_only_command_denied');
 PERFORM pg_temp.production_command_probe(owner_id,req||jsonb_build_object('operational_unit_id',unit_b),'PRODUCTION_ACCESS_DENIED','wrong_unit_command_denied');
 PERFORM pg_temp.production_command_probe(owner_id,req||jsonb_build_object('organization_id',gen_random_uuid()),'PRODUCTION_ACCESS_DENIED','foreign_tenant_command_denied');
 UPDATE public.eco_organization_module_entitlements SET is_enabled=false WHERE organization_id=lab AND module_key='produccion';
 PERFORM pg_temp.production_gate_probe(owner_id,lab,unit_a,'production.view',false,'missing_entitlement');
 PERFORM pg_temp.production_command_probe(owner_id,req,'PRODUCTION_ACCESS_DENIED','missing_entitlement_command_denied');
 UPDATE public.eco_organization_module_entitlements SET is_enabled=true WHERE organization_id=lab AND module_key='produccion';
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'eco_production_%' LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||item.tablename)::regclass) THEN RAISE EXCEPTION 'RLS missing'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=item.tablename)<>1 OR NOT EXISTS(
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=item.tablename AND cmd='SELECT'
    AND roles=ARRAY['authenticated']::name[] AND qual='can_execute_capability_for_org(organization_id, ''production.view''::text, operational_unit_id)'
  ) THEN RAISE EXCEPTION 'Unexpected RLS policy: %',item.tablename; END IF;
  IF has_table_privilege('anon','public.'||item.tablename,'SELECT') OR has_table_privilege('authenticated','public.'||item.tablename,'INSERT,UPDATE,DELETE,TRUNCATE') THEN
   RAISE EXCEPTION 'Unexpected browser table grant: %',item.tablename;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',platform_id::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SELECT count(*) FROM public.%I',item.tablename) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Unauthorized read'; END IF;
  BEGIN
   EXECUTE format('INSERT INTO public.%I DEFAULT VALUES',item.tablename);
   RAISE EXCEPTION 'Unexpected browser write';
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS error_code=RETURNED_SQLSTATE;
   IF error_code<>'42501' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO production_probe_results VALUES('RLS_and_browser_grants:'||item.tablename,'PASS');
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.eco_production_batches) OR EXISTS(SELECT 1 FROM public.eco_production_outbox)
  OR EXISTS(SELECT 1 FROM public.eco_production_commands) THEN RAISE EXCEPTION 'Unexpected Production persistence'; END IF;
END $$;
SELECT name,result FROM production_probe_results ORDER BY name;
ROLLBACK;
