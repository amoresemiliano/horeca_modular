import type { SalesSourcePort, SourceWindow } from '../ports/SalesSourcePort';
import { mapLastAppSale, MappingContext } from '../services/LastAppSalesMapper';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';
import type { SalesSyncCheckpointPort } from '../ports/SalesSyncCheckpointPort';

export interface SalesSyncEvidence {
  pages_fetched: number; records_fetched: number; created: number; updated: number;
  unchanged: number; rejected: number; unmapped_products: number;
}
export interface CanonicalSalesSink {
  persist(sale: Sale, lines?: SaleLine[], bills?: Record<string, unknown>[]): Promise<'created'|'updated'|'unchanged'>;
}
/** No HTTP, credentials, scheduling or authorization policy inside this operation. */
export class SyncSalesSourceUseCase {
  constructor(private readonly source: SalesSourcePort, private readonly sink: CanonicalSalesSink) {}
  async executeSlice(window: SourceWindow, context: MappingContext, checkpoint: SalesSyncCheckpointPort,
    bounds = {maxRecords:100,maxPages:2,budgetMs:30000}, now: () => number = Date.now) {
    if (bounds.maxRecords < 1 || bounds.maxRecords > 100 || bounds.maxPages < 1 || bounds.maxPages > 2 || bounds.budgetMs <= 0 || bounds.budgetMs > 30000) throw new Error('INVALID_SLICE_BOUNDS');
    const deadline=now()+bounds.budgetMs;
    let records=0,pages=0;
    while (records<bounds.maxRecords && now()<deadline) {
      if (!checkpoint.state.pending_tab_ids.length) {
        if (checkpoint.state.source_exhausted) break;
        if (pages>=bounds.maxPages) break;
        const iterator=this.source.listTabs({...window,offset:checkpoint.state.next_offset})[Symbol.asyncIterator]();
        const page=await iterator.next();
        await iterator.return?.();
        if (page.done || page.value.offset!==checkpoint.state.next_offset) throw new Error('SOURCE_INVALID_PAGE');
        const ids=page.value.records.map(tab=>tab.id);
        if (ids.some(id=>typeof id!=='string'||!id) || new Set(ids).size!==ids.length) throw new Error('SOURCE_INVALID_PAGE');
        await checkpoint.savePage(ids,checkpoint.state.next_offset+ids.length,ids.length<(window.limit??100));
        pages++;
        if (!ids.length) break;
      }
      if (now()>=deadline) break;
      const id=checkpoint.state.pending_tab_ids[0];
      const observedAt=new Date().toISOString();
      const tab=await this.source.getTab(window.locationId,id);
      if (tab.id!==id || !Array.isArray(tab.bills)) throw new Error('INCOMPLETE_SOURCE_TAB');
      let interrupted=false;
      for (let i=0;i<tab.bills.length;i++) {
        if (now()>=deadline) {interrupted=true;break;}
        if (i>=100) throw new Error('SOURCE_BILL_BUDGET_EXCEEDED');
        const billId=tab.bills[i].id;
        const bill=await this.source.getBill(window.locationId,billId);
        if (bill.id!==billId || !Array.isArray(bill.payments) || !Array.isArray(bill.products)) throw new Error('INCOMPLETE_SOURCE_BILL');
        tab.bills[i]=bill;
      }
      if (interrupted) break; // Preserve the pending Tab; partial source detail is never persisted.
      let observation: ReturnType<typeof mapLastAppSale> | null;
      try {observation=mapLastAppSale(tab,{...context,observedAt});} catch {observation=null;}
      await checkpoint.commitTab(id,observation);
      records++;
    }
    return {continuationRequired:!checkpoint.state.source_exhausted||checkpoint.state.pending_tab_ids.length>0};
  }
  /** Single authoritative webhook refresh. Window ingestion must use executeSlice and a durable checkpoint. */
  async execute(window: SourceWindow, context: MappingContext, progress: (evidence: SalesSyncEvidence) => Promise<void>, tabId: string) {
    const deadline = Date.now() + 40000;
    const counts: SalesSyncEvidence = {pages_fetched:0,records_fetched:0,created:0,updated:0,unchanged:0,rejected:0,unmapped_products:0};
    const refresh = async (id: string) => {
      if (Date.now() > deadline || counts.records_fetched >= 100) throw new Error('SYNC_EXECUTION_BUDGET_EXCEEDED');
      counts.records_fetched++;
      const observedAt = new Date().toISOString();
      // Detail refresh is mandatory: list responses are simplified and webhook data can be partial.
      const tab = await this.source.getTab(window.locationId,id);
      if (tab.id !== id) throw new Error('SOURCE_TAB_ID_MISMATCH');
      if (!Array.isArray(tab.bills)) throw new Error('INCOMPLETE_SOURCE_TAB');
      for (let i=0; i<tab.bills.length; i++) {
        if (Date.now() > deadline || i >= 100) throw new Error('SYNC_EXECUTION_BUDGET_EXCEEDED');
        const billId = tab.bills[i].id;
        const bill = await this.source.getBill(window.locationId,billId);
        if (bill.id !== billId) throw new Error('SOURCE_BILL_ID_MISMATCH');
        if (!Array.isArray(bill.payments) || !Array.isArray(bill.products)) throw new Error('INCOMPLETE_SOURCE_BILL');
        tab.bills[i] = bill;
      }
      let mapped;
      try { mapped = mapLastAppSale(tab,{...context,observedAt}); }
      catch { counts.rejected++; await progress({...counts}); return; }
      const outcome = await this.sink.persist(mapped.sale,mapped.lines,mapped.bills);
      counts[outcome]++;
      counts.unmapped_products += mapped.unmappedProducts;
      await progress({...counts});
    };
    if (!tabId) throw new Error('SOURCE_TAB_ID_REQUIRED');
    await refresh(tabId);
    return counts;
  }
}
