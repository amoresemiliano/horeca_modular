-- ==============================================================================
-- TEST HARNESS: supabase/tests/00_verify_authenticated_rls.sql
-- DESCRIPTION: Reproducible Authentic PostgreSQL RLS Security Test Suite (SEC-RLS-DB-01..09)
-- AUTHOR: Antigravity / Vegen Digital
-- ENVIRONMENT: Standalone Version-Controlled SQL Security Harness
-- NOTE: Executed only via privileged database connection / test runner.
-- NEVER exposed as a public API function or RPC endpoint.
-- ==============================================================================

DO $$
DECLARE
  -- Organizations
  v_org_a_id uuid := '77777777-1111-4111-8111-111111111111';
  v_org_b_id uuid := '77777777-2222-4222-8222-222222222222';

  -- Auth Users
  v_auth_a_id uuid := '77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_auth_b_id uuid := '77777777-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_auth_scoped_id uuid := '77777777-cccc-4ccc-8ccc-111111111111';
  v_auth_inactive_id uuid := '77777777-dddd-4ddd-8ddd-222222222222';
  v_auth_unknown_id uuid := '77777777-eeee-4eee-8eee-333333333333';
  v_auth_admin_id uuid := '77777777-ffff-4fff-8fff-444444444444';

  -- User Profiles
  v_prof_a_id uuid;
  v_prof_b_id uuid;
  v_prof_scoped_id uuid;
  v_prof_inactive_id uuid;
  v_prof_unknown_id uuid;
  v_prof_admin_id uuid;

  -- Role Template ID (OWNER)
  v_owner_template_id uuid;

  -- Operational Units
  v_unit_a1_id uuid := '99999999-aaa1-4aa1-8aa1-aaaaaaaaaaa1';
  v_unit_a2_id uuid := '99999999-aaa2-4aa2-8aa2-aaaaaaaaaaa2';

  -- Counterparties (Tenant Business Records)
  v_cp_a_id uuid := '99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_cp_b_id uuid := '99999999-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  v_count integer;
  v_err_caught boolean := false;
