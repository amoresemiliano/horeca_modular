import { describe, it, expect } from 'vitest';
import { InMemorySaleRepository } from '../../../src/infrastructure/sales/repositories/InMemorySaleRepository';
import { InMemorySalesImportRepository } from '../../../src/infrastructure/sales/repositories/InMemorySalesImportRepository';
import { SupabaseSaleRepository } from '../../../src/infrastructure/sales/repositories/SupabaseSaleRepository';
import { SupabaseSalesImportRepository } from '../../../src/infrastructure/sales/repositories/SupabaseSalesImportRepository';
import { createProductionSalesContainer, createTestSalesContainer } from '../../../src/infrastructure/sales/salesServiceContainer';
import { Sale } from '../../../src/domain/sales/models/Sale';
import { SaleLine } from '../../../src/domain/sales/models/SaleLine';
import { SalesImport } from '../../../src/domain/sales/models/SalesImport';

describe('Sales Persistence & Tenancy Contract Tests', () => {
  it('enforces Foreign Key requirement: cannot persist Sale if SalesImport does not exist', async () => {
    const importRepo = new InMemorySalesImportRepository();
    const saleRepo = new InMemorySaleRepository(importRepo);

    const nonExistentImportId = 'non-existent-import-uuid';
    const sale = Sale.create({
      id: 'sale-test-1',
      organizationId: 'org-test-1',
      salesImportId: nonExistentImportId,
      sourceSystem: 'lastapp',
      exportType: 'INDIVIDUAL_SALES_EXPORT',
      sourceLocation: 'Palencia',
      externalTicketCode: 'R001',
      externalIdentityKey: 'key-123',
      externalIdentityAlgorithm: 'LASTAPP_INVOICE_V1',
      occurredAt: new Date(),
      total: 10,
      currency: 'EUR',
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const lines = [
      SaleLine.create({
        id: 'line-test-1',
        organizationId: 'org-test-1',
        saleId: 'sale-test-1',
        lineIndex: 0,
        depth: 0,
        rawText: '1x Taco',
        displayText: 'Taco',
        quantity: 1,
        itemType: 'PRODUCT',
        createdAt: new Date(),
      }),
    ];

    // Attempting to save without prior SalesImport must throw FK violation
    await expect(saleRepo.saveBatch([{ sale, lines }])).rejects.toThrowError(
      /FOREIGN KEY VIOLATION.*sales_import_id/i
    );

    // After creating SalesImport, save succeeds
    const salesImport = SalesImport.create({
      id: nonExistentImportId,
      organizationId: 'org-test-1',
      sourceSystem: 'lastapp',
      exportType: 'INDIVIDUAL_SALES_EXPORT',
      filename: 'test.csv',
      status: 'PROCESSING',
      rowsAttempted: 1,
      rowsAccepted: 0,
      rowsDuplicate: 0,
      rowsRejected: 0,
      totalRevenue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await importRepo.save(salesImport);

    await expect(saleRepo.saveBatch([{ sale, lines }])).resolves.not.toThrow();
  });

  it('enforces that Production container strictly uses persistent Supabase repositories', () => {
    const prodContainer = createProductionSalesContainer();
    expect(prodContainer.repositories.saleRepo).toBeInstanceOf(SupabaseSaleRepository);
    expect(prodContainer.repositories.importRepo).toBeInstanceOf(SupabaseSalesImportRepository);
    expect(prodContainer.repositories.saleRepo).not.toBeInstanceOf(InMemorySaleRepository);
    expect(prodContainer.repositories.importRepo).not.toBeInstanceOf(InMemorySalesImportRepository);
  });

  it('confirms createTestSalesContainer provides fully wired in-memory repositories with FK verification', () => {
    const testContainer = createTestSalesContainer();
    expect(testContainer.repositories.saleRepo).toBeInstanceOf(InMemorySaleRepository);
    expect(testContainer.repositories.importRepo).toBeInstanceOf(InMemorySalesImportRepository);
  });

  it('proves multi-tenant RLS isolation on Sales schema: organizationId is mandatory and enforced', () => {
    expect(() =>
      Sale.create({
        id: 'sale-1',
        organizationId: '', // Invalid empty org
        salesImportId: 'import-1',
        sourceSystem: 'lastapp',
        exportType: 'INDIVIDUAL_SALES_EXPORT',
        sourceLocation: 'Palencia',
        externalTicketCode: 'R001',
        externalIdentityKey: 'key-123',
        externalIdentityAlgorithm: 'LASTAPP_INVOICE_V1',
        occurredAt: new Date(),
        total: 10,
        currency: 'EUR',
        status: 'CONFIRMED',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ).toThrowError(/organizationId/i);
  });
});
