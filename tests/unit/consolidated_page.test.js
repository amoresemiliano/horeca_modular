import { describe, it, expect } from 'vitest';
import { consolidatedPageRequest, fetchConsolidatedPageWithClient } from '../../src/domains/finance/application/consolidatedPage';
import { createClient } from '@supabase/supabase-js';

function fixture() {
  const calls=[];
  const q={};
  for (const name of ['select','eq','gte','lt','ilike','order','range']) q[name]=(...args)=>{calls.push([name,...args]);return q;};
  q.then=(resolve,reject)=>Promise.resolve({data:Array.from({length:25},(_,id)=>({id})),count:1207,error:null}).then(resolve,reject);
  return {client:{from:name=>{calls.push(['from',name]);return q;}},calls};
}
describe('bounded Consolidado query',()=>{
  it('uses exact count, page 2 and all supported server filters without filtering the displayed allocation embed',async()=>{
    const {client,calls}=fixture();
    const result=await fetchConsolidatedPageWithClient(client,'org',{page:2,pageSize:25,filters:{currency:'EUR',account:'account',month:'2026-12',status:'PENDING',economicType:'OPERATING_EXPENSE',category:'category',counterparty:'party',query:'pan'}});
    expect(result).toMatchObject({page:2,pageSize:25,total:1207});expect(result.rows).toHaveLength(25);
    expect(calls).toContainEqual(['range',25,49]);
    expect(calls).toContainEqual(['eq','organization_id','org']);expect(calls).toContainEqual(['eq','status','ACTIVE']);
    expect(calls).toContainEqual(['eq','source_account_id','account']);expect(calls).toContainEqual(['eq','currency','EUR']);
    expect(calls).toContainEqual(['gte','fecha','2026-12-01']);expect(calls).toContainEqual(['lt','fecha','2027-01-01']);
    for(const pair of [['classification_status','PENDING'],['economic_type','OPERATING_EXPENSE'],['category_id','category'],['counterparty_id','party']]) expect(calls).toContainEqual(['eq',`matching.${pair[0]}`,pair[1]]);
    expect(calls).toContainEqual(['ilike','descripcion','%pan%']);
    const select=calls.find(c=>c[0]==='select');expect(select[1]).toContain('!inner()');expect(select[1]).toContain('allocations:');expect(select[2]).toEqual({count:'exact'});
  });
  it.each([25,50,100])('bounds page size %i',size=>{const {client,calls}=fixture();consolidatedPageRequest(client,'org',{page:3,pageSize:size});expect(calls).toContainEqual(['range',size*2,size*3-1]);});
  it('rejects missing organization and normalizes invalid pages',()=>{const {client,calls}=fixture();expect(()=>consolidatedPageRequest(client,'')).toThrow();consolidatedPageRequest(client,'org',{page:-1,pageSize:500});expect(calls).toContainEqual(['range',0,24]);});
  it('sends one ranged PostgREST request and reads its exact count',async()=>{
    const requests=[];
    const client=createClient('https://example.invalid','synthetic-key',{global:{fetch:async(input,init)=>{requests.push({url:String(input),headers:new Headers(init.headers)});return new Response(JSON.stringify(Array.from({length:25},(_,id)=>({id}))),{status:206,headers:{'Content-Type':'application/json','Content-Range':'25-49/1207'}});}}});
    const result=await fetchConsolidatedPageWithClient(client,'org',{page:2,pageSize:25,filters:{currency:'EUR',status:'PENDING'}});
    expect(requests).toHaveLength(1);expect(result.total).toBe(1207);expect(result.rows).toHaveLength(25);
    const url=new URL(requests[0].url);expect(url.searchParams.get('offset')).toBe('25');expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('matching.classification_status')).toBe('eq.PENDING');expect(requests[0].headers.get('prefer')).toContain('count=exact');
  });
});
