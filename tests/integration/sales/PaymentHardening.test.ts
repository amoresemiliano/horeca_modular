import { describe, it, expect, vi } from 'vitest';
import raw from '../../fixtures/sales/lastapp-test-tab-sanitized.json';
import type { SourceTab, SourcePayment, SalesSourcePort } from '../../../src/application/sales/ports/SalesSourcePort';
import { mapLastAppSale, type MappingContext } from '../../../src/application/sales/services/LastAppSalesMapper';
import { SyncSalesSourceUseCase } from '../../../src/application/sales/useCases/SyncSalesSourceUseCase';

const context: MappingContext = {organizationId:'synthetic-tenant',operationalUnitId:'synthetic-unit',externalLocationId:raw.locationId,
  currency:'EUR',syncRunId:'synthetic-run',observedAt:'2026-10-08T10:00:00Z',products:new Map()};
const fixture = () => structuredClone(raw) as SourceTab;
const cases: Array<[string, (tab: SourceTab) => void]> = [
  ['identical duplicate', t => t.bills![0].payments!.push(structuredClone(t.bills![0].payments![0]))],
  ['conflicting duplicate', t => t.bills![0].payments!.push({...t.bills![0].payments![0],amount:300})],
  ['foreign Bill', t => {t.bills![0].payments![0].billId='foreign-bill';}],
  ['missing Bill', t => {delete t.bills![0].payments![0].billId;}],
  ['missing deleted', t => {delete (t.bills![0].payments![0] as Partial<SourcePayment>).deleted;}],
  ...[null,'false',0].map(value => [`invalid deleted ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{deleted:value});}] as [string,(tab:SourceTab)=>void]),
  ...['', '   ', 3, null].map(value => [`invalid type ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{type:value});}] as [string,(tab:SourceTab)=>void]),
  ...['', '   ', null].map(value => [`invalid ID ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{id:value});}] as [string,(tab:SourceTab)=>void]),
  ...['bad-date','2026-02-30T10:00:00Z','2026-10-08T25:00:00Z',null].map(value => [`invalid time ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{creationTime:value});}] as [string,(tab:SourceTab)=>void]),
  ...['770',1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1].map(value => [`invalid amount ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{amount:value});}] as [string,(tab:SourceTab)=>void]),
  ...[null,'0',0.5,-1,Infinity].map(value => [`invalid tip ${String(value)}`, (t: SourceTab) => {Object.assign(t.bills![0].payments![0],{tip:value});}] as [string,(tab:SourceTab)=>void]),
];

describe('payment financial validation before canonical persistence', () => {
  it.each(cases)('rejects %s without starting a canonical mutation', async (_label, change) => {
    const tab=fixture();change(tab);
    expect(()=>mapLastAppSale(tab,context)).toThrow();
    const source={getTab:vi.fn().mockResolvedValue(tab),getBill:vi.fn().mockResolvedValue(tab.bills![0])} as unknown as SalesSourcePort;
    const persist=vi.fn();const result=await new SyncSalesSourceUseCase(source,{persist}).execute(
      {locationId:tab.locationId,startDate:context.observedAt,endDate:context.observedAt},context,async()=>{},tab.id);
    expect(result.rejected).toBe(1);expect(persist).not.toHaveBeenCalled();
  });
  it('preserves single, multiple, partial, deleted and tip facts',()=>{
    const tab=fixture(),first=tab.bills![0].payments![0];
    expect(mapLastAppSale(tab,context).sale.paidAmount).toBe(7.7);
    first.amount=300;first.tip=0;expect(mapLastAppSale(tab,context).sale.paidAmount).toBe(3);
    tab.bills![0].payments!.push({...first,id:'second-stable-payment',amount:470,tip:100});
    const result=mapLastAppSale(tab,context);expect(result.sale.paidAmount).toBe(7.7);
    expect((result.bills[0].payments as Array<{tip:number}>)[1].tip).toBe(1);
    first.deleted=true;expect(mapLastAppSale(tab,context).sale.paidAmount).toBe(4.7);
    first.amount=770;tab.bills![0].payments!.pop();
    const deleted=mapLastAppSale(tab,context);expect(deleted.sale.paidAmount).toBe(0);
    expect((deleted.bills[0].payments as Array<{deleted:boolean}>)[0].deleted).toBe(true);
  });
  it('rejects reuse of a payment identity across different Bills',()=>{
    const tab=fixture();const second=structuredClone(tab.bills![0]);second.id='another-bill';second.payments![0].billId=second.id;
    tab.bills!.push(second);expect(()=>mapLastAppSale(tab,context)).toThrow('INVALID_SOURCE_PAYMENTS');
  });
  it('retains only minimized facts even when processor PII is supplied',()=>{
    const tab=fixture();Object.assign(tab.bills![0].payments![0],{cardholder:'private-cardholder',metadata:{phone:'private-phone'}});
    expect(JSON.stringify(mapLastAppSale(tab,context).bills)).not.toMatch(/private-|metadata|cardholder/);
  });
});
