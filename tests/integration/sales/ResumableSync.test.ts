import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncSalesSourceUseCase } from '../../../src/application/sales/useCases/SyncSalesSourceUseCase';
import { SupabaseSalesSyncCheckpoint } from '../../../src/infrastructure/sales/repositories/SupabaseSalesSyncCheckpoint';
import { LastAppAdapter } from '../../../src/infrastructure/sales/lastapp/LastAppAdapter';
import { continueSalesSyncUntilSettled } from '../../../src/application/sales/services/ContinueSalesSync';
import { mapLastAppSale } from '../../../src/application/sales/services/LastAppSalesMapper';
import { SaleLine } from '../../../src/domain/sales/models/SaleLine';

describe('resumable source windows with real PostgreSQL checkpoints and canonical writes',()=>{
  let db:PGlite;
  const org='10000000-0000-0000-0000-000000000001',unit='20000000-0000-0000-0000-000000000001',location='30000000-0000-0000-0000-000000000001';
  let failId:string|undefined;
  const ids=Array.from({length:235},(_,i)=>`50000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
  const offsets:number[]=[];
  const http=vi.fn(async(input:string|URL|Request)=>{
    const url=new URL(String(input));
    if(url.pathname==='/v2/tabs') {
      const offset=Number(url.searchParams.get('offset'));offsets.push(offset);
      return Response.json(ids.slice(offset,offset+Number(url.searchParams.get('limit'))).map(id=>({id})));
    }
    const id=url.pathname.split('/').at(-1)!;
    if(id===failId)throw new Error('sanitized transport interruption');
    return Response.json({id,locationId:location,creationTime:'2026-10-01T10:00:00Z',closeTime:'2026-10-01T11:00:00Z',products:[],bills:[]});
  });
  const source=new LastAppAdapter({token:'synthetic-test-token',fetch:http,maxAttempts:1});
  const window={locationId:location,startDate:'2026-10-01T00:00:00Z',endDate:'2026-10-02T00:00:00Z'};
  const rpcClient={rpc:async(name:string,args:Record<string,unknown>)=>{
    try{
      const keys=Object.keys(args);
      const result=await db.query<{result:any}>(`SELECT public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) AS result`,keys.map(k=>args[k]));
      return {data:result.rows[0].result,error:null};
    }catch(error){return {data:null,error};}
  }} as unknown as SupabaseClient;
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for(const file of ['20260926000000_horeca_core_baseline.sql','20260927000000_ccr_fin_001_core_authorization.sql',
      '20260928010000_finance_atomic_bank_import.sql','20261001000000_finance_classification_workflow.sql',
      '20261002000000_core_tenant_administration.sql','20261002010000_core_secure_provisioning.sql','20261002020000_core_legacy_fail_closed.sql',
      '20261002100000_canonical_sales_schema.sql','20261002110000_lastapp_sales_ingestion.sql','20261002120000_sales_resumable_sync.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
    await db.query(`INSERT INTO public.eco_organizations(id,code,name)VALUES($1,'A','Synthetic tenant')`,[org]);
    await db.query(`INSERT INTO public.eco_operational_units(id,organization_id,code,name,unit_type)VALUES($1,$2,'A','Synthetic local','LOCAL')`,[unit,org]);
    await db.query(`INSERT INTO public.sales_location_mappings VALUES($1,$2,$3,$4,'EUR',true)`,[org,location,org,unit]);
  },60000);
  afterAll(async()=>{await db?.close();});
  async function newRun(){return(await db.query<{id:string}>(`INSERT INTO public.sales_sync_runs(organization_id,external_location_id,operational_unit_id,mode,status,requested_start,requested_end)
    VALUES($1,$2,$3,'BACKFILL','PROCESSING',$4,$5)RETURNING id`,[org,location,unit,window.startDate,window.endDate])).rows[0].id;}
  async function claim(id:string,version:number){const {data,error}=await rpcClient.rpc('sales_claim_sync_slice',{p_org:org,p_run:id,p_version:version});if(error)throw error;return data;}
  async function slice(claimed:any,maxRecords=100){
    const store=new SupabaseSalesSyncCheckpoint(rpcClient,org,claimed.run.slice_lease,claimed.run);
    const operation=new SyncSalesSourceUseCase(source,{persist:async()=>{throw new Error('must use atomic checkpoint write');}});
    await operation.executeSlice(window,{organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:store.state.id,observedAt:'2026-10-02T00:00:00Z',products:new Map()},store,
      {maxRecords,maxPages:2,budgetMs:30000});
    return store.finish();
  }
  it('continues a 235-Tab window across bounded slices, with accurate offsets and final completion',async()=>{
    const id=await newRun();offsets.length=0;
    const first=await slice(await claim(id,0));
    expect(first.status).toBe('CONTINUABLE');expect(first.records_fetched).toBe(100);expect(first.next_offset).toBe(100);
    const repeated=await claim(id,0);expect(repeated.claimed).toBe(false);expect(repeated.run.records_fetched).toBe(100);
    const second=await slice(await claim(id,first.continuation_version));expect(second.status).toBe('CONTINUABLE');expect(second.records_fetched).toBe(200);
    const final=await slice(await claim(id,second.continuation_version));expect(final.status).toBe('COMPLETED');expect(final.records_fetched).toBe(235);
    expect(final.created).toBe(235);expect(final.pending_tab_ids).toEqual([]);expect(offsets).toEqual([0,100,200]);
    expect((await db.query('SELECT * FROM public.sales')).rows).toHaveLength(235);
    expect((await claim(id,final.continuation_version)).claimed).toBe(false);
  });
  it('retains pending page IDs after failure and reclaims an interrupted lease without double-counting',async()=>{
    const id=await newRun();offsets.length=0;
    const claimed=await claim(id,0);
    const first=await slice(claimed,3);expect(first.pending_tab_ids[0]).toBe(ids[3]);expect(first.next_offset).toBe(100);
    const active=await claim(id,first.continuation_version);
    const store=new SupabaseSalesSyncCheckpoint(rpcClient,org,active.run.slice_lease,active.run);
    const operation=new SyncSalesSourceUseCase(source,{persist:async()=>{throw new Error('unused');}});
    failId=ids[4];
    await expect(operation.executeSlice(window,{organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:id,observedAt:'2026-10-02T00:00:00Z',products:new Map()},store)).rejects.toThrow('SOURCE_TRANSPORT_ERROR');
    expect(store.state.records_fetched).toBe(4);expect(store.state.pending_tab_ids[0]).toBe(ids[4]);
    expect((await claim(id,store.state.continuation_version)).claimed).toBe(false);
    // Simulated process interruption: reclaim only after the persisted lease expires.
    await db.query(`UPDATE public.sales_sync_runs SET slice_lease_until=now()-interval '1 second' WHERE id=$1`,[id]);
    const resumed=await claim(id,store.state.continuation_version);expect(resumed.claimed).toBe(true);
    await expect(store.commitTab(ids[4],null)).rejects.toThrow('SYNC_CHECKPOINT_FAILED'); // old worker is fenced
    failId=undefined;
    let result=await slice(resumed);
    while(result.status==='CONTINUABLE')result=await slice(await claim(id,result.continuation_version));
    expect(result.status).toBe('COMPLETED');expect(result.records_fetched).toBe(235);expect(result.unchanged).toBe(235);
    expect(offsets).toEqual([0,100,200]);expect((await db.query('SELECT * FROM public.sales')).rows).toHaveLength(235);
  });
  it('keeps actual failure restartable, rejects tenant/scope changes and browser checkpoint writes',async()=>{
    const id=await newRun();const active=await claim(id,0);
    const store=new SupabaseSalesSyncCheckpoint(rpcClient,org,active.run.slice_lease,active.run);
    const failed=await store.finish(true);expect(failed.status).toBe('FAILED');expect(failed.next_offset).toBe(0);
    expect((await claim(id,failed.continuation_version)).claimed).toBe(true);
    await expect(db.query(`UPDATE public.sales_sync_runs SET requested_end=requested_end+interval '1 day' WHERE id=$1`,[id])).rejects.toThrow('sync scope is immutable');
    const foreign=await rpcClient.rpc('sales_claim_sync_slice',{p_org:'10000000-0000-0000-0000-000000000002',p_run:id,p_version:failed.continuation_version});expect(foreign.error).toBeTruthy();
    await db.exec('SET ROLE authenticated');
    try{await expect(db.query('SELECT public.sales_claim_sync_slice($1,$2,0)',[org,id])).rejects.toThrow(/permission denied/);}finally{await db.exec('RESET ROLE');}
  });
  it('atomically rolls back checkpoint advancement with a failed child write and rejects observation scope changes',async()=>{
    const id=await newRun(),active=await claim(id,0);
    const store=new SupabaseSalesSyncCheckpoint(rpcClient,org,active.run.slice_lease,active.run);
    await store.savePage([ids[0]],1,true);
    const tab={id:ids[0],locationId:location,creationTime:'2026-10-01T10:00:00Z',closeTime:'2026-10-01T11:00:00Z',
      products:[{id:'product',name:'Synthetic item',quantity:1,price:1200}],
      bills:[{id:'60000000-0000-0000-0000-000000000001',number:'A1',creationTime:'2026-10-01T11:00:00Z',total:1200,products:[],payments:[]}]};
    const context={organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:id,observedAt:new Date().toISOString(),products:new Map()};
    const mapped=mapLastAppSale(tab,context);
    const wrong=mapLastAppSale(tab,{...context,organizationId:'10000000-0000-0000-0000-000000000002'});
    await expect(store.commitTab(ids[0],wrong)).rejects.toThrow('SYNC_CHECKPOINT_FAILED');
    const invalid={...mapped,lines:[SaleLine.create({...mapped.lines[0].toJSON(),organizationId:'10000000-0000-0000-0000-000000000002'})]};
    await expect(store.commitTab(ids[0],invalid)).rejects.toThrow('SYNC_CHECKPOINT_FAILED');
    const persisted=(await db.query<{records_fetched:number;pending_tab_ids:string[]}>('SELECT records_fetched,pending_tab_ids FROM public.sales_sync_runs WHERE id=$1',[id])).rows[0];
    expect(persisted).toEqual({records_fetched:0,pending_tab_ids:[ids[0]]});
    expect((await db.query<{total:string}>('SELECT total FROM public.sales WHERE external_sale_id=$1',[ids[0]])).rows[0].total).toBe('0.00');
    await store.commitTab(ids[0],mapped);expect((await store.finish()).status).toBe('COMPLETED');
  });
  it('ends a healthy time-bound slice with its pending page retained for continuation',async()=>{
    const id=await newRun(),active=await claim(id,0);
    const store=new SupabaseSalesSyncCheckpoint(rpcClient,org,active.run.slice_lease,active.run);
    const operation=new SyncSalesSourceUseCase(source,{persist:async()=>{throw new Error('unused');}});
    const clock=vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(30000);
    const result=await operation.executeSlice(window,{organizationId:org,operationalUnitId:unit,externalLocationId:location,currency:'EUR',syncRunId:id,observedAt:new Date().toISOString(),products:new Map()},store,
      {maxRecords:100,maxPages:2,budgetMs:30000},clock);
    expect(result.continuationRequired).toBe(true);expect(store.state.pending_tab_ids).toHaveLength(100);
    const finished=await store.finish();expect(finished.status).toBe('CONTINUABLE');expect(finished.records_fetched).toBe(0);
  });
});

describe('transparent client continuation',()=>{
  it('continues until the entire run completes without supplying location/window/offset overrides',async()=>{
    const first={id:'run',status:'CONTINUABLE',continuationVersion:1,continuationRequired:true,records_fetched:100};
    const invoke=vi.fn().mockResolvedValueOnce({...first,continuationVersion:2,records_fetched:200}).mockResolvedValueOnce({...first,status:'COMPLETED',continuationVersion:3,continuationRequired:false,records_fetched:235});
    const progress=vi.fn();const final=await continueSalesSyncUntilSettled(first,invoke,'org',progress,()=>true);
    expect(final.status).toBe('COMPLETED');expect(invoke.mock.calls.map(c=>c[0])).toEqual([
      {action:'continue',organizationId:'org',runId:'run',version:1},{action:'continue',organizationId:'org',runId:'run',version:2}]);
    expect(progress).toHaveBeenCalledTimes(3);
  });
  it('stops on actual failure or navigation instead of retrying indefinitely',async()=>{
    const failed={id:'run',status:'FAILED',continuationVersion:1,continuationRequired:true,records_fetched:4};
    const invoke=vi.fn();await continueSalesSyncUntilSettled(failed,invoke,'org',()=>{},()=>true);
    await continueSalesSyncUntilSettled({...failed,status:'CONTINUABLE'},invoke,'org',()=>{},()=>false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
