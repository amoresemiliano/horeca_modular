import { Supplier, SupplierReference, PurchaseOrder, PurchaseReceipt, SupplierInvoiceMetadata } from '../types';

export interface ISupplierRepository {
  findById(id: string, organizationId: string): Promise<Supplier | null>;
  listByOrganization(organizationId: string, options?: { family?: string; activeOnly?: boolean }): Promise<Supplier[]>;
  save(supplier: Supplier): Promise<void>;
  delete(id: string, organizationId: string): Promise<void>;
  
  findReferences(supplierId: string, organizationId: string): Promise<SupplierReference[]>;
  saveReference(ref: SupplierReference): Promise<void>;
}

export interface IPurchaseOrderRepository {
  findById(id: string, organizationId: string): Promise<PurchaseOrder | null>;
  listByOperationalUnit(
    organizationId: string,
    operationalUnitId: string,
    filters?: {
      status?: string;
      supplierId?: string;
      dateFrom?: string;
      dateTo?: string;
      searchRef?: string;
    }
  ): Promise<PurchaseOrder[]>;
  save(order: PurchaseOrder): Promise<void>;
  delete(id: string, organizationId: string): Promise<void>;
  generateNextReferenceNumber(organizationId: string, operationalUnitId: string): Promise<string>;
}

export interface IPurchaseReceiptRepository {
  findById(id: string, organizationId: string): Promise<PurchaseReceipt | null>;
  listByPurchaseOrder(purchaseOrderId: string, organizationId: string): Promise<PurchaseReceipt[]>;
  save(receipt: PurchaseReceipt): Promise<void>;
}

export interface ISupplierInvoiceMetadataRepository {
  findById(id: string, organizationId: string): Promise<SupplierInvoiceMetadata | null>;
  listBySupplier(supplierId: string, organizationId: string): Promise<SupplierInvoiceMetadata[]>;
  save(metadata: SupplierInvoiceMetadata): Promise<void>;
}
