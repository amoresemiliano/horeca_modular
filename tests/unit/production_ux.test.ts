import { describe,it,expect,vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { batchFixture,detailFixture,ownerFixture,scope,product,pack,location,version,line } from '../fixtures/productionUx';
import { businessToday, declarationFromBatch, draftDeclaration, fieldsFromBatch, planningProjection, previewDraft, ProductionCommandSession, scopedOwners } from '../../src/modules/produccion/application/workflow';
import { ProductionReadService } from '../../src/modules/produccion/application/ProductionReadService';
import { ProductionService } from '../../src/modules/produccion/application/ProductionService';
import { productionMessage } from '../../src/modules/produccion/application/errors';
import { unavailableOwners } from '../../src/modules/produccion/application/readModels';
import type { ProductionCommand } from '../../src/modules/produccion/domain/contracts';

const input:Omit<ProductionCommand,'request_id'>={organization_id:scope.organizationId,operational_unit_id:scope.operationalUnitId,command:'create_draft',entity_id:batchFixture().id,expected_revision:0,body:{mode:'MANUAL_OUTPUT',effective_date:'2026-10-15',outputs:[{line_id:line,product_id:product,package_id:pack,package_version:version,count:20,destination_location_id:location,mode:'PACKAGED'}],consumptions:[]}};
describe('Production operational application behavior',()=>{
  it('uses the Madrid effective date across UTC midnight',()=>expect(businessToday(new Date('2026-10-15T22:30:00Z'))).toBe('2026-10-16'));
  it('edits canonical IDs/count/date with exact visible conversion and explicit manual output',()=>{
    const fields={...fieldsFromBatch(batchFixture()),effectiveDate:'2026-10-15',count:'20'};
    expect(previewDraft(fields,ownerFixture())).toMatchObject({quantity:'30.000000',unit:'kg',conversion:'20 × 1.5 kg'});
    const declaration=draftDeclaration(fields,ownerFixture());
    expect(declaration).toMatchObject({mode:'MANUAL_OUTPUT',effective_date:'2026-10-15',consumptions:[],outputs:[{product_id:product,count:20,package_version:version}]});
    expect(declaration.outputs[0]).not.toHaveProperty('conversion_snapshot');
    expect(declarationFromBatch(batchFixture())).toEqual({...declaration,effective_date:batchFixture().effective_date,shift:'Mañana',notes:'Synthetic UI test only'});
  });
  it('rejects unknown, incompatible and guessed package conversions',()=>{
    const fields=fieldsFromBatch(batchFixture());
    for(const mutation of [()=>{const x=ownerFixture();x.packages=[];return x;},()=>{const x=ownerFixture();x.packages[0].net_quantity='';return x;},()=>{const x=ownerFixture();x.packages[0].unit='L';return x;}])expect(()=>previewDraft(fields,mutation())).toThrow();
    expect(()=>previewDraft({...fields,count:'1.5'},ownerFixture())).toThrow('INVALID_PACKAGE_COUNT');
  });
  it('only permits explicitly approved loose quantities and preserves declared actuals',()=>{
    const fields={...fieldsFromBatch(batchFixture()),loose:true,quantity:'0.125'};
    expect(previewDraft(fields,ownerFixture()).quantity).toBe('0.125000');
    const owners=ownerFixture();owners.products[0].loose_allowed=false;
    expect(()=>previewDraft(fields,owners)).toThrow();
    const prior=declarationFromBatch(batchFixture());prior.consumptions=[{line_id:line,product_id:product,source_location_id:location,unit:'kg',quantity:'3.5'}];
    expect(draftDeclaration(fields,ownerFixture(),prior).consumptions).toEqual(prior.consumptions);
  });
  it('has a controlled unavailable port with no fallback data and filters foreign references',async()=>{
    const unavailable=await unavailableOwners.load(scope);expect(unavailable.products).toEqual([]);expect(unavailable.stock).toEqual([]);
    expect(()=>previewDraft(fieldsFromBatch(batchFixture()),unavailable)).toThrow('OWNER_CONTRACT_UNAVAILABLE');
    const owners=ownerFixture();owners.products[0].organization_id='foreign';expect(scopedOwners(owners,scope).products).toEqual([]);expect(scopedOwners(owners,scope).packages).toEqual([]);
    expect(productionMessage(Error('OWNER_CONTRACT_UNAVAILABLE'))).toContain('todavía no están disponibles');
  });
  it.each([['29','CRITICAL'],['30','NECESSARY'],['47.5','OPTIMAL'],['100','OPTIMAL'],['101','EXCESS'],[null,'UNKNOWN']])('keeps planning boundary %s as %s',(actual,state)=>expect(planningProjection('30','100',actual).state).toBe(state));
  it('treats malformed stock as unavailable rather than zero',()=>expect(planningProjection('30','100','not-a-quantity')).toEqual({state:'UNKNOWN',suggestedQuantity:null}));
  it('coalesces repeated submit and reuses the previous result',async()=>{
    const execute=vi.fn(async()=>({entity_id:input.entity_id,revision:1,status:'DRAFT'}));
    const session=new ProductionCommandSession({execute},()=>true,()=>line);
    const first=session.execute(input),second=session.execute(input);expect(first).toBe(second);await first;await session.execute(input);
    expect(execute).toHaveBeenCalledTimes(1);expect(execute.mock.calls[0]).toHaveLength(1);
  });
  it('retains the same request ID after uncertain transport failure, with a new ID for changed intent',async()=>{
    const requests:ProductionCommand[]=[];let id=0;
    const session=new ProductionCommandSession({execute:async request=>{requests.push(request);if(requests.length===1)throw Error('network');return {entity_id:input.entity_id,revision:1,status:'DRAFT'};}},()=>true,()=>String(++id));
    await expect(session.execute(input)).rejects.toThrow('network');await session.execute(input);await session.execute({...input,expected_revision:1});
    expect(requests.map(r=>r.request_id)).toEqual(['1','1','2']);
  });
  it('does not let a logging operator confirm, correct or confirm waste, including after revoke',async()=>{
    let allowed=true;const execute=vi.fn(async()=>({entity_id:input.entity_id,revision:1,status:'DRAFT'}));const session=new ProductionCommandSession({execute},key=>allowed&&key==='log');
    for(const command of ['confirm_batch','correct_batch','confirm_waste'] as const)await expect(session.execute({...input,command})).rejects.toThrow('PRODUCTION_ACCESS_DENIED');
    await session.execute(input);allowed=false;await expect(session.execute(input)).rejects.toThrow('PRODUCTION_ACCESS_DENIED');expect(execute).toHaveBeenCalledTimes(1);
  });
  it('surfaces safe stale revision and unavailable errors instead of SQL details',async()=>{
    for(const message of ['STALE_REVISION','OWNER_CONTRACT_UNAVAILABLE']){
      const service=new ProductionService({rpc:async()=>({data:null,error:{code:'P0001',message}})});
      await expect(service.execute({...input,request_id:line})).rejects.toThrow(message);
    }
    expect(productionMessage(Error('private diagnostic'))).not.toContain('private diagnostic');
  });
});

function readFixture(response:(url:URL)=>unknown) {
  const requests:URL[]=[];
  const client=createClient('https://production-test.invalid','synthetic',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async value=>{const url=new URL(String(value));requests.push(url);return Response.json(response(url));}}});
  return {service:new ProductionReadService(client),requests};
}
describe('Production scoped read projections through the real PostgREST client',()=>{
  it('scopes history, applies filters and uses bounded stable keyset paging',async()=>{
    const {service,requests}=readFixture(()=>Array.from({length:21},(_,n)=>({...batchFixture(),id:`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`})));
    const result=await service.history(scope,{date:'2026-10-15',status:'DRAFT'});
    expect(result.items).toHaveLength(20);expect(result.next).toBeDefined();
    const query=requests[0].searchParams;expect(query.get('organization_id')).toBe('eq.'+scope.organizationId);expect(query.get('operational_unit_id')).toBe('eq.'+scope.operationalUnitId);expect(query.get('effective_date')).toBe('eq.2026-10-15');expect(query.get('limit')).toBe('21');
    await service.history(scope,{cursor:result.next});expect(requests[1].searchParams.get('or')).toContain(result.next!.id);
  });
  it('filters draft and immutable current-output product streams before pagination',async()=>{
    const {service,requests}=readFixture(()=>[]);await service.history(scope,{productId:product});expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get('draft->outputs')).toContain(product);expect(requests[1].searchParams.get('execution.snapshot->outputs')).toContain(product);expect(requests[1].searchParams.get('select')).toContain('!inner');
  });
  it('merges filtered streams at PostgreSQL microsecond precision before UUID ordering',async()=>{
    const {service}=readFixture(url=>[{...batchFixture(),id:url.searchParams.get('select')?.includes('!inner')?'90000000-0000-4000-8000-000000000001':'90000000-0000-4000-8000-000000000099',recorded_at:url.searchParams.get('select')?.includes('!inner')?'2026-10-16T10:00:00.000002+00:00':'2026-10-16T10:00:00.000001+00:00'}]);
    const page=await service.history(scope,{productId:product});expect(page.items[0].recorded_at).toBe('2026-10-16T10:00:00.000002+00:00');
  });
  it('loads detail/revisions/waste confirmations/outbox using the same scope and explicit caps',async()=>{
    const d=detailFixture();const {service,requests}=readFixture(url=>url.pathname.endsWith('eco_production_batches')?d.batch:url.pathname.endsWith('eco_production_wastes')?[{id:line,quantity:'0.1'}]:url.pathname.endsWith('eco_production_waste_confirmations')?[{waste_id:line}]:[]);
    const result=await service.detail(scope,d.batch.id);expect(result.wastes[0].confirmed).toBe(true);
    for(const url of requests){expect(url.searchParams.get('organization_id')).toBe('eq.'+scope.organizationId);expect(url.searchParams.get('operational_unit_id')).toBe('eq.'+scope.operationalUnitId);}
    expect(requests.filter(r=>r.searchParams.get('batch_id'))).toHaveLength(3);expect(requests.find(r=>r.pathname.endsWith('eco_production_executions'))?.searchParams.get('limit')).toBe('51');
  });
  it('requests decimals as text and refuses missing scope or malformed cursor before network',async()=>{
    const {service,requests}=readFixture(()=>[]);await service.policies(scope);expect(requests[0].searchParams.get('select')).toContain('minimum::text');
    await expect(service.history({...scope,organizationId:''},{})).rejects.toThrow('PRODUCTION_ACCESS_DENIED');
    await expect(service.history(scope,{cursor:{id:line,recordedAt:'bad,or'}})).rejects.toThrow('INVALID_COMMAND');expect(requests).toHaveLength(1);
  });
});
