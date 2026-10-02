-- Master-only, transaction-scoped hosted verification. Substitute __AUTH_USER_ID__
-- with a temporary user created via Auth Admin API. Never writes auth internals.
-- No function/test RPC is created. All public fixtures are rolled back, even on error.
BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT set_config('request.jwt.claim.sub','__AUTH_USER_ID__',true);
SELECT set_config('request.jwt.claims','{"sub":"__AUTH_USER_ID__","role":"authenticated"}',true);

DO $$ BEGIN
 IF (SELECT count(*) FROM public.eco_capabilities WHERE code='STATEMENTS_IMPORT_CONFIRM' AND required_module_key='bancos') <> 1
 THEN RAISE EXCEPTION 'Confirmation registry mismatch'; END IF;
 IF (SELECT array_agg(r.code ORDER BY r.code) FROM public.eco_role_template_capabilities rc
  JOIN public.eco_role_templates r ON r.id=rc.role_template_id
  JOIN public.eco_capabilities c ON c.id=rc.capability_id WHERE c.code='STATEMENTS_IMPORT_CONFIRM')
  IS DISTINCT FROM ARRAY['ADMINISTRATIVE','MANAGER','OWNER']::text[]
 THEN RAISE EXCEPTION 'Confirmation default grants mismatch'; END IF;
 IF NOT has_function_privilege('authenticated','public.can_execute_capability_for_org(uuid,text,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.can_execute_capability_for_org(uuid,text,uuid)','EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid='public.can_execute_capability_for_org(uuid,text,uuid)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')
 THEN RAISE EXCEPTION 'Function execution privileges mismatch'; END IF;
END $$;

INSERT INTO public.eco_user_profiles(id,auth_user_id,display_name)
 VALUES('30000000-0000-4000-8000-000000000001','__AUTH_USER_ID__','HORECA_TEST_CCR_ACTOR');
INSERT INTO public.eco_organizations(id,code,name) VALUES
 ('10000000-0000-4000-8000-000000000001','HORECA_TEST_CORE_A','HORECA_TEST_CORE_A'),
 ('10000000-0000-4000-8000-000000000002','HORECA_TEST_CORE_B','HORECA_TEST_CORE_B'),
 ('10000000-0000-4000-8000-000000000003','HORECA_TEST_CORE_C','HORECA_TEST_CORE_C');
INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,is_organization_wide)
 SELECT '40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',id,true FROM public.eco_role_templates WHERE code='EXTERNAL_ACCOUNTANT';
INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,is_organization_wide)
 SELECT '40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
 '30000000-0000-4000-8000-000000000001',id,true FROM public.eco_role_templates WHERE code='OWNER';
INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled)
 SELECT id,'bancos',true FROM public.eco_organizations WHERE code LIKE 'HORECA_TEST_CORE_%';
INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id)
 SELECT '30000000-0000-4000-8000-000000000001',id FROM public.eco_role_templates WHERE code='VEGEN_PLATFORM_ADMIN';
INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TEST_A','HORECA_TEST_A','LOCAL'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','TEST_B','HORECA_TEST_B','LOCAL'),
 ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','TEST_B_OTHER','HORECA_TEST_B_OTHER','LOCAL');

SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Authorized second organization denied: first-membership fallback'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000001','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Accountant without grant allowed'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000003','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Cross-org nonmember allowed'; END IF;
 IF (SELECT count(*) FROM public.eco_organizations) <> 2 THEN RAISE EXCEPTION 'Tenant SELECT RLS leak'; END IF;
 BEGIN
  UPDATE public.eco_user_profiles SET is_active=true WHERE id='30000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Browser profile write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.eco_organization_members SET is_organization_wide=true;
  RAISE EXCEPTION 'Browser membership write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.eco_role_templates(code,name,tier) VALUES('HORECA_TEST_ESCALATION','test','PLATFORM');
  RAISE EXCEPTION 'Browser registry write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- The other two approved default roles really execute the same server primitive.
UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code='MANAGER') WHERE id='40000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Manager denied'; END IF; END $$;
RESET ROLE;
UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code='ADMINISTRATIVE') WHERE id='40000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Administrative denied'; END IF; END $$;
RESET ROLE;
UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code='OWNER'),is_active=false WHERE id='40000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Inactive member allowed'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_organizations WHERE id='10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Inactive membership visible'; END IF;
END $$;
RESET ROLE;
UPDATE public.eco_organization_members SET is_active=true WHERE id='40000000-0000-4000-8000-000000000002';
UPDATE public.eco_organization_module_entitlements SET is_enabled=false WHERE organization_id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Disabled entitlement allowed'; END IF; END $$;
RESET ROLE;
UPDATE public.eco_organization_module_entitlements SET is_enabled=true WHERE organization_id='10000000-0000-4000-8000-000000000002';
INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect)
 SELECT '40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',id,'REVOKE' FROM public.eco_capabilities WHERE code='STATEMENTS_IMPORT_CONFIRM';
INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect)
 SELECT '40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',id,'GRANT' FROM public.eco_capabilities WHERE code='STATEMENTS_IMPORT_CONFIRM';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Revoke failed to override grant'; END IF; END $$;
RESET ROLE;
DELETE FROM public.eco_member_capability_overrides WHERE membership_id='40000000-0000-4000-8000-000000000002';

UPDATE public.eco_organization_members SET is_organization_wide=false WHERE id='40000000-0000-4000-8000-000000000002';
INSERT INTO public.eco_membership_operational_unit_scopes VALUES('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Unit-only confirmation allowed'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','inventory.stock.view','50000000-0000-4000-8000-000000000002') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assigned unit denied'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','inventory.stock.view','50000000-0000-4000-8000-000000000003') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Unassigned unit allowed'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','inventory.stock.view','50000000-0000-4000-8000-000000000001') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Foreign unit allowed'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_operational_units WHERE id='50000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Unassigned unit RLS leak'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.eco_membership_operational_unit_scopes VALUES('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Cross-tenant unit FK missing';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code='VEGEN_PLATFORM_ADMIN') WHERE id='40000000-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'Platform role accepted as tenant role';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
DELETE FROM public.eco_membership_operational_unit_scopes WHERE membership_id='40000000-0000-4000-8000-000000000002';
DELETE FROM public.eco_organization_members WHERE user_id='30000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.eco_user_platform_role)<>1 THEN RAISE EXCEPTION 'Platform assignment not present'; END IF;
 IF public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Platform-only user gained tenant authority'; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_organizations) THEN RAISE EXCEPTION 'Platform-only user gained tenant visibility'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.can_execute_capability_for_org('10000000-0000-4000-8000-000000000002','STATEMENTS_IMPORT_CONFIRM');
  RAISE EXCEPTION 'Anon execution allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'HOSTED_CORE_AND_CCR_ASSERTIONS_PASSED_FIXTURES_ROLLED_BACK' AS verification;
