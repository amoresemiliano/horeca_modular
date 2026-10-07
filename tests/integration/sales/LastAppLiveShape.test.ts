import {describe,it,expect} from 'vitest';
import raw from '../../fixtures/sales/lastapp-test-tab-sanitized.json';
import {mapLastAppSale, type MappingContext} from '../../../src/application/sales/services/LastAppSalesMapper';
import type {SourceTab} from '../../../src/application/sales/ports/SalesSourcePort';
const context: MappingContext={organizationId:'f7f6da70-f7dc-4b1a-aa23-f5612174dcbc',operationalUnitId:'synthetic-in-memory-unit',externalLocationId:raw.locationId,currency:'EUR',syncRunId:'synthetic-in-memory-run',observedAt:'2026-10-07T15:43:09Z',products:new Map()};
const fixture=()=>structuredClone(raw) as SourceTab;
describe('sanitized Last.app TEST read shape',()=>{
it('maps one closed Tab without multiplying Bill lines or money',()=>{const r=mapLastAppSale(fixture(),context);expect(r.sale.total).toBe(7.7);expect(r.sale.paidAmount).toBe(7.7);expect(r.sale.status).toBe('CONFIRMED');expect(r.bills).toHaveLength(1);expect(r.lines).toHaveLength(4);expect(r.lines.reduce((n,l)=>n+l.quantity,0)).toBe(4);expect(r.bills[0]).toMatchObject({total:7.7,taxableBase:7,tax:0.7,taxPercentage:10,discountTotal:0});});
it('rejects duplicate Bills and excludes deleted tender',()=>{const t=fixture();t.bills![0].payments!.push({...t.bills![0].payments![0],id:'synthetic-deleted-payment',deleted:true});expect(mapLastAppSale(t,context).sale.paidAmount).toBe(7.7);t.bills!.push(structuredClone(t.bills![0]));expect(()=>mapLastAppSale(t,context)).toThrow('INVALID_SOURCE_BILLS');});
it('keeps cancellation outside confirmed revenue',()=>{const t=fixture();t.cancelTime=t.closeTime;expect(mapLastAppSale(t,context).sale.status).toBe('VOIDED');});
});
