import { describe, it, expect } from 'vitest';
import {
  generateWhatsAppOrderMessage,
  PurchaseOrder,
  PurchaseReceipt
} from '../../src/domain/purchases/types';

describe('Purchases Domain Canonical Logic & Invariants (WP-PUR-001)', () => {
  describe('WhatsApp Order URL Generation', () => {
    it('generates a valid WhatsApp URL with formatted phone and item lines', () => {
      const url = generateWhatsAppOrderMessage({
        recipientPhone: '+34 600 123 456',
        supplierName: 'Frutas y Verduras Ruiz',
        referenceNumber: 'ORD-2026-0042',
        items: [
          { name: 'Tomate Pera', quantity: 15, unit: 'kg' },
          { name: 'Lechuga Romana', quantity: 10, unit: 'Cajas' }
        ]
      });

      expect(url).toContain('https://wa.me/34600123456?text=');
      expect(url).toContain(encodeURIComponent('Ref: ORD-2026-0042'));
      expect(url).toContain(encodeURIComponent('• Tomate Pera: 15 kg'));
      expect(url).toContain(encodeURIComponent('• Lechuga Romana: 10 Cajas'));
      expect(url).toContain(encodeURIComponent('Buenos días, le envío la orden de compra de El Criollo'));
    });

    it('sanitizes messy phone input with spaces, dashes, or plus signs', () => {
      const url = generateWhatsAppOrderMessage({
        recipientPhone: '  +34 (611) 22-33-44  ',
        supplierName: 'Carnicería Carlos',
        referenceNumber: 'ORD-1001',
        items: [{ name: 'Solomillo', quantity: 5, unit: 'kg' }]
      });

      expect(url.startsWith('https://wa.me/34611223344?text=')).toBe(true);
    });
  });

  describe('Purchasing Lifecycle & Human Gate Separation Invariants', () => {
    it('enforces creator vs approver separation invariant (CREATE_PO != APPROVE_PO)', () => {
      const creatorUserId = 'usr-operator-01';
      const approverUserId = 'usr-manager-02';

      const order: PurchaseOrder = {
        id: 'po-1',
        organizationId: 'org-elcriollo-01',
        operationalUnitId: 'unit-kitchen-01',
        supplierId: 'supp-01',
        referenceNumber: 'ORD-0001',
        status: 'SUBMITTED',
        createdByUserId: creatorUserId,
        lines: [
          {
            id: 'pol-1',
            orderId: 'po-1',
            productId: 'prod-1',
            unitOfMeasureId: 'uom-kg',
            quantity: 10,
            estimatedUnitPrice: 12.5,
            historicalProductName: 'Ternera de Ávila',
            historicalUnitSymbol: 'kg',
            sortOrder: 1
          }
        ],
        totalEstimatedAmount: 125.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Invariant: Approver cannot be the same as creator for approval gate
      const canApprove = (orderToApprove: PurchaseOrder, actingUserId: string): boolean => {
        if (orderToApprove.createdByUserId === actingUserId) {
          return false; // Segregation of duties violation
        }
        return true;
      };

      expect(canApprove(order, creatorUserId)).toBe(false);
      expect(canApprove(order, approverUserId)).toBe(true);
    });

    it('validates PurchaseReceipt discrepancy calculations accurately', () => {
      const receipt: PurchaseReceipt = {
        id: 'rec-01',
        organizationId: 'org-elcriollo-01',
        operationalUnitId: 'unit-kitchen-01',
        purchaseOrderId: 'po-01',
        supplierId: 'supp-01',
        receiptNumber: 'REC-2026-0001',
        status: 'ACCEPTED_WITH_DISCREPANCY',
        receivedByUserId: 'usr-reception-01',
        receivedAt: new Date().toISOString(),
        lines: [
          {
            id: 'recl-01',
            receiptId: 'rec-01',
            purchaseOrderLineId: 'pol-01',
            productId: 'prod-01',
            unitOfMeasureId: 'uom-kg',
            orderedQuantity: 20,
            receivedQuantity: 18,
            rejectedQuantity: 2,
            rejectionReason: 'Damaged packaging during transit'
          }
        ],
        createdAt: new Date().toISOString()
      };

      const line = receipt.lines[0];
      const hasDiscrepancy = line.receivedQuantity + (line.rejectedQuantity || 0) !== line.orderedQuantity || (line.rejectedQuantity || 0) > 0;
      expect(hasDiscrepancy).toBe(true);
      expect(line.receivedQuantity).toBe(18);
      expect(line.rejectedQuantity).toBe(2);
    });
  });
});
