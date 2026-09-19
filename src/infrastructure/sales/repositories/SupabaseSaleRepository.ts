import { SupabaseClient } from '@supabase/supabase-js';
import { ISaleRepository, SaleWithLines, SaleQueryFilters } from '../../../domain/sales/repositories/ISaleRepository';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';

export class SupabaseSaleRepository implements ISaleRepository {
  constructor(private readonly client: SupabaseClient) {}

  public async findByExternalIdentityKeys(
    organizationId: string,
    identityKeys: string[]
  ): Promise<Map<string, Sale>> {
    const result = new Map<string, Sale>();
    if (identityKeys.length === 0) return result;

    // PostgREST in operator handles chunks of keys
    const CHUNK_SIZE = 500;
    for (let i = 0; i < identityKeys.length; i += CHUNK_SIZE) {
      const chunk = identityKeys.slice(i, i + CHUNK_SIZE);
      const { data, error } = await this.client
        .from('sales')
        .select('*')
        .eq('organization_id', organizationId)
        .in('external_identity_key', chunk);

      if (error) throw new Error(`SupabaseSaleRepository.findByExternalIdentityKeys error: ${error.message}`);

      for (const row of (data || [])) {
        const sale = this.mapRowToSale(row);
        result.set(sale.externalIdentityKey, sale);
      }
    }

    return result;
  }

  public async saveBatch(items: Array<{ sale: Sale; lines: SaleLine[] }>): Promise<void> {
    if (items.length === 0) return;

    // Batch insert sales first
    const salesRows = items.map(item => ({
      id: item.sale.id,
      organization_id: item.sale.organizationId,
      operational_unit_id: item.sale.operationalUnitId || null,
      sales_import_id: item.sale.salesImportId,
      source_system: item.sale.sourceSystem,
      export_type: item.sale.exportType,
      source_location: item.sale.sourceLocation,
      external_ticket_code: item.sale.externalTicketCode,
      external_invoice_number: item.sale.externalInvoiceNumber || null,
      external_identity_key: item.sale.externalIdentityKey,
      external_identity_algorithm: item.sale.externalIdentityAlgorithm,
      occurred_at: item.sale.occurredAt.toISOString(),
      source_channel: item.sale.sourceChannel || null,
      source_payment_method: item.sale.sourcePaymentMethod || null,
      total: item.sale.total,
      paid_amount: item.sale.paidAmount || null,
      currency: item.sale.currency,
      status: item.sale.status,
      raw_payload: item.sale.rawPayload || {},
      created_at: item.sale.createdAt.toISOString(),
      updated_at: item.sale.updatedAt.toISOString(),
    }));

    const BATCH_SIZE = 250;
    for (let i = 0; i < salesRows.length; i += BATCH_SIZE) {
      const chunk = salesRows.slice(i, i + BATCH_SIZE);
      const { error } = await this.client.from('sales').insert(chunk);
      if (error) throw new Error(`SupabaseSaleRepository.saveBatch (sales) error: ${error.message}`);
    }

    // Batch insert lines
    const lineRows: unknown[] = [];
    for (const item of items) {
      for (const line of item.lines) {
        lineRows.push({
          id: line.id,
          organization_id: line.organizationId,
          sale_id: line.saleId,
          line_index: line.lineIndex,
          depth: line.depth,
          parent_line_id: line.parentLineId || null,
          raw_text: line.rawText,
          display_text: line.displayText,
          quantity: line.quantity,
          item_type: line.itemType,
          notes: line.notes || null,
          catalog_product_id: line.catalogProductId || null,
          created_at: line.createdAt.toISOString(),
        });
      }
    }

    for (let i = 0; i < lineRows.length; i += BATCH_SIZE) {
      const chunk = lineRows.slice(i, i + BATCH_SIZE);
      const { error } = await this.client.from('sale_lines').insert(chunk);
      if (error) throw new Error(`SupabaseSaleRepository.saveBatch (sale_lines) error: ${error.message}`);
    }
  }