BEGIN
  -- Get Canonical OWNER role template ID
  SELECT id INTO v_owner_template_id FROM eco_role_templates WHERE code = 'OWNER' AND is_active = true LIMIT 1;

  -- 1. FIXTURES CREATION in auth.users (trigger auto-creates eco_user_profiles)
  INSERT INTO auth.users (id, aud, role, email)
  VALUES 
    (v_auth_a_id, 'authenticated', 'authenticated', 'sec_userA@rls.test'),
    (v_auth_b_id, 'authenticated', 'authenticated', 'sec_userB@rls.test'),
    (v_auth_scoped_id, 'authenticated', 'authenticated', 'sec_userScoped@rls.test'),
    (v_auth_inactive_id, 'authenticated', 'authenticated', 'sec_userInactive@rls.test'),
    (v_auth_unknown_id, 'authenticated', 'authenticated', 'sec_userUnknown@rls.test'),
    (v_auth_admin_id, 'authenticated', 'authenticated', 'sec_platformAdmin@rls.test')
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_prof_a_id FROM eco_user_profiles WHERE auth_user_id = v_auth_a_id;
  SELECT id INTO v_prof_b_id FROM eco_user_profiles WHERE auth_user_id = v_auth_b_id;
  SELECT id INTO v_prof_scoped_id FROM eco_user_profiles WHERE auth_user_id = v_auth_scoped_id;
  SELECT id INTO v_prof_inactive_id FROM eco_user_profiles WHERE auth_user_id = v_auth_inactive_id;
  SELECT id INTO v_prof_unknown_id FROM eco_user_profiles WHERE auth_user_id = v_auth_unknown_id;
  SELECT id INTO v_prof_admin_id FROM eco_user_profiles WHERE auth_user_id = v_auth_admin_id;

  -- Set platform admin role for Platform Admin User
  UPDATE eco_user_profiles SET role = 'VEGEN_PLATFORM_ADMIN' WHERE id = v_prof_admin_id;

  -- Organizations
  INSERT INTO eco_organizations (id, name, tax_id, is_active)
  VALUES 
    (v_org_a_id, 'Test Org A Security', 'TAX_A_SEC', true),
    (v_org_b_id, 'Test Org B Security', 'TAX_B_SEC', true)
  ON CONFLICT (id) DO NOTHING;

  -- Memberships
  INSERT INTO eco_organization_members (id, organization_id, user_profile_id, user_id, role, role_template_id, is_active, is_organization_wide)
  VALUES 
    ('66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_org_a_id, v_prof_a_id, v_prof_a_id, 'OWNER', v_owner_template_id, true, true),
    ('66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb', v_org_b_id, v_prof_b_id, v_prof_b_id, 'OWNER', v_owner_template_id, true, true),
    ('66666666-cccc-4ccc-8ccc-111111111111', v_org_a_id, v_prof_scoped_id, v_prof_scoped_id, 'PRODUCTION', v_owner_template_id, true, false),
    ('66666666-dddd-4ddd-8ddd-222222222222', v_org_a_id, v_prof_inactive_id, v_prof_inactive_id, 'OWNER', v_owner_template_id, false, true),
    ('66666666-eeee-4eee-8eee-333333333333', v_org_a_id, v_prof_unknown_id, v_prof_unknown_id, 'UNKNOWN_ROLE', NULL, true, true)
  ON CONFLICT (id) DO NOTHING;

  -- Operational Units in Org A
  INSERT INTO eco_operational_units (id, organization_id, code, name, unit_type, is_active)
  VALUES 
    (v_unit_a1_id, v_org_a_id, 'OU-SEC-A1', 'Unit A1', 'LOCAL', true),
    (v_unit_a2_id, v_org_a_id, 'OU-SEC-A2', 'Unit A2', 'LOCAL', true)
  ON CONFLICT (id) DO NOTHING;

  -- Scope for User Scoped (restricted to Unit A1 only)
  INSERT INTO eco_membership_operational_unit_scopes (id, membership_id, operational_unit_id)
  VALUES ('55555555-cccc-4ccc-8ccc-111111111111', '66666666-cccc-4ccc-8ccc-111111111111', v_unit_a1_id)
  ON CONFLICT (id) DO NOTHING;

  -- Tenant Business Records (Counterparties)
  INSERT INTO eco_counterparties (id, organization_id, name)
  VALUES 
    (v_cp_a_id, v_org_a_id, 'Org A Business Record'),
    (v_cp_b_id, v_org_b_id, 'Org B Business Record')
  ON CONFLICT (id) DO NOTHING;

  -- Entitlement: Disable INVENTORY module for Org A
  INSERT INTO eco_organization_module_entitlements (id, organization_id, module_key, is_enabled)
  VALUES ('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa', v_org_a_id, 'INVENTORY', false)
  ON CONFLICT (id) DO NOTHING;

  -- ==========================================================================
  -- SEC-RLS-DB-01: Authenticated User A (Org A) Cross-Tenant SELECT Boundary
  -- ==========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_a_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Positive Control: User A CAN SELECT Org A record
  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_a_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-01 POSITIVE CONTROL FAILED'; END IF;

  -- Negative Denial: User A CANNOT SELECT Org B record
  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_b_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-01 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-01 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-02: Authenticated User A (Org A) Cross-Tenant INSERT Denial
  -- ==========================================================================
  BEGIN
    INSERT INTO eco_counterparties (id, organization_id, name)
    VALUES ('99999999-9999-4999-8999-999999999999', v_org_b_id, 'Illegal Org B Insert');
    v_err_caught := false;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'SEC-RLS-DB-02 FAILED'; END IF;

  PERFORM set_config('role', 'postgres', true);
  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = '99999999-9999-4999-8999-999999999999';
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-02 VERIFICATION FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-02 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-03: Authenticated User A (Org A) Cross-Tenant UPDATE Denial
  -- ==========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_a_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  UPDATE eco_counterparties SET name = 'Org A Business Record (Updated)' WHERE id = v_cp_a_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-03 POSITIVE CONTROL FAILED'; END IF;

  UPDATE eco_counterparties SET name = 'Org B Hacked' WHERE id = v_cp_b_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-03 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-03 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-04: Authenticated Inactive Member Access Denial
  -- ==========================================================================
  PERFORM set_config('role', 'postgres', true);
  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_a_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-04 ADMIN CONTROL FAILED'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_inactive_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_a_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-04 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-04 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-05: Authenticated User with NULL role_template_id Capability Denial
  -- ==========================================================================
  PERFORM set_config('role', 'postgres', true);
  SELECT COUNT(*) INTO v_count FROM eco_organization_members WHERE user_id = v_prof_unknown_id AND is_active = true AND role_template_id IS NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-05 ADMIN CONTROL FAILED'; END IF;

  SELECT COUNT(*) INTO v_count 
  FROM eco_organization_members m
  JOIN eco_role_template_capabilities rtc ON m.role_template_id = rtc.role_template_id
  WHERE m.user_id = v_prof_unknown_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-05 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-05 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-06: Operational Unit Scope Access Boundary
  -- ==========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_scoped_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count 
  FROM eco_membership_operational_unit_scopes s
  JOIN eco_organization_members m ON s.membership_id = m.id
  WHERE m.user_id = v_prof_scoped_id AND s.operational_unit_id = v_unit_a1_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-06 POSITIVE CONTROL FAILED'; END IF;

  SELECT COUNT(*) INTO v_count 
  FROM eco_membership_operational_unit_scopes s
  JOIN eco_organization_members m ON s.membership_id = m.id
  WHERE m.user_id = v_prof_scoped_id AND s.operational_unit_id = v_unit_a2_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-06 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-06 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-07: Disabled Module Entitlement Guard
  -- ==========================================================================
  PERFORM set_config('role', 'postgres', true);
  SELECT COUNT(*) INTO v_count FROM eco_organization_members WHERE user_id = v_prof_a_id AND role_template_id = v_owner_template_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-07 CONTROL FAILED'; END IF;

  SELECT COUNT(*) INTO v_count 
  FROM eco_organization_module_entitlements 
  WHERE organization_id = v_org_a_id AND module_key = 'INVENTORY' AND is_enabled = true;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-07 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-07 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-08: VEGEN_PLATFORM_ADMIN Without Tenant Membership Denial
  -- ==========================================================================
  PERFORM set_config('role', 'postgres', true);
  SELECT COUNT(*) INTO v_count FROM eco_user_profiles WHERE id = v_prof_admin_id AND role = 'VEGEN_PLATFORM_ADMIN';
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-08 ADMIN CONTROL FAILED'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_admin_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE organization_id = v_org_a_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-08 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-08 PASSED';

  -- ==========================================================================
  -- SEC-RLS-DB-09: Global Capability Metadata Read Does NOT Grant Tenant Access
  -- ==========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_a_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM eco_role_template_capabilities;
  IF v_count = 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-09 POSITIVE CONTROL 1 FAILED'; END IF;

  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_a_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'SEC-RLS-DB-09 POSITIVE CONTROL 2 FAILED'; END IF;

  SELECT COUNT(*) INTO v_count FROM eco_counterparties WHERE id = v_cp_b_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'SEC-RLS-DB-09 NEGATIVE DENIAL FAILED'; END IF;
  RAISE NOTICE 'SEC-RLS-DB-09 PASSED';

  -- Reset auth role back to postgres/admin for cleanup
  PERFORM set_config('role', 'postgres', true);

  -- Cleanup
  DELETE FROM eco_counterparties WHERE id IN (v_cp_a_id, v_cp_b_id, '99999999-9999-4999-8999-999999999999');
  DELETE FROM eco_organization_module_entitlements WHERE id = '55555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  DELETE FROM eco_membership_operational_unit_scopes WHERE id = '55555555-cccc-4ccc-8ccc-111111111111';
  DELETE FROM eco_operational_units WHERE id IN (v_unit_a1_id, v_unit_a2_id);
  DELETE FROM eco_organization_members WHERE organization_id IN (v_org_a_id, v_org_b_id);
  DELETE FROM eco_user_profiles WHERE id IN (v_prof_a_id, v_prof_b_id, v_prof_scoped_id, v_prof_inactive_id, v_prof_unknown_id, v_prof_admin_id);
  DELETE FROM eco_organizations WHERE id IN (v_org_a_id, v_org_b_id);
  DELETE FROM auth.users WHERE id IN (v_auth_a_id, v_auth_b_id, v_auth_scoped_id, v_auth_inactive_id, v_auth_unknown_id, v_auth_admin_id);

END $$;
