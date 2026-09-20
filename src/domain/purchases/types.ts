/**
 * HORECA Modular — Purchases & Suppliers Domain Model
 * Contract Authority: WP-PUR-001
 * 
 * Invariants:
 * - Tenancy Hierarchy: Organization owns Suppliers & Catalogs; OperationalUnit activates orders & receiving.
 * - Human Gate Separation: CREATE_PO != APPROVE_PO | RECEIVE_GOODS != CONFIRM_INVOICE.
 * - Clean Boundaries: Purchases owns Supplier/PO/Receipt operational truth;
 *   Catalog owns Product/UoM; Inventory owns StockLedger; Finance owns BankMovement/Reconciliation.
 */

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CLOSED';

export type PurchaseReceiptStatus =
  | 'PENDING_INSPECTION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_WITH_DISCREPANCY';

export type SupplierInvoiceOperationalStatus =
  | 'RECORDED'
  | 'MATCHED'
  | 'DISCREPANT'
  | 'FORWARDED_TO_FINANCE';

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  commercialName?: string;
  taxId?: string; // CIF/NIF (Spain standard)
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  contactPerson?: string;
  family?: string;
  paymentMethod?: string;
  leadTimeDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierReference {
  id: string;
  organizationId: string;
  supplierId: string;
  externalRefCode: string;
  operationalNotes?: string;
  createdAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  orderId: string;
  productId: string;
  supplierProductReferenceId?: string;
  unitOfMeasureId: string;
  quantity: number;
  estimatedUnitPrice?: number;
  historicalProductName: string;
  historicalUnitSymbol: string;
  notes?: string;
  sortOrder: number;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  operationalUnitId: string;
  supplierId: string;
  referenceNumber: string; // e.g. ORD-2026-0001
  status: PurchaseOrderStatus;
  createdByUserId: string;
  approvedByUserId?: string;
  approvedAt?: string;
  sentAt?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  whatsappMessageSnapshot?: string;
  lines: PurchaseOrderLine[];
  totalEstimatedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReceiptLine {
  id: string;
  receiptId: string;
  purchaseOrderLineId: string;
  productId: string;
  unitOfMeasureId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity?: number;
  rejectionReason?: string;
  lotNumber?: string;
  expiryDate?: string;
}

export interface PurchaseReceipt {
  id: string;
  organizationId: string;
  operationalUnitId: string;
  purchaseOrderId: string;
  supplierId: string;
  receiptNumber: string; // e.g. REC-2026-0001
  status: PurchaseReceiptStatus;
  receivedByUserId: string;
  receivedAt: string;
  notes?: string;
  lines: PurchaseReceiptLine[];
  createdAt: string;
}

export interface SupplierInvoiceMetadata {
  id: string;
  organizationId: string;
  operationalUnitId: string;
  supplierId: string;
  purchaseOrderId?: string;
  purchaseReceiptId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalTaxExclusive: number;
  totalTaxInclusive: number;
  taxAmount: number;
  currency: string;
  status: SupplierInvoiceOperationalStatus;
  operationalNotes?: string;
  createdAt: string;
}

/**
 * WhatsApp Order Message Formatting Contract
 */
export interface WhatsAppOrderPayload {
  recipientPhone: string;
  supplierName: string;
  referenceNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  customIntro?: string;
  customOutro?: string;
}

export function generateWhatsAppOrderMessage(payload: WhatsAppOrderPayload): string {
  const intro = payload.customIntro || 'Buenos días, le envío la orden de compra de El Criollo, ¡muchas gracias!';
  const outro = payload.customOutro || 'Quedo a la espera de confirmación. Saludos cordiales.';
  
  const formattedPhone = payload.recipientPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  let body = `${intro}\n\n`;
  if (payload.referenceNumber) {
    body += `Ref: ${payload.referenceNumber}\n\n`;
  }
  payload.items.forEach(item => {
    body += `• ${item.name}: ${item.quantity} ${item.unit}\n`;
  });
  body += `\n${outro}`;

  return `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(body)}`;
}
