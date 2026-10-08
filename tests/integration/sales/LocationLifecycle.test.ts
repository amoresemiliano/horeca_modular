import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validateLastAppWebhook,LAST_APP_INTEGRATOR_ID} from '../../../src/infrastructure/sales/lastapp/LastAppWebhook';
import {mapLastAppSale} from '../../../src/application/sales/services/LastAppSalesMapper';
const mocks=vi.hoisted(()=>({serverClient:vi.fn()}));
vi.mock('../../../server/salesRuntime',()=>({serverClient:mocks.serverClient}));
import handler from '../../../api/sales-webhook';
const org='10000000-0000-0000-0000-000000000001',unit='20000000-0000-0000-0000-000000000001';
const location='30000000-0000-0000-0000-000000000001',unknown='30000000-0000-0000-0000-000000000002';
const run='40000000-0000-0000-0000-000000000001',tab='50000000-0000-0000-0000-000000000001';
function event(type='location:integrated',loc=unknown,id='synthetic-event-1',created='2026-10-08T10:00:00.000Z'){
 return {id,type,created,data:{locationId:loc,locationName:'Synthetic local',organizationId:org,organizationName:'Synthetic provider org',
  integrationId:'60000000-0000-0000-0000-000000000001',integratorId:LAST_APP_INTEGRATOR_ID,
  integrationRequestToken:'discard-this-token',customer:{email:'discard@example.test'},metadata:{private:'discard-me'}}};
}
const validate=(body:unknown)=>validateLastAppWebhook('Bearer synthetic-current-token','synthetic-current-token',body,undefined);
describe('strict documented lifecycle envelopes and minimized identity',()=>{
 it.each(['location:integrated','location:desintegrated'])('normalizes direct and wrapped %s equivalently',type=>{
  expect(validate({event:event(type)})).toEqual(validate(event(type)));
  const receipt=validate(event(type));expect(receipt).not.toHaveProperty('external_tab_id');
  expect(JSON.stringify(receipt)).not.toMatch(/discard|integrationRequestToken|customer|metadata/);
  expect(receipt.external_location_id).toBe(unknown);expect(receipt).toHaveProperty('external_integrator_id',LAST_APP_INTEGRATOR_ID);
 });
 it('does not substitute Integrator ID for the TEST Location ID',()=>{
  const body=event('location:integrated','f7408208-75c8-4547-8862-f8748e2afac1');const result=validate(body);
  expect(result.external_location_id).not.toBe(LAST_APP_INTEGRATOR_ID);expect(result).toHaveProperty('external_integrator_id',LAST_APP_INTEGRATOR_ID);
 });
 it.each([null,[],{}, {event:{event:event()}},{event:event(),data:{}},{event:event(),id:'mixed'},
  {...event(),type:'location:deleted'},{...event(),created:'2026-02-30T10:00:00Z'},
  {...event(),created:'2026-10-08T10:00:00+01:00'},{...event(),id:'   '},
  {...event(),data:{...event().data,locationId:'not-uuid'}},
  {...event(),data:{...event().data,organizationId:null}},
  {...event(),data:{...event().data,integrationId:123}},
  {...event(),data:{...event().data,integratorId:unknown}},
  {...event(),data:{...event().data,locationName:'x'.repeat(301)}}])('rejects malformed or unsupported envelope %#',body=>{
  expect(()=>validate(body)).toThrow('INVALID_EVENT');
 });
 it('allows genuinely absent optional identifiers without inferring them',()=>{
  const body={...event(),data:{locationId:unknown}};expect(validate(body)).toHaveProperty('external_integrator_id',null);
  expect(validate(body)).toHaveProperty('external_organization_id',null);
 });
 it('rejects context mismatch and old/invalid authentication',()=>{
  expect(()=>validateLastAppWebhook('Bearer previous-token','synthetic-current-token',event(),undefined)).toThrow('DENIED');
  expect(()=>validateLastAppWebhook('Bearer synthetic-current-token','',event(),undefined)).toThrow('DENIED');
  expect(()=>validateLastAppWebhook('Bearer synthetic-current-token','synthetic-current-token',event(),location)).toThrow('INVALID_EVENT');
  expect(()=>validateLastAppWebhook('Bearer synthetic-current-token','synthetic-current-token',event(),undefined,unknown)).toThrow('INVALID_EVENT');
 });
});

