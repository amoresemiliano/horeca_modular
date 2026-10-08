import { describe, it, expect, vi } from 'vitest';
import { LastAppAdapter } from '../../../src/infrastructure/sales/lastapp/LastAppAdapter';
import { LastAppRateLimiter } from '../../../src/infrastructure/sales/lastapp/LastAppRateLimiter';
// Transport tests isolate HTTP behavior; distributed budget behavior has its own suite.
const rateLimiter = new LastAppRateLimiter({reserve:async()=>({allowed:true,retry_after_ms:0})});
import { mapLastAppSale, sourceMoney, MappingContext } from '../../../src/application/sales/services/LastAppSalesMapper';
import { validateLastAppWebhook } from '../../../src/infrastructure/sales/lastapp/LastAppWebhook';
import type { SourceTab } from '../../../src/application/sales/ports/SalesSourcePort';
import { SyncSalesSourceUseCase } from '../../../src/application/sales/useCases/SyncSalesSourceUseCase';
import { CrossModuleContractsExporter } from '../../../src/domain/sales/contracts/CrossModuleContracts';

export const context: MappingContext = {organizationId:'10000000-0000-0000-0000-000000000001',
  operationalUnitId:'20000000-0000-0000-0000-000000000001',externalLocationId:'30000000-0000-0000-0000-000000000001',
  currency:'EUR',syncRunId:'40000000-0000-0000-0000-000000000001',observedAt:'2026-10-02T10:00:00Z',products:new Map()};
