import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { DEFAULT_ROLE_CAPABILITIES, RoleTemplate } from '../../src/domain/tenancy/authorization/roles';

describe('Consolidated HORECA baseline in embedded PostgreSQL (not hosted Auth)', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    // Empty Auth contract stub only. Never insert or update auth.users.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE public.categorias(id int PRIMARY KEY, name text);
      INSERT INTO public.categorias VALUES(1,'HORECA legacy sentinel');`);
    await db.exec(readFileSync('supabase/migrations/20260926000000_horeca_core_baseline.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20260927000000_ccr_fin_001_core_authorization.sql','utf8'));
  }, 60000);
  afterAll(async () => { await db?.close(); });

  it('preserves a pre-existing operational table and its contents', async () => {
    expect((await db.query('SELECT * FROM public.categorias')).rows).toEqual([{id:1,name:'HORECA legacy sentinel'}]);
  });
  it('matches the exact current canonical wire registry and role defaults', async () => {
    const caps = await db.query<{code:string}>('SELECT code FROM public.eco_capabilities');
    expect(caps.rows.map(r=>r.code).sort()).toEqual(Object.values(Capability).sort());
    const roles = await db.query<{code:string}>('SELECT code FROM public.eco_role_templates');
    expect(roles.rows.map(r=>r.code).sort()).toEqual(Object.values(RoleTemplate).sort());
    for (const role of Object.values(RoleTemplate)) {
      const rows = await db.query<{code:string}>(`SELECT c.code FROM public.eco_role_template_capabilities rc
        JOIN public.eco_role_templates r ON r.id=rc.role_template_id
        JOIN public.eco_capabilities c ON c.id=rc.capability_id WHERE r.code=$1`, [role]);
      expect(rows.rows.map(r=>r.code).sort(),role).toEqual([...DEFAULT_ROLE_CAPABILITIES[role]].sort());
    }
  });
  it('enables RLS, PKs and SELECT-only browser access on every Core relation', async () => {
    const rows = await db.query<{relname:string;relrowsecurity:boolean;pk:boolean;browser_write:boolean}>(`
      SELECT c.relname,c.relrowsecurity,
        EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='p') AS pk,
        has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS browser_write
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'eco_%'`);
    expect(rows.rows).toHaveLength(11);
    for (const r of rows.rows) {
      expect(r.relrowsecurity,r.relname).toBe(true);
      expect(r.pk,r.relname).toBe(true);
      expect(r.browser_write,r.relname).toBe(false);
    }
  });
  it('seeds no identities, tenants, memberships or entitlements', async () => {
    for (const table of ['eco_user_profiles','eco_organizations','eco_organization_members','eco_organization_module_entitlements']) {
      expect((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n).toBe(0);
    }
  });
  it('denies tenant authorization and visibility to an unknown authenticated subject', async () => {
    await db.exec(`BEGIN; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);`);
    try {
      expect((await db.query<{allowed:boolean}>(`SELECT public.can_execute_capability_for_org(
        '10000000-0000-0000-0000-000000000001','STATEMENTS_IMPORT_CONFIRM') AS allowed`)).rows[0].allowed).toBe(false);
      expect((await db.query('SELECT * FROM public.eco_organizations')).rows).toHaveLength(0);
    } finally { await db.exec('ROLLBACK'); }
  });
  it('retains a real Auth FK instead of permitting synthetic orphan identities', async () => {
    await expect(db.exec(`INSERT INTO public.eco_user_profiles(auth_user_id)
      VALUES('20000000-0000-0000-0000-000000000001')`)).rejects.toThrow(/foreign key/);
  });
});
