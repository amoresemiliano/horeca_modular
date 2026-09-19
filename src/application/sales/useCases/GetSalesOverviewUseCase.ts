import { ISaleRepository } from '../../../domain/sales/repositories/ISaleRepository';

export interface GetSalesOverviewInput {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  channel?: string | null;
  limit?: number;
  offset?: number;
}

export interface SalesOverviewDTO {
  totalTickets: number;
  totalRevenue: number;
  channelBreakdown: Record<string, { count: number; revenue: number }>;
  tickets: Array<{
    id: string;
    code: string;
    invoiceNumber: string | null;
    occurredAt: string;
    location: string;
    channel: string;
    paymentMethod: string;
    total: number;
    currency: string;
  }>;
}

export class GetSalesOverviewUseCase {
  constructor(private readonly saleRepository: ISaleRepository) {}

  public async execute(input: GetSalesOverviewInput): Promise<SalesOverviewDTO> {
    const { organizationId, startDate, endDate, channel, limit = 50, offset = 0 } = input;

    if (!organizationId || organizationId.trim() === '') {
      throw new Error('GetSalesOverviewUseCase requires a valid organizationId');
    }

    const metrics = await this.saleRepository.getOverviewMetrics(organizationId, startDate, endDate);
    const sales = await this.saleRepository.findMany({
      organizationId,
      startDate,
      endDate,
      channel,
      limit,
      offset,
    });

    return {
      totalTickets: metrics.totalTickets,
      totalRevenue: metrics.totalRevenue,
      channelBreakdown: metrics.channelBreakdown,
      tickets: sales.map(s => ({
        id: s.id,
        code: s.externalTicketCode,
        invoiceNumber: s.externalInvoiceNumber || null,
        occurredAt: s.occurredAt.toISOString(),
        location: s.sourceLocation,
        channel: s.sourceChannel || 'Direct',
        paymentMethod: s.sourcePaymentMethod || 'Unknown',
        total: s.total,
        currency: s.currency,
      })),
    };
  }
}
