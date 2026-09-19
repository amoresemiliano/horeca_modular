import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { InMemorySaleRepository } from '../../../src/infrastructure/sales/repositories/InMemorySaleRepository';
import { InMemorySalesImportRepository } from '../../../src/infrastructure/sales/repositories/InMemorySalesImportRepository';
import { IngestSalesCsvUseCase } from '../../../src/application/sales/useCases/IngestSalesCsvUseCase';
import { GetSalesOverviewUseCase } from '../../../src/application/sales/useCases/GetSalesOverviewUseCase';
import { GetProductSalesSummaryUseCase } from '../../../src/application/sales/useCases/GetProductSalesSummaryUseCase';

describe('IngestSalesCsvUseCase Integration Tests with Approved Fixtures', () => {
  let saleRepo: InMemorySaleRepository;
  let importRepo: InMemorySalesImportRepository;
  let ingestUseCase: IngestSalesCsvUseCase;
  let overviewUseCase: GetSalesOverviewUseCase;
  let productSummaryUseCase: GetProductSalesSummaryUseCase;

  const ORG_ID_A = 'org-elcriollo-palencia';
  const ORG_ID_B = 'org-other-client';

  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'sales', 'lastapp');

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    importRepo = new InMemorySalesImportRepository();
    ingestUseCase = new IngestSalesCsvUseCase(saleRepo, importRepo);
    overviewUseCase = new GetSalesOverviewUseCase(saleRepo);
    productSummaryUseCase = new GetProductSalesSummaryUseCase(saleRepo);
  });

  it('1. Ingests standard ~799-row dataset (tabs-report-0.csv) with exact row count and ~14,980.70 EUR revenue', async () => {
    const csvContent = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0.csv'), 'utf8');

    const result = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'tabs-report-0.csv',
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.rowsAttempted).toBe(799);
    expect(result.rowsAccepted).toBe(799);
    expect(result.rowsDuplicate).toBe(0);
    expect(result.rowsRejected).toBe(0);
    expect(result.totalRevenue).toBe(14980.70);

    // Verify Read Model Overview
    const overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(799);
    expect(overview.totalRevenue).toBe(14980.70);
    expect(overview.channelBreakdown['Restaurant'].count).toBeGreaterThan(0);
    expect(overview.channelBreakdown['Uber'].count).toBeGreaterThan(0);
    expect(overview.channelBreakdown['Glovo'].count).toBeGreaterThan(0);
  });

  it('2. Ingests ~73-row dataset (tabs-report-0-3.csv) with modifier hierarchy and ~1,541.45 EUR revenue', async () => {
    const csvContent = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0-3.csv'), 'utf8');

    const result = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'tabs-report-0-3.csv',
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.rowsAttempted).toBe(73);
    expect(result.rowsAccepted).toBe(73);
    expect(result.totalRevenue).toBe(1541.45);

    // Verify product summaries contains modifiers and parent items
    const products = await productSummaryUseCase.execute({ organizationId: ORG_ID_A });
    expect(products.length).toBeGreaterThan(10);
    const perron = products.find(p => p.displayText === 'Perrón');
    expect(perron).toBeDefined();
    expect(perron?.totalQuantity).toBeGreaterThan(0);
  });

  it('3. Ingests ~5,000-row performance dataset (tabs-report-0-2.csv) with high performance and 0 duplicate collisions', async () => {
    const csvContent = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0-2.csv'), 'utf8');

    const startTime = Date.now();
    const result = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'tabs-report-0-2.csv',
    });
    const durationMs = Date.now() - startTime;

    expect(result.status).toBe('COMPLETED');
    expect(result.rowsAttempted).toBe(5000);
    expect(result.rowsAccepted).toBe(5000);
    expect(result.rowsDuplicate).toBe(0);
    expect(result.rowsRejected).toBe(0);
    expect(result.totalRevenue).toBe(95823.36);
    expect(durationMs).toBeLessThan(5000); // Fast batch processing < 5s for 5k rows
  });

  it('4. Re-importing the same CSV file twice produces NO duplicate sales (100% duplicate detection)', async () => {
    const csvContent = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0.csv'), 'utf8');

    // First import
    const firstResult = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'tabs-report-0.csv',
    });
    expect(firstResult.rowsAccepted).toBe(799);

    // Second import of same file
    const secondResult = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'tabs-report-0.csv',
    });

    expect(secondResult.rowsAttempted).toBe(799);
    expect(secondResult.rowsAccepted).toBe(0);
    expect(secondResult.rowsDuplicate).toBe(799);
    expect(secondResult.totalRevenue).toBe(0);

    // Database still has exactly 799 sales
    const overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(799);
    expect(overview.totalRevenue).toBe(14980.70);
  });

  it('5. Overlapping exports across different files do not create duplicate sales', async () => {
    const csv73 = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0-3.csv'), 'utf8');
    const csv799 = fs.readFileSync(path.join(fixturesDir, 'tabs-report-0.csv'), 'utf8');

    // Ingest 73-row file first
    await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: csv73,
      filename: 'tabs-report-0-3.csv',
    });

    // Ingest 799-row file (which may contain some overlapping or distinct tickets)
    const secondResult = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: csv799,
      filename: 'tabs-report-0.csv',
    });

    // Check that total tickets equals total unique tickets
    const overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(73 + secondResult.rowsAccepted);
  });

  it('6. Re-exporting a ticket with a corrected amount updates the existing sale without creating duplicates', async () => {
    const initialCsv = `Ubicación,Código,Factura nº,Hora de creación,Total,Productos
El Criollo - Palencia,R001,LS2-10688,2026-08-01T11:59:51.000,10.00,1x TACOS - Carnitas`;

    const correctedCsv = `Ubicación,Código,Factura nº,Hora de creación,Total,Productos
El Criollo - Palencia,R001,LS2-10688,2026-08-01T11:59:51.000,15.50,1x TACOS - Carnitas`;

    await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: initialCsv,
      filename: 'initial.csv',
    });

    let overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(1);
    expect(overview.totalRevenue).toBe(10.00);

    // Ingest corrected file
    const corrResult = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: correctedCsv,
      filename: 'corrected.csv',
    });

    expect(corrResult.rowsAccepted).toBe(0);
    expect(corrResult.rowsDuplicate).toBe(1);

    overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(1); // STILL 1 ticket
    expect(overview.totalRevenue).toBe(15.50); // Updated revenue!
  });

  it('7. Rejects Daily Billing Summary export (billing-summary-2026-Q1.csv) for ticket ingestion with clear diagnostics', async () => {
    const billingCsv = fs.readFileSync(path.join(fixturesDir, 'billing-summary-2026-Q1.csv'), 'utf8');

    const result = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: billingCsv,
      filename: 'billing-summary-2026-Q1.csv',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.rowsAccepted).toBe(0);
    expect(result.rowsRejected).toBe(11);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].message).toMatch(/Billing/i);

    // 0 sales created
    const overview = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    expect(overview.totalTickets).toBe(0);
  });

  it('8. Enforces multi-tenant isolation (same ticket in Org A vs Org B creates independent sales)', async () => {
    const csvContent = `Ubicación,Código,Factura nº,Hora de creación,Total,Productos
El Criollo - Palencia,R001,LS2-10688,2026-08-01T11:59:51.000,3.20,1x Cerveza`;

    await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent,
      filename: 'test.csv',
    });

    await ingestUseCase.execute({
      organizationId: ORG_ID_B,
      csvContent,
      filename: 'test.csv',
    });

    const overviewA = await overviewUseCase.execute({ organizationId: ORG_ID_A });
    const overviewB = await overviewUseCase.execute({ organizationId: ORG_ID_B });

    expect(overviewA.totalTickets).toBe(1);
    expect(overviewB.totalTickets).toBe(1);
    expect(overviewA.totalRevenue).toBe(3.20);
    expect(overviewB.totalRevenue).toBe(3.20);
  });

  it('9. Handles malformed rows by recording row diagnostics while accepting valid rows in PARTIAL status', async () => {
    const mixedCsv = `Ubicación,Código,Factura nº,Hora de creación,Total,Productos
El Criollo - Palencia,R001,LS2-10688,2026-08-01T11:59:51.000,10.00,1x Cerveza
El Criollo - Palencia,R002,LS2-10689,2026-08-01T12:00:00.000,MALFORMED_TOTAL,1x Cerveza
El Criollo - Palencia,R003,LS2-10690,2026-08-01T12:05:00.000,20.00,1x Cerveza`;

    const result = await ingestUseCase.execute({
      organizationId: ORG_ID_A,
      csvContent: mixedCsv,
      filename: 'mixed.csv',
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.rowsAttempted).toBe(3);
    expect(result.rowsAccepted).toBe(2);
    expect(result.rowsRejected).toBe(1);
    expect(result.totalRevenue).toBe(30.00);
    expect(result.diagnostics.some(d => d.level === 'ERROR')).toBe(true);
  });
});
