import { Sale } from '../models/Sale';
import { SaleLine } from '../models/SaleLine';

/**
 * Cross-module output contracts for HORECA Modular.
 * Invariant: Sales defines and exports canonical data contracts without directly
 * creating records in downstream domains (Catalog, Inventory, Finance, Analytics).
 */

// A. SALES -> CATALOG: Mapping Candidate
export interface CatalogMappingCandidate {
  organizationId: string;
  sourceDescriptor: string;
  rawText: string;
  sourceSystem: string;
  mappedCatalogProductId?: string | null;
}

// B. SALES -> INVENTORY: Consumption Signal (only for lines with mapped Catalog Product)
export interface InventoryConsumptionSignal {
  organizationId: string;
  operationalUnitId?: string | null;
  saleId: string;
  saleLineId: string;
  occurredAt: Date;
  mappedCatalogProductId: string;
  quantity: number;
  sourceSystem: string;
}

// C. SALES -> FINANCE: Reconciliation Input
export interface FinanceReconciliationInput {
  organizationId: string;
  operationalUnitId?: string | null;
  saleId: string;
  occurredAt: Date;
  total: number;
  currency: string;
  sourcePaymentMethod?: string | null;
  externalInvoiceNumber?: string | null;
  externalTicketCode: string;
  sourceSystem: string;
}

// D. SALES -> ANALYTICS: Revenue Fact Input
export interface AnalyticsRevenueFactInput {
  organizationId: string;
  operationalUnitId?: string | null;
  saleId: string;
  externalIdentityKey: string;
  occurredAt: Date;
  sourceChannel?: string | null;
  total: number;
  currency: string;
  lineQuantities: Array<{
    displayText: string;
    quantity: number;
    mappedCatalogProductId?: string | null;
  }>;
  sourceSystem: string;
  salesImportId: string;
}

export class CrossModuleContractsExporter {
  public static toCatalogCandidates(organizationId: string, lines: SaleLine[]): CatalogMappingCandidate[] {
    const candidatesMap = new Map<string, CatalogMappingCandidate>();
    for (const line of lines) {
      if (!candidatesMap.has(line.displayText)) {
        candidatesMap.set(line.displayText, {
          organizationId,
          sourceDescriptor: line.displayText,
          rawText: line.rawText,
          sourceSystem: 'lastapp',
          mappedCatalogProductId: line.catalogProductId,
        });
      }
    }
    return Array.from(candidatesMap.values());
  }

  public static toInventoryConsumptionSignals(
    sale: Sale,
    lines: SaleLine[]
  ): InventoryConsumptionSignal[] {
    return lines
      .filter(line => Boolean(line.catalogProductId))
      .map(line => ({
        organizationId: sale.organizationId,
        operationalUnitId: sale.operationalUnitId,
        saleId: sale.id,
        saleLineId: line.id,
        occurredAt: sale.occurredAt,
        mappedCatalogProductId: line.catalogProductId!,
        quantity: line.quantity,
        sourceSystem: sale.sourceSystem,
      }));
  }

  public static toFinanceReconciliationInput(sale: Sale): FinanceReconciliationInput {
    return {
      organizationId: sale.organizationId,
      operationalUnitId: sale.operationalUnitId,
      saleId: sale.id,
      occurredAt: sale.occurredAt,
      total: sale.total,
      currency: sale.currency,
      sourcePaymentMethod: sale.sourcePaymentMethod,
      externalInvoiceNumber: sale.externalInvoiceNumber,
      externalTicketCode: sale.externalTicketCode,
      sourceSystem: sale.sourceSystem,
    };
  }

  public static toAnalyticsRevenueFact(sale: Sale, lines: SaleLine[]): AnalyticsRevenueFactInput {
    return {
      organizationId: sale.organizationId,
      operationalUnitId: sale.operationalUnitId,
      saleId: sale.id,
      externalIdentityKey: sale.externalIdentityKey,
      occurredAt: sale.occurredAt,
      sourceChannel: sale.sourceChannel,
      total: sale.total,
      currency: sale.currency,
      lineQuantities: lines.map(l => ({
        displayText: l.displayText,
        quantity: l.quantity,
        mappedCatalogProductId: l.catalogProductId,
      })),
      sourceSystem: sale.sourceSystem,
      salesImportId: sale.salesImportId,
    };
  }
}