  public async updateBatch(sales: Sale[]): Promise<void> {
    for (const sale of sales) {
      const { error } = await this.client
        .from('sales')
        .update({
          total: sale.total,
          paid_amount: sale.paidAmount || null,
          source_channel: sale.sourceChannel || null,
          source_payment_method: sale.sourcePaymentMethod || null,
          status: sale.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sale.id)
        .eq('organization_id', sale.organizationId);

      if (error) throw new Error(`SupabaseSaleRepository.updateBatch error: ${error.message}`);
    }
  }

  public async findById(organizationId: string, saleId: string): Promise<SaleWithLines | null> {
    const { data: saleData, error: saleErr } = await this.client
      .from('sales')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', saleId)
      .single();

    if (saleErr || !saleData) return null;

    const { data: linesData, error: linesErr } = await this.client
      .from('sale_lines')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('sale_id', saleId)
      .order('line_index', { ascending: true });

    if (linesErr) throw new Error(`SupabaseSaleRepository.findById lines error: ${linesErr.message}`);

    const sale = this.mapRowToSale(saleData);
    const lines = (linesData || []).map(r => this.mapRowToSaleLine(r));

    return { sale, lines };
  }

  public async findMany(filters: SaleQueryFilters): Promise<Sale[]> {
    let query = this.client
      .from('sales')
      .select('*')
      .eq('organization_id', filters.organizationId)
      .order('occurred_at', { ascending: false });

    if (filters.operationalUnitId) {
      query = query.eq('operational_unit_id', filters.operationalUnitId);
    }
    if (filters.channel) {
      query = query.eq('source_channel', filters.channel);
    }
    if (filters.startDate) {
      query = query.gte('occurred_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('occurred_at', filters.endDate.toISOString());
    }

    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseSaleRepository.findMany error: ${error.message}`);

    return (data || []).map(r => this.mapRowToSale(r));
  }

  public async getOverviewMetrics(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTickets: number;
    totalRevenue: number;
    channelBreakdown: Record<string, { count: number; revenue: number }>;
  }> {
    let query = this.client
      .from('sales')
      .select('total, source_channel, occurred_at')
      .eq('organization_id', organizationId);

    if (startDate) query = query.gte('occurred_at', startDate.toISOString());
    if (endDate) query = query.lte('occurred_at', endDate.toISOString());

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseSaleRepository.getOverviewMetrics error: ${error.message}`);

    let totalRevenue = 0;
    const channelBreakdown: Record<string, { count: number; revenue: number }> = {};

    for (const r of (data || [])) {
      const tot = Number(r.total) || 0;
      totalRevenue += tot;
      const ch = r.source_channel || 'Unknown';
      if (!channelBreakdown[ch]) {
        channelBreakdown[ch] = { count: 0, revenue: 0 };
      }
      channelBreakdown[ch].count++;
      channelBreakdown[ch].revenue = Math.round((channelBreakdown[ch].revenue + tot) * 100) / 100;
    }

    return {
      totalTickets: (data || []).length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      channelBreakdown,
    };
  }

  public async getProductSummaries(
    organizationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      displayText: string;
      totalQuantity: number;
      occurrences: number;
      itemType: string;
    }>
  > {
    // Read through sales & lines
    let salesQuery = this.client
      .from('sales')
      .select('id')
      .eq('organization_id', organizationId);

    if (startDate) salesQuery = salesQuery.gte('occurred_at', startDate.toISOString());
    if (endDate) salesQuery = salesQuery.lte('occurred_at', endDate.toISOString());

    const { data: salesData, error: salesErr } = await salesQuery;
    if (salesErr) throw new Error(`SupabaseSaleRepository.getProductSummaries sales error: ${salesErr.message}`);

    const saleIds = (salesData || []).map(s => s.id);
    if (saleIds.length === 0) return [];

    const summaryMap = new Map<
      string,
      { displayText: string; totalQuantity: number; occurrences: number; itemType: string }
    >();

    const CHUNK_SIZE = 500;
    for (let i = 0; i < saleIds.length; i += CHUNK_SIZE) {
      const chunk = saleIds.slice(i, i + CHUNK_SIZE);
      const { data: linesData, error: linesErr } = await this.client
        .from('sale_lines')
        .select('display_text, quantity, item_type')
        .eq('organization_id', organizationId)
        .in('sale_id', chunk);

      if (linesErr) throw new Error(`SupabaseSaleRepository.getProductSummaries lines error: ${linesErr.message}`);

      for (const line of (linesData || [])) {
        const key = line.display_text;
        const qty = Number(line.quantity) || 1;
        const existing = summaryMap.get(key);
        if (existing) {
          existing.totalQuantity += qty;
          existing.occurrences++;
        } else {
          summaryMap.set(key, {
            displayText: key,
            totalQuantity: qty,
            occurrences: 1,
            itemType: line.item_type,
          });
        }
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }

  private mapRowToSale(row: Record<string, unknown>): Sale {
    return Sale.create({
      id: String(row.id),
      organizationId: String(row.organization_id),
      operationalUnitId: row.operational_unit_id ? String(row.operational_unit_id) : null,
      salesImportId: String(row.sales_import_id),
      sourceSystem: String(row.source_system),
      exportType: String(row.export_type),
      sourceLocation: String(row.source_location),
      externalTicketCode: String(row.external_ticket_code),
      externalInvoiceNumber: row.external_invoice_number ? String(row.external_invoice_number) : null,
      externalIdentityKey: String(row.external_identity_key),
      externalIdentityAlgorithm: String(row.external_identity_algorithm),
      occurredAt: new Date(String(row.occurred_at)),
      sourceChannel: row.source_channel ? String(row.source_channel) : null,
      sourcePaymentMethod: row.source_payment_method ? String(row.source_payment_method) : null,
      total: Number(row.total),
      paidAmount: row.paid_amount !== null && row.paid_amount !== undefined ? Number(row.paid_amount) : null,
      currency: String(row.currency || 'EUR'),
      status: (row.status as Sale['status']) || 'CONFIRMED',
      rawPayload: (row.raw_payload as Record<string, unknown>) || {},
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    });
  }

  private mapRowToSaleLine(row: Record<string, unknown>): SaleLine {
    return SaleLine.create({
      id: String(row.id),
      organizationId: String(row.organization_id),
      saleId: String(row.sale_id),
      lineIndex: Number(row.line_index),
      depth: Number(row.depth || 0),
      parentLineId: row.parent_line_id ? String(row.parent_line_id) : null,
      rawText: String(row.raw_text),
      displayText: String(row.display_text),
      quantity: Number(row.quantity || 1),
      itemType: (row.item_type as SaleLine['itemType']) || 'UNKNOWN',
      notes: row.notes ? String(row.notes) : null,
      catalogProductId: row.catalog_product_id ? String(row.catalog_product_id) : null,
      createdAt: new Date(String(row.created_at)),
    });
  }
}
