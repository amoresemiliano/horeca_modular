import { ISaleRepository } from '../../../domain/sales/repositories/ISaleRepository';

export interface GetSaleDetailsInput {
  organizationId: string;
  saleId: string;
}

export interface SaleDetailsDTO {
  id: string;
  code: string;
  invoiceNumber: string | null;
  occurredAt: string;
  location: string;
  channel: string;
  paymentMethod: string;
  total: number;
  currency: string;
  lines: Array<{
    id: string;
    lineIndex: number;
    depth: number;
    parentLineId: string | null;
    rawText: string;
    displayText: string;
    quantity: number;
    itemType: string;
    notes: string | null;
  }>;
}

export class GetSaleDetailsUseCase {
  constructor(private readonly saleRepository: ISaleRepository) {}

  public async execute(input: GetSaleDetailsInput): Promise<SaleDetailsDTO | null> {
    const { organizationId, saleId } = input;
    const result = await this.saleRepository.findById(organizationId, saleId);
    if (!result) return null;

    const { sale, lines } = result;
    return {
      id: sale.id,
      code: sale.externalTicketCode,
      invoiceNumber: sale.externalInvoiceNumber || null,
      occurredAt: sale.occurredAt.toISOString(),
      location: sale.sourceLocation,
      channel: sale.sourceChannel || 'Direct',
      paymentMethod: sale.sourcePaymentMethod || 'Unknown',
      total: sale.total,
      currency: sale.currency,
      lines: lines.map(l => ({
        id: l.id,
        lineIndex: l.lineIndex,
        depth: l.depth,
        parentLineId: l.parentLineId || null,
        rawText: l.rawText,
        displayText: l.displayText,
        quantity: l.quantity,
        itemType: l.itemType,
        notes: l.notes || null,
      })),
    };
  }
}
