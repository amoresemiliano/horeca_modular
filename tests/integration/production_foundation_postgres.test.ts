import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Ephemeral embedded PostgreSQL only. HORECA DEV LAB is the only seeded tenant.
const org='f7f6da70-f7dc-4b1a-aa23-f5612174dcbc', foreign='10000000-0000-4000-8000-000000000099';
const owner='20000000-0000-4000-8000-000000000001', operator='20000000-0000-4000-8000-000000000002', platform='20000000-0000-4000-8000-000000000003';
const unit='30000000-0000-4000-8000-000000000001', otherUnit='30000000-0000-4000-8000-000000000002';
const member='40000000-0000-4000-8000-000000000001', worker='40000000-0000-4000-8000-000000000002';
const product='50000000-0000-4000-8000-000000000001', pkg='60000000-0000-4000-8000-000000000001', version='60000000-0000-4000-8000-000000000002';
const location='70000000-0000-4000-8000-000000000001', output='80000000-0000-4000-8000-000000000001', input='80000000-0000-4000-8000-000000000002';
const execution=()=>({mode:'MANUAL_OUTPUT',effective_date:'2026-10-15',notes:'Synthetic only',outputs:[{line_id:output,product_id:product,destination_location_id:location,mode:'PACKAGED',package_id:pkg,package_version:version,count:20}],consumptions:[] as object[]});
const envelope=(command:string,entity_id:string,expected_revision:number,body:object)=>({request_id:randomUUID(),organization_id:org,operational_unit_id:unit,command,entity_id,expected_revision,body});

