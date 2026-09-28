import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Executes the actual migration/function/GRANTs in embedded PostgreSQL, NOT hosted
// Supabase Auth, PostgREST or Finance RLS. auth.uid() is a test-only JWT-setting stub.
describe('CCR-FIN-001 embedded PostgreSQL authorization', () => {
  let db: PGlite;
  const orgA = '10000000-0000-0000-0000-000000000001';
  const orgB = '10000000-0000-0000-0000-000000000002';
  const actor = '20000000-0000-0000-0000-000000000001';
  const profile = '30000000-0000-0000-0000-000000000001';
  const member = '40000000-0000-0000-0000-000000000001';
  const unit = '50000000-0000-0000-0000-000000000001';
  const gate = 'STATEMENTS_IMPORT_CONFIRM';
  const migration = readFileSync('supabase/migrations/20260927000000_ccr_fin_001_core_authorization.sql', 'utf8');
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync('tests/fixtures/core/ccr_fin_001_schema.sql', 'utf8'));
    await db.exec(migration);
    // Verify the migration can be replayed without duplicate registry entries/grants.
    await db.exec(migration);
  }, 60000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec('BEGIN');
    await db.query('INSERT INTO public.eco_organizations(id) VALUES ($1), ($2)', [orgA, orgB]);
    await db.query('INSERT INTO public.eco_user_profiles(id,auth_user_id) VALUES ($1,$2)', [profile, actor]);
    await db.query(`INSERT INTO public.eco_organization_members(id,organization_id,user_profile_id,user_id,role_template_id)
      SELECT $1,$2,$3,$3,id FROM public.eco_role_templates WHERE code='OWNER'`, [member, orgA, profile]);
    await db.query("INSERT INTO public.eco_organization_module_entitlements VALUES ($1,'bancos',true),($2,'bancos',true)", [orgA, orgB]);
    await db.query('INSERT INTO public.eco_operational_units VALUES ($1,$2,true)', [unit, orgA]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [actor]);
  });
  afterEach(async () => { await db.exec('ROLLBACK'); });
  async function allowed(org: string | null = orgA, capability: string | null = gate, opUnit: string | null = null) {
    await db.exec('SET LOCAL ROLE authenticated');
    const result = await db.query<{ allowed: boolean }>('SELECT public.can_execute_capability_for_org($1,$2,$3) AS allowed', [org, capability, opUnit]);
    await db.exec('RESET ROLE');
    return result.rows[0].allowed;
  }
  async function role(code: string) {
    await db.query('UPDATE public.eco_organization_members SET role_template_id=(SELECT id FROM public.eco_role_templates WHERE code=$1)', [code]);
  }
  async function override(effect: string, opUnit: string | null = null) {
    await db.query(`INSERT INTO public.eco_member_capability_overrides(membership_id,capability_id,effect,operational_unit_id)
      SELECT $1,id,$2,$3 FROM public.eco_capabilities WHERE code=$4`, [member, effect, opUnit, gate]);
  }
  it.each(['OWNER', 'MANAGER', 'ADMINISTRATIVE'])('%s has the explicit default confirmation grant', async code => {
    await role(code); expect(await allowed()).toBe(true);
  });
  it.each(['EXTERNAL_ACCOUNTANT', 'CONSULTANT', 'VEGEN_PLATFORM_ADMIN', 'HOLDING_OWNER', 'HOLDING_ADMIN', 'PURCHASING', 'RECEPTION_FLOOR', 'PRODUCTION', 'COOK_COST_SHEET_MANAGER', 'HR_PERSONNEL'])('%s has no default confirmation grant', async code => {
    await role(code); expect(await allowed()).toBe(false);
  });
  it('applies an explicit organization grant to an active membership', async () => {
    await role('EXTERNAL_ACCOUNTANT'); await override('GRANT'); expect(await allowed()).toBe(true);
  });
  it('explicit revoke wins over default and explicit grants, regardless of insertion order', async () => {
    await override('REVOKE'); await override('GRANT'); expect(await allowed()).toBe(false);
  });
  it('a unit-specific revoke blocks the whole-organization confirmation', async () => {
    await override('REVOKE', unit); expect(await allowed()).toBe(false);
  });
  it('a unit-specific grant cannot authorize a whole-organization confirmation', async () => {
    await role('EXTERNAL_ACCOUNTANT'); await override('GRANT', unit); expect(await allowed()).toBe(false);
  });
  it('Org A membership cannot confirm Org B', async () => { expect(await allowed(orgB)).toBe(false); });
  it('authorizes the supplied second organization without a first-membership helper', async () => {
    await db.query(`INSERT INTO public.eco_organization_members(id,organization_id,user_profile_id,user_id,role_template_id)
      SELECT '40000000-0000-0000-0000-000000000002',$1,$2,$2,id FROM public.eco_role_templates WHERE code='MANAGER'`, [orgB, profile]);
    expect(await allowed(orgB)).toBe(true);
  });
  it('platform role without tenant membership grants no access', async () => {
    await role('VEGEN_PLATFORM_ADMIN'); await db.exec('DELETE FROM public.eco_organization_members');
    expect(await allowed()).toBe(false);
  });
  it.each(['eco_organization_members', 'eco_user_profiles', 'eco_organizations', 'eco_role_templates', 'eco_capabilities'])('inactive %s denies', async table => {
    await db.exec(`UPDATE public.${table} SET is_active=false`); expect(await allowed()).toBe(false);
  });
  it('unknown/absent role templates deny even with an explicit grant', async () => {
    await db.exec('UPDATE public.eco_organization_members SET role_template_id=NULL');
    await override('GRANT'); expect(await allowed()).toBe(false);
  });
  it('missing or disabled Finance entitlement denies', async () => {
    await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=false');
    expect(await allowed()).toBe(false);
    await db.exec('DELETE FROM public.eco_organization_module_entitlements');
    expect(await allowed()).toBe(false);
  });
  it('unit-scoped membership cannot confirm an organization bank import', async () => {
    await db.exec('UPDATE public.eco_organization_members SET is_organization_wide=false');
    await db.query('INSERT INTO public.eco_membership_operational_unit_scopes VALUES ($1,$2)', [member, unit]);
    expect(await allowed()).toBe(false); expect(await allowed(orgA, gate, unit)).toBe(false);
  });
  it('anonymous or unrecognized subjects deny', async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)"); expect(await allowed()).toBe(false);
    await db.query("SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000099',true)"); expect(await allowed()).toBe(false);
  });
  it('unknown capabilities and missing organizations deny', async () => {
    expect(await allowed(orgA, 'CONFIRM_BANK_STATEMENT_IMPORT')).toBe(false);
    expect(await allowed(orgA, null)).toBe(false); expect(await allowed(null)).toBe(false);
    expect(await allowed('10000000-0000-0000-0000-000000000099')).toBe(false);
  });
  it.each(['BANK_IMPORT', 'STATEMENTS_IMPORT_UPLOAD', 'STATEMENTS_IMPORT_PROCESS', 'CONFIRM_RECONCILIATION'])('%s never implies import confirmation', async code => {
    await role('CONSULTANT');
    await db.query("INSERT INTO public.eco_capabilities(code,scope) VALUES ($1,'ORGANIZATION')", [code]);
    await db.query(`INSERT INTO public.eco_role_template_capabilities SELECT r.id,c.id FROM public.eco_role_templates r,
      public.eco_capabilities c WHERE r.code='CONSULTANT' AND c.code=$1`, [code]);
    expect(await allowed(orgA, code)).toBe(true); expect(await allowed()).toBe(false);
  });
  it('has a fixed safe search_path and restricts invocation to authenticated callers', async () => {
    const { rows } = await db.query<{ prosecdef: boolean; proconfig: string[] }>("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.can_execute_capability_for_org(uuid,text,uuid)'::regprocedure");
    expect(rows[0].prosecdef).toBe(true); expect(rows[0].proconfig).toContain('search_path=pg_catalog');
    await db.exec('SET LOCAL ROLE anon');
    await expect(db.query('SELECT public.can_execute_capability_for_org($1,$2)', [orgA, gate])).rejects.toThrow(/permission denied/);
  });
  it('can be called from a trusted operation while retaining the authenticated subject', async () => {
    await db.exec(`CREATE FUNCTION public.horeca_test_trusted_operation(org uuid) RETURNS boolean
      LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
        SELECT public.can_execute_capability_for_org(org,'STATEMENTS_IMPORT_CONFIRM'); $$;
      GRANT EXECUTE ON FUNCTION public.horeca_test_trusted_operation(uuid) TO authenticated;
      SET LOCAL ROLE authenticated`);
    const { rows } = await db.query<{ allowed: boolean }>('SELECT public.horeca_test_trusted_operation($1) AS allowed', [orgB]);
    expect(rows[0].allowed).toBe(false);
  });
  it('blocks role and identity self-escalation through legacy browser policies while preserving reads', async () => {
    await role('CONSULTANT');
    const owner = await db.query<{ id: string }>("SELECT id FROM public.eco_role_templates WHERE code='OWNER'");
    await db.exec('SET LOCAL ROLE authenticated');
    const updated = await db.query('UPDATE public.eco_organization_members SET role_template_id=$1 RETURNING id', [owner.rows[0].id]);
    expect(updated.rows).toHaveLength(0);
    const profileUpdate = await db.query('UPDATE public.eco_user_profiles SET is_active=true RETURNING id');
    expect(profileUpdate.rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM public.eco_organization_members')).rows).toHaveLength(1);
    expect((await db.query('DELETE FROM public.eco_organization_members RETURNING id')).rows).toHaveLength(0);
    await db.exec('RESET ROLE');
    expect(await allowed()).toBe(false);
  });
  it('blocks browser creation of an authorization profile', async () => {
    await db.exec('SET LOCAL ROLE authenticated');
    await expect(db.query('INSERT INTO public.eco_user_profiles(id,auth_user_id) VALUES ($1,$2)',
      ['30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000099'])).rejects.toThrow(/row-level security/);
  });
  it('blocks browser creation of a membership in another organization', async () => {
    const owner = await db.query<{ id: string }>("SELECT id FROM public.eco_role_templates WHERE code='OWNER'");
    await db.exec('SET LOCAL ROLE authenticated');
    await expect(db.query(`INSERT INTO public.eco_organization_members(id,organization_id,user_profile_id,user_id,role_template_id)
      VALUES ('40000000-0000-0000-0000-000000000099',$1,$2,$2,$3)`, [orgB, profile, owner.rows[0].id])).rejects.toThrow(/row-level security/);
  });
  it('executes the read-only Finance metadata audit even when business tables are absent', async () => {
    const results = await db.exec(readFileSync('supabase/audits/ccr_fin_001_finance_schema.sql', 'utf8'));
    expect(results[0].rows).toHaveLength(10);
    expect(results[0].rows.every(row => (row as { exists_in_database: boolean }).exists_in_database === false)).toBe(true);
  });
  it('supports operational-unit capabilities without allowing a foreign or inactive unit', async () => {
    await db.exec("INSERT INTO public.eco_capabilities(code,scope,required_module_key) VALUES ('HORECA_TEST_UNIT','OPERATIONAL_UNIT','bancos')");
    await db.exec("INSERT INTO public.eco_role_template_capabilities SELECT r.id,c.id FROM public.eco_role_templates r,public.eco_capabilities c WHERE r.code='OWNER' AND c.code='HORECA_TEST_UNIT'");
    expect(await allowed(orgA, 'HORECA_TEST_UNIT', unit)).toBe(true);
    expect(await allowed(orgA, 'HORECA_TEST_UNIT')).toBe(false);
    await db.exec('UPDATE public.eco_organization_members SET is_organization_wide=false');
    expect(await allowed(orgA, 'HORECA_TEST_UNIT', unit)).toBe(false);
    await db.query('INSERT INTO public.eco_membership_operational_unit_scopes VALUES ($1,$2)', [member, unit]);
    expect(await allowed(orgA, 'HORECA_TEST_UNIT', unit)).toBe(true);
    await db.query('UPDATE public.eco_operational_units SET organization_id=$1', [orgB]);
    expect(await allowed(orgA, 'HORECA_TEST_UNIT', unit)).toBe(false);
  });
});
