import type { SourceTab, SourceBill, SourceProduct } from '../ports/SalesSourcePort.js';
import { Sale } from '../../../domain/sales/models/Sale.js';
import { SaleLine, SaleLineItemType } from '../../../domain/sales/models/SaleLine.js';
import { generateUuid, sha256Hex } from '../../../shared/utils/crypto.js';

export interface ProductMapping { status: 'MAPPED' | 'UNMAPPED' | 'IGNORED'; productId?: string }
export interface MappingContext {
  organizationId: string; operationalUnitId: string; externalLocationId: string;
  currency: string; syncRunId: string; observedAt: string;
  products: Map<string, ProductMapping>;
}
/** The sole API money conversion boundary. API numbers are minor units, never CSV text. */
export function sourceMoney(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('INVALID_SOURCE_MONEY');
  return value / 100;
}
function time(value: string): Date {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error('INVALID_SOURCE_TIMESTAMP');
  return date;
}
function moneyFacts(bill: SourceBill) {
  const facts: Record<string, unknown> = { id: bill.id, number: bill.number,
    rectifiedBillNumber: bill.rectifiedBillNumber ?? null, creationTime: bill.creationTime,
    finalizingTime: bill.finalizingTime ?? null, taxPercentage: bill.taxPercentage ?? null,
    terraceSurchargePercentage: bill.terraceSurchargePercentage ?? null,
    preferredPaymentMethod: bill.preferredPaymentMethod ?? null };
  for (const key of ['total','tax','taxableBase','discountTotal','deliveryFee','minimumBasketSurcharge','terraceSurcharge'] as const) {
    facts[key] = bill[key] == null ? null : sourceMoney(bill[key]);
  }
  facts.payments = (bill.payments ?? []).map(p => ({id: p.id, billId: p.billId ?? bill.id,
    type: p.type, amount: sourceMoney(p.amount), tip: p.tip == null ? null : sourceMoney(p.tip),
    creationTime: p.creationTime, deleted: p.deleted}));
  return facts;
}
export function mapLastAppSale(tab: SourceTab, ctx: MappingContext) {
  if (!ctx.organizationId || !ctx.operationalUnitId || tab.locationId !== ctx.externalLocationId || !tab.id) throw new Error('SOURCE_SCOPE_MISMATCH');
  if (ctx.currency !== 'EUR') throw new Error('UNSUPPORTED_SOURCE_CURRENCY');
  if (!Array.isArray(tab.bills) || !Array.isArray(tab.products)) throw new Error('INCOMPLETE_SOURCE_TAB');
  const saleId = generateUuid();
  const seenBills = new Set<string>();
  for (const bill of tab.bills) {
    if (!bill.id || seenBills.has(bill.id)) throw new Error('INVALID_SOURCE_BILLS');
    seenBills.add(bill.id);
  }
  const billFacts = tab.bills.map(moneyFacts);
  const totalMinor = tab.bills.reduce((sum, b) => { sourceMoney(b.total); return sum + b.total; }, 0);
  const paidMinor = tab.bills.flatMap(b => b.payments ?? []).filter(p => !p.deleted)
    .reduce((sum, p) => { sourceMoney(p.amount); return sum + p.amount; }, 0);
  const lines: SaleLine[] = [];
  let unmappedProducts = 0;
  const seenLines = new Set<string>();
  const append = (product: SourceProduct, parent: string | null, depth: number, kind: SaleLineItemType, path: string) => {
    if (product.deleted) return;
    if (!product.id || !product.name || !Number.isFinite(product.quantity) || product.quantity <= 0 || depth > 8) throw new Error('INVALID_SOURCE_LINE');
    const sourceKey = `${path}/${product.id}`;
    if (seenLines.has(sourceKey)) throw new Error('DUPLICATE_SOURCE_LINE');
    seenLines.add(sourceKey);
    const mapping = product.catalogProductId ? ctx.products.get(product.catalogProductId) : undefined;
    const mappingStatus = mapping?.status ?? 'UNMAPPED';
    if (kind !== 'MODIFIER' && mappingStatus === 'UNMAPPED') unmappedProducts++;
    const id = generateUuid();
    lines.push(SaleLine.create({id, organizationId: ctx.organizationId, saleId, parentLineId: parent,
      lineIndex: lines.length, depth, rawText: product.name, displayText: product.name,
      quantity: product.quantity, itemType: kind, catalogProductId: mappingStatus === 'MAPPED' ? mapping?.productId : null,
      sourceFacts: { externalLineId: product.id, externalCatalogProductId: product.catalogProductId ?? null,
        externalTabProductId: product.tabProductId ?? (depth === 0 ? product.id : null),
        externalModifierId: kind === 'MODIFIER' ? product.id : null,
        externalCatalogModifierId: product.catalogModifierId ?? null, mappingStatus,
        price: product.price == null ? null : sourceMoney(product.price),
        originalPrice: product.originalPrice == null ? null : sourceMoney(product.originalPrice),
        priceImpact: product.priceImpact == null ? null : sourceMoney(product.priceImpact) }, createdAt: new Date(ctx.observedAt)}));
    for (const modifier of product.modifiers ?? []) append(modifier, id, depth + 1, 'MODIFIER', sourceKey);
    for (const child of product.comboProducts ?? []) append(child, id, depth + 1, 'COMBO_COMPONENT', sourceKey);
  };
  tab.products.forEach(p => append(p, null, 0, 'PRODUCT', 'tab'));
  // Bill products have independent source IDs; retain their minimized hierarchy without doubling sold quantities.
  const sanitizeProduct = (p: SourceProduct, depth = 0): Record<string, unknown> => {
    if (depth > 8) throw new Error('INVALID_SOURCE_LINE');
    return {id: p.id, tabProductId: p.tabProductId ?? null, catalogProductId: p.catalogProductId ?? null,
      name: p.name, quantity: p.quantity, price: p.price == null ? null : sourceMoney(p.price),
      originalPrice: p.originalPrice == null ? null : sourceMoney(p.originalPrice),
      catalogModifierId: p.catalogModifierId ?? null, priceImpact: p.priceImpact == null ? null : sourceMoney(p.priceImpact),
      modifiers: (p.modifiers ?? []).map(m => sanitizeProduct(m, depth + 1)),
      comboProducts: (p.comboProducts ?? []).map(m => sanitizeProduct(m, depth + 1))};
  };
  billFacts.forEach((fact, i) => { fact.products = (tab.bills![i].products ?? []).map(p => sanitizeProduct(p)); });
  const evidence = { creationTime: tab.creationTime, activationTime: tab.activationTime ?? null,
    closeTime: tab.closeTime ?? null, cancelTime: tab.cancelTime ?? null,
    schedulingTime: tab.schedulingTime ?? null, pickupType: tab.pickupType ?? null,
    locationBrandId: tab.locationBrandId ?? null, seats: tab.seats ?? null, bills: billFacts };
  const status = tab.cancelTime ? 'VOIDED' : tab.bills.some(b => b.rectifiedBillNumber != null) ? 'REVIEW_REQUIRED' : tab.closeTime ? 'CONFIRMED' : 'OPEN';
  const fingerprintInput = JSON.stringify({evidence, source: tab.source, code: tab.code,
    lines: lines.map(l => ({...l.sourceFacts, catalogProductId:l.catalogProductId, quantity: l.quantity, displayText: l.displayText, depth: l.depth})), status});
  const fingerprint = sha256Hex(Array.from(new TextEncoder().encode(fingerprintInput), b => String.fromCharCode(b)).join(''));
  const sale = Sale.create({id: saleId, organizationId: ctx.organizationId, operationalUnitId: ctx.operationalUnitId,
    salesImportId: '', syncRunId: ctx.syncRunId, sourceSystem: 'LAST_APP', exportType: 'API_V2',
    externalLocationId: tab.locationId, externalSaleId: tab.id, sourceLocation: tab.locationId,
    externalTicketCode: tab.code ?? tab.id, externalIdentityKey: sha256Hex(JSON.stringify([ctx.organizationId,'LAST_APP',tab.locationId,tab.id])),
    externalIdentityAlgorithm: 'LASTAPP_TAB_UUID_V1', occurredAt: time(tab.creationTime), sourceChannel: tab.source ?? null,
    total: sourceMoney(totalMinor), paidAmount: sourceMoney(paidMinor), currency: ctx.currency, status,
    sourceObservedAt: ctx.observedAt, sourceFingerprint: fingerprint, sourceAdapterVersion: 'lastapp-v2/1',
    rawPayload: evidence, createdAt: new Date(ctx.observedAt), updatedAt: new Date(ctx.observedAt)});
  return {sale, lines, bills: billFacts, unmappedProducts};
}