describe('real PostgreSQL lifecycle transactions and provider handler',()=>{
 let db:PGlite;const rpc=vi.fn();let upsert:ReturnType<typeof vi.fn>;
 const rows=async(table:string)=>(await db.query(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows;
 async function business(){return Promise.all(['eco_organizations','eco_operational_units','sales','sale_lines','sales_source_bills','sales_changes','sales_sync_runs'].map(rows));}
 const receive=async(body:unknown)=>db.query('SELECT public.sales_receive_lastapp_location_event($1::jsonb) result',[JSON.stringify(validate(body))]);
 const candidate=(total=770)=>mapLastAppSale({id:tab,locationId:location,creationTime:'2026-10-08T09:00:00Z',products:[],
  bills:[{id:'70000000-0000-0000-0000-000000000001',number:'SYNTHETIC',creationTime:'2026-10-08T09:00:00Z',total,products:[],payments:[]}]},
  {organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:run,observedAt:'2026-10-08T12:00:00Z',products:new Map()});
 async function persist(total=770){const c=candidate(total);return db.query('SELECT public.sales_persist_canonical($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(c.sale.toJSON()),JSON.stringify(c.lines.map(l=>l.toJSON())),JSON.stringify(c.bills)]);}
 beforeAll(async()=>{
  db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  await db.query(`INSERT INTO public.eco_organizations(id,code,name) VALUES($1,'SYN','Synthetic tenant')`,[org]);
  await db.query(`INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type) VALUES($1,$2,'SYN','Synthetic local','LOCAL')`,[unit,org]);
  await db.query(`INSERT INTO public.sales_location_mappings VALUES($1,$2,$1,$3,'EUR',true)`,[org,location,unit]);
  await db.query(`INSERT INTO public.sales_sync_runs(id,organization_id,external_location_id,operational_unit_id,mode,status) VALUES($1,$2,$3,$4,'RECONCILIATION','PROCESSING')`,[run,org,location,unit]);
  await persist();
 },60000);
 afterAll(async()=>{await db?.close();});
 beforeEach(async()=>{
  await db.exec('BEGIN');vi.clearAllMocks();vi.stubEnv('LAST_APP_TOKEN','synthetic-current-token');
  rpc.mockImplementation(async(name,args)=>{try{expect(name).toBe('sales_receive_lastapp_location_event');const r=await db.query<{result:string}>('SELECT public.sales_receive_lastapp_location_event($1::jsonb) result',[JSON.stringify(args.p_event)]);return {data:r.rows[0].result,error:null};}catch(error){return {data:null,error};}});
  upsert=vi.fn(async(values)=>{await db.query(`INSERT INTO public.sales_lastapp_inbox(organization_id,source_event_id,event_type,external_tab_id,external_location_id,source_created_at,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,source_event_id) DO NOTHING`,[values.organization_id,values.source_event_id,values.event_type,values.external_tab_id,values.external_location_id,values.source_created_at,values.payload_hash]);return {error:null};});
  const query={select:()=>query,eq:()=>query,single:async()=>({data:{organization_id:org},error:null}),upsert};
  mocks.serverClient.mockReturnValue({rpc,from:()=>query} as unknown as SupabaseClient);
 });
 afterEach(async()=>{await db.exec('ROLLBACK');vi.unstubAllEnvs();});
 function response(){const r={status:vi.fn(),json:vi.fn(),end:vi.fn()};r.status.mockReturnValue(r);return r;}
 async function post(body:unknown,authorization='Bearer synthetic-current-token',contentType='application/json'){
  const res=response();await handler({method:'POST',headers:{authorization,'content-type':contentType},body:body as Record<string,unknown>},res);return res;
 }
 it('durably acknowledges an unmapped location once, empty 200, with no provisioning or Sales write',async()=>{
  const before=await business(),mappings=await rows('sales_location_mappings');
  for(const body of [event(),{event:event()}]){const res=await post(body);expect(res.status).toHaveBeenCalledWith(200);expect(res.end).toHaveBeenCalledWith();expect(res.json).not.toHaveBeenCalled();}
  expect(await rows('sales_lastapp_location_receipts')).toHaveLength(1);
  const state=(await db.query<Record<string,unknown>>('SELECT * FROM public.sales_lastapp_location_lifecycle')).rows[0];expect(state.review_state).toBe('PENDING_MAPPING');expect(state.provider_state).toBe('INTEGRATED');
  expect(await business()).toEqual(before);expect(await rows('sales_location_mappings')).toEqual(mappings);
  expect(JSON.stringify(await rows('sales_lastapp_location_receipts'))).not.toMatch(/discard|integrationRequestToken|customer|metadata/);
 });
 it('de-integration pauses only connectivity and preserves every historical business fact',async()=>{
  const before=await business();await receive(event('location:desintegrated',location));
  expect((await db.query<{is_active:boolean}>('SELECT is_active FROM public.sales_location_mappings')).rows[0].is_active).toBe(false);
  expect(await business()).toEqual(before);expect((await db.query<{review_state:string}>('SELECT review_state FROM public.sales_lastapp_location_lifecycle')).rows[0].review_state).toBe('PAUSED');
  await db.exec('SAVEPOINT paused_commit');
  await expect(persist(999)).rejects.toThrow('LASTAPP_LOCATION_PAUSED');
  await db.exec('ROLLBACK TO paused_commit');expect(await business()).toEqual(before);
 });
 it('acknowledges de-integration even without any mapping',async()=>{
  const before=await business();const res=await post(event('location:desintegrated'));expect(res.status).toHaveBeenCalledWith(200);expect(await business()).toEqual(before);
 });
 it('reinstallation and stale integrated delivery never reactivate routing',async()=>{
  await receive(event('location:desintegrated',location,'off','2026-10-08T11:00:00Z'));
  await receive(event('location:integrated',location,'old-on','2026-10-08T10:00:00Z'));
  expect((await db.query<{provider_state:string}>('SELECT provider_state FROM public.sales_lastapp_location_lifecycle')).rows[0].provider_state).toBe('DESINTEGRATED');
  await receive(event('location:integrated',location,'new-on','2026-10-08T12:00:00Z'));
  const state=(await db.query<Record<string,unknown>>('SELECT * FROM public.sales_lastapp_location_lifecycle')).rows[0];expect(state.provider_state).toBe('INTEGRATED');expect(state.review_state).toBe('PAUSED');
  expect((await db.query<{is_active:boolean}>('SELECT is_active FROM public.sales_location_mappings')).rows[0].is_active).toBe(false);
 });
 it('conservatively pauses on late de-integration without replacing newer provider metadata',async()=>{
  await receive(event('location:integrated',location,'new-on','2026-10-08T12:00:00Z'));await receive(event('location:desintegrated',location,'old-off','2026-10-08T10:00:00Z'));
  const state=(await db.query<Record<string,unknown>>('SELECT * FROM public.sales_lastapp_location_lifecycle')).rows[0];expect(state.provider_state).toBe('INTEGRATED');expect(state.review_state).toBe('PAUSED');
 });
 it('rejects conflicting replay atomically',async()=>{
  await receive(event());const before=await rows('sales_lastapp_location_receipts');
  await db.exec('SAVEPOINT conflicting');await expect(receive({...event(),data:{...event().data,locationName:'Conflicting name'}})).rejects.toThrow('CONFLICTING_LOCATION_EVENT');await db.exec('ROLLBACK TO conflicting');
  expect(await rows('sales_lastapp_location_receipts')).toEqual(before);
 });
 it('rejects provider organization mismatch without touching mapping or history',async()=>{
  const before=await business(),mappings=await rows('sales_location_mappings');await db.exec('SAVEPOINT mismatch');
  await expect(receive({...event('location:desintegrated',location),data:{...event().data,locationId:location,organizationId:unknown}})).rejects.toThrow('LOCATION_ORGANIZATION_MISMATCH');await db.exec('ROLLBACK TO mismatch');
  expect(await business()).toEqual(before);expect(await rows('sales_location_mappings')).toEqual(mappings);expect(await rows('sales_lastapp_location_receipts')).toHaveLength(0);
 });
 it.each([['Bearer old-token',event(),'application/json',401],['Bearer synthetic-current-token',{event:event(),id:'mixed'},'application/json',400],['Bearer synthetic-current-token',event(),'text/plain',400]])('rejects before composing trusted DB client %#',async(auth,body,contentType,code)=>{
  const res=await post(body,auth as string,contentType as string);expect(res.status).toHaveBeenCalledWith(code);expect(mocks.serverClient).not.toHaveBeenCalled();expect(await rows('sales_lastapp_location_receipts')).toHaveLength(0);
 });
 it('fails closed when durable receipt cannot commit',async()=>{
  rpc.mockResolvedValue({error:{message:'private database failure'}});const res=await post(event());expect(res.status).toHaveBeenCalledWith(503);expect(res.json).not.toHaveBeenCalled();expect(await rows('sales_lastapp_location_receipts')).toHaveLength(0);
 });
 it('keeps existing Tab receipt/dedup behavior for both documented envelopes',async()=>{
  const body={id:'tab-event',type:'tab:closed',created:'2026-10-08T10:00:00Z',data:{id:tab,locationId:location}};
  for(const value of [body,{event:body}])expect((await post(value)).status).toHaveBeenCalledWith(200);
  expect(await rows('sales_lastapp_inbox')).toHaveLength(1);expect(rpc).not.toHaveBeenCalled();expect(upsert).toHaveBeenCalledTimes(2);
 });
 it('denies anonymous/browser lifecycle access and provides trusted internal inspection',async()=>{
  const p=(await db.query(`SELECT has_function_privilege('anon','public.sales_receive_lastapp_location_event(jsonb)','EXECUTE') anon,
   has_function_privilege('authenticated','public.sales_receive_lastapp_location_event(jsonb)','EXECUTE') browser,
   has_table_privilege('authenticated','public.sales_lastapp_location_lifecycle','SELECT') browser_read,
   has_table_privilege('service_role','public.sales_lastapp_location_lifecycle','SELECT') trusted_read`)).rows[0];
  expect(p).toEqual({anon:false,browser:false,browser_read:false,trusted_read:true});
 });
});
