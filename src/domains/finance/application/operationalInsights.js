import { financeMetrics, genericEconomicTypes } from '../domain/economic';
import { moneyToMinorUnits } from '../domain/money';

export const PAGE_SIZES = [25, 50, 100];
export function paginateMovements(rows, requestedPage = 1, requestedSize = 25) {
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, Math.floor(requestedPage) || 1));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalPages, total: rows.length };
}
export function normalizeFinanceDescription(text = '') {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const bankWords = new Set(['PAGO','PAGOS','COMPRA','COMPRAS','TARJETA','RECIBO','ADEUDO','ABONO','TRANSFERENCIA','TRANSFER','TRASPASO','SEPA','REF','REFERENCIA','FACTURA','FECHA','CONCEPTO','DOMICILIACION','BANCARIO','BANK','PAYMENT','CARD','POS','TPV','DE','DEL','LA','EL','EN','ES','SL','SA']);
function merchantKey(text) {
  return normalizeFinanceDescription(text).split(' ').filter(t => /^[A-Z]{3,}$/.test(t) && !bankWords.has(t)).join(' ');
}
export function semanticKey(a) { return JSON.stringify([a.economic_type, a.category_id || '', a.subcategory_id || '', a.counterparty_id || '']); }
function scopedKey(m, org) { return JSON.stringify([org, m.currency || 'EUR', m.source_account_id, Math.sign(Number(m.monto)), merchantKey(m.descripcion)]); }
function genericExample(m) {
  if (m.allocations?.length !== 1) return null;
  const a = m.allocations[0];
  return a.classification_status === 'CONFIRMED' && a.economic_type !== 'UNCLASSIFIED' && genericEconomicTypes.includes(a.economic_type) && !a.transfer_candidate_id ? a : null;
}
// One pass over explicit tenant history; a conflicted bucket never produces a suggestion.
export function buildConfirmedSimilarityIndex(movements, organizationId) {
  const buckets = new Map();
  if (!organizationId) return buckets;
  for (const m of movements) {
    if (m.organization_id !== organizationId || (m.status && m.status !== 'ACTIVE') || !m.source_account_id) continue;
    const a = genericExample(m), merchant = merchantKey(m.descripcion);
    if (!a || merchant.length < 5) continue;
    const key = scopedKey(m, organizationId), signature = semanticKey(a), bucket = buckets.get(key);
    if (bucket) { bucket.count++; if (bucket.signature !== signature) bucket.conflict = true; }
    else buckets.set(key, { count: 1, signature, conflict: false, interpretation: { economic_type:a.economic_type, category_id:a.category_id || '', subcategory_id:a.subcategory_id || '', counterparty_id:a.counterparty_id || '' }, example: m, merchant });
  }
  return buckets;
}
export function findSimilarClassificationSuggestion(m, index, organizationId) {
  if (!organizationId || m.organization_id !== organizationId || (m.status && m.status !== 'ACTIVE') || m.allocations?.length !== 1) return null;
  const a = m.allocations[0];
  if (a.classification_status !== 'PENDING' || a.transfer_candidate_id || a.reconciliation_status === 'CONFIRMED') return null;
  const bucket = index.get(scopedKey(m, organizationId));
  if (!bucket || bucket.conflict || bucket.count < 2 || (a.counterparty_id && a.counterparty_id !== bucket.interpretation.counterparty_id)) return null;
  return { ...bucket.interpretation, classification_status: 'SUGGESTED', count: bucket.count,
    explanation: `Basado en ${bucket.count} movimientos similares`, groupKey: bucket.signature,
    example: bucket.example, merchant: bucket.merchant };
}
export function buildSuggestionGroups(movements, index, organizationId, dismissed = new Set()) {
  const suggestions = new Map(), groups = new Map();
  for (const m of movements) {
    const suggestion = !dismissed.has(m.id) && findSimilarClassificationSuggestion(m, index, organizationId);
    if (!suggestion) continue;
    suggestions.set(m.id, suggestion);
    const group = groups.get(suggestion.groupKey);
    if (group) group.ids.add(m.id);
    else groups.set(suggestion.groupKey, { ...suggestion, ids: new Set([m.id]) });
  }
  return { suggestions, groups };
}
export function previewRuleMatches(movements, {pattern, account = '', sign = 'ALL'}) {
  const text = pattern.trim().toUpperCase();
  if (!text) return 0;
  return movements.filter(m => (!m.status || m.status === 'ACTIVE') && (!account || m.source_account_id === account)
    && (sign === 'ALL' || (sign === 'NEGATIVE' && Number(m.monto) < 0) || (sign === 'POSITIVE' && Number(m.monto) > 0))
    && m.descripcion.toUpperCase().includes(text) && m.allocations?.length === 1
    && m.allocations[0].classification_status === 'PENDING' && !m.allocations[0].transfer_candidate_id && m.allocations[0].reconciliation_status !== 'CONFIRMED').length;
}
export const percentage = (numerator, denominator) => denominator > 0 ? numerator * 100 / denominator : 0;
export function financeInsights(movements, currency = 'EUR') {
  const rows = movements.filter(m => (!m.status || m.status === 'ACTIVE') && (m.currency || 'EUR') === currency);
  const metrics = financeMetrics(rows, currency), accounts = new Map();
  const categories = new Map(), providers = new Map(), subcategories = new Map();
  let operatingOutflow = 0, allocationVolume = 0, unresolvedVolume = 0, confirmed = 0, attention = 0;
  for (const m of rows) {
    const metadata = m.source_account, key = metadata?.id || m.source_account_id || 'unknown';
    if (!accounts.has(key)) accounts.set(key, { id:key, name:metadata?.name || 'Sin cuenta', institution:metadata?.institution || 'Sin banco', product:metadata?.product_type || 'UNKNOWN', inflows:0, outflows:0, net:0, count:0 });
    const account = accounts.get(key), amount = moneyToMinorUnits(Number(m.monto));
    account.inflows += Math.max(amount,0); account.outflows += Math.max(-amount,0); account.net += amount; account.count++;
    const allocations = m.allocations?.length ? m.allocations : [{monto:m.monto,classification_status:'PENDING'}];
    let needsReview = false;
    for (const a of allocations) {
      const cents = moneyToMinorUnits(Number(a.monto)); allocationVolume += Math.abs(cents);
      if (a.classification_status !== 'CONFIRMED' || !a.economic_type || a.economic_type === 'UNCLASSIFIED') { unresolvedVolume += Math.abs(cents); needsReview = true; }
      else confirmed++;
      // Gross confirmed OPERATING_EXPENSE outflows are the denominator. Refunds are excluded,
      // while canonical net operating results above continue to include them.
      if (a.classification_status === 'CONFIRMED' && a.economic_type === 'OPERATING_EXPENSE' && cents < 0) {
        operatingOutflow -= cents;
        for (const [map,id,name] of [[categories,a.category_id,a.category?.name || 'Sin categoría'],[subcategories,a.subcategory_id,a.subcategory?.name || 'Sin subcategoría'],[providers,a.counterparty_id,a.counterparty?.name || 'Sin proveedor / contraparte']]) {
          const k = id || 'unknown', item = map.get(k) || {id:k,name,amount:0};item.amount -= cents;map.set(k,item);
        }
      }
    }
    if (needsReview) attention++;
  }
  const ranked = map => [...map.values()].sort((a,b)=>b.amount-a.amount || a.id.localeCompare(b.id)).map(x=>({...x,percent:percentage(x.amount,operatingOutflow)}));
  return { metrics, accounts:[...accounts.values()], categories:ranked(categories), providers:ranked(providers), subcategories:ranked(subcategories), operatingOutflow, allocationVolume, unresolvedVolume, unresolvedPercent:percentage(unresolvedVolume,allocationVolume), confirmed, attention };
}
