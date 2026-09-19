import { getSupabaseClient } from '../supabase/client';
import { SupabaseSaleRepository } from './repositories/SupabaseSaleRepository';
import { SupabaseSalesImportRepository } from './repositories/SupabaseSalesImportRepository';
import { InMemorySaleRepository } from './repositories/InMemorySaleRepository';
import { InMemorySalesImportRepository } from './repositories/InMemorySalesImportRepository';
import { IngestSalesCsvUseCase } from '../../application/sales/useCases/IngestSalesCsvUseCase';
import { GetSalesOverviewUseCase } from '../../application/sales/useCases/GetSalesOverviewUseCase';
import { GetSaleDetailsUseCase } from '../../application/sales/useCases/GetSaleDetailsUseCase';
import { GetProductSalesSummaryUseCase } from '../../application/sales/useCases/GetProductSalesSummaryUseCase';
import { GetSalesImportsUseCase } from '../../application/sales/useCases/GetSalesImportsUseCase';

// Singleton in-memory repositories for fallback or local environments
const inMemorySaleRepo = new InMemorySaleRepository();
const inMemoryImportRepo = new InMemorySalesImportRepository();

export function createSalesServiceContainer(useInMemory = false) {
  let saleRepo = inMemorySaleRepo;
  let importRepo = inMemoryImportRepo;

  if (!useInMemory) {
    try {
      const client = getSupabaseClient();
      saleRepo = new SupabaseSaleRepository(client) as unknown as InMemorySaleRepository;
      importRepo = new SupabaseSalesImportRepository(client) as unknown as InMemorySalesImportRepository;
    } catch {
      // Fallback to in-memory if Supabase client cannot be initialized (e.g. offline dev/demo)
      saleRepo = inMemorySaleRepo;
      importRepo = inMemoryImportRepo;
    }
  }

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

export const defaultSalesContainer = createSalesServiceContainer();
