import { ISaleRepository } from '../../../domain/sales/repositories/ISaleRepository';

export interface GetProductSalesSummaryInput {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ProductSalesSummaryDTO {
  displayText: string;
  totalQuantity: number;
  occurrences: number;
  itemType: string;
}

export class GetProductSalesSummaryUseCase {
  constructor(private readonly saleRepository: ISaleRepository) {}

  public async execute(input: GetProductSalesSummaryInput): Promise<ProductSalesSummaryDTO[]> {
    const { organizationId, startDate, endDate } = input;
    if (!organizationId) {
      throw new Error('GetProductSalesSummaryUseCase requires a valid organizationId');
    }

    return this.saleRepository.getProductSummaries(organizationId, startDate, endDate);
  }
}
