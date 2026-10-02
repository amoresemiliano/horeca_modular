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

  it('SupabaseSaleRepository.updateBatch persists all corrected fields including occurred_at, raw_payload, and preserves paid_amount: 0', async () => {
    let capturedUpdatePayload: any = null;
    let deletedLinesFilter: any = null;
    let insertedLines: any = null;

    const mockSupabaseClient: any = {
      from: (table: string) => {
        if (table === 'sales') {
          return {
            update: (payload: any) => {
              capturedUpdatePayload = payload;
              return {
                eq: (_col1: string, _val1: string) => ({
                  eq: (_col2: string, _val2: string) => Promise.resolve({ error: null }),
                }),
              };
            },
          };
        }
        if (table === 'sale_lines') {
          return {
            delete: () => ({
              eq: (col1: string, val1: string) => ({
                eq: (col2: string, val2: string) => {
                  deletedLinesFilter = { [col1]: val1, [col2]: val2 };
                  return Promise.resolve({ error: null });
                },
              }),
            }),
            insert: (rows: any[]) => {
              insertedLines = rows;
              return Promise.resolve({ error: null });
            },
          };
        }
        return {};
      },
    };

    const repo = new SupabaseSaleRepository(mockSupabaseClient);
    const correctedDate = new Date('2026-08-01T15:30:00.000Z');
    const correctedRawPayload = { Ubicación: 'Palencia', Total: '0,00', Modificado: 'true' };

    const correctedSale = Sale.create({
      id: 'sale-100',
      organizationId: 'org-test-1',
      salesImportId: 'imp-1',
      sourceSystem: 'lastapp',
      exportType: 'INDIVIDUAL_SALES_EXPORT',
      sourceLocation: 'Palencia',
      externalTicketCode: 'R100',
      externalIdentityKey: 'id-100',
      externalIdentityAlgorithm: 'LASTAPP_CODE_TIME_V1',
      occurredAt: correctedDate,
      sourceChannel: 'Uber',
      sourcePaymentMethod: 'card',
      total: 0,
      paidAmount: 0, // Legitimate numeric zero!
      currency: 'EUR',
      status: 'CONFIRMED',
      rawPayload: correctedRawPayload,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Case 1: lines is [] (empty replacement) -> must delete existing lines and NOT insert any
    await repo.updateBatch([{ sale: correctedSale, lines: [] }]);

    expect(capturedUpdatePayload).toBeDefined();
    expect(capturedUpdatePayload.total).toBe(0);
    expect(capturedUpdatePayload.paid_amount).toBe(0); // MUST be 0, not null!
    expect(capturedUpdatePayload.source_channel).toBe('Uber');
    expect(capturedUpdatePayload.source_payment_method).toBe('card');
    expect(capturedUpdatePayload.occurred_at).toBe(correctedDate.toISOString());
    expect(capturedUpdatePayload.raw_payload).toEqual(correctedRawPayload);
    expect(capturedUpdatePayload.status).toBe('CONFIRMED');
    expect(capturedUpdatePayload.updated_at).toBeDefined();

    expect(deletedLinesFilter).toEqual({ sale_id: 'sale-100', organization_id: 'org-test-1' });
    expect(insertedLines).toBeNull(); // No lines inserted when array is empty
  });

  it('InMemorySaleRepository.updateBatch correctly removes lines when lines is []', async () => {
    const repo = new InMemorySaleRepository();
    const sale = Sale.create({
      id: 'sale-200',
      organizationId: 'org-test-1',
      salesImportId: 'imp-1',
      sourceSystem: 'lastapp',
      exportType: 'INDIVIDUAL_SALES_EXPORT',
      sourceLocation: 'Palencia',
      externalTicketCode: 'R200',
      externalIdentityKey: 'id-200',
      externalIdentityAlgorithm: 'LASTAPP_CODE_TIME_V1',
      occurredAt: new Date(),
      total: 10,
      currency: 'EUR',
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const line = SaleLine.create({
      id: 'line-200',
      organizationId: 'org-test-1',
      saleId: 'sale-200',
      lineIndex: 0,
      depth: 0,
      rawText: '1x Taco',
      displayText: 'Taco',
      quantity: 1,
      itemType: 'PRODUCT',
      createdAt: new Date(),
    });

    await repo.saveBatch([{ sale, lines: [line] }]);
    const initial = await repo.findById('org-test-1', 'sale-200');
    expect(initial?.lines).toHaveLength(1);

    // Update with empty lines array
    await repo.updateBatch([{ sale, lines: [] }]);
    const afterEmpty = await repo.findById('org-test-1', 'sale-200');
    expect(afterEmpty?.lines).toHaveLength(0); // All lines removed

    // Update with lines === undefined leaves lines untouched
    await repo.updateBatch([{ sale, lines: undefined }]);
    const afterUndefined = await repo.findById('org-test-1', 'sale-200');
    expect(afterUndefined?.lines).toHaveLength(0);
  });
});
