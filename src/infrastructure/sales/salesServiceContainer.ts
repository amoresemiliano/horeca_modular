import { getSupabaseClient } from '../supabase/client';
import { ISaleRepository } from '../../domain/sales/repositories/ISaleRepository';
import { ISalesImportRepository } from '../../domain/sales/repositories/ISalesImportRepository';
import { SupabaseSaleRepository } from './repositories/SupabaseSaleRepository';
import { SupabaseSalesImportRepository } from './repositories/SupabaseSalesImportRepository';
import { InMemorySaleRepository } from './repositories/InMemorySaleRepository';
import { InMemorySalesImportRepository } from './repositories/InMemorySalesImportRepository';
import { IngestSalesCsvUseCase } from '../../application/sales/useCases/IngestSalesCsvUseCase';
import { GetSalesOverviewUseCase } from '../../application/sales/useCases/GetSalesOverviewUseCase';
import { GetSaleDetailsUseCase } from '../../application/sales/useCases/GetSaleDetailsUseCase';
import { GetProductSalesSummaryUseCase } from '../../application/sales/useCases/GetProductSalesSummaryUseCase';
import { GetSalesImportsUseCase } from '../../application/sales/useCases/GetSalesImportsUseCase';

export interface SalesServiceContainer {
  ingestSalesCsv: IngestSalesCsvUseCase;
  getSalesOverview: GetSalesOverviewUseCase;
  getSaleDetails: GetSaleDetailsUseCase;
  getProductSalesSummary: GetProductSalesSummaryUseCase;
  getSalesImports: GetSalesImportsUseCase;
  repositories: {
    saleRepo: ISaleRepository;
    importRepo: ISalesImportRepository;
  };
}

/**
 * Creates the production Sales service container backed strictly by persistent Supabase infrastructure.
 * Invariant: Never silently falls back to in-memory mode in production runtime.
 */
export function createProductionSalesContainer(): SalesServiceContainer {
  const client = getSupabaseClient();
  const saleRepo = new SupabaseSaleRepository(client);
  const importRepo = new SupabaseSalesImportRepository(client);

  return {
    ingestSalesCsv: new IngestSalesCsvUseCase(saleRepo, importRepo),
    getSalesOverview: new GetSalesOverviewUseCase(saleRepo),
    getSaleDetails: new GetSaleDetailsUseCase(saleRepo),
    getProductSalesSummary: new GetProductSalesSummaryUseCase(saleRepo),
    getSalesImports: new GetSalesImportsUseCase(importRepo),
    repositories: {
      saleRepo,
      importRepo,
    },
  };
}

/**
 * Creates an isolated test container with in-memory repositories for unit and integration testing.
 */
export function createTestSalesContainer(): SalesServiceContainer {
  const importRepo = new InMemorySalesImportRepository();
  const saleRepo = new InMemorySaleRepository(importRepo);

  return {
    ingestSalesCsv: new IngestSalesCsvUseCase(saleRepo, importRepo),
    getSalesOverview: new GetSalesOverviewUseCase(saleRepo),
    getSaleDetails: new GetSaleDetailsUseCase(saleRepo),
    getProductSalesSummary: new GetProductSalesSummaryUseCase(saleRepo),
    getSalesImports: new GetSalesImportsUseCase(importRepo),
    repositories: {
      saleRepo,
      importRepo,
    },
  };
}

// Lazy production container getter ensuring explicit persistence
let productionContainerInstance: SalesServiceContainer | null = null;

export function getProductionSalesContainer(): SalesServiceContainer {
  if (!productionContainerInstance) {
    productionContainerInstance = createProductionSalesContainer();
  }
  return productionContainerInstance;
}

export const defaultSalesContainer = {
  get ingestSalesCsv() { return getProductionSalesContainer().ingestSalesCsv; },
  get getSalesOverview() { return getProductionSalesContainer().getSalesOverview; },
  get getSaleDetails() { return getProductionSalesContainer().getSaleDetails; },
  get getProductSalesSummary() { return getProductionSalesContainer().getProductSalesSummary; },
  get getSalesImports() { return getProductionSalesContainer().getSalesImports; },
  get repositories() { return getProductionSalesContainer().repositories; },
};
