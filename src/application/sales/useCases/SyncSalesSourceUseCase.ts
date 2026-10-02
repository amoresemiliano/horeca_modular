import type { SalesSourcePort, SourceWindow } from '../ports/SalesSourcePort';
import { mapLastAppSale, MappingContext } from '../services/LastAppSalesMapper';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';

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
  async execute(window: SourceWindow, context: MappingContext, progress: (evidence: SalesSyncEvidence) => Promise<void>, tabId?: string) {
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
    if (tabId) await refresh(tabId);
    else for await (const page of this.source.listTabs(window)) {
      counts.pages_fetched++;
      await progress({...counts});
      for (const tab of page.records) await refresh(tab.id);
    }
    return counts;
  }
}