describe('Production canonical commands, immutable facts and real PostgreSQL RLS (isolated)',()=>{
 let db:PGlite;
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE SCHEMA test_auth; CREATE TABLE test_auth.identities(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA auth TO authenticated,anon;`);
  for(const file of ['20260926000000_horeca_core_baseline.sql','20260927000000_ccr_fin_001_core_authorization.sql','20261002030000_core_module_entitlement_registry.sql'])
   await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace('REFERENCES auth.users(id)','REFERENCES test_auth.identities(id)'));
  await db.exec(readFileSync('supabase/ccr/CCR-PROD-001.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261015100000_production_execution_foundation.sql','utf8'));
  // Owner adapter is replaced only inside this ephemeral test DB. Not a master migration.
  await db.exec(`CREATE SCHEMA test_owner; CREATE TABLE test_owner.refs(id uuid, kind text, version uuid, payload jsonb);
   CREATE OR REPLACE FUNCTION public.production_owner_reference(org uuid,opunit uuid,kind text,reference_id uuid,reference_version uuid DEFAULT NULL)
   RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT r.payload FROM test_owner.refs r
    WHERE r.id=$4 AND r.kind=$3 AND r.version IS NOT DISTINCT FROM $5 $$;`);
 },60000);
 afterAll(async()=>{await db?.close()});
 beforeEach(async()=>{
  await db.exec('BEGIN');
  for(const id of [owner,operator,platform]){
   await db.query('INSERT INTO test_auth.identities VALUES($1)',[id]);
   await db.query('INSERT INTO public.eco_user_profiles(id,auth_user_id) VALUES($1,$1)',[id]);
  }
  await db.query("INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'HORECA_DEV_LAB','HORECA DEV LAB')",[org]);
  await db.query("INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES($1,$3,'TEST_A','Synthetic kitchen A','PRODUCTION_CENTER'),($2,$3,'TEST_B','Synthetic kitchen B','PRODUCTION_CENTER')",[unit,otherUnit,org]);
  await db.query("INSERT INTO public.eco_organization_module_entitlements(organization_id,module_key,is_enabled) VALUES($1,'produccion',true)",[org]);
  for(const [id,actor,role] of [[member,owner,'OWNER'],[worker,operator,'PRODUCTION']]){
   await db.query('INSERT INTO public.eco_organization_members(id,organization_id,user_id,role_template_id,is_organization_wide) SELECT $1,$2,$3,id,false FROM public.eco_role_templates WHERE code=$4',[id,org,actor,role]);
   await db.query('INSERT INTO public.eco_membership_operational_unit_scopes(membership_id,organization_id,operational_unit_id) VALUES($1,$2,$3)',[id,org,unit]);
  }
  await db.query("INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id,role_tier) SELECT $1,id,'PLATFORM' FROM public.eco_role_templates WHERE code='VEGEN_PLATFORM_ADMIN'",[platform]);
  for(const [id,kind,ver,extra] of [[product,'PRODUCT',null,{base_unit:'kg',loose_allowed:true}],[pkg,'PACKAGE',version,{product_id:product,net_quantity:'1.500000',unit:'kg'}],[location,'LOCATION',null,{operational_unit_id:unit}]] as const){
   await db.query('INSERT INTO test_owner.refs VALUES($1,$2,$3,$4::jsonb)',[id,kind,ver,JSON.stringify({id,kind,version:ver,organization_id:org,approved:true,...extra})]);
  }
 });
 afterEach(async()=>{await db.exec('ROLLBACK')});

 async function as(actor:string,sql:string,params:unknown[]=[]){
  await db.exec('SAVEPOINT production_test_call');
  try{
   await db.exec('SET LOCAL ROLE authenticated');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);
   const result=await db.query<Record<string,unknown>>(sql,params);
   await db.exec('RESET ROLE; RELEASE SAVEPOINT production_test_call');return result.rows;
  }catch(error){await db.exec('ROLLBACK TO SAVEPOINT production_test_call; RELEASE SAVEPOINT production_test_call');throw error;}
 }
 const call=async(request:object,actor=owner)=>(await as(actor,'SELECT public.production_execute_command($1::jsonb) AS result',[JSON.stringify(request)]))[0].result as {entity_id:string;revision:number;status:string;execution_id?:string};
 const count=async(table:string)=>(await db.query<{n:number}>(`SELECT count(*)::int n FROM public.${table}`)).rows[0].n;
 async function confirmed(withInput=false){const id=randomUUID(),doc=execution();if(withInput)doc.consumptions=[{line_id:input,product_id:product,source_location_id:location,quantity:'35.000000',unit:'kg'}];await call(envelope('create_draft',id,0,doc));const request=envelope('confirm_batch',id,1,doc);return {id,doc,request,result:await call(request)};}

 it('creates, updates and rejects stale drafts without any outbox effects',async()=>{
  const id=randomUUID(),doc=execution(),request=envelope('create_draft',id,0,doc);
  expect(await call(request)).toMatchObject({revision:1,status:'DRAFT'});
  expect(await call(request)).toEqual(await call(request));
  doc.outputs[0].count=21;
  expect(await call(envelope('update_draft',id,1,doc))).toMatchObject({revision:2,status:'DRAFT'});
  await expect(call(envelope('update_draft',id,1,doc))).rejects.toThrow('STALE_REVISION');
  expect(await count('eco_production_outbox')).toBe(0);
 });
 it('confirms exact immutable output, stable retry IDs and no inferred consumption',async()=>{
  const c=await confirmed();
  const rows=await db.query<{normalized_quantity:string;conversion_snapshot:object}>('SELECT normalized_quantity::text,conversion_snapshot FROM public.eco_production_outputs');
  expect(rows.rows[0].normalized_quantity).toBe('30.000000');expect(rows.rows[0].conversion_snapshot).toMatchObject({net_quantity:'1.500000'});
  const events=(await db.query('SELECT * FROM public.eco_production_outbox')).rows;
  expect(await call(c.request)).toEqual(c.result);
  expect((await db.query('SELECT * FROM public.eco_production_outbox')).rows).toEqual(events);
  expect(await count('eco_production_consumptions')).toBe(0);
  await expect(call(envelope('update_draft',c.id,2,c.doc))).rejects.toThrow('IMMUTABLE');
  await expect(call({...c.request,body:{...c.doc,notes:'different'}})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  await expect(call(envelope('confirm_batch',c.id,2,c.doc))).rejects.toThrow('ALREADY_FINALIZED');
 });
 it.each([['foreign tenant',{organization_id:foreign}],['wrong unit',{operational_unit_id:otherUnit}]])('denies %s mutation',async(_label,override)=>{
  await expect(call({...envelope('create_draft',randomUUID(),0,execution()),...override})).rejects.toThrow('ACCESS_DENIED');
  expect(await count('eco_production_batches')).toBe(0);
 });
 it('enforces read isolation on every parent/child table and denies direct writes',async()=>{
  await confirmed(true);
  for(const table of ['batches','policies','commands','executions','outputs','consumptions','wastes','waste_confirmations','actions','outbox']){
   const t='eco_production_'+table;
   expect(await as(platform,`SELECT * FROM public.${t}`)).toHaveLength(0);
   await expect(as(owner,`DELETE FROM public.${t}`)).rejects.toThrow(/permission denied/);
  }
  expect(await as(owner,'SELECT * FROM public.eco_production_outputs')).toHaveLength(1);
  await db.query('UPDATE public.eco_membership_operational_unit_scopes SET operational_unit_id=$1 WHERE membership_id=$2',[otherUnit,member]);
  expect(await as(owner,'SELECT * FROM public.eco_production_outputs')).toHaveLength(0);
 });
 it.each(['inactive_member','inactive_profile','inactive_org','inactive_unit','entitlement','capability','revoke','platform'])('fails closed for %s',async scenario=>{
  if(scenario==='inactive_member')await db.query('UPDATE public.eco_organization_members SET is_active=false WHERE id=$1',[member]);
  if(scenario==='inactive_profile')await db.query('UPDATE public.eco_user_profiles SET is_active=false WHERE id=$1',[owner]);
  if(scenario==='inactive_org')await db.query('UPDATE public.eco_organizations SET is_active=false WHERE id=$1',[org]);
  if(scenario==='inactive_unit')await db.query('UPDATE public.eco_operational_units SET is_active=false WHERE id=$1',[unit]);
  if(scenario==='entitlement')await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=false');
  if(scenario==='capability')await db.exec("DELETE FROM public.eco_role_template_capabilities WHERE capability_id=(SELECT id FROM public.eco_capabilities WHERE code='production.batch.log')");
  if(scenario==='revoke')await db.query("INSERT INTO public.eco_member_capability_overrides(membership_id,organization_id,capability_id,effect,operational_unit_id) SELECT $1,$2,id,'REVOKE',$3 FROM public.eco_capabilities WHERE code='production.batch.log'",[member,org,unit]);
  await expect(call(envelope('create_draft',randomUUID(),0,execution()),scenario==='platform'?platform:owner)).rejects.toThrow('ACCESS_DENIED');
 });
 it('separates operator registration from supervisor confirmation',async()=>{
  const id=randomUUID(),doc=execution();await call(envelope('create_draft',id,0,doc),operator);
  await expect(call(envelope('confirm_batch',id,1,doc),operator)).rejects.toThrow('ACCESS_DENIED');
  expect((await call(envelope('confirm_batch',id,1,doc))).status).toBe('CONFIRMED');
 });
 it('rejects missing session and missing organization or unit',async()=>{
  const request=envelope('create_draft',randomUUID(),0,execution());
  await expect(call(request,'')).rejects.toThrow('ACCESS_DENIED');
  await expect(call({...request,organization_id:null})).rejects.toThrow('ACCESS_DENIED');
  await expect(call({...request,operational_unit_id:null})).rejects.toThrow('ACCESS_DENIED');
 });
 it('rejects owner references from another tenant or operational unit',async()=>{
  await db.query("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{organization_id}',to_jsonb($1::text)) WHERE kind='PRODUCT'",[foreign]);
  await expect(call(envelope('create_draft',randomUUID(),0,execution()))).rejects.toThrow('REFERENCE_DENIED');
  await db.query("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{organization_id}',to_jsonb($1::text)) WHERE kind='PRODUCT'",[org]);
  await db.query("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{operational_unit_id}',to_jsonb($1::text)) WHERE kind='LOCATION'",[otherUnit]);
  await expect(call(envelope('create_draft',randomUUID(),0,execution()))).rejects.toThrow('REFERENCE_DENIED');
 });
 it('rechecks authorization before returning an idempotency-cache result',async()=>{
  const c=await confirmed();await db.exec('UPDATE public.eco_organization_module_entitlements SET is_enabled=false');
  await expect(call(c.request)).rejects.toThrow('ACCESS_DENIED');
 });
 it('rolls back confirmation state, facts, commands and events when an outbox insert fails',async()=>{
  const id=randomUUID(),doc=execution();await call(envelope('create_draft',id,0,doc));
  await db.exec("CREATE FUNCTION test_owner.fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_OUTBOX_FAILURE'; END $$; CREATE TRIGGER fail_event BEFORE INSERT ON public.eco_production_outbox FOR EACH ROW EXECUTE FUNCTION test_owner.fail_event()");
  await expect(call(envelope('confirm_batch',id,1,doc))).rejects.toThrow('INJECTED_OUTBOX_FAILURE');
  expect(await count('eco_production_executions')).toBe(0);expect(await count('eco_production_outputs')).toBe(0);expect(await count('eco_production_outbox')).toBe(0);expect(await count('eco_production_commands')).toBe(1);
  expect((await db.query('SELECT status,revision FROM public.eco_production_batches')).rows[0]).toEqual({status:'DRAFT',revision:1});
 });
 it('appends corrections/reversal while retaining the original facts and compensation references',async()=>{
  const c=await confirmed(true),original=(await db.query('SELECT * FROM public.eco_production_outputs')).rows;
  const updated=execution();updated.outputs[0].count=22;updated.effective_date='2026-10-14';
  await expect(call(envelope('correct_batch',c.id,2,{reason:'',execution:updated}))).rejects.toThrow('REASON');
  const correction=await call(envelope('correct_batch',c.id,2,{reason:'Late count correction',execution:updated}));
  expect(correction.status).toBe('CORRECTED');
  expect((await db.query('SELECT * FROM public.eco_production_outputs WHERE execution_id=$1',[c.result.execution_id])).rows).toEqual(original);
  const compensation=(await db.query<{payload:{original_event_ids:string[]}}>("SELECT payload FROM public.eco_production_outbox WHERE event_type='EXECUTION_COMPENSATION_REQUIRED'")).rows[0].payload;
  expect(compensation.original_event_ids).toHaveLength(2);
  const reverse=envelope('reverse_batch',c.id,3,{reason:'Explicit reversal'});expect((await call(reverse)).status).toBe('REVERSED');
  expect(await call(reverse)).toEqual(await call(reverse));expect(await count('eco_production_executions')).toBe(3);
  await expect(db.exec('UPDATE public.eco_production_outputs SET normalized_quantity=1')).rejects.toThrow('IMMUTABLE');
 });
 it.each([0,1.5,-1])('rejects invalid package count %s',async countValue=>{
  const doc=execution();doc.outputs[0].count=countValue;
  await expect(call(envelope('create_draft',randomUUID(),0,doc))).rejects.toThrow('INVALID_PACKAGE');
 });
 it('fails closed on unknown references, owner contracts and dimensional mismatch',async()=>{
  const doc=execution();doc.outputs[0].package_id=randomUUID();
  await expect(call(envelope('create_draft',randomUUID(),0,doc))).rejects.toThrow('REFERENCE_DENIED');
  await db.exec("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{unit}','\"L\"') WHERE kind='PACKAGE'");
  await expect(call(envelope('create_draft',randomUUID(),0,execution()))).rejects.toThrow('DIMENSION');
  await db.exec("CREATE OR REPLACE FUNCTION public.production_owner_reference(org uuid,opunit uuid,kind text,reference_id uuid,reference_version uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$ BEGIN RAISE EXCEPTION 'OWNER_CONTRACT_UNAVAILABLE'; END $$");
  await expect(call(envelope('create_draft',randomUUID(),0,execution()))).rejects.toThrow('OWNER_CONTRACT_UNAVAILABLE');
 });
 it('rejects a changed conversion at confirm; historical output does not change with master changes',async()=>{
  const c=await confirmed();await db.exec("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{net_quantity}','\"2.000000\"') WHERE kind='PACKAGE'");
  expect((await db.query<{qty:string}>('SELECT normalized_quantity::text qty FROM public.eco_production_outputs')).rows[0].qty).toBe('30.000000');
  const id=randomUUID();await call(envelope('create_draft',id,0,execution()));
  await db.exec("UPDATE test_owner.refs SET payload=jsonb_set(payload,'{net_quantity}','\"3.000000\"') WHERE kind='PACKAGE'");
  await expect(call(envelope('confirm_batch',id,1,execution()))).rejects.toThrow('DRAFT_CONFIRMATION_MISMATCH');
  expect(await count('eco_production_executions')).toBe(1);expect(c.result.revision).toBe(2);
 });
 it('stores durable scoped policy revisions with no stock or outbox effect',async()=>{
  const id=randomUUID(),body={product_id:product,stock_scope:{location_ids:[location]},minimum:'30',maximum:'100',unit:'kg'};
  const request=envelope('save_policy',id,0,body);expect((await call(request)).revision).toBe(1);expect(await call(request)).toEqual(await call(request));
  expect((await call(envelope('save_policy',id,1,{...body,minimum:'31'}))).revision).toBe(2);
  await expect(call(envelope('save_policy',id,1,body))).rejects.toThrow('STALE');
  await expect(call(envelope('save_policy',id,2,{...body,maximum:'29'}))).rejects.toThrow('INVALID_PLANNING');
  expect(await count('eco_production_outbox')).toBe(0);
 });
 it('logs and confirms waste separately; consumed process loss never emits a second deduction',async()=>{
  const c=await confirmed(true),waste=randomUUID();
  const body={waste_id:waste,product_id:product,quantity:'2.5',unit:'kg',classification:'PROCESS_ALREADY_CONSUMED',related_line_id:input,reason:'Process trim'};
  await call(envelope('log_waste',c.id,2,body),operator);expect(await count('eco_production_waste_confirmations')).toBe(0);
  await expect(call(envelope('confirm_waste',c.id,3,{waste_id:waste}),operator)).rejects.toThrow('ACCESS_DENIED');
  const confirm=envelope('confirm_waste',c.id,3,{waste_id:waste});await call(confirm);await call(confirm);
  expect(await count('eco_production_waste_confirmations')).toBe(1);expect(await count('eco_production_outbox')).toBe(2);
  await expect(call(envelope('log_waste',c.id,4,{...body,waste_id:randomUUID(),location_id:location}))).rejects.toThrow('NO_SECOND_STOCK_REMOVAL');
 });
 it('emits stock-impacting waste once, includes it in compensation and rejects superseded waste',async()=>{
  const c=await confirmed(),waste=randomUUID();
  await call(envelope('log_waste',c.id,2,{waste_id:waste,product_id:product,quantity:'1',unit:'kg',classification:'OUTPUT_LOSS',related_line_id:output,location_id:location,reason:'Damaged packaging'}));
  await call(envelope('confirm_waste',c.id,3,{waste_id:waste}));
  expect(await count('eco_production_outbox')).toBe(2);
  await call(envelope('correct_batch',c.id,4,{reason:'Replacement execution',execution:c.doc}));
  const payload=(await db.query<{payload:{original_event_ids:string[]}}>("SELECT payload FROM public.eco_production_outbox WHERE event_type='EXECUTION_COMPENSATION_REQUIRED'")).rows[0].payload;
  expect(payload.original_event_ids).toHaveLength(2);
  await expect(call(envelope('confirm_waste',c.id,5,{waste_id:waste}))).rejects.toThrow('SUPERSEDED');
 });
 it('cancels drafts append-only and cannot reverse them as confirmed executions',async()=>{
  const id=randomUUID();await call(envelope('create_draft',id,0,execution()));
  await expect(call(envelope('reverse_batch',id,1,{reason:'invalid state'}))).rejects.toThrow('STATE_INVALID');
  expect((await call(envelope('cancel_draft',id,1,{reason:'Not produced'}))).status).toBe('CANCELLED');
  expect(await count('eco_production_actions')).toBe(2);expect(await count('eco_production_outbox')).toBe(0);
 });
});
