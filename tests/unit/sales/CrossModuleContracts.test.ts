import { describe, it, expect } from 'vitest';
import { Sale } from '../../../src/domain/sales/models/Sale';
import { SaleLine } from '../../../src/domain/sales/models/SaleLine';
import { CrossModuleContractsExporter } from '../../../src/domain/sales/contracts/CrossModuleContracts';

describe('CrossModuleContracts Unit Tests', () => {
  const sale = Sale.create({
    id: 'sale-1',
    organizationId: 'org-1',
    operationalUnitId: 'op-unit-1',
    salesImportId: 'import-1',
    sourceSystem: 'lastapp',
    exportType: 'INDIVIDUAL_SALES_EXPORT',
    sourceLocation: 'El Criollo - Palencia',
    externalTicketCode: 'R001',
    externalInvoiceNumber: 'LS2-10688',
    externalIdentityKey: 'sha256-hash',
    externalIdentityAlgorithm: 'LASTAPP_INVOICE_V1',
    occurredAt: new Date('2026-08-01T12:00:00Z'),
    sourceChannel: 'Restaurant',
    sourcePaymentMethod: 'card',
    total: 35.5,
    paidAmount: 35.5,
    currency: 'EUR',
    status: 'CONFIRMED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const lines = [
    SaleLine.create({
      id: 'line-1',
      organizationId: 'org-1',
      saleId: 'sale-1',
      lineIndex: 0,
      depth: 0,
      rawText: '1x TACOS - Carnitas',
      displayText: 'TACOS - Carnitas',
      quantity: 1,
      itemType: 'PRODUCT',
      catalogProductId: 'prod-carnitas-uuid',
      createdAt: new Date(),
    }),
    SaleLine.create({
      id: 'line-2',
      organizationId: 'org-1',
      saleId: 'sale-1',
      lineIndex: 1,
      depth: 1,
      parentLineId: 'line-1',
      rawText: '\t1x Extra Salsa',
      displayText: 'Extra Salsa',
      quantity: 1,
      itemType: 'MODIFIER',
      catalogProductId: null, // Unmapped modifier
      createdAt: new Date(),
    }),
  ];

  it('exports Catalog mapping candidates without mutating Catalog domain', () => {
    const candidates = CrossModuleContractsExporter.toCatalogCandidates('org-1', lines);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].sourceDescriptor).toBe('TACOS - Carnitas');
    expect(candidates[0].mappedCatalogProductId).toBe('prod-carnitas-uuid');
    expect(candidates[1].sourceDescriptor).toBe('Extra Salsa');
    expect(candidates[1].mappedCatalogProductId).toBeNull();
  });

  it('exports Inventory consumption signals ONLY for lines with mapped Catalog Product IDs', () => {
    const signals = CrossModuleContractsExporter.toInventoryConsumptionSignals(sale, lines);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({
      organizationId: 'org-1',
      operationalUnitId: 'op-unit-1',
      saleId: 'sale-1',
      saleLineId: 'line-1',
      occurredAt: sale.occurredAt,
      mappedCatalogProductId: 'prod-carnitas-uuid',
      quantity: 1,
      sourceSystem: 'lastapp',
    });
  });

  it('exports Finance reconciliation inputs containing payment and ticket identifiers', () => {
    const fin = CrossModuleContractsExporter.toFinanceReconciliationInput(sale);
    expect(fin).toEqual({
      organizationId: 'org-1',
      operationalUnitId: 'op-unit-1',
      saleId: 'sale-1',
      occurredAt: sale.occurredAt,
      total: 35.5,
      currency: 'EUR',
      sourcePaymentMethod: 'card',
      externalInvoiceNumber: 'LS2-10688',
      externalTicketCode: 'R001',
      sourceSystem: 'lastapp',
    });
  });

  it('exports Analytics revenue facts with item breakdown and provenance', () => {
    const fact = CrossModuleContractsExporter.toAnalyticsRevenueFact(sale, lines);
    expect(fact.organizationId).toBe('org-1');
    expect(fact.total).toBe(35.5);
    expect(fact.lineQuantities).toHaveLength(2);
    expect(fact.lineQuantities[0].displayText).toBe('TACOS - Carnitas');
    expect(fact.lineQuantities[0].quantity).toBe(1);
  });
});
