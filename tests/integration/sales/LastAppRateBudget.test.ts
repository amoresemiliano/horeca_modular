import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LastAppRateLimiter, type RateBudgetStore, type RateReservation } from '../../../src/infrastructure/sales/lastapp/LastAppRateLimiter';
import { LastAppAdapter } from '../../../src/infrastructure/sales/lastapp/LastAppAdapter';
import { SupabaseLastAppRateBudget } from '../../../src/infrastructure/sales/lastapp/SupabaseLastAppRateBudget';
import type { SupabaseClient } from '@supabase/supabase-js';

const location='30000000-0000-0000-0000-000000000001';
describe('distributed Last.app request admission with authoritative PostgreSQL state',()=>{
  let db:PGlite;let now=0;
  const epoch=Date.parse('2026-10-08T00:00:00Z');
  const sleep=async(ms:number)=>{now+=ms;};
  const store:RateBudgetStore={reserve:async(hash,kind,entity)=>{
    await db.query(`SELECT set_config('test.rate_now',$1,false)`,[new Date(epoch+now).toISOString()]);
    const result=await db.query<{result:RateReservation}>(`SELECT public.sales_reserve_lastapp_request($1,$2,$3) result`,[hash,kind,entity]);
    return result.rows[0].result;
  }};
  const limiter=()=>new LastAppRateLimiter(store,()=>now,sleep);
  const adapter=(token:string,times:number[],reply:()=>Response=()=>Response.json([]))=>new LastAppAdapter({token,rateLimiter:limiter(),now:()=>now,sleep,
    fetch:async()=>{times.push(now);return reply();}});
  beforeAll(async()=>{
    db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE FUNCTION public.test_rate_clock() RETURNS timestamptz LANGUAGE sql AS $$ SELECT current_setting('test.rate_now')::timestamptz $$;`);
    // Only the clock expression changes in this local replay; production RPC has no caller-supplied timestamp.
    await db.exec(readFileSync('supabase/migrations/20261008100000_lastapp_request_budgets.sql','utf8').replaceAll('clock_timestamp()','public.test_rate_clock()'));
  },30000);
  afterAll(async()=>{await db?.close();});
  it('cannot dispatch 16 serial attempts in a one-second budget',async()=>{
    now=0;const times:number[]=[];const source=adapter('burst',times);
    for(let i=0;i<16;i++)await source.getTab(location,'tab');
    expect(times[15]-times[0]).toBeGreaterThanOrEqual(1000);
    for(const end of times)expect(times.filter(t=>t>end-1000&&t<=end).length).toBeLessThanOrEqual(15);
  });
  it('keeps sustained requests inside every rolling ten-minute budget',async()=>{
    now=0;const times:number[]=[];const source=adapter('sustained',times);
    for(let i=0;i<1501;i++)await source.getTab(location,'tab');
    let start=0;for(let end=0;end<times.length;end++){while(times[start]<=times[end]-600000)start++;expect(end-start+1).toBeLessThanOrEqual(1500);}
  },30000);
  it('separates organizations discovery starts by at least one second across clients',async()=>{
    now=0;const times:number[]=[];await adapter('org-token',times).listOrganizations();await adapter('org-token',times).listOrganizations();
    expect(times[1]-times[0]).toBeGreaterThanOrEqual(1000);
  });
  it('coordinates separate logical clients and keeps unrelated entity buckets independent',async()=>{
    now=0;const hash='a'.repeat(64);
    const results=await Promise.all([store.reserve(hash,'location',location),store.reserve(hash,'location',location)]);
    expect(results.filter(r=>r.allowed)).toHaveLength(1);
    expect((await store.reserve(hash,'location','30000000-0000-0000-0000-000000000002')).allowed).toBe(true);
    const times:number[]=[];await adapter('shared-adapters',times).getTab(location,'first');await adapter('shared-adapters',times).getTab(location,'second');
    expect(times[1]-times[0]).toBeGreaterThanOrEqual(402);
  });
  it('counts retries and honors a greater Retry-After',async()=>{
    now=0;const times:number[]=[];let replies=0;
    const source=adapter('retry-token',times,()=>++replies===1?new Response(null,{status:429,headers:{'Retry-After':'2'}}):Response.json([]));
    await source.getTab(location,'tab');expect(times).toEqual([0,2000]);
    const reservations=await db.query<{next:number}>(`SELECT extract(epoch FROM next_allowed_at)*1000 AS next FROM public.sales_lastapp_request_budgets WHERE token_hash=$1`,[createHash('sha256').update('retry-token').digest('hex')]);
    expect(Number(reservations.rows[0].next)).toBe(epoch+2402);
  });
  it('fails safely when an admission wait cannot fit its deadline',async()=>{
    now=0;const first=limiter();await first.acquire('deadline-token',{LocationID:location},5000);
    await expect(limiter().acquire('deadline-token',{LocationID:location},100)).rejects.toThrow('SOURCE_RATE_DEADLINE');
  });
  it('denies browser table access and RPC execution',async()=>{
    const privileges=await db.query<{table_read:boolean;rpc_execute:boolean}>(`SELECT has_table_privilege('authenticated','public.sales_lastapp_request_budgets','SELECT') table_read,
      has_function_privilege('authenticated','public.sales_reserve_lastapp_request(text,text,text)','EXECUTE') rpc_execute`);
    expect(privileges.rows[0]).toEqual({table_read:false,rpc_execute:false});
  });
});

describe('bounded coordinator failure, stale permits and cancellation',()=>{
  it('fails closed without a configured coordinator',()=>{
    expect(()=>new LastAppAdapter({token:'synthetic'} as never)).toThrow('LAST_APP_RATE_CONTROL_NOT_CONFIGURED');
  });
  it('does not dispatch HTTP after coordinator failure',async()=>{
    const fetch=vi.fn(),rateLimiter=new LastAppRateLimiter({reserve:async()=>{throw Error('private database error');}});
    await expect(new LastAppAdapter({token:'synthetic',rateLimiter,fetch}).getTab(location,'tab')).rejects.toThrow('SOURCE_RATE_COORDINATOR_UNAVAILABLE');expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects a stale RPC response and a permit delayed before dispatch',async()=>{
    let now=0;const limiter=new LastAppRateLimiter({reserve:async()=>({allowed:true,retry_after_ms:0})},()=>now);
    const permit=await limiter.acquire('synthetic',{LocationID:location},5000);now=1000;expect(()=>permit.assertFresh()).toThrow('SOURCE_RATE_PERMIT_EXPIRED');
    const late=new LastAppRateLimiter({reserve:async()=>{now+=1000;return {allowed:true,retry_after_ms:0};}},()=>now);
    await expect(late.acquire('synthetic',{LocationID:location},5000)).rejects.toThrow('SOURCE_RATE_PERMIT_EXPIRED');
  });
  it('bounds contention and rejects an aborted caller without claiming',async()=>{
    let now=0;const reserve=vi.fn(async()=>({allowed:false,retry_after_ms:1}));const limiter=new LastAppRateLimiter({reserve},()=>now,async ms=>{now+=ms;});
    await expect(limiter.acquire('synthetic',{LocationID:location},1000)).rejects.toThrow('SOURCE_RATE_CONTENTION');expect(reserve).toHaveBeenCalledTimes(8);
    const controller=new AbortController();controller.abort();await expect(limiter.acquire('synthetic',undefined,1000,controller.signal)).rejects.toThrow('SOURCE_CANCELLED');expect(reserve).toHaveBeenCalledTimes(8);
  });
  it('cancels an in-flight reservation and bounds a nonresponsive coordinator',async()=>{
    vi.useFakeTimers();try{
      const controller=new AbortController();const limiter=new LastAppRateLimiter({reserve:()=>new Promise(()=>{})});
      const cancelled=expect(limiter.acquire('synthetic',undefined,performance.now()+10000,controller.signal)).rejects.toThrow('SOURCE_CANCELLED');controller.abort();await cancelled;
      const timed=expect(limiter.acquire('synthetic',undefined,performance.now()+10000)).rejects.toThrow('SOURCE_RATE_DEADLINE');await vi.advanceTimersByTimeAsync(1000);await timed;
    }finally{vi.useRealTimers();}
  });
  it('passes only a digest/context to the trusted RPC and uses its abort signal',async()=>{
    const abortSignal=vi.fn(),rpc=vi.fn(()=>{const result=Promise.resolve({data:{allowed:true,retry_after_ms:0},error:null});return Object.assign(result,{abortSignal:(signal:AbortSignal)=>{abortSignal(signal);return result;}});});
    const client={rpc} as unknown as SupabaseClient;const signal=new AbortController().signal;
    await new SupabaseLastAppRateBudget(client).reserve('a'.repeat(64),'location',location,signal);
    expect(rpc).toHaveBeenCalledWith('sales_reserve_lastapp_request',{p_token_hash:'a'.repeat(64),p_kind:'location',p_entity:location});expect(abortSignal).toHaveBeenCalledWith(signal);
  });
});
