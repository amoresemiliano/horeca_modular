import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { compileBootstrap, compileVerification, migrationBundle, ATTENDANCE_CAPABILITIES } from '../../scripts/production-foundation/bootstrap.mjs';
import { navigationAllowed, MODULE_ACCESS } from '../../src/application/tenancy/accessNavigation';

const owner='10000000-0000-4000-8000-000000000001',hr='10000000-0000-4000-8000-000000000002',outsider='10000000-0000-4000-8000-000000000003';
const config={environment:'production',projectRef:'p'.repeat(20),origin:'https://personnel.example.invalid',organization:{code:'EL_CRIOLLO',name:'El Criollo',timezone:'Europe/Madrid',countryCode:'ES',currency:'EUR'},unit:{code:'PALENCIA_06',name:'Palencia 06',type:'LOCAL'},identities:{platformAdmin:{authUserId:owner,email:'owner@example.invalid'},tenantOwner:{authUserId:owner,email:'owner@example.invalid'},personnelAdmin:{authUserId:hr,email:'personnel@example.invalid'}}};
const bootstrap=()=>compileBootstrap(config).replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
describe('Clean production bootstrap with actual canonical migrations and PostgreSQL RLS',()=>{
 let db:PGlite;
 beforeAll(async()=>{
  db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
  for(const migration of migrationBundle())await db.exec(migration.sql);
 },60000);
 beforeEach(async()=>{
  await db.exec('BEGIN');await db.query('SELECT set_config($1,$2,true)',['horeca.bootstrap_project_ref',config.projectRef]);
  await db.query("INSERT INTO auth.users VALUES($1,'owner@example.invalid',now()),($2,'personnel@example.invalid',now()),($3,'outside@example.invalid',now())",[owner,hr,outsider]);
 });
 afterEach(async()=>{await db.exec('ROLLBACK');});afterAll(async()=>{await db?.close();});
 async function ids(){return (await db.query<{org:string;unit:string}>("SELECT o.id org,u.id unit FROM public.eco_organizations o JOIN public.eco_operational_units u ON u.organization_id=o.id WHERE o.code='EL_CRIOLLO'")).rows[0];}
 async function actor(id:string){await db.query('SELECT set_config($1,$2,true)',['request.jwt.claim.sub',id]);}
 async function can(org:string,cap:string,unit:string|null=null){return (await db.query<{v:boolean}>('SELECT public.can_execute_capability_for_org($1,$2,$3) v',[org,cap,unit])).rows[0].v;}
 it('bootstraps once and reruns without duplicate identities, tenants, scopes, overrides or audit',async()=>{
  const counts="SELECT (SELECT count(*) FROM auth.users) users,(SELECT count(*) FROM public.eco_organizations) organizations,(SELECT count(*) FROM public.eco_organization_members) members,(SELECT count(*) FROM public.eco_member_capability_overrides) overrides,(SELECT count(*) FROM public.eco_access_audit) audit";
  await db.exec(bootstrap());const before=await db.query(counts);
  await db.exec(bootstrap());expect((await db.query(counts)).rows).toEqual(before.rows);
  expect((await db.query('SELECT count(*)::int n FROM public.personnel_employees')).rows[0]).toEqual({n:0});
  expect((await db.query('SELECT count(*)::int n FROM public.personnel_punch_devices')).rows[0]).toEqual({n:0});
 });
 it('keeps Personnel-only authority even when every unrelated entitlement is enabled',async()=>{
  await db.exec(bootstrap());const {org,unit}=await ids();
  const grantsBefore=(await db.query('SELECT * FROM public.eco_role_template_capabilities ORDER BY 1,2')).rows;
  await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=true');await actor(hr);
  const capabilities=(await db.query<{code:string;scope:string}>("SELECT code,scope FROM public.eco_capabilities WHERE scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND is_active")).rows;
  const effective=new Map<string,boolean>();for(const cap of capabilities)effective.set(cap.code,await can(org,cap.code,cap.scope==='OPERATIONAL_UNIT'?unit:null));
  expect([...effective].filter(([,allowed])=>allowed).map(([code])=>code).sort()).toEqual([...ATTENDANCE_CAPABILITIES].sort());
  expect(Object.keys(MODULE_ACCESS).filter(module=>navigationAllowed(module,(cap:string)=>effective.get(cap)||false,()=>true))).toEqual(['Personal']);
  expect((await db.query('SELECT * FROM public.eco_role_template_capabilities ORDER BY 1,2')).rows).toEqual(grantsBefore);
  expect((await db.query<{v:boolean}>('SELECT public.personnel_admin_allowed($1,$2) v',[org,unit])).rows[0].v).toBe(true);
 });
 it('denies other organizations and foreign units, while employees have no back-office membership',async()=>{
  await db.exec(bootstrap());const {org}=await ids();
  const foreign=(await db.query<{id:string}>("INSERT INTO public.eco_organizations(code,name) VALUES('OTHER','Other') RETURNING id")).rows[0].id;
  const unit=(await db.query<{id:string}>("INSERT INTO public.eco_operational_units(organization_id,code,name,unit_type) VALUES($1,'OTHER','Other','LOCAL') RETURNING id",[foreign])).rows[0].id;
  await actor(hr);expect(await can(foreign,'personnel.employees.manage')).toBe(false);
  expect((await db.query<{v:boolean}>('SELECT public.personnel_admin_allowed($1,$2) v',[org,unit])).rows[0].v).toBe(false);
  await actor(outsider);expect(await can(org,'personnel.employees.manage')).toBe(false);
 });
 it('preserves platform authority separately from explicit tenant owner access and real RLS',async()=>{
  await db.exec(bootstrap());const {org}=await ids();await actor(owner);
  expect((await db.query<{v:boolean}>("SELECT public.core_platform_can('platform.tenants.provision') v")).rows[0].v).toBe(true);
  expect(await can(org,'personnel.employees.manage')).toBe(true);
  await actor(hr);expect((await db.query<{v:boolean}>("SELECT public.core_platform_can('platform.tenants.provision') v")).rows[0].v).toBe(false);
  await db.exec("INSERT INTO public.eco_organizations(code,name) VALUES('HIDDEN','Hidden organization')");
  await db.exec('SET LOCAL ROLE authenticated');
  const visible=(await db.query<{id:string}>('SELECT id FROM public.eco_organizations')).rows;expect(visible).toEqual([{id:org}]);
  expect((await db.query<{v:boolean}>("SELECT has_table_privilege('authenticated','public.personnel_employees','INSERT') v")).rows[0].v).toBe(false);
  expect((await db.query<{v:boolean}>("SELECT has_schema_privilege('authenticated','personnel_private','USAGE') v")).rows[0].v).toBe(false);
  expect((await db.query<{v:boolean}>("SELECT has_function_privilege('authenticated','public.personnel_device_command(text,text,text,jsonb)','EXECUTE') v")).rows[0].v).toBe(false);
  await db.exec('RESET ROLE');
 });
 it('never turns platform administration alone into implicit tenant data access',async()=>{
  const separate={...config,identities:{...config.identities,tenantOwner:{authUserId:outsider,email:'outside@example.invalid'}}};
  await db.exec(compileBootstrap(separate).replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));
  const {org,unit}=await ids();await actor(owner);
  expect((await db.query<{v:boolean}>("SELECT public.core_platform_can('platform.tenants.provision') v")).rows[0].v).toBe(true);
  expect(await can(org,'personnel.employees.manage')).toBe(false);
  expect((await db.query<{v:boolean}>('SELECT public.personnel_admin_allowed($1,$2) v',[org,unit])).rows[0].v).toBe(false);
 });
 it('requires verified target identity and refuses unconfirmed Auth bindings',async()=>{
  await db.exec("SAVEPOINT invalid_target");await db.query('SELECT set_config($1,$2,true)',['horeca.bootstrap_project_ref','vmxjqwlfwnphorthhcwu']);
  await expect(db.exec(bootstrap())).rejects.toThrow('production target');await db.exec('ROLLBACK TO invalid_target');
  await db.exec('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=\''+hr+'\'');
  await expect(db.exec(bootstrap())).rejects.toThrow('Verified production Auth identity missing');
 });
 it('does not silently repair access drift on rerun',async()=>{
  await db.exec(bootstrap());await db.exec("UPDATE public.eco_member_capability_overrides SET effect='GRANT' WHERE capability_id=(SELECT id FROM public.eco_capabilities WHERE code='reporting.operational.view')");
  await expect(db.exec(compileVerification(config))).rejects.toThrow('policy drift');
 });
});
