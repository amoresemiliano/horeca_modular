import { ISalesImportRepository } from '../../../domain/sales/repositories/ISalesImportRepository';

export interface GetSalesImportsInput {
  organizationId: string;
  limit?: number;
}

export class GetSalesImportsUseCase {
  constructor(private readonly salesImportRepository: ISalesImportRepository) {}

  public async execute(input: GetSalesImportsInput) {
    const { organizationId, limit = 20 } = input;
    if (!organizationId) {
      throw new Error('GetSalesImportsUseCase requires a valid organizationId');
    }

    const imports = await this.salesImportRepository.listRecent(organizationId, limit);
    return imports.map(i => ({
      id: i.id,
      filename: i.filename,
      status: i.status,
      rowsAttempted: i.rowsAttempted,
      rowsAccepted: i.rowsAccepted,
      rowsDuplicate: i.rowsDuplicate,
      rowsRejected: i.rowsRejected,
      totalRevenue: i.totalRevenue,
      errorSummary: i.errorSummary,
      diagnostics: i.diagnostics,
      createdAt: i.createdAt.toISOString(),
    }));
  }
}