export function fixture(): SourceTab {
  return {id:'50000000-0000-0000-0000-000000000001',locationId:context.externalLocationId,
    creationTime:'2026-10-01T10:00:00Z',closeTime:'2026-10-01T11:00:00Z',code:'R1',source:'Restaurant',
    products:[{id:'product-1',name:'Burger',quantity:2,price:1000,catalogProductId:'catalog-1',
      modifiers:[{id:'modifier-1',name:'Cheese',quantity:1,priceImpact:100,catalogModifierId:'modifier-catalog'}],
      comboProducts:[{id:'component-1',name:'Fries',quantity:1,price:200}]}],
    bills:[{id:'60000000-0000-0000-0000-000000000001',number:'A1',creationTime:'2026-10-01T11:00:00Z',
      total:2200,tax:200,taxableBase:2000,taxPercentage:10,discountTotal:100,deliveryFee:200,minimumBasketSurcharge:100,terraceSurcharge:50,
      products:[{id:'bill-product-1',tabProductId:'product-1',catalogProductId:'catalog-1',name:'Burger',quantity:2,price:1000,originalPrice:1100}],
      payments:[{id:'payment-1',billId:'60000000-0000-0000-0000-000000000001',type:'card',amount:2200,tip:100,deleted:false,creationTime:'2026-10-01T11:00:00Z'},
        {id:'payment-deleted',billId:'60000000-0000-0000-0000-000000000001',type:'cash',amount:2200,deleted:true,creationTime:'2026-10-01T10:00:00Z'}]}]};
}
const window = {locationId:context.externalLocationId,startDate:'2026-10-01T00:00:00Z',endDate:'2026-10-02T00:00:00Z',limit:5};
describe('Last.app v2 safe read adapter', () => {
  it('rejects missing credentials',()=>expect(()=>new LastAppAdapter({token:'',rateLimiter})).toThrow('LAST_APP_NOT_CONFIGURED'));
  it.each([401,403,400,404])('normalizes HTTP %i without leaking bodies',async status=>{
    const http=vi.fn().mockResolvedValue(new Response('private source payload',{status}));
    const adapter=new LastAppAdapter({token:'sanitized-test-token',fetch:http,rateLimiter});
    await expect(adapter.getTab('location','tab')).rejects.toThrow(status===401||status===403?'SOURCE_AUTH_FAILED':'SOURCE_HTTP_ERROR');
    expect(http).toHaveBeenCalledTimes(1);
  });
  it('paginates array responses, passes documented context and uses only GET',async()=>{
    const http=vi.fn().mockResolvedValueOnce(Response.json(Array.from({length:5},(_,i)=>({id:String(i)}))))
      .mockResolvedValueOnce(Response.json([{id:'6'}]));
    const adapter=new LastAppAdapter({token:'sanitized-test-token',fetch:http,rateLimiter});
    const pages=[]; for await(const page of adapter.listTabs(window))pages.push(page);
    expect(pages.map(p=>p.records.length)).toEqual([5,1]);
    expect(http.mock.calls[1][0]).toContain('offset=5');
    expect(http.mock.calls[0][1]).toMatchObject({method:'GET',headers:{LocationID:window.locationId}});
  });
  it('honors Retry-After and succeeds after 429',async()=>{
    const sleep=vi.fn().mockResolvedValue(undefined);
    const http=vi.fn().mockResolvedValueOnce(new Response(null,{status:429,headers:{'Retry-After':'2'}})).mockResolvedValueOnce(Response.json([]));
    await new LastAppAdapter({token:'test',fetch:http,sleep,rateLimiter}).listOrganizations();
    expect(sleep).toHaveBeenCalledWith(2000);
  });
  it('never retries earlier than an excessive Retry-After',async()=>{
    const sleep=vi.fn(); const http=vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'Retry-After':'60'}}));
    await expect(new LastAppAdapter({token:'test',fetch:http,sleep,rateLimiter}).listOrganizations()).rejects.toThrow('SOURCE_RATE_LIMITED');
    expect(http).toHaveBeenCalledTimes(1); expect(sleep).not.toHaveBeenCalled();
  });
  it.each([429,500,503])('bounds retry on %i',async status=>{
    const http=vi.fn().mockResolvedValue(new Response(null,{status}));
    await expect(new LastAppAdapter({token:'test',fetch:http,sleep:async()=>{},rateLimiter}).listOrganizations()).rejects.toThrow();
    expect(http).toHaveBeenCalledTimes(3);
  });
  it('bounds network failure and strips its sensitive exception',async()=>{
    const http=vi.fn().mockRejectedValue(new Error('token-secret'));
    await expect(new LastAppAdapter({token:'test',fetch:http,sleep:async()=>{},rateLimiter}).listOrganizations()).rejects.toThrow('SOURCE_TRANSPORT_ERROR');
    expect(http).toHaveBeenCalledTimes(3);
  });
  it('aborts timed-out reads',async()=>{
    const http=vi.fn((_url,init)=>new Promise<Response>((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
    await expect(new LastAppAdapter({token:'test',fetch:http as typeof fetch,timeoutMs:5,maxAttempts:1,rateLimiter}).listOrganizations()).rejects.toThrow('SOURCE_TIMEOUT');
  });
  it('enforces window and page bounds',async()=>{
    const adapter=new LastAppAdapter({token:'test',fetch:vi.fn().mockResolvedValue(Response.json(Array(5).fill({id:'tab'}))),maxPages:1,rateLimiter});
    await expect((async()=>{for await(const page of adapter.listTabs(window))void page;})()).rejects.toThrow('SOURCE_PAGE_BUDGET_EXCEEDED');
    await expect((async()=>{for await(const page of adapter.listTabs({...window,limit:101}))void page;})()).rejects.toThrow('INVALID_SOURCE_WINDOW');
  });
});
describe('canonical Sales mapping and lifecycle',()=>{
  it('maps money, structured hierarchy, bill IDs, deleted tender, taxes, fees and discounts',()=>{
    const result=mapLastAppSale(fixture(),context);
    expect(result.sale.total).toBe(22); expect(result.sale.paidAmount).toBe(22);
    expect(result.sale.status).toBe('CONFIRMED');
    expect(result.lines.map(l=>l.itemType)).toEqual(['PRODUCT','MODIFIER','COMBO_COMPONENT']);
    expect(result.lines[1].parentLineId).toBe(result.lines[0].id);
    expect(result.bills[0]).toMatchObject({tax:2,taxableBase:20,taxPercentage:10,discountTotal:1,deliveryFee:2,minimumBasketSurcharge:1,terraceSurcharge:0.5});
    expect(result.lines[1].sourceFacts).toMatchObject({externalModifierId:'modifier-1',priceImpact:1});
    expect(result.unmappedProducts).toBe(2);
  });
  it('uses stable UUID identity independently of totals, codes and tenant',()=>{
    const tab=fixture(); const before=mapLastAppSale(tab,context);
    tab.code='changed'; tab.bills![0].total=3300;
    const after=mapLastAppSale(tab,context);
    expect(after.sale.externalIdentityKey).toBe(before.sale.externalIdentityKey);
    expect(after.sale.sourceFingerprint).not.toBe(before.sale.sourceFingerprint);
    expect(mapLastAppSale(tab,{...context,organizationId:'another-tenant'}).sale.externalIdentityKey).not.toBe(before.sale.externalIdentityKey);
    expect(after.sale.externalSaleId).toBe(tab.id);
  });
  it('preserves multiple bills without producing multiple Sales',()=>{
    const tab=fixture(); tab.bills!.push({...tab.bills![0],id:'60000000-0000-0000-0000-000000000002',payments:[]});
    const result=mapLastAppSale(tab,context); expect(result.sale.total).toBe(44); expect(result.bills).toHaveLength(2);
  });
  it('explicitly maps, ignores or accepts unmapped products',()=>{
    for(const status of ['MAPPED','IGNORED','UNMAPPED'] as const) {
      const result=mapLastAppSale(fixture(),{...context,products:new Map([['catalog-1',{status,productId:status==='MAPPED'?'canonical-product':undefined}]])});
      expect(result.lines[0].sourceFacts?.mappingStatus).toBe(status);
      expect(result.lines[0].catalogProductId).toBe(status==='MAPPED'?'canonical-product':null);
    }
  });
  it('rejects missing location mapping and incomplete source state',()=>{
    expect(()=>mapLastAppSale(fixture(),{...context,operationalUnitId:''})).toThrow('SOURCE_SCOPE_MISMATCH');
    expect(()=>mapLastAppSale(fixture(),{...context,externalLocationId:'wrong'})).toThrow('SOURCE_SCOPE_MISMATCH');
    expect(()=>mapLastAppSale({...fixture(),products:undefined},context)).toThrow('INCOMPLETE_SOURCE_TAB');
  });
  it('excludes cancelled, open and unproven rectifications from confirmed revenue',()=>{
    const tab=fixture(); tab.cancelTime='2026-10-01T12:00:00Z'; expect(mapLastAppSale(tab,context).sale.status).toBe('VOIDED');
    delete tab.cancelTime; tab.closeTime=null; expect(mapLastAppSale(tab,context).sale.status).toBe('OPEN');
    tab.closeTime='2026-10-01T12:00:00Z';tab.bills![0].rectifiedBillNumber='A0';expect(mapLastAppSale(tab,context).sale.status).toBe('REVIEW_REQUIRED');
  });
  it('does not send cancelled quantities to Inventory and propagates lifecycle to Finance/Analytics',()=>{
    const tab=fixture();tab.cancelTime='2026-10-01T12:00:00Z';
    const result=mapLastAppSale(tab,{...context,products:new Map([['catalog-1',{status:'MAPPED',productId:'canonical-product'}]])});
    expect(CrossModuleContractsExporter.toInventoryConsumptionSignals(result.sale,result.lines)).toEqual([]);
    expect(CrossModuleContractsExporter.toFinanceReconciliationInput(result.sale).status).toBe('VOIDED');
    expect(CrossModuleContractsExporter.toAnalyticsRevenueFact(result.sale,result.lines).externalSaleId).toBe(tab.id);
  });
  it('detects canonical product remapping even when the source facts stay unchanged',()=>{
    const before=mapLastAppSale(fixture(),{...context,products:new Map([['catalog-1',{status:'MAPPED',productId:'product-a'}]])});
    const after=mapLastAppSale(fixture(),{...context,products:new Map([['catalog-1',{status:'MAPPED',productId:'product-b'}]])});
    expect(before.sale.sourceFingerprint).not.toBe(after.sale.sourceFingerprint);
  });
  it('does not copy PII into any generic provenance',()=>{
    const tab={...fixture(),customerInfo:{email:'private@example.test',phoneNumber:'private-phone'},delivery:{address:'private-address'},customerNote:'private-note',customerId:'private-id'};
    const result=mapLastAppSale(tab,context);
    expect(JSON.stringify({sale:result.sale.toJSON(),lines:result.lines.map(l=>l.toJSON()),bills:result.bills})).not.toMatch(/private-|private@example|customerInfo|customerNote|delivery.*address/);
  });
  it('rejects API strings, NaN and fractional minor units at the single boundary',()=>{
    expect(sourceMoney(1498070)).toBe(14980.7);
    for(const amount of [NaN,Infinity,1.2,'1.200,00'])expect(()=>sourceMoney(amount as number)).toThrow();
  });
});
describe('webhook security and source refresh',()=>{
  const event={id:'event-1',type:'tab:closed',created:'2026-10-02T10:00:00Z',data:{id:fixture().id,locationId:context.externalLocationId,customerInfo:{email:'private@example.test'}}};
  it('validates the official Bearer scheme, minimizes metadata and keeps independent event identity',()=>{
    expect(()=>validateLastAppWebhook('Bearer wrong','test',event,undefined)).toThrow('DENIED');
    expect(()=>validateLastAppWebhook('Bearer test','',event,undefined)).toThrow('DENIED');
    const receipt=validateLastAppWebhook('Bearer test','test',event,context.externalLocationId);
    expect(receipt.source_event_id).toBe('event-1'); expect(JSON.stringify(receipt)).not.toContain('private');
    expect(()=>validateLastAppWebhook('Bearer test','test',event,'wrong-location')).toThrow('INVALID_EVENT');
  });
  it('refreshes authoritative detail for a targeted event and reports durable progress',async()=>{
    const source={getTab:vi.fn().mockResolvedValue(fixture()),getBill:vi.fn().mockResolvedValue(fixture().bills![0])} as unknown as LastAppAdapter;
    const sink={persist:vi.fn().mockResolvedValue('created')}; const progress=vi.fn().mockResolvedValue(undefined);
    const result=await new SyncSalesSourceUseCase(source,sink).execute(window,context,progress,fixture().id);
    expect(source.getTab).toHaveBeenCalledWith(window.locationId,fixture().id);
    expect(result.created).toBe(1);expect(result.records_fetched).toBe(1);expect(progress).toHaveBeenCalled();
  });
});
