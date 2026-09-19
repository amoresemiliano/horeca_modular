import { Sale } from '../models/Sale';
import { SaleLine } from '../models/SaleLine';

export interface SaleWithLines {
  sale: Sale;
  lines: SaleLine[];
}

export interface SaleQueryFilters {
  organizationId: string;
  operationalUnitId?: string | null;
  startDate?: Date;
  endDate?: Date;
  channel?: string | null;
  limit?: number;
  offset?: number;
}

export interface ISaleRepository {
  /**
   * Finds existing sales by their external identity keys for a given organization.
   * Used for efficient batch deduplication.
   */
  findByExternalIdentityKeys(
    organizationId: string,
    identityKeys: string[]
  ): Promise<Map<string, Sale>>;

  /**
   * Persists a batch of new sales and their associated lines atomically or in batches.
   */
  saveBatch(items: Array<{ sale: Sale; lines: SaleLine[] }>): Promise<void>;

  /**
   * Updates existing sales (e.g. on re-import with corrected source attributes).
   */
  updateBatch(sales: Sale[]): Promise<void>;

  /**
   * Finds a single sale by internal ID with all its lines.
   */
  findById(organizationId: string, saleId: string): Promise<SaleWithLines | null>;

  /**
   * Queries sales matching filters for list / overview UI.
   */
  findMany(filters: SaleQueryFilters): Promise<Sale[]>;

  /**
   * Aggregates revenue and ticket counts across dates/channels.
   */
  getOverviewMetrics(organizationId: string, startDate?: Date, endDate?: Date): Promise<{
    totalTickets: number;
    totalRevenue: number;
    channelBreakdown: Record<string, { count: number; revenue: number }>;
  }>;

  /**
   * Aggregates product line sales.
   */
  getProductSummaries(organizationId: string, startDate?: Date, endDate?: Date): Promise<Array<{
    displayText: string;
    totalQuantity: number;
    occurrences: number;
    itemType: string;
  }>>;
}
