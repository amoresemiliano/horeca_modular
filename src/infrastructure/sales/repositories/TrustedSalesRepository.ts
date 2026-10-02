import { SupabaseSaleRepository } from './SupabaseSaleRepository';
import { SupabaseClient } from '@supabase/supabase-js';
import type { SaleWithLines } from '../../../domain/sales/repositories/ISaleRepository';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';

/** Server-only service-role repository. CSV and API use the same atomic canonical write. */
export class TrustedSalesRepository extends SupabaseSaleRepository {
  constructor(private readonly trustedClient: SupabaseClient) { super(trustedClient); }
  async persist(sale: Sale, lines?: SaleLine[], bills?: Record<string, unknown>[]): Promise<'created'|'updated'|'unchanged'> {
    const { data, error } = await this.trustedClient.rpc('sales_persist_canonical', {
      p_sale: sale.toJSON(), p_lines: lines?.map(line => line.toJSON()) ?? null, p_bills: bills ?? null,
    });
    if (error || !['created','updated','unchanged'].includes(data)) throw new Error('CANONICAL_PERSISTENCE_FAILED');
    return data;
  }
  override async saveBatch(items: SaleWithLines[]) { for (const item of items) await this.persist(item.sale,item.lines); }
  override async updateBatch(items: Array<{sale: Sale; lines?: SaleLine[]}>) {
    for (const item of items) await this.persist(item.sale,item.lines);
  }
}
