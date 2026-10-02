import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { DEFAULT_ROLE_CAPABILITIES, RoleTemplate } from '../../src/domain/tenancy/authorization/roles';
import { ACCESS_PRESETS } from '../../src/application/tenancy/accessNavigation';

const org='10000000-0000-4000-8000-000000000001', foreign='10000000-0000-4000-8000-000000000002';
const owner='20000000-0000-4000-8000-000000000001', user='20000000-0000-4000-8000-000000000002', platform='20000000-0000-4000-8000-000000000003';
const ownerMember='40000000-0000-4000-8000-000000000001', userMember='40000000-0000-4000-8000-000000000002';
describe('WP-CORE-003 complete migration chain: embedded PostgreSQL, real roles/RLS',()=>{
 let db:PGlite;
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE SCHEMA test_auth; CREATE TABLE test_auth.identities(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA auth TO authenticated,anon;
   CREATE TABLE public.empleados(id integer PRIMARY KEY,name text); INSERT INTO public.empleados VALUES(1,'Preserved legacy row'); GRANT ALL ON public.empleados TO authenticated;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('REFERENCES auth.users(id)','REFERENCES test_auth.identities(id)'));
 },60000);
 afterAll(async()=>{await db?.close()});
 beforeEach(async()=>{
  await db.exec('BEGIN');
  for(const id of [owner,user,platform]){
   await db.query('INSERT INTO test_auth.identities VALUES($1)',[id]);
   await db.query('INSERT INTO public.eco_user_profiles(id,auth_user_id,display_name) VALUES($1,$1,$2)',[id,'Synthetic']);
  }
  await db.query("INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'A','A'),($2,'B','B')",[org,foreign]);
  await db.query("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'bancos',true),($2,'bancos',true)",[org,foreign]);
  await db.query("INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,role,is_organization_wide) SELECT $1,$2,$3,id,'OWNER',true FROM public.eco_role_templates WHERE code='OWNER'",[ownerMember,org,owner]);
  await db.query("INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,role,is_organization_wide) SELECT $1,$2,$3,id,'CONSULTANT',true FROM public.eco_role_templates WHERE code='CONSULTANT'",[userMember,org,user]);
  await db.query("INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id) SELECT $1,id FROM public.eco_role_templates WHERE code='VEGEN_PLATFORM_ADMIN'",[platform]);
 });
 afterEach(async()=>{await db.exec('ROLLBACK')});
 async function call(actor:string,sql:string,args:unknown[]=[],role='authenticated'){
  await db.exec('SAVEPOINT request');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);
  await db.exec('SET LOCAL ROLE '+role);
  try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('RESET ROLE; RELEASE SAVEPOINT request');return r.rows}
  catch(e){await db.exec('ROLLBACK TO SAVEPOINT request; RELEASE SAVEPOINT request');throw e}
 }
 const mutate=(actor:string,action:string,payload:object,organization=org)=>call(actor,'SELECT public.core_admin_mutate($1,$2,$3::jsonb) result',[action,organization,JSON.stringify(payload)]);
 const allowed=async(actor:string,code:string,organization=org)=>(await call(actor,'SELECT public.can_execute_capability_for_org($1,$2) allowed',[organization,code]))[0].allowed;
 const preset=(key:string)=>mutate(owner,'member.preset',{membership_id:userMember,preset:key});
 it('matches all 13 canonical templates and the current capability registry without broadening MANAGER',async()=>{
  expect((await db.query<{code:string}>('SELECT code FROM public.eco_capabilities')).rows.map(r=>r.code).sort()).toEqual(Object.values(Capability).sort());
  expect((await db.query<{code:string}>('SELECT code FROM public.eco_role_templates')).rows.map(r=>r.code).sort()).toEqual(Object.values(RoleTemplate).sort());
  for(const role of Object.values(RoleTemplate)) expect((await db.query<{code:string}>('SELECT c.code FROM public.eco_role_template_capabilities rc JOIN public.eco_capabilities c ON c.id=rc.capability_id JOIN public.eco_role_templates r ON r.id=rc.role_template_id WHERE r.code=$1',[role])).rows.map(r=>r.code).sort()).toEqual([...DEFAULT_ROLE_CAPABILITIES[role]].sort());
 });
 it('platform-only identity manages tenant metadata but receives zero business rows and cannot classify',async()=>{
  expect((await call(platform,"SELECT public.core_platform_can('platform.tenants.provision') allowed"))[0].allowed).toBe(true);
  const snap=(await call(platform,'SELECT public.core_admin_snapshot(NULL,true) result'))[0].result as {organizations:unknown[]};expect(snap.organizations).toHaveLength(2);
  expect(await allowed(platform,'banks.consolidated.view')).toBe(false);
  expect(await call(platform,'SELECT * FROM public.eco_financial_movements')).toHaveLength(0);
  await expect(call(platform,'SELECT public.rpc_detect_finance_transfers($1)',[org])).rejects.toThrow(/denied/);
  await expect(call(platform,'SELECT public.core_admin_snapshot($1,false)',[org])).rejects.toThrow(/denied/);
  await mutate(platform,'tenant.create',{code:'C',name:'Canonical C'});
  await mutate(platform,'entitlement.set',{module:'bancos',enabled:false});
  expect(await allowed(owner,'banks.consolidated.view')).toBe(false);
 });
 it('tenant owner cannot gain platform authority or assign platform roles/capabilities',async()=>{
  await expect(mutate(owner,'tenant.create',{code:'X',name:'X'})).rejects.toThrow(/denied/);
  await expect(mutate(owner,'member.role',{membership_id:userMember,role:'VEGEN_PLATFORM_ADMIN'})).rejects.toThrow(/Tenant role/);
  await expect(mutate(owner,'member.override',{membership_id:userMember,capability:'platform.tenants.provision',effect:'GRANT'})).rejects.toThrow(/Tenant capability/);
  await expect(mutate(owner,'member.role',{membership_id:ownerMember,role:'CONSULTANT'})).rejects.toThrow(/own access/);
 });
 it.each(Object.keys(ACCESS_PRESETS))('applies %s atomically and exactly, denying unrelated capabilities',async key=>{
  await preset(key);
  const expected=ACCESS_PRESETS[key as keyof typeof ACCESS_PRESETS].grants;
  for(const c of Object.values(Capability)) expect(await allowed(user,c),c).toBe(expected.includes(c));
  expect(await allowed(user,'banks.consolidated.view',foreign)).toBe(false);
  const audit=await db.query<{n:number}>('SELECT count(*)::int n FROM public.eco_access_audit');expect(audit.rows[0].n).toBe(1);
 });
 it('import profile can confirm banking facts but cannot mutate catalogs, classify, split, rules or transfers',async()=>{
  await preset('BANKS_IMPORT');
  const account=(await db.query<{id:string}>("INSERT INTO public.eco_financial_accounts(organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,'A','A','BBVA','BANK_ACCOUNT','0000') RETURNING id",[org])).rows[0].id;
  const row={bookingDate:'2026-01-01',valueDate:null,description:'Synthetic',amount:'-10.00',currency:'EUR',direction:'DEBIT',runningBalance:null,sourceRowNumber:1,bankNativeId:null,externalReference:null};
  await call(user,'SELECT public.rpc_confirm_bank_statement_import($1,$2,$3,$4,$5::jsonb)',[org,account,'a'.repeat(64),'BBVA_ACCOUNT',JSON.stringify([row])]);
  expect(await call(user,'SELECT * FROM public.eco_financial_movements')).toHaveLength(1);
  await expect(call(user,"SELECT public.core_banks_view($1,'summary')",[org])).rejects.toThrow(/denied/);
  await expect(call(user,"SELECT public.core_banks_view($1,'metrics')",[org])).rejects.toThrow(/denied/);
  expect((await call(user,"SELECT public.core_banks_view($1,'consolidated') allowed",[org]))[0].allowed).toBe(true);
  for(const sql of ['SELECT public.rpc_detect_finance_transfers($1)','SELECT public.rpc_apply_finance_rules($1)',"SELECT public.rpc_update_bank_allocation($1,gen_random_uuid(),'{}')","SELECT public.rpc_split_bank_movement($1,gen_random_uuid(),'[]')","SELECT public.rpc_review_finance_transfer($1,gen_random_uuid(),'CONFIRMED')","SELECT public.rpc_update_finance_account($1,gen_random_uuid(),'{}')","SELECT public.rpc_finance_reconcile($1,gen_random_uuid(),gen_random_uuid(),'INTERNAL_TRANSFER')"])
   await expect(call(user,sql,[org])).rejects.toThrow(/denied/);
  await expect(call(user,"INSERT INTO public.eco_tax_categories(organization_id,name,type) VALUES($1,'Denied','GASTO')",[org])).rejects.toThrow(/policy/);
  await expect(call(user,"INSERT INTO public.eco_financial_accounts(organization_id,code,name,institution,product_type,masked_identifier) VALUES($1,'NO','NO','BBVA','BANK_ACCOUNT','0000')",[org])).rejects.toThrow(/policy/);
 });
 it('denies foreign admin reads/mutations and direct browser privileged writes',async()=>{
  await expect(call(owner,'SELECT public.core_admin_snapshot($1,false)',[foreign])).rejects.toThrow(/denied/);
  await expect(mutate(owner,'member.active',{membership_id:userMember,active:false},foreign)).rejects.toThrow(/denied/);
  expect(await call(user,'SELECT * FROM public.eco_organization_members WHERE organization_id=$1',[foreign])).toHaveLength(0);
  for(const sql of ["UPDATE public.eco_organization_members SET role='OWNER'",'DELETE FROM public.eco_access_audit','INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id) SELECT id,gen_random_uuid() FROM public.eco_user_profiles']) await expect(call(user,sql)).rejects.toThrow(/permission denied/);
  for(const actor of [user,platform,owner]) await expect(call(actor,'SELECT * FROM public.empleados')).rejects.toThrow(/permission denied/);
  expect((await db.query('SELECT * FROM public.empleados')).rows).toEqual([{id:1,name:'Preserved legacy row'}]);
 });
 it('validates scope, enforces REVOKE precedence, and audits role/scope/override/activity changes',async()=>{
  await preset('BANKS_FULL');
  await mutate(owner,'member.override',{membership_id:userMember,capability:'banks.metrics.view',effect:'REVOKE'});
  expect(await allowed(user,'banks.metrics.view')).toBe(false);
  await mutate(owner,'member.scope',{membership_id:userMember,organization_wide:false,units:[]});
  expect(await allowed(user,'banks.consolidated.view')).toBe(false);
  await expect(mutate(owner,'member.scope',{membership_id:userMember,organization_wide:false,units:[foreign]})).rejects.toThrow(/Foreign/);
  await mutate(owner,'member.active',{membership_id:userMember,active:false});
  await mutate(owner,'member.role',{membership_id:userMember,role:'ADMINISTRATIVE'});
  expect((await db.query('SELECT * FROM public.eco_access_audit')).rows).toHaveLength(5);
 });
 it('invitation completion is service-only, cannot bind self, and rechecks revoked authority',async()=>{
  const ticket=(await call(owner,'SELECT public.core_prepare_invitation($1,$2,$3) id',[org,'new@example.com','CONSULTANT']))[0].id;
  await expect(call(owner,'SELECT public.core_complete_invitation($1,$2,$3)',[ticket,platform,'new@example.com'])).rejects.toThrow(/permission denied/);
  await expect(call(platform,'SELECT public.core_complete_invitation($1,$2,$3)',[ticket,owner,'new@example.com'],'service_role')).rejects.toThrow(/Identity mismatch/);
  await db.query('UPDATE public.eco_organization_members SET is_active=false WHERE id=$1',[ownerMember]);
  await expect(call(platform,'SELECT public.core_complete_invitation($1,$2,$3)',[ticket,platform,'new@example.com'],'service_role')).rejects.toThrow(/revoked/);
 });
 it('trusted invitation completion creates a distinct tenant membership and auditable profile without platform access',async()=>{
  const ticket=(await call(owner,'SELECT public.core_prepare_invitation($1,$2,$3) id',[org,'platform-fixture@example.com','CONSULTANT']))[0].id;
  const rows=await call(platform,'SELECT public.core_complete_invitation($1,$2,$3) id',[ticket,platform,'platform-fixture@example.com'],'service_role');
  expect(rows[0].id).toBeTruthy();
  expect((await db.query('SELECT * FROM public.eco_access_audit')).rows).toHaveLength(2);
  expect(await allowed(platform,'banks.consolidated.view')).toBe(false);
 });
 it('server permission inspection matches canonical decisions and blocks foreign targets',async()=>{
  await preset('BANKS_IMPORT');
  const result=(await call(owner,'SELECT public.core_inspect_permissions($1,$2,NULL) result',[org,userMember]))[0].result as {code:string;allowed:boolean}[];
  for(const item of result) expect(item.allowed,item.code).toBe(await allowed(user,item.code));
  await expect(call(owner,'SELECT public.core_inspect_permissions($1,$2,NULL)',[foreign,userMember])).rejects.toThrow(/denied/);
 });
 it('business capabilities require their module even for an OWNER',async()=>{
  for(const code of ['sales.view','suppliers.manage','recipes.view','personnel.employees.manage','reporting.pnl.view']) expect(await allowed(owner,code),code).toBe(false);
  await db.query("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'ventas',true)",[org]);
  expect(await allowed(owner,'sales.view')).toBe(true);
 });
 it('scope and entitlement are independent requirements for operational-unit capabilities',async()=>{
  const u=(await db.query<{id:string}>("INSERT INTO public.eco_operational_units(organization_id,code,name,unit_type) VALUES($1,'U','Synthetic','OTHER') RETURNING id",[org])).rows[0].id;
  const decision=async()=> (await call(owner,"SELECT public.can_execute_capability_for_org($1,'production.batch.log',$2) allowed",[org,u]))[0].allowed;
  expect(await decision()).toBe(false);
  await db.query("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'produccion',true)",[org]);
  expect(await decision()).toBe(true);
  await db.query('UPDATE public.eco_operational_units SET is_active=false WHERE id=$1',[u]);
  expect(await decision()).toBe(false);
 });
});
