import { ISaleRepository, SaleWithLines, SaleQueryFilters } from '../../../domain/sales/repositories/ISaleRepository';
import { ISalesImportRepository } from '../../../domain/sales/repositories/ISalesImportRepository';
import { Sale } from '../../../domain/sales/models/Sale';
import { SaleLine } from '../../../domain/sales/models/SaleLine';

export class InMemorySaleRepository implements ISaleRepository {
  private sales: Map<string, Sale> = new Map(); // key = sale.id
  private lines: Map<string, SaleLine[]> = new Map(); // key = sale.id -> SaleLine[]
  private importRepo?: ISalesImportRepository;

  constructor(importRepo?: ISalesImportRepository) {
    this.importRepo = importRepo;
  }

  public setImportRepository(repo: ISalesImportRepository): void {
    this.importRepo = repo;
  }

  public async findByExternalIdentityKeys(
    organizationId: string,
    identityKeys: string[]
  ): Promise<Map<string, SaleWithLines>> {
    const result = new Map<string, SaleWithLines>();
    const keySet = new Set(identityKeys);

    for (const sale of this.sales.values()) {
      if (sale.organizationId === organizationId && keySet.has(sale.externalIdentityKey)) {
        const saleLines = this.lines.get(sale.id) || [];
        result.set(sale.externalIdentityKey, { sale, lines: saleLines });
      }
    }
    return result;
  }

  public async saveBatch(items: Array<{ sale: Sale; lines: SaleLine[] }>): Promise<void> {
    // Foreign Key constraint verification: if importRepo is wired, verify salesImportId exists!
    if (this.importRepo) {
      for (const item of items) {
        const imp = await this.importRepo.findById(item.sale.organizationId, item.sale.salesImportId);
        if (!imp) {
          throw new Error(
            `FOREIGN KEY VIOLATION: sales.sales_import_id "${item.sale.salesImportId}" does not exist in sales_imports table.`
          );
        }
      }
    }

    for (const item of items) {
      this.sales.set(item.sale.id, item.sale);
      this.lines.set(item.sale.id, [...item.lines]);
    }
  }

  public async updateBatch(items: Array<{ sale: Sale; lines?: SaleLine[] }>): Promise<void> {
    for (const item of items) {
      if (this.sales.has(item.sale.id)) {
        this.sales.set(item.sale.id, item.sale);
        if (item.lines) {
          this.lines.set(item.sale.id, [...item.lines]);
        }
      }
    }
  }

  public async findById(organizationId: string, saleId: string): Promise<SaleWithLines | null> {
    const sale = this.sales.get(saleId);
    if (!sale || sale.organizationId !== organizationId) {
      return null;
    }
    const saleLines = this.lines.get(saleId) || [];
    return { sale, lines: saleLines };
  }

  public async findMany(filters: SaleQueryFilters): Promise<Sale[]> {
    let result = Array.from(this.sales.values()).filter(
      s => s.organizationId === filters.organizationId
    );

    if (filters.operationalUnitId) {
      result = result.filter(s => s.operationalUnitId === filters.operationalUnitId);
    }
    if (filters.channel) {
      result = result.filter(
        s => s.sourceChannel?.toLowerCase() === filters.channel?.toLowerCase()
      );
    }
    if (filters.startDate) {
      result = result.filter(s => s.occurredAt >= filters.startDate!);
    }
    if (filters.endDate) {
      result = result.filter(s => s.occurredAt <= filters.endDate!);
    }

    result.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return result.slice(offset, offset + limit);
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
    let sales = Array.from(this.sales.values()).filter(s => s.organizationId === organizationId);
    if (startDate) sales = sales.filter(s => s.occurredAt >= startDate);
    if (endDate) sales = sales.filter(s => s.occurredAt <= endDate);

    let totalRevenue = 0;
    const channelBreakdown: Record<string, { count: number; revenue: number }> = {};

    for (const sale of sales) {
      totalRevenue += sale.total;
      const ch = sale.sourceChannel || 'Unknown';
      if (!channelBreakdown[ch]) {
        channelBreakdown[ch] = { count: 0, revenue: 0 };
      }
      channelBreakdown[ch].count++;
      channelBreakdown[ch].revenue = Math.round((channelBreakdown[ch].revenue + sale.total) * 100) / 100;
    }

    return {
      totalTickets: sales.length,
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
    let sales = Array.from(this.sales.values()).filter(s => s.organizationId === organizationId);
    if (startDate) sales = sales.filter(s => s.occurredAt >= startDate);
    if (endDate) sales = sales.filter(s => s.occurredAt <= endDate);

    const saleIds = new Set(sales.map(s => s.id));
    const summaryMap = new Map<
      string,
      { displayText: string; totalQuantity: number; occurrences: number; itemType: string }
    >();

    for (const [saleId, lines] of this.lines.entries()) {
      if (!saleIds.has(saleId)) continue;
      for (const line of lines) {
        const key = line.displayText;
        const existing = summaryMap.get(key);
        if (existing) {
          existing.totalQuantity += line.quantity;
          existing.occurrences++;
        } else {
          summaryMap.set(key, {
            displayText: line.displayText,
            totalQuantity: line.quantity,
            occurrences: 1,
            itemType: line.itemType,
          });
        }
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }

  public clear(): void {
    this.sales.clear();
    this.lines.clear();
  }
}
